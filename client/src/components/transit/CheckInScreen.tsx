import React, { useEffect, useRef, useState } from 'react';
import { CaretRightIcon, CheckCircleIcon, CheckIcon, MagnifyingGlassIcon, ArrowRightIcon, UsersThreeIcon, XIcon } from '@phosphor-icons/react';
import { DELHI_METRO_LINES, getLineById } from '../../data/metroData';
import { triggerHaptic } from '../../utils/nativeBridge';
import { lineStyle } from '../../utils/lineStyle';
import type { MetroLine, MetroStation } from '../../types';
import { terminalsAt, shortLineName } from './lineSegments';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { LinePill } from '../ui/LinePill';
import { StationSign } from '../ui/StationSign';

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
const short = (name: string) => name.split(' (')[0].trim();

/** Other lines at this station, for interchange pills. */
function interchanges(line: MetroLine, st: MetroStation): MetroLine[] {
  return (st.interchangeLines || [])
    .map(id => getLineById(id))
    .filter((l): l is MetroLine => !!l && l.id !== line.id);
}

/**
 * Check in: a three-step ticket-machine flow. Line, station, direction, then
 * one lime "Check in". The confirmed state is a station sign, and only shows
 * after the server accepted the check-in.
 */
export const CheckInScreen: React.FC<CheckInScreenProps> = ({
  onCheckIn,
  onCancel,
  initialLineId = 'blue',
  initialStationId = 'rajiv_chowk',
  initialDirection,
}) => {
  const [selectedLineId, setSelectedLineId] = useState<string>(initialLineId);
  const selectedLine = DELHI_METRO_LINES.find(l => l.id === selectedLineId) || DELHI_METRO_LINES[0];

  const [selectedStationId, setSelectedStationId] = useState<string>(
    initialStationId && selectedLine.stations.some(s => s.id === initialStationId)
      ? initialStationId
      : selectedLine.stations[0]?.id || 'rajiv_chowk'
  );
  const selectedStation = selectedLine.stations.find(s => s.id === selectedStationId) || selectedLine.stations[0];

  // 'b' = towards terminal B, 'a' = towards terminal A. The server sends
  // "Towards <terminal>", so match on terminal A's name.
  const [direction, setDirection] = useState<'a' | 'b'>(() =>
    initialDirection && initialDirection.toLowerCase().includes(selectedLine.terminalA.toLowerCase()) ? 'a' : 'b'
  );
  const terminals = terminalsAt(selectedLine, selectedStation.id);
  const destination = direction === 'a' ? terminals.a : terminals.b;

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

  const handleLineSelect = (line: MetroLine) => {
    if (line.id === selectedLineId) return;
    triggerHaptic('light');
    setSelectedLineId(line.id);
    // Keep the station when it's an interchange on the new line.
    const same = line.stations.find(s => baseName(s.name) === baseName(selectedStation.name));
    setSelectedStationId(same?.id || line.stations[0]?.id || '');
    setDirection('b');
    setError(null);
  };

  const chooseDirection = (d: 'a' | 'b') => {
    triggerHaptic('light');
    setDirection(d);
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
      await onCheckIn(selectedLine.id, selectedStation.id, `Towards ${destination}`);
      setIsConfirmed(true);
      triggerHaptic('success');
    } catch {
      setError("Couldn't check you in. Check your connection and try again.");
      triggerHaptic('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const q = stationSearchQuery.trim().toLowerCase();
  const filteredStations = q
    ? selectedLine.stations.filter(s => s.name.toLowerCase().includes(q) || (s.hindiName && s.hindiName.includes(stationSearchQuery.trim())))
    : selectedLine.stations;

  const stationLines = [selectedLine, ...interchanges(selectedLine, selectedStation)];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkin-title"
      style={{
        ...lineStyle(selectedLine),
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ width: '100%', maxWidth: 'var(--shell-max)', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <header
          style={{
            padding: 'calc(8px + var(--safe-top)) 4px 8px var(--gutter)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            minHeight: 'calc(64px + var(--safe-top))',
            boxShadow: 'inset 0 4px 0 var(--line)',
          }}
        >
          <h1 id="checkin-title" className="type-title">
            {isConfirmed ? 'Checked in' : 'Check in'}
          </h1>
          {onCancel && !isConfirmed && (
            <IconButton label="Close check-in" variant="plain" onClick={onCancel}>
              <XIcon size={24} aria-hidden="true" />
            </IconButton>
          )}
        </header>

        {isConfirmed ? (
          <div role="status" aria-live="polite" style={{ flex: 1, padding: '24px var(--gutter)', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="card" style={{ padding: 20, boxShadow: 'inset 4px 0 0 var(--line)' }}>
              <StationSign station={selectedStation} lines={stationLines} towards={destination} as="h2" />
            </div>
            <p className="type-body" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
              <CheckCircleIcon size={22} weight="fill" aria-hidden="true" style={{ color: 'var(--status-ok)', flexShrink: 0 }} />
              You're in the room for this station and direction.
            </p>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px var(--gutter) 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
            {/* 1 Line */}
            <section aria-labelledby="checkin-line-label">
              <StepLabel n={1} id="checkin-line-label">Line</StepLabel>
              <div role="radiogroup" aria-labelledby="checkin-line-label" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '0 -3px' }}>
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
                      style={{ minHeight: 48, padding: '0 3px', border: 'none', background: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}
                    >
                      <LinePill
                        line={line}
                        label={line.name.replace(/\s*\(.*\)/, '')}
                        style={{
                          height: 32, padding: '0 12px',
                          ...(isSelected
                            ? { outline: '2px solid var(--text-primary)', outlineOffset: 2 }
                            : { background: 'transparent', color: 'var(--text-secondary)', boxShadow: 'inset 0 0 0 2px var(--line)' }),
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </section>

            {/* 2 Station */}
            <section aria-labelledby="checkin-station-label">
              <StepLabel n={2} id="checkin-station-label">Station</StepLabel>
              <button
                ref={stationButtonRef}
                type="button"
                onClick={() => setIsStationPickerOpen(true)}
                aria-haspopup="dialog"
                aria-label={`Station: ${selectedStation.name}. Change station`}
                className="press"
                style={{
                  width: '100%', textAlign: 'left', cursor: 'pointer',
                  background: 'var(--bg-surface)', border: 'none', borderRadius: 'var(--radius-card)',
                  padding: '14px 12px 14px 20px', boxShadow: 'inset 4px 0 0 var(--line)',
                  display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text-primary)',
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="type-headline" style={{ display: 'block', overflowWrap: 'anywhere' }}>{selectedStation.name}</span>
                  {selectedStation.hindiName && (
                    <span lang="hi" className="type-hi type-meta" style={{ display: 'block', color: 'var(--text-muted)' }}>{selectedStation.hindiName}</span>
                  )}
                  {stationLines.length > 1 && (
                    <span style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 8 }}>
                      <span className="type-meta" style={{ color: 'var(--text-muted)', marginRight: 2 }}>Change for</span>
                      {stationLines.slice(1).map(l => <LinePill key={l.id} line={l} size="sm" />)}
                    </span>
                  )}
                </span>
                <span className="type-label" style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                  Change <CaretRightIcon size={18} aria-hidden="true" />
                </span>
              </button>
            </section>

            {/* 3 Direction */}
            <section aria-labelledby="checkin-direction-label">
              <StepLabel n={3} id="checkin-direction-label">Direction</StepLabel>
              <div role="radiogroup" aria-labelledby="checkin-direction-label" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {(['b', 'a'] as const).map(d => {
                  const isSelected = direction === d;
                  const term = d === 'a' ? terminals.a : terminals.b;
                  return (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`Towards ${term}`}
                      onClick={() => chooseDirection(d)}
                      className="press"
                      style={{
                        minHeight: 104, padding: 16, textAlign: 'left', cursor: 'pointer',
                        border: 'none', borderRadius: 'var(--radius-card)',
                        background: isSelected ? 'var(--ink)' : 'var(--bg-tonal)',
                        color: isSelected ? 'var(--ink-inverse)' : 'var(--text-primary)',
                        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12,
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <span className="type-meta" style={{ opacity: 0.8 }}>Towards</span>
                        <ArrowRightIcon size={20} aria-hidden="true" />
                      </span>
                      <span className="type-headline" style={{ overflowWrap: 'anywhere' }}>{short(term)}</span>
                    </button>
                  );
                })}
              </div>
              <p className="type-meta" style={{ color: 'var(--text-muted)', marginTop: 8 }}>
                Pick the terminal on the platform sign for your train.
              </p>
            </section>

            {/* What checking in shares: matches the privacy policy */}
            <p className="type-meta" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: 'var(--text-secondary)' }}>
              <UsersThreeIcon size={20} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
              You'll join the live room for this station and direction. Riders there see your display name, avatar, bio and interests. You leave the room about a minute after you close the app.
            </p>
          </div>
        )}

        {!isConfirmed && (
          <div style={{ padding: '12px var(--gutter) calc(12px + var(--safe-bottom))', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-base)' }}>
            {error && (
              <p role="alert" className="type-meta" style={{ color: 'var(--danger-text)', marginBottom: 8 }}>{error}</p>
            )}
            <Button type="button" size="lg" fullWidth isLoading={isSubmitting} onClick={handleConfirmCheckIn} style={{ whiteSpace: 'normal' }}>
              Check in at {short(selectedStation.name)}
            </Button>
          </div>
        )}
      </div>

      {/* Station picker: searchable list on a rail stripe */}
      {isStationPickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="station-picker-title"
          style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'var(--bg-base)', display: 'flex', flexDirection: 'column' }}
        >
          <div style={{ width: '100%', maxWidth: 'var(--shell-max)', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div
              style={{
                padding: 'calc(8px + var(--safe-top)) 4px 8px var(--gutter)',
                minHeight: 'calc(64px + var(--safe-top))',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <h2 id="station-picker-title" className="type-title">Station</h2>
                <LinePill line={selectedLine} />
              </div>
              <IconButton label="Close station list" variant="plain" onClick={closePicker}>
                <XIcon size={24} aria-hidden="true" />
              </IconButton>
            </div>

            <div style={{ padding: '0 var(--gutter) 12px', position: 'relative' }}>
              <MagnifyingGlassIcon size={20} aria-hidden="true" style={{ position: 'absolute', left: 30, top: 14, color: 'var(--text-muted)' }} />
              <input
                ref={searchRef}
                type="search"
                className="input"
                aria-label="Search stations"
                placeholder="Search in English or हिन्दी"
                value={stationSearchQuery}
                onChange={e => setStationSearchQuery(e.target.value)}
                style={{ paddingLeft: 44 }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 var(--gutter) calc(16px + var(--safe-bottom))' }}>
              {filteredStations.length === 0 ? (
                <p className="type-body" style={{ padding: '24px 4px', color: 'var(--text-secondary)' }}>
                  No {selectedLine.name} station matches "{stationSearchQuery.trim()}". It may be on another line.
                </p>
              ) : (
                <ul className="card" style={{ listStyle: 'none', padding: '4px 0' }}>
                  {filteredStations.map((st, i) => {
                    const isSelected = st.id === selectedStationId;
                    const others = interchanges(selectedLine, st);
                    const first = i === 0, last = i === filteredStations.length - 1;
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
                          style={{
                            width: '100%', minHeight: 56, padding: '0 16px 0 12px',
                            display: 'flex', alignItems: 'stretch', gap: 12, textAlign: 'left',
                            border: 'none', background: isSelected ? 'var(--bg-press)' : 'transparent',
                            color: 'var(--text-primary)', cursor: 'pointer',
                          }}
                        >
                          {/* Rail stripe with the stop's node */}
                          <span aria-hidden="true" style={{ position: 'relative', width: 20, flexShrink: 0 }}>
                            <span style={{ position: 'absolute', left: 8, width: 4, top: first && !q ? '50%' : 0, bottom: last && !q ? '50%' : 0, background: 'var(--line)', opacity: q ? 0.4 : 1 }} />
                            <span
                              style={{
                                position: 'absolute', left: isSelected ? 2 : 4, top: '50%', marginTop: isSelected ? -8 : -6,
                                width: isSelected ? 16 : 12, height: isSelected ? 16 : 12, borderRadius: '50%',
                                background: isSelected ? 'var(--line)' : 'var(--bg-surface)',
                                border: `3px solid ${isSelected ? 'var(--bg-surface)' : others.length ? 'var(--text-primary)' : 'var(--line)'}`,
                                boxShadow: isSelected ? '0 0 0 2px var(--line)' : undefined,
                              }}
                            />
                          </span>
                          <span style={{ flex: 1, minWidth: 0, alignSelf: 'center', padding: '8px 0' }}>
                            <span className="type-body" style={{ display: 'block', lineHeight: '20px', fontWeight: isSelected ? 650 : 480 }}>{st.name}</span>
                            {st.hindiName && (
                              <span lang="hi" className="type-hi type-meta" style={{ display: 'block', color: 'var(--text-muted)' }}>{st.hindiName}</span>
                            )}
                          </span>
                          {others.length > 0 && (
                            <span style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4, alignSelf: 'center', maxWidth: 120 }}>
                              {others.map(l => <LinePill key={l.id} line={l} label={shortLineName(l)} size="sm" />)}
                            </span>
                          )}
                          {isSelected && <CheckIcon size={20} weight="bold" aria-hidden="true" style={{ alignSelf: 'center', flexShrink: 0 }} />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function StepLabel({ n, id, children }: { n: number; id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      <span
        aria-hidden="true"
        className="tnum"
        style={{
          width: 24, height: 24, borderRadius: 'var(--radius-squircle)', flexShrink: 0,
          background: 'var(--ink)', color: 'var(--ink-inverse)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 650,
        }}
      >
        {n}
      </span>
      <span className="type-label" style={{ color: 'var(--text-primary)' }}>{children}</span>
    </h2>
  );
}
