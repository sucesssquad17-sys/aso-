import assert from "node:assert/strict";
import test from "node:test";
import {
  getAlertBatchEmailSubject,
  sendAlertEmailEvents,
} from "../src/lib/backendEmail";
import type { AlertEvent } from "../src/lib/alerts";

function createAlertEvent(
  overrides: Partial<AlertEvent>,
): AlertEvent {
  return {
    id: overrides.id || `evt-${Math.random().toString(36).slice(2, 8)}`,
    ruleId: overrides.ruleId || "rule-1",
    groupId: overrides.groupId || "group-1",
    appId: overrides.appId || "app-1",
    keyword: overrides.keyword || "hinge dating",
    store: overrides.store || "android",
    country: overrides.country || "us",
    eventType: overrides.eventType || "enter_top_n",
    scope: overrides.scope,
    previousRank: overrides.previousRank ?? 12,
    currentRank: overrides.currentRank ?? 4,
    threshold: overrides.threshold ?? 10,
    message: overrides.message || "Moved into top 10.",
    changedAppId: overrides.changedAppId,
    changedAppTitle: overrides.changedAppTitle,
    changedFields: overrides.changedFields,
    createdAt: overrides.createdAt || "2026-07-02T10:00:00.000Z",
    readAt: overrides.readAt,
  };
}

function createMockUserDocRef() {
  const updateCalls: Array<{
    collectionName: string;
    docId: string;
    patch: Record<string, unknown>;
  }> = [];

  return {
    ref: {
      id: "user-1",
      collection(collectionName: string) {
        return {
          doc(docId: string) {
            return {
              async update(patch: Record<string, unknown>) {
                updateCalls.push({ collectionName, docId, patch });
              },
            };
          },
        };
      },
    },
    updateCalls,
  };
}

test("batch subject keeps single-event style and uses combined multi-event subject", () => {
  assert.equal(
    getAlertBatchEmailSubject([createAlertEvent({ keyword: "instagram" })]),
    "Keyword alert: instagram",
  );
  assert.equal(
    getAlertBatchEmailSubject([
      createAlertEvent({ id: "evt-1" }),
      createAlertEvent({ id: "evt-2" }),
      createAlertEvent({ id: "evt-3" }),
    ]),
    "Rank Analyzer Pro: 3 alerts triggered",
  );
});

test("three alert events call resend once and mark all delivered", async () => {
  const { ref, updateCalls } = createMockUserDocRef();
  const sendCalls: Array<Record<string, unknown>> = [];
  const events = [
    createAlertEvent({ id: "evt-1", keyword: "hinge dating" }),
    createAlertEvent({
      id: "evt-2",
      scope: "competitor_aso",
      eventType: "aso_title_changed",
      keyword: "tinder",
      changedAppTitle: "Tinder",
      changedFields: ["title"],
      message: "Title changed.",
    }),
    createAlertEvent({ id: "evt-3", keyword: "dating app", eventType: "drop_by" }),
  ];

  await sendAlertEmailEvents(ref as never, events, {
    resend: {
      emails: {
        send: async (payload: Record<string, unknown>) => {
          sendCalls.push(payload);
          return { data: { id: "email-123" }, error: null };
        },
      },
    } as never,
    fromEmail: "alerts@rankanalyzerpro.com",
    dashboardUrl: "https://rankanalyzerpro.com",
    preferencesUrl: "https://rankanalyzerpro.com/settings",
    resolveRecipient: async () => "user@example.com",
  });

  assert.equal(sendCalls.length, 1);
  assert.equal(
    sendCalls[0].subject,
    "Rank Analyzer Pro: 3 alerts triggered",
  );
  assert.equal(
    sendCalls[0].from,
    "Rank Analyzer Pro <alerts@rankanalyzerpro.com>",
  );
  assert.match(String(sendCalls[0].text), /3 alerts triggered in your workspace\./);
  assert.match(String(sendCalls[0].text), /Alert type: Title Changed/);
  assert.match(String(sendCalls[0].text), /Manage alert email preferences:/);
  assert.match(String(sendCalls[0].html), /3 alerts triggered/);
  assert.match(String(sendCalls[0].html), /Alert type:/);
  assert.match(String(sendCalls[0].html), /Changed fields:/);
  assert.doesNotMatch(String(sendCalls[0].html), /Â·/);
  assert.equal(updateCalls.length, 3);
  for (const call of updateCalls) {
    assert.equal(call.collectionName, "alert_events");
    assert.equal(call.patch.emailDeliveryStatus, "delivered");
    assert.equal(call.patch.emailDeliveryRecipient, "user@example.com");
    assert.ok(call.patch.emailDeliveryAttemptedAt);
    assert.ok(call.patch.emailDeliveryDeliveredAt);
    assert.ok(Object.prototype.hasOwnProperty.call(call.patch, "emailDeliveryFailedAt"));
    assert.ok(Object.prototype.hasOwnProperty.call(call.patch, "emailDeliveryLastError"));
  }
});

test("all alert events are marked failed when resend returns an error", async () => {
  const { ref, updateCalls } = createMockUserDocRef();
  const events = [
    createAlertEvent({ id: "evt-1" }),
    createAlertEvent({ id: "evt-2" }),
    createAlertEvent({ id: "evt-3" }),
  ];

  await sendAlertEmailEvents(ref as never, events, {
    resend: {
      emails: {
        send: async () => ({
          data: null,
          error: { message: "provider-error" },
        }),
      },
    } as never,
    fromEmail: "alerts@rankanalyzerpro.com",
    dashboardUrl: "https://rankanalyzerpro.com",
    resolveRecipient: async () => "user@example.com",
  });

  assert.equal(updateCalls.length, 3);
  for (const call of updateCalls) {
    assert.equal(call.patch.emailDeliveryStatus, "failed");
    assert.equal(call.patch.emailDeliveryRecipient, "user@example.com");
    assert.equal(call.patch.emailDeliveryLastError, "provider-error");
    assert.ok(call.patch.emailDeliveryAttemptedAt);
    assert.ok(call.patch.emailDeliveryFailedAt);
  }
});

test("single-event behavior still uses the current subject style", async () => {
  const { ref, updateCalls } = createMockUserDocRef();
  const sendCalls: Array<Record<string, unknown>> = [];
  const event = createAlertEvent({
    id: "evt-1",
    keyword: "instagram",
    message: "Instagram entered top 10.",
  });

  await sendAlertEmailEvents(ref as never, [event], {
    resend: {
      emails: {
        send: async (payload: Record<string, unknown>) => {
          sendCalls.push(payload);
          return { data: { id: "email-456" }, error: null };
        },
      },
    } as never,
    fromEmail: "alerts@rankanalyzerpro.com",
    dashboardUrl: "https://rankanalyzerpro.com",
    resolveRecipient: async () => "user@example.com",
  });

  assert.equal(sendCalls.length, 1);
  assert.equal(sendCalls[0].subject, "Keyword alert: instagram");
  assert.match(String(sendCalls[0].text), /Instagram entered top 10\./);
  assert.match(String(sendCalls[0].text), /Open workspace: https:\/\/rankanalyzerpro\.com/);
  assert.match(String(sendCalls[0].html), /Instagram entered top 10\./);
  assert.equal(updateCalls.length, 1);
  assert.equal(updateCalls[0].patch.emailDeliveryStatus, "delivered");
});

test("sender email is trimmed before sending", async () => {
  const { ref } = createMockUserDocRef();
  const sendCalls: Array<Record<string, unknown>> = [];

  await sendAlertEmailEvents(ref as never, [createAlertEvent({ id: "evt-trim" })], {
    resend: {
      emails: {
        send: async (payload: Record<string, unknown>) => {
          sendCalls.push(payload);
          return { data: { id: "email-trim" }, error: null };
        },
      },
    } as never,
    fromEmail: "  ALERTS@rankanalyzerpro.com  ",
    dashboardUrl: "https://rankanalyzerpro.com",
    resolveRecipient: async () => "user@example.com",
  });

  assert.equal(sendCalls.length, 1);
  assert.equal(
    sendCalls[0].from,
    "Rank Analyzer Pro <ALERTS@rankanalyzerpro.com>",
  );
});
