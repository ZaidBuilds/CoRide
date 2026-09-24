import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ArrowLeftIcon, ArrowClockwiseIcon, DotsThreeVerticalIcon, FlagIcon, ProhibitIcon, WifiSlashIcon } from '@phosphor-icons/react';
import type { Socket } from 'socket.io-client';
import type { UserProfile, RoomPresenceTraveler } from '../types';
import { useChatMessages, useKeyboardSafeHeight, MAX_MESSAGE_LENGTH } from '../hooks/useChatMessages';
import { MessageList, ChatComposer, type ChatListItem } from './MessageList';
import { ReportSheet } from './ReportSheet';
import { triggerHaptic, pushBackHandler } from '../utils/nativeBridge';
import { Toast } from './ui/Toast';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { LinePill } from './ui/LinePill';
import { getLineById } from '../data/metroData';
import { authHeaders } from '../utils/auth';
import { API } from '../config';

interface Peer {
  id: string;
  pseudonym?: string;
  username?: string;
  avatarBg?: string;
  /** The line they usually ride, if their profile says. Fetched when absent. */
  favoriteLineId?: string;
}

interface Props {
  currentUser: UserProfile | null;
  peer: Peer;
  onBack?: () => void;
  onBlocked?: (peerId: string) => void;
  /** Live socket — when given, new messages arrive instantly via new_dm. */
  socket?: Socket | null;
}

export function DirectChatScreen({ currentUser, peer, onBack, onBlocked, socket = null }: Props) {
  const { messages, outbox, loading, error, send, retry, discard, refresh } = useChatMessages(currentUser?.id, peer.id, socket);
  const [input, setInput] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToastMsg(null), []);
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const blockedViaReport = useRef(false);
  const keyboardHeight = useKeyboardSafeHeight();

  const name = peer.pseudonym || peer.username?.replace(/^@/, '') || 'Friend';

  // Their usual line (profile.favoriteLineId) for the header pill. Only shown
  // when the profile actually has one; never guessed.
  const [usualLineId, setUsualLineId] = useState<string | undefined>(peer.favoriteLineId);
  useEffect(() => {
    if (peer.favoriteLineId) return;
    let alive = true;
    fetch(`${API}/api/profile/${encodeURIComponent(peer.id)}`, { headers: { ...authHeaders() } })
      .then(r => (r.ok ? r.json() : null))
      .then(j => { if (alive && j?.profile?.favoriteLineId) setUsualLineId(j.profile.favoriteLineId); })
      .catch(() => { /* header just shows the name */ });
    return () => { alive = false; };
  }, [peer.id, peer.favoriteLineId]);
  const usualLine = usualLineId ? getLineById(usualLineId) : undefined;

  const showToast = useCallback((msg: string) => setToastMsg(msg), []);

  // A blocked thread is over: let the parent close it (and refresh its lists)
  // when it handles blocks, otherwise just go back.
  const leaveAfterBlock = useCallback(() => {
    if (onBlocked) onBlocked(peer.id);
    else onBack?.();
  }, [onBlocked, onBack, peer.id]);

  // Android back closes the menu / dialog first.
  useEffect(() => {
    if (!showMenu) return;
    return pushBackHandler(() => { setShowMenu(false); return true; });
  }, [showMenu]);
  useEffect(() => {
    if (!showBlockConfirm) return;
    return pushBackHandler(() => { setShowBlockConfirm(false); return true; });
  }, [showBlockConfirm]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Close the overflow menu on outside tap / Escape, and return focus.
  useEffect(() => {
    if (!showMenu) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || menuBtnRef.current?.contains(t)) return;
      setShowMenu(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') { setShowMenu(false); menuBtnRef.current?.focus(); }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [showMenu]);

  // Escape closes the block dialog.
  useEffect(() => {
    if (!showBlockConfirm) return;
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setShowBlockConfirm(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showBlockConfirm]);

  const items: ChatListItem[] = useMemo(() => [
    ...messages.map(m => ({
      key: m.id,
      senderId: m.senderId,
      content: m.content,
      timestamp: m.timestamp,
      status: m.senderId === currentUser?.id ? 'sent' as const : undefined
    })),
    ...outbox.map(o => ({
      key: o.clientId,
      senderId: currentUser?.id || 'me',
      content: o.content,
      timestamp: o.timestamp,
      status: o.status,
      error: o.error
    }))
  ], [messages, outbox, currentUser?.id]);

  const handleBlockConfirm = async () => {
    triggerHaptic('medium');
    setBlocking(true);
    try {
      const res = await fetch(`${API}/api/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ targetId: peer.id })
      });
      if (!res.ok) throw new Error();
      setShowBlockConfirm(false);
      leaveAfterBlock();
    } catch {
      showToast(`Couldn't block ${name}. Try again.`);
    } finally {
      setBlocking(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: keyboardHeight ? `${keyboardHeight}px` : '100%',
        minHeight: 0,
        background: 'var(--bg-base)'
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 4px 8px 4px',
          paddingTop: 'calc(8px + var(--safe-top))',
          minHeight: 'calc(64px + var(--safe-top))',
          background: 'var(--bg-base)',
          borderBottom: '1px solid var(--border-subtle)',
          position: 'relative',
          zIndex: 10,
          flexShrink: 0
        }}
      >
        {onBack && (
          <IconButton label="Back to chats" variant="plain" onClick={onBack}>
            <ArrowLeftIcon size={24} aria-hidden="true" />
          </IconButton>
        )}

        <Avatar name={name} seed={peer.id} bg={peer.avatarBg} size={40} />

        <div style={{ flex: 1, minWidth: 0, marginLeft: 4 }}>
          <h1 className="type-headline" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
          </h1>
          {usualLine && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span className="type-meta" style={{ color: 'var(--text-muted)' }}>Usually rides</span>
              <LinePill line={usualLine} size="sm" />
            </div>
          )}
        </div>

        <button
          ref={menuBtnRef}
          type="button"
          className="icon-btn plain"
          aria-label={`More options for ${name}`}
          aria-haspopup="menu"
          aria-expanded={showMenu}
          onClick={() => { void triggerHaptic('light'); setShowMenu(v => !v); }}
        >
          <DotsThreeVerticalIcon size={24} weight="bold" aria-hidden="true" />
        </button>

        {showMenu && (
          <div
            ref={menuRef}
            role="menu"
            aria-label="Chat options"
            className="animate-fade-in"
            style={{
              position: 'absolute',
              top: 'calc(100% - 4px)',
              right: 8,
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-float)',
              padding: '6px 0',
              zIndex: 30,
              minWidth: 220,
              overflow: 'hidden'
            }}
          >
            <button
              role="menuitem"
              onClick={() => { setShowMenu(false); setShowReportSheet(true); }}
              style={menuItem}
            >
              <FlagIcon size={20} aria-hidden="true" style={{ color: 'var(--text-secondary)' }} /> Report {name}
            </button>
            <button
              role="menuitem"
              onClick={() => { setShowMenu(false); setShowBlockConfirm(true); }}
              style={{ ...menuItem, color: 'var(--danger-text)' }}
            >
              <ProhibitIcon size={20} aria-hidden="true" /> Block {name}
            </button>
          </div>
        )}
      </header>

      {/* Connection / load problems: one honest line, never a wall. */}
      {(!online || (error && !loading)) && (
        <div
          role="status"
          style={{
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
            padding: '0 4px 0 16px',
            background: 'var(--bg-surface)', boxShadow: 'inset 4px 0 0 var(--status-warn)'
          }}
        >
          <WifiSlashIcon size={18} aria-hidden="true" style={{ color: 'var(--warning-text)', flexShrink: 0 }} />
          <span className="type-meta" style={{ flex: 1, color: 'var(--text-secondary)', padding: '12px 0' }}>
            {!online ? "You're offline. Messages send when you reconnect." : error}
          </span>
          {online && (
            <button onClick={refresh} className="press" aria-label="Retry loading messages" style={{ ...menuItem, width: 'auto', padding: '0 12px', fontSize: 14 }}>
              <ArrowClockwiseIcon size={16} aria-hidden="true" /> Retry
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <MessageList
        items={items}
        currentUserId={currentUser?.id}
        loading={loading}
        ariaLabel={`Messages with ${name}`}
        onRetry={retry}
        onDiscard={discard}
        empty={
          error ? (
            <p className="type-body" style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
              Couldn't load this conversation.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: 280 }}>
              <Avatar name={name} seed={peer.id} bg={peer.avatarBg} size={64} />
              <p className="type-headline" style={{ color: 'var(--text-primary)', margin: '14px 0 4px' }}>
                You and {name} are connected
              </p>
              <p className="type-body" style={{ color: 'var(--text-secondary)' }}>
                Say hello. You could ask which coach they usually board.
              </p>
            </div>
          )
        }
      />

      {/* Composer */}
      <ChatComposer
        id="dm-composer"
        value={input}
        onChange={setInput}
        onSend={text => { triggerHaptic('light'); send(text); setInput(''); }}
        ariaLabel={`Message ${name}`}
        maxLength={MAX_MESSAGE_LENGTH}
        safeAreaBottom={!keyboardHeight}
        sendDisabled={!currentUser}
      />

      {/* Report Modal */}
      <ReportSheet
        open={showReportSheet}
        traveler={{
          id: peer.id,
          username: peer.username || `@${name.toLowerCase()}`,
          pseudonym: name,
          interestTags: []
        } as unknown as RoomPresenceTraveler}
        currentUserId={currentUser?.id}
        onClose={() => setShowReportSheet(false)}
        // The sheet shows its own confirmation; if they also blocked, leave
        // the (now frozen) thread once they dismiss it.
        onBlocked={() => { blockedViaReport.current = true; }}
        onReported={() => {
          setShowReportSheet(false);
          if (blockedViaReport.current) leaveAfterBlock();
        }}
      />

      {/* Block Confirmation Dialog */}
      {showBlockConfirm && (
        <div
          className="animate-fade-in"
          onClick={() => !blocking && setShowBlockConfirm(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--scrim)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="dm-block-title"
            aria-describedby="dm-block-desc"
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius-sheet)',
              padding: 24,
              maxWidth: 360,
              width: '100%',
              boxShadow: 'var(--shadow-float)'
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--radius-squircle)',
                background: 'var(--bg-tonal)',
                color: 'var(--danger-text)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16
              }}
            >
              <ProhibitIcon size={24} />
            </div>
            <h3 id="dm-block-title" className="type-title" style={{ color: 'var(--text-primary)', marginBottom: 8 }}>
              Block {name}?
            </h3>
            <p id="dm-block-desc" className="type-body" style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
              They disappear from your rooms, your connection ends, and neither of you can message the other.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                type="button"
                variant="tonal"
                autoFocus
                onClick={() => setShowBlockConfirm(false)}
                disabled={blocking}
                style={{ flex: 1 }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleBlockConfirm}
                isLoading={blocking}
                style={{ flex: 1 }}
              >
                Block
              </Button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toastMsg} onDismiss={dismissToast} aboveNav={false} />
    </div>
  );
}

const menuItem: React.CSSProperties = {
  width: '100%',
  minHeight: 48,
  padding: '0 16px',
  background: 'none',
  border: 'none',
  color: 'var(--text-primary)',
  fontSize: 16,
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  cursor: 'pointer',
  textAlign: 'left',
  borderRadius: 'var(--radius-pill)'
};
