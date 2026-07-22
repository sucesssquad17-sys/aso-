import 'dotenv/config';
import { DEFAULT_GLOBAL_TRACKING_TIME, GLOBAL_TRACKING_TIMEZONE } from '../src/lib/trackingTime';
import {
  initializeFirebaseAdminFirestoreFromEnv,
  normalizeTrackingSchedule,
  type TrackingSchedule,
} from '../src/lib/backendTracking';
import { getTrackingScheduleBackfillReason } from '../src/lib/trackingScheduleMigration';

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
  let skippedDeleted = 0;
  let skippedExplicitPreference = 0;
  let skippedNoTrackedData = 0;
  let skippedIneligiblePlan = 0;
  const sampleUids: string[] = [];

  let batch = db.batch();
  let batchWrites = 0;

  for (const userDoc of snapshot.docs) {
    scanned += 1;
    const data = userDoc.data();
    const current = data?.trackingSchedule as Partial<TrackingSchedule> | undefined;
    const reason = getTrackingScheduleBackfillReason(data);
    if (reason !== 'eligible') {
      if (reason === 'deleted') skippedDeleted += 1;
      if (reason === 'explicit_preference') skippedExplicitPreference += 1;
      if (reason === 'no_tracked_data') skippedNoTrackedData += 1;
      if (reason === 'ineligible_plan') skippedIneligiblePlan += 1;
      continue;
    }

    const next = {
      ...normalizeTrackingSchedule(current, DEFAULT_TRACKING_SCHEDULE),
      enabled: true,
    } satisfies TrackingSchedule;

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
        skippedDeleted,
        skippedExplicitPreference,
        skippedNoTrackedData,
        skippedIneligiblePlan,
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
