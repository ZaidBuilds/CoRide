import { useEffect, useRef, useState } from 'react';
import { XIcon, CheckIcon } from '@phosphor-icons/react';
import type { UserProfile } from '../../types';
import { INTEREST_TAXONOMY } from '../../types';
import { authHeaders } from '../../utils/auth';
import { triggerHaptic } from '../../utils/nativeBridge';
import { API } from '../../config';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { Chip } from '../ui/Chip';


interface Props {
  user: UserProfile;
  onClose: () => void;
  onSaved: (p: UserProfile) => void;
}

// Limits mirror PATCH /api/profile/:userId — the server silently ignores a
// pseudonym outside 2–20 chars, so we must validate here or the edit is lost.
const NAME_MIN = 2;
const NAME_MAX = 20;
const BIO_MAX = 120;
const TAG_MAX = 5;
const LANG_MAX = 3;

const LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'ur', label: 'Urdu' },
  { code: 'bn', label: 'Bengali' },
  { code: 'mr', label: 'Marathi' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'or', label: 'Odia' }
];


export const ProfileEditor: React.FC<Props> = ({ user, onClose, onSaved }) => {
  const [pseudonym, setPseudonym] = useState(user.pseudonym || '');
  const [bio, setBio] = useState(user.bio || '');
  const [college, setCollege] = useState(user.collegeOrTag || '');
  const [vibe, setVibe] = useState(user.vibeTagline || '');
  const [tags, setTags] = useState<string[]>(user.interestTags || []);
  const [langs, setLangs] = useState<string[]>(user.languages?.length ? user.languages : ['en']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // App re-renders often (socket events) and passes a fresh onClose each time;
  // read it through a ref so the mount effect never re-runs and steals focus.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const trimmedName = pseudonym.trim();
  const nameError = trimmedName.length < NAME_MIN
    ? `Use at least ${NAME_MIN} characters.`
    : null;

  const dirty =
    trimmedName !== (user.pseudonym || '') ||
    bio.trim() !== (user.bio || '') ||
    college.trim() !== (user.collegeOrTag || '') ||
    vibe.trim() !== (user.vibeTagline || '') ||
    tags.join(',') !== (user.interestTags || []).join(',') ||
    langs.join(',') !== (user.languages?.length ? user.languages : ['en']).join(',');

  const toggleTag = (id: string) => {
    triggerHaptic('light');
    setTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : prev.length < TAG_MAX ? [...prev, id] : prev);
  };

  const toggleLang = (code: string) => {
    triggerHaptic('light');
    setLangs(prev => prev.includes(code) ? prev.filter(l => l !== code) : prev.length < LANG_MAX ? [...prev, code] : prev);
  };

  // Keep any language code the server already has, even if it's not in our list.
  const languageOptions = [
    ...LANGUAGES,
    ...langs.filter(c => !LANGUAGES.some(l => l.code === c)).map(c => ({ code: c, label: c.toUpperCase() }))
  ];

  const save = async () => {
    if (nameError || saving) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/profile/${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          pseudonym: trimmedName,
          bio: bio.trim(),
          collegeOrTag: college.trim(),
          interestTags: tags,
          languages: langs,
          vibeTagline: vibe.trim()
        })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.profile) {
        setError(
          r.status === 401 || r.status === 403
            ? "We couldn't confirm this is your profile. Restart CoRide and try again."
            : j.error || `Couldn't save (error ${r.status}). Your changes are still here.`
        );
        setSaving(false);
        return;
      }
      try {
        const stored = localStorage.getItem('coride_profile');
        if (stored && JSON.parse(stored).id === j.profile.id) {
          localStorage.setItem('coride_profile', JSON.stringify(j.profile));
        }
      } catch { /* storage unavailable — server copy is the source of truth */ }
      triggerHaptic('success');
      onSaved(j.profile);
      onClose();
    } catch {
      setError("No connection. Your changes weren't saved. Try again when you're back online.");
      setSaving(false);
    }
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-editor-title"
        tabIndex={-1}
        className="drawer-panel"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 'var(--shell-max)', maxHeight: '92dvh', overflowY: 'auto', padding: 0, position: 'relative', outline: 'none' }}
      >
        {/* Header */}
        <div
          style={{
            position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 8px 8px 20px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <h2 id="profile-editor-title" className="type-title" style={{ flex: 1, color: 'var(--text-primary)' }}>
            Edit profile
          </h2>
          <IconButton label="Close without saving" variant="plain" onClick={onClose}>
            <XIcon size={24} aria-hidden="true" />
          </IconButton>
        </div>

        <div style={{ padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <p className="type-meta" style={{ color: 'var(--text-secondary)' }}>
            Riders in your station room see everything here. Leave out your real name, phone number and social handles.
          </p>

          <Field id="pe-name" label="Display name" count={`${pseudonym.length}/${NAME_MAX}`} error={nameError} help="Your pseudonym on CoRide">
            <input
              id="pe-name"
              className="input"
              value={pseudonym}
              onChange={e => setPseudonym(e.target.value)}
              maxLength={NAME_MAX}
              autoComplete="off"
              aria-invalid={Boolean(nameError)}
              aria-describedby="pe-name-help"
              style={nameError ? { borderColor: 'var(--status-danger)' } : undefined}
            />
          </Field>

          <Field id="pe-vibe" label="Tagline" optional count={`${vibe.length}/30`}>
            <input id="pe-vibe" className="input" value={vibe} onChange={e => setVibe(e.target.value)} maxLength={30} placeholder="Chai, code and cricket" aria-describedby="pe-vibe-help" />
          </Field>

          <Field id="pe-bio" label="Bio" optional count={`${bio.length}/${BIO_MAX}`}>
            <textarea
              id="pe-bio"
              className="input"
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={BIO_MAX}
              rows={3}
              placeholder="BCA student, loves metro photowalks"
              aria-describedby="pe-bio-help"
              style={{ resize: 'none', fontFamily: 'inherit' }}
            />
          </Field>

          <Field id="pe-college" label="College or workplace" optional>
            <input id="pe-college" className="input" value={college} onChange={e => setCollege(e.target.value)} maxLength={30} placeholder="DU North Campus" />
          </Field>

          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="field-label" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span>Interests</span>
              <span className="tnum" style={{ fontWeight: 480, color: 'var(--text-muted)' }}>{tags.length}/{TAG_MAX}</span>
            </legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {INTEREST_TAXONOMY.map(t => {
                const active = tags.includes(t.id);
                return (
                  <Chip
                    key={t.id}
                    selected={active}
                    disabled={!active && tags.length >= TAG_MAX}
                    icon={active ? <CheckIcon size={16} weight="bold" /> : undefined}
                    onClick={() => toggleTag(t.id)}
                  >
                    {t.label}
                  </Chip>
                );
              })}
            </div>
            {tags.length >= TAG_MAX && (
              <p className="type-meta" style={{ color: 'var(--text-muted)', marginTop: 8 }}>You've picked {TAG_MAX}. Remove one to choose another.</p>
            )}
          </fieldset>

          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend className="field-label" style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span>Languages you speak</span>
              <span className="tnum" style={{ fontWeight: 480, color: 'var(--text-muted)' }}>{langs.length}/{LANG_MAX}</span>
            </legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {languageOptions.map(l => {
                const active = langs.includes(l.code);
                return (
                  <Chip
                    key={l.code}
                    selected={active}
                    disabled={!active && langs.length >= LANG_MAX}
                    icon={active ? <CheckIcon size={16} weight="bold" /> : undefined}
                    onClick={() => toggleLang(l.code)}
                  >
                    {l.label}
                  </Chip>
                );
              })}
            </div>
          </fieldset>
        </div>

        {/* Action bar */}
        <div
          style={{
            position: 'sticky', bottom: 0, padding: '12px 20px calc(12px + var(--safe-bottom))',
            background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)',
          }}
        >
          {error && (
            <p role="alert" className="type-meta" style={{ color: 'var(--danger-text)', marginBottom: 8 }}>{error}</p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="button" variant="tonal" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
            <Button type="button" onClick={save} disabled={!dirty || Boolean(nameError)} isLoading={saving} style={{ flex: 1 }}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Label above, control, then help or error text below with an optional counter. */
function Field({ id, label, optional, help, error, count, children }: {
  id: string;
  label: string;
  optional?: boolean;
  help?: string;
  error?: string | null;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}{optional && <span style={{ fontWeight: 480, color: 'var(--text-muted)' }}> (optional)</span>}
      </label>
      {children}
      {(help || error || count) && (
        <div id={`${id}-help`} className="type-meta" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 6, color: 'var(--text-muted)' }}>
          <span style={{ color: error ? 'var(--danger-text)' : undefined }}>{error || help}</span>
          {count && <span className="tnum">{count}</span>}
        </div>
      )}
    </div>
  );
}
