import React, { useEffect, useId, useRef } from 'react';
import { pushBackHandler } from '../../utils/nativeBridge';

/**
 * Sheet: accessible modal bottom sheet. Surface colour, 24px top corners,
 * ink-tinted float shadow, spring-like 320ms rise (fade only under reduced motion).
 *
 *   <Sheet open={open} onClose={() => setOpen(false)} title="Report user">
 *     …content…
 *   </Sheet>
 *
 * Gives you for free: scrim tap to close, Escape to close, Android back button
 * closes it (via pushBackHandler), focus moves into the sheet and returns to
 * the opener on close, page scroll is locked, safe-area bottom padding, and
 * reduced-motion handling (from index.css). Pass `title` for a visible heading
 * (also the accessible name), or `ariaLabel` when the content has its own.
 */
interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  ariaLabel?: string;
  /** Hide the grab handle (e.g. for a full-height picker). */
  hideHandle?: boolean;
  children: React.ReactNode;
}

export const Sheet: React.FC<SheetProps> = ({ open, onClose, title, ariaLabel, hideHandle = false, children }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus the first focusable control, else the panel itself.
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    (first ?? panel)?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); }
      if (e.key === 'Tab' && panel) {
        const items = Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'));
        if (!items.length) return;
        const firstEl = items[0], lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const popBack = pushBackHandler(() => { closeRef.current(); return true; });

    return () => {
      document.removeEventListener('keydown', onKey);
      popBack();
      document.body.style.overflow = prevOverflow;
      opener?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
        tabIndex={-1}
        className="sheet"
        onClick={e => e.stopPropagation()}
      >
        {!hideHandle && <div className="sheet-handle" aria-hidden="true" />}
        {title && <h2 id={titleId} className="sheet-title" style={{ marginBottom: 12 }}>{title}</h2>}
        {children}
      </div>
    </div>
  );
};
