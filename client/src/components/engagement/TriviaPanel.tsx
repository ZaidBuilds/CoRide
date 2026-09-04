import { useEffect, useState } from 'react';
import { Clock, Trophy } from 'lucide-react';
import type { TriviaState } from '../../types/engagement';
import type { Socket } from 'socket.io-client';
import type { UserProfile } from '../../types';

interface Props {
  game: TriviaState;
  currentUser: UserProfile;
  socket: Socket | null;
  roomId: string;
}

export const TriviaPanel: React.FC<Props> = ({ game, currentUser, socket, roomId }) => {
  const [secs, setSecs] = useState(Math.max(0, Math.floor((game.currentEndsAt - Date.now())/1000)));
  const q = game.questions[game.currentIndex];
  const hasAnswered = game.answers[currentUser.id] !== undefined && game.answers[currentUser.id] !== null;
  const chosen = game.answers[currentUser.id] as number | undefined;

  useEffect(() => {
    const id = setInterval(() => setSecs(Math.max(0, Math.floor((game.currentEndsAt - Date.now())/1000))), 400);
    return () => clearInterval(id);
  }, [game.currentEndsAt, game.currentIndex]);

  const answer = (idx: number) => {
    if (hasAnswered || !socket) return;
    socket.emit('trivia_answer', { roomId, userId: currentUser.id, choice: idx });
  };

  if (game.status === 'finished') {
    const sorted = [...game.players].sort((a,b)=> (game.scores[b.userId]||0)-(game.scores[a.userId]||0));
    return (
      <div style={{ textAlign: 'center', padding: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--text-primary)' }}>🏁 Trivia Finished</h3>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sorted.map((p,i) => (
            <div key={p.userId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: i===0?'rgba(234,179,8,0.15)':'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}><span style={{ width: 22, height: 22, borderRadius: 6, background: p.avatarBg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 10 }}>{i+1}</span>{p.pseudonym}</span>
              <span style={{ fontWeight: 900 }}>{game.scores[p.userId]||0}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!q) return <div style={{ padding: 12, color: 'var(--text-muted)' }}>Loading…</div>;

  const progress = ((game.currentIndex + 1) / game.questions.length) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>⚡ Fast Trivia</h3>
        <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 'var(--radius-full)', background: secs<5?'rgba(244,63,94,0.15)':'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={11} /> Q {game.currentIndex+1}/{game.questions.length} • {secs}s
        </span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-surface)', overflow: 'hidden' }}>
        <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent-purple)', transition: 'width 0.3s' }} />
      </div>

      <div style={{ padding: 14, borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4 }}>{q.text}</div>
        {q.textHi && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{q.textHi}</div>}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{q.category}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {q.options.map((opt, i) => {
          const isChosen = chosen === i;
          const reveal = game.reveals.find(r=>r.qIndex===game.currentIndex);
          const isCorrect = reveal && reveal.correct === i;
          const isWrongChosen = isChosen && reveal && reveal.correct !== i;
          return (
            <button
              key={i}
              onClick={() => answer(i)}
              disabled={hasAnswered || !!reveal}
              style={{
                textAlign: 'left',
                padding: '11px 14px',
                borderRadius: 'var(--radius-md)',
                background: isCorrect ? 'rgba(34,197,94,0.15)' : isWrongChosen ? 'rgba(244,63,94,0.14)' : isChosen ? 'rgba(99,102,241,0.16)' : 'var(--bg-elevated)',
                border: `1px solid ${isCorrect ? 'rgba(34,197,94,0.35)' : isWrongChosen ? 'rgba(244,63,94,0.35)' : 'var(--border-subtle)'}`,
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: hasAnswered ? 'default' : 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>{String.fromCharCode(65+i)}. {opt}</span>
              {isCorrect && <span>✓</span>}
              {isWrongChosen && <span>✗</span>}
            </button>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {game.players.map(p => (
          <div key={p.userId} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 'var(--radius-full)', background: game.answers[p.userId]!==null && game.answers[p.userId]!==undefined?'rgba(34,197,94,0.12)':'var(--bg-surface)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 14, height: 14, borderRadius: 4, background: p.avatarBg, display: 'inline-block' }} />{p.pseudonym} {game.scores[p.userId]||0}
            {game.answers[p.userId]!==null && game.answers[p.userId]!==undefined ? '✓' : '…'}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <Trophy size={10}/> 15s per Q • 5 Qs • {game.players.length} playing
      </div>
    </div>
  );
};
