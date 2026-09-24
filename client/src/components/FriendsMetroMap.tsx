import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Plus, Minus, Maximize2, LocateFixed, X } from 'lucide-react';
import type { FriendEntry, UserProfile, ContextResult, MetroLine, MetroStation } from '../types';
import type { MetroFriend } from './FriendsTab';
import { DELHI_METRO_LINES, getLineById, getStationById } from '../data/metroData';
import { linePaths, textOnLineColor } from './transit/lineSegments';
import { resolvedTheme } from '../utils/theme';
import { triggerHaptic } from '../utils/nativeBridge';

interface Props {
  currentUser: UserProfile;
  /**
   * Accepted for compatibility. Friends are NOT drawn: the server doesn't share
   * friends' locations, and pinning them anywhere would be made up.
   */
  friends?: (MetroFriend | FriendEntry)[];
  currentContext?: ContextResult | null;
  onOpenChat?: (friendId: string) => void;
  onOpenProfile?: (friend: UserProfile) => void;
}

const TILE_URL = (theme: 'light' | 'dark') =>
  `https://{s}.basemaps.cartocdn.com/${theme === 'light' ? 'light_all' : 'dark_all'}/{z}/{x}/{y}{r}.png`;
// CARTO basemaps are built on OpenStreetMap data — both credits are required.
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';

const NETWORK_BOUNDS = L.latLngBounds(
  DELHI_METRO_LINES.flatMap(l => l.stations.map(s => [s.lat, s.lng] as [number, number]))
);

interface Selected {
  station: MetroStation;
  line: MetroLine;
}

/**
 * Delhi Metro network map (Leaflet + CARTO tiles). Draws the static network
 * from metroData and the user's own station from their context — nothing else.
 */
export const FriendsMetroMap: React.FC<Props> = ({ currentUser, currentContext }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tilesRef = useRef<L.TileLayer | null>(null);
  const meLayerRef = useRef<L.LayerGroup | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);

  const myStation = currentContext?.station ? getStationById(currentContext.station) : undefined;
  const myLine = currentContext?.line ? getLineById(currentContext.line) : undefined;

  // Create the map once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      zoomControl: false,
      minZoom: 9,
      maxZoom: 17,
      maxBounds: NETWORK_BOUNDS.pad(0.6),
      attributionControl: true
    });
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    map.fitBounds(NETWORK_BOUNDS, { padding: [16, 16] });

    tilesRef.current = L.tileLayer(TILE_URL(resolvedTheme()), {
      attribution: ATTRIBUTION,
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    for (const line of DELHI_METRO_LINES) {
      for (const path of linePaths(line)) {
        L.polyline(path, { color: line.color, weight: 4, opacity: 0.95, interactive: false }).addTo(map);
      }
      for (const st of line.stations) {
        L.circleMarker([st.lat, st.lng], {
          radius: st.isInterchange ? 5 : 3.5,
          color: line.color,
          weight: 2,
          fillColor: st.isInterchange ? '#FFFFFF' : line.color,
          fillOpacity: 1,
          interactive: false
        }).addTo(map);
        // Invisible, finger-sized hit target on top of the tiny dot.
        L.circleMarker([st.lat, st.lng], { radius: 14, stroke: false, fillOpacity: 0 })
          .on('click', () => {
            triggerHaptic('light');
            setSelected({ station: st, line });
          })
          .addTo(map);
      }
    }

    meLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Leaflet measures its container once; tab switches and rotation change it.
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);

    // Swap tiles when the app theme (data-theme) or the OS scheme changes.
    const retile = () => tilesRef.current?.setUrl(TILE_URL(resolvedTheme()));
    const mo = new MutationObserver(retile);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener?.('change', retile);

    return () => {
      ro.disconnect();
      mo.disconnect();
      mq.removeEventListener?.('change', retile);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // The user's own position (their checked-in / detected station).
  useEffect(() => {
    const map = mapRef.current;
    const layer = meLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!myStation) return;
    const color = myLine?.color || '#2563EB';
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:22px;height:22px;border-radius:50%;background:${color};border:3px solid #FFFFFF;box-shadow:0 0 0 6px ${color}55, 0 2px 6px rgba(0,0,0,0.4)"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
    L.marker([myStation.lat, myStation.lng], {
      icon,
      zIndexOffset: 1000,
      keyboard: false,
      title: `You: ${myStation.name}`
    })
      .bindTooltip(`You · ${myStation.name}`, { permanent: true, direction: 'top', offset: [0, -14] })
      .addTo(layer);
    map.setView([myStation.lat, myStation.lng], Math.max(map.getZoom(), 13), { animate: false });
  }, [myStation, myLine, currentUser.id]);

  const zoomBy = (d: number) => {
    triggerHaptic('light');
    const map = mapRef.current;
    if (map) map.setZoom(map.getZoom() + d);
  };
  const fitNetwork = () => {
    triggerHaptic('light');
    mapRef.current?.flyToBounds(NETWORK_BOUNDS, { padding: [16, 16], duration: 0.6 });
  };
  const goToMe = () => {
    if (!myStation) return;
    triggerHaptic('light');
    mapRef.current?.flyTo([myStation.lat, myStation.lng], 14, { duration: 0.6 });
  };

  const servedBy: MetroLine[] = selected
    ? [
        selected.line,
        ...(selected.station.interchangeLines || [])
          .map(id => getLineById(id))
          .filter((l): l is MetroLine => l !== undefined && l.id !== selected.line.id)
      ]
    : [];

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 320,
        overflow: 'hidden',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-card)',
        // Own stacking context so Leaflet's z-indexed panes (400–1000) can't paint over the bottom nav.
        isolation: 'isolate',
        zIndex: 0
      }}
    >
      <div
        ref={containerRef}
        role="application"
        aria-label="Delhi Metro network map"
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* Map controls — 48dp targets, top-right, clear of the attribution */}
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <MapButton label="Zoom in" onClick={() => zoomBy(1)}><Plus size={20} /></MapButton>
        <MapButton label="Zoom out" onClick={() => zoomBy(-1)}><Minus size={20} /></MapButton>
        <MapButton label="Show whole network" onClick={fitNetwork}><Maximize2 size={18} /></MapButton>
        {myStation && <MapButton label="Go to my station" onClick={goToMe}><LocateFixed size={20} /></MapButton>}
      </div>

      {selected && (
        <div
          role="dialog"
          aria-label={`${selected.station.name} station`}
          className="animate-slide-up"
          style={{
            position: 'absolute', left: 12, right: 12, bottom: 28, zIndex: 1000,
            padding: 16, borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface-raised)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-lg)',
            display: 'flex', gap: 12, alignItems: 'flex-start'
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{selected.station.name}</div>
            {selected.station.hindiName && (
              <div lang="hi" style={{ fontSize: 13, color: 'var(--text-muted)' }}>{selected.station.hindiName}</div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {servedBy.map(l => (
                <span key={l.id} style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: l.color, color: textOnLineColor(l.color) }}>
                  {l.name}
                </span>
              ))}
            </div>
            {myStation?.id === selected.station.id && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>You’re checked in here.</div>
            )}
          </div>
          <button type="button" className="icon-btn" onClick={() => setSelected(null)} aria-label="Close station details">
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="icon-btn"
      style={{ background: 'var(--bg-surface-raised)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-md)' }}
    >
      {children}
    </button>
  );
}
