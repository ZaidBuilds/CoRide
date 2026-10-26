import fs from 'fs';
import path from 'path';
import { pool, isDbEnabled, initSchema } from '../db/pool';

/**
 * Durable state (profiles, friendships, blocks, reports, requests, DMs, reads,
 * saved commutes, push subscriptions) lives in one in-memory object that is
 * persisted with a debounced async write:
 *
 *  - File mode (default): `${DATA_DIR}/store.json`.
 *  - Postgres mode (`DATABASE_URL` set): the whole store is one JSONB row in
 *    `app_state` (see init.sql). It is loaded at boot by init() — the server
 *    refuses to start if Postgres is unreachable, so it can never boot empty
 *    and overwrite real data. This survives container redeploys, which the
 *    file store does not on hosts with an ephemeral disk.
 *
 * Both modes are single-instance: the process holds the authoritative copy.
 * Horizontal scaling needs per-table reads/writes (tables already exist in
 * init.sql) — out of scope for launch.
 */

export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '..', 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const STATE_ROW_ID = 'main';

export interface PersistedStore {
  friendships: Record<string, string[]>;
  blocks: Record<string, string[]>;
  reports: any[];
  profiles: Record<string, any>;
  requests: Record<string, any>;
  directMessages: Record<string, any[]>;
  reads: Record<string, number>; // `${userId}::${peerId}` -> lastReadAt ms
  commutePatterns: Record<string, any[]>; // userId -> SavedCommutePattern[]
  pushSubscriptions: Record<string, any>; // userId -> { subscription, commutePrefs, at }
  _meta?: any;
}

function emptyStore(): PersistedStore {
  return {
    friendships: {},
    blocks: {},
    reports: [],
    profiles: {},
    requests: {},
    directMessages: {},
    reads: {},
    commutePatterns: {},
    pushSubscriptions: {}
  };
}

function normalize(parsed: any): PersistedStore {
  const base = emptyStore();
  if (!parsed || typeof parsed !== 'object') return base;
  const obj = (v: any) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  return {
    ...base,
    ...parsed,
    friendships: obj(parsed.friendships),
    blocks: obj(parsed.blocks),
    reports: Array.isArray(parsed.reports) ? parsed.reports : [],
    profiles: obj(parsed.profiles),
    requests: obj(parsed.requests),
    directMessages: obj(parsed.directMessages),
    reads: obj(parsed.reads),
    commutePatterns: obj(parsed.commutePatterns),
    pushSubscriptions: obj(parsed.pushSubscriptions)
  };
}

export class Persistence {
  private static instance: Persistence;

  // In-memory copy of the store. Every load() returns this same reference, so
  // callers that mutate-then-save() see O(1) reads instead of a full
  // readFileSync+JSON.parse per request.
  private cache: PersistedStore | null = null;
  private writeTimer: ReturnType<typeof setTimeout> | null = null;
  /** True once the authoritative copy is in memory; writes are refused before. */
  private hydrated = false;
  private flushing: Promise<void> | null = null;
  private dirtyWhileFlushing = false;
  private lastFlushError: string | null = null;

  private constructor() {}

  public static getInstance(): Persistence {
    if (!Persistence.instance) Persistence.instance = new Persistence();
    return Persistence.instance;
  }

  public mode(): 'postgres' | 'file' {
    return isDbEnabled() ? 'postgres' : 'file';
  }

  public status(): { mode: string; hydrated: boolean; lastFlushError: string | null } {
    return { mode: this.mode(), hydrated: this.hydrated, lastFlushError: this.lastFlushError };
  }

  /**
   * Boot-time load. In Postgres mode this MUST complete before the server
   * accepts traffic; it throws (and the caller exits) if the DB is unreachable.
   */
  public async init(): Promise<void> {
    if (!isDbEnabled()) {
      this.load();
      return;
    }
    await initSchema();
    const res = await pool!.query('SELECT data FROM app_state WHERE id = $1', [STATE_ROW_ID]);
    let store: PersistedStore;
    if (res.rows.length > 0) {
      store = normalize(res.rows[0].data);
      console.log(`[Persistence] loaded state from Postgres (${Object.keys(store.profiles).length} profiles)`);
    } else {
      // First boot in DB mode: migrate the file store if one exists, plus any
      // rows the older per-table writer left in `profiles` / `reads`.
      store = this.readFileStore() || emptyStore();
      try {
        const profiles = await pool!.query('SELECT id, data FROM profiles');
        for (const row of profiles.rows) if (!store.profiles[row.id]) store.profiles[row.id] = row.data;
        const reads = await pool!.query('SELECT user_id, peer_id, last_read_at FROM reads');
        for (const row of reads.rows) {
          const key = `${row.user_id}::${row.peer_id}`;
          if (store.reads[key] === undefined) store.reads[key] = Number(row.last_read_at);
        }
      } catch (e) {
        console.warn('[Persistence] legacy table import skipped', e);
      }
      console.log(`[Persistence] initialised Postgres state (${Object.keys(store.profiles).length} profiles migrated)`);
    }
    this.cache = store;
    this.hydrated = true;
    await this.flushNow();
  }

  private readFileStore(): PersistedStore | null {
    try {
      if (fs.existsSync(STORE_PATH)) return normalize(JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8')));
    } catch (e) {
      // A corrupt store must not be silently replaced by an empty one on the
      // next write — keep a copy for manual recovery.
      console.error('[Persistence] store.json unreadable; backing it up and starting empty', e);
      try { fs.copyFileSync(STORE_PATH, `${STORE_PATH}.corrupt-${Date.now()}`); } catch {}
    }
    return null;
  }

  public load(): PersistedStore {
    if (this.cache) return this.cache;
    if (isDbEnabled()) {
      // Services read the store at construction, before init() runs. Hand
      // them an empty placeholder; init() swaps in the real state and the
      // server rehydrates them before listening. Writes stay blocked until then.
      this.cache = emptyStore();
      return this.cache;
    }
    this.cache = this.readFileStore() || emptyStore();
    this.hydrated = true;
    return this.cache;
  }

  public save(store: PersistedStore): void {
    // Keep the in-memory copy authoritative and debounce the write, so a burst
    // of writes (e.g. many chat sends) collapses to one async flush.
    this.cache = store;
    if (this.writeTimer) return;
    const delay = isDbEnabled() ? 1000 : 400;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      this.flushNow().catch(() => {});
    }, delay);
  }

  /** Write the current state now. Serialised: never two writes in flight. */
  public async flushNow(): Promise<void> {
    if (this.writeTimer) { clearTimeout(this.writeTimer); this.writeTimer = null; }
    if (this.flushing) {
      this.dirtyWhileFlushing = true;
      return this.flushing;
    }
    this.flushing = (async () => {
      try {
        do {
          this.dirtyWhileFlushing = false;
          await this.writeOnce();
        } while (this.dirtyWhileFlushing);
        this.lastFlushError = null;
      } catch (e: any) {
        this.lastFlushError = e?.message || String(e);
        console.error('[Persistence] save failed', e);
      } finally {
        this.flushing = null;
      }
    })();
    return this.flushing;
  }

  private async writeOnce(): Promise<void> {
    if (!this.cache || !this.hydrated) return;
    let json = JSON.stringify(this.cache);
    if (isDbEnabled()) {
      // Postgres JSONB rejects \u0000; one NUL in any message would otherwise
      // make every subsequent snapshot write fail. Strip unescaped NUL escapes.
      json = json.replace(/(?<!\\)((?:\\\\)*)\\u0000/g, '$1');
      await pool!.query(
        `INSERT INTO app_state (id, data, updated_at) VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [STATE_ROW_ID, json]
      );
      return;
    }
    if (!fs.existsSync(DATA_DIR)) await fs.promises.mkdir(DATA_DIR, { recursive: true });
    // Write-then-rename so a crash mid-write can never leave a truncated store.
    const tmp = `${STORE_PATH}.tmp`;
    await fs.promises.writeFile(tmp, json, 'utf-8');
    await fs.promises.rename(tmp, STORE_PATH);
  }

  public appendProfile(profile: any): void {
    try {
      const store = this.load();
      store.profiles[profile.id] = profile;
      this.save(store);
    } catch {}
  }

  public getProfile(userId: string): any | null {
    if (typeof userId !== 'string') return null;
    const store = this.load();
    return Object.prototype.hasOwnProperty.call(store.profiles, userId) ? store.profiles[userId] : null;
  }
}
