import type { ExpoConfig } from 'expo/config';

// Plain HTTP to a dev API (e.g. http://10.0.2.2:8787 from the emulator) is only allowed outside production builds.
const isProduction = process.env.EAS_BUILD_PROFILE === 'production';

const config: ExpoConfig = {
  name: 'Subscribed',
  slug: 'subscribed',
  version: '0.1.0',
  scheme: 'subscribed',
  orientation: 'default',
  userInterfaceStyle: 'automatic',
  android: {
    package: 'com.subscribedyoutube.app',
  },
  plugins: [
    'expo-secure-store',
    ['expo-build-properties', { android: { usesCleartextTraffic: !isProduction } }],
  ],
};

export default config;
