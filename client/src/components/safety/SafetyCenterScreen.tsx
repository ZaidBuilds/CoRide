import React from 'react';
import { ArrowLeft, Shield, AlertTriangle, UserX, PhoneCall, CheckCircle } from 'lucide-react';
import { triggerHaptic } from '../../utils/nativeBridge';

interface SafetyCenterScreenProps {
  onBack: () => void;
}

export const SafetyCenterScreen: React.FC<SafetyCenterScreenProps> = ({ onBack }) => {
  return (
    <div
      className="animate-fade-in"
      style={{
        padding: '16px 14px calc(24px + env(safe-area-inset-bottom))',
        maxWidth: 520,
        margin: '0 auto',
        minHeight: '100vh',
        background: 'var(--bg-base)'
      }}
    >
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button
          onClick={() => {
            triggerHaptic('light');
            onBack();
          }}
          className="icon-btn touch-target-44"
          aria-label="Back"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '50%' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Safety Centre & Community Rules
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
            Delhi Metro Commuter Protection Standards
          </p>
        </div>
      </div>

      {/* Safety Manifesto Card */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(22, 25, 31, 0.95) 100%)',
          border: '1px solid rgba(37, 99, 235, 0.3)',
          borderRadius: 'var(--radius-xl)',
          padding: 16,
          marginBottom: 16
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Shield size={22} style={{ color: 'var(--signal-400)' }} />
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Low-Pressure Digital Social Layer
          </h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
          CoRide turns physical commute proximity into safe, respectful connection. We hold a strict zero-tolerance policy against harassment, unwanted solicitations, or stalking in transit spaces.
        </p>
      </div>

      {/* Core Rules Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--mint-500)', fontWeight: 700, fontSize: 14 }}>
            <CheckCircle size={18} /> Mutual Consent Required
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.4, margin: 0 }}>
            Direct messaging is only unlocked once both commuters have mutually accepted a connection request. Strangers cannot cold-message or spam your inbox.
          </p>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--amber-500)', fontWeight: 700, fontSize: 14 }}>
            <UserX size={18} /> Silent Declines & Instant Blocking
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.4, margin: 0 }}>
            Declining a request is silent to prevent physical awkwardness in the same carriage. Blocking is instant and bilateral: both users immediately disappear from each other's feeds and any active thread freezes permanently.
          </p>
        </div>

        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--rose-500)', fontWeight: 700, fontSize: 14 }}>
            <AlertTriangle size={18} /> Prohibited & Objectionable Content
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: 1.4, margin: 0 }}>
            Hate speech, sexual harassment, explicit language, photography of non-consenting commuters, and scams result in immediate permanent device bans and IP restrictions.
          </p>
        </div>
      </div>

      {/* Emergency Helplines */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-xl)', padding: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <PhoneCall size={18} style={{ color: 'var(--signal-400)' }} /> Delhi Metro Emergency Helplines
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <a
            href="tel:155370"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              background: 'var(--bg-canvas)',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              color: 'var(--text-primary)'
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>DMRC 24/7 Helpline</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Station assistance & security</div>
            </div>
            <strong style={{ color: 'var(--signal-400)', fontSize: 15 }}>155370</strong>
          </a>

          <a
            href="tel:1091"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              background: 'var(--bg-canvas)',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              color: 'var(--text-primary)'
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Women Helpline</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Delhi Police Dedicated Line</div>
            </div>
            <strong style={{ color: 'var(--signal-400)', fontSize: 15 }}>1091</strong>
          </a>

          <a
            href="tel:112"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              background: 'var(--bg-canvas)',
              borderRadius: 'var(--radius-md)',
              textDecoration: 'none',
              color: 'var(--text-primary)'
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>National Emergency Services</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Police, Ambulance, Fire</div>
            </div>
            <strong style={{ color: 'var(--signal-400)', fontSize: 15 }}>112</strong>
          </a>
        </div>
      </div>
    </div>
  );
};
