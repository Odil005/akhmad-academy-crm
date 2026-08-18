type CapacitorConfig = {
  appId: string;
  appName: string;
  webDir: string;
  server: { url: string; cleartext: boolean };
  android: { allowMixedContent: boolean };
  ios: { contentInset: string };
};

// Native wrapper configuration for Google Play and the App Store.
// The native `android/` and `ios/` folders are generated on the release
// computer after the production domain is live.
const config: CapacitorConfig = {
  appId: "uz.akhmadacademy.crm",
  appName: "Akhmad Academy",
  webDir: ".output/public",
  server: {
    url: process.env.CAPACITOR_SERVER_URL || "https://akhmadacademy.life",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
