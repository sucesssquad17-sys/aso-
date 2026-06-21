import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging, type Messaging } from 'firebase/messaging';
import firebaseAppletConfig from '../firebase-applet-config.json';

type FirebaseAppConfig = FirebaseOptions & {
  firestoreDatabaseId?: string;
};

type FirebaseJsonFallbackConfig = Pick<
  FirebaseAppConfig,
  'apiKey' | 'appId' | 'authDomain' | 'messagingSenderId' | 'projectId' | 'storageBucket'
>;

const REQUIRED_FIREBASE_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

export const firebaseConfigErrorDetails = (() => {
  const envConfig: FirebaseAppConfig = {
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

  const jsonConfig = firebaseAppletConfig as FirebaseJsonFallbackConfig;
  const fallbackConfig: FirebaseAppConfig = {
    apiKey: jsonConfig.apiKey?.trim(),
    authDomain: jsonConfig.authDomain?.trim(),
    projectId: jsonConfig.projectId?.trim(),
    storageBucket: jsonConfig.storageBucket?.trim(),
    messagingSenderId: jsonConfig.messagingSenderId?.trim(),
    appId: jsonConfig.appId?.trim(),
  };
  const config = REQUIRED_FIREBASE_ENV_KEYS.every((key) => {
    switch (key) {
      case 'VITE_FIREBASE_API_KEY':
        return Boolean(envConfig.apiKey);
      case 'VITE_FIREBASE_AUTH_DOMAIN':
        return Boolean(envConfig.authDomain);
      case 'VITE_FIREBASE_PROJECT_ID':
        return Boolean(envConfig.projectId);
      case 'VITE_FIREBASE_STORAGE_BUCKET':
        return Boolean(envConfig.storageBucket);
      case 'VITE_FIREBASE_MESSAGING_SENDER_ID':
        return Boolean(envConfig.messagingSenderId);
      case 'VITE_FIREBASE_APP_ID':
        return Boolean(envConfig.appId);
      default:
        return true;
    }
  })
    ? envConfig
    : {
        ...fallbackConfig,
        measurementId: envConfig.measurementId,
        firestoreDatabaseId: envConfig.firestoreDatabaseId,
      };

  const missingKeys = REQUIRED_FIREBASE_ENV_KEYS.filter((key) => {
    switch (key) {
      case 'VITE_FIREBASE_API_KEY':
        return !config.apiKey;
      case 'VITE_FIREBASE_AUTH_DOMAIN':
        return !config.authDomain;
      case 'VITE_FIREBASE_PROJECT_ID':
        return !config.projectId;
      case 'VITE_FIREBASE_STORAGE_BUCKET':
        return !config.storageBucket;
      case 'VITE_FIREBASE_MESSAGING_SENDER_ID':
        return !config.messagingSenderId;
      case 'VITE_FIREBASE_APP_ID':
        return !config.appId;
      default:
        return false;
    }
  });

  return {
    config,
    usingJsonFallback:
      missingKeys.length === 0 &&
      config.apiKey === fallbackConfig.apiKey &&
      config.appId === fallbackConfig.appId &&
      config.projectId === fallbackConfig.projectId,
    missingKeys,
  };
})();

export const firebaseConfigError =
  firebaseConfigErrorDetails.missingKeys.length > 0
    ? `Missing required Firebase client config from Vite env or firebase-applet-config.json: ${firebaseConfigErrorDetails.missingKeys.join(
        ', ',
      )}.`
    : null;

function readFirebaseConfig() {
  if (firebaseConfigError) {
    return {
      apiKey: 'missing-api-key',
      authDomain: 'missing-auth-domain',
      projectId: 'missing-project-id',
      storageBucket: 'missing-storage-bucket',
      messagingSenderId: 'missing-sender-id',
      appId: 'missing-app-id',
      firestoreDatabaseId:
        firebaseConfigErrorDetails.config.firestoreDatabaseId || undefined,
      measurementId: firebaseConfigErrorDetails.config.measurementId || undefined,
    } satisfies FirebaseAppConfig;
  }

  return firebaseConfigErrorDetails.config;
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
