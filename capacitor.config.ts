import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appName: 'Get Networked',
  webDir: 'dist/browser',
  appId: 'app.networked.ai',
  android: {
    allowMixedContent: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    FirebaseAuthentication: {
      skipNativeAuth: false,
      authDomain: 'app.net-worked.ai',
      providers: ['google.com', 'apple.com', 'phone', 'facebook.com']
    },
    CapacitorUpdater: {
      autoUpdate: false,
      autoDeletePrevious: true,
      updateUrl: 'https://github.com/freelancework00700/networked-ai/releases/latest/download/build.zip'
    }
  }
};

export default config;
