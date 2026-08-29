export type ActivityType = 'STILL' | 'WALKING' | 'IN_VEHICLE';
export type RoomMode = 'STATION_LOUNGE' | 'TRAIN_COACH';
export type PresenceTier = 'active' | 'nearby' | 'other';
export type ContextType = 'station' | 'train' | 'nearby';

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
  username: string;
  pseudonym: string;
  avatarId: string;
  avatarBg: string;
  interestTags: string[];
  collegeOrTag?: string;
  bio?: string;
  languages?: string[];
  favoriteStationId?: string;
  favoriteLineId?: string;
  vibeTagline?: string;
  activity: ActivityType;
  joinedAt: number;
  karmaScore: number;
  // phone removed — no phone field
  isVerifiedPhone?: boolean;
  presenceTier?: PresenceTier;
  trustTier?: 'newcomer' | 'regular' | 'trusted' | 'verified';
  trustBadge?: string;
}

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

export interface ConfidenceBreakdown {
  stationMatch: number;
  routeMatch: number;
  movementMatch: number;
  scheduleMatch: number;
  userConfirm: number;
}

export interface ContextResult {
  id: string;
  station: string;
  stationName: string;
  line: string;
  lineName: string;
  lineColor: string;
  direction: string;
  context: ContextType;
  confidence: number;
  rawScore: number;
  trainId?: string;
  scheduleInfo?: TrainScheduleInfo;
  breakdown: ConfidenceBreakdown;
  reason: string;
}

export interface ContextRoom {
  id: string;
  type: 'station' | 'train';
  lineId: string;
  lineName: string;
  lineColor: string;
  stationId: string;
  stationName: string;
  direction?: string;
  trainId?: string;
  scheduleLabel?: string;
  users: UserProfile[];
  userCount: number;
  presence: { active: number; nearby: number; other: number; total: number };
  messages: RoomMessage[];
  createdAt: number;
  expiresAt: number;
}

export interface ConnectionRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromProfile?: UserProfile;
  status: 'pending' | 'accepted' | 'declined' | 'blocked';
  contextLine: string;
  contextStation: string;
  createdAt: number;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: number;
  read: boolean;
}

export interface FriendEntry {
  id: string;
  profile: UserProfile;
  presenceTier: PresenceTier;
}

export interface RankedTraveler {
  profile: UserProfile;
  score: number;
  breakdown: { mutual: number; presence: number; trust: number; college: number; recency: number; total: number };
  mutualTags: string[];
  mutualCount: number;
  trustTier: string;
  trustBadge: string;
}

export interface CommutePattern {
  id: string;
  userId: string;
  lineId: string;
  lineName: string;
  lineColor: string;
  stationId: string;
  stationName: string;
  direction: string;
  targetTime: string;
  daysOfWeek: string[];
  isActive: boolean;
  label?: string;
  createdAt: number;
  lastUsedAt?: number;
  useCount: number;
}

// Backward compat aliases
export type SavedCommuteRoute = CommutePattern;
export type RealSignalInferenceResult = ContextResult;
export type TrainRoom = ContextRoom;
export type CoRideRoom = ContextRoom;
export type ZeroInputInferenceResult = ContextResult;
