import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.influcine.app',
  appName: 'Influcine',
  webDir: 'dist',
  backgroundColor: '#000000',
  plugins: {
    SplashScreen: {
      backgroundColor: '#000000',
      launchShowDuration: 2000,
      showSpinner: false,
    },
  }
};

export default config;
