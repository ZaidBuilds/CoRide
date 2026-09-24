import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  cancelLabel?: string;
  /** Red confirm button — reserved for destructive actions (delete, block). */
  destructive?: boolean;
  busy?: boolean;
  /** Shown inside the dialog so a failed action never closes silently. */
  error?: string | null;
  icon?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal confirmation (Material 3 "basic dialog"). Focus lands on Cancel so a
 * stray Enter never triggers the destructive path; Escape and the scrim cancel
 * unless the action is in flight.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busyLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  error,
  icon,
  onConfirm,
  onCancel
}: Props) {
  const titleId = useId();
  const bodyId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  // Latest values without re-running the open effect (which would steal focus
  // back to Cancel on every parent render).
  const latest = useRef({ busy, onCancel });
  useEffect(() => { latest.current = { busy, onCancel }; });

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !latest.current.busy) latest.current.onCancel();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  // Portal to <body>: screen wrappers use animated transforms, which would make
  // `position: fixed` relative to the screen instead of the viewport.
  return createPortal(
    <div
      className="animate-fade-in"
      onClick={() => { if (!busy) onCancel(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'var(--scrim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'max(16px, var(--safe-top)) 16px max(16px, var(--safe-bottom))'
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={children ? bodyId : undefined}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 360,
          background: 'var(--bg-surface-raised)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-lg)',
          padding: 24,
          color: 'var(--text-primary)'
        }}
      >
        {icon && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: destructive ? 'var(--status-danger)' : 'var(--accent)' }}>
            {icon}
          </div>
        )}
        <h2 id={titleId} style={{ fontSize: 20, lineHeight: '28px', fontWeight: 700, margin: 0, textAlign: icon ? 'center' : 'left' }}>
          {title}
        </h2>
        {children && (
          <div id={bodyId} style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-secondary)', marginTop: 12 }}>
            {children}
          </div>
        )}
        {error && (
          <div role="alert" style={{ marginTop: 12, fontSize: 13, lineHeight: '18px', color: 'var(--accent-rose-text)' }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24, flexWrap: 'wrap' }}>
          <button
            ref={cancelRef}
            type="button"
            className="pill-button secondary"
            onClick={onCancel}
            disabled={busy}
            style={{ flex: '1 1 120px' }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`pill-button ${destructive ? 'danger' : 'primary'}`}
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy}
            style={{ flex: '1 1 120px', opacity: busy ? 0.7 : 1 }}
          >
            {busy ? (busyLabel || confirmLabel) : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
