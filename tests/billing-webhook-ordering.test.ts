import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveBillingWebhookOccurredAt,
  shouldSkipIncomingBillingTransition,
} from "../src/lib/billingWebhookOrdering";

test("payload event timestamp takes precedence over webhook sent timestamp", () => {
  const resolved = resolveBillingWebhookOccurredAt(
    "2026-07-16T09:00:00.000Z",
    "1763260200",
    new Date("2026-07-16T12:00:00.000Z"),
  );

  assert.equal(resolved.iso, "2026-07-16T09:00:00.000Z");
  assert.equal(resolved.source, "payload_event");
});

test("webhook header timestamp is used when payload event timestamp is missing", () => {
  const resolved = resolveBillingWebhookOccurredAt(
    null,
    "1763260200",
    new Date("2026-07-16T12:00:00.000Z"),
  );

  assert.equal(resolved.iso, "2025-11-16T02:30:00.000Z");
  assert.equal(resolved.source, "webhook_sent");
});

test("older incoming events are skipped", () => {
  assert.equal(
    shouldSkipIncomingBillingTransition({
      existingUpdatedAt: "2026-07-16T10:00:00.000Z",
      incomingOccurredAtMs: Date.parse("2026-07-16T09:00:00.000Z"),
      incomingTimeSource: "payload_event",
      existingHasPaidAccess: true,
      incomingHasPaidAccess: false,
    }),
    true,
  );
});

test("equal-time destructive transitions are skipped", () => {
  assert.equal(
    shouldSkipIncomingBillingTransition({
      existingUpdatedAt: "2026-07-16T10:00:00.000Z",
      incomingOccurredAtMs: Date.parse("2026-07-16T10:00:00.000Z"),
      incomingTimeSource: "payload_event",
      existingHasPaidAccess: true,
      incomingHasPaidAccess: false,
      existingCurrentPeriodEnd: "2026-07-20T00:00:00.000Z",
      incomingCurrentPeriodEnd: "2026-07-18T00:00:00.000Z",
    }),
    true,
  );
});

test("equal-time non-destructive upgrades are allowed", () => {
  assert.equal(
    shouldSkipIncomingBillingTransition({
      existingUpdatedAt: "2026-07-16T10:00:00.000Z",
      incomingOccurredAtMs: Date.parse("2026-07-16T10:00:00.000Z"),
      incomingTimeSource: "payload_event",
      existingHasPaidAccess: false,
      incomingHasPaidAccess: true,
      incomingCurrentPeriodEnd: "2026-08-16T00:00:00.000Z",
    }),
    false,
  );
});
