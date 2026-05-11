# NSE/BSE AI Trading Terminal — Android APK

A Capacitor-wrapped Android app that connects to your deployed server.
Looks and feels like a native Android app with a launcher icon and no browser chrome.

## Requirements

- **Android Studio** (latest stable) — https://developer.android.com/studio
- **Android 13–17** (API 33–37) support is configured
- **JDK 17** — bundled with Android Studio
- **Internet connection** — app connects to deployed server for live data

## Deployed Server URL

The app is configured to connect to:
```
https://d43f1a26-4e25-4acf-9ae5-d41a19129fbf-00-ukt5cf453iwa.sisko.replit.dev
```

To change this, edit `capacitor.config.ts` → `server.url`.

## Build Steps

### 1. Install Node dependencies

```bash
npm install
```

### 2. Sync Capacitor

```bash
npx cap sync android
```

### 3. Open in Android Studio

```bash
npx cap open android
```

### 4. Build the APK

In Android Studio:
- **Debug APK**: Build → Build Bundle(s) / APK(s) → Build APK(s)
- **Release APK**: Build → Generate Signed Bundle / APK → APK (requires a keystore)

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

### 5. Install on device

```bash
# Enable USB debugging on your Android device, then:
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

Or drag the APK file to your phone.

## Signing for Distribution (Release APK)

1. Generate a keystore:
   ```bash
   keytool -genkey -v -keystore trading-terminal.jks -keyalg RSA -keysize 2048 -validity 10000 -alias trading
   ```

2. In Android Studio: Build → Generate Signed Bundle / APK → fill in keystore details

3. The signed APK at `android/app/build/outputs/apk/release/app-release.apk` can be installed on any Android 13+ device.

## App Features on Android

- Full trading terminal (Dashboard, Signals, Charts, Analysis, Options, Futures)
- Native status bar styling (dark)
- Splash screen with terminal branding
- Hardware back button navigation
- Pinch-to-zoom disabled (trading UI is fixed-scale)
- Auto-updates when server is updated (no APK reinstall needed)

## Notes

- All data comes from the deployed server — no offline mode
- Market data delayed 15-20 minutes (Yahoo Finance)
- Indian market hours: 9:15 AM – 3:30 PM IST
- AI signals require the server's OpenAI key to be configured
