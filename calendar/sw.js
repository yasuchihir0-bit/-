// 通知を出すためだけの service worker（オフライン保存はしない）
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => {
    const c = list.find((w) => w.url.includes('/calendar/') || w.url.endsWith('index.html'));
    return c ? c.focus() : self.clients.openWindow('./index.html');
  }));
});
