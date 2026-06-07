# Native setup (after `cap add android` / `cap add ios`)

Paste-ready config for the Phase 2–3 native features. Capacitor regenerates the
`android/` and `ios/` projects from `cap add`, so apply these once after that.
Replace every `REPLACE_*` placeholder.

---

## Android

### 1. Permissions — `android/app/src/main/AndroidManifest.xml`
Add inside `<manifest>` (above `<application>`):
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<!-- Android 13+ runtime push permission -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

### 2. Deep links (App Links) — inside the `<activity>` for `MainActivity`
```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="www.ghdidi.com" />
</intent-filter>
```
Then host the real release SHA-256 in `apps/web/public/.well-known/assetlinks.json`
(get it: `keytool -list -v -keystore <release.keystore> -alias <alias>`).

### 3. FCM push
- Put **`google-services.json`** (Firebase console → Project settings → Android app)
  in `android/app/`.
- `android/build.gradle` → `dependencies` (buildscript):
  ```gradle
  classpath 'com.google.gms:google-services:4.4.2'
  ```
- bottom of `android/app/build.gradle`:
  ```gradle
  apply plugin: 'com.google.gms.google-services'
  ```

### 4. Background geolocation
`@capacitor-community/background-geolocation` auto-merges its tracking service.
The permissions above are all it needs. On first "Share location" the OS will
prompt; the user must choose **Allow all the time** for background updates.

---

## iOS

### 1. `ios/App/App/Info.plist`
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Didi shares your delivery location with the customer while you deliver.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Didi keeps sharing your delivery location in the background so customers can track their order.</string>
<key>UIBackgroundModes</key>
<array>
    <string>location</string>
    <string>remote-notification</string>
</array>
```

### 2. Xcode → target **App** → Signing & Capabilities (+ Capability)
- **Push Notifications**
- **Background Modes** → check *Location updates* + *Remote notifications*
- **Associated Domains** → add `applinks:www.ghdidi.com`

Then fill `apps/web/public/.well-known/apple-app-site-association` with your real
`TEAMID.com.ghdidi.app` and re-deploy web.

### 3. APNs / push
- Apple Developer → create an **APNs key (.p8)**; upload it in Firebase
  (Project settings → Cloud Messaging → Apple app) so FCM can deliver to iOS, or
  send via APNs directly. Capacitor registers with APNs natively.
- `pod install` runs via `cap sync`.

---

## Server (apps/web) — push credentials
Set on Vercel (Project → Settings → Environment Variables):
```
FCM_PROJECT_ID=...
FCM_CLIENT_EMAIL=...           # service account email
FCM_PRIVATE_KEY=...            # service account private key (\n-escaped ok)
```
Firebase console → Project settings → Service accounts → Generate new private
key. Until these are set, push is a no-op (the order flow is unaffected).

---

## Quick boot (storefront only — no push/geo needed)
```bash
cp apps/mobile/.env.example apps/mobile/.env.local   # fill API base + anon key
npm run mobile:export
cd apps/mobile && npx cap add android
cd .. && npm run mobile:android                        # opens Android Studio → ▶
```
Validate: app boots → open `/store/?slug=<real-slug>` (real menu, CORS ok) →
airplane-mode relaunch still shows the menu.
