import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeTrackingSchedule,
  shouldRunTrackingRefresh,
  type TrackingSchedule,
} from '../src/lib/backendTracking';
import {
  getDefaultTrackingSchedule,
  normalizeTrackingScheduleState,
} from '../src/features/tracking/model';

const fallback: TrackingSchedule = {
  enabled: true,
  time: '09:00',
  timezone: 'Asia/Kolkata',
};

test('shared schedule normalization always enables tracking and preserves timing metadata', () => {
  const normalized = normalizeTrackingSchedule(
    {
      enabled: false,
      time: '11:15',
      timezone: 'UTC',
      lastRunAt: '2026-06-21T03:30:00.000Z',
      lastRunKey: '2026-06-21T09:00',
    },
    fallback,
  );

  assert.deepEqual(normalized, {
    enabled: true,
    time: '11:15',
    timezone: 'UTC',
    lastRunAt: '2026-06-21T03:30:00.000Z',
    lastRunKey: '2026-06-21T09:00',
  });
});

test('shared schedule normalization defaults missing enabled to true', () => {
  const normalized = normalizeTrackingSchedule(undefined, fallback);

  assert.equal(normalized.enabled, true);
  assert.equal(normalized.time, '09:00');
  assert.equal(normalized.timezone, 'Asia/Kolkata');
});

test('tracking refresh eligibility requires tracked data and respects lastRunKey unless forced', () => {
  assert.equal(
    shouldRunTrackingRefresh({ lastRunKey: undefined }, { hasTrackedData: false, runKey: '2026-06-22T09:00' }),
    false,
  );
  assert.equal(
    shouldRunTrackingRefresh({ lastRunKey: '2026-06-22T09:00' }, { hasTrackedData: true, runKey: '2026-06-22T09:00' }),
    false,
  );
  assert.equal(
    shouldRunTrackingRefresh({ lastRunKey: '2026-06-22T09:00' }, { hasTrackedData: true, runKey: '2026-06-22T09:00', force: true }),
    true,
  );
  assert.equal(
    shouldRunTrackingRefresh({ lastRunKey: '2026-06-21T09:00' }, { hasTrackedData: true, runKey: '2026-06-22T09:00' }),
    true,
  );
});

test('frontend tracking schedule helpers also normalize to enabled', () => {
  assert.equal(getDefaultTrackingSchedule().enabled, true);

  const normalized = normalizeTrackingScheduleState({
    enabled: false,
    lastRunAt: '2026-06-21T03:30:00.000Z',
    lastRunKey: '2026-06-21T09:00',
  });

  assert.equal(normalized.enabled, true);
  assert.equal(normalized.lastRunAt, '2026-06-21T03:30:00.000Z');
  assert.equal(normalized.lastRunKey, '2026-06-21T09:00');
});
