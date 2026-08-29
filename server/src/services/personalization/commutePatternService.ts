import { v4 as uuidv4 } from 'uuid';
import { Persistence } from '../persistence';

export interface CommutePattern {
  id: string;
  userId: string;
  lineId: string;
  lineName: string;
  lineColor: string;
  stationId: string;
  stationName: string;
  direction: string;
  targetTime: string; // "08:30" IST
  daysOfWeek: string[]; // ["Mon","Tue", ...]
  isActive: boolean;
  label?: string; // e.g. "College → Office"
  createdAt: number;
  lastUsedAt?: number;
  useCount: number;
}

export class CommutePatternService {
  private static instance: CommutePatternService;
  private persistence = Persistence.getInstance();

  private constructor() {}
  static getInstance(): CommutePatternService {
    if (!CommutePatternService.instance) CommutePatternService.instance = new CommutePatternService();
    return CommutePatternService.instance;
  }

  savePattern(userId: string, data: Partial<CommutePattern>): CommutePattern {
    const store = this.persistence.load();
    if (!store.commutePatterns) store.commutePatterns = {} as any;
    if (!store.commutePatterns[userId]) store.commutePatterns[userId] = [];
    const pattern: CommutePattern = {
      id: data.id || `pat_${Date.now()}_${uuidv4().slice(0,5)}`,
      userId,
      lineId: data.lineId || 'blue',
      lineName: data.lineName || 'Blue Line',
      lineColor: data.lineColor || '#0284c7',
      stationId: data.stationId || 'rajiv_chowk',
      stationName: data.stationName || 'Rajiv Chowk',
      direction: data.direction || 'Towards Noida Electronic City',
      targetTime: data.targetTime || '08:30',
      daysOfWeek: data.daysOfWeek || ['Mon','Tue','Wed','Thu','Fri'],
      isActive: data.isActive ?? true,
      label: data.label,
      createdAt: data.createdAt || Date.now(),
      lastUsedAt: data.lastUsedAt,
      useCount: data.useCount || 0
    };
    // upsert: if id exists, replace
    const arr = store.commutePatterns[userId] as CommutePattern[];
    const idx = arr.findIndex(p => p.id === pattern.id);
    if (idx >= 0) arr[idx] = { ...arr[idx], ...pattern };
    else arr.push(pattern);
    // keep max 5 per user
    if (arr.length > 5) store.commutePatterns[userId] = arr.slice(-5);
    this.persistence.save(store);
    return pattern;
  }

  getPatterns(userId: string): CommutePattern[] {
    const store = this.persistence.load();
    return (store.commutePatterns?.[userId] || []) as CommutePattern[];
  }

  deletePattern(userId: string, patternId: string): boolean {
    const store = this.persistence.load();
    const arr = store.commutePatterns?.[userId] as CommutePattern[] | undefined;
    if (!arr) return false;
    const before = arr.length;
    store.commutePatterns[userId] = arr.filter(p => p.id !== patternId);
    this.persistence.save(store);
    return store.commutePatterns[userId].length < before;
  }

  markUsed(userId: string, patternId: string): CommutePattern | null {
    const store = this.persistence.load();
    const arr = store.commutePatterns?.[userId] as CommutePattern[] | undefined;
    if (!arr) return null;
    const pat = arr.find(p => p.id === patternId);
    if (!pat) return null;
    pat.lastUsedAt = Date.now();
    pat.useCount += 1;
    this.persistence.save(store);
    return pat;
  }

  getPattern(userId: string, patternId: string): CommutePattern | null {
    return this.getPatterns(userId).find(p => p.id === patternId) || null;
  }
}
