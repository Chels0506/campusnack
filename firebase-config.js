window.CAMPUSNACK_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBGlGdYC0hsHHElDBQAfHLOpjH_ZKctv40",
  authDomain: "campusnack-cf2e5.firebaseapp.com",
  databaseURL: "https://campusnack-cf2e5-default-rtdb.firebaseio.com/",
  projectId: "campusnack-cf2e5",
  appId: "1:36339556848:web:a158babda8c8a85cb2fd35"
};

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
})();
