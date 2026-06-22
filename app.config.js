import 'dotenv/config';

export default {
  expo: {
    name: 'NativeMVP',
    slug: 'native-mvp',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'nativemvp',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash-icon.png',   // file jo actually exists hai
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: true,
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        backgroundColor: '#E6F4FE',
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      safePayBaseUrl: process.env.SAFE_PAY_BASE_URL || 'https://sandbox.api.getsafepay.com',
    },
  },
};
