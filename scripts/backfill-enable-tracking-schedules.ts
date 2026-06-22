import 'dotenv/config';
import { DEFAULT_GLOBAL_TRACKING_TIME, GLOBAL_TRACKING_TIMEZONE } from '../src/lib/trackingTime';
import {
  initializeFirebaseAdminFirestoreFromEnv,
  normalizeTrackingSchedule,
  type TrackingSchedule,
} from '../src/lib/backendTracking';

const APPLY = process.argv.includes('--apply');
const BATCH_SIZE = 200;

const DEFAULT_TRACKING_SCHEDULE: TrackingSchedule = {
  enabled: true,
  time: DEFAULT_GLOBAL_TRACKING_TIME,
  timezone: GLOBAL_TRACKING_TIMEZONE,
};

function schedulesEqual(
  current: Partial<TrackingSchedule> | undefined,
  next: TrackingSchedule,
) {
  return (
    current?.enabled === next.enabled &&
    current?.time === next.time &&
    current?.timezone === next.timezone &&
    current?.lastRunAt === next.lastRunAt &&
    current?.lastRunKey === next.lastRunKey
  );
}

async function main() {
  const db = initializeFirebaseAdminFirestoreFromEnv();
  const snapshot = await db.collection('users').get();

  let scanned = 0;
  let changed = 0;
  let unchanged = 0;
  const sampleUids: string[] = [];

  let batch = db.batch();
  let batchWrites = 0;

  for (const userDoc of snapshot.docs) {
    scanned += 1;
    const current = userDoc.data()?.trackingSchedule as Partial<TrackingSchedule> | undefined;
    const next = normalizeTrackingSchedule(current, DEFAULT_TRACKING_SCHEDULE);

    if (schedulesEqual(current, next)) {
      unchanged += 1;
      continue;
    }

    changed += 1;
    if (sampleUids.length < 20) {
      sampleUids.push(userDoc.id);
    }

    if (!APPLY) {
      continue;
    }

    batch.set(
      userDoc.ref,
      {
        trackingSchedule: next,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    batchWrites += 1;

    if (batchWrites >= BATCH_SIZE) {
      await batch.commit();
      batch = db.batch();
      batchWrites = 0;
    }
  }

  if (APPLY && batchWrites > 0) {
    await batch.commit();
  }

  console.log(
    JSON.stringify(
      {
        mode: APPLY ? 'apply' : 'dry-run',
        scanned,
        changed,
        unchanged,
        sampleUids,
      },
      null,
      2,
    ),
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
