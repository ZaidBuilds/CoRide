// Backend origin. Set VITE_API_URL at build time (see .env.example) — the
// Play Store build must point at the hosted HTTPS backend, never localhost.
export const API: string = import.meta.env.VITE_API_URL || 'http://localhost:4000';
