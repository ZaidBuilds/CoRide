// CoRide MVP2 — lightweight service worker for commute window pushes
self.addEventListener('push', (event) => {
  let data = { title: 'Your commute window is live 🚇', body: 'Travelers are nearby — open CoRide' };
  try { if (event.data) data = event.data.json(); } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'CoRide', {
      body: data.body || 'Live travelers near you',
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'coride-commute',
      renotify: false
    })
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/'));
});
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));
