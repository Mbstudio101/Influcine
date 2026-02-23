# TV Release Guide (Android TV + Fire TV)

This project already has Capacitor Android configured. Use these commands to build TV artifacts and publish.

## 1) One-time setup

1. Install Android Studio + Android SDK + Java 17.
2. Configure signing env vars for release builds:
   - `ANDROID_KEYSTORE`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`

If signing vars are missing, Gradle falls back to debug signing.

## 2) Build commands

### Debug APK (quick testing)

```bash
npm run tv:android:debug
npm run tv:artifacts
```

### Release APK + AAB (store distribution)

```bash
npm run tv:release
```

Artifacts are copied to:

- `release/tv/app-release.apk`
- `release/tv/app-release.aab`
- `release/tv/app-debug.apk` (if built)

## 3) Publish targets

## Google Play (Android TV)

1. Upload `release/tv/app-release.aab` to Play Console.
2. Add Android TV listing assets:
   - TV banner image
   - TV screenshots
3. Roll out to internal testing, then production.

## Amazon Appstore (Fire TV)

1. Upload `release/tv/app-release.apk` to Amazon Developer Console.
2. Mark Fire TV compatibility in device support.
3. Submit for review.

## 4) Recommended QA checklist

1. D-pad navigation works in Home, Details, Search, Player settings.
2. Select/Back/PlayPause hardware keys work.
3. Video playback and pause/resume work on at least 2 providers.
4. Subtitles and audio track switching works.
5. App starts from TV launcher and shows banner correctly.

