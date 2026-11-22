# BillSumthin

**Understand any bill. Keep the details. See the patterns.**

BillSumthin is an offline-first bill and receipt companion for Android. It turns photos of receipts, utility bills, and statements into structured information you can review, compare, and export — without making cloud sync mandatory.

<p align="center">
  <strong>Capture → Understand → Compare → Keep</strong>
</p>

## What it does

### Capture documents
- Native Android capture powered by CameraX, with automatic flash control, optional framing grid, gallery import, and document perspective correction.
- Still-photo capture requests the highest resolution supported by the device and uses CameraX's quality-prioritized capture mode.
- Browser fallback requests a high-resolution rear camera stream where the device supports it.

### Understand the details
- On-device ML Kit text recognition for supported scripts and languages.
- Structured extraction of providers, dates, line items, tax, fees, discounts, totals, and amount due.
- Bill-type recognition for common household, utility, subscription, education, finance, and service bills.
- Currency-aware parsing, including Bangladeshi taka (`৳` / `BDT`).

### See the patterns
- Compare a new bill against previous bills from the same provider.
- Surface meaningful bill changes and recurring expenses.
- Track spending by month, category, and normalized unit price.
- Correct categories and keep the local history useful over time.

### Keep and share your records
- Local-first persistence using IndexedDB.
- Branded PDF and TXT exports.
- Optional Firebase cloud sync for sanitized bill metadata. Raw OCR text is not uploaded by the bill-sync path.

## Account and privacy

The Android app includes a Firebase Authentication entry screen with email/password account creation and sign-in. Firebase Authentication persists the session, so users stay signed in between launches until they explicitly sign out from **Settings → Your account**.

**Google sign-in status:** the supplied `android/app/google-services.json` currently has an empty `oauth_client` array and no OAuth client IDs. The Google button is therefore presented as not yet configured rather than pretending to authenticate. To enable it:

1. In Firebase Console, open **Authentication → Sign-in method** and enable **Google**.
2. Add the Android app (`com.akhil.billsumthin`) and its SHA-1/SHA-256 signing fingerprints in Firebase project settings.
3. Download the refreshed `google-services.json` and replace `android/app/google-services.json`.
4. Add and verify the native Google credential flow before enabling the Google button in the UI.

Bill data is stored locally by default. Cloud sync is optional and can be switched off in Settings. Avoid committing private signing keys, service-account files, or API secrets to source control. The Firebase client configuration in `google-services.json` identifies the app; it is not a substitute for Firestore/Storage security rules.

## Design direction

The interface uses a restrained liquid-glass language: translucent layered surfaces, soft indigo accents, fine borders, depth from blur and light, generous spacing, and short spring-like interactions. It intentionally avoids neon sci-fi styling and metallic/gold decoration. Motion respects the user's reduced-motion preference.

## Technology

| Layer | Technology |
| --- | --- |
| UI | HTML, CSS, Vanilla JavaScript modules |
| Android bridge | Capacitor 6 |
| Native camera | Kotlin, CameraX 1.4.0 |
| OCR | Google ML Kit Text Recognition |
| Authentication | Firebase Authentication |
| Cloud data | Cloud Firestore, Firebase Storage |
| Server-side AI proxy | Firebase Cloud Functions (Node.js 20) |
| Android build | Gradle, GitHub Actions |

## Project layout

```text
BillSumthin/
├── android/                         # Native Android app and Kotlin plugins
│   └── app/src/main/java/com/akhil/billsumthin/
│       ├── MainActivity.kt
│       ├── DocumentCameraActivity.kt
│       ├── NativeCameraPlugin.kt
│       ├── NativeFirebasePlugin.kt
│       ├── NativeOcrPlugin.kt
│       ├── NativeFileExportPlugin.kt
│       └── PerspectiveCorrector.kt
├── functions/                        # Firebase Cloud Functions
├── scripts/build-web.mjs             # Web asset build/copy step
├── www/
│   ├── auth.html                      # Sign-in / create-account entry
│   ├── scan.html                      # Main scan workspace and camera fallback
│   ├── bill-details.html
│   ├── history.html
│   ├── spending.html
│   ├── categories.html
│   ├── settings.html
│   ├── css/                           # Design system and page styles
│   ├── js/                            # App, camera, OCR, Firebase, storage modules
│   └── locales/                       # UI translations
├── capacitor.config.ts
├── firebase.json
├── firestore.rules
├── storage.rules
└── package.json
```

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Open the local development URL printed by `serve`. The native Firebase Authentication bridge is available in the Android app; browser-only preview does not emulate native Firebase sign-in.

## Build Android

```bash
npm install
npm run android:sync
```

To build a debug APK:

```bash
cd android
./gradlew assembleDebug
```

The APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

For a release build, configure the signing values described below and run:

```bash
./gradlew assembleRelease
```

## GitHub Actions release

The workflow in `.github/workflows/android-release.yml` builds an Android artifact on pushes to the configured branch and on manual dispatch. Add these repository secrets for a signed release:

| Secret | Purpose |
| --- | --- |
| `KEYSTORE_BASE64` | Base64-encoded `.jks` / `.keystore` file |
| `KEYSTORE_PASSWORD` | Keystore password |
| `KEY_ALIAS` | Signing key alias |
| `KEY_PASSWORD` | Signing key password |

Without signing secrets, use the debug artifact for testing only.

## Firebase and AI setup

- Confirm Email/Password is enabled in Firebase Authentication.
- Configure Google sign-in as described in **Account and privacy** before exposing that provider.
- Review `firestore.rules` and `storage.rules` against your production data model before deployment.
- Keep `GEMINI_API_KEY` in Firebase Functions secrets, never in frontend source code.

```bash
firebase functions:secrets:set GEMINI_API_KEY
firebase deploy --only functions,firestore:rules,storage
```

## Permissions

- **Camera:** requested only when the user chooses Take Photo.
- **Gallery:** Android's system photo picker / document chooser is used; the app does not request broad all-files access.
- **Network:** needed for optional Firebase services and online AI analysis. Local bill storage and on-device OCR remain available without a network connection.

## Notes

- Camera image quality still depends on the phone's camera hardware, lighting, focus, and the CameraX-supported output sizes. The app now asks for the highest available still-capture resolution, but software cannot exceed the device's sensor and lens capabilities.
- The project contains an Android `google-services.json`; keep project configuration aligned with the Firebase Android app registration.
- Test account creation, sign-in, sign-out, offline capture, OCR, and export on a physical device before publishing.
