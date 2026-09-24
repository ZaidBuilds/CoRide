import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PlusIcon, MinusIcon, CornersOutIcon, CrosshairIcon, XIcon } from '@phosphor-icons/react';
import type { FriendEntry, UserProfile, ContextResult, MetroLine, MetroStation } from '../types';
import type { MetroFriend } from './FriendsTab';
import { DELHI_METRO_LINES, getLineById, getStationById } from '../data/metroData';
import { linePaths } from './transit/lineSegments';
import { resolvedTheme } from '../utils/theme';
import { triggerHaptic } from '../utils/nativeBridge';
import { IconButton } from './ui/IconButton';
import { LinePill } from './ui/LinePill';

interface Props {
  currentUser: UserProfile;
  /**
   * Accepted for compatibility. Friends are NOT drawn: the server doesn't share
   * friends' locations, and pinning them anywhere would be made up.
   */
  friends?: (MetroFriend | FriendEntry)[];
  currentContext?: ContextResult | null;
  /** Line to emphasise; the rest of the network is drawn quieter. */
  focusLineId?: string;
  onOpenChat?: (friendId: string) => void;
  onOpenProfile?: (friend: UserProfile) => void;
}

const TILE_URL = (theme: 'light' | 'dark') =>
  `https://{s}.basemaps.cartocdn.com/${theme === 'light' ? 'light_all' : 'dark_all'}/{z}/{x}/{y}{r}.png`;
// CARTO basemaps are built on OpenStreetMap data: both credits are required.
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';

const NETWORK_BOUNDS = L.latLngBounds(
  DELHI_METRO_LINES.flatMap(l => l.stations.map(s => [s.lat, s.lng] as [number, number]))
);

/** Map colours per theme (Leaflet paints SVG, so these can't be CSS vars). Match index.css. */
const PALETTE = {
  light: { ink: '#111418', surface: '#F8F9F6' },
  dark: { ink: '#EEF0F2', surface: '#15181C' },
} as const;
const SIGNAL = '#C8F031';
const INK_FIXED = '#111418';

interface Selected {
  station: MetroStation;
  line: MetroLine;
}

// Scoped restyle of Leaflet chrome: concrete-and-ink tiles, readable attribution, flat tooltip.
const MAP_CSS = `
.cr-map .leaflet-tile-pane { filter: grayscale(1) contrast(0.92) brightness(1.02) }
:root:not([data-theme="light"]) .cr-map .leaflet-tile-pane { filter: grayscale(1) brightness(0.9) }
.cr-map .leaflet-control-attribution {
  background: var(--bg-elevated); color: var(--text-secondary);
  font: 480 11px/16px var(--font-ui); padding: 2px 8px; border-top-left-radius: 8px;
}
.cr-map .leaflet-control-attribution a { color: var(--text-primary); text-decoration: underline }
.cr-map .cr-you-tip {
  background: var(--ink); color: var(--ink-inverse); border: none; border-radius: 999px;
  box-shadow: var(--shadow-float); font: 600 13px/18px var(--font-ui); padding: 4px 10px;
}
.cr-map .cr-you-tip::before { display: none }
`;

/**
 * Delhi Metro network map (Leaflet + CARTO tiles, greyed to match the app).
 * Draws the static network from metroData and the rider's own station from
 * their context: nothing else.
 */
export const FriendsMetroMap: React.FC<Props> = ({ currentUser, currentContext, focusLineId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tilesRef = useRef<L.TileLayer | null>(null);
  const meLayerRef = useRef<L.LayerGroup | null>(null);
  const pathsRef = useRef<{ lineId: string; layer: L.Polyline }[]>([]);
  const dotsRef = useRef<{ lineId: string; layer: L.CircleMarker; interchange: boolean }[]>([]);
  const focusRef = useRef(focusLineId);
  const [selected, setSelected] = useState<Selected | null>(null);

  const myStation = currentContext?.station ? getStationById(currentContext.station) : undefined;

  /** Re-colour lines and dots for the theme and the focused line. */
  const paint = () => {
    const pal = PALETTE[resolvedTheme()];
    const focus = focusRef.current;
    for (const { lineId, layer } of pathsRef.current) {
      const on = !focus || lineId === focus;
      layer.setStyle({ opacity: on ? 1 : 0.3, weight: on ? 5 : 3 });
      if (on) layer.bringToFront();
    }
    for (const { lineId, layer, interchange } of dotsRef.current) {
      const on = !focus || lineId === focus;
      layer.setStyle({
        color: pal.ink,
        fillColor: pal.surface,
        opacity: on ? 1 : 0.35,
        fillOpacity: on ? 1 : 0.35,
        weight: interchange ? 2 : 1.5,
      });
      layer.setRadius(on ? (interchange ? 5 : 3.5) : 2.5);
      if (on) layer.bringToFront();
    }
  };
  const paintRef = useRef(paint);
  useEffect(() => { paintRef.current = paint; });

  // Create the map once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      zoomControl: false,
      minZoom: 9,
      maxZoom: 17,
      maxBounds: NETWORK_BOUNDS.pad(0.6),
      attributionControl: true,
    });
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    map.fitBounds(NETWORK_BOUNDS, { padding: [16, 16] });

    tilesRef.current = L.tileLayer(TILE_URL(resolvedTheme()), {
      attribution: ATTRIBUTION,
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    for (const line of DELHI_METRO_LINES) {
      for (const path of linePaths(line)) {
        const layer = L.polyline(path, { color: line.color, weight: 4, opacity: 1, interactive: false, lineCap: 'round', lineJoin: 'round' }).addTo(map);
        pathsRef.current.push({ lineId: line.id, layer });
      }
    }
    for (const line of DELHI_METRO_LINES) {
      for (const st of line.stations) {
        const layer = L.circleMarker([st.lat, st.lng], { radius: 3.5, interactive: false }).addTo(map);
        dotsRef.current.push({ lineId: line.id, layer, interchange: st.isInterchange });
        // Invisible, finger-sized hit target on top of the small dot.
        L.circleMarker([st.lat, st.lng], { radius: 16, stroke: false, fillOpacity: 0 })
          .on('click', () => {
            triggerHaptic('light');
            setSelected({ station: st, line });
          })
          .addTo(map);
      }
    }
    paintRef.current();

    meLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Leaflet measures its container once; tab switches and rotation change it.
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);

    // Swap tiles and ink when the app theme (data-theme) or the OS scheme changes.
    const retheme = () => {
      tilesRef.current?.setUrl(TILE_URL(resolvedTheme()));
      paintRef.current();
    };
    const mo = new MutationObserver(retheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    mq.addEventListener?.('change', retheme);

    return () => {
      ro.disconnect();
      mo.disconnect();
      mq.removeEventListener?.('change', retheme);
      map.remove();
      mapRef.current = null;
      pathsRef.current = [];
      dotsRef.current = [];
    };
  }, []);

  // Emphasise the chosen line.
  useEffect(() => {
    focusRef.current = focusLineId;
    paintRef.current();
    const map = mapRef.current;
    const line = focusLineId ? getLineById(focusLineId) : undefined;
    if (map && line && !myStation) {
      map.flyToBounds(L.latLngBounds(line.stations.map(s => [s.lat, s.lng] as [number, number])), { padding: [32, 32], duration: 0.5 });
    }
  }, [focusLineId, myStation]);

  // The rider's own position (their checked-in / detected station): lime with an ink ring.
  useEffect(() => {
    const map = mapRef.current;
    const layer = meLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!myStation) return;
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:22px;height:22px;border-radius:50%;background:${SIGNAL};border:3px solid ${INK_FIXED};box-shadow:0 0 0 3px ${SIGNAL}, 0 0 0 4.5px ${INK_FIXED}"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    L.marker([myStation.lat, myStation.lng], {
      icon,
      zIndexOffset: 1000,
      keyboard: false,
      title: `You: ${myStation.name}`,
    })
      .bindTooltip(`You · ${myStation.name.split(' (')[0]}`, { permanent: true, direction: 'top', offset: [0, -16], className: 'cr-you-tip' })
      .addTo(layer);
    map.setView([myStation.lat, myStation.lng], Math.max(map.getZoom(), 13), { animate: false });
  }, [myStation, currentUser.id]);

  const zoomBy = (d: number) => {
    const map = mapRef.current;
    if (map) map.setZoom(map.getZoom() + d);
  };
  const fitNetwork = () => {
    mapRef.current?.flyToBounds(NETWORK_BOUNDS, { padding: [16, 16], duration: 0.6 });
  };
  const goToMe = () => {
    if (!myStation) return;
    mapRef.current?.flyTo([myStation.lat, myStation.lng], 14, { duration: 0.6 });
  };

  const servedBy: MetroLine[] = selected
    ? [
        selected.line,
        ...(selected.station.interchangeLines || [])
          .map(id => getLineById(id))
          .filter((l): l is MetroLine => l !== undefined && l.id !== selected.line.id),
      ]
    : [];

  return (
    <div
      className="cr-map"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 320,
        overflow: 'hidden',
        borderRadius: 'var(--radius-card)',
        background: 'var(--bg-sunken)',
        // Own stacking context so Leaflet's z-indexed panes (400-1000) can't paint over the bottom nav.
        isolation: 'isolate',
        zIndex: 0,
      }}
    >
      <style>{MAP_CSS}</style>
      <div
        ref={containerRef}
        role="application"
        aria-label="Delhi Metro network map"
        style={{ position: 'absolute', inset: 0 }}
      />

      {/* Controls: 48px targets, top-right, clear of the attribution */}
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <MapButton label="Zoom in" onClick={() => zoomBy(1)}><PlusIcon size={20} /></MapButton>
        <MapButton label="Zoom out" onClick={() => zoomBy(-1)}><MinusIcon size={20} /></MapButton>
        <MapButton label="Show whole network" onClick={fitNetwork}><CornersOutIcon size={20} /></MapButton>
        {myStation && <MapButton label="Go to my station" onClick={goToMe}><CrosshairIcon size={20} /></MapButton>}
      </div>

      {selected && (
        <div
          role="dialog"
          aria-label={`${selected.station.name} station`}
          className="animate-slide-up"
          style={{
            position: 'absolute', left: 12, right: 12, bottom: 32, zIndex: 1000,
            padding: 16, borderRadius: 'var(--radius-card)',
            background: 'var(--bg-elevated)', boxShadow: 'var(--shadow-float)',
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="type-headline" style={{ color: 'var(--text-primary)' }}>{selected.station.name}</div>
            {selected.station.hindiName && (
              <div lang="hi" className="type-hi type-meta" style={{ color: 'var(--text-muted)' }}>{selected.station.hindiName}</div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {servedBy.map(l => <LinePill key={l.id} line={l} />)}
            </div>
            {myStation?.id === selected.station.id && (
              <div className="type-meta" style={{ color: 'var(--text-secondary)', marginTop: 8 }}>You're checked in here.</div>
            )}
          </div>
          <IconButton label="Close station details" variant="plain" onClick={() => setSelected(null)} style={{ margin: '-12px -12px 0 0' }}>
            <XIcon size={20} aria-hidden="true" />
          </IconButton>
        </div>
      )}
    </div>
  );
};

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <IconButton label={label} onClick={onClick} style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-float)' }}>
      {children}
    </IconButton>
  );
}
