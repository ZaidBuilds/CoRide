const API = 'http://localhost:4000';

export function track(event: string, userId?: string, payload?: Record<string, any>) {
  const uid = userId || (() => {
    try {
      const raw = localStorage.getItem('coride_profile');
      if (raw) return JSON.parse(raw).id;
    } catch {}
    return 'anonymous';
  })();
  // fire and forget
  fetch(`${API}/api/analytics/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, userId: uid, payload: { ...payload, ts: Date.now(), path: window.location.pathname } })
  }).catch(() => {});
  // also console for dev
  if (import.meta.env.DEV) {
    console.log(`[analytics] ${event}`, payload);
  }
}
