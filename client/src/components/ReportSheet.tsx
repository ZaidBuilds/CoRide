import { useState } from 'react';
import { CheckIcon, CheckCircleIcon } from '@phosphor-icons/react';
import type { RoomPresenceTraveler } from '../types';
import { authHeaders } from '../utils/auth';
import { triggerHaptic } from '../utils/nativeBridge';
import { API } from '../config';
import { Sheet } from './ui/Sheet';
import { Button } from './ui/Button';

// Values must match the server's REPORT_CATEGORIES exactly.
const CATEGORIES: { value: string; label: string; hint: string }[] = [
  { value: 'harassment', label: 'Harassment or bullying', hint: 'Threats, insults, unwanted advances' },
  { value: 'inappropriate', label: 'Inappropriate content', hint: 'Sexual, hateful or violent messages' },
  { value: 'spam', label: 'Spam or scam', hint: 'Selling, promotions, suspicious links' },
  { value: 'impersonation', label: 'Pretending to be someone', hint: 'Fake identity or someone you know' },
  { value: 'other', label: 'Something else', hint: 'Tell us in the note below' },
];

const NOTE_MAX = 280;

interface Props {
  open: boolean;
  traveler: RoomPresenceTraveler | null;
  currentUserId: string | undefined;
  onClose: () => void;
  /** Called with the server's confirmation message once the user dismisses the confirmation. */
  onReported: (message: string) => void;
  /** Called if the reporter also chose to block: lets the parent hide that person immediately. */
  onBlocked?: (targetId: string) => void;
}

type Step = 'form' | 'done';

/**
 * Report flow in a bottom sheet: reason, optional note, optional block, then a
 * confirmation. POSTs /api/reports (and /api/blocks when asked) itself.
 */
export function ReportSheet({ open, traveler, currentUserId, onClose, onReported, onBlocked }: Props) {
  const [category, setCategory] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('form');
  const [doneMessage, setDoneMessage] = useState('');
  const [blockResult, setBlockResult] = useState<'none' | 'blocked' | 'failed'>('none');

  // Fresh form for each person reported (the sheet stays mounted between uses).
  const [formFor, setFormFor] = useState<string | undefined>(traveler?.id);
  if (traveler?.id !== formFor) {
    setFormFor(traveler?.id);
    setCategory(null);
    setNote('');
    setAlsoBlock(false);
    setError(null);
    setStep('form');
    setBlockResult('none');
  }

  const name = traveler ? (traveler.pseudonym || traveler.username.replace(/^@/, '')) : '';

  const reset = () => {
    setCategory(null);
    setNote('');
    setAlsoBlock(false);
    setError(null);
    setStep('form');
    setBlockResult('none');
  };

  const close = () => {
    if (submitting) return;
    // Dismissing the confirmation (button, swipe or Escape) still counts as reported.
    if (step === 'done') onReported(doneMessage);
    else onClose();
    reset();
  };

  const submit = async () => {
    if (!category || !traveler || submitting) return;
    if (!currentUserId) {
      setError('You need to be signed in to report. Restart CoRide and try again.');
      return;
    }
    setSubmitting(true);
    setError(null);
    triggerHaptic('medium');
    try {
      const res = await fetch(`${API}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ targetId: traveler.id, category, note: note.trim() || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Couldn't send your report (error ${res.status}).`);

      let blocked: 'none' | 'blocked' | 'failed' = 'none';
      if (alsoBlock) {
        try {
          const b = await fetch(`${API}/api/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ targetId: traveler.id }),
          });
          blocked = b.ok ? 'blocked' : 'failed';
        } catch {
          blocked = 'failed';
        }
        if (blocked === 'blocked') onBlocked?.(traveler.id);
      }

      triggerHaptic('success');
      setBlockResult(blocked);
      setDoneMessage(blocked === 'blocked' ? `Reported and blocked ${name}.` : (body.message || 'Report sent. Thank you.'));
      setStep('done');
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "No connection. Your report wasn't sent. Try again when you're back online."
          : err instanceof Error ? err.message : "Couldn't send your report."
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'done') {
    return (
      <Sheet open={open} onClose={close} ariaLabel="Report sent" key="report-sheet">
        <div role="status" aria-live="polite">
          <span
            aria-hidden="true"
            style={{ width: 48, height: 48, borderRadius: 'var(--radius-squircle)', background: 'var(--success-container)', color: 'var(--success-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <CheckCircleIcon size={26} weight="fill" />
          </span>
          <h2 className="sheet-title" style={{ marginTop: 16 }}>Thanks for telling us</h2>
          <p className="type-body" style={{ color: 'var(--text-secondary)' }}>
            The CoRide team reviews every report. {name} won't know it was you.
          </p>
          {blockResult === 'blocked' && (
            <p className="type-body" style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
              You've also blocked {name}. You won't see each other in rooms and they can't message you.
            </p>
          )}
          {blockResult === 'failed' && (
            <p role="alert" className="type-body" style={{ color: 'var(--danger-text)', marginTop: 8 }}>
              We couldn't block {name} just now. Open their profile and choose Block to try again.
            </p>
          )}
          <p className="type-meta" style={{ color: 'var(--text-muted)', margin: '12px 0 20px' }}>
            If you feel unsafe right now, call 112 or tell metro staff.
          </p>
          <Button type="button" variant="secondary" fullWidth onClick={close}>Done</Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={close} title={`Report ${name}`} key="report-sheet">
      <p className="type-meta" style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
        Your report is private. {name} won't be told who sent it.
      </p>

      <div id="report-reason-label" className="field-label">What's going on?</div>
      <div className="list-group" role="radiogroup" aria-labelledby="report-reason-label" style={{ background: 'var(--bg-sunken)' }}>
        {CATEGORIES.map(c => {
          const selected = c.value === category;
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className="list-row"
              onClick={() => { triggerHaptic('light'); setCategory(c.value); setError(null); }}
              style={{ cursor: 'pointer' }}
            >
              <span className="row-text">
                <span className="row-title">{c.label}</span>
                <span className="row-sub">{c.hint}</span>
              </span>
              <span
                aria-hidden="true"
                style={{
                  width: 24, height: 24, flexShrink: 0, borderRadius: '50%',
                  border: `2px solid ${selected ? 'var(--ink)' : 'var(--border-strong)'}`,
                  background: selected ? 'var(--ink)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-inverse)',
                }}
              >
                {selected && <CheckIcon size={14} weight="bold" />}
              </span>
            </button>
          );
        })}
      </div>

      <label htmlFor="report-note" className="field-label">
        Add details <span style={{ fontWeight: 480, color: 'var(--text-muted)' }}>({category === 'other' ? 'recommended' : 'optional'})</span>
      </label>
      <textarea
        id="report-note"
        className="input"
        value={note}
        onChange={e => setNote(e.target.value)}
        rows={3}
        maxLength={NOTE_MAX}
        placeholder="What happened? Where and when?"
        aria-describedby="report-note-count"
        style={{ resize: 'none', fontFamily: 'inherit' }}
      />
      <div id="report-note-count" className="type-meta tnum" style={{ color: 'var(--text-muted)', textAlign: 'right', marginTop: 4 }}>
        {note.length}/{NOTE_MAX}
      </div>

      <label className="list-group" style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, padding: '12px 16px', margin: '12px 0 0', cursor: 'pointer', background: 'var(--bg-sunken)' }}>
        <input
          type="checkbox"
          checked={alsoBlock}
          onChange={e => setAlsoBlock(e.target.checked)}
          style={{ width: 22, height: 22, accentColor: 'var(--danger-fill)', flexShrink: 0 }}
        />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="type-label" style={{ display: 'block', color: 'var(--text-primary)' }}>Also block {name}</span>
          <span className="type-meta" style={{ display: 'block', color: 'var(--text-muted)' }}>You'll stop seeing each other and they can't message you</span>
        </span>
      </label>

      {error && (
        <p role="alert" className="type-meta" style={{ color: 'var(--danger-text)', marginTop: 12 }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        <Button type="button" variant="tonal" style={{ flex: 1 }} onClick={close} disabled={submitting}>
          Cancel
        </Button>
        <Button type="button" variant="danger" style={{ flex: 1 }} disabled={!category} isLoading={submitting} onClick={submit}>
          Send report
        </Button>
      </div>
    </Sheet>
  );
}
