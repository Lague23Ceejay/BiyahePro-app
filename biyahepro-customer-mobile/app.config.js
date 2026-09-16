// File path in project: biyahepro-customer-mobile/app.config.js
//
// Replaces app.json. app.json is static JSON, so it cannot evaluate
// process.env — the old config had:
//   "androidGoogleMapsApiKey": "process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY"
// which passed that literal string to the native Google Maps SDK as the
// actual API key, causing every map tile request to fail auth and render
// as a solid black surface. app.config.js is real JavaScript, so
// process.env here is genuinely evaluated at config-read time.
module.exports = {
  expo: {
    name: 'BiyahePro Customer',
    slug: 'biyahepro-customer',
    version: '0.1.0',
    orientation: 'portrait',
    scheme: 'biyahepro',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.biyahepro.customer',
      config: {
        // Optional but recommended if you ever ship on iOS with
        // provider={PROVIDER_GOOGLE} instead of the default Apple Maps.
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    },
    android: {
      package: 'com.biyahepro.customer',
      adaptiveIcon: {
        backgroundColor: '#F4F7F5',
      },
      edgeToEdgeEnabled: true,
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
    },
    web: {
      bundler: 'metro',
      output: 'single',
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'Allow BiyahePro to use your location to set your pickup point.',
        },
      ],
      [
        'react-native-maps',
        {
          // This is what actually gets injected into AndroidManifest.xml /
          // Info.plist during `expo prebuild` / a custom dev build.
          androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      ],
      '@react-native-community/datetimepicker',
    ],
    experiments: {
      typedRoutes: true,
    },
  },
};