# CampuSnack

CampuSnack is a responsive, installable school-canteen ordering app. It has separate student/teacher and staff interfaces, selected automatically after sign-in.

## Run the app

Serve this folder from a local web server (service workers and install prompts are not available from `file://`). For example, with Python installed:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000` in a browser. The app can be installed from supported desktop and mobile browsers using their **Install app** or **Add to Home Screen** option. iOS installation is available through Safari's Share menu.

Use **Share app** on the sign-in or app screen to display a QR code and copy the current app link. The QR code is generated on your device. When running locally, it points to `localhost` and only works on that same device; publish the app to a public web address before sharing it with others.

## Sign in

- **Student:** enter a name, grade level, section, and LRN.
- **Teacher:** enter a name, department/grade, section, and employee ID.
- **Staff:** enter a name and the private staff access code `EAPIHS2009`. Employee ID is optional.

The role determines which interface opens. Students and teachers can browse and like items, manage a cart, select wallet/QR/cash, place orders, follow status, and view their profile and points. Staff can update order status, stock counts, and menu items, and see completed sales.

## Demo limitations

This is a front-end demonstration. Profiles, menu edits, inventory, and orders are stored in the browser's local storage; they are not synced between devices or browsers and are not backed up. “Live” updates work across tabs sharing the same browser storage, but this is not a real-time multi-user service. Wallet, QR, and cash selections are not connected to a payment provider; no payments are processed.

The staff code is embedded in the client-side app and is visible to anyone who can inspect its source. It only demonstrates role-gated navigation and is **not secure staff authentication**. Do not use this app with real student information or live payments. A production rollout needs a backend with server-side identity/role verification, shared database and order updates, secure staff authorization, privacy controls, and payment-provider integration.
