import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Ghost, Eye, Navigation, MessageCircle, Sparkles, MapPin, X, Layers } from 'lucide-react';
import type { FriendEntry, UserProfile, ContextResult } from '../types';
import type { MetroFriend } from './FriendsTab';
import { DELHI_METRO_LINES, getStationById } from '../data/metroData';
import { getCommuteRelationship } from '../utils/commuteContext';
import { triggerHaptic } from '../utils/nativeBridge';

interface Props {
  currentUser: UserProfile;
  friends: (MetroFriend | FriendEntry)[];
  currentContext?: ContextResult | null;
  onOpenChat?: (friendId: string) => void;
  onOpenProfile?: (friend: UserProfile) => void;
}

interface FriendMapPin {
  friendId: string;
  profile: UserProfile;
  lat: number;
  lng: number;
  stationName: string;
  lineName: string;
  statusText: string;
  statusEmoji: string;
}

export const FriendsMetroMap: React.FC<Props> = ({
  currentUser,
  friends,
  currentContext,
  onOpenChat,
  onOpenProfile
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Ghost Mode state (persisted locally)
  const [ghostMode, setGhostMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('coride_ghost_mode') === 'true';
    } catch {
      return false;
    }
  });

  const [selectedFriendPin, setSelectedFriendPin] = useState<FriendMapPin | null>(null);
  const [waveSent, setWaveSent] = useState<string | null>(null);

  const toggleGhostMode = () => {
    triggerHaptic('medium');
    const next = !ghostMode;
    setGhostMode(next);
    try {
      localStorage.setItem('coride_ghost_mode', String(next));
    } catch {}
  };

  // Assign realistic active stations to friends for live demonstration
  const friendPins: FriendMapPin[] = React.useMemo(() => {
    return friends.map((f, idx) => {
      const profile: UserProfile = 'friendProfile' in f ? f.friendProfile : f.profile;
      const friendId: string = 'friendId' in f ? f.friendId : f.id;

      // Deterministic station assignment based on friend ID if not explicit
      const linesPool = DELHI_METRO_LINES;
      const targetLine = linesPool[idx % linesPool.length];
      const stations = targetLine.stations;
      const stationIdx = Math.abs(friendId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % stations.length;
      const station = stations[stationIdx];

      const statusChoices = [
        { emoji: '🚇', text: `On ${targetLine.name}` },
        { emoji: '🏛️', text: `At ${station.name}` },
        { emoji: '🎧', text: 'Commuting' },
        { emoji: '⚡', text: 'Heading Home' },
      ];
      const status = statusChoices[idx % statusChoices.length];

      return {
        friendId,
        profile,
        lat: station.lat,
        lng: station.lng,
        stationName: station.name,
        lineName: targetLine.name,
        statusText: status.text,
        statusEmoji: status.emoji
      };
    });
  }, [friends]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Center on Central Delhi (Connaught Place / Rajiv Chowk)
    const map = L.map(mapContainerRef.current, {
      center: [28.6328, 77.2197],
      zoom: 12,
      minZoom: 10,
      maxZoom: 16,
      zoomControl: false
    });

    // CartoDB Dark Matter Tiles (Clean, fast, high aesthetic contrast)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> | &copy; Delhi Metro (DMRC)',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    // Zoom control in bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Draw all 10 Delhi Metro Network Lines
    DELHI_METRO_LINES.forEach(line => {
      const coords = line.stations.map(s => [s.lat, s.lng] as [number, number]);

      // Ambient Outer Glow
      L.polyline(coords, {
        color: line.color,
        weight: 6,
        opacity: 0.3,
        smoothFactor: 1
      }).addTo(map);

      // Core Line Track
      L.polyline(coords, {
        color: line.color,
        weight: 3.5,
        opacity: 0.95,
        smoothFactor: 1
      }).addTo(map);

      // Station nodes
      line.stations.forEach(st => {
        const marker = L.circleMarker([st.lat, st.lng], {
          radius: st.isInterchange ? 4.5 : 2.5,
          color: st.isInterchange ? '#ffffff' : line.color,
          weight: st.isInterchange ? 2 : 1,
          fillColor: st.isInterchange ? '#ffffff' : '#0f172a',
          fillOpacity: 1
        }).addTo(map);

        marker.bindPopup(`
          <div style="font-family: inherit; font-size: 12px; color: #fff; line-height: 1.4; padding: 2px;">
            <div style="font-weight: 800; font-size: 13px; color: #f8fafc;">${st.name}</div>
            <div style="color: #94a3b8; font-size: 11px;">${st.hindiName} • <span style="color:${line.color}; font-weight:700;">${line.name}</span></div>
            ${st.isInterchange ? `<div style="margin-top: 5px; display: inline-block; padding: 2px 7px; border-radius: 999px; background: rgba(168,85,247,0.25); color: #c084fc; font-weight: 800; font-size: 10px;">Interchange Hub</div>` : ''}
          </div>
        `);
      });
    });

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update dynamic markers (Friends pins & Current User pin)
  useEffect(() => {
    const map = mapRef.current;
    const group = markersLayerRef.current;
    if (!map || !group) return;

    group.clearLayers();

    // 1. Current user pin (if not Ghost Mode)
    if (!ghostMode && currentContext) {
      const userStation = getStationById(currentContext.station);
      if (userStation) {
        const userInitials = (currentUser.pseudonym || 'ME').slice(0, 2).toUpperCase();
        const userIcon = L.divIcon({
          className: 'snap-map-icon',
          html: `
            <div class="snap-pin-wrap">
              <div class="snap-bubble" style="border-color: rgba(56, 189, 248, 0.5); background: rgba(14, 116, 144, 0.85);">
                <span class="snap-bubble-emoji">📍</span>
                <span class="snap-bubble-text">You • ${userStation.name}</span>
              </div>
              <div class="snap-avatar-ring">
                <div class="snap-avatar" style="background: ${currentUser.avatarBg || '#0284c7'}; border-color: #38bdf8;">
                  ${userInitials}
                </div>
                <div class="snap-pulse" style="background: rgba(56, 189, 248, 0.6);"></div>
              </div>
            </div>
          `,
          iconSize: [80, 70],
          iconAnchor: [40, 68]
        });

        L.marker([userStation.lat, userStation.lng], { icon: userIcon, zIndexOffset: 1000 }).addTo(group);
      }
    }

    // 2. Friends pins (Strictly friends only — privacy first!)
    friendPins.forEach(pin => {
      const initials = (pin.profile.pseudonym || pin.profile.username).slice(0, 2).toUpperCase();
      const pinIcon = L.divIcon({
        className: 'snap-map-icon',
        html: `
          <div class="snap-pin-wrap">
            <div class="snap-bubble">
              <span class="snap-bubble-emoji">${pin.statusEmoji}</span>
              <span class="snap-bubble-text">${pin.statusText}</span>
            </div>
            <div class="snap-avatar-ring">
              <div class="snap-avatar" style="background: ${pin.profile.avatarBg || '#7c3aed'}">
                ${initials}
              </div>
              <div class="snap-pulse"></div>
            </div>
          </div>
        `,
        iconSize: [80, 70],
        iconAnchor: [40, 68]
      });

      const marker = L.marker([pin.lat, pin.lng], { icon: pinIcon }).addTo(group);
      marker.on('click', () => {
        setSelectedFriendPin(pin);
        map.flyTo([pin.lat, pin.lng], 14, { duration: 0.8 });
      });
    });
  }, [friendPins, ghostMode, currentContext, currentUser]);

  const handleZoomPreset = (preset: 'all' | 'central' | 'me') => {
    const map = mapRef.current;
    if (!map) return;
    if (preset === 'all') {
      map.flyTo([28.625, 77.215], 11, { duration: 1 });
    } else if (preset === 'central') {
      map.flyTo([28.6328, 77.2197], 14, { duration: 1 });
    } else if (preset === 'me' && currentContext) {
      const st = getStationById(currentContext.station);
      if (st) map.flyTo([st.lat, st.lng], 14, { duration: 1 });
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 480, overflow: 'hidden', borderRadius: 'var(--radius-xl)' }}>
      {/* Top Map Floating Control Bar */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        zIndex: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        pointerEvents: 'none'
      }}>
        {/* Left: Network Badge */}
        <div className="glass-thick" style={{
          pointerEvents: 'auto',
          padding: '6px 12px',
          borderRadius: 999,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 800,
          color: 'var(--text-primary)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          <span>10 Metro Lines Live</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>• {friends.length} Friends</span>
        </div>

        {/* Right: Ghost Mode Toggle Button */}
        <button
          onClick={toggleGhostMode}
          className="press glass-thick"
          style={{
            pointerEvents: 'auto',
            padding: '6px 12px',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 800,
            color: ghostMode ? 'var(--accent-purple-text)' : 'var(--text-secondary)',
            border: ghostMode ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
            background: ghostMode ? 'rgba(168, 85, 247, 0.18)' : 'rgba(15, 23, 42, 0.85)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            cursor: 'pointer'
          }}
          title={ghostMode ? 'Ghost Mode: On (Hidden from friends)' : 'Ghost Mode: Off (Visible to friends)'}
        >
          {ghostMode ? <Ghost size={14} color="#c084fc" /> : <Eye size={14} />}
          <span>{ghostMode ? 'Ghost: ON' : 'Ghost: OFF'}</span>
        </button>
      </div>

      {/* Quick Filter Strip (Bottom Left of Map) */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: 12,
        zIndex: 500,
        display: 'flex',
        gap: 6
      }}>
        <button
          onClick={() => handleZoomPreset('all')}
          className="glass-thick press"
          style={{
            padding: '6px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer'
          }}
        >
          <Layers size={13} /> Network
        </button>
        <button
          onClick={() => handleZoomPreset('central')}
          className="glass-thick press"
          style={{
            padding: '6px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            cursor: 'pointer'
          }}
        >
          <Navigation size={13} /> Rajiv Chowk
        </button>
      </div>

      {/* The Leaflet Canvas */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', minHeight: 480 }} />

      {/* Ghost Mode Notification Banner if enabled */}
      {ghostMode && (
        <div style={{
          position: 'absolute',
          top: 54,
          left: 12,
          right: 12,
          zIndex: 490,
          padding: '8px 14px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(30, 27, 75, 0.90)',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          color: '#e9d5ff'
        }}>
          <Ghost size={16} color="#c084fc" />
          <span>Ghost Mode active. Your location is hidden from friends on the map.</span>
        </div>
      )}

      {/* Selected Friend Snap Drawer / Sheet */}
      {selectedFriendPin && (
        <div
          className="animate-slide-up"
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            right: 12,
            zIndex: 600,
            padding: '16px',
            borderRadius: 'var(--radius-xl)',
            background: 'rgba(15, 23, 42, 0.94)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: selectedFriendPin.profile.avatarBg || '#7c3aed',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid rgba(255,255,255,0.2)'
                }}
              >
                {(selectedFriendPin.profile.pseudonym || 'FR').slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#f8fafc' }}>
                  {selectedFriendPin.profile.pseudonym}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {selectedFriendPin.statusEmoji} {selectedFriendPin.statusText} • {selectedFriendPin.lineName}
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedFriendPin(null)}
              className="icon-btn"
              style={{ width: 32, height: 32 }}
              aria-label="Close friend details"
            >
              <X size={16} />
            </button>
          </div>

          {/* Location details & Commute Relation */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#e2e8f0' }}>
              <MapPin size={14} color="#38bdf8" />
              <span>{selectedFriendPin.stationName}</span>
            </div>
            {(() => {
              const commuteRel = getCommuteRelationship(selectedFriendPin.profile, {
                isFriend: true,
                currentContext
              });
              return (
                <span style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: commuteRel.bgColor,
                  color: commuteRel.textColor,
                  border: `1px solid ${commuteRel.borderColor}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <span>{commuteRel.emoji}</span>
                  {commuteRel.label}
                </span>
              );
            })()}
          </div>

          {/* Action CTAs */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => {
                onOpenChat?.(selectedFriendPin.friendId);
                setSelectedFriendPin(null);
              }}
              className="btn-primary press"
              style={{ flex: 1, padding: '10px 14px', fontSize: 13, justifyContent: 'center' }}
            >
              <MessageCircle size={15} /> Chat Now
            </button>

            <button
              onClick={() => {
                triggerHaptic('success');
                setWaveSent(selectedFriendPin.friendId);
                setTimeout(() => setWaveSent(null), 2500);
              }}
              className="pill-button secondary press"
              style={{ padding: '10px 14px', fontSize: 13 }}
            >
              <Sparkles size={15} />
              {waveSent === selectedFriendPin.friendId ? 'Wave Sent! 👋' : 'Say Hi 👋'}
            </button>

            <button
              onClick={() => {
                onOpenProfile?.(selectedFriendPin.profile);
                setSelectedFriendPin(null);
              }}
              className="pill-button secondary press"
              style={{ padding: '10px 14px', fontSize: 13 }}
            >
              Profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
