import { useEffect, useState } from 'react';
import { X, Check } from 'lucide-react';
import type { UserProfile } from '../types';
import type { Socket } from 'socket.io-client';
import { API } from '../config';


interface Props {
  currentUser: UserProfile;
  socket: Socket | null;
  onSelectFriend?: (friend: any) => void;
}

type Tab = 'received' | 'sent' | 'friends';

export const ConnectScreen: React.FC<Props> = ({ currentUser, socket }) => {
  const [tab, setTab] = useState<Tab>('received');
  const [received, setReceived] = useState<any[]>([]);
  const [sent, setSent] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  // Without this, a pending or failed fetch renders the empty state — "no requests"
  // is indistinguishable from "server is down".
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const load = async () => {
    setStatus('loading');
    try {
      const [rRecv, rSent, rFriends] = await Promise.all([
        fetch(`${API}/api/connections/pending/${currentUser.id}`).then(r=>r.json()),
        fetch(`${API}/api/connections/sent/${currentUser.id}`).then(r=>r.json()),
        fetch(`${API}/api/friends/${currentUser.id}`).then(r=>r.json()),
      ]);
      setReceived(rRecv.pending || []);
      setSent(rSent.sent || []);
      setFriends(rFriends.friends || []);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  };

  useEffect(()=>{ load(); }, [currentUser.id]);
  useEffect(()=>{
    if (!socket) return;
    const onResult = () => load();
    const onAccept = () => load();
    socket.on('connection_result', onResult);
    socket.on('connection_accepted', onAccept);
    return ()=> { socket.off('connection_result', onResult); socket.off('connection_accepted', onAccept); };
  }, [socket]);

  const accept = (id: string) => {
    if (!socket) return;
    socket.emit('accept_connection', { requestId: id, userId: currentUser.id });
  };
  const decline = (id: string) => {
    if (!socket) return;
    socket.emit('decline_connection', { requestId: id, userId: currentUser.id });
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 86 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <h2 style={{ fontSize:20, fontWeight:900, display:'flex', alignItems:'center', gap:10 }}>
          Connect
        </h2>
        <button style={{ background:'none', border:'none', color:'var(--accent-purple-text)', fontSize:12, fontWeight:700 }}>History</button>
      </div>

      {/* Tabs Received / Sent / Friends — Figma pill */}
      <div style={{ display:'flex', gap:6, padding:4, background:'var(--bg-surface)', border:'1px solid var(--border-subtle)', borderRadius:'var(--radius-full)', marginBottom:14 }}>
        {[
          { id:'received', label:'Received', count: received.length },
          { id:'sent', label:'Sent', count: sent.length },
          { id:'friends', label:'Friends', count: friends.length },
        ].map(t=>(
          <button
            key={t.id}
            onClick={()=> setTab(t.id as Tab)}
            style={{
              flex:1, padding:'9px 0', borderRadius:'var(--radius-full)', border:'none',
              background: tab===t.id ? 'var(--accent-purple)' : 'transparent',
              color: tab===t.id ? 'white' : 'var(--text-muted)',
              fontSize:12, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', gap:6, cursor:'pointer'
            }}
          >
            {t.label}
            <span style={{
              minWidth:18, height:18, padding:'0 5px', borderRadius:999,
              background: tab===t.id ? 'rgba(255,255,255,0.22)' : t.id==='received' ? '#EF4444' : t.id==='sent' ? '#F59E0B' : '#10B981',
              color: 'white', fontSize:10, fontWeight:800, display:'inline-flex', alignItems:'center', justifyContent:'center'
            }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {status==='loading' && (
        <div aria-busy="true" aria-label="Loading connections" style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[0,1,2].map(i=> <div key={i} className="skeleton" style={{ height:76, borderRadius:'var(--radius-xl)' }} />)}
        </div>
      )}

      {status==='error' && (
        <div role="alert" style={{ textAlign:'center', padding:24, borderRadius:'var(--radius-xl)', background:'var(--bg-card)', border:'1px solid rgba(244,63,94,0.22)' }}>
          <div style={{ fontSize:14, fontWeight:800, color:'var(--accent-rose-text)' }}>Couldn't load your connections</div>
          <div style={{ fontSize:13, color:'var(--text-secondary)', marginTop:6, lineHeight:1.5 }}>
            The CoRide server didn't respond. Check your internet and try again.
          </div>
          <button onClick={load} className="btn-primary" style={{ marginTop:14 }}>Try again</button>
        </div>
      )}

      {status==='ready' && tab==='received' && (
        <>
          <h3 style={{ fontSize:13, fontWeight:800, marginBottom:10 }}>New Requests</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
            {received.length===0 ? (
              <div style={{ textAlign:'center', padding:24, color:'var(--text-muted)', fontSize:12, border:'1px dashed var(--border-subtle)', borderRadius:'var(--radius-lg)' }}>No new requests — check back after your next ride</div>
            ) : received.map((req:any)=>{
              const p = req.fromProfile as UserProfile | undefined;
              const name = p?.pseudonym || req.fromUserId.slice(0,8);
              const tags = p?.interestTags?.slice(0,3).join(' • ') || 'Art • Design • Travel';
              return (
                <div key={req.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px', borderRadius:'var(--radius-xl)', background:'var(--bg-card)', border:'1px solid var(--border-card)' }}>
                  <div style={{ position:'relative' }}>
                    <div style={{ width:48,height:48, borderRadius:'50%', background: p?.avatarBg || 'var(--accent-purple)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800 }}>
                      {name[0]}
                    </div>
                    <div style={{ position:'absolute', bottom:0, right:0, width:12,height:12, borderRadius:'50%', background:'var(--presence-active)', border:'2px solid var(--bg-card)' }} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)' }}>{name}</span>
                      <span style={{ fontSize:11, padding:'2px 6px', borderRadius:999, background:'rgba(234,179,8,0.14)', color:'var(--accent-amber)', border:'1px solid rgba(234,179,8,0.22)' }}>Nearby</span>
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{tags}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:4, marginTop:2 }}>
                      <TrainMini /> {req.contextLine || 'Blue Line'} • {req.contextStation || 'Rajiv Chowk'} → 9:07 AM
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={()=> decline(req.id)} aria-label={`Decline request from ${name}`} style={{ width:44,height:44, borderRadius:'50%', background:'var(--bg-overlay)', border:'1px solid var(--border-subtle)', color:'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <X size={16}/>
                    </button>
                    <button onClick={()=> accept(req.id)} aria-label={`Accept request from ${name}`} style={{ width:44,height:44, borderRadius:'50%', background:'var(--accent-purple)', border:'none', color:'white', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(123,93,255,0.35)' }}>
                      <Check size={16}/>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <h3 style={{ fontSize:13, fontWeight:800, marginBottom:10 }}>Sent Requests</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {sent.length===0 ? <div style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center', padding:12 }}>No sent requests</div> : sent.slice(0,2).map((req:any)=>{
              const p = req.toProfile as UserProfile | undefined;
              const name = p?.pseudonym || req.toUserId.slice(0,8);
              return (
                <div key={req.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px', borderRadius:'var(--radius-xl)', background:'var(--bg-card)', border:'1px solid var(--border-card)' }}>
                  <div style={{ width:48,height:48, borderRadius:'50%', background: p?.avatarBg || '#6366F1', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800 }}>{name[0]}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)' }}>{name}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>{p?.interestTags?.join(' • ') || 'Music • Coding • Meme'}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', display:'flex', alignItems:'center', gap:4 }}><TrainMini/> Blue Line • Rajiv Chowk → Noida</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:11, padding:'4px 8px', borderRadius:999, background:'rgba(245,158,11,0.14)', color:'var(--accent-amber)', border:'1px solid rgba(245,158,11,0.22)', fontWeight:700 }}>Pending</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>{new Date(req.createdAt).toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'})}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {status==='ready' && tab==='sent' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {sent.length===0 ? <div style={{ textAlign:'center', padding:24, color:'var(--text-muted)', fontSize:12 }}>No sent requests yet — tap a traveler to send one</div> : sent.map((req:any)=>{
            const p = req.toProfile as UserProfile | undefined;
            const name = p?.pseudonym || req.toUserId.slice(0,8);
            return (
              <div key={req.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px', borderRadius:'var(--radius-xl)', background:'var(--bg-card)', border:'1px solid var(--border-card)' }}>
                <div style={{ width:48,height:48, borderRadius:'50%', background: p?.avatarBg || '#6366F1', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800 }}>{name[0]}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)' }}>{name}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>{p?.interestTags?.join(' • ') || 'Music • Coding'}</div>
                </div>
                <span style={{ fontSize:11, padding:'4px 8px', borderRadius:999, background:'rgba(245,158,11,0.14)', color:'var(--accent-amber)', border:'1px solid rgba(245,158,11,0.22)', fontWeight:700 }}>Pending</span>
              </div>
            );
          })}
        </div>
      )}

      {status==='ready' && tab==='friends' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {friends.length===0 ? <div style={{ textAlign:'center', padding:24, color:'var(--text-muted)', fontSize:12 }}>No Metro Friends yet — accept a request to start chatting</div> : friends.map((f:any)=>(
            <div key={f.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px', borderRadius:'var(--radius-xl)', background:'var(--bg-card)', border:'1px solid var(--border-card)' }}>
              <div style={{ width:48,height:48, borderRadius:'50%', background: f.profile.avatarBg, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800 }}>{f.profile.pseudonym[0]}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:800, color:'var(--text-primary)', display:'flex', alignItems:'center', gap:6 }}>{f.profile.pseudonym} <ShieldCheck size={12} style={{ color:'var(--accent-emerald)' }} /></div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>{f.profile.interestTags?.join(' • ')}</div>
              </div>
              <div style={{ width:36,height:36, borderRadius:'50%', background:'rgba(123,93,255,0.14)', border:'1px solid rgba(123,93,255,0.22)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent-purple-text)' }}>
                <Heart size={16}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Safe Connections */}
      <div style={{ marginTop:16, background:'linear-gradient(135deg, var(--bg-accent-wash), var(--bg-accent-wash-2))', border:'1px solid rgba(123,93,255,0.22)', borderRadius:'var(--radius-lg)', padding:14, display:'flex', gap:10, alignItems:'center' }}>
        <div style={{ width:36,height:36, borderRadius:'50%', background:'var(--bg-accent-wash)', border:'1px solid rgba(123,93,255,0.28)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--accent-purple-text)' }}>
          <ShieldCheck size={18}/>
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:12, fontWeight:800, color:'var(--text-primary)' }}>Safe Connections</div>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>We keep CoRide safe for everyone. Report or block if something feels off.</div>
        </div>
        <span style={{ color:'var(--text-muted)' }}>›</span>
      </div>

      {/* How it works */}
      <div style={{ marginTop:16 }}>
        <h3 style={{ fontSize:13, fontWeight:800, marginBottom:10 }}>How it works</h3>
        <div style={{ display:'flex', gap:10 }}>
          {[
            { title:'1. Send Request', desc:'Tap on a traveler you’d like to connect with.', icon:'➕' },
            { title:'2. Mutual Accept', desc:'They accept your request and you accept theirs.', icon:'💜' },
            { title:'3. You’re Connected', desc:'Start chatting and become Metro Friends!', icon:'👥' },
          ].map(s=>(
            <div key={s.title} style={{ flex:1, background:'var(--bg-card)', border:'1px solid var(--border-card)', borderRadius:'var(--radius-lg)', padding:12, textAlign:'center' }}>
              <div style={{ width:36,height:36, borderRadius:'50%', background:'rgba(123,93,255,0.14)', border:'1px solid rgba(123,93,255,0.22)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 8px', color:'var(--accent-purple-text)' }}>{s.icon}</div>
              <div style={{ fontSize:11, fontWeight:800, color:'var(--text-primary)' }}>{s.title}</div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4, lineHeight:1.3 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

function TrainMini(){ return <span style={{ display:'inline-flex', alignItems:'center' }}>🚇</span>; }
function ShieldCheck(props:any){ return <span {...props}>✓</span>; }
function Heart(props:any){ return <span {...props}>♡</span>; }
