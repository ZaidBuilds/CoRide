import React, { useState } from 'react';
import { BellIcon, BellRingingIcon, ShareNetworkIcon, CheckIcon, TrainSimpleIcon } from '@phosphor-icons/react';
import { Button } from './Button';
import { isNative, triggerHaptic } from '../../utils/nativeBridge';

/**
 * EmptyState: honest zero-state for a list or screen. Say what is empty, why,
 * and give at most one or two real next steps. Never invent numbers.
 * Left-aligned surface card with a squircle icon tile (Phosphor, 24px).
 *
 * Generic:
 *   <EmptyState
 *     icon={<ChatCircleIcon size={24} />}
 *     title="No chats yet"
 *     description="When someone accepts your request, your conversation shows up here."
 *     action={{ label: 'Find people', onClick: goPeople }}
 *   />
 *
 * Transit room preset (used by the People list when a room is empty):
 *   <EmptyState lineName="Blue Line" stationName="Rajiv Chowk" direction="Towards Noida" />
 */
interface Action {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: React.ReactNode;
  action?: Action;
  secondaryAction?: Action;
  /** Drop the card chrome (for use inside an existing card). */
  bare?: boolean;

  // ── transit room preset ──
  lineName?: string;
  stationName?: string;
  direction?: string;
  onBrowseOtherLines?: () => void;
  /** Wire to a real notification opt-in. The button is hidden when absent. */
  onEnablePush?: () => void;
  pushEnabled?: boolean;
}

const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.coride.delhimetro';

export const EmptyState: React.FC<EmptyStateProps> = props => {
  if (props.title) return <GenericEmpty {...props} />;
  return <RoomEmpty {...props} />;
};

const GenericEmpty: React.FC<EmptyStateProps> = ({ icon, title, description, action, secondaryAction, bare }) => (
  <div className={`${bare ? '' : 'empty-state-card '}animate-fade-in`} style={bare ? { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 14, padding: '24px 4px' } : undefined}>
    {icon && <div className="empty-state-icon" aria-hidden="true">{icon}</div>}
    <div>
      <h3 className="type-headline" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      {description && (
        <p className="type-body" style={{ color: 'var(--text-secondary)', marginTop: 4, maxWidth: 360 }}>{description}</p>
      )}
    </div>
    {(action || secondaryAction) && (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
        {action && <Button type="button" variant="secondary" icon={action.icon} onClick={action.onClick}>{action.label}</Button>}
        {secondaryAction && <Button type="button" variant="ghost" icon={secondaryAction.icon} onClick={secondaryAction.onClick}>{secondaryAction.label}</Button>}
      </div>
    )}
  </div>
);

const RoomEmpty: React.FC<EmptyStateProps> = ({
  lineName,
  stationName,
  direction,
  onBrowseOtherLines,
  onEnablePush,
  pushEnabled = false,
}) => {
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const where = [lineName, stationName].filter(Boolean).join(' · ');

  const handleShare = async () => {
    void triggerHaptic('medium');
    const url = isNative ? PLAY_URL : window.location.origin;
    const text = `I'm riding the Delhi Metro${lineName ? ` ${lineName}` : ''}${stationName ? ` from ${stationName}` : ''}. Join me on CoRide to meet people on this line.`;
    if (navigator.share) {
      try { await navigator.share({ title: 'CoRide', text, url }); return; }
      catch (e) { if ((e as DOMException)?.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setShareState('copied');
    } catch {
      setShareState('failed');
    }
    setTimeout(() => setShareState('idle'), 2500);
  };

  return (
    <div className="empty-state-card animate-fade-in" style={{ margin: '12px 0' }}>
      <div className="empty-state-icon" aria-hidden="true"><TrainSimpleIcon size={24} /></div>
      <div>
        <h3 className="type-headline" style={{ color: 'var(--text-primary)' }}>You're the first one here</h3>
        <p className="type-body" style={{ color: 'var(--text-secondary)', marginTop: 4, maxWidth: 360 }}>
          No one else is in {where ? <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{where}</strong> : 'this room'}
          {direction ? ` (${direction})` : ''} right now. People show up here as they board. This list updates live.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 2 }}>
        {onEnablePush && (
          <Button
            type="button"
            fullWidth
            variant={pushEnabled ? 'tonal' : 'secondary'}
            disabled={pushEnabled}
            icon={pushEnabled ? <BellRingingIcon size={20} /> : <BellIcon size={20} />}
            onClick={onEnablePush}
          >
            {pushEnabled ? 'Notifications on' : 'Notify me when someone joins'}
          </Button>
        )}
        <Button
          type="button"
          variant={onEnablePush ? 'tonal' : 'secondary'}
          fullWidth
          icon={shareState === 'copied' ? <CheckIcon size={20} /> : <ShareNetworkIcon size={20} />}
          onClick={handleShare}
        >
          {shareState === 'copied' ? 'Invite link copied' : shareState === 'failed' ? "Couldn't copy. Try again" : 'Invite someone'}
        </Button>
      </div>

      <p className="type-meta tnum" style={{ color: 'var(--text-muted)' }}>
        Peak hours: 7:30–10:30 and 17:00–20:30
      </p>

      {onBrowseOtherLines && (
        <button type="button" className="link-btn" style={{ marginLeft: -10 }} onClick={onBrowseOtherLines}>
          Try another line or station
        </button>
      )}
    </div>
  );
};
