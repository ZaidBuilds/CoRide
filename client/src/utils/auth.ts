// Client-side holder for the signed device token issued by /api/auth/*.
// Kept in localStorage so it survives reloads, mirrored in memory for sync reads.

const TOKEN_KEY = 'coride_token';
let token: string | null = (() => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
})();

export function setToken(t: string | null): void {
  token = t;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* private mode */ }
}

export function getToken(): string | null {
  return token;
}

/** Spread into a fetch init's headers to authenticate the request. */
export function authHeaders(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
