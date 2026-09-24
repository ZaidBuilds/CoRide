import React, { useState } from 'react';
import { Bell, BellRing, Share2, Check, Train } from 'lucide-react';
import { Button } from './Button';
import { isNative, triggerHaptic } from '../../utils/nativeBridge';

/**
 * EmptyState — honest zero-state for a list or screen. Say what is empty, why,
 * and give at most one or two real next steps. Never invent numbers.
 *
 * Generic:
 *   <EmptyState
 *     icon={<MessageCircle size={28} />}
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
  <div className={`${bare ? '' : 'empty-state-card '}animate-fade-in`} style={bare ? { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', padding: '24px 8px' } : undefined}>
    {icon && <div className="empty-state-icon" aria-hidden="true">{icon}</div>}
    <div>
      <h3 className="type-heading" style={{ color: 'var(--text-primary)', fontSize: 18 }}>{title}</h3>
      {description && (
        <p className="type-label" style={{ color: 'var(--text-secondary)', fontWeight: 400, marginTop: 4, maxWidth: 320 }}>{description}</p>
      )}
    </div>
    {(action || secondaryAction) && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 320, marginTop: 4 }}>
        {action && <Button type="button" fullWidth icon={action.icon} onClick={action.onClick}>{action.label}</Button>}
        {secondaryAction && <Button type="button" variant="ghost" fullWidth icon={secondaryAction.icon} onClick={secondaryAction.onClick}>{secondaryAction.label}</Button>}
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
      <div className="empty-state-icon" aria-hidden="true"><Train size={28} /></div>
      <div>
        <h3 className="type-heading" style={{ color: 'var(--text-primary)', fontSize: 18 }}>You're the first one here</h3>
        <p className="type-label" style={{ color: 'var(--text-secondary)', fontWeight: 400, marginTop: 4, maxWidth: 320 }}>
          No one else is in {where ? <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{where}</strong> : 'this room'}
          {direction ? ` (${direction})` : ''} right now. People appear here as they board — this list updates live.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 320, marginTop: 4 }}>
        {onEnablePush && (
          <Button
            type="button"
            fullWidth
            variant={pushEnabled ? 'tonal' : 'primary'}
            disabled={pushEnabled}
            icon={pushEnabled ? <BellRing size={16} /> : <Bell size={16} />}
            onClick={onEnablePush}
          >
            {pushEnabled ? 'Notifications on' : 'Notify me when someone joins'}
          </Button>
        )}
        <Button
          type="button"
          variant={onEnablePush ? 'secondary' : 'primary'}
          fullWidth
          icon={shareState === 'copied' ? <Check size={16} /> : <Share2 size={16} />}
          onClick={handleShare}
        >
          {shareState === 'copied' ? 'Invite link copied' : shareState === 'failed' ? "Couldn't copy — try again" : 'Invite someone'}
        </Button>
      </div>

      <p className="type-caption" style={{ color: 'var(--text-muted)' }}>
        Peak commute hours: 7:30–10:30 and 17:00–20:30
      </p>

      {onBrowseOtherLines && (
        <button type="button" className="link-btn" onClick={onBrowseOtherLines}>
          Try another line or station
        </button>
      )}
    </div>
  );
};
