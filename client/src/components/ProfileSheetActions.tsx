import { useEffect, useRef, useState } from 'react';
import { UserPlus, Check, MoreHorizontal, Flag, Ban } from 'lucide-react';

export type RequestState = 'idle' | 'sending' | 'sent' | 'already-friends';

interface Props {
  /** Start in 'already-friends' when the viewer and traveler are connected. */
  initialState?: RequestState;
  /**
   * Perform the request. Resolve → 'sent'; reject → back to 'idle' with the
   * error surfaced. May be sync (stub) or async (real API call).
   */
  onSendRequest?: () => Promise<void> | void;
  onReport?: () => void;
  onBlock?: () => void;
}

/**
 * Action row for the ProfileSheet: the primary request pill plus an overflow
 * menu for report/block. The pill's state follows the outcome of onSendRequest
 * rather than a fixed timer, so a rejected request returns to 'idle'.
 */
export function ProfileSheetActions({ initialState = 'idle', onSendRequest, onReport, onBlock }: Props) {
  const [state, setState] = useState<RequestState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Dismiss the overflow menu on any outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

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
      setError(err instanceof Error ? err.message : 'Could not send request.');
    }
  };

  const primary: Record<RequestState, { label: string; icon: React.ReactNode; disabled: boolean; variant: string }> = {
    idle:              { label: 'Send request', icon: <UserPlus size={16} />, disabled: false, variant: 'primary' },
    sending:           { label: 'Sending…',     icon: <UserPlus size={16} />, disabled: true,  variant: 'primary' },
    sent:              { label: 'Request sent',  icon: <Check size={16} />,    disabled: true,  variant: 'secondary' },
    'already-friends': { label: 'Friends',       icon: <Check size={16} />,    disabled: true,  variant: 'secondary' }
  };
  const p = primary[state];

  return (
    <div>
    {error && (
      <div role="alert" style={{ fontSize: 12, color: 'var(--accent-rose-text)', textAlign: 'center', marginBottom: 8 }}>
        {error}
      </div>
    )}
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <button
        className={`pill-button ${p.variant}`}
        style={{ flex: 1 }}
        onClick={sendRequest}
        disabled={p.disabled}
        aria-live="polite"
      >
        {p.icon}
        {p.label}
      </button>

      <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          className="icon-btn"
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(v => !v)}
        >
          <MoreHorizontal size={18} />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="glass-thick"
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              right: 0,
              minWidth: 168,
              borderRadius: 'var(--radius-md)',
              padding: 6,
              zIndex: 1,
              animation: 'fadeIn var(--dur-micro) var(--ease-enter)'
            }}
          >
            <button
              role="menuitem"
              className="list-row"
              style={{ borderRadius: 'var(--radius-sm)', minHeight: 'var(--tap)' }}
              onClick={() => { setMenuOpen(false); onReport?.(); }}
            >
              <Flag size={16} style={{ color: 'var(--accent-amber)', flexShrink: 0 }} />
              <span className="row-text"><span className="row-title">Report</span></span>
            </button>
            <button
              role="menuitem"
              className="list-row"
              style={{ borderRadius: 'var(--radius-sm)', minHeight: 'var(--tap)', color: 'var(--accent-rose-text)' }}
              onClick={() => { setMenuOpen(false); onBlock?.(); }}
            >
              <Ban size={16} style={{ color: 'var(--accent-rose-text)', flexShrink: 0 }} />
              <span className="row-text"><span className="row-title" style={{ color: 'var(--accent-rose-text)' }}>Block</span></span>
            </button>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
