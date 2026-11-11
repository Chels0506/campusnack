const CACHE_NAME = "campusnack-shell-v23";
const APP_SHELL = ["./", "./index.html", "./styles.css", "./app.js", "./firebase-public-config.js", "./firebase-config.js", "./manifest.json", "./campusnack-logo.jpg", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png"];

try {
  importScripts("./firebase-public-config.js");
  importScripts(
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js"
  );
  firebase.initializeApp(self.CAMPUSNACK_FIREBASE_CONFIG);
  firebase.messaging().onBackgroundMessage(payload => {
    const data = payload.data || {};
    const title = data.title || "CampuSnack update";
    return self.registration.showNotification(title, {
      body: data.body || "There is an update about CampuSnack.",
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-192.png",
      data: { url: data.url || "./" }
    });
  });
} catch (error) {
  console.error("Firebase background notifications are unavailable.", error);
}

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (new URL(event.request.url).origin === self.location.origin) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    }
    return response;
  })));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const requestedUrl = new URL(event.notification.data?.url || "./", self.location.href);
  const targetUrl = requestedUrl.origin === self.location.origin ? requestedUrl.href : self.location.origin;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
    const existing = clientList.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      if ("navigate" in existing) existing.navigate(targetUrl);
      return existing.focus();
    }
    return self.clients.openWindow(targetUrl);
  }));
});
