import assert from "node:assert/strict";
import {
  getGlobalTrackingRunKey,
  normalizeTrackingSchedule,
} from "../src/lib/backendTracking";
import {
  DEFAULT_GLOBAL_TRACKING_TIME,
  GLOBAL_TRACKING_TIMEZONE,
} from "../src/lib/trackingTime";

const fallbackSchedule = {
  enabled: true,
  time: DEFAULT_GLOBAL_TRACKING_TIME,
  timezone: GLOBAL_TRACKING_TIMEZONE,
};

const runInstant = new Date("2026-06-20T03:30:00.000Z");
assert.equal(
  getGlobalTrackingRunKey(runInstant),
  "2026-06-20T09:00",
  "Global run keys should resolve to 09:00 Asia/Kolkata.",
);

assert.deepEqual(
  normalizeTrackingSchedule(undefined, fallbackSchedule),
  {
    ...fallbackSchedule,
    lastRunAt: undefined,
    lastRunKey: undefined,
  },
  "Missing schedules should normalize to the shared fallback.",
);

assert.deepEqual(
  normalizeTrackingSchedule(
    {
      enabled: false,
      time: "",
      timezone: "",
    },
    fallbackSchedule,
  ),
  {
    enabled: false,
    time: DEFAULT_GLOBAL_TRACKING_TIME,
    timezone: GLOBAL_TRACKING_TIMEZONE,
    lastRunAt: undefined,
    lastRunKey: undefined,
  },
  "Invalid schedule timezones or times should fall back to shared defaults without forcing tracking back on.",
);

console.log(
  `Tracking timezone checks passed for ${GLOBAL_TRACKING_TIMEZONE} ${DEFAULT_GLOBAL_TRACKING_TIME}.`,
);
