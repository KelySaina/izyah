// Web Push handlers, imported into the Workbox-generated service worker
// (see vite.config.ts's `workbox.importScripts`). Kept as a plain script
// since generateSW doesn't let us author the SW file directly.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Izy'Ah", body: event.data ? event.data.text() : '' };
  }

  const title = data.title || "Izy'Ah";
  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => 'focus' in c);
      if (existing) {
        existing.focus();
        if ('navigate' in existing) existing.navigate(url);
        return undefined;
      }
      return self.clients.openWindow(url);
    }),
  );
});
