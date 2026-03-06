const dotenv = require('dotenv');
dotenv.config();

const setEnv = () => {
  const fs = require('fs');
  const path = require('path');

  const targetDir = './src/environments';
  const targetPath = path.join(targetDir, 'environment.ts');

  // create directory if it doesn't exist
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const envConfigFile = `export const environment = {
    apiUrl: '${process.env['API_URL']}',
    socketUrl: '${process.env['SOCKET_URL']}',
    frontendUrl: '${process.env['FRONTEND_URL']}',
    dashboardUrl: '${process.env['DASHBOARD_URL']}',
    tenorApiKey: '${process.env['TENOR_API_KEY']}',
    maptilerApiKey: '${process.env['MAPTILER_API_KEY']}',
    unsplashApiKey: '${process.env['UNSPLASH_API_KEY']}',
    stripePublishableKey: '${process.env['STRIPE_PUBLISHABLE_KEY']}',
    firebaseConfig: {
      appId: '${process.env['FIREBASE_APP_ID']}',
      apiKey: '${process.env['FIREBASE_API_KEY']}',
      projectId: '${process.env['FIREBASE_PROJECT_ID']}',
      authDomain: '${process.env['FIREBASE_AUTH_DOMAIN']}',
      measurementId: '${process.env['FIREBASE_MEASUREMENT_ID']}',
      storageBucket: '${process.env['FIREBASE_STORAGE_BUCKET']}',
      messagingSenderId: '${process.env['FIREBASE_MESSAGING_SENDER_ID']}',
    }
  };
`;

  fs.writeFileSync(targetPath, envConfigFile, 'utf8');
  console.log(`Environment file generated at ${targetPath}`);
};

setEnv();
