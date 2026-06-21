import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

type FirebaseAppConfig = typeof firebaseConfig & {
  firestoreDatabaseId?: string;
};

const typedFirebaseConfig: FirebaseAppConfig = firebaseConfig;
const app = initializeApp(typedFirebaseConfig);

// App Check is intentionally disabled until a valid reCAPTCHA Enterprise site key is configured.
// To enable it: install firebase/app-check, get a key from Firebase console -> App Check,
// then replace this comment block with initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider('YOUR_KEY'), ... });

export const auth = getAuth(app);
export const db = typedFirebaseConfig.firestoreDatabaseId
  ? getFirestore(app, typedFirebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

let messagingInstance;
try {
  messagingInstance = getMessaging(app);
} catch (e) {
  console.warn('Failed to initialize Firebase Messaging (may not be supported in this environment):', e);
}
export const messaging = messagingInstance;
