import { v4 as uuidv4 } from 'uuid';
import type { UserProfile, RoomMessage } from '../types';
import { AVATAR_PALETTE } from '../data/metroData';
import { PresenceManager } from './presenceManager';
import { Persistence } from './persistence';
import type { ContextResult } from './transitContextEngine';

export type ContextType = 'station' | 'train';

export interface ContextRoom {
  id: string;
  type: ContextType;
  lineId: string;
  lineName: string;
  lineColor: string;
  stationId: string;
  stationName: string;
  direction?: string;
  trainId?: string;
  scheduleLabel?: string;
  createdAt: number;
  expiresAt: number;
  userIds: Set<string>;      // just IDs — profiles stored separately
  messages: RoomMessage[];
}

/**
 * Room Manager (v2)
 *
 * Manages context rooms — Station rooms and Train rooms.
 * Users are placed into rooms based on Transit Context Engine output.
 * Presence tiers are handled by PresenceManager separately.
 */
export class RoomManager {
  private static instance: RoomManager;
  private rooms: Map<string, ContextRoom> = new Map();
  private userProfiles: Map<string, UserProfile> = new Map();
  private socketToUser: Map<string, string> = new Map(); // socketId → userId
  private userToRooms: Map<string, Set<string>> = new Map(); // userId → Set<roomId>
  private presence = PresenceManager.getInstance();
  private persistence = Persistence.getInstance();

  private constructor() {
    this.hydrateProfiles();
    setInterval(() => this.cleanup(), 60_000);
  }

  /** Re-read profiles after persistence.init() swapped in the real store (DB mode). */
  public rehydrate(): void {
    this.hydrateProfiles();
  }

  /** Account deletion: forget the in-memory profile copy. */
  public forgetProfile(userId: string): void {
    this.userProfiles.delete(userId);
  }

  /** Keep the in-memory profile copy in sync after an edit. */
  public setProfile(profile: UserProfile): void {
    this.userProfiles.set(profile.id, profile);
  }

  private hydrateProfiles(): void {
    try {
      const store = this.persistence.load();
      for (const [uid, prof] of Object.entries(store.profiles || {})) {
        this.userProfiles.set(uid, prof as UserProfile);
      }
    } catch (e) {
      console.warn('[RoomManager] hydrate profiles failed', e);
    }
  }

  private persistProfile(profile: UserProfile): void {
    try {
      const store = this.persistence.load();
      store.profiles[profile.id] = profile;
      this.persistence.save(store);
    } catch (e) {
      console.error('[RoomManager] persist profile failed', e);
    }
  }

  public static getInstance(): RoomManager {
    if (!RoomManager.instance) {
      RoomManager.instance = new RoomManager();
    }
    return RoomManager.instance;
  }

  // ─── Room Lifecycle ───

  /** Build a room ID from context result */
  public buildRoomId(contextResult: ContextResult): string {
    if (contextResult.context === 'train' && contextResult.trainId) {
      const dir = contextResult.direction.toLowerCase().replace(/[^a-z0-9]/g, '_');
      return `train:${contextResult.line}:${dir}:${contextResult.trainId}`;
    }
    return `station:${contextResult.station}`;
  }

  /** Get or create a room from a context result — MVP2: differentiated TTL */
  public getOrCreateFromContext(ctx: ContextResult): ContextRoom {
    const roomId = this.buildRoomId(ctx);
    let room = this.rooms.get(roomId);

    if (!room) {
      const nowMs = Date.now();
      const isTrain = ctx.context === 'train';
      // Station lounge: 45min ephemeral, Train coach: 25min (ride + buffer)
      const ttlMs = isTrain ? 25 * 60 * 1000 : 45 * 60 * 1000;
      room = {
        id: roomId,
        type: isTrain ? 'train' : 'station',
        lineId: ctx.line,
        lineName: ctx.lineName,
        lineColor: ctx.lineColor,
        stationId: ctx.station,
        stationName: ctx.stationName,
        direction: ctx.direction,
        trainId: ctx.trainId,
        scheduleLabel: ctx.scheduleInfo?.trainLabel,
        createdAt: nowMs,
        expiresAt: nowMs + ttlMs,
        userIds: new Set(),
        messages: []
      };

      // Seed with demo commuters
      this.seedRoom(room);
      this.rooms.set(roomId, room);
    } else {
      // touch ephemeral ttl on reuse — keeps live room alive while active
      const isTrain = room.type === 'train';
      const ttlMs = isTrain ? 25 * 60 * 1000 : 45 * 60 * 1000;
      room.expiresAt = Math.max(room.expiresAt, Date.now() + ttlMs);
    }

    return room;
  }

  /** Touch room ttl on activity */
  public touchRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const ttlMs = room.type === 'train' ? 25 * 60 * 1000 : 45 * 60 * 1000;
    room.expiresAt = Date.now() + ttlMs;
  }

  /** Seed demo commuters into a room — disabled in REAL_DATA mode */
  private seedRoom(room: ContextRoom): void {
    const isReal = process.env.REAL_DATA === 'true' || process.env.MOCK_SEEDS === 'false';
    if (isReal) {
      // Real mode: no mock travelers — welcome reflects real count (0-1)
      const welcomeContent = room.type === 'station'
        ? `📍 ${room.stationName} — ${room.userIds.size || 1} traveler here now. Be the first to say hi!`
        : `🚇 ${room.lineName} · ${room.scheduleLabel || 'Train'} (${room.direction}) — ${room.userIds.size || 1} traveler onboard.`;
      room.messages.push({
        id: uuidv4(),
        roomId: room.id,
        senderId: 'system',
        senderUsername: '@CoRide',
        senderPseudonym: 'CoRide',
        senderAvatarId: 'system',
        senderAvatarBg: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
        content: welcomeContent,
        timestamp: Date.now(),
        isSystem: true,
        type: 'join_alert'
      });
      return;
    }

    const seedData = [
      { name: 'CosmicTiger', tags: ['music', 'coding'], emoji: '🎧', tier: 'active' as const },
      { name: 'DelhiNomad', tags: ['gaming', 'anime'], emoji: '🎮', tier: 'active' as const },
      { name: 'QuietStorm', tags: ['books', 'chess'], emoji: '📚', tier: 'active' as const },
      { name: 'UrbanChai', tags: ['design', 'coffee'], emoji: '☕', tier: 'nearby' as const },
      { name: 'MetroNomad', tags: ['indie', 'podcasts'], emoji: '🎙️', tier: 'nearby' as const },
      { name: 'BlueFalcon', tags: ['tech', 'startups'], emoji: '🚀', tier: 'nearby' as const },
      { name: 'NightOwl', tags: ['photography', 'travel'], emoji: '📸', tier: 'other' as const },
      { name: 'SilentWave', tags: ['yoga', 'mindfulness'], emoji: '🧘', tier: 'other' as const },
    ];

    // More for station rooms (wider context)
    const count = room.type === 'station' ? seedData.length : 6;

    for (let i = 0; i < count && i < seedData.length; i++) {
      const s = seedData[i];
      const userId = `seed_${s.name.toLowerCase()}_${room.id.substring(0, 6)}`;

      const profile: UserProfile = {
        id: userId,
        username: `@${s.name}_${Math.floor(Math.random() * 99)}`,
        pseudonym: s.name,
        avatarId: `av_${i}`,
        avatarBg: AVATAR_PALETTE[i % AVATAR_PALETTE.length].bg,
        interestTags: s.tags,
        collegeOrTag: s.emoji,
        activity: room.type === 'train' ? 'IN_VEHICLE' : 'WALKING',
        joinedAt: Date.now() - Math.floor(Math.random() * 300_000),
        karmaScore: 120
      };

      this.userProfiles.set(userId, profile);
      // don't persist seed profiles as real friends — keep ephemeral
      room.userIds.add(userId);
      this.presence.seedPresence(userId, room.id, s.tier);
    }

    // System welcome message
    const welcomeContent = room.type === 'station'
      ? `📍 ${room.stationName} — ${room.userIds.size} people around this station right now.`
      : `🚇 ${room.lineName} · ${room.scheduleLabel || 'Train'} (${room.direction}) — ${room.userIds.size} travelers onboard.`;

    room.messages.push({
      id: uuidv4(),
      roomId: room.id,
      senderId: 'system',
      senderUsername: '@CoRide',
      senderPseudonym: 'CoRide',
      senderAvatarId: 'system',
      senderAvatarBg: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
      content: welcomeContent,
      timestamp: Date.now(),
      isSystem: true,
      type: 'join_alert'
    });
  }

  // ─── User Management ───

  public joinRoom(roomId: string, user: UserProfile, socketId: string): ContextRoom {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error(`Room ${roomId} not found`);

    this.userProfiles.set(user.id, user);
    this.persistProfile(user);
    this.socketToUser.set(socketId, user.id);
    room.userIds.add(user.id);

    if (!this.userToRooms.has(user.id)) {
      this.userToRooms.set(user.id, new Set());
    }
    this.userToRooms.get(user.id)!.add(roomId);

    this.presence.heartbeat(user.id, roomId, socketId);

    // Join message
    const joinMsg: RoomMessage = {
      id: uuidv4(),
      roomId,
      senderId: 'system',
      senderUsername: '@CoRide',
      senderPseudonym: 'CoRide',
      senderAvatarId: user.avatarId,
      senderAvatarBg: user.avatarBg,
      content: room.type === 'station'
        ? `${user.pseudonym} is at ${room.stationName}`
        : `${user.pseudonym} boarded the train`,
      timestamp: Date.now(),
      isSystem: true,
      type: 'join_alert'
    };
    room.messages.push(joinMsg);

    return room;
  }

  public leaveRoom(roomId: string, userId: string, reason: 'switch' | 'disconnect' = 'switch'): RoomMessage | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const wasPresent = room.userIds.delete(userId);
    this.userToRooms.get(userId)?.delete(roomId);
    if (!wasPresent) return null;
    const profile = this.userProfiles.get(userId);
    const leaveMsg: RoomMessage = {
      id: uuidv4(),
      roomId,
      senderId: 'system',
      senderUsername: '@CoRide',
      senderPseudonym: 'CoRide',
      senderAvatarId: profile?.avatarId || 'system',
      senderAvatarBg: profile?.avatarBg || 'linear-gradient(135deg, #0ea5e9, #6366f1)',
      content: room.type === 'station'
        ? `${profile?.pseudonym || 'Someone'} left ${room.stationName}`
        : `${profile?.pseudonym || 'Someone'} got off • ${room.stationName} → ${room.direction?.replace('Towards ', '') || ''}`,
      timestamp: Date.now(),
      isSystem: true,
      type: reason === 'disconnect' ? 'transition_alert' : 'join_alert'
    };
    // keep leave notice if someone still there to see it
    if (room.userIds.size > 0) room.messages.push(leaveMsg);
    return leaveMsg;
  }

  public getAllRooms(): ContextRoom[] {
    return Array.from(this.rooms.values());
  }

  public disconnectSocket(socketId: string): { userId: string | null; roomIds: string[]; leaveMessages: Map<string, RoomMessage> } {
    const userId = this.socketToUser.get(socketId);
    if (!userId) return { userId: null, roomIds: [], leaveMessages: new Map() };

    this.socketToUser.delete(socketId);
    this.presence.removeBySocket(socketId);

    const roomIds = Array.from(this.userToRooms.get(userId) || []);
    const leaveMessages = new Map<string, RoomMessage>();
    for (const rid of roomIds) {
      const msg = this.leaveRoom(rid, userId, 'disconnect');
      if (msg) leaveMessages.set(rid, msg);
    }
    this.userToRooms.delete(userId);

    return { userId, roomIds, leaveMessages };
  }

  // ─── Messages ───

  public addMessage(roomId: string, user: UserProfile, content: string): RoomMessage {
    const room = this.rooms.get(roomId);
    if (!room) throw new Error('Room not found');

    const msg: RoomMessage = {
      id: uuidv4(),
      roomId,
      senderId: user.id,
      senderUsername: user.username,
      senderPseudonym: user.pseudonym,
      senderAvatarId: user.avatarId,
      senderAvatarBg: user.avatarBg,
      content,
      timestamp: Date.now(),
      type: 'text'
    };

    room.messages.push(msg);
    if (room.messages.length > 100) room.messages = room.messages.slice(-100);

    return msg;
  }

  // ─── Queries ───

  public getRoom(roomId: string): ContextRoom | undefined {
    return this.rooms.get(roomId);
  }

  public getUserProfile(userId: string): UserProfile | undefined {
    return this.userProfiles.get(userId);
  }

  public getRoomUsers(roomId: string): UserProfile[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    const profiles: UserProfile[] = [];
    for (const uid of room.userIds) {
      const p = this.userProfiles.get(uid);
      if (p) profiles.push(p);
    }
    return profiles;
  }

  /** Get users with their presence tiers, for a given room */
  public getRoomUsersWithPresence(roomId: string): Array<UserProfile & { presenceTier: string }> {
    const users = this.getRoomUsers(roomId);
    return users.map(u => ({
      ...u,
      presenceTier: this.presence.getTier(u.id)
    }));
  }

  /** Serialize room for API response */
  public serializeRoom(roomId: string): object | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const usersWithPresence = this.getRoomUsersWithPresence(roomId);
    const presenceCounts = this.presence.countForContext(roomId);

    return {
      id: room.id,
      type: room.type,
      lineId: room.lineId,
      lineName: room.lineName,
      lineColor: room.lineColor,
      stationId: room.stationId,
      stationName: room.stationName,
      direction: room.direction,
      trainId: room.trainId,
      scheduleLabel: room.scheduleLabel,
      users: usersWithPresence,
      userCount: room.userIds.size,
      presence: presenceCounts,
      messages: room.messages.slice(-50),
      createdAt: room.createdAt,
      expiresAt: room.expiresAt
    };
  }

  // ─── Cleanup — ephemeral by default ───

  private cleanup(): void {
    const now = Date.now();
    for (const [id, room] of this.rooms.entries()) {
      // ephemeral: expire empty rooms immediately, expire old rooms even with seeds after TTL + grace
      const isEmpty = room.userIds.size === 0 || Array.from(room.userIds).every(uid => uid.startsWith('seed_'));
      // prune expired empty or seed-only rooms
      if (now > room.expiresAt && isEmpty) {
        this.rooms.delete(id);
        // also cleanup presence entries for seeded ids
        for (const uid of Array.from(room.userIds)) {
          if (uid.startsWith('seed_')) this.presence.removeUser(uid);
        }
      } else if (now > room.expiresAt + 10 * 60 * 1000 && room.messages.length > 50) {
        // trim old messages for long-lived rooms
        room.messages = room.messages.slice(-30);
      }
    }
  }

  /** Live count for hero metric — counts real + seeded but decay-aware */
  public getLiveCount(roomId: string): { total: number; real: number; seeded: number } {
    const room = this.rooms.get(roomId);
    if (!room) return { total: 0, real: 0, seeded: 0 };
    let real = 0, seeded = 0;
    for (const uid of room.userIds) {
      if (uid.startsWith('seed_')) seeded++; else real++;
    }
    return { total: room.userIds.size, real, seeded };
  }
}
