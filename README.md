# CampuSnack

A responsive school canteen ordering app for students and canteen staff. Without Firebase configuration, it runs as a local-only demo using this browser's `localStorage`.

## Run the local demo

Open `index.html` in a modern browser. No package installation or build step is required. The demo's student details, wallet, and local staff code are not verified; no payment is processed.

## Enable live order, menu, and stock sync

Cross-device order and status updates require Firebase Realtime Database and Firebase Authentication:

1. Create a Firebase project and a Realtime Database.
2. In Firebase Authentication → **Sign-in method**, enable **Email/Password** for students, teachers, and staff. Create an Email/Password account for each staff member.
3. Copy the Firebase web app's `apiKey`, `authDomain`, `databaseURL`, `projectId`, and `appId` into `firebase-config.js`. These are public client settings; never put service-account keys or other private credentials in this file.
4. In Realtime Database, add each authorized staff Firebase Auth UID at `/staffUids/<uid>` with the boolean value `true`. Do this in the Firebase Console; client writes to this allowlist are denied.
5. Publish the contents of `database.rules.json` in Realtime Database → **Rules**.
6. Host the app on HTTPS (or localhost during development), then open the same URL on customer and staff devices. Staff sign in with their Firebase account email and password.

When Firebase is configured, staff see the shared live order queue and status changes propagate in real time. The first allowlisted staff session publishes the initial menu; later staff edits and stock adjustments are shared with signed-in staff, students, and teachers. Orders reserve shared stock using Realtime Database transactions, so concurrent orders cannot successfully take the same remaining units. Customer menu access, stock reservations, customer profiles, and order access require Firebase Email/Password authentication; staff UIDs in the database allowlist can read and update the queue and menu. If Firebase is not configured, the app keeps using local-only mode. If configuration is partially filled or Firebase fails to load, sign-in is disabled rather than falling back to the local demo code.

## Student and teacher email/password accounts

Students and teachers register and sign in with Firebase Email/Password. SMS verification is not used. To enable customer sign-in:

1. In Firebase Authentication → **Sign-in method**, enable **Email/Password**.
2. Add the published website domain under Authentication → Settings → **Authorized domains**. Add `localhost` only when testing locally.
3. Publish the included Realtime Database rules. They require Firebase's `firebase.sign_in_provider` claim to be `password` for customer menu access, stock reservations, profiles, and order access.
4. Students and teachers choose **Create account**, enter an email address and a password of at least 6 characters, then provide their name, grade/department, section, and LRN/employee ID. Firebase creates the account and the app saves the school profile to Realtime Database. On later visits, choose **Sign in** and use the same email and password.

Email/Password is the customer sign-in method; Firebase does not send an SMS code in this flow. Staff also use Email/Password, but staff access still requires their UID to be allowlisted at `/staffUids`. Existing phone-auth customer accounts are separate Firebase accounts and do not automatically become email/password accounts; their orders and profile will not automatically transfer.

Student registration requires an LRN containing exactly 12 digits. Teacher registration requires an employee ID containing exactly 7 digits. The local demo staff form also accepts an optional 7-digit employee ID.

All sign-in and account creation forms require explicit Data Privacy consent, including staff sign-in. The submit button remains disabled until the user selects the checkbox under the Data Privacy Notice. Profile setup reached after email sign-in has the same consent requirement. Consent is checked again in each submit handler, so it cannot be bypassed by keyboard or direct form submission.

Teacher registration also requires a live camera scan of the actual Employee ID. Enter the 7-digit Employee ID first, choose **Scan actual Employee ID**, and allow camera access. A QR/barcode must return the same 7-digit code. Alternatively, use **Capture and verify printed ID** to read the printed number and name from the card. A QR/barcode payload or captured printed text containing a name must match the entered full name. Any missing scan, mismatch, or name mismatch declines the account with "The account is declined due to wrong employee ID." Camera verification requires HTTPS or localhost and rear-camera support where available.

Student LRNs are checked against the included approved-school directory. The entered full name must match the name for that LRN; unknown LRNs or mismatched names are declined with "The account is declined due to wrong LRN." The live app reads `/studentDirectory/<LRN>` from Realtime Database and client writes to that directory are denied. Import `studentDirectory.json` to `/studentDirectory` and publish `database.rules.json` before enabling registration. The static `student-directory.js` file provides the same check in local-demo mode.

Each student LRN and teacher employee ID can be registered only once across Firebase accounts. The app reserves each ID with a Realtime Database transaction before saving the profile, and the database rules require the matching reservation. Publish the latest `database.rules.json` for this check to work across devices. Existing student and teacher profiles are not automatically added to the claims registry; if the database already contains profiles, backfill `/studentLrnClaims/<12-digit-LRN>` and `/teacherEmployeeIdClaims/<7-digit-ID>` with each matching profile's UID before accepting new registrations. An ID already linked to another account cannot be reused; account recovery should use the original email/password account.

After changing `database.rules.json`, publish the updated rules in Realtime Database → **Rules**. The `menu` path permits Email/Password-authenticated customer reads and stock decrements plus allowlisted staff edits. The `paymentSettings/gcashQr` path allows authenticated customers to read the receiver QR and only allowlisted staff to replace or remove it. The client-side demo is not a trusted payment or inventory system; production use should validate order creation, inventory, and points on a trusted server.

Each new order receives a short display code (`A001`, `A002`, and so on) from a shared Realtime Database transaction, so simultaneous orders from different devices get different codes. The app keeps Firebase's unique order key internally for syncing and actions. Older orders without a display code continue to show their existing ID.

## GCash QR payments

1. Sign in as an allowlisted staff member, open **Payments**, choose the canteen's official GCash QR image, wait for the preview and ready message, then click **Save and share receiver QR**. The app compresses the image for Firebase. Replacing or removing it updates the QR shown to signed-in customers in real time.
2. Customers choose **GCash QR**, scan the displayed code from another device or use GCash's QR gallery option, verify the recipient name in GCash, send the exact order amount, then enter the GCash transaction reference before submitting the order.
3. Staff open **Payments**, compare the submitted amount and reference against the receiver account's GCash transaction history, and click **Confirm received** only after the funds actually appear. If the funds are not visible, **Not received — cancel order** marks the order cancelled and restores its reserved quantities to shared stock. If inventory restoration fails, the app reports that staff must correct the stock manually. Cancellation does not take or refund GCash funds.

Customers can cancel their own orders from **Order history** only while the status is **Received**. Once staff change it to **Preparing**, cancellation is unavailable. The order is cancelled immediately; staff see a stock-return task in the **Orders** tab and restore the reserved quantities there. If a customer has sent GCash, cancellation does not issue a refund; staff must handle it separately.

This app does not connect to GCash or verify transfers automatically. Orders paid by QR remain blocked from preparation until staff confirms them. Never treat a customer screenshot alone as proof of payment, and do not upload account passwords, PINs, or other credentials. Use only a QR issued for the canteen's authorized receiving account.

## Foreground order alerts

Signed-in staff and customers can enable **Profile → Foreground order alerts** on each device. While CampuSnack is open and connected to Firebase, staff are alerted about new orders and customers are alerted when their order status changes. Alerts use the browser's notification permission and appear in the app as well as on the device when supported.

This foreground option uses the existing live Realtime Database connection and requires no Cloud Functions deployment or billing plan upgrade. It cannot deliver alerts while the app is closed, offline, or not signed in. Open the published HTTPS site (not `index.html` from File Explorer), allow notifications when prompted, and keep the app open. On iPhone or iPad, use the installed Home Screen app if required by the browser.

Background push notifications are a separate optional feature. They require a deployed trusted Firebase Functions backend and may require the Blaze billing plan; they are not used by foreground alerts.

## Points and sales reports

- Staff can view completed net sales for the last 7 days or 30 days, compare the selected period with the preceding period, and see the most-ordered products for that period.
- Staff can select any bar in the sales report to review orders from that day (weekly view) or date range (monthly view), grouped under clear date separators with order code, items, payment, status, and amount.
- Points are awarded when an order is completed: 1 point for each ₱10 of the order total. Wallet redemption converts 25 points to ₱1, applies available points as a partial discount up to the order total, and records the points used. Points are calculated for the order, not individual menu products.
- This wallet is a points discount demo only. It does not collect or transfer actual money.

## Scan Stock

Staff can use **Scan Stock** to receive products, count/audit quantities, or record waste. The camera scanner prefers `BarcodeDetector` and falls back to `html5-qrcode`; it requests the rear camera where available and supports EAN-13, UPC-A, Code 128, and QR codes. Each accepted scan adds one unit, plays a short beep and vibrates when supported, and repeated reads of the same code within one second are ignored. Manual entry and keyboard-wedge USB/Bluetooth scanners are also supported.

Scans remain in an editable session until **Confirm stock changes**. Count mode sets the final quantity and shows the difference; waste mode requires a reason. A barcode is not required when adding a menu item: scan an unlinked code to link it later, or generate a QR label from the Stock tab. Staff can generate and print QR labels with a short six-character code for products without manufacturer codes. Existing app-generated long codes have a **Shorten & print** action; print and replace their old labels after shortening. A configurable low-stock threshold highlights items; zero stock is already shown to customers as **Sold out**.

Confirmed quantities use Realtime Database transactions to handle concurrent staff changes. The database rules allow only allowlisted staff to change staff stock settings and append immutable stock audit entries; authenticated customers may still decrement stock to reserve an order. Stock audit entries record the staff UID, product, mode, delta, reason, before/after quantity, barcode, and time. Local demo changes and their audit records remain in this browser only.

To test without a camera, sign in as staff, open **Scan Stock**, type a linked barcode into **Barcode or QR value**, and press **Add scan** (or scan with a USB/Bluetooth device that types into the field and presses Enter). For a new code, choose a product in the link prompt, then confirm. Test receive, count, and waste modes, including a waste amount greater than available stock, which must be rejected.

The included rules are a starting point for this demo. The app does not validate item prices, inventory, or payments on a trusted server, and the Firebase client config is not an authorization mechanism. Do not use this setup to process real payments or treat client-submitted order totals as trusted; production use should validate orders and inventory server-side.

## Features

- Browse, search, and filter meals, rice bowls, snacks, and drinks.
- Add menu items to the cart using the clearly labeled, touch-friendly **+ Add** buttons on desktop, tablet, and mobile.
- Add items to a basket, adjust quantities, and choose wallet, QR, or cash at checkout.
- Give each new order an easy-to-read short code for staff and customer order lookup.
- Earn campus points, redeem points as a wallet discount, view rewards, and cancel eligible orders from order history.
- Open the profile from the top-right account control to view personal details and upload a profile photo. Photos sync with Firebase for signed-in accounts.
- Switch to Staff view to see weekly/monthly sales and top product demand, manage shared stock and menu items, and advance orders through received, preparing, ready, and completed.
- Scan EAN-13, UPC-A, Code 128, or QR item codes in staff **Scan Stock** to receive, count, or record waste with a reviewable session and append-only stock audit log.
- Keep menu edits and stock levels synchronized across signed-in devices through Firebase Realtime Database.
- In the staff **Menu** tab, choose or take menu photos through the phone's standard photo picker, or slide an item's delete control fully and confirm to remove it from the shared menu and stock tracker. Existing orders remain unchanged.
- Profile picture and product photo forms each use one photo picker, avoiding duplicate camera controls on mobile.
- Share the app link or its QR code from the **Share app** dialog. Share the QR image through the device share sheet when supported, or download it as a PNG.
- Opt in to foreground order alerts from the profile on each staff or customer device; the app must remain open.
- The app QR always points to `https://chels0506.github.io/campusnack/`. After publishing new files to that same URL, existing QR codes open the latest deployed version; app changes still need to be published to the hosting provider.
- Save menu, profile, cart, and other local demo data in this browser.