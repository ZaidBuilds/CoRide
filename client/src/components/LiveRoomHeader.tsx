import { useEffect, useState } from 'react';
import { Radio, Users } from 'lucide-react';
import type { ContextRoom } from '../types';

interface Props {
  room: ContextRoom | null;
  compact?: boolean;
}

function shortDirection(dir?: string): string {
  if (!dir) return '';
  const raw = dir.replace(/^Towards\s+/i, '').trim();
  // "Noida Electronic City / Vaishali" -> "Noida"
  const first = raw.split(/[\/,]/)[0]?.trim() || raw;
  return first.split(/\s+/)[0] || raw;
}

function formatISTNow(): string {
  // Show IST time for Delhi commuters
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

export const LiveRoomHeader: React.FC<Props> = ({ room, compact }) => {
  const [now, setNow] = useState(formatISTNow());

  useEffect(() => {
    const id = setInterval(() => setNow(formatISTNow()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  if (!room) return null;

  const dirShort = shortDirection(room.direction);
  const line = room.lineName || 'Metro';
  // Product moment: “Blue Line · Noida · 9:07 AM — 38 travelers online.”
  const count = room.userCount ?? room.users?.length ?? 0;

  if (compact) {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderRadius: 'var(--radius-full)',
        background: 'rgba(99,102,241,0.12)',
        border: '1px solid rgba(99,102,241,0.22)',
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--text-primary)'
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: room.lineColor || 'var(--accent-indigo)', display: 'inline-block', boxShadow: `0 0 6px ${room.lineColor}` }} />
        {line} · {dirShort} · {now} — {count} online
        <Radio size={12} className="animate-pulse-glow" style={{ color: 'var(--presence-active)' }} />
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '10px 14px',
      borderRadius: 'var(--radius-lg)',
      background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(14,165,233,0.12))',
      border: '1px solid rgba(99,102,241,0.25)',
      backdropFilter: 'blur(12px)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: room.lineColor || 'var(--accent-indigo)',
          boxShadow: `0 0 10px ${room.lineColor || '#6366f1'}`,
          flexShrink: 0
        }} className="animate-pulse-glow" />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {line} · {dirShort} · {now}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Users size={11} /> {count} travelers online
            </span>
            {room.scheduleLabel && <span>• {room.scheduleLabel}</span>}
          </div>
        </div>
      </div>
      <div style={{
        padding: '4px 10px',
        borderRadius: 'var(--radius-full)',
        background: 'rgba(34,197,94,0.12)',
        border: '1px solid rgba(34,197,94,0.3)',
        color: 'var(--presence-active)',
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0
      }}>
        <Radio size={10} />
        Live
      </div>
    </div>
  );
};
