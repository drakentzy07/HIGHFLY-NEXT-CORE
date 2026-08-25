import type { CapacitorConfig } from '@capacitor/cli';

// HIGHFLY owns the native wrapper. ClaudeCraft is only the embedded engine.
// Never inherit the upstream OTA endpoint or native product identity.
const config: CapacitorConfig = {
  appId: 'com.highfly.nexus',
  appName: 'HIGHFLY',
  webDir: 'dist',
  server: {
    androidScheme: 'http',
  },
  ios: {
    contentInset: 'never',
  },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: false,
      statsUrl: '',
    },
  },
};

export default config;
