import React, { useEffect, useRef, useState } from 'react';
import { DELHI_METRO_LINES } from '../../data/metroData';
import { triggerHaptic } from '../../utils/nativeBridge';
import { ArrowLeftRight, CheckCircle2, ChevronRight, MapPin, Search, Users, X } from 'lucide-react';
import type { MetroLine } from '../../types';
import { textOnLineColor } from './lineSegments';

interface CheckInScreenProps {
  /** direction is passed as "Towards <terminal>", the server's format. */
  onCheckIn: (lineId: string, stationId: string, direction: string) => Promise<void> | void;
  onCancel?: () => void;
  initialLineId?: string;
  initialStationId?: string;
  /** Context direction, e.g. "Towards Dwarka Sector 21". */
  initialDirection?: string;
}

const baseName = (name: string) => name.split(' (')[0].trim().toLowerCase();

export const CheckInScreen: React.FC<CheckInScreenProps> = ({
  onCheckIn,
  onCancel,
  initialLineId = 'blue',
  initialStationId = 'rajiv_chowk',
  initialDirection
}) => {
  const [selectedLineId, setSelectedLineId] = useState<string>(initialLineId);
  const selectedLine = DELHI_METRO_LINES.find(l => l.id === selectedLineId) || DELHI_METRO_LINES[0];

  const [selectedStationId, setSelectedStationId] = useState<string>(
    initialStationId && selectedLine.stations.some(s => s.id === initialStationId)
      ? initialStationId
      : selectedLine.stations[0]?.id || 'rajiv_chowk'
  );
  const selectedStation = selectedLine.stations.find(s => s.id === selectedStationId) || selectedLine.stations[0];

  // 0 = towards terminal B, 1 = towards terminal A. The server sends
  // "Towards <terminal>", so match on the terminal name.
  const [directionIndex, setDirectionIndex] = useState<0 | 1>(() =>
    initialDirection && initialDirection.toLowerCase().includes(selectedLine.terminalA.toLowerCase()) ? 1 : 0
  );
  const activeDestination = directionIndex === 0 ? selectedLine.terminalB : selectedLine.terminalA;
  const activeOrigin = directionIndex === 0 ? selectedLine.terminalA : selectedLine.terminalB;

  const [isStationPickerOpen, setIsStationPickerOpen] = useState(false);
  const [stationSearchQuery, setStationSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const stationButtonRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  useEffect(() => { onCancelRef.current = onCancel; });

  // Escape closes the picker first, then the screen.
  const pickerOpenRef = useRef(isStationPickerOpen);
  useEffect(() => { pickerOpenRef.current = isStationPickerOpen; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (pickerOpenRef.current) setIsStationPickerOpen(false);
      else onCancelRef.current?.();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    if (isStationPickerOpen) searchRef.current?.focus();
  }, [isStationPickerOpen]);

  const handleToggleDirection = () => {
    triggerHaptic('medium');
    setDirectionIndex(prev => (prev === 0 ? 1 : 0));
  };

  const handleLineSelect = (line: MetroLine) => {
    triggerHaptic('light');
    setSelectedLineId(line.id);
    // Keep the station when it's an interchange on the new line.
    const same = line.stations.find(s => baseName(s.name) === baseName(selectedStation.name));
    setSelectedStationId(same?.id || line.stations[0]?.id || '');
    setDirectionIndex(0);
    setError(null);
  };

  const closePicker = () => {
    setIsStationPickerOpen(false);
    setStationSearchQuery('');
    stationButtonRef.current?.focus();
  };

  // Non-optimistic: the confirmed state only shows after onCheckIn resolves.
  const handleConfirmCheckIn = async () => {
    if (isSubmitting || isConfirmed) return;
    setIsSubmitting(true);
    setError(null);
    triggerHaptic('medium');
    try {
      await onCheckIn(selectedLine.id, selectedStation.id, `Towards ${activeDestination}`);
      setIsConfirmed(true);
      triggerHaptic('success');
    } catch {
      setError('Couldn’t check you in. Check your connection and try again.');
      triggerHaptic('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const q = stationSearchQuery.trim().toLowerCase();
  const filteredStations = q
    ? selectedLine.stations.filter(s => s.name.toLowerCase().includes(q) || (s.hindiName && s.hindiName.includes(stationSearchQuery.trim())))
    : selectedLine.stations;

  const onLine = textOnLineColor(selectedLine.color);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkin-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        backgroundColor: 'var(--bg-canvas)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <header
        style={{
          paddingTop: 'calc(8px + var(--safe-top))',
          paddingBottom: 8,
          paddingLeft: 16,
          paddingRight: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          borderTop: `4px solid ${selectedLine.color}`,
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)'
        }}
      >
        <h1 id="checkin-title" style={{ fontSize: 20, lineHeight: '28px', fontWeight: 700, margin: 0 }}>
          Check in
        </h1>
        {onCancel && !isConfirmed && (
          <button type="button" onClick={onCancel} className="icon-btn" style={{ background: 'transparent', border: 'none' }} aria-label="Close check-in">
            <X size={22} />
          </button>
        )}
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Line */}
        <div>
          <div id="checkin-line-label" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Line
          </div>
          <div role="radiogroup" aria-labelledby="checkin-line-label" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            {DELHI_METRO_LINES.map(line => {
              const isSelected = line.id === selectedLineId;
              return (
                <button
                  key={line.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleLineSelect(line)}
                  className="press"
                  style={{
                    minHeight: 48,
                    padding: '0 16px',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: isSelected ? line.color : 'var(--bg-surface)',
                    color: isSelected ? textOnLineColor(line.color) : 'var(--text-secondary)',
                    border: `1px solid ${isSelected ? line.color : 'var(--border-subtle)'}`,
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 14,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  {!isSelected && <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: line.color }} />}
                  {line.name.replace(' Line', '')}
                </button>
              );
            })}
          </div>
        </div>

        {/* Station */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>Station</div>
          <button
            ref={stationButtonRef}
            type="button"
            onClick={() => setIsStationPickerOpen(true)}
            aria-haspopup="dialog"
            aria-label={`Station: ${selectedStation.name}. Change station`}
            className="press"
            style={{
              width: '100%',
              textAlign: 'left',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: 'var(--text-primary)'
            }}
          >
            <MapPin size={22} aria-hidden="true" color={selectedLine.color} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="type-heading" style={{ display: 'block', wordBreak: 'break-word' }}>{selectedStation.name}</span>
              {selectedStation.hindiName && (
                <span lang="hi" style={{ display: 'block', fontSize: 14, color: 'var(--text-secondary)' }}>{selectedStation.hindiName}</span>
              )}
              {selectedStation.isInterchange && (
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Interchange station</span>
              )}
            </span>
            <ChevronRight size={20} aria-hidden="true" color="var(--text-muted)" />
          </button>
        </div>

        {/* Direction */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>Direction</div>
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '12px 12px 12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }} aria-live="polite">
              <div style={{ fontSize: 17, lineHeight: '24px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Towards {activeDestination}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>From {activeOrigin}</div>
            </div>
            <button
              type="button"
              onClick={handleToggleDirection}
              className="icon-btn"
              aria-label={`Switch direction to towards ${activeOrigin}`}
            >
              <ArrowLeftRight size={20} color={selectedLine.color} />
            </button>
          </div>
        </div>

        {/* What checking in shares — matches the privacy policy */}
        <div
          style={{
            padding: 16,
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-card)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12
          }}
        >
          <Users size={20} aria-hidden="true" color="var(--text-secondary)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 13, lineHeight: '18px', color: 'var(--text-secondary)', margin: 0 }}>
            You’ll join the live room for this station and direction. Riders there can see your display name, avatar, bio and interests. You leave the room about a minute after you close the app.
          </p>
        </div>
      </div>

      <div
        style={{
          padding: '12px 16px calc(12px + var(--safe-bottom))',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)'
        }}
      >
        {error && (
          <div role="alert" style={{ fontSize: 13, lineHeight: '18px', color: 'var(--accent-rose-text)', marginBottom: 8 }}>{error}</div>
        )}
        <button
          type="button"
          disabled={isSubmitting || isConfirmed}
          onClick={handleConfirmCheckIn}
          aria-busy={isSubmitting}
          className="press"
          style={{
            width: '100%',
            minHeight: 52,
            padding: '12px 24px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: isConfirmed ? 'var(--status-success)' : selectedLine.color,
            color: isConfirmed ? '#FFFFFF' : onLine,
            border: 'none',
            fontSize: 16,
            lineHeight: '24px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            cursor: isSubmitting || isConfirmed ? 'default' : 'pointer',
            transition: 'background-color var(--motion-slow) var(--ease-decelerate)'
          }}
        >
          {isConfirmed ? (
            <>
              <CheckCircle2 size={22} aria-hidden="true" />
              <span role="status">Checked in at {selectedStation.name.split(' (')[0]}</span>
            </>
          ) : isSubmitting ? (
            <>
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: 18,
                  height: 18,
                  border: `2px solid ${onLine}`,
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }}
              />
              <span>Checking in…</span>
            </>
          ) : (
            <span>Check in at {selectedStation.name.split(' (')[0]}</span>
          )}
        </button>
      </div>

      {/* Station picker */}
      {isStationPickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="station-picker-title"
          style={{ position: 'absolute', inset: 0, zIndex: 150, backgroundColor: 'var(--bg-canvas)', display: 'flex', flexDirection: 'column' }}
        >
          <div
            style={{
              paddingTop: 'calc(8px + var(--safe-top))',
              paddingBottom: 8,
              paddingLeft: 16,
              paddingRight: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface)'
            }}
          >
            <h2 id="station-picker-title" style={{ fontSize: 20, lineHeight: '28px', fontWeight: 700, margin: 0 }}>
              {selectedLine.name} stations
            </h2>
            <button type="button" onClick={closePicker} className="icon-btn" style={{ background: 'transparent', border: 'none' }} aria-label="Close station list">
              <X size={22} />
            </button>
          </div>

          <div style={{ padding: 16, borderBottom: '1px solid var(--border-subtle)', position: 'relative' }}>
            <Search size={18} aria-hidden="true" color="var(--text-muted)" style={{ position: 'absolute', left: 30, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              ref={searchRef}
              type="search"
              aria-label="Search stations"
              placeholder="Search station or स्टेशन"
              value={stationSearchQuery}
              onChange={e => setStationSearchQuery(e.target.value)}
              style={{
                width: '100%',
                minHeight: 48,
                padding: '0 16px 0 44px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontSize: 16
              }}
            />
          </div>

          <ul style={{ flex: 1, overflowY: 'auto', listStyle: 'none', margin: 0, padding: '8px 8px calc(8px + var(--safe-bottom))' }}>
            {filteredStations.length === 0 && (
              <li style={{ padding: 24, textAlign: 'center', fontSize: 14, color: 'var(--text-muted)' }}>
                No {selectedLine.name} station matches “{stationSearchQuery.trim()}”. Try another line?
              </li>
            )}
            {filteredStations.map(st => {
              const isSelected = st.id === selectedStationId;
              return (
                <li key={st.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedStationId(st.id);
                      setError(null);
                      closePicker();
                    }}
                    className="press"
                    style={{
                      width: '100%',
                      minHeight: 56,
                      padding: '8px 16px',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      textAlign: 'left',
                      border: 'none',
                      backgroundColor: isSelected ? 'var(--bg-surface-raised)' : 'transparent',
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 16, lineHeight: '22px', fontWeight: isSelected ? 700 : 500 }}>{st.name}</span>
                      {st.hindiName && (
                        <span lang="hi" style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)' }}>{st.hindiName}</span>
                      )}
                    </span>
                    {isSelected && <CheckCircle2 size={20} aria-hidden="true" color={selectedLine.color} style={{ flexShrink: 0 }} />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};
