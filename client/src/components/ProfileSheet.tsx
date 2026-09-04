import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Accessible name — id of the title element rendered in children. */
  labelledBy?: string;
  children: ReactNode;
}

/** Drag past this many px (or fling faster than the velocity gate) to dismiss. */
const DISMISS_PX = 120;
const DISMISS_VELOCITY = 0.6; // px per ms

/**
 * Bottom-sheet shell. Owns presentation only — backdrop, drag handle,
 * swipe-to-dismiss, focus + Escape. Content and actions are passed as children
 * so this file never needs to know what a profile is.
 *
 * Entry spring comes from `.sheet`'s CSS animation. While the user is dragging
 * we take over with an inline transform; on release we either dismiss or let
 * the transform snap back via the same spring curve.
 */
export function ProfileSheet({ open, onClose, labelledBy, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const lastMove = useRef<{ y: number; t: number }>({ y: 0, t: 0 });
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);

  // Close on Escape, and lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Move focus into the sheet when it opens.
  useEffect(() => {
    if (open) sheetRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragStartY.current = e.clientY;
    lastMove.current = { y: e.clientY, t: e.timeStamp };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    // Downward only — a sheet does not stretch upward past its anchored top.
    const delta = Math.max(0, e.clientY - dragStartY.current);
    setDragY(delta);
    lastMove.current = { y: e.clientY, t: e.timeStamp };
  };

  const endDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null) return;
    const travelled = e.clientY - dragStartY.current;
    const dt = e.timeStamp - lastMove.current.t || 1;
    const velocity = (e.clientY - lastMove.current.y) / dt;
    dragStartY.current = null;
    setDragging(false);
    if (travelled > DISMISS_PX || velocity > DISMISS_VELOCITY) {
      onClose();
    } else {
      setDragY(0); // snaps back via the CSS transition below
    }
  };

  return (
    <div
      className="sheet-backdrop"
      onClick={onClose}
      // Fade the scrim with the drag so dismissal feels connected to the gesture.
      style={{ opacity: dragging ? Math.max(0.4, 1 - dragY / 400) : undefined }}
    >
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          // Suppress the entry animation while dragging so it doesn't fight the
          // finger; restore the spring for the snap-back on release.
          animation: dragging ? 'none' : undefined,
          transition: dragging
            ? 'none'
            : 'transform var(--dur-std) var(--ease-enter)',
          touchAction: 'none'
        }}
      >
        {/* The handle is the primary drag target; the whole sheet also drags. */}
        <div
          className="sheet-handle"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{ cursor: 'grab', touchAction: 'none', width: 48, height: 5, padding: '12px 0', boxSizing: 'content-box' }}
          aria-hidden="true"
        />
        {children}
      </div>
    </div>
  );
}
