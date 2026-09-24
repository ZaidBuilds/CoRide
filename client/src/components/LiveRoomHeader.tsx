import { useEffect, useState } from 'react';
import { Radio, Users, Train } from 'lucide-react';
import type { ContextRoom } from '../types';

interface Props {
  room: ContextRoom | null;
  compact?: boolean;
}

function shortDirection(dir?: string): string {
  if (!dir) return '';
  const raw = dir.replace(/^Towards\s+/i, '').trim();
  const first = raw.split(/[/,]/)[0]?.trim() || raw;
  return first.split(/\s+/)[0] || raw;
}

function formatISTNow(): string {
  try {
    return new Date().toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    });
  } catch {
    return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
}

/**
 * Current room summary: line, direction, local time and how many people are
 * in the room right now. The live dot only pulses when someone is actually
 * here — an empty room reads as empty, not "Live".
 */
export const LiveRoomHeader: React.FC<Props> = ({ room, compact }) => {
  const [now, setNow] = useState(formatISTNow);

  useEffect(() => {
    const id = setInterval(() => setNow(formatISTNow()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  if (!room) return null;

  const dirShort = shortDirection(room.direction);
  const line = room.lineName || 'Metro';
  const count = room.userCount ?? room.users?.length ?? 0;
  const live = count > 0;
  const people = `${count} ${count === 1 ? 'person' : 'people'} here now`;

  if (compact) {
    return (
      <div
        role="status"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', borderRadius: 'var(--radius-full)',
          background: 'var(--bg-surface)', border: '1px solid var(--border-purple)',
          fontSize: 12, fontWeight: 700, color: 'var(--accent-text)'
        }}
      >
        <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: room.lineColor || 'var(--accent-purple)', display: 'inline-block' }} />
        {line}{dirShort ? ` · ${dirShort}` : ''} · {now} — {people}
        {live && <Radio size={12} aria-hidden="true" className="animate-pulse-glow" style={{ color: 'var(--presence-active)' }} />}
      </div>
    );
  }

  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: 14,
        borderRadius: 'var(--radius-xl)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-purple)',
        boxShadow: 'var(--shadow-md)'
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
          background: room.lineColor || 'var(--accent-purple)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
        }}
      >
        <Train size={20} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {line}
          {dirShort && <><span aria-hidden="true" style={{ opacity: 0.5 }}>•</span> {dirShort}</>}
          <span aria-hidden="true" style={{ opacity: 0.5 }}>•</span> {now}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users size={13} aria-hidden="true" /> {people}
        </div>
      </div>
      <div
        aria-hidden="true"
        className={live ? 'animate-pulse-glow' : undefined}
        style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: live ? 'var(--presence-active)' : 'var(--presence-other)' }}
      />
    </div>
  );
};
