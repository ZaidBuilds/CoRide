import { useState, useEffect, type FormEvent } from 'react';
import { ArrowLeft, Send, ShieldAlert, UserX, Clock, MoreVertical } from 'lucide-react';
import type { UserProfile, RoomPresenceTraveler } from '../types';
import { useChatMessages } from '../hooks/useChatMessages';
import { MessageList } from './MessageList';
import { ReportSheet } from './ReportSheet';
import { enqueueMessage, getQueuedMessages } from '../utils/offlineQueue';
import { triggerHaptic } from '../utils/nativeBridge';
import { authHeaders } from '../utils/auth';

const API = 'http://localhost:4000';

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
}

export function DirectChatScreen({ currentUser, peer, onBack, onBlocked }: Props) {
  const { messages, error, send } = useChatMessages(currentUser?.id, peer.id);
  const [input, setInput] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showReportSheet, setShowReportSheet] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [localQueued, setLocalQueued] = useState<{ id: string; content: string; timestamp: number }[]>([]);

  const name = peer.pseudonym || peer.username?.replace(/^@/, '') || 'Metro Friend';
  const initials = name.slice(0, 2).toUpperCase();

  // Load any existing queued messages for this peer
  useEffect(() => {
    const all = getQueuedMessages();
    const peerQueued = all
      .filter(m => m.type === 'direct' && m.targetId === peer.id)
      .map(m => ({ id: m.id, content: m.content, timestamp: m.timestamp }));
    setLocalQueued(peerQueued);
  }, [peer.id]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const body = input.trim();
    if (!body || !currentUser) return;

    triggerHaptic('light');
    setInput('');
    setSendError(null);

    // If offline, enqueue locally
    if (!navigator.onLine) {
      const qMsg = enqueueMessage({
        id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'direct',
        targetId: peer.id,
        senderId: currentUser.id,
        content: body,
        timestamp: Date.now()
      });
      setLocalQueued(prev => [...prev, { id: qMsg.id, content: qMsg.content, timestamp: qMsg.timestamp }]);
      showToast('Subway tunnel mode: message queued');
      return;
    }

    try {
      await send(body);
    } catch (err) {
      // Buffer in offline queue on network drop
      const qMsg = enqueueMessage({
        id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'direct',
        targetId: peer.id,
        senderId: currentUser.id,
        content: body,
        timestamp: Date.now()
      });
      setLocalQueued(prev => [...prev, { id: qMsg.id, content: qMsg.content, timestamp: qMsg.timestamp }]);
      setSendError('Connection drop — message queued for auto-send');
    }
  };

  const handleBlockConfirm = async () => {
    triggerHaptic('medium');
    try {
      const res = await fetch(`${API}/api/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ targetId: peer.id })
      });
      const data = await res.json();
      showToast(data.message || 'User blocked.');
      setShowBlockConfirm(false);
      onBlocked?.(peer.id);
      onBack?.();
    } catch {
      showToast('Could not block user.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg-canvas)' }}>
      {/* Header with UGC Action Controls */}
      <div
        className="glass"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 12px',
          borderRadius: 0,
          borderBottom: '1px solid var(--border-card)',
          position: 'relative',
          zIndex: 10
        }}
      >
        {onBack && (
          <button onClick={onBack} className="icon-btn touch-target-48" aria-label="Back">
            <ArrowLeft size={20} />
          </button>
        )}

        <div
          className="avatar"
          style={{
            width: 40,
            height: 40,
            fontSize: 14,
            fontWeight: 800,
            background: peer.avatarBg || 'linear-gradient(135deg, var(--signal-500), var(--signal-600))'
          }}
        >
          {initials}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{name}</div>
          <div style={{ fontSize: 11, color: 'var(--mint-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--mint-500)' }} /> Connected Friend
          </div>
        </div>

        {/* UGC Safety Menu Toggle */}
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="icon-btn touch-target-48"
          aria-label="More safety actions"
          style={{ color: 'var(--text-secondary)' }}
        >
          <MoreVertical size={20} />
        </button>

        {/* Safety Popover Menu */}
        {showMenu && (
          <div
            className="animate-fade-in"
            style={{
              position: 'absolute',
              top: 56,
              right: 12,
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              padding: '6px 0',
              zIndex: 30,
              minWidth: 160
            }}
          >
            <button
              onClick={() => {
                setShowMenu(false);
                setShowReportSheet(true);
              }}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'none',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <ShieldAlert size={16} style={{ color: 'var(--amber-500)' }} /> Report User
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                setShowBlockConfirm(true);
              }}
              style={{
                width: '100%',
                padding: '10px 14px',
                background: 'none',
                border: 'none',
                color: 'var(--rose-500)',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              <UserX size={16} /> Block Commuter
            </button>
          </div>
        )}
      </div>

      {/* Message List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <MessageList messages={messages} currentUserId={currentUser?.id} />

        {/* Local Queued Messages (Subway Tunnel Buffer) */}
        {localQueued.length > 0 && (
          <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            {localQueued.map(q => (
              <div
                key={q.id}
                style={{
                  background: 'var(--bg-surface-raised)',
                  border: '1px dashed var(--amber-500)',
                  borderRadius: '16px 16px 4px 16px',
                  padding: '8px 12px',
                  maxWidth: '78%',
                  color: 'var(--text-primary)',
                  fontSize: 16
                }}
              >
                <div>{q.content}</div>
                <div style={{ fontSize: 10, color: 'var(--amber-500)', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 4 }}>
                  <Clock size={11} /> Queued in tunnel…
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(error || sendError) && (
        <div role="alert" style={{ fontSize: 12, color: 'var(--amber-500)', textAlign: 'center', padding: '6px 12px', background: 'rgba(217, 119, 6, 0.1)' }}>
          {sendError || error}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="glass"
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          padding: '10px 12px calc(10px + env(safe-area-inset-bottom))',
          borderRadius: 0,
          borderTop: '1px solid var(--border-card)'
        }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          aria-label={`Message ${name}`}
          placeholder="Message… (works in tunnels)"
          style={{
            flex: 1,
            minHeight: 48,
            padding: '12px 16px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            fontSize: 16
          }}
        />
        <button
          type="submit"
          aria-label="Send message"
          className="press touch-target-48"
          disabled={!input.trim()}
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--signal-500), var(--signal-600))',
            border: 'none',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: !input.trim() ? 'not-allowed' : 'pointer',
            opacity: !input.trim() ? 0.45 : 1
          }}
        >
          <Send size={18} />
        </button>
      </form>

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
        onReported={(msg) => {
          setShowReportSheet(false);
          showToast(msg);
        }}
      />

      {/* Block Confirmation Dialog */}
      {showBlockConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="animate-fade-in"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(8, 9, 12, 0.75)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface-raised)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xl)',
              padding: 20,
              maxWidth: 360,
              width: '100%',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(220, 38, 38, 0.15)',
                color: 'var(--rose-500)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px'
              }}
            >
              <UserX size={24} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>
              Block {name}?
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 18px', lineHeight: 1.4 }}>
              This will immediately remove {name} from your feeds, cancel any mutual connection, and permanently freeze this chat thread.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowBlockConfirm(false)}
                className="press"
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--bg-canvas)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleBlockConfirm}
                className="press btn-danger"
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                Confirm Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="glass animate-fade-in"
          style={{
            position: 'fixed',
            bottom: 'calc(80px + env(safe-area-inset-bottom))',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '10px 18px',
            borderRadius: 999,
            color: 'var(--text-primary)',
            fontSize: 13,
            fontWeight: 700,
            zIndex: 110,
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
