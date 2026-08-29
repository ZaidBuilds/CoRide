import { WordChainState, WordChainPlayer, UserProfile } from '../types';
import { DictionaryService } from './dictionaryService';

export class WordChainEngine {
  private dictionary = DictionaryService.getInstance();

  public createInitialState(roomId: string, initialPlayers: UserProfile[]): WordChainState {
    const startingWord = this.dictionary.getRandomWord();
    const players: WordChainPlayer[] = initialPlayers.map(p => ({
      userId: p.id,
      username: p.username || `@${p.pseudonym}`,
      pseudonym: p.pseudonym,
      avatarId: p.avatarId,
      avatarBg: p.avatarBg,
      score: 0,
      streak: 0,
      lives: 3
    }));

    const firstPlayerId = players.length > 0 ? players[0].userId : '';

    return {
      gameId: `wc_${roomId}_${Date.now()}`,
      roomId,
      status: players.length >= 1 ? 'active' : 'idle',
      currentWord: startingWord.toUpperCase(),
      currentTurnUserId: firstPlayerId,
      turnStartedAt: Date.now(),
      turnDurationSeconds: 15,
      usedWords: [startingWord.toUpperCase()],
      players,
      roundNumber: 1
    };
  }

  public addPlayer(state: WordChainState, user: UserProfile): WordChainState {
    const existing = state.players.find(p => p.userId === user.id);
    if (!existing) {
      state.players.push({
        userId: user.id,
        username: user.username || `@${user.pseudonym}`,
        pseudonym: user.pseudonym,
        avatarId: user.avatarId,
        avatarBg: user.avatarBg,
        score: 0,
        streak: 0,
        lives: 3
      });
      if (state.status === 'idle') {
        state.status = 'active';
        state.currentTurnUserId = user.id;
        state.turnStartedAt = Date.now();
      }
    }
    return state;
  }

  public removePlayer(state: WordChainState, userId: string): WordChainState {
    const wasCurrentTurn = state.currentTurnUserId === userId;
    state.players = state.players.filter(p => p.userId !== userId);

    if (state.players.length === 0) {
      state.status = 'idle';
      state.currentTurnUserId = '';
    } else if (wasCurrentTurn) {
      this.advanceTurn(state);
    }
    return state;
  }

  public submitWord(
    state: WordChainState,
    userId: string,
    rawWord: string
  ): { success: boolean; message: string; pointsAwarded: number } {
    if (state.status !== 'active') {
      return { success: false, message: 'Game is currently paused or inactive.', pointsAwarded: 0 };
    }

    if (state.currentTurnUserId !== userId) {
      return { success: false, message: 'Not your turn!', pointsAwarded: 0 };
    }

    const word = rawWord.trim().toUpperCase();
    if (word.length < 2) {
      return { success: false, message: 'Word is too short (minimum 2 letters).', pointsAwarded: 0 };
    }

    const lastWord = state.currentWord;
    const requiredLetter = lastWord.charAt(lastWord.length - 1);
    if (word.charAt(0) !== requiredLetter) {
      return {
        success: false,
        message: `Word must start with '${requiredLetter}'! (From "${lastWord}")`,
        pointsAwarded: 0
      };
    }

    if (state.usedWords.includes(word)) {
      return { success: false, message: `"${word}" has already been used in this round!`, pointsAwarded: 0 };
    }

    if (!this.dictionary.isValidWord(word)) {
      return { success: false, message: `"${word}" is not a recognized English word.`, pointsAwarded: 0 };
    }

    const elapsedSeconds = Math.max(1, (Date.now() - state.turnStartedAt) / 1000);
    const speedBonus = elapsedSeconds <= 5 ? 10 : elapsedSeconds <= 10 ? 5 : 0;
    const lengthBonus = Math.max(0, (word.length - 4) * 2);
    const points = 10 + speedBonus + lengthBonus;

    state.currentWord = word;
    state.usedWords.push(word);

    const player = state.players.find(p => p.userId === userId);
    if (player) {
      player.score += points;
      player.streak += 1;
    }

    state.lastScorer = {
      userId,
      word,
      points
    };

    this.advanceTurn(state);

    return { success: true, message: `+${points} pts! Great word!`, pointsAwarded: points };
  }

  public advanceTurn(state: WordChainState): void {
    if (state.players.length === 0) {
      state.status = 'idle';
      state.currentTurnUserId = '';
      return;
    }

    const currentIndex = state.players.findIndex(p => p.userId === state.currentTurnUserId);
    const nextIndex = (currentIndex + 1) % state.players.length;
    state.currentTurnUserId = state.players[nextIndex].userId;
    state.turnStartedAt = Date.now();
  }

  public handleTimeout(state: WordChainState): { timedOutUser: string | null; nextUser: string | null } {
    if (state.status !== 'active' || !state.currentTurnUserId) {
      return { timedOutUser: null, nextUser: null };
    }

    const timedOutUser = state.currentTurnUserId;
    const player = state.players.find(p => p.userId === timedOutUser);
    if (player) {
      player.streak = 0;
      player.lives = Math.max(0, player.lives - 1);
    }

    this.advanceTurn(state);
    return { timedOutUser, nextUser: state.currentTurnUserId };
  }
}
