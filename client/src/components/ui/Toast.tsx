import React, { useEffect } from 'react';

/**
 * Toast — a Material-style snackbar for brief, non-blocking feedback
 * ("Request sent", "Profile saved"). Announced politely to screen readers.
 * Sits above the bottom nav (or the screen edge with `aboveNav={false}`).
 *
 * App.tsx owns the app-wide instance: screens receive `showToast(msg)` or keep
 * their own local <Toast> for self-contained flows.
 *
 *   <Toast message={msg} onDismiss={() => setMsg(null)} />
 *   <Toast message="Blocked" actionLabel="Undo" onAction={undo} onDismiss={…} />
 *
 * Keep messages short, sentence case, no emoji — they read like system text.
 */
interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  /** ms before auto-dismiss. Default 3500 (4500 when there is an action). */
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
  aboveNav?: boolean;
}

export const Toast: React.FC<ToastProps> = ({ message, onDismiss, duration, actionLabel, onAction, aboveNav = true }) => {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, duration ?? (actionLabel ? 4500 : 3500));
    return () => clearTimeout(t);
  }, [message, duration, actionLabel, onDismiss]);

  // The live region stays mounted so the first message is announced reliably.
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {message && (
        <div key={message} className={`toast ${aboveNav ? '' : 'no-nav'}`.trim()}>
          <span style={{ flex: 1, minWidth: 0 }}>{message}</span>
          {actionLabel && onAction && (
            <button type="button" className="toast-action" onClick={() => { onAction(); onDismiss(); }}>
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
