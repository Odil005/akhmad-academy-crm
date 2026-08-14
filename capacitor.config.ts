type CapacitorConfig = {
  appId: string;
  appName: string;
  webDir: string;
  server: { url: string; cleartext: boolean };
  android: { allowMixedContent: boolean };
};

// Android wrapper configuration. The native `android/` folder is generated
// only on the release computer after Vercel deployment is live.
const config: CapacitorConfig = {
  appId: "uz.unicrm.academy",
  appName: "UNICRM Academy",
  webDir: ".output/public",
  server: {
    // Replace this with the final Vercel domain before generating Android.
    url: process.env.CAPACITOR_SERVER_URL || "https://your-project.vercel.app",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
