import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ArrowLeft, ShieldAlert, UserX, MoreVertical, WifiOff, RefreshCw } from 'lucide-react';
import type { Socket } from 'socket.io-client';
import type { UserProfile, RoomPresenceTraveler } from '../types';
import { useChatMessages, useKeyboardSafeHeight, MAX_MESSAGE_LENGTH } from '../hooks/useChatMessages';
import { MessageList, ChatComposer, type ChatListItem } from './MessageList';
import { ReportSheet } from './ReportSheet';
import { triggerHaptic, pushBackHandler } from '../utils/nativeBridge';
import { Toast } from './ui/Toast';
import { authHeaders } from '../utils/auth';
import { API } from '../config';

interface Peer {
  id: string;
  pseudonym?: string;
  username?: string;
  avatarBg?: string;
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
  const initials = name.slice(0, 2).toUpperCase();

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
        background: 'var(--bg-canvas)'
      }}
    >
      {/* Header */}
      <div
        className="glass"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 8px 8px 4px',
          paddingTop: 'calc(8px + var(--safe-top))',
          borderRadius: 0,
          borderLeft: 'none',
          borderRight: 'none',
          borderTop: 'none',
          borderBottom: '1px solid var(--border-card)',
          position: 'relative',
          zIndex: 10,
          flexShrink: 0
        }}
      >
        {onBack && (
          <button onClick={onBack} className="icon-btn" aria-label="Back to chats" style={{ background: 'transparent', border: 'none' }}>
            <ArrowLeft size={22} />
          </button>
        )}

        <div
          className="avatar"
          aria-hidden="true"
          style={{
            width: 40,
            height: 40,
            fontSize: 14,
            boxShadow: 'none',
            background: peer.avatarBg || 'linear-gradient(135deg, var(--signal-500), var(--signal-600))'
          }}
        >
          {initials}
        </div>

        <h1 style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {name}
        </h1>

        <button
          ref={menuBtnRef}
          onClick={() => setShowMenu(v => !v)}
          className="icon-btn"
          aria-label={`More options for ${name}`}
          aria-haspopup="menu"
          aria-expanded={showMenu}
          style={{ background: 'transparent', border: 'none' }}
        >
          <MoreVertical size={22} />
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
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              padding: '4px 0',
              zIndex: 30,
              minWidth: 200
            }}
          >
            <button
              role="menuitem"
              onClick={() => { setShowMenu(false); setShowReportSheet(true); }}
              style={menuItem}
            >
              <ShieldAlert size={18} style={{ color: 'var(--status-warning)' }} /> Report {name}
            </button>
            <button
              role="menuitem"
              onClick={() => { setShowMenu(false); setShowBlockConfirm(true); }}
              style={{ ...menuItem, color: 'var(--status-danger)' }}
            >
              <UserX size={18} /> Block {name}
            </button>
          </div>
        )}
      </div>

      {/* Connection / load problems — one honest line, never a wall. */}
      {(!online || (error && !loading)) && (
        <div
          role="status"
          style={{
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
            padding: '4px 8px 4px 14px', fontSize: 13, color: 'var(--text-secondary)',
            background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)'
          }}
        >
          <WifiOff size={15} style={{ color: 'var(--status-warning)', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            {!online ? "You're offline — messages will send when you reconnect." : error}
          </span>
          {online && (
            <button onClick={refresh} className="press" aria-label="Retry loading messages" style={{ ...menuItem, width: 'auto', padding: '0 12px', color: 'var(--accent-text)' }}>
              <RefreshCw size={15} /> Retry
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
            <p style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
              Couldn't load this conversation.
            </p>
          ) : (
            <div style={{ textAlign: 'center', maxWidth: 260 }}>
              <div
                className="avatar"
                aria-hidden="true"
                style={{ width: 64, height: 64, fontSize: 22, margin: '0 auto 12px', background: peer.avatarBg || 'var(--accent-purple)' }}
              >
                {initials}
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                You and {name} are connected
              </p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                Say hello — maybe ask which coach they usually board.
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
            background: 'var(--scrim, rgba(8, 9, 12, 0.75))',
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
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: 20,
              maxWidth: 360,
              width: '100%',
              textAlign: 'center',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--bg-surface)',
                color: 'var(--status-danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px'
              }}
            >
              <UserX size={24} />
            </div>
            <h3 id="dm-block-title" style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>
              Block {name}?
            </h3>
            <p id="dm-block-desc" style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '0 0 18px', lineHeight: 1.45 }}>
              They'll disappear from your rooms, your connection ends, and neither of you can message the other.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                autoFocus
                onClick={() => setShowBlockConfirm(false)}
                disabled={blocking}
                className="press"
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleBlockConfirm}
                disabled={blocking}
                className="press btn-danger"
                style={{
                  background: 'var(--danger-fill)',
                  color: '#fff',
                  border: 'none',
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: blocking ? 'progress' : 'pointer'
                }}
              >
                {blocking ? 'Blocking…' : 'Block'}
              </button>
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
  fontSize: 15,
  fontWeight: 600,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  cursor: 'pointer',
  textAlign: 'left'
};
