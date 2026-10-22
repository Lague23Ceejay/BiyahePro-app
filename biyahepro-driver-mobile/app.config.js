const fs = require('node:fs');
const path = require('node:path');
const appIcon = fs.existsSync(path.join(__dirname, 'assets', 'app-icon.png'))
  ? './assets/app-icon.png'
  : undefined;

module.exports = {
  expo: {
    name: 'BiyahePro Driver',
    slug: 'biyahepro-driver',
    version: '0.1.0',
    orientation: 'portrait',
    scheme: 'biyahepro-driver',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    ...(appIcon ? { icon: appIcon } : {}),
    
    updates: {
      url: 'https://u.expo.dev/637f23ab-c183-42de-8103-27f2cb91b697',
      enabled: process.env.NODE_ENV !== 'development',
    },
    runtimeVersion: {
      policy: "appVersion"
    },

    ios: { supportsTablet: true, bundleIdentifier: 'com.biyahepro.driver', config: { googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY } },
    android: { package: 'com.biyahepro.driver', adaptiveIcon: { backgroundColor: '#F4F7F5', ...(appIcon ? { foregroundImage: appIcon } : {}) }, edgeToEdgeEnabled: true, config: { googleMaps: { apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY } } },
    web: { bundler: 'metro', output: 'single' },
    plugins: ['expo-router', 'expo-secure-store', ['react-native-maps', { androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY }]],
    experiments: { typedRoutes: true },
    extra: { eas: { projectId: '637f23ab-c183-42de-8103-27f2cb91b697' } },
  },
};
