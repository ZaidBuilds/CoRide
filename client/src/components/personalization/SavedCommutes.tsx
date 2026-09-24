import { useEffect, useState } from 'react';
import { PlusIcon, TrashIcon, XIcon, ArrowClockwiseIcon } from '@phosphor-icons/react';
import type { CommutePattern } from '../../types';
import { API } from '../../config';
import { authHeaders, jsonAuthHeaders } from '../../utils/auth';
import { getLineById, getStationById } from '../../data/metroData';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { LinePill } from '../ui/LinePill';
import { Skeleton } from '../ui/Skeleton';
import { lineStyle } from '../../utils/lineStyle';

interface Props {
  userId: string;
  currentStationId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUse: (pattern: CommutePattern, room?: any) => void;
  /**
   * 'section' (default) prints its own "Saved commutes" heading, for Home.
   * 'screen' drops it, for the pushed screen that already has a ScreenHeader.
   */
  variant?: 'section' | 'screen';
}

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const MAX = 5;

function towards(dir?: string): string {
  return (dir || '').replace(/^Towards\s+/i, '').trim();
}

/** "08:30" → "8:30 am". Falls back to the raw value if it isn't HH:MM. */
function timeLabel(t?: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t || '');
  if (!m) return t || '';
  const h = Number(m[1]);
  return `${((h + 11) % 12) + 1}:${m[2]} ${h < 12 ? 'am' : 'pm'}`;
}

/** Seven small day marks; the days you ride are filled. */
const DayStrip: React.FC<{ days: string[] }> = ({ days }) => {
  const on = new Set(days.map(d => d.slice(0, 3).toLowerCase()));
  const label = days.length === 5 && WEEK.slice(0, 5).every(d => on.has(d.toLowerCase())) ? 'Weekdays' : days.join(', ');
  return (
    <span aria-label={label} role="img" style={{ display: 'inline-flex', gap: 3 }}>
      {WEEK.map(d => {
        const active = on.has(d.toLowerCase());
        return (
          <span
            key={d}
            aria-hidden="true"
            style={{
              width: 18, height: 18, borderRadius: 'var(--radius-pill)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10.5, fontWeight: 620, lineHeight: 1,
              background: active ? 'var(--bg-tonal)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              opacity: active ? 1 : 0.6
            }}
          >
            {d[0]}
          </span>
        );
      })}
    </span>
  );
};

/**
 * Saved commutes: your usual line, station and time. Tap a row to check in
 * there in one go. Rows on one surface with hairlines, never a card per row.
 */
export const SavedCommutes: React.FC<Props> = ({ userId, currentStationId, onUse, variant = 'section' }) => {
  const [patterns, setPatterns] = useState<CommutePattern[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Partial<CommutePattern>>({ targetTime: '08:30', daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], label: '' });
  const [saveError, setSaveError] = useState<string | null>(null);

  // Distinguishes "no saved commutes" from "still loading" / "request failed"
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = async () => {
    setStatus('loading');
    try {
      const r = await fetch(`${API}/api/commute/patterns/${encodeURIComponent(userId)}`, { headers: authHeaders() });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setPatterns(j.patterns || []);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (userId) void load(); }, [userId]);

  // New commutes default to where you are now; Rajiv Chowk on the Blue Line if we don't know.
  const hereStation = currentStationId ? getStationById(currentStationId) : undefined;
  const hereLine = hereStation ? getLineById(hereStation.lineId) : undefined;
  const draft = {
    lineId: hereLine?.id || 'blue',
    lineName: hereLine?.name || 'Blue Line',
    lineColor: hereLine?.color || '#0284c7',
    stationId: hereStation?.id || 'rajiv_chowk',
    stationName: hereStation?.name || 'Rajiv Chowk',
    direction: hereLine ? `Towards ${hereLine.terminalB}` : 'Towards Noida Electronic City'
  };

  const add = async () => {
    const payload = {
      ...draft,
      targetTime: form.targetTime,
      daysOfWeek: form.daysOfWeek,
      label: form.label
    };
    setSaveError(null);
    try {
      const r = await fetch(`${API}/api/commute/patterns`, { method: 'POST', headers: jsonAuthHeaders(), body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.pattern) { setPatterns(prev => [...prev, j.pattern].slice(-MAX)); setShowAdd(false); }
      else setSaveError(j.error || "Couldn't save. Try again.");
    } catch {
      // Offline: keep the form open so nothing typed is lost.
      setSaveError("You're offline. Your commute isn't saved yet.");
    }
  };

  const remove = async (id: string) => {
    try {
      const r = await fetch(`${API}/api/commute/patterns/${encodeURIComponent(userId)}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders() });
      // 404 means it is already gone server-side, so drop it locally too.
      if (r.ok || r.status === 404) setPatterns(prev => prev.filter(p => p.id !== id));
    } catch { /* offline: leave it in place */ }
  };
  const use = async (p: CommutePattern) => {
    try {
      const r = await fetch(`${API}/api/commute/patterns/${encodeURIComponent(userId)}/${encodeURIComponent(p.id)}/use`, { method: 'POST', headers: authHeaders() });
      const j = r.ok ? await r.json() : {};
      onUse(j.pattern || p, j.room);
    } catch { onUse(p); }
  };

  const toggleDay = (d: string) => {
    const cur = form.daysOfWeek || [];
    const next = cur.includes(d) ? cur.filter(x => x !== d) : WEEK.filter(w => w === d || cur.includes(w));
    setForm({ ...form, daysOfWeek: next });
  };

  const full = patterns.length >= MAX;

  return (
    <section aria-labelledby={variant === 'section' ? 'saved-commutes-title' : undefined} aria-label={variant === 'screen' ? 'Saved commutes' : undefined}>
      <div className="section-head">
        {variant === 'section' ? <h2 id="saved-commutes-title">Saved commutes</h2> : <span className="type-meta" style={{ color: 'var(--text-muted)' }}>Tap one to check in there</span>}
        {status === 'ready' && !full && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={showAdd ? <XIcon size={18} /> : <PlusIcon size={18} />}
            onClick={() => { setShowAdd(v => !v); setSaveError(null); }}
            aria-expanded={showAdd}
            style={{ marginRight: -12 }}
          >
            {showAdd ? 'Close' : 'Add'}
          </Button>
        )}
      </div>

      {showAdd && (
        <div className="card" style={{ ...lineStyle(draft.lineColor), marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <p className="type-meta" style={{ color: 'var(--text-muted)' }}>Saves</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <LinePill line={draft.lineId} size="sm" />
              <span className="type-label" style={{ color: 'var(--text-primary)' }}>{draft.stationName}</span>
              <span className="type-meta" style={{ color: 'var(--text-secondary)' }}>towards {towards(draft.direction)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ flex: 1, minWidth: 0 }}>
              <span className="field-label">Name (optional)</span>
              <input className="input" placeholder="Home to office" value={form.label || ''} onChange={e => setForm({ ...form, label: e.target.value })} maxLength={20} />
            </label>
            <label style={{ width: 140, flexShrink: 0 }}>
              <span className="field-label">Leave at</span>
              <input className="input tnum" type="time" value={form.targetTime} onChange={e => setForm({ ...form, targetTime: e.target.value })} />
            </label>
          </div>
          <div role="group" aria-label="Days you ride" style={{ display: 'flex', gap: 4, justifyContent: 'space-between' }}>
            {WEEK.map(d => {
              const on = (form.daysOfWeek || []).includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  aria-label={d}
                  onClick={() => toggleDay(d)}
                  className="press"
                  style={{
                    width: 44, height: 44, borderRadius: 'var(--radius-pill)', cursor: 'pointer',
                    border: on ? '1px solid var(--ink)' : '1px solid var(--border-strong)',
                    background: on ? 'var(--ink)' : 'transparent', color: on ? 'var(--ink-inverse)' : 'var(--text-secondary)',
                    fontSize: 14, fontWeight: 600
                  }}
                >
                  {d[0]}
                </button>
              );
            })}
          </div>
          {saveError && <p role="alert" className="type-meta" style={{ color: 'var(--danger-text)' }}>{saveError}</p>}
          <Button type="button" variant="secondary" fullWidth onClick={add} disabled={!(form.daysOfWeek || []).length}>
            Save commute
          </Button>
        </div>
      )}

      {status === 'loading' ? (
        <div aria-busy="true" aria-label="Loading saved commutes" className="list-group" style={{ padding: '4px 16px' }}>
          {[0, 1].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 64 }}>
              <div style={{ flex: 1 }}>
                <Skeleton width={70} height={16} borderRadius="var(--radius-pill)" delayMs={i * 120} />
                <Skeleton width="55%" height={14} style={{ marginTop: 8 }} delayMs={i * 120} />
              </div>
              <Skeleton width={56} height={20} delayMs={i * 120} />
            </div>
          ))}
        </div>
      ) : status === 'error' ? (
        <div role="alert" className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="type-label" style={{ color: 'var(--text-primary)' }}>Couldn't load saved commutes</p>
            <p className="type-meta" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>Check your connection.</p>
          </div>
          <Button type="button" variant="tonal" size="sm" icon={<ArrowClockwiseIcon size={18} />} onClick={load}>Retry</Button>
        </div>
      ) : patterns.length === 0 ? (
        !showAdd && (
          <div className="card">
            <p className="type-label" style={{ color: 'var(--text-primary)' }}>No saved commutes yet</p>
            <p className="type-meta" style={{ color: 'var(--text-secondary)', marginTop: 2 }}>
              Save your usual station and time, then check in with one tap.
            </p>
          </div>
        )
      ) : (
        <div className="list-group" style={{ marginBottom: 0 }}>
          {patterns.map(p => {
            const title = p.label || p.stationName;
            const dir = towards(p.direction);
            return (
              <div key={p.id} className="list-row" style={{ padding: 0, gap: 0, alignItems: 'stretch', ...lineStyle(p.lineId || p.lineColor) }}>
                <button
                  type="button"
                  onClick={() => use(p)}
                  aria-label={`Check in: ${title}, ${p.lineName}${dir ? ` towards ${dir}` : ''}, ${timeLabel(p.targetTime)}`}
                  className="press-row"
                  style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 4px 12px 16px', background: 'none', border: 'none', color: 'inherit', textAlign: 'left', cursor: 'pointer' }}
                >
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <LinePill line={p.lineId || p.lineColor} label={p.lineName?.replace(/\s+Line$/i, '')} size="sm" />
                      <span className="type-label" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
                    </span>
                    <span className="type-meta" style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.label ? `${p.stationName}${dir ? `, towards ${dir}` : ''}` : dir ? `Towards ${dir}` : p.lineName}
                    </span>
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <span className="type-headline tnum" style={{ color: 'var(--text-primary)' }}>{timeLabel(p.targetTime)}</span>
                    <DayStrip days={p.daysOfWeek || []} />
                  </span>
                </button>
                <span style={{ display: 'flex', alignItems: 'center', paddingRight: 4 }}>
                  <IconButton label={`Delete saved commute ${title}`} variant="plain" onClick={() => remove(p.id)}>
                    <TrashIcon size={20} />
                  </IconButton>
                </span>
              </div>
            );
          })}
        </div>
      )}
      {full && status === 'ready' && (
        <p className="type-meta" style={{ color: 'var(--text-muted)', marginTop: 8 }}>You can save up to {MAX}. Delete one to add another.</p>
      )}
    </section>
  );
};
