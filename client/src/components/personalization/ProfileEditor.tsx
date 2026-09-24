import { useEffect, useRef, useState } from 'react';
import { X, Check } from 'lucide-react';
import type { UserProfile } from '../../types';
import { INTEREST_TAXONOMY } from '../../types';
import { authHeaders } from '../../utils/auth';
import { triggerHaptic } from '../../utils/nativeBridge';
import { API } from '../../config';


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

const inputStyle: React.CSSProperties = {
  marginTop: 6,
  width: '100%',
  minHeight: 48,
  padding: '10px 14px',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)',
  fontSize: 16,
  fontFamily: 'inherit'
};

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' };
const helpStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontWeight: 400 };

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
            ? 'We couldn’t confirm this is your profile. Restart CoRide and try again.'
            : j.error || `Couldn’t save (error ${r.status}). Your changes are still here.`
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
      setError('No connection. Your changes weren’t saved — try again when you’re back online.');
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
        className="drawer-panel animate-slide-up"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 520, maxHeight: '92dvh', overflowY: 'auto', padding: 0, position: 'relative', outline: 'none' }}
      >
        {/* Header */}
        <div
          style={{
            position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 8px 8px 20px', background: 'var(--bg-surface-raised)', borderBottom: '1px solid var(--border-subtle)'
          }}
        >
          <h2 id="profile-editor-title" style={{ flex: 1, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Edit profile
          </h2>
          <button type="button" onClick={onClose} aria-label="Close without saving" className="icon-btn" style={{ background: 'transparent', border: 'none' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p style={{ fontSize: 13, lineHeight: '18px', color: 'var(--text-muted)', margin: 0 }}>
            Riders in your station room can see everything on this page. Don’t add your real name, phone number or social handles.
          </p>

          <label style={labelStyle}>
            Display name
            <input
              value={pseudonym}
              onChange={e => setPseudonym(e.target.value)}
              maxLength={NAME_MAX}
              autoComplete="off"
              aria-invalid={Boolean(nameError)}
              aria-describedby="pe-name-help"
              style={{ ...inputStyle, borderColor: nameError ? 'var(--status-danger)' : 'var(--border-subtle)' }}
            />
            <span id="pe-name-help" style={helpStyle}>
              <span style={{ color: nameError ? 'var(--accent-rose-text)' : undefined }}>{nameError || 'Your pseudonym on CoRide'}</span>
              <span>{pseudonym.length}/{NAME_MAX}</span>
            </span>
          </label>

          <label style={labelStyle}>
            Tagline <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
            <input value={vibe} onChange={e => setVibe(e.target.value)} maxLength={30} placeholder="e.g. Chai, code and cricket" style={inputStyle} />
            <span style={helpStyle}><span /><span>{vibe.length}/30</span></span>
          </label>

          <label style={labelStyle}>
            Bio <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={BIO_MAX}
              rows={3}
              placeholder="e.g. BCA student, loves metro photowalks"
              style={{ ...inputStyle, resize: 'none' }}
            />
            <span style={helpStyle}><span /><span>{bio.length}/{BIO_MAX}</span></span>
          </label>

          <label style={labelStyle}>
            College or workplace tag <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
            <input value={college} onChange={e => setCollege(e.target.value)} maxLength={30} placeholder="e.g. DU North Campus" style={inputStyle} />
          </label>

          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span>Interests</span>
              <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{tags.length}/{TAG_MAX}</span>
            </legend>
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {INTEREST_TAXONOMY.map(t => {
                const active = tags.includes(t.id);
                const disabled = !active && tags.length >= TAG_MAX;
                return (
                  <Chip key={t.id} active={active} disabled={disabled} onClick={() => toggleTag(t.id)}>
                    <span aria-hidden="true">{t.emoji}</span> {t.label}
                  </Chip>
                );
              })}
            </div>
            {tags.length >= TAG_MAX && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0' }}>You’ve picked {TAG_MAX}. Remove one to choose another.</p>
            )}
          </fieldset>

          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span>Languages you speak</span>
              <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{langs.length}/{LANG_MAX}</span>
            </legend>
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {languageOptions.map(l => {
                const active = langs.includes(l.code);
                return (
                  <Chip key={l.code} active={active} disabled={!active && langs.length >= LANG_MAX} onClick={() => toggleLang(l.code)}>
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
            background: 'var(--bg-surface-raised)', borderTop: '1px solid var(--border-subtle)'
          }}
        >
          {error && (
            <div role="alert" style={{ fontSize: 13, lineHeight: '18px', color: 'var(--accent-rose-text)', marginBottom: 8 }}>{error}</div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onClose} className="pill-button secondary" style={{ flex: 1 }}>Cancel</button>
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty || Boolean(nameError)}
              aria-busy={saving}
              className="pill-button primary"
              style={{ flex: 1, opacity: saving || !dirty || nameError ? 0.5 : 1 }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function Chip({ active, disabled, onClick, children }: { active: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      style={{
        minHeight: 40,
        padding: '0 14px',
        borderRadius: 'var(--radius-sm)',
        fontSize: 13,
        fontWeight: 600,
        background: active ? 'var(--accent)' : 'transparent',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-strong)'}`,
        color: active ? 'var(--text-on-accent)' : 'var(--text-secondary)',
        opacity: disabled ? 0.45 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        cursor: disabled ? 'not-allowed' : 'pointer'
      }}
    >
      {active && <Check size={14} aria-hidden="true" />}
      {children}
    </button>
  );
}
