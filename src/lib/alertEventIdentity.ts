import crypto from "crypto";

import type { AlertConditionType } from "./alerts";

function hashAlertIdentity(parts: Record<string, string>) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(parts))
    .digest("hex")
    .slice(0, 40);
}

export function buildAlertEventId(input: {
  runKey: string;
  ruleId: string;
  groupId?: string;
  appId: string;
  keyword: string;
  store: string;
  country: string;
  eventType: AlertConditionType;
  threshold: number | null;
}) {
  const hash = hashAlertIdentity({
    kind: "keyword",
    runKey: input.runKey,
    ruleId: input.ruleId,
    groupId: input.groupId || "",
    appId: input.appId,
    keyword: input.keyword.trim().toLowerCase(),
    store: input.store,
    country: input.country.trim().toLowerCase(),
    eventType: input.eventType,
    threshold: String(input.threshold ?? 0),
  });
  return `alert:${hash}`;
}

export function buildCompetitorAsoAlertEventId(input: {
  runKey: string;
  ruleId: string;
  groupId: string;
  appId: string;
  keyword: string;
  store: string;
  country: string;
  eventType: AlertConditionType;
  asoDiffId: string;
}) {
  const hash = hashAlertIdentity({
    kind: "competitor_aso",
    runKey: input.runKey,
    ruleId: input.ruleId,
    groupId: input.groupId,
    appId: input.appId,
    keyword: input.keyword.trim().toLowerCase(),
    store: input.store,
    country: input.country.trim().toLowerCase(),
    eventType: input.eventType,
    asoDiffId: input.asoDiffId,
  });
  return `alert:${hash}`;
}
