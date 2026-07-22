import "dotenv/config";

import { initializeFirebaseAdminFirestoreFromEnv } from "../src/lib/backendTracking";

const APPLY = process.argv.includes("--apply");
const BATCH_SIZE = 200;

async function main() {
  const db = initializeFirebaseAdminFirestoreFromEnv();
  const snapshot = await db.collection("users").get();
  const updatedAt = new Date().toISOString();
  let scanned = 0;
  let changed = 0;
  let batch = db.batch();
  let batchWrites = 0;

  for (const userDoc of snapshot.docs) {
    scanned += 1;
    if (typeof userDoc.data().announcementEmailsEnabled === "boolean") continue;
    changed += 1;
    if (!APPLY) continue;

    batch.set(userDoc.ref, {
      announcementEmailsEnabled: false,
      announcementEmailsUpdatedAt: updatedAt,
      announcementEmailsPreferenceSource: "missing-preference-migration",
      updatedAt,
    }, { merge: true });
    batchWrites += 1;

    if (batchWrites >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchWrites = 0;
    }
  }

  if (APPLY && batchWrites > 0) await batch.commit();
  console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", scanned, changed }, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
