import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getMessaging, type Messaging } from "firebase/messaging";

export type FirebaseClientConfig = FirebaseOptions & {
  firestoreDatabaseId?: string;
};

export type FirebasePublicConfigResponse = {
  config: FirebaseClientConfig | null;
  configured: boolean;
  missingKeys: string[];
};

export const REQUIRED_FIREBASE_CONFIG_KEYS = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
] as const;

export const RUNTIME_FIREBASE_ENV_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
] as const;

let firebaseApp: FirebaseApp | null = null;

export let auth!: Auth;
export let db!: Firestore;
export let messaging: Messaging | null = null;

export function getFirebaseConfigMissingKeys(
  config: Partial<FirebaseClientConfig> | null | undefined,
) {
  return REQUIRED_FIREBASE_CONFIG_KEYS.filter((key) => {
    const value = config?.[key];
    return typeof value !== "string" || value.trim().length === 0;
  });
}

export function isFirebaseConfigComplete(
  config: Partial<FirebaseClientConfig> | null | undefined,
): config is FirebaseClientConfig {
  return getFirebaseConfigMissingKeys(config).length === 0;
}

export function initializeFirebaseServices(config: FirebaseClientConfig) {
  if (!isFirebaseConfigComplete(config)) {
    throw new Error(
      `Missing required Firebase client config: ${getFirebaseConfigMissingKeys(config).join(", ")}.`,
    );
  }

  if (!firebaseApp) {
    firebaseApp =
      getApps()[0] ||
      initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
        measurementId: config.measurementId,
      });

    auth = getAuth(firebaseApp);
    db = config.firestoreDatabaseId
      ? getFirestore(firebaseApp, config.firestoreDatabaseId)
      : getFirestore(firebaseApp);

    messaging = null;
    if (typeof window !== "undefined") {
      try {
        messaging = getMessaging(firebaseApp);
      } catch (error) {
        console.warn(
          "Failed to initialize Firebase Messaging (may not be supported in this environment):",
          error,
        );
      }
    }
  }

  return {
    app: firebaseApp,
    auth,
    db,
    messaging,
  };
}
