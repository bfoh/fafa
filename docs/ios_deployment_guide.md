# iOS Testing & App Store Submission Guide — Didi Mobile

This document details the step-by-step instructions for testing the **Didi** iOS application locally, setting up beta testing via Apple TestFlight, and submitting the app to the Apple App Store.

---

## 1. Prerequisites & Environment Setup

Because iOS apps require compiling native Swift code, you must perform these steps on a Mac machine with a configured Apple Developer setup.

### 1.1 Command Line Tools & Xcode Setup
If you receive the error `xcodebuild requires Xcode` or similar command line errors, your active developer tools are pointed to the standalone command-line tools rather than the full Xcode application.

1. **Install Xcode** from the Mac App Store.
2. Select the correct active developer directory in your terminal:
   ```bash
   sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ```
3. Accept the Xcode license agreement:
   ```bash
   sudo xcodebuild -license
   ```

### 1.2 CocoaPods Installation
CocoaPods is required by Capacitor to manage native iOS dependencies (pods).
- Install it via Homebrew (recommended) or RubyGems:
  ```bash
  brew install cocoapods
  # OR
  sudo gem install cocoapods
  ```

### 1.3 Apple Developer Program
To test on physical devices (without developer mode limitations) and upload to App Store Connect, you must enroll in the **Apple Developer Program** ($99/year) at [developer.apple.com](https://developer.apple.com/).

---

## 2. Initialize Capacitor iOS Platform

Follow these steps to generate the native iOS project files from the Next.js static export:

1. **Generate the Static Export (`out/` folder)**:
   ```bash
   # From the repository root:
   npm run mobile:export
   ```
   This compiles your Next.js app statically using `output: 'export'` and saves the bundle to `apps/mobile/out`.

2. **Add the iOS Platform**:
   ```bash
   cd apps/mobile
   npx cap add ios
   ```
   This will create a native Xcode project in `apps/mobile/ios/`.

3. **Sync the Web Assets & Plugins**:
   ```bash
   npx cap sync ios
   ```
   This command copies the `out/` folder into the iOS project and installs all Capacitor plugin pods (e.g., Push Notifications, Haptics, Preferences).

---

## 3. Configuration & Capabilities (Xcode)

To configure push notifications, background geolocation, and dynamic links, you must configure target capabilities in Xcode.

### 3.1 Open the Project in Xcode
Launch Xcode and load the generated workspace:
```bash
npx cap open ios
# OR double-click: apps/mobile/ios/App/App.xcworkspace (Do NOT open the .xcodeproj file)
```

### 3.2 Code Signing
In Xcode, select the **App** target in the sidebar, open the **Signing & Capabilities** tab:
1. Check **Automatically manage signing**.
2. Select your **Developer Team** (from your Apple Developer Account).
3. Confirm the **Bundle Identifier** matches your registration: `com.ghdidi.app`.

### 3.3 Add Capabilities
Click the **+ Capability** button in the top-left of the Signing & Capabilities panel to add these:

* **Push Notifications**: Enables FCM/APNs registration.
* **Background Modes**: Check:
  - **Location updates** (Required for background geolocation tracking in Phase 4).
  - **Remote notifications** (Required for background/silent push notifications).
* **Associated Domains**: Add the dynamic routing domain:
  - `applinks:www.ghdidi.com` (Enables Universal Links so shared URLs open in-app).

### 3.4 Permissions & User-Facing Explanations (`Info.plist`)
Open the `Info.plist` file inside Xcode (or edit `apps/mobile/ios/App/App/Info.plist`) to configure permission strings that explain why Didi accesses native hardware. Ensure these descriptions are clear and direct to pass Apple review.

Add the following keys:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Didi accesses your location to select your delivery address and coordinate deliveries.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Didi tracks your delivery coordinates in the background to keep customers updated on their orders.</string>
<key>UIBackgroundModes</key>
<array>
    <string>location</string>
    <string>remote-notification</string>
</array>
```

---

## 4. Push Notifications Setup (APNs + Firebase)

To route push notifications through FCM to iOS devices:

1. **Create an APNs Key**:
   - Go to [developer.apple.com](https://developer.apple.com/) → Certificates, Identifiers & Profiles → **Keys**.
   - Create a new key, select **Apple Push Notifications service (APNs)**.
   - Download the `.p8` key file. Note your **Key ID** and your **Team ID**.
2. **Configure Firebase Console**:
   - Go to your Firebase Project Settings → **Cloud Messaging** tab.
   - Under **Apple app share configuration**, upload your `.p8` key file.
   - Input your Key ID and Team ID.
3. **Register App ID App Identifier**:
   - Ensure the Bundle ID is registered in Apple Developer portal with the "Push Notifications" capability checked.

---

## 5. Local Testing

### 5.1 iOS Simulator
In Xcode:
1. Select a simulator device (e.g., iPhone 15) from the device target dropdown at the top.
2. Click the **Play (Run)** button or press `Cmd + R`.
3. The app will build and launch in the simulator.

### 5.2 Physical iOS Device
1. Connect your iPhone to your Mac via USB.
2. Select your physical iPhone from the device target dropdown in Xcode.
3. **Enable Developer Mode** (iOS 16+):
   - On your iPhone: Go to **Settings** → **Privacy & Security** → scroll to **Developer Mode** and toggle it **On**.
   - Restart the phone and enter your passcode.
4. Run the app (`Cmd + R`) in Xcode to load the binary directly onto your device.

---

## 6. Beta Testing via Apple TestFlight

Before submitting to the public store, use TestFlight to run external or internal betas.

### 6.1 Create an App Record on App Store Connect
1. Log in to [appstoreconnect.apple.com](https://appstoreconnect.apple.com/).
2. Go to **My Apps** → click the **+ (New App)** button.
3. Select **iOS**, enter "Didi" as the name, select English, and choose the bundle ID `com.ghdidi.app`.
4. Set SKU (e.g., `didi-ios-sku`). Select User Access options, and click **Create**.

### 6.2 Archive and Upload via Xcode
1. In Xcode, change the build destination from a simulator or device to **Any iOS Device (arm64)**.
2. Select **Product** → **Archive** from the top menu.
3. Once the archive compiles, the Organizer window will open. Click **Distribute App**.
4. Select **TestFlight & App Store** → click **Next** and follow the prompts to sign and upload the build to App Store Connect.

### 6.3 Configure TestFlight Users
1. Once the upload finishes processing on App Store Connect (takes 10-20 minutes):
   - Go to App Store Connect → **TestFlight** tab.
2. **Internal Testing**: Add members of your App Store Connect team to the "App Store Connect Users" group. They get access to builds instantly.
3. **External Testing**: Create an external testing group, add email addresses of external testers, and submit the build to Beta App Review (usually approved within hours).

---

## 7. Submitting to the Apple App Store

Once your beta is validated, follow these steps to request App Store approval:

### 7.1 Fill Out Store Metadata
On App Store Connect:
- **Screenshots**: Upload required screenshots for 6.5" iPhones (iPhone XS Max/11 Pro Max size) and 5.5" iPhones (iPhone 8 Plus size).
- **Metadata**: Add app description, keywords, support URL, and marketing URL.
- **Privacy Policy**: Provide a link to Didi's privacy policy. You must declare that the app accesses user locations and handles payment details.

### 7.2 Prepare App Review Information
Provide Apple's reviewers with credentials to test the storefront:
- A test customer account credentials (username/password).
- A test merchant or test storefront slug.
- Explain the payment flow fallback (Paystack escape hatch) and background geofencing logic.

### 7.3 Guidelines Compliance (Apple Review 4.2)
To prevent rejection under Apple Guideline 4.2 (Minimum Functionality / WebView wrap), ensure:
- The app utilizes native animations and feedback (Capacitor Haptics are integrated).
- Push notification permission request executes at an appropriate context (e.g. after registration or onboarding).
- Local storage persistent layouts function offline.
- State matches the native aesthetic and doesn't display web navigation components (like web footers, headers, or desktop layout remnants).

### 7.4 Submit for Review
Under your iOS App release section:
1. Select the build you uploaded via TestFlight.
2. Click **Save** and then **Submit for Review**.
3. Apple's review typically takes between 24 to 48 hours.
