import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.highfly.nexus',
  appName: 'HIGHFLY',
  webDir: 'dist',
  server: { androidScheme: 'http' },
  ios: { contentInset: 'never' },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: false,
      statsUrl: '',
    },
  },
};

export default config;
