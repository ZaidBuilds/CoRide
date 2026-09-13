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

const SECRET = process.env.AUTH_SECRET || 'coride-dev-insecure-secret-change-me';
if (!process.env.AUTH_SECRET) {
  console.warn('[authToken] AUTH_SECRET not set — using an insecure dev secret. Set AUTH_SECRET before production.');
}

function sign(userId: string): string {
  return crypto.createHmac('sha256', SECRET).update(userId).digest('base64url');
}

/** Issue a token binding this userId. */
export function signToken(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

/** Return the userId iff the token's signature is valid, else null. */
export function verifyToken(token: string | undefined | null): string | null {
  if (!token) return null;
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
