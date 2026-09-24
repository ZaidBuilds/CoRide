import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../ui/Button';

interface Props {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  cancelLabel?: string;
  /** Red confirm button: reserved for destructive actions (delete, block). */
  destructive?: boolean;
  busy?: boolean;
  /** Shown inside the dialog so a failed action never closes silently. */
  error?: string | null;
  icon?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Modal confirmation. Focus lands on Cancel so a stray Enter never triggers
 * the destructive path; Escape and the scrim cancel unless the action is in
 * flight. Elevated surface, sheet radius, ink-tinted float shadow.
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
  onCancel,
}: Props) {
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  // Latest values without re-running the open effect (which would steal focus
  // back to Cancel on every parent render).
  const latest = useRef({ busy, onCancel });
  useEffect(() => { latest.current = { busy, onCancel }; });

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    // Cancel is the first button in the dialog.
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
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
        padding: 'max(16px, var(--safe-top)) 16px max(16px, var(--safe-bottom))',
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={children ? bodyId : undefined}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 360,
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-sheet)',
          boxShadow: 'var(--shadow-float)',
          padding: 24,
          color: 'var(--text-primary)',
        }}
      >
        {icon && (
          <div
            aria-hidden="true"
            style={{
              width: 48, height: 48, borderRadius: 'var(--radius-squircle)', marginBottom: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: destructive ? 'var(--danger-container)' : 'var(--bg-tonal)',
              color: destructive ? 'var(--danger-text)' : 'var(--text-primary)',
            }}
          >
            {icon}
          </div>
        )}
        <h2 id={titleId} className="type-title">{title}</h2>
        {children && (
          <div id={bodyId} className="type-body" style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
            {children}
          </div>
        )}
        {error && (
          <p role="alert" className="type-meta" style={{ marginTop: 12, color: 'var(--danger-text)' }}>{error}</p>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 24, flexWrap: 'wrap' }}>
          <Button
            type="button"
            variant="tonal"
            onClick={onCancel}
            disabled={busy}
            style={{ flex: '1 1 120px' }}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? 'danger' : 'secondary'}
            onClick={onConfirm}
            isLoading={busy}
            aria-label={busy ? busyLabel || confirmLabel : undefined}
            style={{ flex: '1 1 120px' }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
