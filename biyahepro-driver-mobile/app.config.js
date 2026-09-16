module.exports = {
  expo: {
    name: 'BiyahePro Driver',
    slug: 'biyahepro-driver',
    version: '0.1.0',
    orientation: 'portrait',
    scheme: 'biyahepro-driver',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    ios: { supportsTablet: true, bundleIdentifier: 'com.biyahepro.driver' },
    android: { package: 'com.biyahepro.driver', adaptiveIcon: { backgroundColor: '#F4F7F5' }, edgeToEdgeEnabled: true },
    web: { bundler: 'metro', output: 'single' },
    plugins: ['expo-router', 'expo-secure-store'],
    experiments: { typedRoutes: true },
  },
};
