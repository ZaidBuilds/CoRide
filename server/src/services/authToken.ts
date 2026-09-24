import crypto from 'crypto';

/**
 * Stateless signed device token: `${userId}.${hmac}`.
 *
 * The server issues one when a profile is created/restored; the client stores it
 * and presents it on every request. verify() re-derives the userId from the
 * signature, so a client can never claim to be someone else by editing a header
 * — replacing the old spoofable `x-user-id`. No DB lookup, no session store.
 *
 * Not a substitute for real accounts, but it makes identity unforgeable without
 * the signing secret, which is the actual launch blocker.
 */

const DEV_SECRET = 'coride-dev-insecure-secret-change-me';
const RAW_SECRET = (process.env.AUTH_SECRET || '').trim();

/**
 * Anyone who knows the signing secret can mint a token for any user, so the
 * dev fallback must never reach production. With NODE_ENV=production the
 * server refuses to boot without a strong AUTH_SECRET; elsewhere it warns.
 */
export function assertAuthSecret(): void {
  const weak = !RAW_SECRET || RAW_SECRET === DEV_SECRET || RAW_SECRET.length < 32;
  if (!weak) return;
  const msg = !RAW_SECRET
    ? 'AUTH_SECRET is not set'
    : 'AUTH_SECRET is too weak (use at least 32 random characters, e.g. `openssl rand -base64 48`)';
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`[authToken] FATAL: ${msg}. Refusing to start in production — every account could be forged.`);
  }
  console.warn('\n' + '!'.repeat(78) + `\n[authToken] WARNING: ${msg} — using an insecure dev secret.\n` +
    'Tokens signed with it can be forged by anyone. Set AUTH_SECRET before production.\n' + '!'.repeat(78) + '\n');
}

const SECRET = RAW_SECRET || DEV_SECRET;

function sign(userId: string): string {
  return crypto.createHmac('sha256', SECRET).update(userId).digest('base64url');
}

/** Issue a token binding this userId. */
export function signToken(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

/** Return the userId iff the token's signature is valid, else null. */
export function verifyToken(token: string | undefined | null): string | null {
  if (!token || typeof token !== 'string' || token.length > 512) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(userId);
  // Constant-time compare; guard against length-mismatch throwing.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? userId : null;
}
