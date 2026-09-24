import type { ReactNode } from 'react';
import {
  ArrowLeft, ShieldCheck, Flag, UserX, PhoneCall, MessageCircleOff, EyeOff, Clock, MapPinOff,
  Ban, Mail, ExternalLink
} from 'lucide-react';
import { triggerHaptic } from '../../utils/nativeBridge';
import { API } from '../../config';

interface SafetyCenterScreenProps {
  onBack: () => void;
  /** Shows a "Blocked people" shortcut when provided. */
  onOpenBlockedUsers?: () => void;
}

const HELPLINES: { number: string; name: string; detail: string }[] = [
  { number: '112', name: 'Emergency', detail: 'Police, ambulance, fire — all of India' },
  { number: '1091', name: 'Women helpline', detail: 'Delhi Police' },
  { number: '155370', name: 'DMRC helpline', detail: 'Delhi Metro station help, 24×7' },
  { number: '155655', name: 'CISF metro security', detail: 'Security inside Delhi Metro' }
];

const SUPPORT_EMAIL = 'collab.zaidbuilds@gmail.com';

/**
 * Safety Centre. Every statement here describes what the app and server
 * actually do today — no claims about device bans or monitoring we don't run.
 */
export const SafetyCenterScreen: React.FC<SafetyCenterScreenProps> = ({ onBack, onOpenBlockedUsers }) => {
  return (
    <div className="animate-fade-in" style={{ maxWidth: 520, margin: '0 auto', paddingBottom: 16 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => { triggerHaptic('light'); onBack(); }}
          className="icon-btn"
          aria-label="Back to profile"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="display" style={{ fontSize: 24, lineHeight: '30px', color: 'var(--text-primary)', margin: 0 }}>
          Safety Centre
        </h1>
      </header>

      {/* In danger right now — first, because it matters most */}
      <section
        aria-labelledby="safety-urgent"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-card)',
          borderLeft: '4px solid var(--status-danger)',
          borderRadius: 'var(--radius-lg)',
          padding: 16,
          marginBottom: 24
        }}
      >
        <h2 id="safety-urgent" style={{ fontSize: 16, lineHeight: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          In danger right now?
        </h2>
        <p style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-secondary)', margin: '4px 0 12px' }}>
          Call 112, or press the emergency button inside the coach to talk to the train operator. Metro staff and CISF are at every station.
        </p>
        <a
          href="tel:112"
          className="pill-button danger"
          style={{ width: '100%', textDecoration: 'none' }}
          aria-label="Call 112, emergency services"
        >
          <PhoneCall size={18} aria-hidden="true" /> Call 112
        </a>
      </section>

      <Group title="Helplines">
        {HELPLINES.map(h => (
          <a key={h.number} href={`tel:${h.number}`} className="list-row" style={{ textDecoration: 'none' }} aria-label={`Call ${h.name}, ${h.number}`}>
            <span aria-hidden="true" style={{ color: 'var(--text-secondary)', display: 'flex' }}><PhoneCall size={20} /></span>
            <span className="row-text">
              <span className="row-title">{h.name}</span>
              <span className="row-sub">{h.detail}</span>
            </span>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-purple-text)', fontVariantNumeric: 'tabular-nums' }}>{h.number}</span>
          </a>
        ))}
      </Group>

      <Group title="If someone makes you uncomfortable">
        <Info icon={<Flag size={20} />} title="Report them">
          Open their profile or your chat with them, tap the menu and choose Report. Pick a reason and add a note if you like. They are not told who reported them.
        </Info>
        <Info icon={<UserX size={20} />} title="Block them">
          Blocking removes your friendship and any pending requests. You stop seeing each other in rooms, and they can’t message you or send you a new request. They aren’t notified.
        </Info>
        {onOpenBlockedUsers && (
          <button type="button" className="list-row navigable" onClick={() => { triggerHaptic('light'); onOpenBlockedUsers(); }}>
            <span aria-hidden="true" style={{ color: 'var(--text-secondary)', display: 'flex' }}><Ban size={20} /></span>
            <span className="row-text">
              <span className="row-title">Blocked people</span>
              <span className="row-sub">Review or undo a block</span>
            </span>
          </button>
        )}
      </Group>

      <Group title="How CoRide protects you">
        <Info icon={<MessageCircleOff size={20} />} title="No messages from strangers">
          Private chat only opens after you both accept a connection request. Declining is silent.
        </Info>
        <Info icon={<EyeOff size={20} />} title="Pseudonymous by design">
          We don’t ask for your real name, phone number, email or contacts. Riders see only your display name, avatar, bio and interests.
        </Info>
        <Info icon={<MapPinOff size={20} />} title="Your location isn’t stored">
          Location is used only while the app is open, to work out your station, line and direction. Coordinates aren’t saved on our servers.
        </Info>
        <Info icon={<Clock size={20} />} title="Presence expires quickly">
          You appear in a station room only while you’re using CoRide there. You drop out about a minute after you leave or close the app.
        </Info>
      </Group>

      <Group title="Community rules">
        <Info icon={<ShieldCheck size={20} />} title="Be respectful">
          No harassment, hate speech, threats, sexual comments or unwanted advances — in chat or on the platform.
        </Info>
        <Info icon={<ShieldCheck size={20} />} title="Respect people’s privacy">
          Don’t photograph, follow or try to identify other riders. Don’t share someone’s details without their consent.
        </Info>
        <Info icon={<ShieldCheck size={20} />} title="No spam or scams">
          No selling, promotions, links to scams or impersonating other people.
        </Info>
        <Info icon={<ShieldCheck size={20} />} title="18+ only">
          CoRide is for adults. Accounts that break these rules can be restricted or removed.
        </Info>
      </Group>

      <Group title="Contact">
        <a className="list-row" href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('CoRide safety')}`} style={{ textDecoration: 'none' }}>
          <span aria-hidden="true" style={{ color: 'var(--text-secondary)', display: 'flex' }}><Mail size={20} /></span>
          <span className="row-text">
            <span className="row-title">Email the CoRide team</span>
            <span className="row-sub">{SUPPORT_EMAIL}</span>
          </span>
        </a>
        <a className="list-row" href={`${API}/privacy`} target="_blank" rel="noopener noreferrer" aria-label="Privacy policy (opens in browser)" style={{ textDecoration: 'none' }}>
          <span aria-hidden="true" style={{ color: 'var(--text-secondary)', display: 'flex' }}><ShieldCheck size={20} /></span>
          <span className="row-text">
            <span className="row-title">Privacy policy</span>
          </span>
          <ExternalLink size={16} aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </a>
      </Group>
    </div>
  );
};

function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = `safety-${title.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return (
    <section aria-labelledby={id}>
      <h2 id={id} style={{ fontSize: 13, lineHeight: '20px', fontWeight: 700, color: 'var(--accent-purple-text)', margin: '0 4px 8px' }}>
        {title}
      </h2>
      <div className="list-group">{children}</div>
    </section>
  );
}

/** Non-interactive explanatory row: wraps text instead of truncating. */
function Info({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="list-row" style={{ alignItems: 'flex-start', cursor: 'default' }}>
      <span aria-hidden="true" style={{ color: 'var(--text-secondary)', display: 'flex', marginTop: 2 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, lineHeight: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>{title}</span>
        <span style={{ display: 'block', fontSize: 13, lineHeight: '18px', color: 'var(--text-secondary)', marginTop: 2 }}>{children}</span>
      </span>
    </div>
  );
}
