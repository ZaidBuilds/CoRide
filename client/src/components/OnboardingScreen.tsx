import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Users, EyeOff, ShieldCheck, ExternalLink, ChevronDown } from 'lucide-react';
import type { UserProfile } from '../types';
import { INTEREST_TAXONOMY } from '../types';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { PermissionPrimer } from './onboarding/PermissionPrimer';
import { ONBOARDING_KEYS } from './onboarding/keys';
import { pushBackHandler, triggerHaptic } from '../utils/nativeBridge';
import { authHeaders } from '../utils/auth';
import { API } from '../config';

/**
 * First-run flow. Short and honest — three steps at most, and App.tsx only
 * passes the ones this user still needs:
 *
 *   welcome   what CoRide is + 18+ confirmation + community rules / privacy (required)
 *   profile   pseudonym + 3–5 interests (skippable)
 *   location  prominent disclosure BEFORE the OS prompt; manual station is a
 *             first-class alternative (Play policy)
 *
 * Consent is recorded in localStorage (ONBOARDING_KEYS) so it is asked once.
 */
export type OnboardingStep = 'welcome' | 'profile' | 'location';
export type LocationChoice = 'granted' | 'denied' | 'manual' | 'unchanged';


interface Props {
  user: UserProfile;
  steps: OnboardingStep[];
  onFinish: (result: { profile: UserProfile; location: LocationChoice }) => void;
}

const MIN_TAGS = 3;
const MAX_TAGS = 5;

function store(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* private mode */ }
}

export const OnboardingScreen: React.FC<Props> = ({ user, steps, onFinish }) => {
  const [index, setIndex] = useState(0);
  const step = steps[index];

  // welcome
  const [isAdult, setIsAdult] = useState(false);
  const [acceptsRules, setAcceptsRules] = useState(false);
  // profile
  const [pseudonym, setPseudonym] = useState(user.pseudonym || '');
  const [tags, setTags] = useState<string[]>(user.interestTags || []);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const profileRef = useRef<UserProfile>(user);
  // location
  const [locating, setLocating] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);

  const headingRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Move focus + scroll to the top of each new step (screen readers announce it).
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [index]);

  // Android back steps backwards inside the flow; at the first step it falls
  // through (app minimises) rather than skipping required consent.
  useEffect(() => pushBackHandler(() => {
    if (index > 0) { setIndex(i => i - 1); return true; }
    return false;
  }), [index]);

  const finish = (location: LocationChoice) => {
    store(ONBOARDING_KEYS.onboarded, '1');
    onFinish({ profile: profileRef.current, location });
  };

  const next = () => {
    void triggerHaptic('medium');
    if (index < steps.length - 1) setIndex(index + 1);
    else finish('unchanged');
  };

  // ── Step handlers ──
  const acceptWelcome = () => {
    store(ONBOARDING_KEYS.termsAcceptedAt, new Date().toISOString());
    store(ONBOARDING_KEYS.ageConfirmed, '1');
    next();
  };

  const trimmed = pseudonym.trim();
  const nameValid = trimmed.length >= 2 && trimmed.length <= 20;

  const saveProfile = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`${API}/api/profile/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ pseudonym: trimmed, interestTags: tags }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      profileRef.current = data.profile ?? { ...user, pseudonym: trimmed, interestTags: tags };
      try { localStorage.setItem('coride_profile', JSON.stringify(profileRef.current)); } catch { /* ignore */ }
      next();
    } catch {
      setSaveError("Couldn't save your profile. Check your connection and try again, or skip for now.");
    } finally {
      setSaving(false);
    }
  };

  const toggleTag = (id: string) => {
    void triggerHaptic('light');
    setTags(prev => (prev.includes(id) ? prev.filter(t => t !== id) : prev.length < MAX_TAGS ? [...prev, id] : prev));
  };

  const requestLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationDenied(true);
      return;
    }
    setLocating(true);
    // This call is what triggers the OS permission dialog.
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocating(false);
        store(ONBOARDING_KEYS.locationChoice, 'granted');
        finish('granted');
      },
      err => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          store(ONBOARDING_KEYS.locationChoice, 'denied');
          setLocationDenied(true);
        } else {
          // Permission granted but no fix yet (indoors/underground) — that's fine,
          // the app keeps watching while open.
          store(ONBOARDING_KEYS.locationChoice, 'granted');
          finish('granted');
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  const chooseManually = () => {
    store(ONBOARDING_KEYS.locationChoice, locationDenied ? 'denied' : 'manual');
    finish(locationDenied ? 'denied' : 'manual');
  };

  // ── Footer (sticky, thumb reach) per step ──
  let footer: React.ReactNode = null;
  if (step === 'welcome') {
    footer = (
      <Button type="button" fullWidth size="lg" disabled={!isAdult || !acceptsRules} onClick={acceptWelcome} iconEnd={<ArrowRight size={18} aria-hidden="true" />}>
        Agree and continue
      </Button>
    );
  } else if (step === 'profile') {
    footer = (
      <>
        <Button
          type="button"
          fullWidth
          size="lg"
          disabled={!nameValid || tags.length < MIN_TAGS}
          isLoading={saving}
          onClick={saveProfile}
          iconEnd={<ArrowRight size={18} aria-hidden="true" />}
        >
          {tags.length < MIN_TAGS ? `Pick ${MIN_TAGS - tags.length} more` : 'Continue'}
        </Button>
        <Button type="button" variant="ghost" fullWidth onClick={next}>Skip for now</Button>
      </>
    );
  } else if (step === 'location') {
    footer = locationDenied ? (
      <Button type="button" fullWidth size="lg" onClick={chooseManually}>Choose my station</Button>
    ) : (
      <>
        <Button type="button" fullWidth size="lg" isLoading={locating} onClick={requestLocation}>Allow location</Button>
        <Button type="button" variant="ghost" fullWidth onClick={chooseManually}>Not now — I'll pick my station</Button>
      </>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to CoRide"
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        background: 'var(--bg-base)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Top bar: back + progress */}
      <div style={{ padding: 'calc(8px + var(--safe-top)) var(--gutter) 8px', maxWidth: 480, width: '100%', margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, minHeight: 64 }}>
        {index > 0 ? (
          <IconButton label="Back" variant="plain" onClick={() => setIndex(index - 1)}>
            <ArrowLeft size={22} aria-hidden="true" />
          </IconButton>
        ) : (
          <span style={{ width: 'var(--tap)' }} aria-hidden="true" />
        )}
        {steps.length > 1 && (
          <div style={{ flex: 1, display: 'flex', gap: 6 }} role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1} aria-valuetext={`Step ${index + 1} of ${steps.length}`}>
            {steps.map((s, i) => (
              <span key={s} style={{ flex: 1, height: 4, borderRadius: 999, background: i <= index ? 'var(--accent)' : 'var(--border-subtle)', transition: 'background-color var(--dur-std) var(--ease-standard)' }} />
            ))}
          </div>
        )}
        <span style={{ width: 'var(--tap)' }} aria-hidden="true" />
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        <div ref={headingRef} tabIndex={-1} key={step} style={{ maxWidth: 480, margin: '0 auto', padding: '8px var(--gutter) 24px', outline: 'none' }}>
          {step === 'welcome' && (
            <WelcomeStep isAdult={isAdult} setIsAdult={setIsAdult} acceptsRules={acceptsRules} setAcceptsRules={setAcceptsRules} />
          )}

          {step === 'profile' && (
            <div className="animate-fade-in">
              <h1 className="type-title" style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Set up your profile</h1>
              <p className="type-body" style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                Riders on your line see this name and your interests. Use a nickname, not your real name.
              </p>

              <label htmlFor="onb-name" className="field-label">Display name</label>
              <input
                id="onb-name"
                className="input"
                value={pseudonym}
                onChange={e => setPseudonym(e.target.value)}
                maxLength={20}
                autoComplete="nickname"
                autoCapitalize="words"
                aria-describedby="onb-name-help"
                aria-invalid={!nameValid && pseudonym.length > 0}
              />
              <p id="onb-name-help" className="type-caption" style={{ color: !nameValid && pseudonym.length > 0 ? 'var(--danger-text)' : 'var(--text-muted)', marginTop: 6, marginBottom: 24 }}>
                {!nameValid && pseudonym.length > 0 ? 'Use 2–20 characters.' : `${trimmed.length}/20 characters`}
              </p>

              <div id="onb-tags-label" className="field-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Interests</span>
                <span aria-live="polite" style={{ fontWeight: 600, color: tags.length >= MIN_TAGS ? 'var(--success-text)' : 'var(--text-muted)' }}>
                  {tags.length} of {MIN_TAGS}–{MAX_TAGS} picked
                </span>
              </div>
              <div role="group" aria-labelledby="onb-tags-label" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {INTEREST_TAXONOMY.map(t => {
                  const active = tags.includes(t.id);
                  const full = !active && tags.length >= MAX_TAGS;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={active}
                      disabled={full}
                      onClick={() => toggleTag(t.id)}
                      className="press"
                      style={{
                        minHeight: 40,
                        padding: '8px 14px 8px 12px',
                        borderRadius: 'var(--radius-sm)',
                        border: `1px solid ${active ? 'transparent' : 'var(--border-strong)'}`,
                        background: active ? 'var(--accent-container)' : 'transparent',
                        color: active ? 'var(--accent-text)' : 'var(--text-primary)',
                        fontSize: 14, fontWeight: 600,
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        cursor: full ? 'default' : 'pointer',
                      }}
                    >
                      {active ? <Check size={16} aria-hidden="true" /> : <span aria-hidden="true">{t.emoji}</span>}
                      {t.label}
                    </button>
                  );
                })}
              </div>
              {saveError && (
                <p role="alert" className="type-label" style={{ color: 'var(--danger-text)', fontWeight: 500, marginTop: 16 }}>{saveError}</p>
              )}
            </div>
          )}

          {step === 'location' && <PermissionPrimer denied={locationDenied} />}
        </div>
      </div>

      {/* Sticky actions */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-base)' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '12px var(--gutter) calc(12px + var(--safe-bottom))', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {footer}
        </div>
      </div>
    </div>
  );
};

// ─── Welcome / consent ────────────────────────────────────────────────────────
const RULES = [
  'Be respectful. No harassment, hate speech, threats or sexual messages.',
  "Don't follow, photograph or approach anyone who hasn't agreed to meet.",
  'No spam, scams or advertising.',
  'Report or block anyone who makes you uncomfortable — reported accounts are reviewed and can be restricted or removed.',
];

const VALUE_POINTS = [
  { icon: <Users size={18} />, text: 'See who is riding your line and station right now' },
  { icon: <EyeOff size={18} />, text: 'Pseudonymous — no phone number or real name needed' },
  { icon: <ShieldCheck size={18} />, text: 'Only people you accept can message you' },
];

function WelcomeStep({ isAdult, setIsAdult, acceptsRules, setAcceptsRules }: {
  isAdult: boolean; setIsAdult: (v: boolean) => void;
  acceptsRules: boolean; setAcceptsRules: (v: boolean) => void;
}) {
  return (
    <div className="animate-fade-in">
      <img src="/favicon.svg" alt="" width={56} height={56} style={{ borderRadius: 16, margin: '8px 0 20px' }} />
      <h1 className="type-title" style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Meet your fellow commuters</h1>
      <p className="type-body" style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
        CoRide connects people travelling the same Delhi Metro line at the same time.
      </p>

      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {VALUE_POINTS.map(p => (
          <li key={p.text} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-container)', color: 'var(--accent-text)', flexShrink: 0 }}>{p.icon}</span>
            <span className="type-label" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{p.text}</span>
          </li>
        ))}
      </ul>

      <details className="card" style={{ marginBottom: 16, padding: 0 }}>
        <summary className="type-label onb-summary" style={{ cursor: 'pointer', minHeight: 'var(--tap)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', fontWeight: 700, color: 'var(--text-primary)', listStyle: 'none' }}>
          Read the community rules
          <ChevronDown size={18} aria-hidden="true" className="onb-chevron" style={{ color: 'var(--text-secondary)', transition: 'transform var(--dur-micro) var(--ease-standard)' }} />
        </summary>
        <ol style={{ padding: '0 16px 16px 36px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {RULES.map(r => (
            <li key={r} className="type-label" style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{r}</li>
          ))}
        </ol>
      </details>

      <Checkbox id="onb-age" checked={isAdult} onChange={setIsAdult}>
        I am 18 years of age or older.
      </Checkbox>
      <Checkbox id="onb-rules" checked={acceptsRules} onChange={setAcceptsRules}>
        I agree to the community rules and the{' '}
        <a href={`${API}/terms`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          Terms<ExternalLink size={12} aria-hidden="true" /><span className="sr-only"> (opens in browser)</span>
        </a>, and I accept the{' '}
        <a href={`${API}/privacy`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          Privacy Policy<ExternalLink size={12} aria-hidden="true" /><span className="sr-only"> (opens in browser)</span>
        </a>.
      </Checkbox>
      <p className="type-caption" style={{ color: 'var(--text-muted)', marginTop: 8 }}>
        Other riders in your room see your display name, avatar, interests and bio. Your chats are only visible to the people in them.
      </p>
    </div>
  );
}

function Checkbox({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', minHeight: 'var(--tap)' }}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={e => { void triggerHaptic('light'); onChange(e.target.checked); }}
        style={{ width: 22, height: 22, margin: '1px 0 0', accentColor: 'var(--accent)', flexShrink: 0, cursor: 'pointer' }}
      />
      <label htmlFor={id} className="type-label" style={{ color: 'var(--text-primary)', fontWeight: 500, cursor: 'pointer' }}>
        {children}
      </label>
    </div>
  );
}
