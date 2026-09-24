import { useEffect, useRef, useState } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, UsersThreeIcon, EyeSlashIcon, ShieldCheckIcon, ArrowUpRightIcon, CaretDownIcon, CheckIcon } from '@phosphor-icons/react';
import type { UserProfile } from '../types';
import { INTEREST_TAXONOMY } from '../types';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { BrandMark } from './ui/BrandMark';
import { Chip } from './ui/Chip';
import { LinePill } from './ui/LinePill';
import { DELHI_METRO_LINES } from '../data/metroData';
import { PermissionPrimer } from './onboarding/PermissionPrimer';
import { ONBOARDING_KEYS } from './onboarding/keys';
import { pushBackHandler, triggerHaptic } from '../utils/nativeBridge';
import { authHeaders } from '../utils/auth';
import { API } from '../config';

/**
 * First-run flow. Short and honest: three steps at most, and App.tsx only
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

  // ── Footer (sticky, thumb reach) per step. One lime CTA per screen. ──
  let footer: React.ReactNode = null;
  if (step === 'welcome') {
    footer = (
      <Button type="button" fullWidth size="lg" disabled={!isAdult || !acceptsRules} onClick={acceptWelcome} iconEnd={<ArrowRightIcon size={20} weight="bold" />}>
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
          iconEnd={<ArrowRightIcon size={20} weight="bold" />}
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
        <Button type="button" variant="ghost" fullWidth onClick={chooseManually}>Not now, I'll pick my station</Button>
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
      {/* Top bar: back (or the mark on step 1) + progress */}
      <div style={{ padding: 'calc(8px + var(--safe-top)) var(--gutter) 8px', maxWidth: 480, width: '100%', margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, minHeight: 64 }}>
        {index > 0 ? (
          <IconButton label="Back" variant="plain" onClick={() => setIndex(index - 1)} style={{ marginLeft: -12 }}>
            <ArrowLeftIcon size={24} aria-hidden="true" />
          </IconButton>
        ) : (
          <BrandMark size={32} wordmark />
        )}
        {steps.length > 1 && (
          <div style={{ flex: 1, display: 'flex', gap: 4, justifyContent: 'flex-end' }} role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1} aria-valuetext={`Step ${index + 1} of ${steps.length}`}>
            {steps.map((s, i) => (
              <span key={s} style={{ width: i === index ? 28 : 12, height: 4, borderRadius: 999, background: i <= index ? 'var(--ink)' : 'var(--border-strong)', transition: 'width var(--dur-std) var(--ease-standard), background-color var(--dur-std) var(--ease-standard)' }} />
            ))}
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain' }}>
        <div ref={headingRef} tabIndex={-1} key={step} style={{ maxWidth: 480, margin: '0 auto', padding: '8px var(--gutter) 24px', outline: 'none' }}>
          {step === 'welcome' && (
            <WelcomeStep isAdult={isAdult} setIsAdult={setIsAdult} acceptsRules={acceptsRules} setAcceptsRules={setAcceptsRules} />
          )}

          {step === 'profile' && (
            <div className="animate-fade-in">
              <p className="type-meta" style={{ color: 'var(--text-muted)', marginTop: 8 }}>Your profile</p>
              <h1 className="type-display" style={{ color: 'var(--text-primary)', margin: '4px 0 8px' }}>What should riders call you?</h1>
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
              <p id="onb-name-help" className="type-meta tnum" style={{ color: !nameValid && pseudonym.length > 0 ? 'var(--danger-text)' : 'var(--text-muted)', marginTop: 6, marginBottom: 28 }}>
                {!nameValid && pseudonym.length > 0 ? 'Use 2 to 20 characters.' : `${trimmed.length}/20 characters`}
              </p>

              <div id="onb-tags-label" className="field-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span>Interests</span>
                <span aria-live="polite" className="tnum" style={{ fontWeight: 560, color: tags.length >= MIN_TAGS ? 'var(--text-primary)' : 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {tags.length >= MIN_TAGS && <CheckIcon size={14} weight="bold" aria-hidden="true" />}
                  {tags.length} picked, {MIN_TAGS} to {MAX_TAGS}
                </span>
              </div>
              <div role="group" aria-labelledby="onb-tags-label" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 8px', marginTop: 4 }}>
                {INTEREST_TAXONOMY.map(t => {
                  const active = tags.includes(t.id);
                  const full = !active && tags.length >= MAX_TAGS;
                  return (
                    <Chip key={t.id} selected={active} disabled={full} onClick={() => toggleTag(t.id)}
                      icon={active ? <CheckIcon size={14} weight="bold" /> : undefined}>
                      {t.label}
                    </Chip>
                  );
                })}
              </div>
              {saveError && (
                <p role="alert" className="type-label" style={{ color: 'var(--danger-text)', marginTop: 16 }}>{saveError}</p>
              )}
            </div>
          )}

          {step === 'location' && <PermissionPrimer denied={locationDenied} />}
        </div>
      </div>

      {/* Sticky actions */}
      <div style={{ background: 'var(--bg-base)' }}>
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
  'Report or block anyone who makes you uncomfortable. We review reported accounts and can restrict or remove them.',
];

const VALUE_POINTS = [
  { icon: <UsersThreeIcon size={22} />, title: 'Your line, right now', text: 'See who is at your station or on your train.' },
  { icon: <EyeSlashIcon size={22} />, title: 'No real name, no phone number', text: 'You pick a nickname. That is all riders see.' },
  { icon: <ShieldCheckIcon size={22} />, title: 'You decide who can message you', text: 'Only people you accept can start a chat.' },
];

// Real lines from metroData, deduplicated by colour, for the hero strip.
const HERO_LINES = DELHI_METRO_LINES.filter((l, i, all) => all.findIndex(x => x.color.toLowerCase() === l.color.toLowerCase()) === i);

function WelcomeStep({ isAdult, setIsAdult, acceptsRules, setAcceptsRules }: {
  isAdult: boolean; setIsAdult: (v: boolean) => void;
  acceptsRules: boolean; setAcceptsRules: (v: boolean) => void;
}) {
  return (
    <div className="animate-fade-in">
      <p className="type-meta" style={{ color: 'var(--text-muted)', marginTop: 20 }}>For Delhi Metro riders</p>
      <h1 style={{ fontSize: 52, lineHeight: '50px', fontWeight: 700, fontStretch: '76%', letterSpacing: '-0.01em', color: 'var(--text-primary)', margin: '6px 0 16px' }}>
        See who&rsquo;s riding your line.
      </h1>
      <p className="type-body" style={{ color: 'var(--text-secondary)', maxWidth: 360 }}>
        CoRide shows the people at your station and on your train, right now. Say hello, or just ride.
      </p>

      {/* The line colours are the product's visual language; these are the real lines CoRide covers. */}
      <div aria-hidden="true" style={{ display: 'flex', gap: 4, margin: '28px 0 8px' }}>
        {HERO_LINES.map(l => (
          <span key={l.id} style={{ flex: 1, height: 6, borderRadius: 999, background: l.color }} />
        ))}
      </div>
      <p className="type-meta" style={{ color: 'var(--text-muted)', marginBottom: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        <span>Works on every line, from</span>
        <LinePill line={DELHI_METRO_LINES[0]} size="sm" />
        <span>to</span>
        <LinePill line={DELHI_METRO_LINES.find(l => l.id === 'grey') ?? DELHI_METRO_LINES[DELHI_METRO_LINES.length - 1]} size="sm" />
      </p>

      <ul className="list-group" style={{ listStyle: 'none', marginBottom: 12 }}>
        {VALUE_POINTS.map(p => (
          <li key={p.title} className="list-row" style={{ alignItems: 'flex-start', paddingTop: 14, paddingBottom: 14 }}>
            <span aria-hidden="true" className="row-lead" style={{ color: 'var(--text-primary)', marginTop: 1 }}>{p.icon}</span>
            <span className="row-text">
              <span className="row-title" style={{ whiteSpace: 'normal' }}>{p.title}</span>
              <span className="row-sub" style={{ whiteSpace: 'normal', color: 'var(--text-secondary)' }}>{p.text}</span>
            </span>
          </li>
        ))}
      </ul>

      <details className="list-group" style={{ marginBottom: 20 }}>
        <summary className="type-label onb-summary" style={{ cursor: 'pointer', minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', color: 'var(--text-primary)', listStyle: 'none' }}>
          Read the community rules
          <CaretDownIcon size={20} aria-hidden="true" className="onb-chevron" style={{ color: 'var(--text-secondary)', transition: 'transform var(--dur-micro) var(--ease-standard)' }} />
        </summary>
        <ol style={{ padding: '0 16px 16px 36px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {RULES.map(r => (
            <li key={r} className="type-label" style={{ color: 'var(--text-secondary)', fontWeight: 420 }}>{r}</li>
          ))}
        </ol>
      </details>

      <Checkbox id="onb-age" checked={isAdult} onChange={setIsAdult}>
        I am 18 or older.
      </Checkbox>
      <Checkbox id="onb-rules" checked={acceptsRules} onChange={setAcceptsRules}>
        I agree to the community rules and the{' '}
        <a href={`${API}/terms`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          Terms<ArrowUpRightIcon size={13} weight="bold" aria-hidden="true" /><span className="sr-only"> (opens in browser)</span>
        </a>, and I accept the{' '}
        <a href={`${API}/privacy`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 1 }}>
          Privacy Policy<ArrowUpRightIcon size={13} weight="bold" aria-hidden="true" /><span className="sr-only"> (opens in browser)</span>
        </a>.
      </Checkbox>
      <p className="type-meta" style={{ color: 'var(--text-muted)', marginTop: 8 }}>
        Riders in your room see your display name, avatar, interests and bio. Your chats are visible only to the people in them.
      </p>
    </div>
  );
}

function Checkbox({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', minHeight: 'var(--tap)' }}>
      <input
        id={id}
        type="checkbox"
        className="check"
        checked={checked}
        onChange={e => { void triggerHaptic('light'); onChange(e.target.checked); }}
        style={{ marginTop: -2 }}
      />
      <label htmlFor={id} className="type-body" style={{ color: 'var(--text-primary)', cursor: 'pointer', fontSize: 15, lineHeight: '21px' }}>
        {children}
      </label>
    </div>
  );
}
