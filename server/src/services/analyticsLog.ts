import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './persistence';

/**
 * Append-only analytics log (one JSON object per line) in DATA_DIR.
 *
 * Writes go through a single append stream instead of a synchronous
 * appendFileSync per event, so analytics can never block the event loop. The
 * file is rotated to `.1` once it passes MAX_BYTES so it cannot fill the disk.
 */

export const ANALYTICS_LOG_PATH = path.join(DATA_DIR, 'analytics.log');
const MAX_BYTES = Number(process.env.ANALYTICS_MAX_BYTES) || 20 * 1024 * 1024;

let stream: fs.WriteStream | null = null;
let bytes = -1;

function open(): fs.WriteStream | null {
  if (stream) return stream;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    bytes = fs.existsSync(ANALYTICS_LOG_PATH) ? fs.statSync(ANALYTICS_LOG_PATH).size : 0;
    stream = fs.createWriteStream(ANALYTICS_LOG_PATH, { flags: 'a' });
    stream.on('error', (err) => {
      console.error('[analytics] write failed', err.message);
      stream = null;
    });
    return stream;
  } catch (err) {
    console.error('[analytics] open failed', err);
    return null;
  }
}

function rotate(): void {
  try {
    stream?.end();
    stream = null;
    fs.renameSync(ANALYTICS_LOG_PATH, `${ANALYTICS_LOG_PATH}.1`);
  } catch (err) {
    console.error('[analytics] rotate failed', err);
  }
  bytes = 0;
}

export function logEvent(event: string, userId: string | null | undefined, payload?: unknown): void {
  try {
    const line = JSON.stringify({ t: Date.now(), event, userId: userId || 'anonymous', payload }) + '\n';
    if (bytes >= 0 && bytes + line.length > MAX_BYTES) rotate();
    const s = open();
    if (!s) return;
    s.write(line);
    bytes += Buffer.byteLength(line);
  } catch (err) {
    console.error('[analytics] log failed', err);
  }
}

export async function readEvents(): Promise<any[]> {
  try {
    const raw = await fs.promises.readFile(ANALYTICS_LOG_PATH, 'utf-8');
    return raw
      .split('\n')
      .filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean) as any[];
  } catch (err: any) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
}

export function closeAnalytics(): Promise<void> {
  return new Promise(resolve => {
    if (!stream) return resolve();
    stream.end(() => resolve());
    stream = null;
  });
}
