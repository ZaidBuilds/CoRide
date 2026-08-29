import { useState } from 'react';
import { X, Save, Sparkles } from 'lucide-react';
import type { UserProfile } from '../../types';
import { INTEREST_TAXONOMY } from '../../types';

const API = 'http://localhost:4000';

interface Props {
  user: UserProfile;
  onClose: () => void;
  onSaved: (p: UserProfile) => void;
}

export const ProfileEditor: React.FC<Props> = ({ user, onClose, onSaved }) => {
  const [pseudonym, setPseudonym] = useState(user.pseudonym);
  const [bio, setBio] = useState(user.bio || '');
  const [college, setCollege] = useState(user.collegeOrTag || '');
  const [vibe, setVibe] = useState((user as any).vibeTagline || '');
  const [tags, setTags] = useState<string[]>(user.interestTags || []);
  const [langs, setLangs] = useState<string[]>((user as any).languages || ['en']);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const toggleTag = (id: string) => {
    setTags(prev => prev.includes(id) ? prev.filter(t=>t!==id) : prev.length <5 ? [...prev, id] : prev);
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/profile/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pseudonym, bio, collegeOrTag: college, interestTags: tags, languages: langs, vibeTagline: vibe
        })
      });
      const j = await r.json();
      if (r.ok) {
        // update localStorage
        const stored = localStorage.getItem('coride_profile');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.id === j.profile.id) {
            localStorage.setItem('coride_profile', JSON.stringify(j.profile));
          }
        }
        onSaved(j.profile);
        setMsg('Saved ✓');
        setTimeout(onClose, 600);
      } else setMsg(j.error || 'Save failed');
    } catch (e:any) { setMsg(String(e)); }
    setSaving(false);
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer-panel animate-slide-up" onClick={e=>e.stopPropagation()} style={{ maxWidth: 520, maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--text-muted)', margin: '0 auto 14px' }} />
        <button onClick={onClose} style={{ position:'absolute', top:16, right:16, background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}><X size={20}/></button>

        <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)', display:'flex', alignItems:'center', gap:6 }}><Sparkles size={16} style={{color:'var(--accent-purple)'}}/> Edit profile</h3>
        <p style={{ fontSize: 11, color:'var(--text-muted)', marginTop:4 }}>Enhance discovery — better tags → better vibe matches. Visible to travelers.</p>

        <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:12 }}>
          <label style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)' }}>Display name (2-20 chars)
            <input value={pseudonym} onChange={e=>setPseudonym(e.target.value)} maxLength={20} style={{ marginTop:6, width:'100%', padding:'9px 12px', borderRadius:'var(--radius-md)', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', color:'var(--text-primary)', fontSize:13 }}/>
          </label>
          <label style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)' }}>Vibe tagline (up to 30, optional)
            <input value={vibe} onChange={e=>setVibe(e.target.value)} maxLength={30} placeholder="e.g. Chai + Code + Cricket" style={{ marginTop:6, width:'100%', padding:'9px 12px', borderRadius:'var(--radius-md)', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', color:'var(--text-primary)', fontSize:13 }}/>
          </label>
          <label style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)' }}>Bio (120 chars, optional)
            <textarea value={bio} onChange={e=>setBio(e.target.value)} maxLength={120} rows={2} placeholder="BCA student, loves metro photowalks" style={{ marginTop:6, width:'100%', padding:'9px 12px', borderRadius:'var(--radius-md)', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', color:'var(--text-primary)', fontSize:12, resize:'none' }}/>
            <span style={{ fontSize:10, color:'var(--text-muted)' }}>{bio.length}/120</span>
          </label>
          <label style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)' }}>College / Tag
            <input value={college} onChange={e=>setCollege(e.target.value)} maxLength={30} placeholder="e.g. DU North Campus, Hostel" style={{ marginTop:6, width:'100%', padding:'9px 12px', borderRadius:'var(--radius-md)', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', color:'var(--text-primary)', fontSize:13 }}/>
          </label>

          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)', display:'flex', justifyContent:'space-between' }}>
              <span>Interest tags (up to 5)</span><span style={{ color:'var(--text-muted)', fontWeight:600 }}>{tags.length}/5</span>
            </div>
            <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:6 }}>
              {INTEREST_TAXONOMY.map(t => {
                const active = tags.includes(t.id);
                return (
                  <button key={t.id} onClick={()=>toggleTag(t.id)} style={{
                    padding:'6px 10px', borderRadius:'var(--radius-full)', fontSize:12, fontWeight:700,
                    background: active ? 'rgba(168,85,247,0.18)' : 'var(--bg-surface)',
                    border: `1px solid ${active ? 'rgba(168,85,247,0.4)' : 'var(--border-subtle)'}`,
                    color: active ? 'var(--accent-purple)' : 'var(--text-secondary)',
                    display:'inline-flex', alignItems:'center', gap:4, cursor:'pointer'
                  }}>
                    <span>{t.emoji}</span>{t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <label style={{ fontSize:12, fontWeight:700, color:'var(--text-secondary)' }}>Languages (comma)
            <input value={langs.join(',')} onChange={e=>setLangs(e.target.value.split(',').map(s=>s.trim()).filter(Boolean).slice(0,3))} placeholder="en,hi" style={{ marginTop:6, width:'100%', padding:'9px 12px', borderRadius:'var(--radius-md)', background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', color:'var(--text-primary)', fontSize:13 }}/>
          </label>

          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button onClick={onClose} className="btn-secondary" style={{ flex:1, justifyContent:'center' }}>Cancel</button>
            <button onClick={save} disabled={saving} className="btn-primary" style={{ flex:1, justifyContent:'center', opacity: saving?0.6:1 }}><Save size={14}/> {saving?'Saving…':'Save'}</button>
          </div>
          {msg && <div style={{ fontSize:12, color:'var(--accent-emerald)', textAlign:'center' }}>{msg}</div>}
          <div style={{ fontSize:10, color:'var(--text-muted)', textAlign:'center', marginTop:4 }}>Karma {user.karmaScore} • {(user as any).trustBadge || 'Regular'} • Real-time presence</div>
        </div>
      </div>
    </div>
  );
};
