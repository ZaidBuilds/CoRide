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

/**
 * Tinted-chip colours derived from one semantic colour, so a badge reads in
 * both light and dark themes: the fill/border are translucent washes of the
 * colour and the label mixes it toward --text-primary for contrast.
 */
function tint(color: string) {
  return {
    bgColor: `color-mix(in srgb, ${color} 14%, transparent)`,
    borderColor: `color-mix(in srgb, ${color} 34%, transparent)`,
    textColor: `color-mix(in srgb, ${color} 55%, var(--text-primary))`,
    dotColor: color
  };
}

export const COMMUTE_BADGES: Record<CommuteRelationshipType, CommuteBadgeInfo> = {
  same_train: {
    type: 'same_train',
    label: 'Same train',
    emoji: '🚇',
    ...tint('var(--presence-sameTrain, #38bdf8)'),
    description: 'On the same train as you right now'
  },
  same_direction: {
    type: 'same_direction',
    label: 'Same line & direction',
    emoji: '🔀',
    ...tint('var(--accent-emerald, #10b981)'),
    description: 'Riding this line in the same direction'
  },
  same_station: {
    type: 'same_station',
    label: 'Same station',
    emoji: '🏛️',
    ...tint('var(--line-airport, #f97316)'),
    description: 'At the same station as you'
  },
  nearby: {
    type: 'nearby',
    label: 'Nearby',
    emoji: '🟡',
    ...tint('var(--presence-nearby, #d97706)'),
    description: 'Close by on the metro network'
  },
  metro_friend: {
    type: 'metro_friend',
    label: 'Friend',
    emoji: '👥',
    ...tint('var(--accent-purple, #7b5dff)'),
    description: 'Someone you are connected with'
  },
  none: {
    type: 'none',
    label: 'Commuter',
    emoji: '🚆',
    ...tint('var(--text-muted, #6b7382)'),
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

// ─── Location honesty (DESIGN §9) ───────────────────────────────────────────

/** Minimum confidence to state "At <station>" / "On the train" without a question mark. */
export const CONFIDENT_CONTEXT = 0.6;

export interface ContextHeadline {
  /** "At Rajiv Chowk", "On the Blue Line", "Near Karol Bagh?", "Where are you?" */
  headline: string;
  /** Meta line: the signal we used, e.g. "GPS · ±20 m", "Your pick", "Last check-in · 4 min ago". */
  meta: string;
  /** Offer one-tap confirm / change. */
  needsConfirm: boolean;
}

type HeadlineInput = Pick<ContextResult, 'context' | 'confidence' | 'stationName' | 'lineName'> & {
  source?: 'gps' | 'manual' | 'last_checkin' | 'schedule' | 'none';
  between?: { fromStationName: string; toStationName: string } | null;
  accuracyM?: number | null;
  lastFixAt?: number | null;
  stale?: boolean;
};

/** Words for a detected context that never claim more than the confidence supports. */
export function describeContext(ctx: HeadlineInput | null, now: number = Date.now()): ContextHeadline {
  if (!ctx || ctx.source === 'none' || !ctx.stationName) {
    return { headline: 'Where are you?', meta: 'Pick your station', needsConfirm: true };
  }
  const sure = ctx.confidence >= CONFIDENT_CONTEXT && !ctx.stale;
  let headline: string;
  if (ctx.context === 'train' && sure) {
    headline = ctx.between ? `On the ${ctx.lineName} · ${ctx.between.fromStationName} → ${ctx.between.toStationName}` : `On the ${ctx.lineName}`;
  } else if (ctx.context === 'station' && sure) {
    headline = `At ${ctx.stationName}`;
  } else {
    headline = `Near ${ctx.stationName}?`;
  }
  const ago = ctx.lastFixAt ? Math.max(0, Math.round((now - ctx.lastFixAt) / 60_000)) : null;
  const meta = ctx.source === 'manual' ? 'Your pick'
    : ctx.source === 'schedule' ? 'Estimated from train times'
    : ctx.source === 'last_checkin' ? `Last check-in${ago !== null ? ` · ${ago <= 1 ? '1 min' : `${ago} min`} ago` : ''}`
    : `GPS${ctx.accuracyM ? ` · ±${Math.round(ctx.accuracyM)} m` : ''}`;
  return { headline, meta, needsConfirm: !sure && ctx.source !== 'manual' };
}
