require('dotenv').config();
const { initializeApp: initializeAdminApp, getApps, applicationDefault, cert } = require('firebase-admin/app');
const { getAuth: getAdminAuth } = require('firebase-admin/auth');

function getFirebaseAdminApp() {
  const existingApp = getApps()[0];
  if (existingApp) {
    return existingApp;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    console.warn('FIREBASE_SERVICE_ACCOUNT_JSON is not set.');
    return null;
  }

  let cleanJsonStr = serviceAccountJson.trim();
  if (
    (cleanJsonStr.startsWith("'") && cleanJsonStr.endsWith("'")) ||
    (cleanJsonStr.startsWith('"') && cleanJsonStr.endsWith('"'))
  ) {
    cleanJsonStr = cleanJsonStr.slice(1, -1);
  }

  try {
    const app = initializeAdminApp({
      credential: cert(JSON.parse(cleanJsonStr)),
    });
    console.info('Successfully initialized Firebase Admin.');
    return app;
  } catch (parseError) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', parseError);
    return null;
  }
}

async function test() {
  const app = getFirebaseAdminApp();
  if (!app) {
    console.log("App failed to initialize.");
    process.exit(1);
  }
  const auth = getAdminAuth(app);
  try {
    const list = await auth.listUsers(1);
    console.log("Successfully fetched users, count:", list.users.length);
  } catch (e) {
    console.error("Auth error:", e);
  }
  process.exit(0);
}

test();
