self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Recordatorio • Organiza',
    body: 'Tienes un recordatorio pendiente.',
    tag: 'organiza-reminder',
    url: '/reminders',
    taskId: null,
    actionToken: null,
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      const text = event.data.text();
      if (text) {
        payload.body = text;
      }
    }
  }

  const options = {
    body: payload.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || (payload.taskId ? `reminder-${payload.taskId}` : 'organiza-reminder'),
    renotify: true,
    data: {
      url: payload.url || '/reminders',
      taskId: payload.taskId || null,
      actionToken: payload.actionToken || null,
    },
    actions: payload.taskId
      ? [
          { action: 'complete', title: '✓ Completar' },
          { action: 'snooze', title: '⏰ +1 hora' },
        ]
      : [],
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const data = notification.data || {};
  const action = event.action;

  notification.close();

  if ((action === 'complete' || action === 'snooze') && data.taskId) {
    event.waitUntil(
      (async () => {
        try {
          await fetch('/api/reminders/push-action', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId: data.taskId,
              action,
              actionToken: data.actionToken || undefined,
            }),
          });
        } catch {
          // Si falla sin red, al abrir la app se sincronizará
        }

        const windowClients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true,
        });
        for (const client of windowClients) {
          client.postMessage({
            type: 'REMINDER_ACTION_APPLIED',
            taskId: data.taskId,
            action,
          });
        }
      })()
    );
    return;
  }

  const targetUrl = data.url || '/reminders';
  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of windowClients) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client && typeof client.navigate === 'function') {
            try {
              await client.navigate(targetUrl);
            } catch {
              // Ignorar si ya está en la misma SPA
            }
          }
          return;
        }
      }

      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl);
      }
    })()
  );
});
