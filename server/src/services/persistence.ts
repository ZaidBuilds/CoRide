import fs from 'fs';
import path from 'path';
import { pool, isDbEnabled } from '../db/pool';

const STORE_PATH = path.join(__dirname, '..', 'data', 'store.json');

export interface PersistedStore {
  friendships: Record<string, string[]>;
  blocks: Record<string, string[]>;
  reports: any[];
  profiles: Record<string, any>;
  requests: Record<string, any>;
  directMessages: Record<string, any[]>;
  reads: Record<string, number>; // `${userId}::${peerId}` -> lastReadAt ms
  commutePatterns: Record<string, any[]>; // userId -> SavedCommutePattern[]
  // MVP4: extended store for reactions, push etc handled elsewhere but keep for future
  _meta?: any;
}

const DEFAULT_STORE: PersistedStore = {
  friendships: {},
  blocks: {},
  reports: [],
  profiles: {},
  requests: {},
  directMessages: {},
  reads: {},
  commutePatterns: {}
};

export class Persistence {
  private static instance: Persistence;

  // In-memory copy of the store. Every load() returns this same reference, so
  // callers that mutate-then-save() see O(1) reads instead of a full
  // readFileSync+JSON.parse per request. Disk is read once, on first load.
  private cache: PersistedStore | null = null;
  private writeTimer: ReturnType<typeof setTimeout> | null = null;

  private constructor() {
    // Flush any pending debounced write on shutdown so we don't lose the tail.
    const flush = () => this.flushSync();
    process.on('SIGINT', () => { flush(); process.exit(0); });
    process.on('SIGTERM', () => { flush(); process.exit(0); });
    process.on('beforeExit', flush);
  }

  public static getInstance(): Persistence {
    if (!Persistence.instance) Persistence.instance = new Persistence();
    return Persistence.instance;
  }

  public load(): PersistedStore {
    if (this.cache) return this.cache;
    // With DB enabled, the cache is filled by hydrateFromDb() at boot. If a
    // caller somehow reads before that, return empty defaults rather than the
    // stale on-disk store.
    if (isDbEnabled()) { this.cache = { ...DEFAULT_STORE }; return this.cache; }
    try {
      if (fs.existsSync(STORE_PATH)) {
        const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
        const loaded: PersistedStore = {
          ...DEFAULT_STORE,
          ...parsed,
          friendships: parsed.friendships || {},
          blocks: parsed.blocks || {},
          reports: parsed.reports || [],
          profiles: parsed.profiles || {},
          requests: parsed.requests || {},
          directMessages: parsed.directMessages || {},
          reads: parsed.reads || {},
          commutePatterns: parsed.commutePatterns || {}
        };
        this.cache = loaded;
        return loaded;
      }
    } catch (e) {
      console.warn('[Persistence] load failed, using defaults', e);
    }
    this.cache = { ...DEFAULT_STORE };
    return this.cache;
  }

  public save(store: PersistedStore): void {
    // Keep the in-memory copy authoritative and debounce the disk write, so a
    // burst of writes (e.g. many chat sends) collapses to one async flush
    // instead of a synchronous whole-file rewrite each time.
    this.cache = store;
    if (this.writeTimer) return;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      this.flush().catch(e => console.error('[Persistence] save failed', e));
    }, 400);
  }

  private ensureDir(): void {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  private async persistToDb(store: PersistedStore): Promise<void> {
    if (!pool) return;
    try {
      for (const [id, data] of Object.entries(store.profiles)) {
        await pool.query(
          'INSERT INTO profiles (id, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()',
          [id, JSON.stringify(data)]
        );
      }
      for (const [key, lastReadAt] of Object.entries(store.reads || {})) {
        const [userId, peerId] = key.split('::');
        if (userId && peerId) {
          await pool.query(
            'INSERT INTO reads (user_id, peer_id, last_read_at) VALUES ($1, $2, $3) ON CONFLICT (user_id, peer_id) DO UPDATE SET last_read_at = $3',
            [userId, peerId, lastReadAt]
          );
        }
      }
    } catch (e) {
      console.error('[Persistence] DB persist error', e);
    }
  }

  private async flush(): Promise<void> {
    if (!this.cache) return;
    if (isDbEnabled()) { await this.persistToDb(this.cache); return; }
    this.ensureDir();
    await fs.promises.writeFile(STORE_PATH, JSON.stringify(this.cache, null, 2), 'utf-8');
  }

  /** Synchronous flush for shutdown — best effort. */
  private flushSync(): void {
    try {
      if (this.writeTimer) { clearTimeout(this.writeTimer); this.writeTimer = null; }
      if (!this.cache) return;
      // No synchronous PG write; the 400ms debounce means recent writes are
      // already persisted. Best-effort final async persist (may be cut by exit).
      if (isDbEnabled()) { void this.persistToDb(this.cache); return; }
      this.ensureDir();
      fs.writeFileSync(STORE_PATH, JSON.stringify(this.cache, null, 2), 'utf-8');
    } catch (e) {
      console.error('[Persistence] flushSync failed', e);
    }
  }

  public appendProfile(profile: any): void {
    try {
      const store = this.load();
      store.profiles[profile.id] = profile;
      this.save(store);
    } catch {}
  }

  public getProfile(userId: string): any | null {
    const store = this.load();
    return store.profiles[userId] || null;
  }
}
