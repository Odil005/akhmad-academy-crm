# Akhmad Academy mobile apps (Android)

Two Capacitor 7 wrappers around the live site:

| App | Folder | Package | Opens |
| --- | --- | --- | --- |
| Akhmad CRM (staff) | `staff/` | `life.akhmadacademy.crm` | https://akhmadacademy.life/dashboard |
| Akhmad Ota-ona (parents) | `parent/` | `life.akhmadacademy.parent` | https://akhmadacademy.life/ota-ona |

The apps load the published site, so web changes reach phones after publishing — no new APK needed.
iPhone users install the same pages with Safari → Share → Add to Home Screen (`/ilova` explains it).

## Build

Requires JDK 21 and the Android SDK (platform 35, build-tools 35).

```bash
cd mobile/staff && bun install && npx cap sync android && cd android && ./gradlew assembleRelease bundleRelease
```

Sign with the release keystores (kept outside Git, in Files → mobil-ilova/kalitlar):

```bash
zipalign -p 4 app-release-unsigned.apk aligned.apk
apksigner sign --ks staff-release.jks --ks-key-alias staff --out akhmad-crm.apk aligned.apk
jarsigner -keystore staff-release.jks app-release.aab staff   # Play Market bundle
```

For every Play Market update bump `versionCode` / `versionName` in `*/android/app/build.gradle`.
