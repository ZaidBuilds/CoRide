import React, { useState, useEffect } from 'react';
import { ArrowLeft, Map as MapIcon, GitCommit, Repeat, Clock, Radio, Users } from 'lucide-react';
import type { UserProfile, ContextResult, ContextRoom } from '../types';
import type { MetroFriend } from './FriendsTab';
import { DELHI_METRO_LINES, getLineById } from '../data/metroData';
import { FriendsMetroMap } from './FriendsMetroMap';
import { getCommuteRelationship } from '../utils/commuteContext';
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
}

export const LiveTrackingScreen: React.FC<Props> = ({
  currentUser,
  friends,
  currentContext,
  activeRoom,
  onBack,
  onOpenChat,
  onOpenProfile,
  onContextUpdated
}) => {
  // Tab switcher: 'map' (Friends Live Map) or 'diagram' (Subway Diagram & Route)
  const [activeTab, setActiveTab] = useState<'map' | 'diagram'>('diagram');

  // Selected line in the diagram (defaults to user's active detected line or Blue Line)
  const initialLineId = currentContext?.line || 'blue';
  const [selectedLineId, setSelectedLineId] = useState<string>(initialLineId);

  // Direction state (e.g. "Towards Noida Electronic City")
  const currentLine = getLineById(selectedLineId) || DELHI_METRO_LINES[0];
  const initialDirection = currentContext?.direction || `Towards ${currentLine.terminalB}`;
  const [currentDirection, setCurrentDirection] = useState<string>(initialDirection);
  const [flippingDirection, setFlippingDirection] = useState(false);

  // Arrival countdown simulation in seconds
  const [countdownSeconds, setCountdownSeconds] = useState(135);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownSeconds(prev => (prev > 10 ? prev - 1 : 180));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Update line and direction when context changes
  useEffect(() => {
    if (currentContext?.line) {
      setSelectedLineId(currentContext.line);
    }
    if (currentContext?.direction) {
      setCurrentDirection(currentContext.direction);
    }
  }, [currentContext]);

  // Order stations according to current direction
  const isTowardsA = currentDirection.toLowerCase().includes(currentLine.terminalA.toLowerCase());
  const orderedStations = React.useMemo(() => {
    const list = [...currentLine.stations];
    return isTowardsA ? list.reverse() : list;
  }, [currentLine, isTowardsA]);

  // Find user's active station index in ordered stations
  const userStationId = currentContext?.station || '';
  const currentStationIndex = orderedStations.findIndex(s => s.id === userStationId);
  const activeStationIndex = currentStationIndex >= 0 ? currentStationIndex : 0;

  // 1-Tap Direction Flip handler
  const handleFlipDirection = async () => {
    if (flippingDirection) return;
    triggerHaptic('medium');
    setFlippingDirection(true);

    const nextDirection = isTowardsA ? `Towards ${currentLine.terminalB}` : `Towards ${currentLine.terminalA}`;
    setCurrentDirection(nextDirection);

    try {
      const token = localStorage.getItem('coride_token');
      const res = await fetch('/api/context/direction-override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          userId: currentUser.id,
          lineId: currentLine.id,
          direction: nextDirection,
          stationId: currentContext?.station
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.context && onContextUpdated) {
          onContextUpdated(data.context);
        }
      }
    } catch (err) {
      console.error('Failed to update direction override', err);
    } finally {
      setTimeout(() => setFlippingDirection(false), 300);
    }
  };

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s`;
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 90 }}>
      {/* Top Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
        paddingTop: 4
      }}>
        <button
          onClick={onBack}
          aria-label="Back"
          className="icon-btn press"
          style={{ width: 42, height: 42 }}
        >
          <ArrowLeft size={18} />
        </button>

        {/* View Switcher Segmented Control */}
        <div style={{
          display: 'flex',
          background: 'rgba(255, 255, 255, 0.06)',
          borderRadius: 999,
          padding: 3,
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <button
            onClick={() => setActiveTab('diagram')}
            className="press"
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              border: 'none',
              background: activeTab === 'diagram' ? 'var(--accent-purple)' : 'transparent',
              color: activeTab === 'diagram' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <GitCommit size={14} /> Route Diagram
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className="press"
            style={{
              padding: '6px 14px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              border: 'none',
              background: activeTab === 'map' ? 'var(--accent-purple)' : 'transparent',
              color: activeTab === 'map' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <MapIcon size={14} /> Friends Map
          </button>
        </div>

        <div style={{ width: 42, height: 42 }} />
      </div>

      {/* VIEW 1: Interactive Snapchat-Style Friends Live Map */}
      {activeTab === 'map' && (
        <div style={{ height: 'calc(100dvh - 180px)', minHeight: 520 }}>
          <FriendsMetroMap
            currentUser={currentUser}
            friends={friends}
            currentContext={currentContext}
            onOpenChat={onOpenChat}
            onOpenProfile={onOpenProfile}
          />
        </div>
      )}

      {/* VIEW 2: High-Standard Subway Route Progression Diagram */}
      {activeTab === 'diagram' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Multi-Line Carousel */}
          <div style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 4,
            scrollbarWidth: 'none'
          }}>
            {DELHI_METRO_LINES.map(line => {
              const isSelected = line.id === selectedLineId;
              return (
                <button
                  key={line.id}
                  onClick={() => {
                    setSelectedLineId(line.id);
                    setCurrentDirection(`Towards ${line.terminalB}`);
                  }}
                  className="press"
                  style={{
                    padding: '7px 12px',
                    borderRadius: 999,
                    border: isSelected ? `2px solid ${line.color}` : '1px solid rgba(255, 255, 255, 0.1)',
                    background: isSelected ? `${line.color}22` : 'rgba(255, 255, 255, 0.04)',
                    color: isSelected ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 800,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: line.color,
                    boxShadow: isSelected ? `0 0 8px ${line.color}` : 'none'
                  }} />
                  <span>{line.name}</span>
                </button>
              );
            })}
          </div>

          {/* Active Line & Direction Banner */}
          <div className="glass-thick" style={{
            padding: '16px',
            borderRadius: 'var(--radius-xl)',
            border: `1px solid ${currentLine.color}44`,
            background: `linear-gradient(135deg, ${currentLine.color}15, rgba(15, 23, 42, 0.85))`,
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: currentLine.color,
                    color: '#fff',
                    fontWeight: 900,
                    fontSize: 11
                  }}>
                    {currentLine.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {currentLine.stations.length} Stations
                  </span>
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 900, color: '#f8fafc', marginTop: 4, marginBottom: 0 }}>
                  {currentDirection}
                </h3>
              </div>

              {/* 1-Tap Direction Reversal Button */}
              <button
                onClick={handleFlipDirection}
                className="press"
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.16)',
                  color: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  transform: flippingDirection ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
                }}
                title="Flip travel direction"
              >
                <Repeat size={14} />
                <span>Reverse</span>
              </button>
            </div>

            {/* Arrival & Headway Metrics Strip */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              paddingTop: 8,
              borderTop: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={16} color="#38bdf8" />
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Next Train</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#38bdf8' }}>
                    {formatCountdown(countdownSeconds)}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Radio size={16} color="#10b981" />
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Headway Interval</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#10b981' }}>
                    Every 3 - 4 min
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Co-Riders on this Line / Room */}
          {activeRoom && activeRoom.users && activeRoom.users.length > 0 && (
            <div className="glass-thick" style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={16} color="var(--accent-purple-text)" />
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {activeRoom.users.length} Co-Riders Active
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {activeRoom.users.slice(0, 4).map(u => {
                  const rel = getCommuteRelationship(u, {
                    activeRoomId: activeRoom.id,
                    currentContext
                  });
                  return (
                    <div
                      key={u.id}
                      onClick={() => onOpenProfile?.(u)}
                      className="press"
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: u.avatarBg || '#6366f1',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '2px solid var(--bg-card)',
                        cursor: 'pointer'
                      }}
                      title={`${u.pseudonym} • ${rel.label}`}
                    >
                      {u.pseudonym.slice(0, 2).toUpperCase()}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Vertical Subway Progression Diagram */}
          <div className="glass-thick" style={{
            padding: '18px 16px',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--bg-card)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16
            }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                Station Progression
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Terminal: {isTowardsA ? currentLine.terminalA : currentLine.terminalB}
              </span>
            </div>

            <div style={{ position: 'relative', paddingLeft: 24 }}>
              {/* Vertical Track Line */}
              <div style={{
                position: 'absolute',
                left: 7,
                top: 8,
                bottom: 12,
                width: 4,
                borderRadius: 2,
                background: currentLine.color,
                opacity: 0.8
              }} />

              {/* Station Rows */}
              {orderedStations.map((station, index) => {
                const isCurrent = index === activeStationIndex;
                const isPassed = index < activeStationIndex;
                const isUpcoming = index > activeStationIndex;
                const minutesAway = (index - activeStationIndex) * 2.5;

                return (
                  <div
                    key={station.id}
                    style={{
                      position: 'relative',
                      paddingBottom: index === orderedStations.length - 1 ? 0 : 20,
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between'
                    }}
                  >
                    {/* Track Node Bullet */}
                    <div style={{
                      position: 'absolute',
                      left: -24,
                      top: 2,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: isCurrent ? '#38bdf8' : isPassed ? currentLine.color : '#1e293b',
                      border: isCurrent ? '3px solid #ffffff' : `2px solid ${currentLine.color}`,
                      boxShadow: isCurrent ? '0 0 12px #38bdf8' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2
                    }}>
                      {isCurrent && (
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />
                      )}
                    </div>

                    {/* Station Name and Details */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontSize: 14,
                          fontWeight: isCurrent ? 900 : 700,
                          color: isCurrent ? '#38bdf8' : isPassed ? 'var(--text-muted)' : 'var(--text-primary)'
                        }}>
                          {station.name}
                        </span>

                        {isCurrent && (
                          <span style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 999,
                            background: 'rgba(56, 189, 248, 0.2)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.4)'
                          }}>
                            You are here
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {station.hindiName}
                      </div>

                      {/* Multi-Line Interchange Pills */}
                      {station.isInterchange && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                          {(station.interchangeLines || []).map(ilId => {
                            const il = getLineById(ilId);
                            if (!il) return null;
                            return (
                              <span
                                key={ilId}
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  background: `${il.color}25`,
                                  color: il.color,
                                  border: `1px solid ${il.color}45`
                                }}
                              >
                                🔀 {il.name}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Estimated Arrival Time Pill */}
                    {isUpcoming && (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--text-muted)',
                        padding: '2px 6px',
                        borderRadius: 6,
                        background: 'rgba(255, 255, 255, 0.04)'
                      }}>
                        +{Math.round(minutesAway)} min
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};