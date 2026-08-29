export type GameType = 'word_chain' | 'twenty_q' | 'trivia' | 'prompt';
export type GameStatus = 'lobby' | 'active' | 'round_over' | 'finished';

export interface EngagementPlayer {
  userId: string;
  pseudonym: string;
  username: string;
  avatarId: string;
  avatarBg: string;
  score: number;
  joinedAt: number;
}

export interface WordChainState {
  gameId: string;
  roomId: string;
  type: 'word_chain';
  status: GameStatus;
  currentWord: string;
  currentTurnUserId: string;
  turnStartedAt: number;
  turnDurationSeconds: number;
  usedWords: string[];
  players: EngagementPlayer[];
  roundNumber: number;
  lastScorer?: { userId: string; word: string; points: number };
  lives: Record<string, number>;
  streaks: Record<string, number>;
}

export interface TwentyQState {
  gameId: string;
  roomId: string;
  type: 'twenty_q';
  status: GameStatus;
  secretWord: string;
  secretCategory: string;
  secretHint: string;
  asked: { q: string; a: 'yes' | 'no' | 'maybe'; askerId: string; askerName: string; at: number }[];
  remaining: number;
  players: EngagementPlayer[];
  guessAttempts: { guess: string; userId: string; correct: boolean; at: number }[];
  winnerId?: string;
  startedAt: number;
}

export interface TriviaState {
  gameId: string;
  roomId: string;
  type: 'trivia';
  status: GameStatus;
  players: (EngagementPlayer & { streak: number })[];
  questions: { id: string; text: string; textHi?: string; options: string[]; correctIndex: number; category: string }[];
  currentIndex: number;
  currentEndsAt: number;
  answers: Record<string, number | null>;
  scores: Record<string, number>;
  startedAt: number;
  reveals: { qIndex: number; correct: number; at: number }[];
}

export interface PromptState {
  gameId: string;
  roomId: string;
  type: 'prompt';
  status: GameStatus;
  currentPrompt: { id: string; text: string; textHi?: string; emoji: string; category: string };
  players: EngagementPlayer[];
  submissions: { id: string; userId: string; pseudonym: string; avatarBg: string; content: string; promptId: string; timestamp: number; reactions: Record<string, number>; reactedUsers: Record<string, string[]> }[];
  expiresAt: number;
  startedAt: number;
}

export type AnyGameState = WordChainState | TwentyQState | TriviaState | PromptState;

export interface ReactionState {
  targetId: string;
  targetType: 'message' | 'profile' | 'submission';
  counts: Record<string, number>;
  users: Record<string, string[]>;
  total: number;
}

export interface EngagementSnapshot {
  roomId: string;
  activeGame: AnyGameState | null;
  queue: any[];
  reactions: Record<string, ReactionState>;
  leaderboard: { userId: string; pseudonym: string; avatarBg: string; score: number }[];
  activityFeed: { id: string; text: string; at: number; type: 'game_start' | 'game_end' | 'reaction' | 'join' }[];
}
