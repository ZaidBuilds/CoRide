import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowClockwiseIcon, CaretDownIcon, CheckIcon, ClockIcon, PaperPlaneRightIcon, TrashIcon, WarningCircleIcon
} from '@phosphor-icons/react';
import { Avatar } from './ui/Avatar';
import { Skeleton } from './ui/Skeleton';

/** One row in a conversation — DMs and room chat both map into this. */
export interface ChatListItem {
  /** Stable React key (server id, or client id for unsent messages). */
  key: string;
  senderId: string;
  senderName?: string;
  senderAvatarBg?: string;
  content: string;
  timestamp: number;
  /** Own messages only. Omit for incoming. */
  status?: 'sending' | 'queued' | 'sent' | 'failed';
  /** Why a failed send failed. */
  error?: string;
  /** Centered system line (joins, game events). */
  system?: boolean;
  /** Tint a system line (game alerts). */
  accent?: boolean;
}

interface Props {
  items: ChatListItem[];
  currentUserId: string | undefined;
  /** Group chat: show sender name + avatar on incoming messages. */
  showSenders?: boolean;
  /** First load in flight — shows placeholder bubbles. */
  loading?: boolean;
  /** Rendered when there are no items and not loading. */
  empty?: ReactNode;
  /** Accessible name for the log, e.g. "Messages with Asha". */
  ariaLabel: string;
  onRetry?: (key: string) => void;
  onDiscard?: (key: string) => void;
  /** Extra UI under a bubble (reactions). */
  renderAfter?: (item: ChatListItem) => ReactNode;
  /** Pinned to the end of the scroll content (typing indicator). */
  footer?: ReactNode;
  /** Tap on a sent bubble (e.g. reveal the reaction picker). */
  onBubbleTap?: (item: ChatListItem) => void;
}

/** Messages within this window from the same sender visually group. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;
/** Distance from the bottom that still counts as "at the bottom". */
const STICKY_PX = 96;
/** Bubble radius and the tail corner (DESIGN: 18 with a 6 tail). */
const R = 18;
const TAIL = 6;

function timeLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function dayLabel(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {})
  });
}

const sameDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

function prefersReducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

/** Time + delivery status, printed inside the bubble (WhatsApp-style). */
function BubbleMeta({ m, isMe }: { m: ChatListItem; isMe: boolean }) {
  return (
    <>
      <span className="tnum">{timeLabel(m.timestamp)}</span>
      {isMe && m.status === 'sent' && <><CheckIcon size={14} weight="bold" aria-hidden="true" /><span className="sr-only">Sent</span></>}
      {isMe && m.status === 'sending' && <><ClockIcon size={13} aria-hidden="true" /><span className="sr-only">Sending</span></>}
      {isMe && m.status === 'queued' && <><ClockIcon size={13} aria-hidden="true" /><span className="sr-only">Waiting for connection</span></>}
      {isMe && m.status === 'failed' && <><WarningCircleIcon size={14} aria-hidden="true" /><span className="sr-only">Not sent</span></>}
    </>
  );
}

/**
 * Conversation thread shared by 1:1 and room chat.
 *
 * Own bubbles are ink, theirs are surface; no line colour, no gradients.
 *
 * Owns its scroll container and the stick-to-bottom rules chat apps use:
 * - first paint jumps straight to the newest message;
 * - new messages keep you pinned only if you were already at the bottom
 *   (or you sent it) — scrolling up to read history is never yanked back;
 * - otherwise a "new messages" pill counts what arrived below;
 * - a shrinking viewport (soft keyboard opening) keeps the bottom in view.
 */
export function MessageList({
  items, currentUserId, showSenders = false, loading = false, empty, ariaLabel,
  onRetry, onDiscard, renderAfter, footer, onBubbleTap
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const lastKeyRef = useRef<string | null>(null);
  const didInitialScroll = useRef(false);
  const [unseen, setUnseen] = useState(0);

  const scrollToBottom = useCallback((smooth: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' });
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < STICKY_PX;
    atBottomRef.current = atBottom;
    if (atBottom && unseen) setUnseen(0);
  };

  // React to appended messages before paint so there's no visible jump.
  useLayoutEffect(() => {
    const last = items[items.length - 1];
    const lastKey = last?.key ?? null;
    if (!last) { lastKeyRef.current = null; return; }
    if (!didInitialScroll.current) {
      didInitialScroll.current = true;
      lastKeyRef.current = lastKey;
      scrollToBottom(false);
      return;
    }
    if (lastKey === lastKeyRef.current) return;
    lastKeyRef.current = lastKey;
    const mine = last.senderId === currentUserId && !last.system;
    if (mine || atBottomRef.current) {
      scrollToBottom(true);
      setUnseen(0);
    } else {
      setUnseen(n => n + 1);
    }
  }, [items, currentUserId, scrollToBottom]);

  // Typing indicator etc. appearing at the end: follow only if pinned.
  useEffect(() => {
    if (footer && atBottomRef.current) scrollToBottom(true);
  }, [footer, scrollToBottom]);

  // Keyboard open / rotation shrinks the scroller — keep the newest message visible.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (atBottomRef.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rows: ReactNode[] = [];
  items.forEach((m, i) => {
    const prev = items[i - 1];
    const next = items[i + 1];
    if (!prev || !sameDay(prev.timestamp, m.timestamp)) {
      rows.push(
        <div key={`day_${m.key}`} role="separator" style={{ display: 'flex', justifyContent: 'center', margin: '16px 0 8px' }}>
          <span
            className="type-meta"
            style={{
              fontWeight: 560, color: 'var(--text-secondary)',
              background: 'var(--bg-surface)',
              padding: '4px 12px', borderRadius: 'var(--radius-pill)'
            }}
          >
            {dayLabel(m.timestamp)}
          </span>
        </div>
      );
    }

    if (m.system) {
      rows.push(
        <div key={m.key} style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
          <div
            className="type-meta"
            style={{
              maxWidth: '88%',
              textAlign: 'center',
              overflowWrap: 'anywhere',
              padding: m.accent ? '6px 12px' : '2px 12px',
              borderRadius: 'var(--radius-pill)',
              color: m.accent ? 'var(--text-primary)' : 'var(--text-muted)',
              background: m.accent ? 'var(--bg-tonal)' : 'transparent',
              fontWeight: m.accent ? 560 : 480
            }}
          >
            {m.content}
          </div>
        </div>
      );
      return;
    }

    const isMe = m.senderId === currentUserId;
    const groupedWithPrev = !!prev && !prev.system && prev.senderId === m.senderId
      && sameDay(prev.timestamp, m.timestamp) && m.timestamp - prev.timestamp < GROUP_WINDOW_MS;
    const groupedWithNext = !!next && !next.system && next.senderId === m.senderId
      && sameDay(next.timestamp, m.timestamp) && next.timestamp - m.timestamp < GROUP_WINDOW_MS;
    const showName = showSenders && !isMe && !groupedWithPrev;
    const showAvatar = showSenders && !isMe;
    const failed = m.status === 'failed';
    const pendingish = m.status === 'sending' || m.status === 'queued';
    // The sender-side bottom corner is the tail; corners that join a run tighten too.
    const radius = isMe
      ? `${R}px ${groupedWithPrev ? TAIL : R}px ${TAIL}px ${R}px`
      : `${groupedWithPrev ? TAIL : R}px ${R}px ${R}px ${TAIL}px`;
    const tappable = !!onBubbleTap && !pendingish && !failed;

    rows.push(
      <div
        key={m.key}
        style={{
          display: 'flex',
          flexDirection: isMe ? 'row-reverse' : 'row',
          alignItems: 'flex-end',
          gap: 8,
          marginTop: groupedWithPrev ? 2 : 12
        }}
      >
        {showAvatar && (
          <div aria-hidden="true" style={{ width: 28, flexShrink: 0 }}>
            {!groupedWithNext && <Avatar name={m.senderName} seed={m.senderId} bg={m.senderAvatarBg} size={28} />}
          </div>
        )}
        <div style={{ maxWidth: '80%', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
          {showName && (
            <span className="type-meta" style={{ fontWeight: 600, color: 'var(--text-secondary)', margin: '0 12px 4px' }}>
              {m.senderName}
            </span>
          )}
          <div
            {...(tappable ? {
              role: 'button',
              tabIndex: 0,
              'aria-label': `${isMe ? 'Your message' : `Message from ${m.senderName || 'them'}`}: ${m.content}. Tap to react`,
              onClick: () => onBubbleTap!(m),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onBubbleTap!(m); }
              }
            } : {})}
            className="type-body"
            style={{
              position: 'relative',
              cursor: tappable ? 'pointer' : undefined,
              maxWidth: '100%',
              padding: '8px 12px 8px 14px',
              borderRadius: radius,
              background: isMe ? 'var(--ink)' : 'var(--bg-surface)',
              color: isMe ? 'var(--ink-inverse)' : 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              opacity: pendingish ? 0.72 : 1,
              ...(failed ? { boxShadow: '0 0 0 2px var(--bg-base), 0 0 0 4px var(--status-danger)' } : {})
            }}
          >
            {m.content}
            {/* Invisible twin reserves room on the last line; the real meta sits in that corner. */}
            <span
              aria-hidden="true"
              className="type-meta"
              style={{ display: 'inline-flex', gap: 3, visibility: 'hidden', marginLeft: 10, fontSize: 12 }}
            >
              <BubbleMeta m={m} isMe={isMe} />
            </span>
            <span
              className="type-meta"
              style={{
                position: 'absolute', right: 10, bottom: 5,
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 12, lineHeight: '16px', whiteSpace: 'nowrap',
                color: isMe ? 'var(--ink-inverse)' : 'var(--text-muted)',
                opacity: isMe ? 0.72 : 1
              }}
            >
              <BubbleMeta m={m} isMe={isMe} />
            </span>
          </div>
          {isMe && m.status === 'queued' && (
            <span className="type-meta" style={{ color: 'var(--text-muted)', margin: '4px 6px 0' }}>
              Waiting for connection
            </span>
          )}
          {failed && (
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 0, marginTop: 2 }}>
              <span role="alert" className="type-meta" style={{ color: 'var(--danger-text)', fontWeight: 560, padding: '0 8px 0 4px' }}>
                {m.error || 'Not sent.'}
              </span>
              {onRetry && (
                <button type="button" onClick={() => onRetry(m.key)} aria-label="Retry sending message" className="press" style={chipBtn}>
                  <ArrowClockwiseIcon size={16} aria-hidden="true" /> Retry
                </button>
              )}
              {onDiscard && (
                <button type="button" onClick={() => onDiscard(m.key)} aria-label="Delete unsent message" className="press" style={{ ...chipBtn, color: 'var(--text-secondary)' }}>
                  <TrashIcon size={16} aria-hidden="true" /> Delete
                </button>
              )}
            </div>
          )}
          {renderAfter && <div style={{ marginTop: 4 }}>{renderAfter(m)}</div>}
        </div>
      </div>
    );
  });

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        role="log"
        aria-label={ariaLabel}
        aria-live="polite"
        aria-busy={loading || undefined}
        style={{
          flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          display: 'flex', flexDirection: 'column',
          padding: '8px 12px 16px'
        }}
      >
        {/* Pushes a short thread to the bottom, next to the composer. */}
        <div style={{ flex: 1 }} />
        {loading && items.length === 0 ? (
          <LoadingBubbles />
        ) : items.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            {empty}
          </div>
        ) : (
          rows
        )}
        {footer}
      </div>

      {unseen > 0 && (
        <button
          type="button"
          onClick={() => { scrollToBottom(true); setUnseen(0); }}
          className="press type-label"
          aria-label={`${unseen} new ${unseen === 1 ? 'message' : 'messages'}, jump to latest`}
          style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            minHeight: 40, padding: '0 16px', borderRadius: 'var(--radius-pill)',
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'var(--ink)', color: 'var(--ink-inverse)', cursor: 'pointer',
            border: 'none', boxShadow: 'var(--shadow-float)'
          }}
        >
          <CaretDownIcon size={16} weight="bold" aria-hidden="true" /> <span className="tnum">{unseen}</span> new
        </button>
      )}
    </div>
  );
}

const chipBtn: React.CSSProperties = {
  minHeight: 48,
  padding: '0 10px',
  background: 'none',
  border: 'none',
  color: 'var(--text-primary)',
  fontSize: 14,
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
  borderRadius: 'var(--radius-pill)'
};

function LoadingBubbles() {
  const rows: { w: string; me: boolean }[] = [
    { w: '58%', me: false }, { w: '42%', me: false }, { w: '50%', me: true }, { w: '36%', me: false }, { w: '62%', me: true }
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0' }}>
      <span className="sr-only">Loading messages</span>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: r.me ? 'flex-end' : 'flex-start' }}>
          <Skeleton
            width={r.w}
            height={40}
            delayMs={i * 90}
            borderRadius={r.me ? `${R}px ${R}px ${TAIL}px ${R}px` : `${R}px ${R}px ${R}px ${TAIL}px`}
          />
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────── Shared chat chrome ─────────────────────────── */

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  ariaLabel: string;
  placeholder?: string;
  maxLength: number;
  /** Add the bottom safe-area inset (false while the keyboard is up). */
  safeAreaBottom?: boolean;
  /** Disable sending (e.g. no user yet). Typing stays enabled. */
  sendDisabled?: boolean;
  id?: string;
}

const COMPOSER_MAX_HEIGHT = 120;

/**
 * Auto-growing pill input on --bg-sunken + a round Signal Lime send button
 * (the one lime element on a chat screen; tonal while there's nothing to
 * send). A counter appears as the draft nears the limit. Enter sends on
 * hardware keyboards, inserts a newline on touch keyboards (as in Android
 * chat apps). The send button never steals focus, so the soft keyboard stays
 * up between messages.
 */
export function ChatComposer({
  value, onChange, onSend, ariaLabel, placeholder = 'Message', maxLength,
  safeAreaBottom = true, sendDisabled = false, id = 'chat-composer'
}: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const trimmed = value.trim();
  const canSend = !!trimmed && !sendDisabled;
  const remaining = maxLength - value.length;
  const showCounter = remaining <= 100;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
  }, [value]);

  const submit = () => {
    if (!canSend) return;
    onSend(trimmed);
    ref.current?.focus();
  };

  return (
    <form
      onSubmit={e => { e.preventDefault(); submit(); }}
      style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
        padding: '8px 8px 8px 12px',
        paddingBottom: safeAreaBottom ? 'calc(8px + var(--safe-bottom))' : 8,
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        flexShrink: 0
      }}
    >
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <textarea
          ref={ref}
          value={value}
          rows={1}
          maxLength={maxLength}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
            const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
            if (coarse) return;
            e.preventDefault();
            submit();
          }}
          aria-label={ariaLabel}
          aria-describedby={showCounter ? `${id}-count` : undefined}
          placeholder={placeholder}
          enterKeyHint="enter"
          style={{
            display: 'block',
            width: '100%',
            minHeight: 48,
            maxHeight: COMPOSER_MAX_HEIGHT,
            padding: '12px 18px',
            borderRadius: 24,
            background: 'var(--bg-sunken)',
            border: '1px solid transparent',
            color: 'var(--text-primary)',
            fontSize: 16,
            lineHeight: '22px',
            resize: 'none',
            overflowY: 'auto',
            fontFamily: 'inherit'
          }}
        />
        {showCounter && (
          <span
            id={`${id}-count`}
            aria-live="polite"
            className="type-meta tnum"
            style={{
              position: 'absolute', right: 16, top: -20, fontWeight: 560,
              color: remaining <= 20 ? 'var(--danger-text)' : 'var(--text-muted)'
            }}
          >
            {remaining === 0 ? `Limit reached (${maxLength})` : `${remaining} left`}
          </span>
        )}
      </div>
      <button
        type="submit"
        aria-label="Send message"
        className="press"
        disabled={!canSend}
        onMouseDown={e => e.preventDefault()}
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: canSend ? 'var(--signal)' : 'var(--bg-tonal)',
          border: 'none',
          color: canSend ? 'var(--ink-fixed)' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          cursor: canSend ? 'pointer' : 'default',
          transition: 'background-color var(--dur-micro) var(--ease-standard), color var(--dur-micro) var(--ease-standard)'
        }}
      >
        <PaperPlaneRightIcon size={22} weight={canSend ? 'fill' : 'regular'} aria-hidden="true" />
      </button>
    </form>
  );
}
