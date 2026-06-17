import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.planflow.dailytracker',
  appName: 'Planflow',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['google.com'],
    },
    LocalNotifications: {
      smallIcon: 'ic_notification',
      iconColor: '#1e3a8a',
    },
  },
};

export default config;
