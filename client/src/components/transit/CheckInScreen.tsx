import React, { useState } from 'react';
import { DELHI_METRO_LINES } from '../../data/metroData';
import { triggerHaptic } from '../../utils/nativeBridge';
import { ArrowLeftRight, CheckCircle2, ChevronRight, MapPin, Sparkles, X } from 'lucide-react';
import type { MetroLine } from '../../types';

interface CheckInScreenProps {
  onCheckIn: (lineId: string, stationId: string, direction: string) => Promise<void> | void;
  onCancel?: () => void;
  initialLineId?: string;
  initialStationId?: string;
  initialDirection?: string;
}

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

  // Direction: terminalA -> terminalB or terminalB -> terminalA
  const [directionIndex, setDirectionIndex] = useState<0 | 1>(
    initialDirection === selectedLine.terminalB ? 1 : 0
  );

  const activeDestination = directionIndex === 0 ? selectedLine.terminalB : selectedLine.terminalA;
  const activeOrigin = directionIndex === 0 ? selectedLine.terminalA : selectedLine.terminalB;

  // Search filter for stations
  const [isStationPickerOpen, setIsStationPickerOpen] = useState<boolean>(false);
  const [stationSearchQuery, setStationSearchQuery] = useState<string>('');

  // Status & The One Orchestrated 600ms Moment
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);

  // Direction toggle with physical 48dp tactile feel
  const handleToggleDirection = () => {
    triggerHaptic('medium');
    setDirectionIndex(prev => (prev === 0 ? 1 : 0));
  };

  // Line selection change
  const handleLineSelect = (line: MetroLine) => {
    triggerHaptic('light');
    setSelectedLineId(line.id);
    setSelectedStationId(line.stations[0]?.id || '');
    setDirectionIndex(0);
  };

  // Check in confirmation — Strictly non-optimistic, server-backed, with 600ms orchestrated celebration
  const handleConfirmCheckIn = async () => {
    if (isSubmitting || isConfirmed) return;
    setIsSubmitting(true);
    triggerHaptic('medium');

    try {
      await onCheckIn(selectedLine.id, selectedStation.id, activeDestination);
      // Trigger the single orchestrated 600ms moment
      setIsConfirmed(true);
      triggerHaptic('heavy');
      setTimeout(() => {
        triggerHaptic('light');
      }, 300);
    } catch (err) {
      console.error('Check-in failed:', err);
      setIsSubmitting(false);
    }
  };

  const filteredStations = selectedLine.stations.filter(s =>
    s.name.toLowerCase().includes(stationSearchQuery.toLowerCase()) ||
    (s.hindiName && s.hindiName.includes(stationSearchQuery))
  );

  return (
    <div
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
      {/* ── ZONE 1 & 2: Top Transit Chromatic Band & Header ── */}
      <div
        style={{
          width: '100%',
          height: 6,
          backgroundColor: selectedLine.color,
          boxShadow: `0 0 16px ${selectedLine.color}`,
          transition: 'background-color var(--motion-fast) var(--ease-standard)'
        }}
      />

      <header
        style={{
          paddingTop: 'calc(12px + env(safe-area-inset-top))',
          paddingBottom: 12,
          paddingLeft: 'var(--space-3)',
          paddingRight: 'var(--space-3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              backgroundColor: selectedLine.color,
              boxShadow: `0 0 8px ${selectedLine.color}`
            }}
          />
          <span className="type-label" style={{ color: 'var(--text-primary)', fontWeight: 700 }}>
            {selectedLine.name}
          </span>
        </div>

        {onCancel && !isConfirmed && (
          <button
            onClick={onCancel}
            className="touch-target-48 press"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
            aria-label="Close check-in"
          >
            <X size={22} />
          </button>
        )}
      </header>

      {/* ── ZONE 3: Scrolling Content ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-4) var(--space-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)'
        }}
      >
        {/* Line Selector Pills (Horizontal Scroll, 48dp touch targets) */}
        <div>
          <div className="type-caption" style={{ color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Select Metro Line
          </div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              paddingBottom: 4,
              scrollbarWidth: 'none'
            }}
          >
            {DELHI_METRO_LINES.map(line => {
              const isSelected = line.id === selectedLineId;
              return (
                <button
                  key={line.id}
                  onClick={() => handleLineSelect(line)}
                  className="touch-target-48 press"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-pill)',
                    backgroundColor: isSelected ? line.color : 'var(--bg-surface)',
                    color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
                    border: isSelected ? 'none' : '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 13,
                    lineHeight: '20px',
                    whiteSpace: 'nowrap',
                    boxShadow: isSelected ? `0 4px 12px ${line.color}40` : 'none',
                    transition: 'all var(--motion-fast) var(--ease-standard)'
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: isSelected ? '#FFFFFF' : line.color,
                      marginRight: 6
                    }}
                  />
                  {line.name.replace(' Line', '')}
                </button>
              );
            })}
          </div>
        </div>

        {/* ══ THE BOLD ELEMENT: 34pt Display Station Title ══ */}
        <div
          onClick={() => setIsStationPickerOpen(true)}
          role="button"
          tabIndex={0}
          className="press"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-card)',
            padding: 'var(--space-4)',
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-md)'
          }}
        >
          {/* Subtle line ambient tint behind the hero card */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: 140,
              height: 140,
              background: `radial-gradient(circle at top right, ${selectedLine.color}22 0%, transparent 70%)`,
              pointerEvents: 'none'
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="type-caption" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={14} color={selectedLine.color} />
              BOARDING STATION (TAP TO CHANGE)
            </div>
            <ChevronRight size={18} color="var(--text-muted)" />
          </div>

          {/* 34pt display station name (The ONLY 34pt display in the app) */}
          <div
            className="type-display"
            style={{
              color: 'var(--text-primary)',
              marginBottom: 4,
              wordBreak: 'break-word'
            }}
          >
            {selectedStation.name}
          </div>

          {/* Bilingual Hindi station name for authenticity & DMRC fidelity */}
          {selectedStation.hindiName && (
            <div
              className="type-body"
              style={{
                color: 'var(--text-secondary)',
                fontWeight: 500
              }}
            >
              {selectedStation.hindiName}
            </div>
          )}

          {selectedStation.isInterchange && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  lineHeight: '16px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-chip)',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-secondary)'
                }}
              >
                🔄 Interchange Station
              </span>
            </div>
          )}
        </div>

        {/* ══ Physical Direction Switch (48dp tactile feel) ══ */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-card)',
            padding: 'var(--space-3) var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="type-caption" style={{ color: 'var(--text-muted)', marginBottom: 2 }}>
              TRAIN DIRECTION
            </div>
            <div className="type-heading" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Towards {activeDestination}
            </div>
            <div className="type-caption" style={{ color: 'var(--text-secondary)' }}>
              Origin: {activeOrigin}
            </div>
          </div>

          <button
            onClick={handleToggleDirection}
            className="touch-target-48 press"
            style={{
              borderRadius: 'var(--radius-chip)',
              backgroundColor: 'var(--ink-700)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)'
            }}
            aria-label="Switch train direction"
            title="Switch train direction"
          >
            <ArrowLeftRight size={20} color={selectedLine.color} />
          </button>
        </div>

        {/* Social Presence Notice (Low-pressure social discovery) */}
        <div
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-card)',
            backgroundColor: 'var(--ink-850)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12
          }}
        >
          <Sparkles size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div className="type-caption" style={{ color: 'var(--text-secondary)' }}>
            Checking in makes your transit presence visible only to fellow commuters boarded in your carriage window. Private, safe, and expires on trip exit.
          </div>
        </div>
      </div>

      {/* ── ZONE 4: Action / The One Orchestrated 600ms Confirmation Moment ── */}
      <div
        style={{
          padding: 'var(--space-3) var(--space-3) calc(var(--space-3) + env(safe-area-inset-bottom))',
          borderTop: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-surface)'
        }}
      >
        <button
          disabled={isSubmitting || isConfirmed}
          onClick={handleConfirmCheckIn}
          className="press"
          style={{
            width: '100%',
            minHeight: 48,
            padding: '12px 24px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: isConfirmed ? 'var(--status-success)' : selectedLine.color,
            color: '#FFFFFF',
            border: 'none',
            fontSize: 16,
            lineHeight: '24px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            cursor: isSubmitting || isConfirmed ? 'default' : 'pointer',
            boxShadow: `0 6px 20px ${isConfirmed ? 'rgba(5,150,105,0.45)' : selectedLine.color + '45'}`,
            transition: 'all 600ms cubic-bezier(0, 0, 0, 1)' // 600ms orchestrated decelerate moment
          }}
        >
          {isConfirmed ? (
            <>
              <CheckCircle2 size={22} />
              <span>Checked In • Active on {selectedLine.name}</span>
            </>
          ) : isSubmitting ? (
            <>
              <span
                style={{
                  display: 'inline-block',
                  width: 18,
                  height: 18,
                  border: '2px solid #FFFFFF',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }}
              />
              <span>Connecting to Carriage...</span>
            </>
          ) : (
            <>
              <span>Check In at {selectedStation.name.split(' (')[0]}</span>
            </>
          )}
        </button>
      </div>

      {/* ── Modal Station Picker ── */}
      {isStationPickerOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 150,
            backgroundColor: 'var(--bg-canvas)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Header */}
          <div
            style={{
              paddingTop: 'calc(12px + env(safe-area-inset-top))',
              paddingBottom: 12,
              paddingLeft: 'var(--space-3)',
              paddingRight: 'var(--space-3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface)'
            }}
          >
            <div className="type-heading" style={{ color: 'var(--text-primary)' }}>
              Select Station
            </div>
            <button
              onClick={() => setIsStationPickerOpen(false)}
              className="touch-target-48 press"
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              aria-label="Close station picker"
            >
              <X size={22} />
            </button>
          </div>

          {/* Search Bar */}
          <div style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--border-subtle)' }}>
            <input
              type="text"
              placeholder="Search station or स्टेशन..."
              value={stationSearchQuery}
              onChange={e => setStationSearchQuery(e.target.value)}
              style={{
                width: '100%',
                minHeight: 48,
                padding: '0 16px',
                borderRadius: 'var(--radius-card)',
                backgroundColor: 'var(--ink-800)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                outline: 'none',
                fontSize: 16
              }}
            />
          </div>

          {/* Station List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-2)' }}>
            {filteredStations.map(st => {
              const isSelected = st.id === selectedStationId;
              return (
                <div
                  key={st.id}
                  onClick={() => {
                    triggerHaptic('light');
                    setSelectedStationId(st.id);
                    setIsStationPickerOpen(false);
                  }}
                  className="touch-target-48 press"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-card)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: isSelected ? 'var(--ink-750)' : 'transparent',
                    cursor: 'pointer'
                  }}
                >
                  <div>
                    <div className="type-body" style={{ color: isSelected ? 'var(--accent)' : 'var(--text-primary)', fontWeight: isSelected ? 700 : 500 }}>
                      {st.name}
                    </div>
                    {st.hindiName && (
                      <div className="type-caption" style={{ color: 'var(--text-secondary)' }}>
                        {st.hindiName}
                      </div>
                    )}
                  </div>
                  {isSelected && <CheckCircle2 size={18} color="var(--accent)" />}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
