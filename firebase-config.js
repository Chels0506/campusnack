window.CAMPUSNACK_FIREBASE_CONFIG = window.CAMPUSNACK_FIREBASE_CONFIG || {};
window.CAMPUSNACK_VAPID_KEY = window.CAMPUSNACK_VAPID_KEY || "";

window.CAMPUSNACK_FIREBASE_READY = (async () => {
  const config = window.CAMPUSNACK_FIREBASE_CONFIG;
  if (!Object.values(config).some(Boolean)) return;

  const scripts = [
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js",
    "https://www.gstatic.com/firebasejs/10.14.1/firebase-database-compat.js"
  ];
  for (const src of scripts) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Firebase SDK failed to load."));
      document.head.append(script);
    });
  }
  try {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js";
      script.onload = resolve;
      script.onerror = () => reject(new Error("Firebase Messaging SDK failed to load."));
      document.head.append(script);
    });
  } catch (error) {
    window.CAMPUSNACK_MESSAGING_LOAD_ERROR = error;
    console.error("Firebase Messaging SDK failed to load; order sync remains available.", error);
  }
})();
