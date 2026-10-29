# CampuSnack

A responsive school canteen ordering app for students and canteen staff. Without Firebase configuration, it runs as a local-only demo using this browser's `localStorage`.

## Run the local demo

Open `index.html` in a modern browser. No package installation or build step is required. The demo's student details, wallet, and local staff code are not verified; no payment is processed.

## Enable live order, menu, and stock sync

Cross-device order and status updates require Firebase Realtime Database and Firebase Authentication:

1. Create a Firebase project and a Realtime Database.
2. In Firebase Authentication, enable **Email/Password** sign-in. Create an account for each staff member. Customer sign-in also uses Email/Password and SMS multi-factor authentication.
3. Copy the Firebase web app's `apiKey`, `authDomain`, `databaseURL`, `projectId`, and `appId` into `firebase-config.js`. These are public client settings; never put service-account keys or other private credentials in this file.
4. In Realtime Database, add each authorized staff Firebase Auth UID at `/staffUids/<uid>` with the boolean value `true`. Do this in the Firebase Console; client writes to this allowlist are denied.
5. Publish the contents of `database.rules.json` in Realtime Database → **Rules**.
6. Host the app on HTTPS (or localhost during development), then open the same URL on customer and staff devices. Staff sign in with their Firebase account email and password.

When Firebase is configured, staff see the shared live order queue and status changes propagate in real time. The first allowlisted staff session publishes the initial menu; later staff edits and stock adjustments are shared with signed-in staff, students, and teachers. Orders reserve shared stock using Realtime Database transactions, so concurrent orders cannot successfully take the same remaining units. Customer menu access, stock reservations, and order access require Firebase's SMS second-factor sign-in claim; staff UIDs in the database allowlist can read and update the queue and menu. If Firebase is not configured, the app keeps using local-only mode. If configuration is partially filled or Firebase fails to load, staff authentication is disabled rather than falling back to the local demo code.

## Student and teacher SMS multi-factor authentication

Live student and teacher accounts require an email/password plus a Firebase SMS second factor. To enable it:

1. Upgrade the Firebase project to **Identity Platform** in Firebase Authentication settings and enable SMS multi-factor authentication.
2. Enable **Email/Password** as a sign-in provider. Configure the SMS region policy to allow the countries where your users receive texts, and review the project's SMS quotas and billing requirements.
3. Add the published website domain under Authentication → Settings → Authorized domains. Add `localhost` only when testing locally.
4. Publish the included Realtime Database rules. They require the `firebase.sign_in_second_factor` claim for customer menu access, stock reservations, and private order access; an Email/Password session alone is not enough. Existing customer sessions previously created with anonymous sign-in must create a new email/password account and enroll a phone. This app does not migrate anonymous profiles or order history to the new account; staff can still see the older orders.
5. Students and teachers select **Create account**, enter their Gmail address and a password, then enter their phone number in international format (for example `+639171234567`). Firebase's reCAPTCHA and SMS verification complete the phone enrollment. On later sign-ins, Firebase requires an SMS code after the password.

The app does not generate or send homemade codes. Firebase controls phone verification, SMS delivery, and MFA challenges. Real SMS enrollment and sign-in require the Identity Platform configuration above and must be tested with an SMS-capable phone. Staff accounts remain Email/Password accounts and do not use this student/teacher MFA flow.

After changing `database.rules.json`, publish the updated rules in Realtime Database → **Rules**. The `menu` path permits SMS-MFA customer reads and stock decrements plus allowlisted staff edits. The `paymentSettings/gcashQr` path allows SMS-MFA customers to read the receiver QR and only allowlisted staff to replace or remove it. The client-side demo is not a trusted payment or inventory system; production use should validate order creation, inventory, and points on a trusted server.

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
- Earn campus points, redeem points as a wallet discount, view rewards, order history, and a simple student or teacher profile.
- Switch to Staff view to see weekly/monthly sales and top product demand, manage shared stock and menu items, and advance orders through received, preparing, ready, and completed.
- Keep menu edits and stock levels synchronized across signed-in devices through Firebase Realtime Database.
- Share the app link or its QR code from the **Share app** dialog. Share the QR image through the device share sheet when supported, or download it as a PNG.
- The app QR always points to `https://chels0506.github.io/campusnack/`. After publishing new files to that same URL, existing QR codes open the latest deployed version; app changes still need to be published to the hosting provider.
- Save menu, profile, cart, and other local demo data in this browser.