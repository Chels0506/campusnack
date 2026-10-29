# CampuSnack

A responsive school canteen ordering app for students and canteen staff. Without Firebase configuration, it runs as a local-only demo using this browser's `localStorage`.

## Run the local demo

Open `index.html` in a modern browser. No package installation or build step is required. The demo's student details, wallet, and local staff code are not verified; no payment is processed.

## Enable live order, menu, and stock sync

Cross-device order and status updates require Firebase Realtime Database and Firebase Authentication:

1. Create a Firebase project and a Realtime Database.
2. In Firebase Authentication → **Sign-in method**, enable **Email/Password** for staff and **Phone** for students and teachers. Create an Email/Password account for each staff member.
3. Copy the Firebase web app's `apiKey`, `authDomain`, `databaseURL`, `projectId`, and `appId` into `firebase-config.js`. These are public client settings; never put service-account keys or other private credentials in this file.
4. In Realtime Database, add each authorized staff Firebase Auth UID at `/staffUids/<uid>` with the boolean value `true`. Do this in the Firebase Console; client writes to this allowlist are denied.
5. Publish the contents of `database.rules.json` in Realtime Database → **Rules**.
6. Host the app on HTTPS (or localhost during development), then open the same URL on customer and staff devices. Staff sign in with their Firebase account email and password.

When Firebase is configured, staff see the shared live order queue and status changes propagate in real time. The first allowlisted staff session publishes the initial menu; later staff edits and stock adjustments are shared with signed-in staff, students, and teachers. Orders reserve shared stock using Realtime Database transactions, so concurrent orders cannot successfully take the same remaining units. Customer menu access, stock reservations, customer profiles, and order access require Firebase Phone authentication; staff UIDs in the database allowlist can read and update the queue and menu. If Firebase is not configured, the app keeps using local-only mode. If configuration is partially filled or Firebase fails to load, staff authentication is disabled rather than falling back to the local demo code.

## Student and teacher phone sign-in

Students and teachers sign in using a phone number and a Firebase SMS code. No email verification or password is required for customer accounts. To enable phone sign-in:

1. In Firebase Authentication → **Sign-in method**, enable **Phone**. Email/Password remains enabled for staff accounts.
2. Configure the SMS region policy to allow the countries where users receive texts. Review Firebase's SMS quotas, abuse protections, and billing requirements; SMS may incur charges.
3. Add the published website domain under Authentication → Settings → Authorized domains. Add `localhost` only when testing locally.
4. Publish the included Realtime Database rules. They require Firebase's `firebase.sign_in_provider` claim to be `phone` for customer menu access, stock reservations, profiles, and order access.
5. Students and teachers choose **Sign in** or **Create account**, enter their mobile number in international format (for example `+639171234567`), complete reCAPTCHA, then enter the SMS code. On first use, Firebase creates the phone account. First-time users also enter their name, grade/department, section, and LRN/employee ID. Their profile is saved to Realtime Database so it follows their account across devices.

Firebase sends the code to the phone number at every customer sign-in. This is phone-based primary authentication—not email/password plus a second factor. Staff accounts continue to use Email/Password. Older anonymous or email/password customer accounts do not automatically become phone accounts, and their customer history will not automatically transfer.

Student registration requires an LRN containing exactly 12 digits. Teacher registration requires an employee ID containing exactly 7 digits. The local demo staff form also accepts an optional 7-digit employee ID.

After changing `database.rules.json`, publish the updated rules in Realtime Database → **Rules**. The `menu` path permits phone-authenticated customer reads and stock decrements plus allowlisted staff edits. The `paymentSettings/gcashQr` path allows phone-authenticated customers to read the receiver QR and only allowlisted staff to replace or remove it. The client-side demo is not a trusted payment or inventory system; production use should validate order creation, inventory, and points on a trusted server.

Each new order receives a short display code (`A001`, `A002`, and so on) from a shared Realtime Database transaction, so simultaneous orders from different devices get different codes. The app keeps Firebase's unique order key internally for syncing and actions. Older orders without a display code continue to show their existing ID.

## GCash QR payments

1. Sign in as an allowlisted staff member, open **Payments**, choose the canteen's official GCash QR image, wait for the preview and ready message, then click **Save and share receiver QR**. The app compresses the image for Firebase. Replacing or removing it updates the QR shown to signed-in customers in real time.
2. Customers choose **GCash QR**, scan the displayed code from another device or use GCash's QR gallery option, verify the recipient name in GCash, send the exact order amount, then enter the GCash transaction reference before submitting the order.
3. Staff open **Payments**, compare the submitted amount and reference against the receiver account's GCash transaction history, and click **Confirm received** only after the funds actually appear. If the funds are not visible, **Not received — cancel order** marks the order cancelled and restores its reserved quantities to shared stock. If inventory restoration fails, the app reports that staff must correct the stock manually. Cancellation does not take or refund GCash funds.

This app does not connect to GCash or verify transfers automatically. Orders paid by QR remain blocked from preparation until staff confirms them. Never treat a customer screenshot alone as proof of payment, and do not upload account passwords, PINs, or other credentials. Use only a QR issued for the canteen's authorized receiving account.

## Points and sales reports

- Staff can view completed net sales for the last 7 days or 30 days, compare the selected period with the preceding period, and see the most-ordered products for that period.
- Points are earned when an order is completed. Wallet redemption converts 10 points to ₱1 (50 points = ₱5), applies available points as a partial discount up to the order total, and records the points used. The Wallet option is unavailable when there are no redeemable points.
- This wallet is a points discount demo only. It does not collect or transfer actual money.

The included rules are a starting point for this demo. The app does not validate item prices, inventory, or payments on a trusted server, and the Firebase client config is not an authorization mechanism. Do not use this setup to process real payments or treat client-submitted order totals as trusted; production use should validate orders and inventory server-side.

## Features

- Browse, search, and filter meals, rice bowls, snacks, and drinks.
- Add items to a basket, adjust quantities, and choose wallet, QR, or cash at checkout.
- Give each new order an easy-to-read short code for staff and customer order lookup.
- Earn campus points, redeem points as a wallet discount, view rewards, order history, and a simple student or teacher profile.
- Switch to Staff view to see weekly/monthly sales and top product demand, manage shared stock and menu items, and advance orders through received, preparing, ready, and completed.
- Keep menu edits and stock levels synchronized across signed-in devices through Firebase Realtime Database.
- In the staff **Menu** tab, slide an item's delete control fully and confirm to remove it from the shared menu and stock tracker. Existing orders remain unchanged.
- Share the app link or its QR code from the **Share app** dialog. Share the QR image through the device share sheet when supported, or download it as a PNG.
- The app QR always points to `https://chels0506.github.io/campusnack/`. After publishing new files to that same URL, existing QR codes open the latest deployed version; app changes still need to be published to the hosting provider.
- Save menu, profile, cart, and other local demo data in this browser.