# CampuSnack

A responsive school canteen ordering app for students and canteen staff. Without Firebase configuration, it runs as a local-only demo using this browser's `localStorage`.

## Run the local demo

Open `index.html` in a modern browser. No package installation or build step is required. The demo's student details, wallet, and local staff code are not verified; no payment is processed.

## Enable live order sync

Cross-device order and status updates require Firebase Realtime Database and Firebase Authentication:

1. Create a Firebase project and a Realtime Database.
2. In Firebase Authentication, enable **Anonymous** sign-in for customer sessions and **Email/Password** for staff accounts. Create an Email/Password account for each staff member.
3. Copy the Firebase web app's `apiKey`, `authDomain`, `databaseURL`, `projectId`, and `appId` into `firebase-config.js`. These are public client settings; never put service-account keys or other private credentials in this file.
4. In Realtime Database, add each authorized staff Firebase Auth UID at `/staffUids/<uid>` with the boolean value `true`. Do this in the Firebase Console; client writes to this allowlist are denied.
5. Publish the contents of `database.rules.json` in Realtime Database → **Rules**.
6. Host the app on HTTPS (or localhost during development), then open the same URL on customer and staff devices. Staff sign in with their Firebase account email and password.

When Firebase is configured, staff see the shared live order queue and their status changes propagate to customer sessions in real time. Customers can read their own orders; staff UIDs in the database allowlist can read and update the queue. If Firebase is not configured, the app keeps using local-only mode. If configuration is partially filled or Firebase fails to load, staff authentication is disabled rather than falling back to the local demo code.

The included rules are a starting point for this demo. The app does not validate item prices, inventory, or payments on a trusted server, and the Firebase client config is not an authorization mechanism. Do not use this setup to process real payments or treat client-submitted order totals as trusted; production use should validate orders and inventory server-side.

## Features

- Browse, search, and filter meals, rice bowls, snacks, and drinks.
- Add items to a basket, adjust quantities, and choose wallet, QR, or cash at checkout.
- Earn campus points, view rewards, order history, and a simple student profile.
- Switch to Staff view to filter today's queue and advance orders through received, preparing, ready, and completed.
- Share the app link or its QR code from the **Share app** dialog. Share the QR image through the device share sheet when supported, or download it as a PNG.
- Save menu, profile, cart, and other local demo data in this browser.