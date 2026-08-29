import type { UserProfile } from '../../types';

// Base player for engagement
export interface EngagementPlayer {
  userId: string;
  pseudonym: string;
  username: string;
  avatarId: string;
  avatarBg: string;
  score: number;
  joinedAt: number;
}

export type GameType = 'word_chain' | 'twenty_q' | 'trivia' | 'prompt' | 'reaction';
export type GameStatus = 'lobby' | 'active' | 'round_over' | 'finished';

// Word Chain (reuse but normalized to engagement)
export interface WordChainEngagementState {
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
  lives: Record<string, number>; // userId -> lives
  streaks: Record<string, number>;
}

// 20 Questions
export interface TwentyQState {
  gameId: string;
  roomId: string;
  type: 'twenty_q';
  status: GameStatus;
  secretWord: string;
  secretCategory: string; // e.g. Food, Place, Object
  secretHint: string; // category hint shown
  asked: { q: string; a: 'yes' | 'no' | 'maybe'; askerId: string; askerName: string; at: number }[];
  remaining: number; // 20 - asked.length
  players: EngagementPlayer[];
  guessAttempts: { guess: string; userId: string; correct: boolean; at: number }[];
  winnerId?: string;
  startedAt: number;
  host?: string; // bot for now
}

// Fast Trivia
export interface TriviaQuestion {
  id: string;
  text: string;
  textHi?: string; // Hindi friendly
  options: string[]; // 4
  correctIndex: number;
  category: string;
  difficulty: 'easy' | 'medium';
}

export interface TriviaState {
  gameId: string;
  roomId: string;
  type: 'trivia';
  status: GameStatus;
  players: (EngagementPlayer & { streak: number })[];
  questions: TriviaQuestion[];
  currentIndex: number;
  currentEndsAt: number;
  answers: Record<string, number | null>; // userId -> chosen index for current
  scores: Record<string, number>;
  startedAt: number;
  reveals: { qIndex: number; correct: number; at: number }[];
}

// Prompt Wall
export interface PromptCard {
  id: string;
  text: string;
  textHi?: string;
  emoji: string;
  category: 'icebreaker' | 'would_you_rather' | 'commute' | 'this_or_that';
}

export interface PromptSubmission {
  id: string;
  userId: string;
  pseudonym: string;
  avatarBg: string;
  content: string;
  promptId: string;
  timestamp: number;
  reactions: Record<string, number>; // emoji -> count
  reactedUsers: Record<string, string[]>; // emoji -> userIds
}

export interface PromptState {
  gameId: string;
  roomId: string;
  type: 'prompt';
  status: GameStatus;
  currentPrompt: PromptCard;
  players: EngagementPlayer[];
  submissions: PromptSubmission[];
  expiresAt: number; // 4 min session
  startedAt: number;
}

// Reactions (for messages & traveler cards)
export type ReactionEmoji = '❤️' | '😂' | '🔥' | '👏' | '😮' | '🙏' | '👍' | '☕' | '🎧' | '🚇';

export interface ReactionState {
  targetId: string; // messageId or userId
  targetType: 'message' | 'profile' | 'submission';
  counts: Record<string, number>;
  users: Record<string, string[]>; // emoji -> userIds
  total: number;
}

// Unified engagement snapshot for client
export type EngagementSnapshot = {
  roomId: string;
  activeGame: WordChainEngagementState | TwentyQState | TriviaState | PromptState | null;
  queue: PromptCard[]; // not used
  reactions: Record<string, ReactionState>; // targetId -> state
  leaderboard: { userId: string; pseudonym: string; avatarBg: string; score: number }[];
  activityFeed: { id: string; text: string; at: number; type: 'game_start' | 'game_end' | 'reaction' | 'join' }[];
};
