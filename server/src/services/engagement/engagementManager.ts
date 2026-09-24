import { v4 as uuidv4 } from 'uuid';
import type { UserProfile } from '../../types';
import type {
  EngagementPlayer, WordChainEngagementState, TwentyQState, TriviaState, PromptState, ReactionState, EngagementSnapshot, PromptSubmission
} from './types';
import { pickTriviaSet } from './triviaData';
import { pickSecret, answerQuestion } from './twentyQuestionsData';
import { pickPrompt } from './promptsData';
import { DictionaryService } from '../dictionaryService';

function toPlayer(u: UserProfile): EngagementPlayer {
  return { userId: u.id, pseudonym: u.pseudonym, username: u.username || `@${u.pseudonym}`, avatarId: u.avatarId, avatarBg: u.avatarBg, score: 0, joinedAt: Date.now() };
}

export class EngagementManager {
  private static instance: EngagementManager;
  private games: Map<string, WordChainEngagementState | TwentyQState | TriviaState | PromptState> = new Map(); // roomId -> game
  private reactions: Map<string, ReactionState> = new Map(); // targetId -> state
  private activity: Map<string, { id: string; text: string; at: number; type: 'game_start' | 'game_end' | 'reaction' | 'join' }[]> = new Map();
  private dict = DictionaryService.getInstance();

  private constructor() {
    setInterval(() => this.tick(), 1000);
  }
  static getInstance(): EngagementManager {
    if (!EngagementManager.instance) EngagementManager.instance = new EngagementManager();
    return EngagementManager.instance;
  }

  // ── Public helpers ──
  getGame(roomId: string) {
    return this.games.get(roomId) || null;
  }
  getReactions() { return this.reactions; }
  getSnapshot(roomId: string): EngagementSnapshot {
    const g = this.games.get(roomId) || null;
    const reacts: Record<string, ReactionState> = {};
    for (const [k, v] of this.reactions.entries()) reacts[k] = v;
    const board = this.buildLeaderboard(roomId);
    const feed = this.activity.get(roomId) || [];
    return { roomId, activeGame: g, queue: [], reactions: reacts, leaderboard: board, activityFeed: feed.slice(-12).reverse() };
  }
  private buildLeaderboard(roomId: string) {
    const g: any = this.games.get(roomId);
    if (!g || !g.players) return [];
    const map: Record<string, number> = {};
    const meta: Record<string, EngagementPlayer> = {};
    for (const p of g.players) { meta[p.userId] = p; map[p.userId] = p.score ?? 0; }
    // also consider other game scores
    if (g.type === 'trivia') {
      for (const [uid, sc] of Object.entries(g.scores as Record<string, number>)) map[uid] = sc;
    }
    if (g.type === 'word_chain') {
      for (const p of (g as WordChainEngagementState).players) map[p.userId] = p.score;
    }
    return Object.entries(map).map(([uid, score]) => ({ userId: uid, pseudonym: meta[uid]?.pseudonym || uid, avatarBg: meta[uid]?.avatarBg || '#6366f1', score })).sort((a,b)=>b.score-a.score).slice(0,8);
  }
  private pushActivity(roomId: string, text: string, type: 'game_start' | 'game_end' | 'reaction' | 'join' = 'game_start') {
    if (!this.activity.has(roomId)) this.activity.set(roomId, []);
    this.activity.get(roomId)!.push({ id: uuidv4(), text, at: Date.now(), type });
    if (this.activity.get(roomId)!.length > 30) this.activity.set(roomId, this.activity.get(roomId)!.slice(-30));
  }

  // ── Create / Join / Leave ──
  createGame(roomId: string, type: 'word_chain' | 'twenty_q' | 'trivia' | 'prompt', host: UserProfile) {
    const existing = this.games.get(roomId);
    if (existing && existing.status === 'active') {
      return { ok: false, error: 'A game is already active in this room. Finish it first.' };
    }
    let state: any;
    const p = toPlayer(host);
    if (type === 'word_chain') {
      const start = this.dict.getRandomWord().toUpperCase();
      state = {
        gameId: `wc_${roomId}_${Date.now()}`,
        roomId, type: 'word_chain', status: 'active' as const,
        currentWord: start, currentTurnUserId: host.id, turnStartedAt: Date.now(), turnDurationSeconds: 15,
        usedWords: [start], players: [p], roundNumber: 1, lives: { [host.id]: 3 }, streaks: { [host.id]: 0 }
      } as WordChainEngagementState;
      this.pushActivity(roomId, `Word Chain started by ${host.pseudonym} • ${start}`, 'game_start');
    } else if (type === 'twenty_q') {
      const sec = pickSecret();
      state = {
        gameId: `20q_${roomId}_${Date.now()}`,
        roomId, type: 'twenty_q', status: 'active' as const,
        secretWord: sec.word, secretCategory: sec.category, secretHint: sec.hint,
        asked: [], remaining: 20, players: [p], guessAttempts: [], startedAt: Date.now(), host: 'bot'
      } as TwentyQState;
      this.pushActivity(roomId, `20 Questions started — ${sec.hint}`, 'game_start');
    } else if (type === 'trivia') {
      const qs = pickTriviaSet(5);
      state = {
        gameId: `trivia_${roomId}_${Date.now()}`,
        roomId, type: 'trivia', status: 'active' as const,
        players: [{ ...p, streak: 0 }], questions: qs, currentIndex: 0, currentEndsAt: Date.now() + 15_000, answers: {}, scores: { [host.id]: 0 }, startedAt: Date.now(), reveals: []
      } as TriviaState;
      this.pushActivity(roomId, `Trivia started by ${host.pseudonym} • 5 Qs`, 'game_start');
    } else if (type === 'prompt') {
      const pr = pickPrompt();
      state = {
        gameId: `prompt_${roomId}_${Date.now()}`,
        roomId, type: 'prompt', status: 'active' as const,
        currentPrompt: pr, players: [p], submissions: [], expiresAt: Date.now() + 4 * 60 * 1000, startedAt: Date.now()
      } as PromptState;
      this.pushActivity(roomId, `${pr.emoji} Prompt: ${pr.text}`, 'game_start');
    }
    if (state) this.games.set(roomId, state);
    return { ok: true, state };
  }

  joinGame(roomId: string, user: UserProfile) {
    const g: any = this.games.get(roomId);
    if (!g) return { ok: false, error: 'No active game. Create one.' };
    if (g.players.some((p: any) => p.userId === user.id)) return { ok: true, state: g };
    const p = toPlayer(user);
    if (g.type === 'word_chain') {
      g.players.push(p); g.lives[user.id] = 3; g.streaks[user.id] = 0;
      if (g.status === 'lobby') { g.status = 'active'; g.currentTurnUserId = user.id; g.turnStartedAt = Date.now(); }
    } else if (g.type === 'trivia') {
      g.players.push({ ...p, streak: 0 }); if (!g.scores[user.id]) g.scores[user.id] = 0;
    } else {
      g.players.push(p);
    }
    this.pushActivity(roomId, `${user.pseudonym} joined ${g.type}`, 'join');
    return { ok: true, state: g };
  }

  leaveGame(roomId: string, userId: string) {
    const g: any = this.games.get(roomId);
    if (!g) return;
    const wasTurn = g.currentTurnUserId === userId;
    g.players = g.players.filter((p: any) => p.userId !== userId);
    if (g.type === 'word_chain') {
      delete g.lives[userId]; delete g.streaks[userId];
      if (wasTurn) this.advanceWordChainTurn(g);
      if (g.players.length === 0) { g.status = 'finished'; }
    }
    if (g.players.length === 0) {
      g.status = 'finished';
      this.pushActivity(roomId, `Game ended — no players`, 'game_end');
      // keep finished state for 30s then clear (allows immediate new game after finished)
      setTimeout(() => { if (this.games.get(roomId) === g) this.games.delete(roomId); }, 10_000);
    }
  }

  // ── Word Chain actions ──
  private advanceWordChainTurn(state: WordChainEngagementState) {
    if (state.players.length === 0) { state.status = 'finished'; return; }
    const idx = state.players.findIndex(p => p.userId === state.currentTurnUserId);
    const next = (idx + 1) % state.players.length;
    state.currentTurnUserId = state.players[next].userId;
    state.turnStartedAt = Date.now();
  }

  submitWordChain(roomId: string, userId: string, raw: string) {
    const g = this.games.get(roomId) as WordChainEngagementState;
    if (!g || g.type !== 'word_chain') return { ok: false, error: 'No word chain game' };
    if (g.status !== 'active') return { ok: false, error: 'Game not active' };
    if (g.currentTurnUserId !== userId) return { ok: false, error: 'Not your turn!' };
    const word = raw.trim().toUpperCase();
    if (word.length < 2) return { ok: false, error: 'Too short (2+)' };
    const need = g.currentWord.charAt(g.currentWord.length - 1);
    if (word.charAt(0) !== need) return { ok: false, error: `Must start with '${need}' from "${g.currentWord}"` };
    if (g.usedWords.includes(word)) return { ok: false, error: 'Already used!' };
    if (!this.dict.isValidWord(word)) return { ok: false, error: `"${word}" not in dictionary` };
    const elapsed = Math.max(1, (Date.now() - g.turnStartedAt) / 1000);
    const speedBonus = elapsed <= 5 ? 10 : elapsed <= 10 ? 5 : 0;
    const lenBonus = Math.max(0, (word.length - 4) * 2);
    const pts = 10 + speedBonus + lenBonus;
    g.currentWord = word;
    g.usedWords.push(word);
    const pl = g.players.find(p => p.userId === userId);
    if (pl) { pl.score += pts; g.streaks[userId] = (g.streaks[userId] || 0) + 1; }
    g.lastScorer = { userId, word, points: pts };
    this.advanceWordChainTurn(g);
    return { ok: true, state: g, points: pts };
  }

  // ── 20Q actions ──
  askTwentyQ(roomId: string, userId: string, question: string, pseudonym: string) {
    const g = this.games.get(roomId) as TwentyQState;
    if (!g || g.type !== 'twenty_q') return { ok: false, error: 'No 20Q game' };
    if (g.status !== 'active') return { ok: false, error: 'Game finished' };
    if (g.remaining <= 0) return { ok: false, error: 'No questions left' };
    const q = question.trim().slice(0, 80);
    if (q.length < 4) return { ok: false, error: 'Ask a full yes/no question (4+ chars)' };
    // find secret for answer
    const secret = { word: g.secretWord, category: g.secretCategory, hint: g.secretHint, tags: (require('./twentyQuestionsData').SECRETS.find((s:any)=>s.word===g.secretWord)?.tags || {}) } as any;
    // need full secret def for answer
    const full = (require('./twentyQuestionsData').SECRETS.find((s:any)=>s.word===g.secretWord) );
    const ans = full ? answerQuestion(full, q) : 'maybe';
    g.asked.push({ q, a: ans as any, askerId: userId, askerName: pseudonym, at: Date.now() });
    g.remaining = 20 - g.asked.length;
    // ensure player joined
    if (!g.players.some(p => p.userId === userId)) g.players.push({ userId, pseudonym, username: `@${pseudonym}`, avatarId: 'av', avatarBg: '#6366f1', score: 0, joinedAt: Date.now() });
    if (g.remaining === 0) g.status = 'round_over';
    return { ok: true, state: g, answer: ans };
  }
  guessTwentyQ(roomId: string, userId: string, guess: string) {
    const g = this.games.get(roomId) as TwentyQState;
    if (!g || g.type !== 'twenty_q') return { ok: false, error: 'No 20Q game' };
    if (g.status !== 'active' && g.status !== 'round_over') return { ok: false, error: 'Game finished' };
    const clean = guess.trim().toLowerCase();
    const correct = clean === g.secretWord.toLowerCase();
    g.guessAttempts.push({ guess, userId, correct, at: Date.now() });
    if (correct) {
      g.winnerId = userId;
      g.status = 'finished';
      const winner = g.players.find(p => p.userId === userId);
      if (winner) winner.score += 50;
      this.pushActivity(roomId, `${g.secretWord} guessed! Winner ${winner?.pseudonym || userId}`, 'game_end');
      setTimeout(()=> { if(this.games.get(roomId)===g) this.games.delete(roomId); }, 45_000);
    } else {
      if (g.status === 'round_over' && g.guessAttempts.length >= 3 && !g.winnerId) {
        g.status = 'finished';
        this.pushActivity(roomId, `20Q over — secret was ${g.secretWord}`, 'game_end');
        setTimeout(()=> { if(this.games.get(roomId)===g) this.games.delete(roomId); }, 45_000);
      }
    }
    return { ok: true, state: g, correct };
  }

  // ── Trivia actions ──
  answerTrivia(roomId: string, userId: string, choice: number) {
    const g = this.games.get(roomId) as TriviaState;
    if (!g || g.type !== 'trivia') return { ok: false, error: 'No trivia' };
    if (g.status !== 'active') return { ok: false, error: 'Game not active' };
    if (g.currentIndex >= g.questions.length) return { ok: false, error: 'Finished' };
    if (g.answers[userId] !== undefined && g.answers[userId] !== null) return { ok: false, error: 'Already answered this Q' };
    g.answers[userId] = choice;
    // ensure player exists
    if (!g.players.some(p => p.userId === userId)) {
      // auto-join
      g.players.push({ userId, pseudonym: 'Guest', username: '@guest', avatarId: 'av', avatarBg: '#6366f1', score: 0, joinedAt: Date.now(), streak: 0 } as any);
      if (g.scores[userId] === undefined) g.scores[userId] = 0;
    }
    return { ok: true, state: g };
  }

  // ── Prompt actions ──
  submitPrompt(roomId: string, user: UserProfile, content: string) {
    const g = this.games.get(roomId) as PromptState;
    if (!g || g.type !== 'prompt') return { ok: false, error: 'No prompt game' };
    if (g.status !== 'active') return { ok: false, error: 'Prompt wall closed' };
    if (Date.now() > g.expiresAt) { g.status = 'finished'; return { ok: false, error: 'Time up — prompt expired' }; }
    const clean = content.trim().slice(0, 40);
    if (clean.length < 2) return { ok: false, error: 'Write 2+ chars' };
    // moderation quick check: block urls
    if (/https?:\/\//i.test(clean)) return { ok: false, error: 'Links not allowed' };
    const sub: PromptSubmission = {
      id: `sub_${Date.now()}_${user.id.slice(0,4)}`,
      userId: user.id, pseudonym: user.pseudonym, avatarBg: user.avatarBg, content: clean, promptId: g.currentPrompt.id, timestamp: Date.now(), reactions: {}, reactedUsers: {}
    };
    g.submissions.push(sub);
    if (g.submissions.length > 50) g.submissions = g.submissions.slice(-50);
    if (!g.players.some(p => p.userId === user.id)) g.players.push(toPlayer(user));
    const pl = g.players.find(p => p.userId === user.id);
    if (pl) pl.score += 5;
    return { ok: true, state: g, submission: sub };
  }

  rotatePrompt(roomId: string) {
    const g = this.games.get(roomId) as PromptState;
    if (!g || g.type !== 'prompt') return null;
    const newP = pickPrompt();
    g.currentPrompt = newP;
    g.expiresAt = Date.now() + 4 * 60 * 1000;
    g.submissions = [];
    return g;
  }

  // ── Reactions ──
  toggleReaction(targetId: string, targetType: 'message' | 'profile' | 'submission', userId: string, emoji: string) {
    const key = targetId;
    let rs = this.reactions.get(key);
    if (!rs) {
      rs = { targetId, targetType, counts: {}, users: {}, total: 0 };
      this.reactions.set(key, rs);
      // Bound memory and snapshot size: every snapshot ships all reactions, so
      // evict the oldest targets (Map keeps insertion order).
      while (this.reactions.size > 2000) {
        const oldest = this.reactions.keys().next().value;
        if (oldest === undefined) break;
        this.reactions.delete(oldest);
      }
    }
    if (!rs.counts[emoji]) rs.counts[emoji] = 0;
    if (!rs.users[emoji]) rs.users[emoji] = [];
    const has = rs.users[emoji].includes(userId);
    if (has) {
      rs.users[emoji] = rs.users[emoji].filter(id => id !== userId);
      rs.counts[emoji] = Math.max(0, rs.counts[emoji] - 1);
      if (rs.counts[emoji] === 0) delete rs.counts[emoji];
      rs.total = Math.max(0, rs.total - 1);
      // also handle submission reactions if prompt
      for (const g of this.games.values()) {
        if (g.type === 'prompt') {
          const sub = (g as PromptState).submissions.find(s => s.id === targetId);
          if (sub) {
            if (sub.reactions[emoji]) sub.reactions[emoji] = Math.max(0, sub.reactions[emoji] - 1);
            if (sub.reactedUsers[emoji]) sub.reactedUsers[emoji] = sub.reactedUsers[emoji].filter(id => id !== userId);
          }
        }
      }
      return { ok: true, action: 'removed', state: rs };
    } else {
      rs.users[emoji].push(userId);
      rs.counts[emoji] = (rs.counts[emoji] || 0) + 1;
      rs.total += 1;
      for (const g of this.games.values()) {
        if (g.type === 'prompt') {
          const sub = (g as PromptState).submissions.find(s => s.id === targetId);
          if (sub) {
            sub.reactions[emoji] = (sub.reactions[emoji] || 0) + 1;
            if (!sub.reactedUsers[emoji]) sub.reactedUsers[emoji] = [];
            sub.reactedUsers[emoji].push(userId);
          }
        }
      }
      return { ok: true, action: 'added', state: rs };
    }
  }

  getReaction(targetId: string) { return this.reactions.get(targetId) || null; }

  // ── Tick: timers for trivia, word chain timeout, prompt expiry ──
  private tick() {
    const now = Date.now();
    for (const [roomId, g] of this.games.entries()) {
      if (g.type === 'word_chain' && g.status === 'active') {
        const elapsed = now - (g as WordChainEngagementState).turnStartedAt;
        if (elapsed > (g as WordChainEngagementState).turnDurationSeconds * 1000) {
          const state = g as WordChainEngagementState;
          const timedOut = state.currentTurnUserId;
          const pl = state.players.find(p => p.userId === timedOut);
          if (pl) {
            state.lives[timedOut] = Math.max(0, (state.lives[timedOut] || 3) - 1);
            state.streaks[timedOut] = 0;
            if (state.lives[timedOut] <= 0) {
              state.players = state.players.filter(p => p.userId !== timedOut);
              delete state.lives[timedOut]; delete state.streaks[timedOut];
              if (state.players.length === 0) { state.status = 'finished'; this.pushActivity(roomId, `Word Chain finished — ${state.currentWord}`, 'game_end'); continue; }
            }
          }
          // advance
          if (state.players.length) {
            const idx = state.players.findIndex(p => p.userId === state.currentTurnUserId);
            const next = (idx + 1) % state.players.length;
            state.currentTurnUserId = state.players[next].userId;
            state.turnStartedAt = now;
          }
        }
      } else if (g.type === 'trivia' && g.status === 'active') {
        const t = g as TriviaState;
        if (now >= t.currentEndsAt) {
          // reveal this Q
          const q = t.questions[t.currentIndex];
          if (q) {
            t.reveals.push({ qIndex: t.currentIndex, correct: q.correctIndex, at: now });
            // score players who answered correctly
            for (const [uid, ans] of Object.entries(t.answers)) {
              if (ans === q.correctIndex) {
                t.scores[uid] = (t.scores[uid] || 0) + 10 + (t.players.find(p=>p.userId===uid) ? 0 : 0);
                const pp = t.players.find(p=>p.userId===uid) as any;
                if (pp) { pp.score = t.scores[uid]; pp.streak = (pp.streak || 0) + 1; }
              } else {
                const pp = t.players.find(p=>p.userId===uid) as any;
                if (pp) pp.streak = 0;
              }
            }
            // next question
            t.currentIndex += 1;
            t.answers = {};
            if (t.currentIndex >= t.questions.length) {
              t.status = 'finished';
              this.pushActivity(roomId, `Trivia finished — ${t.players.length} played`, 'game_end');
              setTimeout(()=> { if(this.games.get(roomId)===t) this.games.delete(roomId); }, 60_000);
            } else {
              t.currentEndsAt = now + 15_000;
            }
          }
        }
      } else if (g.type === 'prompt' && g.status === 'active') {
        if (now > (g as PromptState).expiresAt) {
          (g as PromptState).status = 'finished';
          this.pushActivity(roomId, `Prompt "${(g as PromptState).currentPrompt.text}" closed — ${(g as PromptState).submissions.length} sharings`, 'game_end');
          setTimeout(()=> { if(this.games.get(roomId)===g) this.games.delete(roomId); }, 60_000);
        }
      } else if (g.type === 'twenty_q' && g.status === 'active') {
        // no timer, but auto-finish after 5 min of inactivity?
        if (now - g.startedAt > 5 * 60 * 1000) {
          g.status = 'finished';
          this.pushActivity(roomId, `20Q finished — secret was ${g.secretWord}`, 'game_end');
          setTimeout(()=> { if(this.games.get(roomId)===g) this.games.delete(roomId); }, 30_000);
        }
      }
    }
  }
}
