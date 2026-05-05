# BLC Plant Hire — Android app (+ legacy JSX snippet)

Namibia plant hire & sales platform. Primary codebase: Android WebView app with bundled web UI in `app/src/main/assets/www/index.html`.

A standalone **`blc-plant-hire.jsx`** file remains in the repo root from earlier iterations (reference only).

---

## How to build the APK

### Prerequisites

1. **Android Studio** — https://developer.android.com/studio  
2. **Java JDK 17+** — usually bundled with Android Studio  

### Steps

1. Install Android Studio; accept **Standard** setup so the **Android SDK** installs.
2. **Open** this folder as an existing project (not New Project).
3. Gradle sync finishes (first run may take a few minutes).
4. **Debug APK:** **Build → Build Bundle(s) / APK(s) → Build APK(s)** → output:  
   `app/build/outputs/apk/debug/app-debug.apk`
5. **Release:** **Build → Generate Signed Bundle / APK** → keep your keystore safe forever.

### Upload to Google Play

See https://play.google.com/console — upload signed bundle/APK and complete store listing.

---

## App details

- **Package:** `com.blctransport.planthire`  
- **Min SDK:** API 21  
- **UI:** Single-page web app inside WebView (`index.html`)  
- **Contact:** +264 81 603 4139 · blc.bertus@gmail.com  

---

## Mail API (Node backend)

1. Copy `backend-api/.env.example` → `backend-api/.env` and set SMTP + `ADMIN_EMAIL`, optional `API_KEY`.  
2. `cd backend-api` → `npm install` → `npm start` (default `8787`).  
3. In the app, set `localStorage` keys `blc_api_base` (server URL) and `blc_api_key` if used.

Details about payments panel, login flows, and optional hero image paths remain documented inline in `index.html` comments where relevant.

---

## Troubleshooting

- Gradle sync fails → **Android SDK Platform** matching `compileSdk` (often 34).  
- Build fails → **Project Structure** uses JDK 17.  
- APK sideload → allow install from unknown sources on device settings.
