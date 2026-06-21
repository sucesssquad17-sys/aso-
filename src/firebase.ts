import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, type Messaging } from 'firebase/messaging';

type FirebaseAppConfig = FirebaseOptions & {
  firestoreDatabaseId?: string;
};

function readFirebaseConfig() {
  const config: FirebaseAppConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
    appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim() || undefined,
    firestoreDatabaseId:
      import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID?.trim() || undefined,
  };

  const missingKeys = [
    ['VITE_FIREBASE_API_KEY', config.apiKey],
    ['VITE_FIREBASE_AUTH_DOMAIN', config.authDomain],
    ['VITE_FIREBASE_PROJECT_ID', config.projectId],
    ['VITE_FIREBASE_STORAGE_BUCKET', config.storageBucket],
    ['VITE_FIREBASE_MESSAGING_SENDER_ID', config.messagingSenderId],
    ['VITE_FIREBASE_APP_ID', config.appId],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length) {
    throw new Error(
      `Missing required Firebase client config: ${missingKeys.join(
        ', ',
      )}. Add them to your Vite environment before loading the app.`,
    );
  }

  return config;
}

const typedFirebaseConfig = readFirebaseConfig();
const app = initializeApp(typedFirebaseConfig);

// App Check is intentionally disabled until a valid reCAPTCHA Enterprise site key is configured.
// To enable it: install firebase/app-check, get a key from Firebase console -> App Check,
// then replace this comment block with initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider('YOUR_KEY'), ... });

export const auth = getAuth(app);
export const db = typedFirebaseConfig.firestoreDatabaseId
  ? getFirestore(app, typedFirebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

let messagingInstance: Messaging | null = null;
if (typeof window !== 'undefined') {
  try {
    messagingInstance = getMessaging(app);
  } catch (e) {
    console.warn(
      'Failed to initialize Firebase Messaging (may not be supported in this environment):',
      e,
    );
  }
}
export const messaging = messagingInstance;
