import 'dotenv/config';

export default {
  expo: {
    name: 'NativeMVP',
    slug: 'native-mvp',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    updates: {
      fallbackToCacheTimeout: 0,
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundColor: '#E6F4FE',
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      backendUrl: process.env.REACT_NATIVE_API_URL || 'http://192.168.18.2:3000',
      safePayBaseUrl: process.env.SAFE_PAY_BASE_URL || 'https://sandbox.api.getsafepay.com',
    },
  },
};