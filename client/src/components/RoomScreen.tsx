import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Train, Radio, ArrowLeft, RefreshCw, Users, AlertTriangle, UserPlus, Check, Sparkles, MapPin } from 'lucide-react';
import type { UserProfile, RoomPresenceTraveler, RoomPresenceResponse } from '../types';
import { INTEREST_TAXONOMY } from '../types';
import { ProfileSheet } from './ProfileSheet';
import { ProfileSheetContent } from './ProfileSheetContent';
import { ProfileSheetActions } from './ProfileSheetActions';
import { ReportSheet } from './ReportSheet';

const API = 'http://localhost:4000';
const POLL_INTERVAL_MS = 15000;

interface PresetRoom {
  id: string;
  station: string;
  line: string;
  direction: string;
  label: string;
  color: string;
}

const PRESET_ROOMS: PresetRoom[] = [
  {
    id: 'rajiv_chowk:blue:towards_noida',
    station: 'Rajiv Chowk',
    line: 'Blue Line',
    direction: 'Towards Noida',
    label: 'Rajiv Chowk · Blue · Towards Noida',
    color: '#0072CE'
  },
  {
    id: 'rajiv_chowk:yellow:towards_samaypur_badli',
    station: 'Rajiv Chowk',
    line: 'Yellow Line',
    direction: 'Towards Samaypur Badli',
    label: 'Rajiv Chowk · Yellow · Towards Samaypur Badli',
    color: '#FFD100'
  },
  {
    id: 'kashmere_gate:red:towards_rithala',
    station: 'Kashmere Gate',
    line: 'Red Line',
    direction: 'Towards Rithala',
    label: 'Kashmere Gate · Red · Towards Rithala',
    color: '#E31837'
  },
  {
    id: 'hauz_khas:magenta:towards_botanical_garden',
    station: 'Hauz Khas',
    line: 'Magenta Line',
    direction: 'Towards Botanical Garden',
    label: 'Hauz Khas · Magenta · Towards Botanical Garden',
    color: '#8A1538'
  }
];

/** Picker options are derived from PRESET_ROOMS so the two can never drift. */
const STATIONS = Array.from(new Set(PRESET_ROOMS.map(p => p.station)));

function tagMeta(id: string) {
  return INTEREST_TAXONOMY.find(t => t.id === id) || { emoji: '✨', label: id };
}

interface Props {
  currentUser: UserProfile | null;
  initialRoomId?: string;
  onBack?: () => void;
  onProfileOpen?: (user: UserProfile) => void;
  onConnect?: (targetUserId: string) => void;
}

export const RoomScreen: React.FC<Props> = ({
  currentUser,
  initialRoomId = 'rajiv_chowk:blue:towards_noida',
  onBack,
  onConnect
}) => {
  const [activeRoomId, setActiveRoomId] = useState(initialRoomId);
  const [data, setData] = useState<RoomPresenceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [sheetTraveler, setSheetTraveler] = useState<RoomPresenceTraveler | null>(null);
  const [reportTraveler, setReportTraveler] = useState<RoomPresenceTraveler | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const handleBlock = async (traveler: RoomPresenceTraveler) => {
    const name = traveler.pseudonym || traveler.username.replace(/^@/, '');
    setSheetTraveler(null);
    if (!currentUser?.id) return;
    // Optimistically drop them; the next poll confirms via server-side filtering.
    setData(prev => prev ? { ...prev, travelers: prev.travelers.filter(t => t.id !== traveler.id), count: Math.max(0, prev.count - 1) } : prev);
    try {
      const res = await fetch(`${API}/api/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
        body: JSON.stringify({ targetId: traveler.id })
      });
      if (!res.ok) throw new Error();
      showToast(`Blocked ${name}`);
    } catch {
      showToast(`Couldn't block ${name} — try again`);
      fetchRoomData(activeRoomId, true); // restore the list if the block failed
    }
  };
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Lazy initial value rather than setting it from inside the effect — mounting
  // part-scrolled (back navigation, refresh) still starts in the right state.
  const [collapsed, setCollapsed] = useState(() => window.scrollY > 24);

  // Large title collapses once the page scrolls — the .nav-bar hairline appears
  // with it. Passive listener so scrolling stays on the compositor.
  useEffect(() => {
    const onScroll = () => setCollapsed(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const activePreset = PRESET_ROOMS.find(p => p.id === activeRoomId) || {
    id: activeRoomId,
    station: activeRoomId.split(':')[0]?.replace(/_/g, ' ') || 'Rajiv Chowk',
    line: activeRoomId.split(':')[1]?.toUpperCase() || 'METRO',
    direction: activeRoomId.split(':')[2]?.replace(/_/g, ' ') || 'Towards Noida',
    label: activeRoomId,
    color: 'var(--accent-purple)'
  };

  const [pickerStation, setPickerStation] = useState(activePreset.station);
  const stationRooms = PRESET_ROOMS.filter(p => p.station === pickerStation);
  const liveCount = data?.count ?? 0;

  const fetchRoomData = useCallback(async (roomId: string, silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      // x-user-id lets the server hide anyone in a block relationship with us.
      const res = await fetch(`${API}/api/room/${encodeURIComponent(roomId)}`, {
        headers: currentUser?.id ? { 'x-user-id': currentUser.id } : undefined
      });
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const json: RoomPresenceResponse = await res.json();
      setData(json);
      setError(null);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err: any) {
      console.warn('[RoomScreen] Failed to fetch room presence:', err);
      setError(err?.message || 'Presence unavailable. Redis might be starting up.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Heartbeat presence for current user
  const sendHeartbeat = useCallback(async (roomId: string) => {
    if (!currentUser?.id) return;
    try {
      await fetch(`${API}/api/room/${encodeURIComponent(roomId)}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id }
      });
    } catch {
      // heartbeats fail silently if server is momentarily down
    }
  }, [currentUser]);

  // Leave room on cleanup
  const sendLeave = useCallback(async (roomId: string) => {
    if (!currentUser?.id) return;
    try {
      await fetch(`${API}/api/room/${encodeURIComponent(roomId)}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id }
      });
    } catch {
      // silent
    }
  }, [currentUser]);

  // Polling setup: 15 seconds
  useEffect(() => {
    setLoading(true);
    setError(null);

    // Initial fetch & heartbeat
    fetchRoomData(activeRoomId);
    sendHeartbeat(activeRoomId);

    // Poll + heartbeat only while the tab is visible — a backgrounded room
    // shouldn't keep two requests going every 15s.
    pollTimerRef.current = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchRoomData(activeRoomId, true);
      sendHeartbeat(activeRoomId);
    }, POLL_INTERVAL_MS);

    const onVis = () => {
      if (document.visibilityState === 'visible') {
        fetchRoomData(activeRoomId, true);
        sendHeartbeat(activeRoomId);
      }
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      document.removeEventListener('visibilitychange', onVis);
      sendLeave(activeRoomId);
    };
  }, [activeRoomId, fetchRoomData, sendHeartbeat, sendLeave]);

  const handleManualRefresh = () => {
    fetchRoomData(activeRoomId);
    sendHeartbeat(activeRoomId);
  };

  const handleConnectClick = (traveler: RoomPresenceTraveler) => {
    setConnectedIds(prev => new Set([...prev, traveler.id]));
    if (onConnect) {
      onConnect(traveler.id);
    }
  };

  /**
   * POST /api/connections for the profile sheet. Throws the server's error
   * message on non-2xx so ProfileSheetActions can revert to idle and show it.
   */
  const sendConnectionRequest = async (traveler: RoomPresenceTraveler) => {
    if (!currentUser?.id) throw new Error('Sign in to send requests.');
    const res = await fetch(`${API}/api/connections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': currentUser.id },
      body: JSON.stringify({ targetId: traveler.id })
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    setConnectedIds(prev => new Set([...prev, traveler.id]));
    onConnect?.(traveler.id);
  };

  // Tapping a card opens the profile bottom sheet.
  const handleTravelerTap = (traveler: RoomPresenceTraveler) => {
    setSheetTraveler(traveler);
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 86 }}>
      {/* Nav bar — large title collapses into the compact one on scroll */}
      <div className={`nav-bar${collapsed ? ' collapsed' : ''}`}>
        <div className="nav-bar-top">
          {onBack ? (
            <button onClick={onBack} className="icon-btn" aria-label="Back to home">
              <ArrowLeft size={18} />
            </button>
          ) : (
            <span style={{ width: 'var(--tap)' }} />
          )}

          <span className="nav-bar-compact">{activePreset.station} · {liveCount} live</span>

          <button
            onClick={handleManualRefresh}
            className="icon-btn"
            aria-label="Refresh presence"
            disabled={isRefreshing}
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        <h1 className="nav-bar-large">Live Room</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
          <span
            className={data && !error ? 'animate-pulse-glow' : undefined}
            style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: error ? 'var(--presence-other)' : 'var(--presence-active)'
            }}
          />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
            {error
              ? 'Presence unavailable'
              : `${liveCount} ${liveCount === 1 ? 'traveler' : 'travelers'} live`}
          </span>
          {lastUpdated && !error && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {lastUpdated}
            </span>
          )}
        </div>
      </div>

      {/* Context picker — station via segmented control, then line → direction */}
      <div className="section-head"><h3>Station</h3></div>
      <div className="segmented" role="tablist" aria-label="Pick your station" style={{ marginBottom: 20 }}>
        {STATIONS.map(station => (
          <button
            key={station}
            role="tab"
            aria-selected={station === pickerStation}
            className="segmented-option"
            onClick={() => setPickerStation(station)}
          >
            {station}
          </button>
        ))}
      </div>

      <div className="section-head"><h3>Line &amp; direction</h3></div>
      <div className="list-group">
        {stationRooms.map(preset => {
          const isActive = preset.id === activeRoomId;
          return (
            <button
              key={preset.id}
              className="list-row navigable"
              aria-current={isActive || undefined}
              onClick={() => setActiveRoomId(preset.id)}
            >
              {/* Metro line brand colour — decorative identity, stays literal */}
              <span
                style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: preset.color, flexShrink: 0
                }}
              />
              <span className="row-text">
                <span className="row-title">{preset.line}</span>
                <span className="row-sub">{preset.direction}</span>
              </span>
              {isActive && (
                <Check size={16} style={{ color: 'var(--accent-purple-text)', flexShrink: 0 }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Current Room Glass Panel Hero */}
      <div
        className="glass-panel"
        style={{
          padding: 16,
          marginBottom: 16,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            className="avatar"
            style={{
              width: 46,
              height: 46,
              background: `linear-gradient(135deg, ${activePreset.color}, var(--accent-fill-from))`,
              color: 'white'
            }}
          >
            <Train size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>
                {activePreset.station}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.08)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                {activePreset.line}
              </span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={13} style={{ color: 'var(--accent-purple-text)' }} />
              {activePreset.direction}
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.28)',
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--presence-active)'
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--presence-active)',
                  boxShadow: '0 0 8px var(--presence-active)'
                }}
                className="animate-pulse-glow"
              />
              <span>{data ? data.count : '...'} live</span>
            </div>
            {lastUpdated && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                Updated {lastUpdated}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div
          className="glass-panel"
          style={{
            padding: 14,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderColor: 'rgba(239, 68, 68, 0.4)',
            background: 'rgba(239, 68, 68, 0.08)'
          }}
        >
          <AlertTriangle size={20} style={{ color: '#ef4444', flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}>
            <strong>Presence connection warning:</strong> {error}
          </div>
          <button
            onClick={handleManualRefresh}
            className="btn-secondary press"
            style={{ padding: '6px 12px', fontSize: 12, flexShrink: 0 }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Section Heading with count */}
      <div className="section-head" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users size={16} style={{ color: 'var(--accent-purple-text)' }} />
          <h3>Active Travelers ({data?.travelers?.length ?? 0})</h3>
        </div>
        <button onClick={handleManualRefresh} className="link">
          {isRefreshing ? 'Refreshing...' : 'Poll status'}
        </button>
      </div>

      {/* Loading — skeleton cards, never a spinner */}
      {loading && !data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading travelers</span>
          {[1, 2, 3, 4].map(idx => (
            <div key={idx} className="glass-soft" style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="skeleton" style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 12, width: '75%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && data && data.travelers.length === 0 && (
        <div
          className="glass-panel"
          style={{
            padding: 32,
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12
          }}
        >
          <div
            className="avatar"
            style={{
              width: 56,
              height: 56,
              background: 'var(--bg-surface)',
              color: 'var(--text-muted)'
            }}
          >
            <Users size={24} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>No one here yet</h4>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.5 }}>
              Nobody has checked into {activePreset.line} · {activePreset.direction} right now.
            </p>
          </div>
          <button onClick={handleManualRefresh} className="pill-button secondary" disabled={isRefreshing}>
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Checking…' : 'Check again'}
          </button>
        </div>
      )}

      {/* Travelers List */}
      {data && data.travelers.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.travelers.map(traveler => {
            const isMe = traveler.id === currentUser?.id;
            const isConnected = connectedIds.has(traveler.id);
            const initials = (traveler.pseudonym || traveler.username)
              .replace(/^@/, '')
              .substring(0, 2)
              .toUpperCase();

            return (
              <div
                key={traveler.id}
                className="glass-panel animate-fade-in"
                style={{
                  padding: 14,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, border-color 0.15s ease'
                }}
                onClick={() => handleTravelerTap(traveler)}
              >
                {/* Avatar with live active dot */}
                <div className="avatar-wrap">
                  <div
                    className="avatar"
                    style={{
                      width: 48,
                      height: 48,
                      fontSize: 14,
                      background:
                        traveler.avatarBg ||
                        'linear-gradient(135deg, var(--accent-fill-from), var(--accent-fill-to))'
                    }}
                  >
                    {initials}
                  </div>
                  <div
                    className="avatar-dot active"
                    title="Active in room"
                  />
                </div>

                {/* Traveler Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {traveler.pseudonym || traveler.username}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {traveler.username.startsWith('@') ? traveler.username : `@${traveler.username}`}
                    </span>
                    {isMe && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: 'var(--accent-purple-text)',
                          background: 'rgba(123,93,255,0.12)',
                          padding: '1px 6px',
                          borderRadius: 999,
                          border: '1px solid rgba(123,93,255,0.22)'
                        }}
                      >
                        You
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--presence-active)',
                        background: 'rgba(16, 185, 129, 0.10)',
                        padding: '1px 6px',
                        borderRadius: 999,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3
                      }}
                    >
                      <Radio size={9} />
                      Active
                    </span>
                  </div>

                  {/* Bio */}
                  {traveler.bio && (
                    <p
                      style={{
                        fontSize: 13,
                        color: 'var(--text-secondary)',
                        margin: '4px 0 6px',
                        lineHeight: 1.35
                      }}
                    >
                      {traveler.bio}
                    </p>
                  )}

                  {/* Tags */}
                  {traveler.interestTags && traveler.interestTags.length > 0 && (
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                      {traveler.interestTags.map(t => {
                        const meta = tagMeta(t);
                        return (
                          <span
                            key={t}
                            className="tag-pill"
                            style={{
                              padding: '2px 8px',
                              fontSize: 11,
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-subtle)'
                            }}
                          >
                            <span>{meta.emoji}</span> {meta.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Connect / Say Hi button */}
                {!isMe && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleConnectClick(traveler);
                    }}
                    className={isConnected ? 'btn-secondary press' : 'btn-primary press'}
                    style={{
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      borderRadius: 'var(--radius-full)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      flexShrink: 0,
                      height: 32
                    }}
                  >
                    {isConnected ? (
                      <>
                        <Check size={13} />
                        <span>Sent</span>
                      </>
                    ) : (
                      <>
                        <UserPlus size={13} />
                        <span>Connect</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer Info Pill */}
      <div
        style={{
          marginTop: 18,
          textAlign: 'center',
          fontSize: 11,
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6
        }}
      >
        <Sparkles size={13} style={{ color: 'var(--accent-purple)' }} />
        <span>Room key: <code style={{ color: 'var(--accent-purple-text)' }}>{activeRoomId}</code></span>
        <span>•</span>
        <span>Binary Redis TTL presence</span>
      </div>

      {/* Traveler profile sheet */}
      <ProfileSheet
        open={sheetTraveler !== null}
        onClose={() => setSheetTraveler(null)}
        labelledBy="profile-sheet-title"
      >
        {sheetTraveler && (
          <>
            <ProfileSheetContent traveler={sheetTraveler} titleId="profile-sheet-title" />
            <ProfileSheetActions
              initialState={
                sheetTraveler.id === currentUser?.id
                  ? 'already-friends'
                  : connectedIds.has(sheetTraveler.id)
                    ? 'already-friends'
                    : 'idle'
              }
              onSendRequest={() => sendConnectionRequest(sheetTraveler)}
              onReport={() => { setReportTraveler(sheetTraveler); setSheetTraveler(null); }}
              onBlock={() => handleBlock(sheetTraveler)}
            />
          </>
        )}
      </ProfileSheet>

      {/* Report sheet */}
      <ReportSheet
        open={reportTraveler !== null}
        traveler={reportTraveler}
        currentUserId={currentUser?.id}
        onClose={() => setReportTraveler(null)}
        onReported={(msg) => { setReportTraveler(null); showToast(msg); }}
      />

      {/* Confirmation toast — glass pill, announced to screen readers */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="glass animate-fade-in"
          style={{
            position: 'fixed', bottom: 'calc(96px + env(safe-area-inset-bottom))', left: '50%',
            transform: 'translateX(-50%)', padding: '10px 18px', borderRadius: 'var(--radius-full)',
            color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, zIndex: 70, whiteSpace: 'nowrap'
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
};
