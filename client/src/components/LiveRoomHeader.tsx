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
  const first = raw.split(/[\/,]/)[0]?.trim() || raw;
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

export const LiveRoomHeader: React.FC<Props> = ({ room, compact }) => {
  const [now, setNow] = useState(formatISTNow());

  useEffect(() => {
    const id = setInterval(() => setNow(formatISTNow()), 30 * 1000);
    return () => clearInterval(id);
  }, []);

  if (!room) return null;

  const dirShort = shortDirection(room.direction);
  const line = room.lineName || 'Metro';
  const count = room.userCount ?? room.users?.length ?? 0;

  if (compact) {
    return (
      <div style={{
        display:'inline-flex', alignItems:'center', gap:8,
        padding:'6px 12px', borderRadius:'var(--radius-full)',
        background:'rgba(123,93,255,0.12)', border:'1px solid rgba(123,93,255,0.22)',
        fontSize:12, fontWeight:700, color:'#C4B5FF'
      }}>
        <span style={{ width:8,height:8, borderRadius:'50%', background: room.lineColor || '#7B5DFF', display:'inline-block', boxShadow:`0 0 6px ${room.lineColor}` }} />
        {line} · {dirShort} · {now} — {count} online
        <Radio size={12} className="animate-pulse-glow" style={{ color:'var(--presence-active)' }} />
      </div>
    );
  }

  // Figma 02 purple card style
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12,
      padding:'14px',
      borderRadius:'var(--radius-xl)',
      background:'linear-gradient(135deg, #2A1A5E 0%, #1E1A3A 100%)',
      border:'1px solid rgba(123,93,255,0.28)',
      boxShadow:'0 8px 32px rgba(0,0,0,0.35)'
    }}>
      <div style={{ width:40, height:40, borderRadius:'50%', background:'#7B5DFF', display:'flex', alignItems:'center', justifyContent:'center', color:'white', flexShrink:0 }}>
        <Train size={20} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:800, color:'white', display:'flex', alignItems:'center', gap:6 }}>
          {line} <span style={{ opacity:0.5 }}>•</span> {dirShort} <span style={{ opacity:0.5 }}>•</span> {now}
        </div>
        <div style={{ fontSize:12, color:'#C4B5FF', marginTop:2, display:'flex', alignItems:'center', gap:6 }}>
          <Users size={12} /> {count} travelers online — Live
        </div>
      </div>
      <div style={{ width:10,height:10, borderRadius:'50%', background:'var(--presence-active)', boxShadow:'0 0 8px var(--presence-active)', flexShrink:0 }} className="animate-pulse-glow" />
    </div>
  );
};
