import { API } from '../config';
import { jsonAuthHeaders } from './auth';

// `userId` is kept for call-site compatibility; the server attributes events
// to the signed token's user, never to a client-claimed id.
export function track(event: string, _userId?: string, payload?: Record<string, any>) {
  // fire and forget
  fetch(`${API}/api/analytics/event`, {
    method: 'POST',
    headers: jsonAuthHeaders(),
    body: JSON.stringify({ event, payload: { ...payload, ts: Date.now(), path: window.location.pathname } })
  }).catch(() => {});
  // also console for dev
  if (import.meta.env.DEV) {
    console.log(`[analytics] ${event}`, payload);
  }
}
