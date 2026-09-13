import { useState } from 'react';
import { ArrowRight, Phone, Lock, Check, FileText } from 'lucide-react';
import type { UserProfile } from '../types';
import { INTEREST_TAXONOMY } from '../types';
import { Button } from './ui/Button';
import { PermissionPrimer } from './onboarding/PermissionPrimer';
import { triggerHaptic } from '../utils/nativeBridge';

const API = 'http://localhost:4000';

interface Props {
  user: UserProfile;
  onComplete: (updated: UserProfile) => void;
  onSkip: () => void;
  onSelectManualStation?: () => void;
}

export const OnboardingScreen: React.FC<Props> = ({
  user,
  onComplete,
  onSkip,
  onSelectManualStation
}) => {
  // Steps: 1: Phone, 2: OTP, 3: Profile Setup, 4: Interests (min 3), 5: Terms Gate, 6: Permission Primer
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [pseudonym, setPseudonym] = useState(user.pseudonym || 'CosmicTiger');
  const [ageBand, setAgeBand] = useState<'18-24' | '25-34' | '35+'>('18-24');
  const [tags, setTags] = useState<string[]>(user.interestTags || []);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const toggleTag = (id: string) => {
    triggerHaptic('light');
    setTags(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  };

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length >= 10) {
      triggerHaptic('medium');
      setStep(2);
    }
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length >= 4) {
      triggerHaptic('medium');
      setStep(3);
    }
  };

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pseudonym.trim().length >= 2) {
      triggerHaptic('medium');
      setStep(4);
    }
  };

  const handleInterestsSubmit = () => {
    if (tags.length >= 3) {
      triggerHaptic('medium');
      setStep(5);
    }
  };

  const handleTermsSubmit = () => {
    if (termsAccepted) {
      triggerHaptic('medium');
      setStep(6);
    }
  };

  const finishOnboarding = async () => {
    try {
      const res = await fetch(`${API}/api/profile/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pseudonym: pseudonym.trim(),
          interestTags: tags,
          ageBand
        })
      });
      const data = await res.json();
      const updatedProfile = res.ok ? data.profile : { ...user, pseudonym, interestTags: tags };
      localStorage.setItem('coride_profile', JSON.stringify(updatedProfile));
      localStorage.setItem('coride_terms_accepted_at', new Date().toISOString());
      localStorage.setItem('coride_onboarded', '1');
      onComplete(updatedProfile);
    } catch {
      localStorage.setItem('coride_onboarded', '1');
      onComplete({ ...user, pseudonym, interestTags: tags });
    }
  };

  const handleAllowLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => finishOnboarding(),
        () => {
          // If denied, fallback to finish and suggest manual picker
          finishOnboarding();
          onSelectManualStation?.();
        },
        { enableHighAccuracy: false, timeout: 8000 }
      );
    } else {
      finishOnboarding();
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'var(--bg-base)',
        overflowY: 'auto',
        padding: 'calc(16px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom))'
      }}
    >
      <div style={{ maxWidth: 440, margin: '0 auto' }}>
        {/* Progress Bar & Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>
            Step {step} of 6
          </div>
          <div style={{ flex: 1, margin: '0 16px', height: 4, borderRadius: 999, background: 'var(--bg-surface)', display: 'flex', gap: 4 }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 4,
                  borderRadius: 999,
                  background: step >= i ? 'var(--signal-500)' : 'var(--border-subtle)',
                  transition: 'background 0.3s ease'
                }}
              />
            ))}
          </div>
          {step <= 2 ? (
            <button
              onClick={onSkip}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Skip
            </button>
          ) : (
            <div style={{ width: 40 }} />
          )}
        </div>

        {/* Step 1: Phone Number */}
        {step === 1 && (
          <form onSubmit={handlePhoneSubmit} className="animate-fade-in" style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(37,99,235,0.12)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--signal-400)' }}>
              <Phone size={28} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              Enter Phone Number
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 24px' }}>
              We'll send a 4-digit code to verify your commuter account.
            </p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              <span style={{ padding: '12px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 }}>
                🇮🇳 +91
              </span>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="9876543210"
                autoFocus
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: '0.05em'
                }}
              />
            </div>

            <Button variant="primary" fullWidth size="lg" disabled={phone.length < 10}>
              Send Verification Code <ArrowRight size={18} />
            </Button>
          </form>
        )}

        {/* Step 2: OTP */}
        {step === 2 && (
          <form onSubmit={handleOtpSubmit} className="animate-fade-in" style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(5,150,105,0.12)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mint-500)' }}>
              <Lock size={28} />
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              Verify OTP
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 24px' }}>
              Sent to +91 {phone || '9876543210'} • <span style={{ color: 'var(--signal-400)', cursor: 'pointer' }} onClick={() => setStep(1)}>Change</span>
            </p>

            <input
              type="text"
              value={otp}
              onChange={e => setOtp(e.target.value.slice(0, 4))}
              placeholder="1234"
              autoFocus
              style={{
                width: '100%',
                maxWidth: 240,
                margin: '0 auto 24px',
                textAlign: 'center',
                padding: '14px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--text-primary)',
                fontSize: 28,
                fontWeight: 900,
                letterSpacing: '0.4em'
              }}
            />

            <Button variant="primary" fullWidth size="lg" disabled={otp.length < 4}>
              Verify & Continue <ArrowRight size={18} />
            </Button>
          </form>
        )}

        {/* Step 3: Profile Setup */}
        {step === 3 && (
          <form onSubmit={handleProfileSubmit} className="animate-fade-in">
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 6px', textAlign: 'center' }}>
              Create Commuter Profile
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px', textAlign: 'center' }}>
              Your pseudonym is visible to co-passengers in your train coach.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
                Commuter Pseudonym
              </label>
              <input
                value={pseudonym}
                onChange={e => setPseudonym(e.target.value)}
                maxLength={20}
                placeholder="e.g. CosmicTiger, MetroNomad"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: 16
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Age Category (Safety & Context)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {(['18-24', '25-34', '35+'] as const).map(band => (
                  <button
                    key={band}
                    type="button"
                    onClick={() => setAgeBand(band)}
                    className="press touch-target-44"
                    style={{
                      padding: '10px 0',
                      borderRadius: 'var(--radius-md)',
                      background: ageBand === band ? 'rgba(37,99,235,0.18)' : 'var(--bg-surface)',
                      border: `1px solid ${ageBand === band ? 'var(--signal-500)' : 'var(--border-subtle)'}`,
                      color: ageBand === band ? 'var(--signal-400)' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: 'pointer'
                    }}
                  >
                    {band}
                  </button>
                ))}
              </div>
            </div>

            <Button variant="primary" fullWidth size="lg" disabled={pseudonym.trim().length < 2}>
              Save Identity <ArrowRight size={18} />
            </Button>
          </form>
        )}

        {/* Step 4: Interests (Min 3) */}
        {step === 4 && (
          <div className="animate-fade-in">
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 6px', textAlign: 'center' }}>
              Select Passions & Vibes
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px', textAlign: 'center' }}>
              Pick at least <strong>3 topics</strong> to find co-riders with mutual commute vibes.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              {INTEREST_TAXONOMY.map(t => {
                const active = tags.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTag(t.id)}
                    className="press"
                    style={{
                      padding: '12px 10px',
                      borderRadius: 'var(--radius-lg)',
                      background: active ? 'rgba(37,99,235,0.18)' : 'var(--bg-surface)',
                      border: `1px solid ${active ? 'var(--signal-500)' : 'var(--border-subtle)'}`,
                      color: active ? '#93C5FD' : 'var(--text-secondary)',
                      fontSize: 13,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{t.emoji}</span>
                    <span style={{ flex: 1 }}>{t.label}</span>
                    {active && <Check size={14} style={{ color: 'var(--signal-400)' }} />}
                  </button>
                );
              })}
            </div>

            <Button
              variant="primary"
              fullWidth
              size="lg"
              disabled={tags.length < 3}
              onClick={handleInterestsSubmit}
            >
              Continue ({tags.length}/3 selected) <ArrowRight size={18} />
            </Button>
          </div>
        )}

        {/* Step 5: Terms of Use & Safety Code Acceptance (Mandatory Unskippable) */}
        {step === 5 && (
          <div className="animate-fade-in">
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(220,38,38,0.12)', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rose-500)' }}>
              <FileText size={28} />
            </div>

            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 6px', textAlign: 'center' }}>
              Terms of Use & Conduct
            </h1>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px', textAlign: 'center' }}>
              Required agreement under Google Play Social & UGC Developer Policy
            </p>

            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '14px 16px',
                maxHeight: 220,
                overflowY: 'auto',
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
                marginBottom: 18
              }}
            >
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                1. Prohibited & Objectionable Content
              </strong>
              CoRide strictly prohibits harassment, abusive language, hate speech, stalking, sexual solicitations, and sharing unconsented media in Delhi Metro trains or stations.
              <br /><br />
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                2. Immediate Moderation & Banning
              </strong>
              Every piece of content, message, and profile can be reported. Users receiving verified reports are automatically restricted and permanently banned from accessing rooms.
              <br /><br />
              <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
                3. Privacy & Location Integrity
              </strong>
              Exact physical coordinates are never stored or shared with strangers. Presence is scoped solely to station and train line buckets.
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                cursor: 'pointer',
                marginBottom: 20
              }}
            >
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={e => {
                  triggerHaptic('light');
                  setTermsAccepted(e.target.checked);
                }}
                style={{ width: 20, height: 20, marginTop: 2, accentColor: 'var(--signal-500)' }}
              />
              <span style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                I agree to the <strong>Terms of Use</strong>, acknowledge the community safety rules, and understand that objectionable behavior leads to immediate expulsion.
              </span>
            </label>

            <Button
              variant="primary"
              fullWidth
              size="lg"
              disabled={!termsAccepted}
              onClick={handleTermsSubmit}
            >
              Accept & Continue <ArrowRight size={18} />
            </Button>
          </div>
        )}

        {/* Step 6: Permission Primer */}
        {step === 6 && (
          <PermissionPrimer
            onAllowLocation={handleAllowLocation}
            onChooseManually={() => {
              finishOnboarding();
              onSelectManualStation?.();
            }}
          />
        )}
      </div>
    </div>
  );
};
