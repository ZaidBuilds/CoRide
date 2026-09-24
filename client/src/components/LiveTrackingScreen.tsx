import React, { useMemo, useState } from 'react';
import { Map as MapIcon, ListOrdered, ArrowUpDown, MapPin, Users, Info } from 'lucide-react';
import type { UserProfile, ContextResult, ContextRoom, MetroLine, MetroStation } from '../types';
import type { MetroFriend } from './FriendsTab';
import { DELHI_METRO_LINES, getLineById } from '../data/metroData';
import { FriendsMetroMap } from './FriendsMetroMap';
import { segmentLine, textOnLineColor } from './transit/lineSegments';
import { triggerHaptic } from '../utils/nativeBridge';

interface Props {
  currentUser: UserProfile;
  friends: MetroFriend[];
  currentContext?: ContextResult | null;
  activeRoom?: ContextRoom | null;
  onBack?: () => void;
  onOpenChat?: (friendId: string) => void;
  onOpenProfile?: (profile: UserProfile) => void;
  onContextUpdated?: (newCtx: ContextResult) => void;
  /** Opens the check-in screen to set/confirm station and direction. Button hidden until wired. */
  onOpenCheckIn?: () => void;
}

type Tab = 'route' | 'map';

/**
 * Journey — "where am I going?". Shows only what we actually know: the line
 * and station from the user's detected/confirmed context, and static network
 * data from metroData. No timetables, ETAs, crowding or progress until a real
 * feed exists (SCREENS.md → Journey).
 */
export const LiveTrackingScreen: React.FC<Props> = ({
  currentUser,
  currentContext,
  activeRoom,
  onOpenProfile,
  onOpenCheckIn
}) => {
  const [tab, setTab] = useState<Tab>('route');

  const contextLine = currentContext?.line ? getLineById(currentContext.line) : undefined;
  const [selectedLineId, setSelectedLineId] = useState<string>(contextLine?.id || DELHI_METRO_LINES[0].id);
  const line: MetroLine = getLineById(selectedLineId) || DELHI_METRO_LINES[0];

  // Follow the user's context when it changes (render-time sync, no effect).
  const [syncedLine, setSyncedLine] = useState(contextLine?.id);
  if (contextLine && contextLine.id !== syncedLine) {
    setSyncedLine(contextLine.id);
    setSelectedLineId(contextLine.id);
  }

  // Direction of the station list. Starts from the context direction ("Towards X")
  // when the user is on this line; Reverse is a view toggle only.
  const contextTowardsA = !!currentContext?.direction &&
    currentContext.direction.toLowerCase().includes(line.terminalA.toLowerCase());
  const [reversedFor, setReversedFor] = useState<Record<string, boolean>>({});
  const towardsA = line.id === contextLine?.id
    ? contextTowardsA !== Boolean(reversedFor[line.id])
    : Boolean(reversedFor[line.id]);
  const destination = towardsA ? line.terminalA : line.terminalB;

  const segments = useMemo(() => {
    const segs = segmentLine(line);
    return towardsA ? segs.map(s => ({ ...s, stations: [...s.stations].reverse() })) : segs;
  }, [line, towardsA]);

  const userOnThisLine = contextLine?.id === line.id;
  const userStationId = userOnThisLine ? currentContext?.station : undefined;

  const chooseLine = (id: string) => {
    triggerHaptic('light');
    setSelectedLineId(id);
  };

  const reverse = () => {
    triggerHaptic('light');
    setReversedFor(prev => ({ ...prev, [line.id]: !prev[line.id] }));
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: 520, margin: '0 auto', paddingBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '4px 4px 16px' }}>
        <h1 className="display" style={{ fontSize: 28, lineHeight: '34px', color: 'var(--text-primary)', margin: 0 }}>
          Journey
        </h1>
        <div
          role="tablist"
          aria-label="Journey view"
          style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 'var(--radius-pill)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          {([
            { id: 'route', label: 'Route', icon: ListOrdered },
            { id: 'map', label: 'Map', icon: MapIcon }
          ] as const).map(t => {
            const selected = tab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`journey-panel-${t.id}`}
                id={`journey-tab-${t.id}`}
                onClick={() => { triggerHaptic('light'); setTab(t.id); }}
                style={{
                  minHeight: 40, minWidth: 48, padding: '0 14px', borderRadius: 'var(--radius-pill)', border: 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: selected ? 'var(--accent)' : 'transparent',
                  color: selected ? 'var(--text-on-accent)' : 'var(--text-secondary)'
                }}
              >
                <Icon size={16} aria-hidden="true" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Where you are — from server context only */}
      <section
        aria-label="Your location"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderRadius: 'var(--radius-lg)',
          padding: 16,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}
      >
        <span aria-hidden="true" style={{ color: contextLine?.color || 'var(--text-muted)', display: 'flex' }}><MapPin size={24} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          {currentContext ? (
            <>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>You’re at</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentContext.stationName}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {[currentContext.lineName, currentContext.direction].filter(Boolean).join(' · ')}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>We haven’t placed you on a line yet</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Check in at your station to see your route.</div>
            </>
          )}
        </div>
        {onOpenCheckIn && (
          <button type="button" className="pill-button secondary" onClick={() => { triggerHaptic('light'); onOpenCheckIn(); }} style={{ flexShrink: 0, padding: '8px 16px' }}>
            {currentContext ? 'Change' : 'Check in'}
          </button>
        )}
      </section>

      {tab === 'map' && (
        <div
          id="journey-panel-map"
          role="tabpanel"
          aria-labelledby="journey-tab-map"
          style={{ height: 'calc(100dvh - 330px - var(--safe-bottom))', minHeight: 360 }}
        >
          <FriendsMetroMap currentUser={currentUser} friends={[]} currentContext={currentContext} />
        </div>
      )}

      {tab === 'route' && (
        <div id="journey-panel-route" role="tabpanel" aria-labelledby="journey-tab-route" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Line picker */}
          <div
            role="group"
            aria-label="Metro line"
            style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -4px', padding: '0 4px 4px', scrollbarWidth: 'none' }}
          >
            {DELHI_METRO_LINES.map(l => {
              const selected = l.id === line.id;
              return (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => chooseLine(l.id)}
                  style={{
                    minHeight: 40, padding: '0 14px', borderRadius: 'var(--radius-pill)', flexShrink: 0,
                    border: `1px solid ${selected ? l.color : 'var(--border-subtle)'}`,
                    background: selected ? l.color : 'var(--bg-surface)',
                    color: selected ? textOnLineColor(l.color) : 'var(--text-secondary)',
                    fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', cursor: 'pointer'
                  }}
                >
                  {!selected && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: l.color }} />}
                  {l.name}
                </button>
              );
            })}
          </div>

          {/* Line + direction */}
          <section
            aria-label={`${line.name} towards ${destination}`}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-card)',
              borderTop: `4px solid ${line.color}`,
              borderRadius: 'var(--radius-lg)',
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>{line.name}</div>
              <div style={{ fontSize: 18, lineHeight: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>Towards {destination}</div>
            </div>
            <button type="button" className="pill-button secondary" onClick={reverse} aria-label={`Show direction towards ${towardsA ? line.terminalB : line.terminalA}`} style={{ flexShrink: 0, padding: '8px 14px' }}>
              <ArrowUpDown size={16} aria-hidden="true" /> Reverse
            </button>
          </section>

          {/* Co-riders in your current room — real presence only */}
          {activeRoom && activeRoom.users && activeRoom.users.length > 0 && (
            <section aria-label="Riders in your room" className="list-group" style={{ marginBottom: 0 }}>
              <div className="list-row" style={{ cursor: 'default' }}>
                <span aria-hidden="true" style={{ color: 'var(--text-secondary)', display: 'flex' }}><Users size={20} /></span>
                <span className="row-text">
                  <span className="row-title">{activeRoom.users.length} {activeRoom.users.length === 1 ? 'rider' : 'riders'} in your room</span>
                  <span className="row-sub">{activeRoom.stationName}</span>
                </span>
                <div style={{ display: 'flex' }}>
                  {activeRoom.users.slice(0, 4).map((u, i) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => onOpenProfile?.(u)}
                      aria-label={`View ${u.pseudonym}’s profile`}
                      style={{ width: 44, height: 44, marginLeft: i ? -12 : 0, padding: 0, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <span aria-hidden="true" style={{
                        width: 32, height: 32, borderRadius: '50%', background: u.avatarBg || 'var(--accent)', color: '#FFFFFF',
                        fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-card)'
                      }}>
                        {(u.pseudonym || '?').charAt(0).toUpperCase()}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Station list */}
          <section aria-labelledby="journey-stations" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-lg)', padding: '16px 16px 8px' }}>
            <h2 id="journey-stations" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px' }}>
              Stations
            </h2>
            {segments.map((seg, si) => (
              <StationSegment
                key={si}
                line={line}
                title={seg.branchFrom ? `Branch from ${seg.branchFrom.name}` : undefined}
                stations={seg.stations}
                userStationId={userStationId}
              />
            ))}
          </section>

          <p style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: '16px', color: 'var(--text-muted)', margin: '0 4px' }}>
            <Info size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
            Shows major stations and interchanges. Live train times aren’t available in CoRide yet — check DMRC for timetables.
          </p>
        </div>
      )}
    </div>
  );
};

function StationSegment({ line, title, stations, userStationId }: {
  line: MetroLine;
  title?: string;
  stations: MetroStation[];
  userStationId?: string;
}) {
  const hereIdx = userStationId ? stations.findIndex(s => s.id === userStationId) : -1;
  return (
    <div style={{ marginBottom: 8 }}>
      {title && (
        <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '12px 0 8px' }}>
          {title}
        </h3>
      )}
      <div style={{ position: 'relative' }}>
      <span aria-hidden="true" style={{ position: 'absolute', left: 9, top: 12, bottom: 12, width: 4, borderRadius: 2, background: line.color }} />
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, position: 'relative' }}>
        {stations.map((st, i) => {
          const isHere = i === hereIdx;
          const isPast = hereIdx >= 0 && i < hereIdx;
          return (
            <li
              key={st.id}
              aria-current={isHere ? 'location' : undefined}
              style={{ position: 'relative', display: 'flex', gap: 14, minHeight: 48, padding: '4px 0', alignItems: 'flex-start' }}
            >
              <span
                aria-hidden="true"
                style={{
                  position: 'relative', zIndex: 1, flexShrink: 0, marginTop: 4,
                  width: 22, height: 22, borderRadius: '50%',
                  background: isHere ? line.color : 'var(--bg-card)',
                  border: `${st.isInterchange ? 4 : 3}px solid ${isHere ? 'var(--text-primary)' : line.color}`,
                  boxShadow: isHere ? `0 0 0 4px color-mix(in srgb, ${line.color} 30%, transparent)` : 'none'
                }}
              />
              <div style={{ flex: 1, minWidth: 0, opacity: isPast ? 0.6 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, lineHeight: '22px', fontWeight: isHere ? 800 : 600, color: 'var(--text-primary)' }}>
                    {st.name}
                  </span>
                  {isHere && (
                    <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: line.color, color: textOnLineColor(line.color) }}>
                      You’re here
                    </span>
                  )}
                </div>
                {st.hindiName && (
                  <div lang="hi" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{st.hindiName}</div>
                )}
                {st.isInterchange && (st.interchangeLines || []).length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }} aria-label="Interchange">
                    {(st.interchangeLines || []).map(id => {
                      const il = getLineById(id);
                      if (!il) return null;
                      return (
                        <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: 999, border: '1px solid var(--border-subtle)' }}>
                          <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: il.color }} />
                          Change for {il.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      </div>
    </div>
  );
}
