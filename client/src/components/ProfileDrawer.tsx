import { useState } from 'react';
import { X, UserPlus, Ban, Flag, MessageCircle } from 'lucide-react';
import type { UserProfile } from '../types';

interface Props {
  user: UserProfile;
  isMe: boolean;
  isFriend: boolean;
  onClose: () => void;
  onConnect: () => void;
  onBlock: () => void;
  onReport: (reason: string) => void;
  onMessage: () => void;
}

const REPORT_REASONS = [
  'Inappropriate messages',
  'Harassment or bullying',
  'Spam or scam',
  'Impersonation',
  'Makes me uncomfortable'
];

export const ProfileDrawer: React.FC<Props> = ({
  user,
  isMe,
  isFriend,
  onClose,
  onConnect,
  onBlock,
  onReport,
  onMessage
}) => {
  const [showReportOptions, setShowReportOptions] = useState(false);
  const tier = user.presenceTier || 'other';
  const trustTier = (user as any).trustTier || 'newcomer';
  const trustBadge = (user as any).trustBadge || (trustTier === 'verified' ? '✅ Verified' : trustTier === 'trusted' ? '⭐ Trusted' : trustTier === 'regular' ? '👋 Regular' : '🌱 New');
  const initials = user.pseudonym.substring(0, 2).toUpperCase();

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel animate-slide-up" onClick={e => e.stopPropagation()}>
        {/* Handle bar */}
        <div style={{
          width: 40,
          height: 4,
          borderRadius: 2,
          background: 'var(--text-muted)',
          margin: '0 auto 20px'
        }} />

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer'
          }}
        >
          <X size={20} />
        </button>

        {/* Avatar + Name */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 'var(--radius-lg)',
              background: user.avatarBg,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 900,
              color: 'white',
              marginBottom: 12,
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
            }}
          >
            {initials}
          </div>

          <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            {user.pseudonym}
            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius-full)', background: trustTier==='verified' ? 'rgba(168,85,247,0.15)' : trustTier==='trusted' ? 'rgba(16,185,129,0.12)' : 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: trustTier==='verified' ? 'var(--accent-purple)' : trustTier==='trusted' ? 'var(--accent-emerald)' : 'var(--text-muted)' }}>
              {trustBadge}
            </span>
          </h3>

          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            {user.username} • Karma {user.karmaScore}
          </p>

          {(user as any).vibeTagline && (
            <p style={{ fontSize: 13, color: 'var(--text-primary)', fontStyle: 'italic', marginTop: 6, background: 'var(--bg-surface)', padding: '6px 10px', borderRadius: 'var(--radius-md)', display: 'inline-block' }}>
              “{(user as any).vibeTagline}”
            </p>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: 8,
            flexWrap: 'wrap'
          }}>
            <div className={`presence-dot ${tier}`} />
            <span style={{
              fontSize: 12,
              fontWeight: 600,
              color: tier === 'active' ? 'var(--presence-active)' :
                     tier === 'nearby' ? 'var(--presence-nearby)' : 'var(--presence-other)',
              textTransform: 'capitalize'
            }}>
              {tier}
            </span>
            {user.collegeOrTag && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>• {user.collegeOrTag}</span>}
            {(user as any).languages?.length > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>• {(user as any).languages.join(', ')}</span>}
          </div>
        </div>

        {/* Interest Tags */}
        {user.interestTags && user.interestTags.length > 0 && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            justifyContent: 'center',
            marginBottom: 24
          }}>
            {user.interestTags.map(tag => (
              <span
                key={tag}
                style={{
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-secondary)'
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Bio */}
        {user.bio && (
          <p style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            textAlign: 'center',
            marginBottom: 24,
            lineHeight: 1.6
          }}>
            {user.bio}
          </p>
        )}

        {/* Action Buttons */}
        {!isMe && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Connect or Message */}
            {isFriend ? (
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} onClick={onMessage}>
                <MessageCircle size={16} />
                Message
              </button>
            ) : (
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} onClick={onConnect}>
                <UserPlus size={16} />
                Send Connection Request
              </button>
            )}

            {/* Safety actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={onBlock}>
                <Ban size={14} />
                Block
              </button>

              <button
                className="btn-secondary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setShowReportOptions(!showReportOptions)}
              >
                <Flag size={14} />
                Report
              </button>
            </div>

            {/* Report reasons */}
            {showReportOptions && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: 12,
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)'
              }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Why are you reporting?
                </p>
                {REPORT_REASONS.map(reason => (
                  <button
                    key={reason}
                    onClick={() => { onReport(reason); setShowReportOptions(false); }}
                    style={{
                      textAlign: 'left',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      fontSize: 12,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseOver={e => {
                      (e.target as HTMLElement).style.background = 'rgba(244,63,94,0.1)';
                      (e.target as HTMLElement).style.color = '#fda4af';
                    }}
                    onMouseOut={e => {
                      (e.target as HTMLElement).style.background = 'var(--bg-elevated)';
                      (e.target as HTMLElement).style.color = 'var(--text-secondary)';
                    }}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
