import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState, type ReactNode, type PointerEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';

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
/** Exit slide duration. Matches --motion-medium's feel without waiting on CSS. */
const EXIT_MS = 220;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// ─── Sheet stack ─────────────────────────────────────────────────────────────
// Module-level so nested / back-to-back sheets (profile → report) cooperate:
//  • only the top-most sheet reacts to Escape and the back gesture;
//  • body scroll stays locked while any sheet is open;
//  • one history entry represents "a sheet is open", so the browser / Android
//    back action closes the sheet instead of leaving the app. Closing one sheet
//    and opening another in the same tick reuses that entry instead of racing
//    history.back() against pushState().
type StackEntry = { id: number; close: () => void };
const sheetStack: StackEntry[] = [];
const HISTORY_MARK = '__corideSheet';
let historyArmed = false;
let pendingBack: ReturnType<typeof setTimeout> | null = null;
let popListenerInstalled = false;
let savedOverflow = '';
let nextSheetId = 1;

function armHistory() {
  try {
    const prev = (window.history.state && typeof window.history.state === 'object') ? window.history.state : {};
    window.history.pushState({ ...prev, [HISTORY_MARK]: true }, '');
    historyArmed = true;
  } catch {
    historyArmed = false;
  }
}

function onPopState(e: PopStateEvent) {
  if (!historyArmed) return;
  if (e.state && typeof e.state === 'object' && (e.state as Record<string, unknown>)[HISTORY_MARK]) return;
  historyArmed = false;
  sheetStack[sheetStack.length - 1]?.close();
}

function registerSheet(entry: StackEntry) {
  if (!popListenerInstalled) {
    window.addEventListener('popstate', onPopState);
    popListenerInstalled = true;
  }
  if (sheetStack.length === 0) {
    savedOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  sheetStack.push(entry);
  if (pendingBack) {
    // A sheet closed this tick and another opened — keep the existing entry.
    clearTimeout(pendingBack);
    pendingBack = null;
  }
  if (!historyArmed) armHistory();
}

function unregisterSheet(entry: StackEntry) {
  const i = sheetStack.indexOf(entry);
  if (i >= 0) sheetStack.splice(i, 1);
  if (sheetStack.length > 0) {
    if (!historyArmed) armHistory(); // back consumed our entry; the sheet below needs one
    return;
  }
  document.body.style.overflow = savedOverflow;
  if (historyArmed) {
    pendingBack = setTimeout(() => {
      pendingBack = null;
      if (sheetStack.length > 0 || !historyArmed) return;
      historyArmed = false;
      const st = window.history.state as Record<string, unknown> | null;
      if (st && st[HISTORY_MARK]) window.history.back();
    }, 0);
  }
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Bottom-sheet shell. Owns presentation only — backdrop, drag handle,
 * swipe-to-dismiss, focus trap, Escape / back-to-close and the exit slide.
 * Content and actions are passed as children so this file never needs to know
 * what a profile (or a report form) is.
 *
 * Layout: the handle is pinned; only the body scrolls, so long content (the
 * report form, the station list) keeps its grab affordance in view and touch
 * scrolling inside the body is never swallowed by the drag gesture.
 */
export function ProfileSheet({ open, onClose, labelledBy, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const lastMove = useRef<{ y: number; t: number }>({ y: 0, t: 0 });
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const entryRef = useRef<StackEntry | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [closing, setClosing] = useState(false);
  // Once the CSS entry spring has played, keep `animation: none` so restoring
  // it after a drag doesn't replay the slide-in from the bottom.
  const [entered, setEntered] = useState(false);
  // Children are usually derived from the same state that drives `open`
  // (e.g. `selectedUser && …`), so they vanish the instant the sheet starts
  // closing. Keep the last open frame so the exit slide shows real content.
  const [snapshot, setSnapshot] = useState<ReactNode>(open ? children : null);
  const [prevOpen, setPrevOpen] = useState(open);

  // Adjust state while rendering when `open` flips (no effect round-trip).
  if (open !== prevOpen) {
    setPrevOpen(open);
    setDragY(0);
    setDragging(false);
    if (open) {
      setClosing(false);
      setEntered(false);
    } else {
      setClosing(!prefersReducedMotion());
    }
  }
  if (open && snapshot !== children) setSnapshot(children);

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // Open lifecycle: stack registration (Escape/back/scroll lock) and focus in/out.
  useEffect(() => {
    if (!open) return undefined;
    restoreFocusRef.current = (document.activeElement as HTMLElement) || null;
    const entry: StackEntry = { id: nextSheetId++, close: () => onCloseRef.current() };
    entryRef.current = entry;
    registerSheet(entry);
    // Focus after paint so the slide-in isn't interrupted by a scroll jump.
    const raf = requestAnimationFrame(() => sheetRef.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(raf);
      unregisterSheet(entry);
      entryRef.current = null;
      const prev = restoreFocusRef.current;
      if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
    };
  }, [open]);

  // Unmount after the exit slide.
  useEffect(() => {
    if (!closing) return undefined;
    const t = setTimeout(() => setClosing(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [closing]);

  // Escape closes only the top-most sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const top = sheetStack[sheetStack.length - 1];
      if (!top || top !== entryRef.current) return;
      e.stopPropagation();
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Keep Tab / Shift+Tab inside the dialog.
  const trapFocus = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !sheetRef.current) return;
    const nodes = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter(n => n.offsetParent !== null || n === document.activeElement);
    if (nodes.length === 0) {
      e.preventDefault();
      sheetRef.current.focus();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === sheetRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  if (!open && !closing) return null;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (closing) return;
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
      setDragY(0); // snaps back via the transition below
    }
  };

  const sheetTransform = closing
    ? 'translateY(100%)'
    : dragY
      ? `translateY(${dragY}px)`
      : undefined;

  const backdropOpacity = closing ? 0 : dragging ? Math.max(0.4, 1 - dragY / 400) : undefined;

  // Portalled to <body>: an ancestor with a transform (e.g. a screen's
  // fade-in animation) would otherwise become the containing block for this
  // position:fixed layer and trap the sheet mid-page.
  return createPortal(
    <div
      className="sheet-backdrop"
      onClick={() => { if (!closing) onClose(); }}
      style={{
        opacity: backdropOpacity,
        transition: dragging ? 'none' : `opacity ${EXIT_MS}ms var(--ease-exit)`,
        pointerEvents: closing ? 'none' : undefined
      }}
    >
      <div
        ref={sheetRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={trapFocus}
        onAnimationEnd={(e) => { if (e.target === e.currentTarget) setEntered(true); }}
        style={{
          transform: sheetTransform,
          // Suppress the entry animation while dragging/closing so it doesn't
          // fight the finger or the exit slide.
          animation: entered || dragging || closing ? 'none' : undefined,
          transition: dragging
            ? 'none'
            : closing
              ? `transform ${EXIT_MS}ms var(--ease-exit)`
              : 'transform var(--dur-std) var(--ease-enter)',
          // Pinned handle + scrolling body (overrides .sheet's own scroll/padding).
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
          outline: 'none'
        }}
      >
        {/* Drag zone — full width and 28px tall so it's easy to catch with a thumb. */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          aria-hidden="true"
          style={{ flexShrink: 0, padding: '10px 0 13px', cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
        >
          <div className="sheet-handle" style={{ margin: '0 auto' }} />
        </div>
        <div
          style={{
            flex: '1 1 auto',
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            padding: '0 20px calc(20px + var(--safe-bottom))'
          }}
        >
          {open ? children : snapshot}
        </div>
      </div>
    </div>,
    document.body
  );
}
