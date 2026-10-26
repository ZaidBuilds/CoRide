import type { CapacitorConfig } from '@capacitor/cli';

// Local phone testing against a dev server over plain HTTP (e.g. http://192.168.1.5:4000):
//   CAP_CLEARTEXT=true npx cap sync android
// Never set it for a Play Store build.
const devHttp = process.env.CAP_CLEARTEXT === 'true';

const config: CapacitorConfig = {
  appId: 'com.zaidbuilds.coride',
  appName: 'CoRide',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: devHttp
  },
  android: {
    // The app runs on https://localhost, so calls to an http:// dev server are
    // "mixed content" and the WebView blocks them unless this is on.
    allowMixedContent: devHttp
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0C0E11'
    }
  }
};

export default config;
