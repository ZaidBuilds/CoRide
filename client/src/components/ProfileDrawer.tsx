import { useState } from 'react';
import { X, UserPlus, Ban, Flag, MessageCircle, Clock, ShieldCheck } from 'lucide-react';
import type { UserProfile } from '../types';
import { INTEREST_TAXONOMY } from '../types';

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

const REPORT_REASONS = ['Inappropriate messages','Harassment or bullying','Spam or scam','Impersonation','Makes me uncomfortable'];

function tagMeta(id: string) {
  return INTEREST_TAXONOMY.find(t => t.id === id) || { emoji: '•', label: id, category: '' };
}

export const ProfileDrawer: React.FC<Props> = ({ user, isMe, isFriend, onClose, onConnect, onBlock, onReport, onMessage }) => {
  const [showReport, setShowReport] = useState(false);
  const tier = user.presenceTier || 'nearby';
  const badge = tier === 'active' ? { label: 'Same Train', bg: 'rgba(56,189,248,0.14)', color:'var(--presence-sameTrain)' } : { label: 'Nearby', bg: 'rgba(234,179,8,0.16)', color:'var(--accent-amber)' };

  const interests = user.interestTags?.length ? user.interestTags : ['music','coding','memes','travel','photography','gaming'];
  const about = user.bio || 'Music lover 🎧 | Coding 💻 | Meme enthusiast 😂 Always up for a good chat and fun games!';

  const mutual = [
    { name:'QuietStorm_91', bg:'linear-gradient(135deg,var(--accent-pink),var(--accent-violet))' },
    { name:'NightOwl_77', bg:'linear-gradient(135deg,#f59e0b,#ef4444)' },
    { name:'StarChild_33', bg:'linear-gradient(135deg,#10b981,#06b6d4)' },
    { name:'Wanderer_10', bg:'linear-gradient(135deg,#6366f1,var(--accent-violet))' },
    { name:'PixelPanda_55', bg:'linear-gradient(135deg,#f97316,var(--accent-pink))' },
  ];

  return (
    <div className="drawer-overlay" onClick={onClose} style={{ alignItems:'flex-start', overflowY:'auto', paddingTop: 24 }}>
      <div className="drawer-panel animate-slide-up" onClick={e=>e.stopPropagation()} style={{ maxWidth: 420, width:'94%', maxHeight:'none', padding:0, overflow:'hidden', borderRadius:'var(--radius-2xl)', background:'var(--bg-elevated)', border:'1px solid var(--border-card)' }}>
        {/* Header */}
        <div style={{ position:'relative', height: 220, background:'linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-card) 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'20px 16px 12px' }}>
          <button onClick={onClose} aria-label="Close profile" style={{ position:'absolute', top:14, left:14, width:44,height:44, borderRadius:'50%', background:'var(--bg-overlay)', border:'1px solid rgba(255,255,255,0.08)', color:'var(--text-primary)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <X size={16}/>
          </button>
          <button aria-label="Profile options" style={{ position:'absolute', top:14, right:14, width:44,height:44, borderRadius:'50%', background:'var(--bg-overlay)', border:'1px solid rgba(255,255,255,0.08)', color:'var(--text-primary)', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span aria-hidden="true" style={{ fontSize:18 }}>⋮</span>
          </button>

          <div style={{ position:'relative', width:96, height:96 }}>
            <div style={{
              width:96, height:96, borderRadius:'50%',
              background: user.avatarBg,
              border:'3px solid var(--accent-purple)',
              boxShadow:'0 0 0 6px rgba(123,93,255,0.16), 0 8px 32px rgba(0,0,0,0.45)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:28, fontWeight:900, color:'white'
            }}>
              {user.pseudonym[0]}
            </div>
            <div style={{ position:'absolute', bottom:2, right:2, width:16, height:16, borderRadius:'50%', background:'var(--presence-active)', border:'2px solid var(--bg-elevated)' }} />
          </div>

          <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
            <h3 style={{ fontSize:18, fontWeight:900, color:'var(--text-primary)', margin:0 }}>{user.pseudonym}</h3>
            <span style={{ fontSize:11, fontWeight:800, padding:'4px 8px', borderRadius:999, background: badge.bg, color: badge.color, border:'1px solid rgba(255,255,255,0.08)' }}>{badge.label}</span>
          </div>
          <p style={{ fontSize:12, color:'var(--text-secondary)', marginTop:4, display:'flex', alignItems:'center', gap:6 }}>
            Active on <span style={{ color:'var(--accent-purple-text)', fontWeight:700 }}>● Blue Line</span> • Rajiv Chowk → Noida
          </p>
          <p style={{ fontSize:11, color:'var(--accent-purple-text)', marginTop:4, display:'flex', alignItems:'center', gap:4 }}>
            <Clock size={12}/> 8 stops left to Noida Sec 18
          </p>
        </div>

        <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:12, background:'var(--bg-base)' }}>
          {/* About */}
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-lg)', padding:14 }}>
            <h4 style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)', marginBottom:8 }}>About</h4>
            <p style={{ fontSize:12, color:'var(--text-secondary)', lineHeight:1.5 }}>{about}</p>
          </div>

          {/* Interests */}
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-lg)', padding:14 }}>
            <h4 style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)', marginBottom:10 }}>Interests</h4>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {interests.slice(0,6).map(tid => {
                const meta = tagMeta(tid);
                return (
                  <span key={tid} style={{
                    display:'inline-flex', alignItems:'center', gap:6,
                    padding:'7px 12px', borderRadius:999,
                    background:'rgba(123,93,255,0.12)', border:'1px solid rgba(123,93,255,0.18)',
                    color:'var(--accent-purple-text)', fontSize:11, fontWeight:700
                  }}>
                    <span>{meta.emoji}</span> {meta.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Top Games */}
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-lg)', padding:14 }}>
            <h4 style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)', marginBottom:10 }}>Top Games</h4>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                { label:'Word Chain', wins:124, bg:'linear-gradient(135deg, var(--accent-purple), #6366F1)', icon:'A°Z' },
                { label:'Trivia', wins:98, bg:'linear-gradient(135deg, #10b981, #059669)', icon:'?' },
                { label:'Dumb Charades', wins:73, bg:'linear-gradient(135deg, #f59e0b, #d97706)', icon:'🎭' },
                { label:'20 Questions', wins:65, bg:'linear-gradient(135deg, var(--accent-pink), var(--accent-violet))', icon:'20' },
              ].map(g=>(
                <div key={g.label} style={{ background:'var(--bg-input)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)', padding:10, textAlign:'center' }}>
                  <div style={{ width:36,height:36, borderRadius:10, background:g.bg, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:900, fontSize:13, margin:'0 auto 6px' }}>{g.icon}</div>
                  <div style={{ fontSize:11, fontWeight:800, color:'var(--text-primary)' }}>{g.label}</div>
                  <div style={{ fontSize:11, color:'var(--accent-amber)', fontWeight:700, marginTop:2 }}>⭐ {g.wins} Wins</div>
                </div>
              ))}
            </div>
          </div>

          {/* Mutual Vibes */}
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-lg)', padding:14 }}>
            <h4 style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)', marginBottom:10 }}>Mutual Vibes</h4>
            <div style={{ display:'flex', gap:10, overflowX:'auto', paddingBottom:4 }}>
              {mutual.map(m=>(
                <div key={m.name} style={{ flex:'0 0 64px', textAlign:'center' }}>
                  <div style={{ width:56,height:56, borderRadius:'50%', background:m.bg, border:'2px solid var(--accent-purple)', margin:'0 auto', position:'relative' }}>
                    <div style={{ position:'absolute', bottom:0, right:0, width:10,height:10, borderRadius:'50%', background:'var(--presence-active)', border:'2px solid var(--bg-card)' }} />
                  </div>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--text-secondary)', marginTop:6, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{m.name}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          {!isMe && (
            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              {isFriend ? (
                <button onClick={onMessage} className="btn-primary" style={{ flex:1, justifyContent:'center', padding:'12px' }}>
                  <MessageCircle size={16}/> Start Chat
                </button>
              ) : (
                <>
                  <button onClick={onConnect} style={{ flex:1, padding:'12px', borderRadius:'var(--radius-full)', background:'var(--bg-surface)', border:'1px solid var(--border-card)', color:'var(--text-primary)', fontWeight:700, fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                    <UserPlus size={16}/> Send Connect Request
                  </button>
                  <button onClick={onMessage} className="btn-primary" style={{ flex:1, justifyContent:'center', padding:'12px' }}>
                    <MessageCircle size={16}/> Start Chat
                  </button>
                </>
              )}
            </div>
          )}

          {/* Safe Connections */}
          <div style={{
            background:'linear-gradient(135deg, var(--bg-accent-wash), var(--bg-accent-wash-2))', border:'1px solid rgba(123,93,255,0.22)',
            borderRadius:'var(--radius-lg)', padding:12, display:'flex', alignItems:'center', gap:10
          }}>
            <div style={{ width:36,height:36, borderRadius:'50%', background:'var(--bg-accent-wash)', border:'1px solid rgba(123,93,255,0.28)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent-purple-text)' }}>
              <ShieldCheck size={18}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:12, fontWeight:800, color:'var(--text-primary)' }}>We keep CoRide safe for everyone.</div>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>Report or block if something feels off.</div>
            </div>
            <span style={{ color:'var(--text-muted)' }}>›</span>
          </div>

          {/* Secondary actions */}
          {!isMe && (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={onBlock} className="btn-danger" style={{ flex:1, justifyContent:'center', borderRadius:'var(--radius-full)' }}><Ban size={14}/> Block</button>
                <button onClick={()=> setShowReport(!showReport)} className="btn-secondary" style={{ flex:1, justifyContent:'center', borderRadius:'var(--radius-full)' }}><Flag size={14}/> Report</button>
              </div>
              {showReport && (
                <div style={{ display:'flex', flexDirection:'column', gap:6, padding:10, background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-md)' }}>
                  {REPORT_REASONS.map(r=>(
                    <button key={r} onClick={()=>{ onReport(r); setShowReport(false); }} style={{ textAlign:'left', padding:'8px 10px', borderRadius:8, background:'var(--bg-elevated)', border:'1px solid var(--border-subtle)', color:'var(--text-secondary)', fontSize:11 }}>
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
