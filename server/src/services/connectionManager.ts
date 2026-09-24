import { v4 as uuidv4 } from 'uuid';
import { Persistence } from './persistence';

export type ConnectionStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

export interface ConnectionRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: ConnectionStatus;
  contextLine: string;
  contextStation: string;
  createdAt: number;
  updatedAt: number;
}

export interface BlockRecord {
  id: string;
  userId: string;
  blockedUserId: string;
  reason?: string;
  createdAt: number;
}

export interface ReportRecord {
  id: string;
  reporterId: string;
  reportedUserId: string;
  reason: string;
  contextRoomId?: string;
  createdAt: number;
  resolved: boolean;
}

/**
 * Connection Manager
 *
 * Handles: Request → Accept/Decline → Friends
 *          Block (hard, immediate, mutual invisibility)
 *          Report (queued for moderation)
 */
export class ConnectionManager {
  private static instance: ConnectionManager;
  private requests: Map<string, ConnectionRequest> = new Map();
  private friendships: Map<string, Set<string>> = new Map(); // userId → Set<friendId>
  private blocks: Map<string, Set<string>> = new Map();      // userId → Set<blockedId>
  private reports: ReportRecord[] = [];

  private persistence = Persistence.getInstance();

  private constructor() {
    this.hydrateFromDisk();
  }

  private hydrateFromDisk(): void {
    try {
      const store = this.persistence.load();
      // friendships
      for (const [uid, fids] of Object.entries(store.friendships)) {
        this.friendships.set(uid, new Set(fids as string[]));
      }
      // blocks
      for (const [uid, bids] of Object.entries(store.blocks)) {
        this.blocks.set(uid, new Set(bids as string[]));
      }
      // reports
      if (Array.isArray(store.reports)) {
        this.reports = store.reports as ReportRecord[];
      }
      // requests
      if (store.requests) {
        for (const [rid, req] of Object.entries(store.requests)) {
          this.requests.set(rid, req as ConnectionRequest);
        }
      }
    } catch (e) {
      console.warn('[ConnectionManager] hydrate failed', e);
    }
  }

  private persistToDisk(): void {
    try {
      const store = this.persistence.load();
      const friendships: Record<string, string[]> = {};
      for (const [k, v] of this.friendships.entries()) friendships[k] = Array.from(v);
      const blocks: Record<string, string[]> = {};
      for (const [k, v] of this.blocks.entries()) blocks[k] = Array.from(v);
      const requests: Record<string, ConnectionRequest> = {};
      for (const [k, v] of this.requests.entries()) requests[k] = v;
      store.friendships = friendships;
      store.blocks = blocks;
      store.reports = this.reports;
      store.requests = requests;
      this.persistence.save(store);
    } catch (e) {
      console.error('[ConnectionManager] persist failed', e);
    }
  }

  public static getInstance(): ConnectionManager {
    if (!ConnectionManager.instance) {
      ConnectionManager.instance = new ConnectionManager();
    }
    return ConnectionManager.instance;
  }

  /** Account deletion: drop every friendship, block and request touching userId. */
  public purgeUser(userId: string): void {
    this.friendships.delete(userId);
    for (const set of this.friendships.values()) set.delete(userId);
    this.blocks.delete(userId);
    for (const set of this.blocks.values()) set.delete(userId);
    for (const [id, r] of this.requests.entries()) {
      if (r.fromUserId === userId || r.toUserId === userId) this.requests.delete(id);
    }
    this.persistToDisk();
  }

  // ─── Connection Requests ───

  public sendRequest(
    fromUserId: string,
    toUserId: string,
    contextLine: string = '',
    contextStation: string = ''
  ): { success: boolean; request?: ConnectionRequest; message: string } {
    // Check if blocked
    if (this.isBlocked(fromUserId, toUserId)) {
      return { success: false, message: 'Cannot send request to this user.' };
    }

    // Check if already friends
    if (this.areFriends(fromUserId, toUserId)) {
      return { success: false, message: 'Already connected.' };
    }

    // Check for existing pending request
    for (const req of this.requests.values()) {
      if (req.status === 'pending') {
        // If target already sent us a request, auto-accept (mutual)
        if (req.fromUserId === toUserId && req.toUserId === fromUserId) {
          return this.acceptRequest(req.id, fromUserId);
        }
        // If we already sent them a request
        if (req.fromUserId === fromUserId && req.toUserId === toUserId) {
          return { success: false, message: 'Request already sent.' };
        }
      }
    }

    const request: ConnectionRequest = {
      id: uuidv4(),
      fromUserId,
      toUserId,
      status: 'pending',
      contextLine,
      contextStation,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.requests.set(request.id, request);
    this.persistToDisk();
    return { success: true, request, message: 'Connection request sent!' };
  }

  public acceptRequest(
    requestId: string,
    acceptingUserId: string
  ): { success: boolean; request?: ConnectionRequest; message: string } {
    const req = this.requests.get(requestId);
    if (!req) return { success: false, message: 'Request not found.' };
    // Only the RECIPIENT may accept — the sender accepting their own request
    // would befriend the target without consent.
    if (req.toUserId !== acceptingUserId) {
      return { success: false, message: 'Not authorized.' };
    }
    // Only a live request can be accepted — no reviving declined ones.
    if (req.status !== 'pending') {
      return { success: false, message: 'This request is no longer pending.' };
    }

    req.status = 'accepted';
    req.updatedAt = Date.now();

    // Add mutual friendship
    this.addFriend(req.fromUserId, req.toUserId);
    this.persistToDisk();

    return { success: true, request: req, message: '🎉 You are now connected!' };
  }

  public declineRequest(requestId: string, decliningUserId: string): { success: boolean; message: string } {
    const req = this.requests.get(requestId);
    if (!req) return { success: false, message: 'Request not found.' };
    if (req.toUserId !== decliningUserId) return { success: false, message: 'Not authorized.' };

    req.status = 'declined';
    req.updatedAt = Date.now();
    this.persistToDisk();
    return { success: true, message: 'Request declined.' };
  }

  public getPendingRequestsFor(userId: string): ConnectionRequest[] {
    const pending: ConnectionRequest[] = [];
    for (const req of this.requests.values()) {
      if (req.toUserId === userId && req.status === 'pending') {
        pending.push(req);
      }
    }
    return pending;
  }

  public getSentRequestsFor(userId: string): ConnectionRequest[] {
    const sent: ConnectionRequest[] = [];
    for (const req of this.requests.values()) {
      if (req.fromUserId === userId && req.status === 'pending') {
        sent.push(req);
      }
    }
    return sent;
  }

  public getAllRequestsFor(userId: string): ConnectionRequest[] {
    const all: ConnectionRequest[] = [];
    for (const req of this.requests.values()) {
      if ((req.fromUserId === userId || req.toUserId === userId)) {
        all.push(req);
      }
    }
    return all.sort((a,b)=> b.createdAt - a.createdAt);
  }

  // ─── Friendships ───

  private addFriend(userA: string, userB: string): void {
    if (!this.friendships.has(userA)) this.friendships.set(userA, new Set());
    if (!this.friendships.has(userB)) this.friendships.set(userB, new Set());
    this.friendships.get(userA)!.add(userB);
    this.friendships.get(userB)!.add(userA);
    this.persistToDisk();
  }

  public areFriends(userA: string, userB: string): boolean {
    return this.friendships.get(userA)?.has(userB) ?? false;
  }

  public getFriendIds(userId: string): string[] {
    return Array.from(this.friendships.get(userId) || []);
  }

  // ─── Block ───

  public blockUser(userId: string, blockedUserId: string, reason?: string): { success: boolean; message: string } {
    if (!this.blocks.has(userId)) this.blocks.set(userId, new Set());
    this.blocks.get(userId)!.add(blockedUserId);

    // Remove any friendship
    this.friendships.get(userId)?.delete(blockedUserId);
    this.friendships.get(blockedUserId)?.delete(userId);

    // Cancel any pending requests between them
    for (const req of this.requests.values()) {
      if (
        (req.fromUserId === userId && req.toUserId === blockedUserId) ||
        (req.fromUserId === blockedUserId && req.toUserId === userId)
      ) {
        req.status = 'declined';
      }
    }

    this.persistToDisk();
    return { success: true, message: 'User blocked. They can no longer see or contact you.' };
  }

  public isBlocked(userA: string, userB: string): boolean {
    return (this.blocks.get(userA)?.has(userB) ?? false) ||
           (this.blocks.get(userB)?.has(userA) ?? false);
  }

  /**
   * Remove a block that userId placed on blockedUserId. Only clears the caller's
   * own block — if the other party also blocked them, that half stands.
   * Does NOT restore a prior friendship; they must reconnect.
   */
  public unblock(userId: string, blockedUserId: string): { success: boolean; message: string } {
    const set = this.blocks.get(userId);
    if (!set || !set.has(blockedUserId)) {
      return { success: false, message: 'That user is not blocked.' };
    }
    set.delete(blockedUserId);
    this.persistToDisk();
    return { success: true, message: 'User unblocked.' };
  }

  public getBlockedIds(userId: string): string[] {
    return Array.from(this.blocks.get(userId) || []);
  }

  // ─── Report ───

  public reportUser(
    reporterId: string,
    reportedUserId: string,
    reason: string,
    contextRoomId?: string
  ): { success: boolean; report: ReportRecord; message: string } {
    const report: ReportRecord = {
      id: uuidv4(),
      reporterId,
      reportedUserId,
      reason,
      contextRoomId,
      createdAt: Date.now(),
      resolved: false
    };

    this.reports.push(report);
    this.persistToDisk();

    // Check if 3+ unresolved reports → auto shadow-ban
    const unresolvedCount = this.reports.filter(
      r => r.reportedUserId === reportedUserId && !r.resolved
    ).length;

    const message = unresolvedCount >= 3
      ? 'User reported and temporarily restricted (multiple reports received).'
      : 'Report submitted. Our team will review it.';

    return { success: true, report, message };
  }

  public getReportCount(userId: string): number {
    return this.reports.filter(r => r.reportedUserId === userId && !r.resolved).length;
  }

  public isRestricted(userId: string): boolean {
    return this.getReportCount(userId) >= 3;
  }

  /** Filter a user list to remove blocked and restricted users */
  public filterVisible(viewerId: string, userIds: string[]): string[] {
    const blocked = this.getBlockedIds(viewerId);
    return userIds.filter(uid =>
      uid !== viewerId &&
      !blocked.includes(uid) &&
      !this.isBlocked(viewerId, uid) &&
      !this.isRestricted(uid)
    );
  }
}
