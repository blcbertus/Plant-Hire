# BLC Transport & Plant Hire — Android App
## How to Build the APK

### What you need (free downloads)
1. **Android Studio** — https://developer.android.com/studio
2. **Java JDK 17+** — usually bundled with Android Studio

---

### Step 1 — Install Android Studio
Download and install Android Studio from the link above.
During setup, let it install the **Android SDK** (click "Standard" setup).

---

### Step 2 — Open the project
1. Open Android Studio
2. Click **"Open"** (not "New Project")
3. Navigate to this folder: `BLCPlantHire`
4. Click **OK**
5. Wait for Gradle to sync (bottom progress bar — takes 2–5 minutes first time)

---

### Step 3 — Build the Debug APK (for testing)
1. In the top menu: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Wait for the build to finish
3. Click **"locate"** in the popup, or find it at:
   `app/build/outputs/apk/debug/app-debug.apk`

Install this APK on your Android phone to test.

---

### Step 4 — Build the Release APK (for Google Play)
1. Top menu: **Build → Generate Signed Bundle / APK**
2. Choose **APK**
3. Click **"Create new..."** to create a keystore (save this file safely — you need it forever)
4. Fill in your details, set passwords
5. Choose **release** build variant
6. Click **Finish**
7. Find the signed APK at:
   `app/build/outputs/apk/release/app-release.apk`

---

### Step 5 — Upload to Google Play
1. Go to https://play.google.com/console
2. Pay the one-time $25 USD developer fee
3. Create a new app
4. Upload your `app-release.apk`
5. Fill in store listing details, screenshots, description
6. Submit for review (1–7 days)

---

### App Details
- **Package name:** com.blctransport.planthire
- **Min Android version:** 5.0 (API 21) — covers 99%+ of devices
- **App works offline** — all data stored locally on device
- **Tel/Email links** open native phone & email apps

---

### Suggested Play Store Description
```
BLC Transport & Plant Hire — Namibia's platform for plant equipment hire and sales.

Browse excavators, tipper trucks, graders, cranes and more across all 14 Namibian regions. List your own equipment for hire or sale — free, reviewed by BLC Transport.

Features:
• Browse hire & sale listings by category and region
• Submit your own equipment listing with photos
• Contact BLC directly via call or email
• Admin panel for BLC staff to manage listings

Contact: +264 81 603 4139 | blc.bertus@gmail.com
```

---

### Mail API (automatic quotes & invoices)
The web app in `app/src/main/assets/www/` can call a small Node server so hire quotes, sale invoices, and password emails are sent via **SMTP** instead of opening mail drafts.

1. Copy `backend-api/.env.example` to `backend-api/.env` and set `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and (recommended) `API_KEY`.
2. From `backend-api`, run `npm install` then `npm start` (default port `8787`).
3. In the app (browser or WebView), set `localStorage` `blc_api_base` to your server URL, e.g. `http://localhost:8787`, and if you set `API_KEY` on the server, set `blc_api_key` to the same value. Optionally set the constant `BLC_API_BASE_DEFAULT` in `index.html` for fixed deployments.
4. **Admin email reset** must use the same `ADMIN_EMAIL` as on the server; a new admin password is stored in `backend-api/data/admin-password.json` and used for API verification.

5. **Namibia online payments (DPO, Mpay, bank gateways, PayPal, Stripe note):** the app includes an **Admin → 💳 Payments** screen with the full shortlist, setup tips, and optional saved “checkout” URLs (stored in the browser) so quote modals can show **Pay online** when configured.

6. **User login (email/password), registration, forgot password (email via API or mailto), Share App, Logout** — all in `app/src/main/assets/www/index.html`. By default, sign-in is **session-only** unless the user checks **Stay signed in on this device**. **Continue as guest** allows browsing; listing, advertising, booking, bidding, and posting equipment requests require signing in.

7. **Optional login image:** add `app/src/main/assets/www/images/blc-login-hero.png` (see `images/blc-login-hero.README.txt`).

---

### Troubleshooting
- **Gradle sync fails** → Go to File → Settings → Android SDK → install SDK Platform 34
- **Build fails** → Make sure JDK 17 is selected in File → Project Structure → SDK Location
- **App crashes on phone** → Enable "Install unknown apps" in phone settings before installing debug APK
