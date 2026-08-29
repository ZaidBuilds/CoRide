import fs from 'fs';
import path from 'path';

const STORE_PATH = path.join(__dirname, '..', 'data', 'store.json');

export interface PersistedStore {
  friendships: Record<string, string[]>;
  blocks: Record<string, string[]>;
  reports: any[];
  profiles: Record<string, any>;
  requests: Record<string, any>;
  directMessages: Record<string, any[]>;
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
  commutePatterns: {}
};

export class Persistence {
  private static instance: Persistence;

  private constructor() {}

  public static getInstance(): Persistence {
    if (!Persistence.instance) Persistence.instance = new Persistence();
    return Persistence.instance;
  }

  public load(): PersistedStore {
    try {
      if (fs.existsSync(STORE_PATH)) {
        const raw = fs.readFileSync(STORE_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_STORE,
          ...parsed,
          friendships: parsed.friendships || {},
          blocks: parsed.blocks || {},
          reports: parsed.reports || [],
          profiles: parsed.profiles || {},
          requests: parsed.requests || {},
          directMessages: parsed.directMessages || {},
          commutePatterns: parsed.commutePatterns || {}
        };
      }
    } catch (e) {
      console.warn('[Persistence] load failed, using defaults', e);
    }
    return { ...DEFAULT_STORE };
  }

  public save(store: PersistedStore): void {
    try {
      const dir = path.dirname(STORE_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
    } catch (e) {
      console.error('[Persistence] save failed', e);
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
