import { useState } from 'react';
import { Check } from 'lucide-react';
import { ProfileSheet } from './ProfileSheet';
import type { RoomPresenceTraveler } from '../types';
import { authHeaders } from '../utils/auth';
import { API } from '../config';


// Values must match the server's REPORT_CATEGORIES exactly.
const CATEGORIES: { value: string; label: string }[] = [
  { value: 'spam', label: 'Spam or scam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'other', label: 'Something else' }
];

interface Props {
  open: boolean;
  traveler: RoomPresenceTraveler | null;
  currentUserId: string | undefined;
  onClose: () => void;
  /** Called with the server's confirmation message on success. */
  onReported: (message: string) => void;
}

/**
 * Report flow in a bottom sheet: category picker, optional note, confirm.
 * POSTs /api/reports itself and hands the confirmation message back for a toast.
 */
export function ReportSheet({ open, traveler, currentUserId, onClose, onReported }: Props) {
  const [category, setCategory] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = traveler ? (traveler.pseudonym || traveler.username.replace(/^@/, '')) : '';

  const submit = async () => {
    if (!category || !traveler || !currentUserId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ targetId: traveler.id, category, note: note.trim() || undefined })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Could not submit (${res.status})`);
      }
      const body = await res.json().catch(() => ({}));
      // Reset for next time before we unmount.
      setCategory(null);
      setNote('');
      onReported(body.message || 'Report submitted.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ProfileSheet open={open} onClose={onClose} labelledBy="report-sheet-title">
      <h2 id="report-sheet-title" className="display" style={{ fontSize: 20, margin: '0 0 4px', color: 'var(--text-primary)' }}>
        Report {name}
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px' }}>
        This is private — {name} won't be told.
      </p>

      <div className="list-group" role="radiogroup" aria-label="Reason for report">
        {CATEGORIES.map(c => {
          const selected = c.value === category;
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className="list-row"
              onClick={() => setCategory(c.value)}
            >
              <span className="row-text"><span className="row-title">{c.label}</span></span>
              {selected && <Check size={16} style={{ color: 'var(--accent-purple-text)', flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>

      <label htmlFor="report-note" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', margin: '4px 0 6px' }}>
        Add a note <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
      </label>
      <textarea
        id="report-note"
        value={note}
        onChange={e => setNote(e.target.value)}
        rows={3}
        maxLength={280}
        placeholder="What happened?"
        style={{
          width: '100%', resize: 'none', padding: '10px 14px', borderRadius: 'var(--radius-md)',
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)', fontSize: 16, fontFamily: 'inherit'
        }}
      />

      {error && (
        <div role="alert" style={{ fontSize: 12, color: 'var(--accent-rose-text)', marginTop: 8 }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button type="button" className="pill-button secondary" style={{ flex: 1 }} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="pill-button primary"
          style={{ flex: 1 }}
          disabled={!category || submitting}
          onClick={submit}
        >
          {submitting ? 'Submitting…' : 'Submit report'}
        </button>
      </div>
    </ProfileSheet>
  );
}
