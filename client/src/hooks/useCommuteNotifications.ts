import { useEffect, useRef, useState } from 'react';

const API = 'http://localhost:4000';
const LS_KEY = 'coride_push_prompted';
const LS_LAST_PUSH = 'coride_last_push_day';

export function useCommuteNotifications(enabled: boolean) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isLive, setIsLive] = useState(false);
  const promptedRef = useRef(false);

  useEffect(() => {
    if (!('Notification' in window)) return;
    setPermission(Notification.permission);
    // register SW
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // poll commute windows — MVP2 push for active windows
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const check = async () => {
      try {
        const r = await fetch(`${API}/api/commute/windows`);
        const j = await r.json();
        if (!alive) return;
        setIsLive(!!j.isLiveNow);
        // local fallback notification once per day during window — if permission granted
        if (j.isLiveNow && Notification.permission === 'granted') {
          const today = new Date().toISOString().slice(0, 10);
          const last = localStorage.getItem(LS_LAST_PUSH);
          if (last !== today) {
            // small delay so user sees app first
            setTimeout(() => {
              try {
                new Notification('Your commute window is live 🚇', {
                  body: `${j.beachhead?.activeLines?.[0]?.name || 'Blue Line'} is bustling — open CoRide to see travelers`,
                  icon: '/favicon.svg'
                });
                localStorage.setItem(LS_LAST_PUSH, today);
              } catch {}
            }, 4000);
          }
        }
        // gentle prompt to enable notifications once per session if not yet decided
        if (j.isLiveNow && Notification.permission === 'default' && !promptedRef.current && !localStorage.getItem(LS_KEY)) {
          promptedRef.current = true;
        }
      } catch {}
    };
    check();
    const id = setInterval(check, 3 * 60 * 1000); // every 3min
    return () => { alive = false; clearInterval(id); };
  }, [enabled]);

  const requestPermission = async () => {
    if (!('Notification' in window)) return 'denied' as NotificationPermission;
    try {
      const p = await Notification.requestPermission();
      setPermission(p);
      localStorage.setItem(LS_KEY, '1');
      if (p === 'granted') {
        // pseudo-subscribe — store placeholder for server push registry
        try {
          const stored = localStorage.getItem('coride_profile');
          const uid = stored ? JSON.parse(stored).id : 'anon';
          const dummySub = { endpoint: `local:${uid}`, keys: {} };
          await fetch(`${API}/api/push/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: uid, subscription: dummySub, commutePrefs: { morning: true, evening: true } })
          });
        } catch {}
        new Notification('CoRide notifications on ✅', { body: 'We’ll ping you when your commute window is live and travelers are nearby.' });
      }
      return p;
    } catch {
      return 'denied' as NotificationPermission;
    }
  };

  return { permission, isLive, requestPermission, prompted: promptedRef.current };
}
