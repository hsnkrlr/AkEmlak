// Ak Emlak Yönetim — yalnızca bildirim için service worker.
// Önbellekleme yapmaz (fetch dinleyicisi yok); veriler her zaman sunucudan gelir.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let p = {};
  try {
    p = event.data ? event.data.json() : {};
  } catch (e) {
    p = {};
  }
  const n = p.notification || {};
  const data = p.data || {};
  const link = data.link || (p.fcmOptions && p.fcmOptions.link) || '/yonetim/';
  event.waitUntil(
    self.registration.showNotification(n.title || 'Ak Emlak Yönetim', {
      body: n.body || '',
      icon: '/yonetim/icon-192.png',
      badge: '/yonetim/icon-192.png',
      tag: data.basvuruId || undefined,
      data: { link },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/yonetim/';
  const url = new URL(link, self.location.origin);
  // Yalnızca kendi sitemizdeki bağlantılar açılır
  if (url.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin + '/yonetim')) {
          // Kapsam dışındaki pencere (ör. /yonetim) yönlendirilemezse yeni pencere açılır
          return c
            .navigate(url.href)
            .then((w) => (w || c).focus())
            .catch(() => self.clients.openWindow(url.href));
        }
      }
      return self.clients.openWindow(url.href);
    }),
  );
});
