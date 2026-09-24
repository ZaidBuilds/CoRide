import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.coride.delhimetro',
  appName: 'CoRide',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // Plain HTTP only for local device testing: CAP_CLEARTEXT=true npx cap sync
    cleartext: process.env.CAP_CLEARTEXT === 'true'
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
