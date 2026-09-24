import type { ReactNode } from 'react';
import {
  ShieldCheckIcon, FlagIcon, ProhibitIcon, PhoneIcon, PhoneCallIcon, ChatCircleSlashIcon, EyeSlashIcon, ClockIcon,
  MapPinSimpleIcon, EnvelopeSimpleIcon, ArrowSquareOutIcon, HandshakeIcon, LockSimpleIcon, MegaphoneSimpleIcon, IdentificationBadgeIcon,
} from '@phosphor-icons/react';
import { triggerHaptic } from '../../utils/nativeBridge';
import { API } from '../../config';
import { ScreenHeader } from '../ui/ScreenHeader';
import { ListGroup, ListRow } from '../ui/ListRow';
import { IconTile, GroupLabel } from './SettingsParts';

interface SafetyCenterScreenProps {
  onBack: () => void;
  /** Shows a "Blocked people" shortcut when provided. */
  onOpenBlockedUsers?: () => void;
}

// Verified numbers: keep exactly as they are.
const HELPLINES: { number: string; name: string; detail: string }[] = [
  { number: '112', name: 'Emergency', detail: 'Police, ambulance and fire, anywhere in India' },
  { number: '1091', name: 'Women helpline', detail: 'Delhi Police' },
  { number: '155370', name: 'DMRC helpline', detail: 'Delhi Metro station help, 24×7' },
  { number: '155655', name: 'CISF metro security', detail: 'Security inside Delhi Metro' },
];

const SUPPORT_EMAIL = 'collab.zaidbuilds@gmail.com';

/**
 * Safety Centre. Every statement here describes what the app and server
 * actually do today: no claims about device bans or monitoring we don't run.
 */
export const SafetyCenterScreen: React.FC<SafetyCenterScreenProps> = ({ onBack, onOpenBlockedUsers }) => {
  return (
    <div className="animate-fade-in" style={{ maxWidth: 520, margin: '0 auto', paddingBottom: 16 }}>
      <ScreenHeader title="Safety Centre" onBack={onBack} backLabel="Back to profile" />

      {/* In danger right now: first, because it matters most */}
      <section
        aria-labelledby="safety-urgent"
        style={{ background: 'var(--danger-container)', borderRadius: 'var(--radius-card)', padding: 20, marginBottom: 24 }}
      >
        <h2 id="safety-urgent" className="type-title" style={{ color: 'var(--text-primary)' }}>In danger right now?</h2>
        <p className="type-body" style={{ color: 'var(--text-secondary)', margin: '8px 0 16px' }}>
          Call 112, or press the emergency button in the coach to talk to the train operator. Metro staff and CISF are at every station.
        </p>
        <a
          href="tel:112"
          className="press"
          onClick={() => { void triggerHaptic('heavy'); }}
          aria-label="Call 112, emergency services"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            minHeight: 56, padding: '16px 26px', borderRadius: 'var(--radius-pill)',
            background: 'var(--danger-fill)', color: '#FFFFFF', textDecoration: 'none',
            fontSize: 17, lineHeight: '22px', fontWeight: 600,
          }}
        >
          <PhoneCallIcon size={22} weight="fill" aria-hidden="true" /> Call 112
        </a>
      </section>

      <section aria-labelledby="safety-helplines">
        <GroupLabel id="safety-helplines">Helplines</GroupLabel>
        <ListGroup>
          {HELPLINES.map(h => (
            <a key={h.number} href={`tel:${h.number}`} className="list-row" style={{ textDecoration: 'none' }} aria-label={`Call ${h.name}, ${h.number.split('').join(' ')}`}>
              <span className="row-lead"><IconTile><PhoneIcon size={22} /></IconTile></span>
              <span className="row-text">
                <span className="row-title">{h.name}</span>
                <span className="row-sub" style={{ whiteSpace: 'normal' }}>{h.detail}</span>
              </span>
              <span className="row-trail tnum type-headline" style={{ color: 'var(--text-primary)' }}>{h.number}</span>
            </a>
          ))}
        </ListGroup>
      </section>

      <section aria-labelledby="safety-uncomfortable">
        <GroupLabel id="safety-uncomfortable">If someone makes you uncomfortable</GroupLabel>
        <ListGroup>
          <Info icon={<FlagIcon size={22} />} title="Report them">
            Open their profile or your chat, tap the menu and choose Report. Pick a reason and add a note if you like. They aren't told who reported them.
          </Info>
          <Info icon={<ProhibitIcon size={22} />} title="Block them">
            Blocking ends your friendship and any pending requests. You stop seeing each other in rooms, and they can't message you or send a new request. They aren't notified.
          </Info>
          {onOpenBlockedUsers && (
            <ListRow
              leading={<IconTile><ProhibitIcon size={22} /></IconTile>}
              title="Blocked people"
              subtitle="Review or undo a block"
              onClick={onOpenBlockedUsers}
              navigable
            />
          )}
        </ListGroup>
      </section>

      <section aria-labelledby="safety-protects">
        <GroupLabel id="safety-protects">How CoRide protects you</GroupLabel>
        <ListGroup>
          <Info icon={<ChatCircleSlashIcon size={22} />} title="No messages from strangers">
            Private chat opens only after you both accept a connection request. Declining is silent.
          </Info>
          <Info icon={<EyeSlashIcon size={22} />} title="Pseudonymous by design">
            We don't ask for your real name, phone number, email or contacts. Riders see only your display name, avatar, bio and interests.
          </Info>
          <Info icon={<MapPinSimpleIcon size={22} />} title="Your location isn't stored">
            Location is used only while the app is open, to work out your station, line and direction. Coordinates aren't saved on our servers.
          </Info>
          <Info icon={<ClockIcon size={22} />} title="Presence expires quickly">
            You appear in a station room only while you're using CoRide there. You drop out about a minute after you leave or close the app.
          </Info>
        </ListGroup>
      </section>

      <section aria-labelledby="safety-rules">
        <GroupLabel id="safety-rules">Community rules</GroupLabel>
        <ListGroup>
          <Info icon={<HandshakeIcon size={22} />} title="Be respectful">
            No harassment, hate speech, threats, sexual comments or unwanted advances, in chat or anywhere on CoRide.
          </Info>
          <Info icon={<LockSimpleIcon size={22} />} title="Respect people's privacy">
            Don't photograph, follow or try to identify other riders. Don't share someone's details without their consent.
          </Info>
          <Info icon={<MegaphoneSimpleIcon size={22} />} title="No spam or scams">
            No selling, promotions, scam links or pretending to be someone else.
          </Info>
          <Info icon={<IdentificationBadgeIcon size={22} />} title="18+ only">
            CoRide is for adults. Accounts that break these rules can be restricted or removed.
          </Info>
        </ListGroup>
      </section>

      <section aria-labelledby="safety-contact">
        <GroupLabel id="safety-contact">Contact</GroupLabel>
        <ListGroup>
          <a className="list-row" href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('CoRide safety')}`} style={{ textDecoration: 'none' }}>
            <span className="row-lead"><IconTile><EnvelopeSimpleIcon size={22} /></IconTile></span>
            <span className="row-text">
              <span className="row-title">Email the CoRide team</span>
              <span className="row-sub">{SUPPORT_EMAIL}</span>
            </span>
          </a>
          <a className="list-row" href={`${API}/privacy`} target="_blank" rel="noopener noreferrer" aria-label="Privacy policy (opens in browser)" style={{ textDecoration: 'none' }}>
            <span className="row-lead"><IconTile><ShieldCheckIcon size={22} /></IconTile></span>
            <span className="row-text"><span className="row-title">Privacy policy</span></span>
            <span className="row-trail"><ArrowSquareOutIcon size={18} aria-hidden="true" /></span>
          </a>
        </ListGroup>
      </section>
    </div>
  );
};

/** Non-interactive explanatory row: wraps text instead of truncating. */
function Info({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="list-row" style={{ alignItems: 'flex-start', cursor: 'default', background: 'transparent' }}>
      <span className="row-lead"><IconTile>{icon}</IconTile></span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="type-label" style={{ display: 'block', color: 'var(--text-primary)', marginTop: 2 }}>{title}</span>
        <span className="type-meta" style={{ display: 'block', color: 'var(--text-secondary)', marginTop: 4 }}>{children}</span>
      </span>
    </div>
  );
}
