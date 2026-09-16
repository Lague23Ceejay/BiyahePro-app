module.exports = {
  expo: {
    name: 'BiyahePro Driver',
    slug: 'biyahepro-driver',
    version: '0.1.0',
    orientation: 'portrait',
    scheme: 'biyahepro-driver',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    ios: { supportsTablet: true, bundleIdentifier: 'com.biyahepro.driver', config: { googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY } },
    android: { package: 'com.biyahepro.driver', adaptiveIcon: { backgroundColor: '#F4F7F5' }, edgeToEdgeEnabled: true, config: { googleMaps: { apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY } } },
    web: { bundler: 'metro', output: 'single' },
    plugins: ['expo-router', 'expo-secure-store', ['react-native-maps', { androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY }]],
    experiments: { typedRoutes: true },
  },
};
