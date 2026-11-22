# BillSumthin

**Understand Any Bill**

BillSumthin is an offline-first Android application built with HTML, CSS, Vanilla JavaScript, Capacitor, Kotlin, CameraX, ML Kit On-Device Text Recognition, and Firebase. It scans receipts, utility bills, and financial statements, extracts structured line items and totals, detects suspicious increases and recurring charges, tracks unit price history, categorizes spending, and exports multi-page PDF and TXT reports.

## Features

- **Native CameraX Document Capture**: Live preview, Auto/On/Off flash control, graceful handling on devices without flash, and automatic document boundary cropping with subtle readability enhancement.
- **Modern Photo Picker**: Uses Android's `PickVisualMedia` photo picker without requesting unrestricted storage permissions.
- **On-Device Multilingual OCR**: ML Kit Text Recognition supporting Latin, Devanagari/Indic, Chinese, Japanese, Korean, and 50+ languages while preserving numbers, decimals, dates, and currency symbols.
- **Bangladesh & Global Bill Understanding**: Recognizes 16+ bill types (electricity, gas, water, ISP/Wi-Fi, mobile postpaid/recharge, DTH/cable, rent, maintenance, municipal, credit card, loan/EMI, insurance, school/college fees, government fees) and treats `৳` and `BDT` identically across 50+ currencies.
- **Suspicious Change & Recurring Detection**: Flags meaningful bill jumps/drops compared to prior bills from the same provider and identifies recurring monthly expenses.
- **Price History & Auto-Categorization**: Normalizes unit prices (e.g., `5 kg rice` to per-kg pricing), learns manual category corrections locally, and visualizes monthly spending.
- **PDF & TXT Export**: Generates branded multi-page PDFs and clean `BillSumthin.txt` summaries saved via Android `MediaStore.Downloads` and `FileProvider`.
- **50+ UI Languages & RTL**: Includes dedicated locale dictionaries and full RTL layout support for Arabic, Urdu, Persian, and Hebrew.
- **Offline-First & Optional Cloud Sync**: Persists all bills locally in IndexedDB; optionally syncs sanitized metadata to Firebase Firestore when Cloud Sync is enabled.

## Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, ES Modules (no frontend frameworks)
- **Native Bridge**: Capacitor 6 (`com.akhil.billsumthin`)
- **Android Native**: Kotlin, CameraX 1.4.0, ML Kit Text Recognition 16.0.1, MediaStore/FileProvider
- **Cloud & AI Proxy**: Firebase Auth, Cloud Firestore, Firebase Storage, Firebase Cloud Functions (Node 20 + Gemini API)
- **CI/CD**: GitHub Actions (`android-release.yml`)

## Project Structure

```text
BillSumthin/
├── .github/workflows/android-release.yml
├── android/
│   ├── app/
│   │   ├── google-services.json
│   │   ├── build.gradle
│   │   └── src/main/java/com/akhil/billsumthin/
│   │       ├── MainActivity.kt
│   │       ├── NativeCameraPlugin.kt
│   │       ├── DocumentCameraActivity.kt
│   │       ├── PerspectiveCorrector.kt
│   │       ├── NativeOcrPlugin.kt
│   │       ├── NativeFileExportPlugin.kt
│   │       └── NativeFirebasePlugin.kt
│   ├── build.gradle
│   └── settings.gradle
├── functions/
│   ├── index.js
│   └── package.json
├── scripts/build-web.mjs
├── www/
│   ├── index.html, pre-loader.html, scan.html, bill-details.html,
│   │   history.html, spending.html, categories.html, settings.html,
│   │   features.html, ocr.html
│   ├── css/
│   ├── js/
│   ├── locales/
│   └── assets/
├── capacitor.config.ts
├── firebase.json
├── firestore.rules
├── storage.rules
└── package.json
```

## Local Development

```bash
npm install
npm run build
npm run dev
```

## Android Build

1. Ensure `android/app/google-services.json` is present (already included for `com.akhil.billsumthin`).
2. Sync web assets into Android:

```bash
npx cap sync android
```

3. Build locally:

```bash
cd android
./gradlew assembleDebug
```

For a signed release APK locally:

```bash
./gradlew assembleRelease
```

## GitHub Actions Release APK & Required Secrets

Pushing to `main` or `master` (or triggering `workflow_dispatch`) runs `.github/workflows/android-release.yml` and uploads `app-release.apk` as a workflow artifact.

Configure these **GitHub Repository Secrets** (`Settings -> Secrets and variables -> Actions`):

| Secret | Purpose |
| :--- | :--- |
| `KEYSTORE_BASE64` | Base64-encoded Android release `.keystore` / `.jks` file |
| `KEYSTORE_PASSWORD` | Keystore password |
| `KEY_ALIAS` | Signing key alias |
| `KEY_PASSWORD` | Signing key password |

If signing secrets are not yet configured, the workflow falls back to building a debug APK artifact.

## AI Backend & Firebase Setup

Never put `GEMINI_API_KEY` in frontend code or commit it to GitHub. Deploy the Cloud Function proxy in `functions/`:

```bash
firebase functions:secrets:set GEMINI_API_KEY
firebase deploy --only functions,firestore:rules,storage
```

## Permissions & Privacy

- **Camera**: Requested contextually only when tapping **Take Photo**.
- **Gallery**: Uses Android's modern Photo Picker (`PickVisualMedia`); no broad storage permission (`MANAGE_EXTERNAL_STORAGE`) is requested.
- **Privacy**: Credit card and loan account numbers are masked (`**** **** 1234`). Raw OCR text is never synced to Firestore, and cloud upload only occurs when **Cloud sync** is enabled in Settings.
