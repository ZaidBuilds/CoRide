import React, { useEffect } from 'react';

/**
 * Toast: brief, non-blocking feedback ("Request sent", "Profile saved").
 * An ink pill (inverse surface) above the tab bar, announced politely.
 *
 * App.tsx owns the app-wide instance; screens get `showToast(msg)`, or keep a
 * local <Toast> for self-contained flows.
 *
 *   <Toast message={msg} onDismiss={() => setMsg(null)} />
 *   <Toast message="Blocked" actionLabel="Undo" onAction={undo} onDismiss={…} />
 *
 * Copy: short, sentence case, no emoji, no exclamation marks.
 */
interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  /** ms before auto-dismiss. Default 3500 (4500 with an action). */
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
