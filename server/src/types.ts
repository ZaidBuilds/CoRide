export type ActivityType = 'STILL' | 'WALKING' | 'IN_VEHICLE';

export type RoomMode = 'STATION_LOUNGE' | 'TRAIN_COACH';

export interface MetroStation {
  id: string;
  name: string;
  hindiName: string;
  lat: number;
  lng: number;
  lineId: string;
  order: number;
  isInterchange: boolean;
  interchangeLines?: string[];
  isUnderground: boolean;
  cellTowerId?: string;
  averagePressureHpa?: number;
}

export interface MetroLine {
  id: string;
  name: string;
  color: string;
  accentColor: string;
  terminalA: string;
  terminalB: string;
  stations: MetroStation[];
}

export interface UserProfile {
  id: string;
  username: string; // @username Telegram-style
  pseudonym: string;
  avatarId: string;
  avatarBg: string;
  interestTags: string[]; // e.g. ["music", "memes"] — max 5, curated taxonomy
  collegeOrTag?: string;
  bio?: string; // optional public enhancements — up to 120 chars
  languages?: string[]; // e.g. ["en","hi"]
  favoriteStationId?: string;
  favoriteLineId?: string;
  vibeTagline?: string; // short 30 char public line
  activity: ActivityType; // STILL, WALKING, IN_VEHICLE
  joinedAt: number;
  karmaScore: number;
  // phone removed — no phone verification for MVP (real data via presence + reputation)
  isVerifiedPhone?: boolean;
  trustTier?: 'newcomer' | 'regular' | 'trusted' | 'verified';
}

// Interest taxonomy for personalization (MVP4)
export const INTEREST_TAXONOMY: { id: string; label: string; emoji: string; category: string }[] = [
  { id: 'music', label: 'Music', emoji: '🎵', category: 'culture' },
  { id: 'coding', label: 'Coding', emoji: '💻', category: 'tech' },
  { id: 'books', label: 'Books', emoji: '📚', category: 'culture' },
  { id: 'gaming', label: 'Gaming', emoji: '🎮', category: 'play' },
  { id: 'cricket', label: 'Cricket', emoji: '🏏', category: 'sports' },
  { id: 'food', label: 'Food', emoji: '🍛', category: 'lifestyle' },
  { id: 'travel', label: 'Travel', emoji: '✈️', category: 'lifestyle' },
  { id: 'photography', label: 'Photography', emoji: '📸', category: 'culture' },
  { id: 'fitness', label: 'Fitness', emoji: '💪', category: 'sports' },
  { id: 'movies', label: 'Movies', emoji: '🎬', category: 'culture' },
  { id: 'anime', label: 'Anime', emoji: '🌸', category: 'play' },
  { id: 'art', label: 'Art', emoji: '🎨', category: 'culture' },
  { id: 'design', label: 'Design', emoji: '🎨', category: 'tech' },
  { id: 'coffee', label: 'Coffee', emoji: '☕', category: 'lifestyle' },
  { id: 'memes', label: 'Memes', emoji: '😂', category: 'play' },
  { id: 'tech', label: 'Tech', emoji: '⚡', category: 'tech' },
  { id: 'startups', label: 'Startups', emoji: '🚀', category: 'tech' },
  { id: 'football', label: 'Football', emoji: '⚽', category: 'sports' },
  { id: 'yoga', label: 'Yoga', emoji: '🧘', category: 'sports' },
  { id: 'dance', label: 'Dance', emoji: '💃', category: 'culture' },
  { id: 'chai', label: 'Chai', emoji: '☕', category: 'lifestyle' },
  { id: 'biryani', label: 'Biryani', emoji: '🍚', category: 'lifestyle' },
  { id: 'du_campus', label: 'DU Campus', emoji: '🎓', category: 'campus' },
  { id: 'hostel', label: 'Hostel', emoji: '🏠', category: 'campus' },
  { id: 'spotify', label: 'Spotify', emoji: '🎧', category: 'culture' },
  { id: 'explore', label: 'Explore', emoji: '🧭', category: 'lifestyle' },
];

export function isValidInterestTag(tag: string): boolean {
  return INTEREST_TAXONOMY.some(t => t.id === tag.toLowerCase());
}
export function sanitizeTags(tags: string[]): string[] {
  const cleaned = tags.map(t => t.toLowerCase().trim()).filter(isValidInterestTag);
  return Array.from(new Set(cleaned)).slice(0, 5);
}

export interface TrainScheduleInfo {
  trainId: string;
  lineId: string;
  direction: string;
  departureTimeFormatted: string;
  trainLabel: string;
  currentStationName: string;
  nextStationName: string;
  estimatedArrivalSeconds: number;
  dwellSeconds: number;
}

export interface RoomMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderUsername: string;
  senderPseudonym: string;
  senderAvatarId: string;
  senderAvatarBg: string;
  content: string;
  timestamp: number;
  isSystem?: boolean;
  type?: 'text' | 'game_alert' | 'join_alert' | 'transition_alert';
}

export interface WordChainPlayer {
  userId: string;
  username: string;
  pseudonym: string;
  avatarId: string;
  avatarBg: string;
  score: number;
  streak: number;
  lives: number;
}

export interface WordChainState {
  gameId: string;
  roomId: string;
  status: 'idle' | 'active' | 'round_over';
  currentWord: string;
  currentTurnUserId: string;
  turnStartedAt: number;
  turnDurationSeconds: number;
  usedWords: string[];
  players: WordChainPlayer[];
  roundNumber: number;
  lastScorer?: {
    userId: string;
    word: string;
    points: number;
  };
}

export interface CoRideRoom {
  id: string;
  mode: RoomMode; // 'STATION_LOUNGE' | 'TRAIN_COACH'
  lineId: string;
  stationId: string;
  stationName: string;
  direction?: string;
  scheduleInfo?: TrainScheduleInfo;
  createdAt: number;
  expiresAt: number;
  users: Map<string, UserProfile>;
  activeGame?: WordChainState;
  messages: RoomMessage[];
}

export interface MetroFriend {
  id: string;
  friendId: string;
  friendProfile: UserProfile;
  connectedAtLine: string;
  connectedAtStation: string;
  createdAt: number;
  lastMessage?: string;
  lastMessageTimestamp?: number;
  unreadCount: number;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: number;
  read: boolean;
}

export interface ZeroInputDetectionPayload {
  activity: ActivityType; // STILL | WALKING | IN_VEHICLE
  cellTowerId?: string;
  lat?: number;
  lng?: number;
  speedKmh?: number;
}

export interface ZeroInputInferenceResult {
  detected: boolean;
  mode: RoomMode; // 'STATION_LOUNGE' or 'TRAIN_COACH'
  activity: ActivityType;
  station: MetroStation;
  line: MetroLine;
  direction: string;
  speedKmh: number;
  confidence: number;
  scheduleInfo?: TrainScheduleInfo;
  reason: string;
}
