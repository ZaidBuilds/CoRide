import { useState } from 'react';
import { Check, CheckCircle2 } from 'lucide-react';
import { ProfileSheet } from './ProfileSheet';
import type { RoomPresenceTraveler } from '../types';
import { authHeaders } from '../utils/auth';
import { triggerHaptic } from '../utils/nativeBridge';
import { API } from '../config';


// Values must match the server's REPORT_CATEGORIES exactly.
const CATEGORIES: { value: string; label: string; hint: string }[] = [
  { value: 'harassment', label: 'Harassment or bullying', hint: 'Threats, insults, unwanted advances' },
  { value: 'inappropriate', label: 'Inappropriate content', hint: 'Sexual, hateful or violent messages' },
  { value: 'spam', label: 'Spam or scam', hint: 'Selling, promotions, suspicious links' },
  { value: 'impersonation', label: 'Pretending to be someone', hint: 'Fake identity or someone you know' },
  { value: 'other', label: 'Something else', hint: 'Tell us in the note below' }
];

const NOTE_MAX = 280;

interface Props {
  open: boolean;
  traveler: RoomPresenceTraveler | null;
  currentUserId: string | undefined;
  onClose: () => void;
  /** Called with the server's confirmation message once the user dismisses the confirmation. */
  onReported: (message: string) => void;
  /** Called if the reporter also chose to block — lets the parent hide that person immediately. */
  onBlocked?: (targetId: string) => void;
}

type Step = 'form' | 'done';

/**
 * Report flow in a bottom sheet: reason → optional note → optional block →
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
        body: JSON.stringify({ targetId: traveler.id, category, note: note.trim() || undefined })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || `Couldn’t send your report (error ${res.status}).`);

      let blocked: 'none' | 'blocked' | 'failed' = 'none';
      if (alsoBlock) {
        try {
          const b = await fetch(`${API}/api/blocks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ targetId: traveler.id })
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
          ? 'No connection. Your report wasn’t sent — try again when you’re back online.'
          : err instanceof Error ? err.message : 'Couldn’t send your report.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProfileSheet open={open} onClose={close} labelledBy="report-sheet-title">
      {step === 'done' ? (
        <div role="status" aria-live="polite" style={{ textAlign: 'center', padding: '8px 0 4px' }}>
          <CheckCircle2 size={40} aria-hidden="true" style={{ color: 'var(--status-success)' }} />
          <h2 id="report-sheet-title" className="display" style={{ fontSize: 20, margin: '12px 0 4px', color: 'var(--text-primary)' }}>
            Thanks for telling us
          </h2>
          <p style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
            The CoRide team reviews every report. {name} won’t know it was you.
          </p>
          {blockResult === 'blocked' && (
            <p style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
              You’ve also blocked {name}. You won’t see each other in rooms and they can’t message you.
            </p>
          )}
          {blockResult === 'failed' && (
            <p role="alert" style={{ fontSize: 14, lineHeight: '20px', color: 'var(--accent-rose-text)', margin: '0 0 12px' }}>
              We couldn’t block {name} just now. Open their profile and choose Block to try again.
            </p>
          )}
          <p style={{ fontSize: 13, lineHeight: '18px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
            If you feel unsafe right now, call 112 or tell metro staff.
          </p>
          <button type="button" className="pill-button primary" style={{ width: '100%' }} onClick={close}>
            Done
          </button>
        </div>
      ) : (
        <>
          <h2 id="report-sheet-title" className="display" style={{ fontSize: 20, margin: '0 0 4px', color: 'var(--text-primary)' }}>
            Report {name}
          </h2>
          <p style={{ fontSize: 13, lineHeight: '18px', color: 'var(--text-muted)', margin: '0 0 16px' }}>
            Your report is private — {name} won’t be told who sent it.
          </p>

          <div id="report-reason-label" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 6px' }}>
            What’s going on?
          </div>
          <div className="list-group" role="radiogroup" aria-labelledby="report-reason-label" style={{ marginBottom: 16 }}>
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
                      width: 22, height: 22, flexShrink: 0, borderRadius: '50%',
                      border: `2px solid ${selected ? 'var(--accent)' : 'var(--border-strong)'}`,
                      background: selected ? 'var(--accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-on-accent)'
                    }}
                  >
                    {selected && <Check size={14} strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>

          <label htmlFor="report-note" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: '0 0 6px' }}>
            Add details <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({category === 'other' ? 'recommended' : 'optional'})</span>
          </label>
          <textarea
            id="report-note"
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            maxLength={NOTE_MAX}
            placeholder="What happened? Where and when?"
            aria-describedby="report-note-count"
            style={{
              width: '100%', resize: 'none', padding: '10px 14px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)', fontSize: 16, fontFamily: 'inherit'
            }}
          />
          <div id="report-note-count" style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', marginTop: 2 }}>
            {note.length}/{NOTE_MAX}
          </div>

          <label
            style={{
              display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, marginTop: 8,
              padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-card)',
              border: '1px solid var(--border-card)', cursor: 'pointer'
            }}
          >
            <input
              type="checkbox"
              checked={alsoBlock}
              onChange={e => setAlsoBlock(e.target.checked)}
              style={{ width: 20, height: 20, accentColor: 'var(--status-danger)', flexShrink: 0 }}
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Also block {name}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>You’ll stop seeing each other and they can’t message you</span>
            </span>
          </label>

          {error && (
            <div role="alert" style={{ fontSize: 13, lineHeight: '18px', color: 'var(--accent-rose-text)', marginTop: 12 }}>{error}</div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button type="button" className="pill-button secondary" style={{ flex: 1 }} onClick={close} disabled={submitting}>
              Cancel
            </button>
            <button
              type="button"
              className="pill-button danger"
              style={{ flex: 1, opacity: !category || submitting ? 0.5 : 1 }}
              disabled={!category || submitting}
              aria-busy={submitting}
              onClick={submit}
            >
              {submitting ? 'Sending…' : 'Send report'}
            </button>
          </div>
        </>
      )}
    </ProfileSheet>
  );
}
