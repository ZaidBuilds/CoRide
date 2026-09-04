import { useState, type FormEvent } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import type { UserProfile } from '../types';
import { useChatMessages } from '../hooks/useChatMessages';
import { MessageList } from './MessageList';

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
}

/**
 * 1:1 chat shell. Header + MessageList (via the 5s poll hook) + a glass composer
 * pinned to the bottom with safe-area inset. No sockets.
 */
export function DirectChatScreen({ currentUser, peer, onBack }: Props) {
  const { messages, error, send } = useChatMessages(currentUser?.id, peer.id);
  const [input, setInput] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const name = peer.pseudonym || peer.username?.replace(/^@/, '') || 'Metro Friend';
  const initials = name.slice(0, 2).toUpperCase();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const body = input.trim();
    if (!body) return;
    setInput('');
    setSendError(null);
    try {
      await send(body);
    } catch (err) {
      setInput(body); // restore so the user doesn't lose their text
      setSendError(err instanceof Error ? err.message : 'Could not send.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {/* Header */}
      <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 0 }}>
        {onBack && (
          <button onClick={onBack} className="icon-btn" aria-label="Back">
            <ArrowLeft size={18} />
          </button>
        )}
        <div className="avatar" style={{ width: 36, height: 36, fontSize: 13, background: peer.avatarBg || 'linear-gradient(135deg, var(--accent-fill-from), var(--accent-fill-to))' }}>
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Metro Friend</div>
        </div>
      </div>

      {/* Thread — polled every 5s by the hook */}
      <MessageList messages={messages} currentUserId={currentUser?.id} />

      {(error || sendError) && (
        <div role="alert" style={{ fontSize: 12, color: 'var(--accent-rose-text)', textAlign: 'center', padding: '4px 12px' }}>
          {sendError || error}
        </div>
      )}

      {/* Glass composer pinned to the bottom, clears the home indicator */}
      <form
        onSubmit={handleSubmit}
        className="glass"
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          padding: '10px 12px calc(10px + env(safe-area-inset-bottom))',
          borderRadius: 0
        }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          aria-label={`Message ${name}`}
          placeholder="Message…"
          style={{ flex: 1, padding: '10px 14px', borderRadius: 'var(--radius-full)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: 16 }}
        />
        <button
          type="submit"
          aria-label="Send message"
          className="press"
          disabled={!input.trim()}
          style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-fill-from), var(--accent-fill-to))', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
