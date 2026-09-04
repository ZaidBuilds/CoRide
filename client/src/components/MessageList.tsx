import { useEffect, useRef } from 'react';
import type { DirectMessage } from '../types';

interface Props {
  messages: DirectMessage[];
  currentUserId: string | undefined;
}

function timeLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Display-only message thread. Renders .chat-bubble per message and keeps the
 * view pinned to the newest message. No fetching, no send — that lives in the
 * hook and the screen shell.
 */
export function MessageList({ messages, currentUserId }: Props) {
  const endRef = useRef<HTMLDivElement>(null);

  // Pin to bottom whenever the count changes (new message, initial load).
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
          No messages yet — say hello 👋
        </p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px' }}>
      {messages.map(m => {
        const isMe = m.senderId === currentUserId;
        return (
          <div
            key={m.id}
            style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}
          >
            <div className={`chat-bubble ${isMe ? 'outgoing' : 'incoming'}`}>{m.content}</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 6px 0' }}>
              {timeLabel(m.timestamp)}
            </span>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
