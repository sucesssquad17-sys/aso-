export type BillingWebhookTimeSource =
  | "payload_event"
  | "webhook_sent"
  | "fallback_now";

function parseIsoMs(value?: string | null): number | null {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseWebhookHeaderMs(value?: string | null): number | null {
  if (!value) {
    return null;
  }
  const numericTimestamp = Number(value);
  if (Number.isFinite(numericTimestamp)) {
    return numericTimestamp > 1_000_000_000_000
      ? numericTimestamp
      : numericTimestamp * 1000;
  }
  return parseIsoMs(value);
}

export function resolveBillingWebhookOccurredAt(
  eventTimestamp?: string | null,
  webhookTimestamp?: string | null,
  fallbackNow: Date = new Date(),
) {
  const eventMs = parseIsoMs(eventTimestamp);
  if (eventMs !== null) {
    return {
      iso: new Date(eventMs).toISOString(),
      ms: eventMs,
      source: "payload_event" as const,
    };
  }

  const headerMs = parseWebhookHeaderMs(webhookTimestamp);
  if (headerMs !== null) {
    return {
      iso: new Date(headerMs).toISOString(),
      ms: headerMs,
      source: "webhook_sent" as const,
    };
  }

  return {
    iso: fallbackNow.toISOString(),
    ms: fallbackNow.getTime(),
    source: "fallback_now" as const,
  };
}

export function shouldSkipIncomingBillingTransition(input: {
  existingUpdatedAt?: string | null;
  existingWebhookId?: string | null;
  incomingWebhookId?: string | null;
  incomingOccurredAtMs: number;
  incomingTimeSource: BillingWebhookTimeSource;
  existingHasPaidAccess: boolean;
  incomingHasPaidAccess: boolean;
  existingCurrentPeriodEnd?: string | null;
  incomingCurrentPeriodEnd?: string | null;
}) {
  const existingUpdatedAtMs = parseIsoMs(input.existingUpdatedAt);
  if (existingUpdatedAtMs === null) {
    return false;
  }

  if (input.incomingOccurredAtMs < existingUpdatedAtMs) {
    return true;
  }

  if (input.incomingOccurredAtMs > existingUpdatedAtMs) {
    return false;
  }

  if (
    input.existingWebhookId &&
    input.incomingWebhookId &&
    input.existingWebhookId === input.incomingWebhookId
  ) {
    return true;
  }

  const existingCurrentPeriodEndMs = parseIsoMs(input.existingCurrentPeriodEnd);
  const incomingCurrentPeriodEndMs = parseIsoMs(input.incomingCurrentPeriodEnd);
  const removesPaidAccess =
    input.existingHasPaidAccess && !input.incomingHasPaidAccess;
  const shortensPaidWindow =
    input.existingHasPaidAccess &&
    input.incomingHasPaidAccess &&
    existingCurrentPeriodEndMs !== null &&
    incomingCurrentPeriodEndMs !== null &&
    incomingCurrentPeriodEndMs < existingCurrentPeriodEndMs;

  if (removesPaidAccess || shortensPaidWindow) {
    return true;
  }

  if (input.incomingTimeSource !== "payload_event" && !input.incomingHasPaidAccess) {
    return true;
  }

  return false;
}
