/**
 * Avatar colour + initials helpers (used by ui/Avatar; exported for screens
 * that must match an avatar's colour, e.g. map pins).
 */
// Terracotta, teal, forest, ochre, steel, raspberry, olive, umber: all AA with white initials.
export const AVATAR_PALETTE = ['#A8472B', '#1E6B66', '#2E6A3B', '#80620F', '#3A5A7C', '#8F3A4E', '#5C6B1C', '#6B5344'] as const;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function isUsableHex(v?: string | null): v is string {
  if (!v) return false;
  const m = /^#([0-9a-f]{6})$/i.exec(v.trim());
  if (!m) return false;
  const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.12) return true; // near-neutral
  let hue = 0;
  if (max === r) hue = ((g - b) / d) % 6; else if (max === g) hue = (b - r) / d + 2; else hue = (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  return !(hue >= 235 && hue <= 320); // drop indigo/purple/violet
}

/** The colour an avatar will use: the user's own solid, non-purple hex, else a stable palette pick. */
export function avatarColor(seed: string, bg?: string | null): string {
  return isUsableHex(bg) ? bg.trim() : AVATAR_PALETTE[hash(seed || '?') % AVATAR_PALETTE.length];
}

export function initials(name?: string, max = 2): string {
  const raw = (name || '').replace(/^@/, '').trim();
  // Split on separators and camelCase humps; drop number-only parts so "QuietStorm_91" gives "QS", not "Q9".
  const parts = raw.split(/[\s._-]+|(?<=[a-z])(?=[A-Z])/).filter(p => /^\p{L}/u.test(p));
  if (!parts.length) return raw ? raw[0].toUpperCase() : '?';
  const a = parts[0][0] ?? '';
  const b = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (max < 2 ? a : a + b).toUpperCase();
}
