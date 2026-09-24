import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { HandWavingIcon, CheckIcon, DotsThreeVerticalIcon, FlagIcon, ProhibitIcon } from '@phosphor-icons/react';
import { Button } from './ui/Button';

/** 'self' hides the request action entirely: you can't befriend yourself. */
export type RequestState = 'idle' | 'sending' | 'sent' | 'already-friends' | 'self';

interface Props {
  /** Start in 'already-friends' when the viewer and traveler are connected. */
  initialState?: RequestState;
  /** Used in the block confirmation copy. */
  travelerName?: string;
  /**
   * Perform the request. Resolve → 'sent'; reject → back to 'idle' with the
   * error surfaced. May be sync (socket emit) or async (real API call).
   */
  onSendRequest?: () => Promise<void> | void;
  onReport?: () => void;
  onBlock?: () => void;
}

const STATUS_COPY: Partial<Record<RequestState, string>> = {
  sending: 'Sending request',
  sent: 'Request sent',
  'already-friends': 'You are friends'
};

/**
 * Action row for the ProfileSheet: the primary request button plus an overflow
 * menu for Report / Block. The button's state follows the outcome of
 * onSendRequest rather than a fixed timer, so a rejected request returns to
 * 'idle'. Block asks for confirmation: it's destructive and hard to undo
 * from here.
 */
export function ProfileSheetActions({ initialState = 'idle', travelerName, onSendRequest, onReport, onBlock }: Props) {
  const [state, setState] = useState<RequestState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const who = travelerName || 'this person';

  // Dismiss the overflow menu on any outside press.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    firstItemRef.current?.focus();
    return () => window.removeEventListener('pointerdown', onDown);
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    triggerRef.current?.focus();
  };

  const onMenuKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      // Close the menu, not the whole sheet.
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation?.();
      closeMenu();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  const sendRequest = async () => {
    if (state !== 'idle') return;
    setState('sending');
    setError(null);
    try {
      await onSendRequest?.();
      setState('sent');
    } catch (err) {
      // Revert so the user can retry; surface why.
      setState('idle');
      setError(err instanceof Error ? err.message : 'Could not send request. Try again.');
    }
  };

  if (confirmBlock) {
    return (
      <div
        role="alertdialog"
        aria-labelledby="block-confirm-title"
        aria-describedby="block-confirm-desc"
        style={{ background: 'var(--bg-tonal)', borderRadius: 'var(--radius-card)', padding: 16 }}
      >
        <h3 id="block-confirm-title" className="type-headline" style={{ color: 'var(--text-primary)' }}>
          Block {who}?
        </h3>
        <p id="block-confirm-desc" className="type-body" style={{ color: 'var(--text-secondary)', margin: '6px 0 16px' }}>
          They can't see you or message you, and they aren't told. You can unblock them from Profile, Blocked users.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="button" variant="ghost" fullWidth autoFocus onClick={() => setConfirmBlock(false)}>
            Cancel
          </Button>
          <Button type="button" variant="danger" fullWidth icon={<ProhibitIcon size={20} />} onClick={() => { setConfirmBlock(false); onBlock?.(); }}>
            Block
          </Button>
        </div>
      </div>
    );
  }

  const showPrimary = state !== 'self';
  const primary = (() => {
    switch (state) {
      case 'sending':
        return { label: 'Sending', icon: undefined, variant: 'primary' as const, disabled: true, loading: true };
      case 'sent':
        return { label: 'Request sent', icon: <CheckIcon size={20} />, variant: 'tonal' as const, disabled: true, loading: false };
      case 'already-friends':
        return { label: 'Friends', icon: <CheckIcon size={20} />, variant: 'tonal' as const, disabled: true, loading: false };
      default:
        return { label: 'Say hi', icon: <HandWavingIcon size={20} />, variant: 'primary' as const, disabled: false, loading: false };
    }
  })();

  return (
    <div>
      {error && (
        <div role="alert" className="type-meta" style={{ color: 'var(--danger-text)', marginBottom: 8 }}>
          {error}
        </div>
      )}
      {/* Announce state changes without making the button itself a live region. */}
      <div aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
        {STATUS_COPY[state] ?? ''}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {showPrimary ? (
          <Button
            type="button"
            variant={primary.variant}
            size="lg"
            fullWidth
            icon={primary.icon}
            onClick={sendRequest}
            isLoading={primary.loading}
            disabled={primary.disabled && !primary.loading}
            aria-disabled={primary.disabled}
            aria-label={state === 'idle' ? `Say hi to ${who}: sends a request` : undefined}
            // A settled state (sent / friends) is information, not a dead button: keep it legible.
            style={{ flex: 1, ...(state === 'sent' || state === 'already-friends' ? { background: 'var(--bg-tonal)', color: 'var(--text-primary)' } : {}) }}
          >
            {primary.label}
          </Button>
        ) : (
          <div className="type-meta" style={{ flex: 1, color: 'var(--text-muted)' }}>This is you</div>
        )}

        {state !== 'self' && (onReport || onBlock) && (
          <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }} onKeyDown={onMenuKey}>
            <button
              ref={triggerRef}
              type="button"
              className="icon-btn tonal"
              aria-label={`More options for ${who}`}
              title="More options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(v => !v)}
              style={{ width: 56, height: 56 }}
            >
              <DotsThreeVerticalIcon size={24} weight="bold" aria-hidden="true" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                aria-label="Safety options"
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 8px)',
                  right: 0,
                  minWidth: 200,
                  borderRadius: 'var(--radius-card)',
                  padding: 6,
                  zIndex: 2,
                  background: 'var(--bg-elevated)',
                  boxShadow: 'var(--shadow-float)',
                  animation: 'fadeIn var(--dur-micro) var(--ease-enter)'
                }}
              >
                {onReport && (
                  <button
                    ref={firstItemRef}
                    type="button"
                    role="menuitem"
                    className="list-row"
                    style={{ borderRadius: 'var(--radius-sm)', minHeight: 'var(--tap)' }}
                    onClick={() => { setMenuOpen(false); onReport(); }}
                  >
                    <FlagIcon size={22} aria-hidden="true" style={{ color: 'var(--danger-text)', flexShrink: 0 }} />
                    <span className="row-text"><span className="row-title" style={{ color: 'var(--danger-text)' }}>Report {travelerName || ''}</span></span>
                  </button>
                )}
                {onBlock && (
                  <button
                    ref={onReport ? undefined : firstItemRef}
                    type="button"
                    role="menuitem"
                    className="list-row"
                    style={{ borderRadius: 'var(--radius-sm)', minHeight: 'var(--tap)' }}
                    onClick={() => { setMenuOpen(false); setConfirmBlock(true); }}
                  >
                    <ProhibitIcon size={22} aria-hidden="true" style={{ color: 'var(--danger-text)', flexShrink: 0 }} />
                    <span className="row-text"><span className="row-title" style={{ color: 'var(--danger-text)' }}>Block {travelerName || ''}</span></span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
