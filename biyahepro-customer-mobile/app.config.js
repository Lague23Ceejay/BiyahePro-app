module.exports = {
  expo: {
    name: 'BiyahePro Customer',
    slug: 'biyahepro-customer',
    owner: 'monomy',
    version: '0.1.0',
    orientation: 'portrait',
    scheme: 'biyahepro',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.biyahepro.customer',
      config: {
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
          androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      ],
      '@react-native-community/datetimepicker',
    ],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      eas: {
        projectId: '6c3be8ab-0d3d-4f09-9f8c-f8aeccbd099f',
      },
    },
  },
};