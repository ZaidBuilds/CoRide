import { useEffect, useState } from 'react';
import type { ContextRoom } from '../types';
import { getStationById } from '../data/metroData';
import { lineStyle } from '../utils/lineStyle';
import { LinePill } from './ui/LinePill';
import { PresenceStack } from './ui/PresenceStack';
import { StationSign } from './ui/StationSign';

interface Props {
  room: ContextRoom | null;
  compact?: boolean;
}

function towardsName(dir?: string): string {
  if (!dir) return '';
  return dir.replace(/^Towards\s+/i, '').trim();
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
 * The room you're in, as a platform sign: station, line pill, "Towards X",
 * then who's here and the local time. The live dot only pulses when someone
 * is actually here; an empty room reads as empty, not "Live".
 */
export const LiveRoomHeader: React.FC<Props> = ({ room, compact }) => {
  const [now, setNow] = useState(formatISTNow);

  useEffect(() => {
    const id = setInterval(() => setNow(formatISTNow()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  if (!room) return null;

  const towards = towardsName(room.direction);
  const lineRef = room.lineId || room.lineColor || null;
  const count = room.userCount ?? room.users?.length ?? 0;
  const people = (room.users || []).map(u => ({ id: u.id, name: u.pseudonym || u.username, avatarBg: u.avatarBg }));
  const stationName = (room.stationName || '').replace(/\s*\(.*\)\s*$/, '') || room.lineName || 'Metro';
  const hindi = room.stationId ? getStationById(room.stationId)?.hindiName : undefined;

  if (compact) {
    return (
      <div
        role="status"
        className="type-label"
        style={{
          ...lineStyle(lineRef),
          display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 36,
          padding: '4px 14px 4px 6px', borderRadius: 'var(--radius-pill)',
          background: 'var(--bg-surface)', color: 'var(--text-primary)'
        }}
      >
        {lineRef && <LinePill line={lineRef} label={room.lineName || undefined} size="sm" />}
        <span style={{ whiteSpace: 'nowrap' }}>{towards ? `Towards ${towards}` : stationName}</span>
        <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>·</span>
        {count > 0 && <span className="live-dot pulse" aria-hidden="true" />}
        <span className="tnum" style={{ whiteSpace: 'nowrap' }}>{count} here</span>
      </div>
    );
  }

  return (
    <section
      role="status"
      aria-label={`${stationName}, ${room.lineName || 'Metro'}${towards ? `, towards ${towards}` : ''}. ${count} ${count === 1 ? 'person' : 'people'} here now.`}
      className="card has-stub"
      style={{ ...lineStyle(lineRef), ['--stack-ring' as string]: 'var(--bg-surface)' } as React.CSSProperties}
    >
      <StationSign
        name={stationName}
        hindiName={hindi}
        lines={lineRef ? [lineRef] : []}
        towards={towards || undefined}
        size="compact"
        as="h2"
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
        <PresenceStack people={people} count={count} label="here now" live={count > 0} />
        <span className="type-meta tnum" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{now} IST</span>
      </div>
    </section>
  );
};
