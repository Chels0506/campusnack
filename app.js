const STORAGE = {
  profile: "campusnack.profile",
  orders: "campusnack.orders",
  menu: "campusnack.menu",
  likes: "campusnack.likes",
  gcashQr: "campusnack.gcashQr",
  orderCounter: "campusnack.orderCounter"
};
const STAFF_CODE = "EAPIHS2009";
const APP_PUBLIC_URL = "https://chels0506.github.io/campusnack/";
const firebaseConfig = window.CAMPUSNACK_FIREBASE_CONFIG || {};
const statuses = ["Received", "Preparing", "Ready for pickup", "Completed"];
const initialMenu = [
  { id: "chicken-meal", name: "Crispy Chicken Meal", category: "Meals", description: "Golden chicken, rice & gravy", price: 85, points: 8, stock: 18, emoji: "🍗", tag: "Canteen favorite" },
  { id: "pork-silog", name: "Porksilog", category: "Rice dishes", description: "Savory pork, egg & garlic rice", price: 75, points: 7, stock: 14, emoji: "🍳", tag: "Bestseller" },
  { id: "pancit", name: "Pancit Canton", category: "Meals", description: "Noodles with veggies & chicken", price: 55, points: 5, stock: 10, emoji: "🍜", tag: "Made fresh" },
  { id: "banana-cue", name: "Banana Cue", category: "Snacks", description: "Sweet saba, caramelized just right", price: 20, points: 2, stock: 22, emoji: "🍌", tag: "Sweet treat" },
  { id: "siomai", name: "Pork Siomai (4 pcs)", category: "Snacks", description: "Steamed bites with chili garlic", price: 35, points: 3, stock: 25, emoji: "🥟", tag: "" },
  { id: "iced-tea", name: "House Iced Tea", category: "Drinks", description: "Cool, refreshing & not too sweet", price: 18, points: 2, stock: 30, emoji: "🧋", tag: "" },
  { id: "bistek", name: "Beef Tapa", category: "Rice dishes", description: "Tender tapa with sunny-side egg", price: 90, points: 9, stock: 8, emoji: "🥩", tag: "Staff pick" },
  { id: "water", name: "Bottled Water", category: "Drinks", description: "Stay refreshed through the day", price: 15, points: 1, stock: 36, emoji: "💧", tag: "" },
  { id: "lumpia", name: "Fresh Lumpia", category: "Snacks", description: "Crisp and crunchy veggie rolls", price: 30, points: 3, stock: 12, emoji: "🥠", tag: "" }
];
const read = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.error(`Unable to read ${key} from local storage.`, error);
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Unable to save ${key} to local storage.`, error);
    toast("Could not save your changes on this device.");
  }
};
let menu = read(STORAGE.menu, initialMenu);
let orders = read(STORAGE.orders, []);
let profile = read(STORAGE.profile, null);
let likes = new Set(read(STORAGE.likes, []));
let gcashQr = read(STORAGE.gcashQr, null);
let gcashQrDraft = null;
let gcashQrUploadMessage = "";
let cart = {};
let paymentReference = "";
let category = "All";
let query = "";
let payment = "Wallet";
let customerTab = "Menu";
let staffTab = "Orders";
let toastTimer;
let installPrompt = null;
let firebaseAuth = null;
let ordersDatabase = null;
let orderSubscription = null;
let menuSubscription = null;
let paymentSettingsSubscription = null;
let realtimeEnabled = false;
let realtimeSetupError = null;
let realtimeStatus = "connecting";
let salesPeriod = "week";
let customerAuthMode = "signin";
let pendingCustomerUser = null;
let pendingCustomerRole = "Student";

function setupRealtime() {
  const configValues = ["apiKey", "authDomain", "databaseURL", "projectId", "appId"];
  const configuredValues = configValues.filter(key => Boolean(firebaseConfig[key]));
  if (!configuredValues.length) return;
  if (configuredValues.length !== configValues.length) {
    throw new Error("Firebase config is incomplete. Fill in all settings in firebase-config.js.");
  }
  if (!window.firebase?.initializeApp || !window.firebase.database) {
    throw new Error("Firebase SDK failed to load. Check your internet connection and reload.");
  }
  const app = window.firebase.apps.length ? window.firebase.app() : window.firebase.initializeApp(firebaseConfig);
  firebaseAuth = app.auth();
  ordersDatabase = app.database();
  realtimeEnabled = true;
}

const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));
const money = amount => `₱${Number(amount).toFixed(2)}`;
const orderCode = order => order.displayId || order.id;
const pointsToPeso = points => Number(points) / 10;
const dateKey = value => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const todayOrders = () => orders.filter(order => dateKey(order.createdAt) === dateKey(Date.now()));
const customerOrders = () => orders.filter(order => order.owner === profile?.id).sort((a, b) => b.createdAt - a.createdAt);
const currentPoints = () => Math.max(0,
  Number(profile?.points || 0) +
  customerOrders().filter(order => order.status === "Completed").reduce((sum, order) => sum + Number(order.points || 0), 0) -
  customerOrders().reduce((sum, order) => sum + Number(order.pointsUsed || 0), 0)
);
const walletBalanceInfo = total => {
  const availablePoints = currentPoints();
  const pointsUsed = Math.min(availablePoints, Math.floor((total + Number.EPSILON) * 10));
  const discount = pointsToPeso(pointsUsed);
  return { availablePoints, discount, pointsUsed, canUseWallet: pointsUsed > 0 };
};

function toast(message) {
  document.querySelector(".toast")?.remove();
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  document.body.append(node);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.remove(), 2600);
}

function render() {
  if (!profile) renderLogin();
  else if (profile.role === "Staff") renderStaff();
  else renderCustomer();
}

function renderLogin(selectedRole = "Student") {
  document.getElementById("app").innerHTML = `
    <main class="auth-wrap">
      <section class="auth-art">
        <div class="auth-brand-row"><div class="brand" style="color:white"><img src="campusnack-logo.jpg" alt="">Campu<em>Snack</em></div><div class="auth-actions"><button class="share-button" data-install-app aria-label="Add to Home Screen" type="button">＋ Add to Home Screen</button><button class="share-button" data-share-app type="button">▦ Share app</button></div></div>
        <div>
          <div class="eyebrow" style="color:#d6ef9f">Your school canteen, reimagined</div>
          <h1>Good food.<br><span>Good day.</span></h1>
          <p class="subtle">Skip the line, find your favorites, and earn a little extra joy with every order.</p>
        </div>
        <div class="auth-illustration" aria-hidden="true">🍱</div>
      </section>
      <section class="auth-form-wrap">
        <form class="auth-form" id="login-form">
          <div class="eyebrow">Welcome to the canteen</div>
          <h2>${selectedRole === "Staff" ? "Canteen staff sign in" : realtimeEnabled && customerAuthMode === "create" ? "Create your account" : "Let's get you started"}</h2>
          <p class="subtle">${selectedRole === "Staff" ? realtimeEnabled ? "Sign in with your Firebase staff account." : "Enter your name and local demo staff code to continue." : realtimeEnabled ? "Use your email and password to securely access your school canteen account." : "Sign in with your school details to continue."}</p>
          <div class="role-switch" aria-label="Choose account type">
            ${["Student", "Teacher", "Staff"].map(role => `<button type="button" class="${role === selectedRole ? "active" : ""}" data-role="${role}">${role}</button>`).join("")}
          </div>
          ${selectedRole !== "Staff" && realtimeEnabled ? `<div class="role-switch auth-mode-switch" aria-label="Choose sign-in mode"><button type="button" class="${customerAuthMode === "signin" ? "active" : ""}" data-auth-mode="signin">Sign in</button><button type="button" class="${customerAuthMode === "create" ? "active" : ""}" data-auth-mode="create">Create account</button></div>` : ""}
          ${selectedRole === "Staff" || !realtimeEnabled || customerAuthMode === "create" ? `<div class="field"><label for="full-name">Full name</label><input id="full-name" name="name" autocomplete="name" placeholder="e.g. Alex Santos" required></div>` : ""}
          <div class="field"><label for="email-address">Email address</label><input id="email-address" name="email" type="email" autocomplete="email" placeholder="you@example.com" required></div>
          ${selectedRole === "Staff" ? `
            ${realtimeEnabled ? `<div class="field"><label for="staff-password">Password</label><input id="staff-password" name="password" type="password" autocomplete="current-password" placeholder="Enter your staff account password" required></div>` : `<div class="field"><label for="school-id">Employee ID <span class="subtle">(optional)</span></label><input id="school-id" name="schoolId" autocomplete="off" inputmode="numeric" pattern="[0-9]{7}" maxlength="7" data-digit-limit="7" title="Employee ID must be exactly 7 digits" placeholder="7 digits"></div><div class="field"><label for="staff-code">Local demo staff code</label><input id="staff-code" name="staffCode" type="password" autocomplete="off" placeholder="Enter the local demo code" required><div class="staff-code-help">This code is not secure authentication and must not be used for a live queue.</div></div>`}
          ` : `
            ${realtimeEnabled ? `<div class="field"><label for="customer-password">Password</label><input id="customer-password" name="password" type="password" autocomplete="${customerAuthMode === "create" ? "new-password" : "current-password"}" minlength="${customerAuthMode === "create" ? 6 : 1}" placeholder="${customerAuthMode === "create" ? "At least 6 characters" : "Enter your password"}" required></div>` : ""}
            ${!realtimeEnabled || customerAuthMode === "create" ? `
            <div class="field-grid">
              <div class="field"><label for="grade-level">${selectedRole === "Teacher" ? "Department / grade" : "Grade level"}</label><input id="grade-level" name="grade" placeholder="${selectedRole === "Teacher" ? "e.g. Mathematics" : "e.g. Grade 10"}" required></div>
              <div class="field"><label for="section">Section</label><input id="section" name="section" placeholder="e.g. Mabini" required></div>
            </div>
            <div class="field"><label for="school-id">${selectedRole === "Teacher" ? "Employee ID" : "LRN"}</label><input id="school-id" name="schoolId" inputmode="numeric" pattern="[0-9]{${selectedRole === "Teacher" ? 7 : 12}}" maxlength="${selectedRole === "Teacher" ? 7 : 12}" data-digit-limit="${selectedRole === "Teacher" ? 7 : 12}" title="${selectedRole === "Teacher" ? "Employee ID must be exactly 7 digits" : "LRN must be exactly 12 digits"}" placeholder="${selectedRole === "Teacher" ? "Enter 7-digit employee ID" : "Enter 12-digit LRN"}" required><div class="field-help">${selectedRole === "Teacher" ? "Enter exactly 7 digits." : "Enter exactly 12 digits."}</div></div>
            ` : ""}
          `}
          <button class="primary" type="submit" ${realtimeSetupError ? "disabled" : ""}>${selectedRole === "Staff" ? "Sign in as Canteen Staff" : realtimeEnabled ? customerAuthMode === "create" ? `Create ${selectedRole} Account` : "Sign in" : `Continue as ${selectedRole}`}</button>
          <div class="auth-notice">${realtimeSetupError ? "Firebase setup is unavailable. Correct the configuration or restore the Firebase SDK connection, then reload. Sign-in is disabled." : realtimeEnabled ? selectedRole === "Staff" ? "Staff use their Firebase Email/Password account. Only staff accounts on the database allowlist can access staff tools." : "Customer accounts use Firebase Email/Password. Use an email address you can access and keep your password private." : "Local demo only: account information is not verified and is saved only in this browser on this device."}</div>
        </form>
      </section>
    </main>
    <div id="modal-root"></div>`;
    let role = selectedRole;
    document.querySelectorAll("[data-role]").forEach(button => button.addEventListener("click", () => renderLogin(button.dataset.role)));
    document.querySelectorAll("[data-auth-mode]").forEach(button => button.addEventListener("click", () => {
      customerAuthMode = button.dataset.authMode;
      renderLogin(role);
    }));
    document.querySelectorAll("[data-digit-limit]").forEach(input => input.addEventListener("input", () => {
      input.value = input.value.replace(/\D/g, "").slice(0, Number(input.dataset.digitLimit));
    }));
    bindShareApp();
    bindInstallApp();
    document.getElementById("login-form").addEventListener("submit", async event => {
    event.preventDefault();
    if (realtimeSetupError) {
      toast("Firebase setup is unavailable. Sign-in is disabled until it is fixed.");
      return;
    }
    const form = new FormData(event.currentTarget);
    if (role === "Staff" && !realtimeEnabled && form.get("staffCode") !== STAFF_CODE) {
      toast("That staff code isn't correct.");
      return;
    }
    const email = String(form.get("email") || "").trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast("Enter a valid email address.");
      return;
    }
    const schoolId = String(form.get("schoolId") || "").trim();
    const requiredIdLength = role === "Student" ? 12 : role === "Teacher" ? 7 : 0;
    const validateCustomerSchoolId = role !== "Staff" && (!realtimeEnabled || customerAuthMode === "create");
    if ((requiredIdLength && validateCustomerSchoolId && !new RegExp(`^\\d{${requiredIdLength}}$`).test(schoolId)) ||
        (role === "Staff" && schoolId && !/^\d{7}$/.test(schoolId))) {
      toast(role === "Student" ? "LRN must contain exactly 12 digits." : "Employee ID must contain exactly 7 digits.");
      return;
    }
    const name = String(form.get("name") || "").trim();
    let customerDetails = null;
    if (role !== "Staff" && customerAuthMode === "create") {
      customerDetails = {
        name,
        grade: String(form.get("grade") || "").trim(),
        section: String(form.get("section") || "").trim(),
        schoolId,
        role,
        points: 0
      };
      if (!customerDetails.name || !customerDetails.grade || !customerDetails.section) {
        toast("Complete your name, grade or department, and section.");
        return;
      }
    }
    const roleKey = role.toLowerCase();
    const finishLocalSignIn = () => {
      let userId = `${roleKey}:${(schoolId || name).toLowerCase()}`;
      profile = {
        id: userId,
        name,
        email,
        grade: String(form.get("grade") || "").trim(),
        section: String(form.get("section") || "").trim(),
        schoolId,
        role,
        points: 0
      };
      write(STORAGE.profile, profile);
      connectOrderSync();
      render();
    };
    if (!realtimeEnabled) {
      finishLocalSignIn();
      return;
    }

    try {
      const password = String(form.get("password") || "");
      if (role !== "Staff" && customerAuthMode === "create") {
        if (password.length < 6) {
          toast("Password must contain at least 6 characters.");
          return;
        }
        const credential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
        pendingCustomerUser = credential.user;
        await saveCustomerProfile(credential.user, customerDetails);
        return;
      }
      const credential = await firebaseAuth.signInWithEmailAndPassword(email, password);
      if (role === "Staff") {
        profile = { id: credential.user.uid, name, email, schoolId, role, points: 0 };
        write(STORAGE.profile, profile);
        connectOrderSync();
        render();
        return;
      }
      const profileSnapshot = await ordersDatabase.ref("customerProfiles").child(credential.user.uid).once("value");
      const savedProfile = profileSnapshot.val();
      if (savedProfile) {
        finishCustomerSignIn(credential.user, savedProfile);
        return;
      }
      pendingCustomerUser = credential.user;
      pendingCustomerRole = role;
      renderCustomerProfileSetup(role);
    } catch (error) {
      console.error(`${role} Firebase authentication failed.`, error);
      toast(firebaseAuthErrorMessage(error, customerAuthMode === "create" && role !== "Staff"));
    }
    });
}

function firebaseAuthErrorMessage(error, isCreateAccount) {
  switch (error.code) {
    case "auth/email-already-in-use": return "An account already uses this email. Choose Sign in instead.";
    case "auth/invalid-email": return "Enter a valid email address.";
    case "auth/weak-password": return "Choose a stronger password with at least 6 characters.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found": return "Email or password is incorrect. Check your details or create an account.";
    case "auth/too-many-requests": return "Too many attempts. Wait a while before trying again.";
    case "auth/operation-not-allowed": return "Email/Password sign-in is disabled. Enable it in Firebase Authentication settings.";
    default: return error.message || (isCreateAccount ? "Could not create the account." : "Could not sign in.");
  }
}

function renderCustomerProfileSetup(role = "Student") {
  pendingCustomerRole = role;
  document.getElementById("app").innerHTML = `<main class="auth-wrap"><section class="auth-art"><div class="brand" style="color:white"><img src="campusnack-logo.jpg" alt="">Campu<em>Snack</em></div><div><div class="eyebrow" style="color:#d6ef9f">Complete your account</div><h1>Welcome to CampuSnack.</h1><p class="subtle">Your email account is ready. Add your school details to finish setting up your account.</p></div><div class="auth-illustration" aria-hidden="true">🍱</div></section><section class="auth-form-wrap"><form class="auth-form" id="customer-profile-form"><div class="eyebrow">School profile</div><h2>About you</h2><div class="role-switch auth-mode-switch" aria-label="Choose account type"><button type="button" class="${role === "Student" ? "active" : ""}" data-profile-role="Student">Student</button><button type="button" class="${role === "Teacher" ? "active" : ""}" data-profile-role="Teacher">Teacher</button></div><div class="field"><label for="profile-name">Full name</label><input id="profile-name" name="name" autocomplete="name" required></div><div class="field-grid"><div class="field"><label for="profile-grade">${role === "Teacher" ? "Department / grade" : "Grade level"}</label><input id="profile-grade" name="grade" required></div><div class="field"><label for="profile-section">Section</label><input id="profile-section" name="section" required></div></div><div class="field"><label for="profile-school-id">${role === "Teacher" ? "Employee ID" : "LRN"}</label><input id="profile-school-id" name="schoolId" inputmode="numeric" pattern="[0-9]{${role === "Teacher" ? 7 : 12}}" maxlength="${role === "Teacher" ? 7 : 12}" data-profile-digit-limit="${role === "Teacher" ? 7 : 12}" title="${role === "Teacher" ? "Employee ID must be exactly 7 digits" : "LRN must be exactly 12 digits"}" required><div class="field-help">Enter exactly ${role === "Teacher" ? 7 : 12} digits.</div></div><button class="primary" type="submit">Save profile and continue</button></form></section></main><div id="modal-root"></div>`;
  document.querySelectorAll("[data-profile-role]").forEach(button => button.addEventListener("click", () => renderCustomerProfileSetup(button.dataset.profileRole)));
  document.querySelector("[data-profile-digit-limit]")?.addEventListener("input", event => {
    const input = event.currentTarget;
    input.value = input.value.replace(/\D/g, "").slice(0, Number(input.dataset.profileDigitLimit));
  });
  document.getElementById("customer-profile-form").addEventListener("submit", async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const schoolId = String(data.get("schoolId") || "").trim();
    const requiredLength = pendingCustomerRole === "Student" ? 12 : 7;
    if (!new RegExp(`^\\d{${requiredLength}}$`).test(schoolId)) {
      toast(pendingCustomerRole === "Student" ? "LRN must contain exactly 12 digits." : "Employee ID must contain exactly 7 digits.");
      return;
    }
    await saveCustomerProfile(pendingCustomerUser, {
      name: String(data.get("name") || "").trim(),
      grade: String(data.get("grade") || "").trim(),
      section: String(data.get("section") || "").trim(),
      schoolId,
      role: pendingCustomerRole,
      points: 0
    });
  });
}

async function saveCustomerProfile(user, customerProfile) {
  if (!user) {
    toast("Your signed-in session expired. Sign in again.");
    renderLogin();
    return;
  }
  const savedProfile = {
    ...customerProfile,
    id: user.uid,
    email: user.email,
    updatedAt: Date.now()
  };
  try {
    await ordersDatabase.ref("customerProfiles").child(user.uid).set(savedProfile);
    finishCustomerSignIn(user, savedProfile);
  } catch (error) {
    console.error("Unable to save the signed-in customer's school profile.", error);
    toast("Your account is signed in, but the school profile could not be saved. Check Firebase database rules and try again.");
  }
}

function finishCustomerSignIn(user, savedProfile) {
  profile = { ...savedProfile, id: user.uid };
  pendingCustomerUser = null;
  customerAuthMode = "signin";
  write(STORAGE.profile, profile);
  connectOrderSync();
  render();
}

function connectOrderSync() {
  if (!realtimeEnabled || !firebaseAuth.currentUser || !profile) return;
  if (orderSubscription) orderSubscription.off("value");
  if (menuSubscription) menuSubscription.off("value");
  if (paymentSettingsSubscription) paymentSettingsSubscription.off("value");
  const user = firebaseAuth.currentUser;
  const reference = ordersDatabase.ref("orders");
  const query = profile.role === "Staff" ? reference : reference.orderByChild("owner").equalTo(user.uid);
  orderSubscription = query;
  query.on("value", snapshot => {
    realtimeStatus = "live";
    const values = snapshot.val() || {};
    orders = Object.entries(values).map(([id, order]) => ({ ...order, id }));
    write(STORAGE.orders, orders);
    if (profile) render();
  }, error => {
    realtimeStatus = "error";
    console.error("Live order synchronization failed.", error);
    if (profile?.role === "Staff") renderStaff();
    toast("Live order sync failed. Check Firebase database rules and your connection.");
  });

  menuSubscription = ordersDatabase.ref("menu");
  menuSubscription.on("value", snapshot => {
    const values = snapshot.val();
    if (values) {
      menu = (Array.isArray(values) ? values : Object.values(values))
        .filter(Boolean)
        .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
      write(STORAGE.menu, menu);
      if (profile) render();
      return;
    }
    if (profile.role === "Staff") {
      Promise.all(menu.map((item, index) => ordersDatabase.ref("menu").child(item.id).transaction(
        current => current || { ...item, sortOrder: Number(item.sortOrder ?? index) },
        undefined,
        false
      ))).catch(error => {
        console.error("Unable to initialize the shared menu.", error);
        toast("Could not publish the menu to Firebase. Check staff access and try again.");
      });
    }
  }, error => {
    console.error("Live menu synchronization failed.", error);
    toast("Live menu sync failed. Check Firebase database rules and your connection.");
  });

  paymentSettingsSubscription = ordersDatabase.ref("paymentSettings/gcashQr");
  paymentSettingsSubscription.on("value", snapshot => {
    const nextQr = snapshot.val() || null;
    const qrChanged = gcashQr?.updatedAt !== nextQr?.updatedAt;
    gcashQr = nextQr;
    if (qrChanged && paymentReference) {
      paymentReference = "";
      if (payment === "QR") toast("The receiver QR changed. Check the current recipient and enter your payment reference again.");
    }
    write(STORAGE.gcashQr, gcashQr);
    if (profile) render();
  }, error => {
    console.error("Live GCash QR synchronization failed.", error);
    toast("The GCash payment QR could not be loaded. Check Firebase rules and your connection.");
  });
}

function renderCustomer() {
  const name = escapeHTML(profile.name);
  const initial = name.charAt(0).toUpperCase() || "?";
  const content = customerTab === "Menu" ? customerMenuContent() : customerTab === "Orders" ? customerOrdersContent() : profileContent();
  document.getElementById("app").innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand"><img src="campusnack-logo.jpg" alt="">Campu<em>Snack</em></div>
        <div class="top-actions">
          <button class="share-button" data-install-app aria-label="Add to Home Screen" type="button">＋ Add to Home Screen</button>
          <button class="share-button" data-share-app type="button">▦ Share app</button>
          <button class="icon-button" id="logout" title="Sign out">Sign out</button>
          <div class="user-chip"><span class="avatar">${initial}</span><span class="user-name">${name}</span></div>
        </div>
      </header>
      <main class="page">
        <div class="customer-layout">
          <section class="main-content">
            <div class="welcome"><div><div class="eyebrow">Your campus canteen</div><h1>Hey, ${name.split(" ")[0]} 👋</h1><p class="subtle">What sounds good today?</p></div><div class="points-pill">✦ ${currentPoints()} points</div></div>
            ${content}
          </section>
          <aside class="sidebar">
            ${customerTab === "Menu" ? cartContent() : `<div class="panel"><div class="reward-card"><div><h3>Your rewards</h3><p>${currentPoints()} points ready to earn</p></div><span class="reward-emoji">🎁</span></div><p class="footer-note">Earn points with each completed order. Your order history and rewards stay on this device.</p></div>`}
            <div class="panel"><h2>Lunch, made easier</h2><p class="subtle" style="font-size:12px;line-height:1.6;margin:0">Place your order ahead and pick it up at the canteen counter. Your order status updates here.</p></div>
          </aside>
        </div>
      </main>
      ${modalMarkup()}
    </div>`;
  document.getElementById("logout").addEventListener("click", logout);
  bindShareApp();
  bindInstallApp();
  document.querySelectorAll("[data-customer-tab]").forEach(button => button.addEventListener("click", () => { customerTab = button.dataset.customerTab; render(); }));
  document.querySelectorAll("[data-category]").forEach(button => button.addEventListener("click", () => { category = button.dataset.category; render(); }));
  document.getElementById("menu-search")?.addEventListener("input", event => {
    const selection = event.target.selectionStart;
    query = event.target.value;
    renderCustomer();
    const input = document.getElementById("menu-search");
    input.focus();
    input.setSelectionRange(selection, selection);
  });
  document.querySelectorAll("[data-like]").forEach(button => button.addEventListener("click", () => {
    const id = button.dataset.like;
    likes.has(id) ? likes.delete(id) : likes.add(id);
    write(STORAGE.likes, [...likes]);
    renderCustomer();
  }));
  document.querySelectorAll("[data-add]").forEach(button => button.addEventListener("click", () => updateCart(button.dataset.add, 1)));
  document.querySelectorAll("[data-qty]").forEach(button => button.addEventListener("click", () => updateCart(button.dataset.id, Number(button.dataset.qty))));
  document.querySelectorAll("[data-payment]").forEach(button => button.addEventListener("click", () => { payment = button.dataset.payment; renderCustomer(); }));
  document.getElementById("gcash-payment-reference")?.addEventListener("input", event => {
    paymentReference = event.target.value;
    const checkoutButton = document.getElementById("checkout");
    if (checkoutButton) checkoutButton.disabled = !paymentReference.trim();
  });
  document.getElementById("checkout")?.addEventListener("click", checkout);
  document.querySelectorAll("[data-track]").forEach(button => button.addEventListener("click", () => openTracker(button.dataset.track)));
  bindModalClose();
}

function customerMenuContent() {
  const categories = ["All", "Meals", "Snacks", "Drinks", "Rice dishes", "♥ Liked"];
  const visible = menu.filter(item =>
    (category === "All" || (category === "♥ Liked" ? likes.has(item.id) : item.category === category)) &&
    `${item.name} ${item.description}`.toLowerCase().includes(query.toLowerCase())
  );
  return `
    <nav class="bottom-nav">${["Menu", "Orders", "Profile"].map(tab => `<button class="nav-tab ${customerTab === tab ? "active" : ""}" data-customer-tab="${tab}">${tab}</button>`).join("")}</nav>
    <div class="hero"><div><div class="eyebrow">Made fresh, just for you</div><h2>A little break. A really good bite.</h2><p>Order ahead and make your break count.</p></div><div class="hero-food" aria-hidden="true">🍛</div></div>
    <div class="section-heading"><h2>Today's menu</h2><input class="search" id="menu-search" value="${escapeHTML(query)}" placeholder="⌕  Search menu" aria-label="Search menu"></div>
    <div class="categories">${categories.map(item => `<button class="category ${category === item ? "active" : ""}" data-category="${item}">${item}</button>`).join("")}</div>
    <div class="menu-grid" style="margin-top:15px">${visible.length ? visible.map(foodCard).join("") : `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🍽️</div>No menu items match. Try another category or search.</div>`}</div>`;
}

function foodCard(item) {
  return `<article class="food-card">
    <div class="food-art">${item.image ? `<img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}">` : `<span>${escapeHTML(item.emoji)}</span>`}${item.tag ? `<span class="tag">${escapeHTML(item.tag)}</span>` : ""}<button class="like ${likes.has(item.id) ? "liked" : ""}" data-like="${escapeHTML(item.id)}" aria-label="${likes.has(item.id) ? "Unlike" : "Like"} ${escapeHTML(item.name)}">${likes.has(item.id) ? "♥" : "♡"}</button></div>
    <div class="food-info"><h3>${escapeHTML(item.name)}</h3><p class="description">${escapeHTML(item.description)}</p><div class="food-bottom"><div><span class="price">${money(item.price)}</span><span class="food-points">✦ ${item.points} points</span></div><button class="add-btn" data-add="${escapeHTML(item.id)}" aria-label="Add ${escapeHTML(item.name)} to cart" ${item.stock < 1 ? "disabled" : ""}>${item.stock < 1 ? "−" : "+"}</button></div></div>
  </article>`;
}

function cartContent() {
  const entries = Object.entries(cart).filter(([, quantity]) => quantity > 0);
  const total = entries.reduce((sum, [id, quantity]) => sum + (menu.find(item => item.id === id)?.price || 0) * quantity, 0);
  const earned = entries.reduce((sum, [id, quantity]) => sum + (menu.find(item => item.id === id)?.points || 0) * quantity, 0);
  const wallet = walletBalanceInfo(total);
  if (payment === "Wallet" && !wallet.canUseWallet) payment = "Cash";
  return `<div class="panel"><h2>Your order <span style="color:#92988f;font-size:12px;font-weight:500">${entries.reduce((sum, [, count]) => sum + count, 0)} items</span></h2>
    ${entries.length ? entries.map(([id, quantity]) => {
      const item = menu.find(food => food.id === id);
      if (!item) return "";
      return `<div class="cart-row"><div><strong>${escapeHTML(item.name)}</strong>${money(item.price)} each</div><div class="qty-control"><button data-qty="-1" data-id="${escapeHTML(id)}" aria-label="Remove one">−</button>${quantity}<button data-qty="1" data-id="${escapeHTML(id)}" aria-label="Add one">+</button></div></div>`;
    }).join("") : `<div class="cart-empty"><span>🛍️</span>Your cart is waiting for something tasty.</div>`}
    <div class="cart-total"><span>Total</span><span>${money(total)}</span></div>
    ${payment === "Wallet" && wallet.canUseWallet ? `<div class="cart-total"><span>Points discount · ${wallet.pointsUsed} pts</span><span>−${money(wallet.discount)}</span></div><div class="cart-total"><strong>After points discount</strong><strong>${money(Math.max(0, total - wallet.discount))}</strong></div>` : ""}
    <div class="cart-reward">✦ You'll earn ${earned} points with this order</div>
    <div class="payment-label">Choose how to pay</div><div class="payment-options">${["Wallet", "QR", "Cash"].map(method => `<button class="payment-option ${payment === method ? "active" : ""}" data-payment="${method}" ${method === "Wallet" && !wallet.canUseWallet ? "disabled title=\"Earn points from completed orders before using Wallet\"" : method === "QR" && !gcashQr?.imageData ? "disabled title=\"The canteen has not added a GCash QR yet\"" : ""}>${method === "Wallet" ? "◉ Wallet" : method === "QR" ? "▦ GCash QR" : "▤ Cash"}</button>`).join("")}</div>
    ${payment === "Wallet" ? `<div class="payment-label" style="margin-top:8px">Wallet points: ${wallet.availablePoints} pts · ${money(pointsToPeso(wallet.availablePoints))} available. Applying ${wallet.pointsUsed} pts (${money(wallet.discount)} discount). 50 points = ₱5.00. Demo only; no actual money is charged.</div>` : ""}
    ${payment === "QR" ? gcashQr?.imageData ? `<div class="gcash-payment"><p>Scan this GCash QR using another device, or save the image and use GCash's QR gallery option. Verify the recipient name in GCash before sending <strong>${money(total)}</strong>.</p><img src="${escapeHTML(gcashQr.imageData)}" alt="Canteen GCash payment QR code"><label for="gcash-payment-reference">GCash reference number</label><input id="gcash-payment-reference" type="text" maxlength="80" autocomplete="off" placeholder="Enter the reference number after paying" value="${escapeHTML(paymentReference)}"><small>Staff will check the transfer in GCash before confirming your order. Do not send money if the displayed recipient is incorrect.</small></div>` : `<div class="payment-label">The canteen has not set up a GCash QR code yet. Please choose another payment method.</div>` : ""}
    <button class="primary" id="checkout" style="margin-top:15px" ${entries.length && (payment !== "QR" || paymentReference.trim()) ? "" : "disabled"}>${payment === "QR" ? "I sent payment · " : "Place order · "}${money(payment === "Wallet" ? Math.max(0, total - wallet.discount) : total)}</button>
  </div>`;
}

function customerOrdersContent() {
  const list = customerOrders();
  return `<nav class="bottom-nav">${["Menu", "Orders", "Profile"].map(tab => `<button class="nav-tab ${customerTab === tab ? "active" : ""}" data-customer-tab="${tab}">${tab}</button>`).join("")}</nav>
    <div class="section-heading"><div><div class="eyebrow">Your canteen activity</div><h2>Order history</h2></div></div>
    ${list.length ? `<div class="order-list">${list.map(order => `<article class="order-card"><div class="order-card-top"><div><strong>Order ${escapeHTML(orderCode(order))}</strong><p class="subtle" style="font-size:11px;margin:5px 0">${new Date(order.createdAt).toLocaleString()} · ${escapeHTML(order.payment)}</p></div><span class="order-status ${order.status === "Cancelled" ? "order-cancelled" : ""}">${escapeHTML(order.status)}</span></div>${order.paymentStatus === "pending_review" ? `<p class="payment-review-note">GCash transfer reported · awaiting staff verification</p>` : order.paymentStatus === "paid" ? `<p class="payment-confirmed-note">GCash payment confirmed by staff</p>` : order.paymentStatus === "not_received" ? `<p class="payment-review-note">Staff could not confirm the transfer. ${order.stockRestorationStatus === "complete" ? "The order was cancelled and stock returned." : order.stockRestorationStatus === "manual_review" ? "The order was cancelled; staff is correcting stock." : "The order was cancelled and stock is being restored."}</p>` : ""}<div style="font-size:12px;color:#657168">${order.items.map(item => `${item.quantity}× ${escapeHTML(item.name)}`).join(", ")}</div><div class="order-card-top" style="margin-top:12px"><strong>${money(Math.max(0, Number(order.total || 0) - Number(order.walletDiscount || 0)))}${order.walletDiscount ? ` after ${money(order.walletDiscount)} points discount` : ""} · ✦ ${order.points} pts</strong><button class="secondary" data-track="${escapeHTML(order.id)}">Track order</button></div>${order.status === "Cancelled" ? "" : `<div class="order-progress">${statuses.map((status, index) => `<span class="${index <= statuses.indexOf(order.status) ? "done" : ""}" title="${status}"></span>`).join("")}</div>`}</article>`).join("")}</div>` : `<div class="empty-state"><div class="empty-icon">🧾</div>Your orders will show up here once you place one.</div>`}`;
}

function profileContent() {
  return `<nav class="bottom-nav">${["Menu", "Orders", "Profile"].map(tab => `<button class="nav-tab ${customerTab === tab ? "active" : ""}" data-customer-tab="${tab}">${tab}</button>`).join("")}</nav>
    <div class="section-heading"><div><div class="eyebrow">Your account</div><h2>My profile</h2></div></div>
    <div class="panel"><div class="user-chip" style="margin-bottom:20px"><span class="avatar" style="width:48px;height:48px">${escapeHTML(profile.name.charAt(0).toUpperCase())}</span><div><strong>${escapeHTML(profile.name)}</strong><div class="subtle" style="font-size:12px">${escapeHTML(profile.role)}</div></div></div>
    <div class="profile-grid"><div class="stat-card"><span>Grade / department</span><strong style="font-size:15px">${escapeHTML(profile.grade)}</strong></div><div class="stat-card"><span>Section</span><strong style="font-size:15px">${escapeHTML(profile.section)}</strong></div><div class="stat-card"><span>${profile.role === "Student" ? "LRN" : "School ID"}</span><strong style="font-size:15px">${escapeHTML(profile.schoolId)}</strong></div></div>
    <p class="footer-note">Profile information is stored locally in this browser. Sign out to return to the role selection screen.</p></div>
    <div class="panel"><div class="reward-card"><div><h3>Good choices add up</h3><p>You've collected ${currentPoints()} canteen points.</p></div><span class="reward-emoji">✨</span></div></div>`;
}

async function changeSharedStock(id, amount) {
  const result = await ordersDatabase.ref("menu").child(id).child("stock").transaction(stock => {
    if (typeof stock !== "number" || stock + amount < 0) return;
    return stock + amount;
  }, undefined, false);
  if (!result.committed) throw new Error("The requested stock quantity is no longer available.");
  return result.snapshot.val();
}

async function nextOrderCode() {
  let sequence;
  if (realtimeEnabled) {
    const result = await ordersDatabase.ref("orderCounter").transaction(current => {
      return (Number(current) || 0) + 1;
    }, undefined, false);
    if (!result.committed) throw new Error("Could not assign an order code. Please try again.");
    sequence = Number(result.snapshot.val());
  } else {
    const latestStored = Number(read(STORAGE.orderCounter, 0)) || 0;
    const latestOrder = orders.reduce((highest, order) => {
      const match = /^A(\d+)$/.exec(String(order.displayId || ""));
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);
    sequence = Math.max(latestStored, latestOrder) + 1;
    write(STORAGE.orderCounter, sequence);
  }
  return `A${String(sequence).padStart(3, "0")}`;
}

async function checkout() {
  const entries = Object.entries(cart).filter(([, count]) => count > 0);
  if (!entries.length) return;
  const checkoutButton = document.getElementById("checkout");
  if (checkoutButton) checkoutButton.disabled = true;
  let reserved = [];
  try {
    if (realtimeEnabled) {
      if (payment === "QR") {
        const paymentSnapshot = await ordersDatabase.ref("paymentSettings/gcashQr").once("value");
        gcashQr = paymentSnapshot.val() || null;
        if (!gcashQr?.imageData) throw new Error("The canteen GCash QR is not configured. Choose another payment method.");
      }
      const snapshot = await ordersDatabase.ref("menu").once("value");
      const values = snapshot.val();
      if (!values) throw new Error("The shared menu has not been published by staff yet.");
      menu = (Array.isArray(values) ? values : Object.values(values)).filter(Boolean);
      write(STORAGE.menu, menu);
    }

    for (const [id, quantity] of entries) {
      const item = menu.find(food => food.id === id);
      if (!item || item.stock < quantity) {
        throw new Error(`${item?.name || "An item"} is no longer available in that quantity.`);
      }
    }
    const total = entries.reduce((sum, [id, quantity]) =>
      sum + menu.find(food => food.id === id).price * quantity, 0);
    const wallet = walletBalanceInfo(total);
    if (payment === "Wallet" && !wallet.canUseWallet) {
      throw new Error("Your points balance is insufficient to use Wallet. Choose another payment option or earn more points.");
    }
    if (payment === "QR" && (!gcashQr?.imageData || !paymentReference.trim())) {
      throw new Error("Select an available GCash QR and enter the transfer reference number after paying.");
    }

    if (realtimeEnabled) {
      for (const [id, quantity] of entries) {
        const remainingStock = await changeSharedStock(id, -quantity);
        reserved.push([id, quantity]);
        menu.find(food => food.id === id).stock = remainingStock;
      }
    }

    const items = entries.map(([id, quantity]) => {
      const item = menu.find(food => food.id === id);
      return { id, name: item.name, quantity, price: item.price };
    });
    const walletDiscount = payment === "Wallet" ? Number(wallet.discount.toFixed(2)) : 0;
    const displayId = await nextOrderCode();
    const orderRef = realtimeEnabled ? ordersDatabase.ref("orders").push() : null;
    const order = {
      id: orderRef ? orderRef.key : `CS${Date.now().toString().slice(-6)}`,
      displayId,
      owner: profile.id,
      customer: profile.name,
      grade: profile.grade,
      section: profile.section,
      items,
      total: Number(total.toFixed(2)),
      points: entries.reduce((sum, [id, quantity]) => sum + menu.find(food => food.id === id).points * quantity, 0),
      payment: payment === "Wallet" ? `Wallet (${wallet.pointsUsed} points)` : payment,
      walletDiscount,
      pointsUsed: payment === "Wallet" ? wallet.pointsUsed : 0,
      paymentStatus: payment === "QR" ? "pending_review" : "not_required",
      ...(payment === "QR" ? {
        paymentReference: paymentReference.trim(),
        gcashQrUpdatedAt: Number(gcashQr.updatedAt || 0)
      } : {}),
      status: "Received",
      createdAt: Date.now()
    };

    if (realtimeEnabled) {
      await orderRef.set(order);
    } else {
      entries.forEach(([id, quantity]) => {
        menu.find(food => food.id === id).stock -= quantity;
      });
      orders = [order, ...orders];
    }
    cart = {};
    paymentReference = "";
    if (!realtimeEnabled) write(STORAGE.orders, orders);
    write(STORAGE.menu, menu);
    customerTab = "Orders";
    render();
    toast(`Order ${orderCode(order)} sent to the canteen!`);
  } catch (error) {
    for (const [id, quantity] of reserved.reverse()) {
      try {
        const restoredStock = await changeSharedStock(id, quantity);
        const item = menu.find(food => food.id === id);
        if (item) item.stock = restoredStock;
      } catch (rollbackError) {
        console.error(`Unable to restore stock for ${id} after order failure.`, rollbackError);
      }
    }
    console.error("Unable to complete checkout.", error);
    if (checkoutButton) checkoutButton.disabled = false;
    toast(error.message || "Order was not sent. Check your connection and try again.");
  }
}

function openTracker(orderId) {
  const order = customerOrders().find(item => item.id === orderId);
  if (!order) return;
  document.getElementById("modal-root").innerHTML = `<div class="modal-backdrop" id="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="tracker-title"><div class="modal-head">  <h2 id="tracker-title">Track your order</h2><button class="close-button" data-close aria-label="Close">×</button></div><p class="subtle" style="margin:9px 0">Order ${escapeHTML(orderCode(order))}</p><div class="tracker-box"><div style="font-size:30px;margin-bottom:8px">🍱</div><strong>${escapeHTML(order.status)}</strong><p class="subtle" style="font-size:12px;margin:5px 0 0">${order.status === "Ready for pickup" ? "Head to the canteen counter when you're ready." : order.status === "Completed" ? "Enjoy your meal! Points are in your rewards." : order.status === "Cancelled" ? "This order was cancelled because the GCash transfer could not be confirmed. No payment was automatically taken or refunded." : "The canteen team is working on your order."}</p></div>${order.paymentStatus === "pending_review" ? `<p class="payment-review-note">Your GCash reference ${escapeHTML(order.paymentReference || "")} is waiting for staff to verify the transfer.</p>` : order.paymentStatus === "paid" ? `<p class="payment-confirmed-note">Staff confirmed your GCash payment.</p>` : order.paymentStatus === "not_received" ? `<p class="payment-review-note">Staff could not confirm the transfer. ${order.stockRestorationStatus === "complete" ? "Stock was returned." : order.stockRestorationStatus === "manual_review" ? "Staff is correcting stock." : "Stock is being restored."}</p>` : ""}${order.status === "Cancelled" ? "" : `<div class="order-progress">${statuses.map((status, index) => `<span class="${index <= statuses.indexOf(order.status) ? "done" : ""}" title="${status}"></span>`).join("")}</div>`}<p class="footer-note">${realtimeEnabled ? "Order status syncs in real time with the canteen." : "This tracker updates when the canteen updates your order on this device."}</p></section></div>`;
  bindModalClose();
}

function modalMarkup() { return `<div id="modal-root"></div>`; }
function bindModalClose() {
  document.querySelector("[data-close]")?.addEventListener("click", () => document.getElementById("modal-root").innerHTML = "");
  document.getElementById("modal-backdrop")?.addEventListener("click", event => {
    if (event.target.id === "modal-backdrop") event.currentTarget.remove();
  });
}

function bindShareApp() {
  document.querySelectorAll("[data-share-app]").forEach(button => button.addEventListener("click", openShareModal));
}

function bindInstallApp() {
  const installed = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  document.querySelectorAll("[data-install-app]").forEach(button => {
    button.hidden = installed;
    button.textContent = "＋ Add to Home Screen";
    button.onclick = installPrompt ? promptAppInstall : openInstallHelp;
  });
}

async function promptAppInstall() {
  if (!installPrompt) {
    openInstallHelp();
    return;
  }
  const prompt = installPrompt;
  installPrompt = null;
  try {
    await prompt.prompt();
    await prompt.userChoice;
  } catch (error) {
    console.error("Unable to start app installation.", error);
    toast("Use your browser menu to add CampuSnack to your device.");
  }
}

function openInstallHelp() {
  const userAgent = navigator.userAgent;
  const isAppleMobile = /iPhone|iPad|iPod/.test(userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const instructions = isAppleMobile
    ? "In Safari, tap Share, choose Add to Home Screen, then tap Add."
    : /Android/i.test(userAgent)
      ? "In Chrome or Edge, open the browser menu and choose Install app or Add to Home screen."
      : "Use your browser's Install app option or menu. Chrome and Edge usually show Install app in the address bar or browser menu. On iPhone or iPad, open this page in Safari, tap Share, then Add to Home Screen.";
  document.getElementById("modal-root").innerHTML = `<div class="modal-backdrop" id="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="install-title"><div class="modal-head"><h2 id="install-title">Add CampuSnack to Home Screen</h2><button class="close-button" data-close aria-label="Close">×</button></div><p class="subtle">${instructions}</p><p class="share-note">CampuSnack installs as a web app from this browser; no app-store download is needed. Installation requires a secure HTTPS website (localhost is supported for testing), and the option depends on your device and browser.</p></section></div>`;
  bindModalClose();
}

function openShareModal() {
  const shareUrl = new URL(APP_PUBLIC_URL);
  shareUrl.search = "";
  shareUrl.hash = "";
  const shareable = shareUrl.protocol === "http:" || shareUrl.protocol === "https:";
  const qrMatrix = shareable ? createQrMatrix(shareUrl.href) : null;
  const isLocalhost = shareUrl.hostname === "localhost" || shareUrl.hostname === "127.0.0.1";

  document.getElementById("modal-root").innerHTML = `<div class="modal-backdrop" id="modal-backdrop"><section class="modal share-modal" role="dialog" aria-modal="true" aria-labelledby="share-title"><div class="modal-head"><h2 id="share-title">Share CampuSnack</h2><button class="close-button" data-close aria-label="Close">×</button></div>
    <p class="subtle share-description">${shareable ? "Scan this code to open CampuSnack, or copy its link." : "Open the app from an HTTP or HTTPS address before creating a shareable QR code."}</p>
    ${qrMatrix ? `<div class="qr-frame"><canvas class="share-qr" id="share-qr" role="img" aria-label="QR code linking to CampuSnack"></canvas></div>` : `<div class="qr-unavailable">${shareable ? "This app address is too long to encode as a QR code. You can still copy the link below." : "A QR code needs a web address to share. Start a local web server or publish the app, then open that address here."}</div>`}
    <label class="share-link-label" for="share-url">App link</label><input id="share-url" class="share-url" type="url" readonly value="${escapeHTML(shareUrl.href)}">
    ${qrMatrix ? `<button class="secondary copy-share-link" id="share-qr-code" type="button">Share QR code</button><button class="secondary copy-share-link" id="download-share-qr" type="button">Download QR image</button>` : ""}
    ${shareable ? `<button class="secondary copy-share-link" id="copy-share-link" type="button">Copy link</button><button class="secondary share-install-button" data-install-app type="button">＋ Add to Home Screen</button>` : ""}
    ${isLocalhost ? `<p class="share-note">This address only works on this device. Publish the app to a public web address before sharing it with others.</p>` : ""}
    <p class="share-note">This QR always links to the public CampuSnack address. Publishing a newer version at that address makes the same QR open the updated app.</p>
  </section></div>`;
  if (qrMatrix) drawQrCode(document.getElementById("share-qr"), qrMatrix);
  document.getElementById("share-qr-code")?.addEventListener("click", () => exportQrCode(shareUrl.href, true));
  document.getElementById("download-share-qr")?.addEventListener("click", () => exportQrCode(shareUrl.href, false));
  document.getElementById("copy-share-link")?.addEventListener("click", async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable.");
      await navigator.clipboard.writeText(shareUrl.href);
      toast("App link copied.");
    } catch (error) {
      console.error("Unable to copy the app link.", error);
      document.getElementById("share-url")?.select();
      toast("Couldn't copy automatically. Select the app link to copy it.");
    }
  });
  bindInstallApp();
  bindModalClose();
}

async function exportQrCode(shareUrl, share) {
  const canvas = document.getElementById("share-qr");
  if (!canvas) return;
  try {
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error("Unable to create QR image.")), "image/png");
    });
    const file = typeof File === "function" ? new File([blob], "campusnack-qr.png", { type: "image/png" }) : null;
    if (share && file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({ files: [file], title: "CampuSnack", text: shareUrl });
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
        throw error;
      }
    }

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "campusnack-qr.png";
    link.click();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    toast(share ? "QR image downloaded. Share it from your device's photos or files." : "QR image downloaded.");
  } catch (error) {
    console.error("Unable to export the app QR code.", error);
    toast("Couldn't export the QR code. Please try again.");
  }
}

function createQrMatrix(text) {
  const data = [...new TextEncoder().encode(text)];
  const dataCodewordCounts = [19, 34, 55, 80, 108];
  const errorCodewordCounts = [7, 10, 15, 20, 26];
  const versionIndex = dataCodewordCounts.findIndex(count => 4 + 8 + data.length * 8 <= count * 8);
  if (versionIndex < 0) return null;

  const version = versionIndex + 1;
  const size = 17 + version * 4;
  const dataBits = [];
  const appendBits = (value, count) => {
    for (let bit = count - 1; bit >= 0; bit--) dataBits.push((value >>> bit) & 1);
  };
  appendBits(4, 4);
  appendBits(data.length, 8);
  data.forEach(byte => appendBits(byte, 8));
  const dataCapacity = dataCodewordCounts[versionIndex] * 8;
  for (let i = 0; i < Math.min(4, dataCapacity - dataBits.length); i++) dataBits.push(0);
  while (dataBits.length % 8) dataBits.push(0);

  const codewords = [];
  for (let i = 0; i < dataBits.length; i += 8) {
    codewords.push(dataBits.slice(i, i + 8).reduce((byte, bit) => (byte << 1) | bit, 0));
  }
  for (let pad = 0; codewords.length < dataCodewordCounts[versionIndex]; pad++) {
    codewords.push(pad % 2 === 0 ? 0xEC : 0x11);
  }
  codewords.push(...qrErrorCorrection(codewords, errorCodewordCounts[versionIndex]));

  const matrix = Array.from({ length: size }, () => Array(size).fill(false));
  const functionModules = Array.from({ length: size }, () => Array(size).fill(false));
  const setFunction = (row, column, dark) => {
    if (row >= 0 && row < size && column >= 0 && column < size) {
      matrix[row][column] = dark;
      functionModules[row][column] = true;
    }
  };
  const drawFinder = (centerRow, centerColumn) => {
    for (let row = -1; row <= 7; row++) {
      for (let column = -1; column <= 7; column++) {
        const distance = Math.max(Math.abs(row - 3), Math.abs(column - 3));
        setFunction(centerRow + row, centerColumn + column, distance !== 2 && distance !== 4);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);
  for (let position = 8; position < size - 8; position++) {
    setFunction(6, position, position % 2 === 0);
    setFunction(position, 6, position % 2 === 0);
  }

  const alignmentPositions = [
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30]
  ][versionIndex];
  for (const row of alignmentPositions) {
    for (const column of alignmentPositions) {
      if (functionModules[row][column]) continue;
      for (let y = -2; y <= 2; y++) {
        for (let x = -2; x <= 2; x++) {
          setFunction(row + y, column + x, Math.max(Math.abs(x), Math.abs(y)) !== 1);
        }
      }
    }
  }

  const formatData = (1 << 3);
  let formatRemainder = formatData << 10;
  for (let bit = 14; bit >= 10; bit--) {
    if ((formatRemainder >>> bit) & 1) formatRemainder ^= 0x537 << (bit - 10);
  }
  const formatBits = ((formatData << 10) | formatRemainder) ^ 0x5412;
  const formatBit = bit => ((formatBits >>> bit) & 1) !== 0;
  for (let bit = 0; bit <= 5; bit++) setFunction(bit, 8, formatBit(bit));
  setFunction(7, 8, formatBit(6));
  setFunction(8, 8, formatBit(7));
  setFunction(8, 7, formatBit(8));
  for (let bit = 9; bit < 15; bit++) setFunction(8, 14 - bit, formatBit(bit));
  for (let bit = 0; bit < 8; bit++) setFunction(8, size - 1 - bit, formatBit(bit));
  for (let bit = 8; bit < 15; bit++) setFunction(size - 15 + bit, 8, formatBit(bit));
  setFunction(size - 8, 8, true);

  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical++) {
      const row = upward ? size - 1 - vertical : vertical;
      for (let offset = 0; offset < 2; offset++) {
        const column = right - offset;
        if (functionModules[row][column]) continue;
        const bit = bitIndex < codewords.length * 8 ? (codewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1 : 0;
        matrix[row][column] = (bit ^ ((row + column) % 2 === 0 ? 1 : 0)) !== 0;
        bitIndex++;
      }
    }
    upward = !upward;
  }
  return matrix;
}

function qrErrorCorrection(data, degree) {
  const multiply = (left, right) => {
    let result = 0;
    for (let bit = 7; bit >= 0; bit--) {
      result = (result << 1) ^ ((result >>> 7) * 0x11D);
      result ^= ((right >>> bit) & 1) * left;
    }
    return result;
  };
  let generator = [1];
  let root = 1;
  for (let i = 0; i < degree; i++) {
    const next = Array(generator.length + 1).fill(0);
    generator.forEach((coefficient, index) => {
      next[index] ^= coefficient;
      next[index + 1] ^= multiply(coefficient, root);
    });
    generator = next;
    root = multiply(root, 2);
  }

  const remainder = Array(degree).fill(0);
  data.forEach(byte => {
    const factor = byte ^ remainder.shift();
    remainder.push(0);
    for (let i = 0; i < degree; i++) remainder[i] ^= multiply(generator[i + 1], factor);
  });
  return remainder;
}

function drawQrCode(canvas, matrix) {
  const quietZone = 4;
  const scale = 6;
  const size = matrix.length + quietZone * 2;
  canvas.width = size * scale;
  canvas.height = size * scale;
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#164e3e";
  matrix.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) context.fillRect((x + quietZone) * scale, (y + quietZone) * scale, scale, scale);
  }));
}

function updateCart(id, amount) {
  const item = menu.find(food => food.id === id);
  if (!item) return;
  const next = (cart[id] || 0) + amount;
  if (next > item.stock) { toast(`Only ${item.stock} ${item.name} available.`); return; }
  if (next <= 0) delete cart[id];
  else cart[id] = next;
  renderCustomer();
}

function salesReportContent() {
  const dayCount = salesPeriod === "week" ? 7 : 30;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - dayCount + 1);
  const bucketCount = salesPeriod === "week" ? 7 : 5;
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({
    label: salesPeriod === "week" ? "" : `Week ${index + 1}`,
    revenue: 0
  }));
  const completed = orders.filter(order => order.status === "Completed");
  const periodOrders = completed.filter(order => Number(order.createdAt) >= start.getTime() && Number(order.createdAt) < today.getTime() + 86_400_000);
  periodOrders.forEach(order => {
    const orderDate = new Date(Number(order.createdAt));
    orderDate.setHours(0, 0, 0, 0);
    const dayIndex = Math.floor((orderDate.getTime() - start.getTime()) / 86_400_000);
    const bucketIndex = salesPeriod === "week" ? dayIndex : Math.min(4, Math.floor(dayIndex / 7));
    if (bucketIndex >= 0 && bucketIndex < buckets.length) {
      buckets[bucketIndex].revenue += Math.max(0, Number(order.total || 0) - Number(order.walletDiscount || 0));
    }
  });
  if (salesPeriod === "week") {
    buckets.forEach((bucket, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      bucket.label = date.toLocaleDateString([], { weekday: "short" });
    });
  }
  const currentRevenue = buckets.reduce((sum, bucket) => sum + bucket.revenue, 0);
  const previousStart = new Date(start);
  previousStart.setDate(start.getDate() - dayCount);
  const previousRevenue = completed.filter(order =>
    Number(order.createdAt) >= previousStart.getTime() && Number(order.createdAt) < start.getTime()
  ).reduce((sum, order) => sum + Math.max(0, Number(order.total || 0) - Number(order.walletDiscount || 0)), 0);
  const progress = previousRevenue ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : null;
  const maxRevenue = Math.max(...buckets.map(bucket => bucket.revenue), 1);
  const demand = new Map();
  periodOrders.forEach(order => order.items.forEach(item => {
    const key = item.id || item.name;
    const current = demand.get(key) || { name: item.name, quantity: 0 };
    current.quantity += Number(item.quantity || 0);
    demand.set(key, current);
  }));
  const topProducts = [...demand.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);

  return `<div class="panel sales-report">
    <div class="section-heading" style="margin-top:0"><div><h2>Sales report</h2><p class="subtle" style="margin:5px 0 0">${salesPeriod === "week" ? "Last 7 days" : "Last 30 days"} · completed orders</p></div><div class="payment-options" style="max-width:180px"><button class="payment-option ${salesPeriod === "week" ? "active" : ""}" data-sales-period="week">Weekly</button><button class="payment-option ${salesPeriod === "month" ? "active" : ""}" data-sales-period="month">Monthly</button></div></div>
    <div class="stats-grid" style="margin:14px 0"><div class="stat-card"><span>Net sales</span><strong>${money(currentRevenue)}</strong></div><div class="stat-card"><span>vs. previous ${salesPeriod === "week" ? "week" : "30 days"}</span><strong>${progress === null ? "—" : `${progress >= 0 ? "+" : ""}${progress.toFixed(1)}%`}</strong></div></div>
    <div class="sales-chart" style="grid-template-columns:repeat(${bucketCount},minmax(0,1fr))" role="img" aria-label="${salesPeriod === "week" ? "Weekly" : "Monthly"} completed sales bar chart">
      ${buckets.map(bucket => `<div class="sales-bar-column" title="${escapeHTML(bucket.label)}: ${money(bucket.revenue)}"><span class="sales-bar-value">${bucket.revenue ? money(bucket.revenue) : "—"}</span><span class="sales-bar" style="height:${bucket.revenue ? Math.max(4, bucket.revenue / maxRevenue * 100) : 0}%"></span><span class="sales-bar-label">${escapeHTML(bucket.label)}</span></div>`).join("")}
    </div>
    <div class="sales-demand"><h3>Highest product demand</h3>${topProducts.length ? `<ol>${topProducts.map(item => `<li><span>${escapeHTML(item.name)}</span><strong>${item.quantity} sold</strong></li>`).join("")}</ol>` : `<p class="subtle">No completed sales in this period yet.</p>`}</div>
  </div>`;
}

function renderStaff() {
  const name = escapeHTML(profile.name);
  const dailyOrders = todayOrders();
  const sales = dailyOrders.filter(order => order.status === "Completed").reduce((sum, order) =>
    sum + Math.max(0, Number(order.total || 0) - Number(order.walletDiscount || 0)), 0);
  document.getElementById("app").innerHTML = `<div class="app-shell">  <header class="topbar"><div class="brand"><img src="campusnack-logo.jpg" alt="">Campu<em>Snack</em><span style="font:600 11px 'DM Sans';color:#78827b;letter-spacing:0;margin-left:4px">STAFF</span></div><div class="top-actions"><button class="share-button" data-install-app aria-label="Add to Home Screen" type="button">＋ Add to Home Screen</button><button class="share-button" data-share-app type="button">▦ Share app</button><button class="icon-button" id="logout">Sign out</button><div class="user-chip"><span class="avatar">${name.charAt(0)}</span><span class="user-name">${name}</span></div></div></header>
    <main class="staff-page"><div class="staff-header"><div><div class="eyebrow">Canteen operations</div><h1>Good day, ${name.split(" ")[0]}</h1><p class="subtle" style="margin:0">Manage today's orders, stock and menu.</p></div><span class="live-pill ${realtimeStatus === "error" ? "sync-error" : ""}">${realtimeEnabled ? `● ${realtimeStatus === "live" ? "LIVE SYNC" : realtimeStatus === "error" ? "SYNC ERROR" : "CONNECTING"}` : "● THIS DEVICE ONLY"}</span></div>
    <div class="stats-grid" style="margin-bottom:20px"><div class="stat-card"><span>Today's orders</span><strong>${dailyOrders.length}</strong></div><div class="stat-card"><span>Today's completed sales</span><strong>${money(sales)}</strong></div><div class="stat-card"><span>Menu items</span><strong>${menu.length}</strong></div><div class="stat-card"><span>Low stock items</span><strong>${menu.filter(item => item.stock <= 5).length}</strong></div></div>
    <nav class="staff-nav">${["Orders", "Stock", "Menu", "Payments"].map(tab => `<button class="nav-tab ${staffTab === tab ? "active" : ""}" data-staff-tab="${tab}">${tab}</button>`).join("")}</nav>
    <section class="staff-content">${staffTab === "Orders" ? staffOrdersContent() : staffTab === "Stock" ? staffStockContent() : staffTab === "Menu" ? staffMenuContent() : staffPaymentsContent()}</section>
    <p class="footer-note">${realtimeEnabled ? "Live order queue connected to Firebase. Only staff UIDs allowlisted in Realtime Database rules can view or update the shared queue." : "Staff mode is a local demo. Orders and edits are stored in this browser and are not shared across devices."}</p></main>
    <div id="modal-root"></div></div>`;
  document.getElementById("logout").addEventListener("click", logout);
  bindShareApp();
  bindInstallApp();
  document.querySelectorAll("[data-staff-tab]").forEach(button => button.addEventListener("click", () => { staffTab = button.dataset.staffTab; renderStaff(); }));
  document.querySelectorAll("[data-sales-period]").forEach(button => button.addEventListener("click", () => {
    salesPeriod = button.dataset.salesPeriod;
    renderStaff();
  }));
  document.querySelectorAll("[data-status]").forEach(select => select.addEventListener("change", () => {
    const order = orders.find(item => item.id === select.dataset.status);
    if (!order) return;
    const nextStatus = select.value;
    if (realtimeEnabled) {
      ordersDatabase.ref("orders").child(order.id).update({ status: nextStatus }).then(() => {
        toast(`Order ${orderCode(order)} updated.`);
      }).catch(error => {
        console.error("Unable to update order status in Firebase.", error);
        toast("Could not update the order. Check staff access and your connection.");
        renderStaff();
      });
    } else {
      order.status = nextStatus;
      write(STORAGE.orders, orders);
      renderStaff();
      toast(`Order ${orderCode(order)} updated.`);
    }
  }));
  document.querySelectorAll("[data-payment-review]").forEach(button => button.addEventListener("click", async () => {
    const order = orders.find(item => item.id === button.dataset.paymentReview);
    if (!order || order.paymentStatus !== "pending_review") return;
    button.disabled = true;
    try {
      const verifiedAt = Date.now();
      if (realtimeEnabled) {
        const result = await ordersDatabase.ref("orders").child(order.id).transaction(current => {
          if (!current || current.payment !== "QR" || current.paymentStatus !== "pending_review") return;
          return {
            ...current,
            paymentStatus: "paid",
            paymentVerifiedAt: verifiedAt,
            paymentVerifiedBy: profile.name
          };
        }, undefined, false);
        if (!result.committed) {
          toast("This payment was already reviewed. Refreshing the queue.");
          renderStaff();
          return;
        }
      } else {
        order.paymentStatus = "paid";
        order.paymentVerifiedAt = verifiedAt;
        order.paymentVerifiedBy = profile.name;
        write(STORAGE.orders, orders);
        renderStaff();
      }
      toast(`Payment for order ${orderCode(order)} confirmed.`);
    } catch (error) {
      console.error(`Unable to confirm GCash payment for order ${orderCode(order)}.`, error);
      toast("Payment could not be confirmed. Check staff access and your connection.");
      renderStaff();
    }
  }));
  document.querySelectorAll("[data-payment-cancel]").forEach(button => button.addEventListener("click", async () => {
    const order = orders.find(item => item.id === button.dataset.paymentCancel);
    if (!order || order.paymentStatus !== "pending_review" || order.payment !== "QR") return;
    if (!window.confirm(`Cancel order ${orderCode(order)} because the GCash payment was not received? This will return the reserved products to stock. It will not issue a GCash refund.`)) return;
    button.disabled = true;
    await cancelUnreceivedQrOrder(order);
  }));
  document.getElementById("gcash-qr-file")?.addEventListener("change", async event => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    const saveButton = document.querySelector("#gcash-qr-form button[type='submit']");
    const message = document.getElementById("gcash-upload-message");
    const preview = document.getElementById("gcash-upload-preview");
    gcashQrDraft = null;
    if (saveButton) saveButton.disabled = true;
    if (preview) preview.innerHTML = "";
    if (!file) {
      gcashQrUploadMessage = "No file selected. Choose the QR image, then wait for its preview.";
      if (message) message.textContent = gcashQrUploadMessage;
      return;
    }
    gcashQrUploadMessage = `Preparing ${file.name}...`;
    if (message) {
      message.textContent = gcashQrUploadMessage;
      message.className = "field-help";
    }
    try {
      const imageData = await resizeGcashQr(file);
      if (input.files?.[0] !== file) return;
      gcashQrDraft = { imageData, name: file.name };
      gcashQrUploadMessage = `Ready to upload: ${file.name} (${Math.ceil(imageData.length / 1024)} KB). Check the preview, then press Save and share receiver QR.`;
      if (preview) preview.innerHTML = `<img class="gcash-qr-preview" src="${escapeHTML(imageData)}" alt="Selected GCash QR preview">`;
      if (message) message.textContent = gcashQrUploadMessage;
      if (saveButton) saveButton.disabled = false;
    } catch (error) {
      console.error("Unable to prepare the selected GCash QR image.", error);
      gcashQrUploadMessage = `Could not prepare the image: ${error.message}`;
      if (message) {
        message.textContent = gcashQrUploadMessage;
        message.className = "payment-upload-error";
      }
      toast(error.message);
    }
  });
  document.getElementById("gcash-qr-form")?.addEventListener("submit", saveGcashQr);
  document.getElementById("remove-gcash-qr")?.addEventListener("click", removeGcashQr);
  document.querySelectorAll("[data-stock]").forEach(input => input.addEventListener("change", () => {
    const item = menu.find(food => food.id === input.dataset.stock);
    if (!item) return;
    const updatedStock = Math.max(0, Number(input.value) || 0);
    if (realtimeEnabled) {
      ordersDatabase.ref("menu").child(item.id).child("stock").set(updatedStock).then(() => {
        toast(`${item.name} stock updated.`);
      }).catch(error => {
        console.error("Unable to update shared stock.", error);
        toast("Could not update stock. Check staff access and your connection.");
        renderStaff();
      });
      return;
    }
    item.stock = updatedStock;
    write(STORAGE.menu, menu);
    renderStaff();
    toast(`${item.name} stock updated.`);
  }));
  document.getElementById("add-menu-item")?.addEventListener("click", () => openMenuEditor());
  document.querySelectorAll("[data-edit-menu]").forEach(button => button.addEventListener("click", () => openMenuEditor(button.dataset.editMenu)));
  document.querySelectorAll("[data-delete-menu]").forEach(slider => slider.addEventListener("input", async () => {
    if (Number(slider.value) < 100 || slider.dataset.deleting === "true") return;
    slider.dataset.deleting = "true";
    slider.disabled = true;
    const item = menu.find(food => food.id === slider.dataset.deleteMenu);
    if (!item) {
      renderStaff();
      return;
    }
    if (!window.confirm(`Permanently delete "${item.name}" from the menu and stock tracker? Existing orders will remain unchanged.`)) {
      renderStaff();
      return;
    }
    try {
      if (realtimeEnabled) {
        await ordersDatabase.ref("menu").child(item.id).remove();
      }
      menu = menu.filter(food => food.id !== item.id);
      write(STORAGE.menu, menu);
      renderStaff();
      toast(`${item.name} deleted from the menu.`);
    } catch (error) {
      console.error(`Unable to delete menu item ${item.id}.`, error);
      renderStaff();
      toast(`Could not delete ${item.name}. Check staff access and your connection.`);
    }
  }));
  bindModalClose();
}

async function cancelUnreceivedQrOrder(order) {
  const reviewedAt = Date.now();
  try {
    if (realtimeEnabled) {
      const result = await ordersDatabase.ref("orders").child(order.id).transaction(current => {
        if (!current || current.payment !== "QR" || current.paymentStatus !== "pending_review" || current.status === "Cancelled") return;
        return {
          ...current,
          status: "Cancelled",
          paymentStatus: "not_received",
          paymentReviewedAt: reviewedAt,
          paymentReviewedBy: profile.name,
          stockRestorationStatus: "in_progress",
          stockRestoredItemIds: []
        };
      }, undefined, false);
      if (!result.committed) {
        toast("This payment was already reviewed or the order changed. Refreshing the queue.");
        renderStaff();
        return;
      }
      Object.assign(order, result.snapshot.val());
    } else {
      order.status = "Cancelled";
      order.paymentStatus = "not_received";
      order.paymentReviewedAt = reviewedAt;
      order.paymentReviewedBy = profile.name;
      order.stockRestorationStatus = "in_progress";
      order.stockRestoredItemIds = [];
      write(STORAGE.orders, orders);
    }

    for (const item of order.items) {
      if (realtimeEnabled) {
        await changeSharedStock(item.id, Number(item.quantity));
        const restoredIds = [...(order.stockRestoredItemIds || []), item.id];
        await ordersDatabase.ref("orders").child(order.id).update({ stockRestoredItemIds: restoredIds });
        order.stockRestoredItemIds = restoredIds;
      } else {
        const menuItem = menu.find(food => food.id === item.id);
        if (!menuItem) throw new Error(`The product ${item.name} is missing from local stock.`);
        menuItem.stock += Number(item.quantity);
        order.stockRestoredItemIds = [...(order.stockRestoredItemIds || []), item.id];
        write(STORAGE.menu, menu);
        write(STORAGE.orders, orders);
      }
    }
    order.stockRestorationStatus = "complete";
    if (realtimeEnabled) {
      await ordersDatabase.ref("orders").child(order.id).update({ stockRestorationStatus: "complete" });
    } else {
      write(STORAGE.orders, orders);
    }
    toast(`Order ${orderCode(order)} cancelled. Reserved stock was returned. No GCash payment was taken or refunded.`);
  } catch (error) {
    console.error(`Unable to fully cancel and restore stock for order ${order.id}.`, error);
    order.stockRestorationStatus = "manual_review";
    if (!realtimeEnabled) write(STORAGE.orders, orders);
    else {
      try {
        await ordersDatabase.ref("orders").child(order.id).update({ stockRestorationStatus: "manual_review" });
      } catch (statusError) {
        console.error(`Unable to record stock-restoration failure for order ${order.id}.`, statusError);
      }
    }
    toast(`Order ${orderCode(order)} is cancelled, but stock restoration failed. Check the order's product quantities and correct stock manually.`);
  } finally {
    renderStaff();
  }
}

function staffOrdersContent() {
  const sorted = todayOrders().sort((a, b) => b.createdAt - a.createdAt);
  const orderContent = sorted.length
    ? `<div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Placed</th><th>Status</th></tr></thead><tbody>${sorted.map(order => `<tr><td><strong>${escapeHTML(orderCode(order))}</strong></td><td>${escapeHTML(order.customer)}<div class="subtle" style="font-size:10px">${escapeHTML(order.grade)} · ${escapeHTML(order.section)}</div></td><td>${order.items.map(item => `${item.quantity}× ${escapeHTML(item.name)}`).join(", ")}</td><td>${money(Math.max(0, Number(order.total || 0) - Number(order.walletDiscount || 0)))}${order.walletDiscount ? `<div class="subtle" style="font-size:10px">after points</div>` : ""}</td><td>${escapeHTML(order.payment)}${order.payment === "QR" ? `<div class="${order.paymentStatus === "paid" ? "payment-confirmed-note" : order.paymentStatus === "not_received" ? "payment-review-note" : "payment-review-note"}">${order.paymentStatus === "paid" ? "Verified" : order.paymentStatus === "not_received" ? "Not received" : "Awaiting verification"}</div>` : ""}</td><td>${new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td><td>${order.status === "Cancelled" ? `<span class="order-status order-cancelled">Cancelled</span>` : order.payment === "QR" && order.paymentStatus !== "paid" ? `<span class="subtle">Verify payment first</span>` : `<select class="status-select" data-status="${escapeHTML(order.id)}" aria-label="Update status for order ${escapeHTML(orderCode(order))}">${statuses.map(status => `<option ${status === order.status ? "selected" : ""}>${status}</option>`).join("")}</select>`}</td></tr>`).join("")}</tbody></table></div>`
    : `<div class="empty-state"><div class="empty-icon">📋</div>No orders today. New customer orders will appear here.</div>`;
  return `${salesReportContent()}${orderContent}`;
}

function staffPaymentsContent() {
  const pendingPayments = orders
    .filter(order => order.payment === "QR" && order.paymentStatus === "pending_review")
    .sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
  const recentConfirmed = orders
    .filter(order => order.payment === "QR" && order.paymentStatus === "paid")
    .sort((a, b) => Number(b.paymentVerifiedAt || 0) - Number(a.paymentVerifiedAt || 0))
    .slice(0, 10);
  return `<div class="section-heading" style="margin-top:0"><div><h2>GCash receiver QR</h2><p class="subtle" style="margin:5px 0 0">${realtimeEnabled ? "This QR is shared live with signed-in students and teachers." : "Local demo only; this setting is not shared across devices."}</p></div></div>
    <div class="gcash-settings panel">
      ${gcashQr?.imageData ? `<img class="gcash-qr-preview" src="${escapeHTML(gcashQr.imageData)}" alt="Current GCash receiver QR"><p class="subtle">Current receiver QR${gcashQr.updatedAt ? ` · updated ${new Date(gcashQr.updatedAt).toLocaleString()}` : ""}.</p>` : `<p class="subtle">No GCash receiver QR is configured. Students and teachers cannot select GCash QR pay until you add one.</p>`}
      <form id="gcash-qr-form"><label for="gcash-qr-file">Upload the canteen's official GCash QR image</label><input id="gcash-qr-file" type="file" accept="image/*"><div id="gcash-upload-preview">${gcashQrDraft ? `<img class="gcash-qr-preview" src="${escapeHTML(gcashQrDraft.imageData)}" alt="Selected GCash QR preview">` : ""}</div><p id="gcash-upload-message" class="${gcashQrUploadMessage.startsWith("Could not") ? "payment-upload-error" : "field-help"}" role="status">${escapeHTML(gcashQrUploadMessage || "Choose the image, check its preview, then click Save and share receiver QR.")}</p><p class="field-help">Use a clear PNG or JPG image showing the full QR code. After saving, check the recipient name and test it with a small payment before accepting orders.</p><button class="primary" type="submit" ${gcashQrDraft ? "" : "disabled"}>Save and share receiver QR</button></form>
      ${gcashQr?.imageData ? `<button id="remove-gcash-qr" class="secondary" type="button" style="margin-top:10px">Remove receiver QR</button>` : ""}
    </div>
    <div class="section-heading"><div><h2>Payments needing review</h2><p class="subtle" style="margin:5px 0 0">Check each transfer in the receiver's GCash account before confirming.</p></div></div>
    ${pendingPayments.length ? `<div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Amount</th><th>GCash reference</th><th>Submitted</th><th>Review</th></tr></thead><tbody>${pendingPayments.map(order => `<tr><td><strong>${escapeHTML(orderCode(order))}</strong></td><td>${escapeHTML(order.customer)}</td><td>${money(Math.max(0, Number(order.total || 0) - Number(order.walletDiscount || 0)))}</td><td>${escapeHTML(order.paymentReference || "Missing")}</td><td>${new Date(order.createdAt).toLocaleString()}</td><td><div class="payment-review-actions"><button class="primary confirm-payment" type="button" data-payment-review="${escapeHTML(order.id)}">Confirm received</button><button class="secondary cancel-payment" type="button" data-payment-cancel="${escapeHTML(order.id)}">Not received — cancel order</button></div></td></tr>`).join("")}</tbody></table></div>` : `<div class="empty-state"><div class="empty-icon">🧾</div>No GCash transfers are waiting for review.</div>`}
    <div class="section-heading"><div><h2>Recently confirmed</h2></div></div>
    ${recentConfirmed.length ? `<div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Amount</th><th>Reference</th><th>Confirmed by</th></tr></thead><tbody>${recentConfirmed.map(order => `<tr><td>${escapeHTML(orderCode(order))}</td><td>${escapeHTML(order.customer)}</td><td>${money(Math.max(0, Number(order.total || 0) - Number(order.walletDiscount || 0)))}</td><td>${escapeHTML(order.paymentReference || "")}</td><td>${escapeHTML(order.paymentVerifiedBy || "")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="subtle">No GCash payments have been confirmed yet.</p>`}
    <p class="payment-review-note">CampuSnack cannot check GCash transactions automatically. Confirm only after the amount and reference are visible in the receiver's GCash transaction history. Never use a customer's screenshot alone as proof of payment.</p>`;
}

async function saveGcashQr(event) {
  event.preventDefault();
  const submitButton = event.currentTarget.querySelector("button[type='submit']");
  if (!gcashQrDraft) {
    gcashQrUploadMessage = "Choose an image and wait for its preview before saving.";
    const message = document.getElementById("gcash-upload-message");
    if (message) message.textContent = gcashQrUploadMessage;
    return;
  }
  if (submitButton) submitButton.disabled = true;
  try {
    gcashQrUploadMessage = "Saving your QR image...";
    const message = document.getElementById("gcash-upload-message");
    if (message) message.textContent = gcashQrUploadMessage;
    const settings = { imageData: gcashQrDraft.imageData, updatedAt: Date.now() };
    if (realtimeEnabled) {
      await ordersDatabase.ref("paymentSettings/gcashQr").set(settings);
    } else {
      gcashQr = settings;
      write(STORAGE.gcashQr, gcashQr);
    }
    gcashQrDraft = null;
    gcashQrUploadMessage = "";
    renderStaff();
    toast(realtimeEnabled ? "GCash QR shared with all signed-in customers." : "GCash QR saved on this device only.");
  } catch (error) {
    console.error("Unable to save the GCash receiver QR.", error);
    if (submitButton) submitButton.disabled = false;
    gcashQrUploadMessage = `Could not save the QR: ${error.message || "Firebase rejected the request."}`;
    const message = document.getElementById("gcash-upload-message");
    if (message) {
      message.textContent = gcashQrUploadMessage;
      message.className = "payment-upload-error";
    }
    toast("QR upload failed. Read the message below the upload button for details.");
  }
}

async function removeGcashQr() {
  try {
    if (realtimeEnabled) {
      await ordersDatabase.ref("paymentSettings/gcashQr").remove();
    } else {
      gcashQr = null;
      write(STORAGE.gcashQr, null);
    }
    gcashQr = null;
    gcashQrDraft = null;
    gcashQrUploadMessage = "";
    renderStaff();
    toast("GCash QR removed. QR payment is unavailable until another code is added.");
  } catch (error) {
    console.error("Unable to remove the GCash receiver QR.", error);
    toast("Could not remove the GCash QR. Check staff access and try again.");
  }
}

function resizeGcashQr(file) {
  if (!file.type.startsWith("image/")) return Promise.reject(new Error("Choose an image file."));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Unable to read the QR image."));
    reader.onload = () => {
      const source = new Image();
      source.onerror = () => reject(new Error("This photo format cannot be opened here. Save or screenshot the QR as PNG or JPG, then try again."));
      source.onload = () => {
        const maxImageLength = 280_000;
        const dimensions = [900, 760, 640, 520, 420];
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) return reject(new Error("Image processing is unavailable in this browser."));
        for (const maxDimension of dimensions) {
          const scale = Math.min(1, maxDimension / Math.max(source.naturalWidth, source.naturalHeight));
          canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
          context.fillStyle = "#fff";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(source, 0, 0, canvas.width, canvas.height);
          const png = canvas.toDataURL("image/png");
          if (png.length <= maxImageLength) return resolve(png);
          for (const quality of [0.92, 0.86, 0.8]) {
            const jpeg = canvas.toDataURL("image/jpeg", quality);
            if (jpeg.length <= maxImageLength) return resolve(jpeg);
          }
        }
        reject(new Error("The QR image is still too large. Crop the image so it shows only the QR code, then try again."));
      };
      source.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function staffStockContent() {
  return `<div class="section-heading" style="margin-top:0"><div><h2>Stock tracker</h2><p class="subtle" style="margin:5px 0 0">Update quantities as canteen stock changes.</p></div></div>${menu.map(item => `<div class="staff-item"><div class="staff-item-name"><span class="small-emoji">${escapeHTML(item.emoji)}</span><div><strong style="font-size:13px">${escapeHTML(item.name)}</strong><div class="${item.stock <= 5 ? "stock-low" : "subtle"}" style="font-size:11px;margin-top:3px">${item.stock <= 5 ? "Low stock · " : ""}${item.stock} available</div></div></div><label style="font-size:11px;color:#79847b">Stock <input data-stock="${escapeHTML(item.id)}" type="number" min="0" value="${item.stock}" style="width:66px;padding:7px;border:1px solid var(--line);border-radius:8px;margin-left:5px"></label></div>`).join("")}`;
}

function staffMenuContent() {
  return `<div class="section-heading" style="margin-top:0"><div><h2>Live menu editor</h2><p class="subtle" style="margin:5px 0 0">${realtimeEnabled ? "Changes publish to all signed-in devices immediately." : "Changes are saved on this device only."}</p></div><button id="add-menu-item" class="primary" style="width:auto">＋ Add item</button></div>${menu.length ? menu.map(item => `<div class="staff-item"><div class="staff-item-name">${item.image ? `<img class="staff-menu-image" src="${escapeHTML(item.image)}" alt="">` : `<span class="small-emoji">${escapeHTML(item.emoji)}</span>`}<div><strong style="font-size:13px">${escapeHTML(item.name)}</strong><div class="subtle" style="font-size:11px;margin-top:3px">${escapeHTML(item.category)} · ${money(item.price)} · ${item.stock} in stock</div></div></div><div class="staff-menu-actions"><button class="secondary" data-edit-menu="${escapeHTML(item.id)}">Edit</button><label class="delete-slider-label" for="delete-menu-${escapeHTML(item.id)}">Slide fully to delete</label><input id="delete-menu-${escapeHTML(item.id)}" class="delete-menu-slider" data-delete-menu="${escapeHTML(item.id)}" type="range" min="0" max="100" value="0" aria-label="Slide fully to delete ${escapeHTML(item.name)}"></div></div>`).join("") : `<div class="empty-state"><div class="empty-icon">🍽️</div>No menu items yet. Add an item to publish it.</div>`}`;
}

function openMenuEditor(id = "") {
  const item = menu.find(food => food.id === id) || { name: "", category: "Meals", description: "", price: "", points: 1, stock: 0, emoji: "🍽️", tag: "", image: "" };
  const startingStock = Number(item.stock);
  let image = item.image || "";
  document.getElementById("modal-root").innerHTML = `<div class="modal-backdrop" id="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="menu-editor-title"><div class="modal-head"><h2 id="menu-editor-title">${id ? "Edit menu item" : "Add menu item"}</h2><button class="close-button" data-close aria-label="Close">×</button></div><form id="menu-editor-form"><div class="field"><label for="item-name">Item name</label><input id="item-name" name="name" required value="${escapeHTML(item.name)}"></div><div class="field"><label for="item-description">Description</label><input id="item-description" name="description" required value="${escapeHTML(item.description)}"></div><div class="field-grid"><div class="field"><label for="item-category">Category</label><select id="item-category" name="category">${["Meals", "Snacks", "Drinks", "Rice dishes"].map(category => `<option ${category === item.category ? "selected" : ""}>${category}</option>`).join("")}</select></div><div class="field"><label for="item-emoji">Emoji fallback</label><input id="item-emoji" name="emoji" value="${escapeHTML(item.emoji)}" required></div></div><div class="field"><label for="item-image">Product photo</label><input id="item-image" name="image" type="file" accept="image/*"><img id="item-image-preview" class="menu-image-preview" src="${escapeHTML(image)}" alt="Product photo preview" ${image ? "" : "hidden"}><button class="secondary" id="remove-item-image" type="button" ${image ? "" : "hidden"}>Remove photo</button><span class="field-help">Choose a product photo. Images are resized to fit this device's local storage.</span></div><div class="field-grid"><div class="field"><label for="item-price">Price (₱)</label><input id="item-price" name="price" type="number" min="0" step="0.01" value="${item.price}" required></div><div class="field"><label for="item-stock">Stock</label><input id="item-stock" name="stock" type="number" min="0" value="${item.stock}" required></div></div><div class="field"><label for="item-points">Points per item</label><input id="item-points" name="points" type="number" min="0" value="${item.points}" required></div><button class="primary" type="submit">Save menu item</button></form></section></div>`;
  bindModalClose();
  const imageInput = document.getElementById("item-image");
  const imagePreview = document.getElementById("item-image-preview");
  const removeImage = document.getElementById("remove-item-image");
  imageInput.addEventListener("change", async () => {
    const file = imageInput.files[0];
    if (!file) return;
    try {
      image = await resizeMenuImage(file);
      imagePreview.src = image;
      imagePreview.hidden = false;
      removeImage.hidden = false;
    } catch (error) {
      console.error("Unable to process the menu photo.", error);
      imageInput.value = "";
      toast("Could not load that photo. Please choose another image.");
    }
  });
  removeImage.addEventListener("click", () => {
    image = "";
    imageInput.value = "";
    imagePreview.removeAttribute("src");
    imagePreview.hidden = true;
    removeImage.hidden = true;
  });
  document.getElementById("menu-editor-form").addEventListener("submit", async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const updated = {
      id: id || `item-${Date.now()}`,
      name: String(data.get("name")).trim(),
      description: String(data.get("description")).trim(),
      category: data.get("category"),
      emoji: String(data.get("emoji")).trim(),
      price: Number(data.get("price")),
      stock: Math.max(0, Number(data.get("stock"))),
      points: Math.max(0, Number(data.get("points"))),
      tag: item.tag || "",
      image,
      sortOrder: Number(item.sortOrder ?? (id ? menu.findIndex(food => food.id === id) : menu.length))
    };
    const submitButton = event.currentTarget.querySelector("button[type='submit']");
    if (submitButton) submitButton.disabled = true;
    try {
      if (realtimeEnabled && id) {
        const result = await ordersDatabase.ref("menu").child(updated.id).transaction(current => ({
          ...(current || {}),
          ...updated,
          stock: updated.stock === startingStock ? current?.stock ?? updated.stock : updated.stock
        }), undefined, false);
        if (!result.committed) throw new Error("The shared menu item could not be updated.");
        Object.assign(updated, result.snapshot.val());
      } else if (realtimeEnabled) {
        await ordersDatabase.ref("menu").child(updated.id).set(updated);
      }
    } catch (error) {
      console.error("Unable to publish menu change.", error);
      if (submitButton) submitButton.disabled = false;
      toast("Menu was not published. Check staff access and your connection.");
      return;
    }
    menu = id ? menu.map(food => food.id === id ? updated : food) : [...menu, updated];
    write(STORAGE.menu, menu);
    renderStaff();
    toast(realtimeEnabled ? "Menu published to all devices." : "Menu saved on this device.");
  });
}

function resizeMenuImage(file) {
  if (!file.type.startsWith("image/")) return Promise.reject(new Error("Selected file is not an image."));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Unable to read image file."));
    reader.onload = () => {
      const source = new Image();
      source.onerror = () => reject(new Error("Unable to decode image file."));
      source.onload = () => {
        const scale = Math.min(1, 900 / Math.max(source.naturalWidth, source.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Canvas is unavailable."));
          return;
        }
        context.drawImage(source, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      source.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function logout() {
  if (orderSubscription) {
    orderSubscription.off("value");
    orderSubscription = null;
  }
  if (menuSubscription) {
    menuSubscription.off("value");
    menuSubscription = null;
  }
  if (paymentSettingsSubscription) {
    paymentSettingsSubscription.off("value");
    paymentSettingsSubscription = null;
  }
  if (realtimeEnabled) {
    firebaseAuth.signOut().catch(error => console.error("Unable to sign out of Firebase.", error));
  }
  profile = null;
  cart = {};
  customerTab = "Menu";
  try {
    localStorage.removeItem(STORAGE.profile);
  } catch (error) {
    console.error("Unable to clear the signed-in profile from local storage.", error);
    toast("Could not clear the saved profile on this device.");
  }
  render();
}

window.addEventListener("storage", event => {
  if (event.key === STORAGE.orders && !realtimeEnabled) orders = read(STORAGE.orders, []);
  if (event.key === STORAGE.menu && !realtimeEnabled) menu = read(STORAGE.menu, initialMenu);
  if (event.key === STORAGE.gcashQr && !realtimeEnabled) gcashQr = read(STORAGE.gcashQr, null);
  if (profile) render();
});
window.addEventListener("focus", () => {
  if (!realtimeEnabled) {
    orders = read(STORAGE.orders, []);
    menu = read(STORAGE.menu, initialMenu);
    gcashQr = read(STORAGE.gcashQr, null);
  }
  if (profile) render();
});
let displayedDay = dateKey(Date.now());
setInterval(() => {
  const currentDay = dateKey(Date.now());
  if (currentDay !== displayedDay) {
    displayedDay = currentDay;
    if (profile?.role === "Staff") renderStaff();
  }
}, 60_000);
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(error => console.error("Service worker registration failed.", error)));
}
window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
  bindInstallApp();
});
window.addEventListener("appinstalled", () => {
  installPrompt = null;
  bindInstallApp();
});
async function startApp() {
  try {
    await window.CAMPUSNACK_FIREBASE_READY;
    setupRealtime();
  } catch (error) {
    realtimeSetupError = error;
    console.error("Unable to initialize Firebase order sync.", error);
  }
  if (realtimeSetupError) {
    render();
    toast(realtimeSetupError.message);
    return;
  }
  if (realtimeEnabled && profile) {
    try {
      const user = await new Promise((resolve, reject) => {
        let unsubscribe = () => {};
        unsubscribe = firebaseAuth.onAuthStateChanged(
          currentUser => { unsubscribe(); resolve(currentUser); },
          error => { unsubscribe(); reject(error); }
        );
      });
      if (profile.role === "Staff" && (!user || user.uid !== profile.id)) {
        profile = null;
        localStorage.removeItem(STORAGE.profile);
        renderLogin("Staff");
        return;
      }
      if (profile.role !== "Staff") {
        const role = profile.role;
        const token = user ? await user.getIdTokenResult() : null;
        if (!user || user.isAnonymous || token?.signInProvider !== "password") {
          profile = null;
          localStorage.removeItem(STORAGE.profile);
          if (user) await firebaseAuth.signOut();
          customerAuthMode = "signin";
          renderLogin(role);
          toast("Student and teacher accounts now use email and password. Sign in with an Email/Password account.");
          return;
        }
        const savedProfileSnapshot = await ordersDatabase.ref("customerProfiles").child(user.uid).once("value");
        const savedProfile = savedProfileSnapshot.val();
        if (!savedProfile) {
          profile = null;
          localStorage.removeItem(STORAGE.profile);
          pendingCustomerUser = user;
          renderCustomerProfileSetup(role);
          return;
        }
        profile = { ...savedProfile, id: user.uid };
        write(STORAGE.profile, profile);
      }
      connectOrderSync();
    } catch (error) {
      console.error("Unable to restore Firebase session.", error);
      profile = null;
      renderLogin();
      toast("Firebase session unavailable. Please sign in again.");
      return;
    }
  }
  render();
}
startApp();
