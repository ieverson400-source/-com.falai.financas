importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));
firebase.messaging();

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawLink = event.notification?.data?.FCM_MSG?.data?.link || "/app";
  const destination = new URL(rawLink, self.location.origin);
  if (destination.origin !== self.location.origin) return;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const current = windows.find((client) => "focus" in client);
      if (current) {
        current.navigate(destination.href);
        return current.focus();
      }
      return clients.openWindow(destination.href);
    }),
  );
});