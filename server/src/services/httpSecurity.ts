import type { Request, Response, NextFunction } from 'express';

/**
 * Production HTTP hardening without extra dependencies: CORS allowlist,
 * helmet-style security headers and a small fixed-window rate limiter.
 */

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ── CORS ────────────────────────────────────────────────────────────────
// The Capacitor Android shell serves the app from https://localhost
// (androidScheme: 'https'); iOS uses capacitor://localhost. Anything else must
// be listed in CORS_ORIGINS (comma-separated, e.g. a hosted web build).
const CAPACITOR_ORIGINS = ['https://localhost', 'capacitor://localhost', 'http://localhost', 'ionic://localhost'];

function parseOrigins(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map(s => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

const EXTRA_ORIGINS = parseOrigins(process.env.CORS_ORIGINS);
const ALLOW_ALL = EXTRA_ORIGINS.includes('*');
const ALLOWED = new Set([...CAPACITOR_ORIGINS, ...EXTRA_ORIGINS]);

/**
 * Whether a browser Origin may call the API. Requests without an Origin
 * (native HTTP, curl, server-to-server) are not a CORS concern and pass.
 * Outside production every origin is allowed so LAN/device testing just works.
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  if (ALLOW_ALL || !IS_PRODUCTION) return true;
  return ALLOWED.has(origin.replace(/\/+$/, ''));
}

/** Origin callback shared by the `cors` middleware and Socket.IO. */
export function corsOrigin(origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void): void {
  // Never error here: a disallowed origin simply gets no CORS headers (the
  // browser blocks it) instead of turning into a 500.
  cb(null, isOriginAllowed(origin));
}

export function describeCors(): string {
  if (ALLOW_ALL) return 'all origins (CORS_ORIGINS=*)';
  if (!IS_PRODUCTION) return 'all origins (non-production)';
  return Array.from(ALLOWED).join(', ');
}

// ── Security headers ────────────────────────────────────────────────────
const CSP = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Content-Security-Policy', CSP);
  if (IS_PRODUCTION && req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  // API responses are per-user and must never be cached by an intermediary.
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
}

// ── Rate limiting ───────────────────────────────────────────────────────
/**
 * Fixed-window counter per key. O(1) per hit; a background sweep drops
 * expired windows so the map cannot grow without bound.
 */
export class RateLimiter {
  private windows = new Map<string, { count: number; start: number }>();

  constructor(public readonly max: number, public readonly windowMs: number) {
    const t = setInterval(() => this.sweep(), Math.max(windowMs, 60_000));
    t.unref();
  }

  hit(key: string): { ok: boolean; remaining: number; retryAfterSec: number } {
    const now = Date.now();
    let w = this.windows.get(key);
    if (!w || now - w.start >= this.windowMs) {
      w = { count: 0, start: now };
      this.windows.set(key, w);
    }
    const retryAfterSec = Math.max(1, Math.ceil((w.start + this.windowMs - now) / 1000));
    if (w.count >= this.max) return { ok: false, remaining: 0, retryAfterSec };
    w.count++;
    return { ok: true, remaining: this.max - w.count, retryAfterSec };
  }

  reset(key: string): void {
    this.windows.delete(key);
  }

  sweep(): void {
    const now = Date.now();
    for (const [k, w] of this.windows) {
      if (now - w.start >= this.windowMs) this.windows.delete(k);
    }
  }
}

/** Send a consistent 429 with Retry-After. */
export function sendRateLimited(res: Response, retryAfterSec: number, message = 'Too many requests. Please slow down.'): void {
  res.setHeader('Retry-After', String(retryAfterSec));
  res.status(429).json({ error: message, retryAfterSec });
}
