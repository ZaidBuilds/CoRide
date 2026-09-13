import type { UserProfile, ContextResult, RoomPresenceTraveler } from '../types';

export type CommuteRelationshipType = 
  | 'same_train' 
  | 'same_direction' 
  | 'same_station' 
  | 'nearby' 
  | 'metro_friend' 
  | 'none';

export interface CommuteBadgeInfo {
  type: CommuteRelationshipType;
  label: string;
  emoji: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  dotColor: string;
  description: string;
}

export const COMMUTE_BADGES: Record<CommuteRelationshipType, CommuteBadgeInfo> = {
  same_train: {
    type: 'same_train',
    label: 'Same Train',
    emoji: '🚇',
    bgColor: 'rgba(56, 189, 248, 0.14)',
    textColor: 'var(--presence-sameTrain, #38bdf8)',
    borderColor: 'rgba(56, 189, 248, 0.32)',
    dotColor: 'var(--presence-sameTrain, #38bdf8)',
    description: 'Onboard the same train coach service right now'
  },
  same_direction: {
    type: 'same_direction',
    label: 'Same Line & Dir',
    emoji: '🔀',
    bgColor: 'rgba(16, 185, 129, 0.14)',
    textColor: 'var(--accent-emerald, #10b981)',
    borderColor: 'rgba(16, 185, 129, 0.32)',
    dotColor: '#10b981',
    description: 'Traveling on this line in the same direction'
  },
  same_station: {
    type: 'same_station',
    label: 'At Station',
    emoji: '🏛️',
    bgColor: 'rgba(249, 115, 22, 0.14)',
    textColor: '#fb923c',
    borderColor: 'rgba(249, 115, 22, 0.32)',
    dotColor: '#fb923c',
    description: 'Waiting or transferring at the same station hub'
  },
  nearby: {
    type: 'nearby',
    label: 'Nearby',
    emoji: '🟡',
    bgColor: 'rgba(234, 179, 8, 0.14)',
    textColor: 'var(--accent-amber, #eab308)',
    borderColor: 'rgba(234, 179, 8, 0.32)',
    dotColor: 'var(--presence-nearby, #eab308)',
    description: 'In close proximity within the metro network'
  },
  metro_friend: {
    type: 'metro_friend',
    label: 'Metro Friend',
    emoji: '👥',
    bgColor: 'rgba(168, 85, 247, 0.14)',
    textColor: 'var(--accent-purple-text, #a855f7)',
    borderColor: 'rgba(168, 85, 247, 0.32)',
    dotColor: '#a855f7',
    description: 'Connected commuter friend in your network'
  },
  none: {
    type: 'none',
    label: 'Commuter',
    emoji: '🚆',
    bgColor: 'rgba(255, 255, 255, 0.06)',
    textColor: 'var(--text-secondary, #94a3b8)',
    borderColor: 'rgba(255, 255, 255, 0.10)',
    dotColor: '#94a3b8',
    description: 'Fellow Delhi Metro commuter'
  }
};

/**
 * Computes the real-time commute context relation between the active viewer and another traveler.
 */
export function getCommuteRelationship(
  traveler: Partial<UserProfile> | Partial<RoomPresenceTraveler>,
  options: {
    isFriend?: boolean;
    activeRoomId?: string;
    currentContext?: ContextResult | null;
    userPresenceTier?: 'active' | 'nearby' | 'other';
  } = {}
): CommuteBadgeInfo {
  // 1. Friend check takes priority if user is a connected metro friend
  if (options.isFriend || (traveler as any).isMetroFriend) {
    return COMMUTE_BADGES.metro_friend;
  }

  const activeRoomId = options.activeRoomId || '';
  const isTrainRoom = activeRoomId.startsWith('train:') || (options.currentContext?.context === 'train');
  const isStationRoom = activeRoomId.startsWith('station:') || (options.currentContext?.context === 'station');
  const isTripleRoom = activeRoomId.includes(':') && !activeRoomId.startsWith('station:') && !activeRoomId.startsWith('train:');

  const travelerPresenceTier = (traveler as any).presenceTier || options.userPresenceTier;

  // 2. Active in train coach or room
  if (isTrainRoom) {
    if (travelerPresenceTier === 'active') {
      return COMMUTE_BADGES.same_train;
    }
    if (travelerPresenceTier === 'nearby') {
      return COMMUTE_BADGES.nearby;
    }
    return COMMUTE_BADGES.same_direction;
  }

  // 3. Station lounge
  if (isStationRoom) {
    if (travelerPresenceTier === 'nearby') {
      return COMMUTE_BADGES.nearby;
    }
    return COMMUTE_BADGES.same_station;
  }

  // 4. Redis room {station}:{line}:{direction}
  if (isTripleRoom) {
    // If direction matches in room id
    if (travelerPresenceTier === 'active') {
      return COMMUTE_BADGES.same_direction;
    }
    return COMMUTE_BADGES.same_station;
  }

  // 5. Explicit traveler presence tier
  if (travelerPresenceTier === 'active') {
    return COMMUTE_BADGES.same_train;
  }
  if (travelerPresenceTier === 'nearby') {
    return COMMUTE_BADGES.nearby;
  }

  return COMMUTE_BADGES.none;
}
