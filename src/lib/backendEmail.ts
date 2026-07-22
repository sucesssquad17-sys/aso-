import { ALERT_CONDITION_LABELS, type AlertEvent } from "./alerts";
import { GLOBAL_TRACKING_TIMEZONE } from "./trackingTime";
import {
  formatWeeklyReportRangeLabel,
  getWeeklyReportDateStamp,
  type WeeklyReportWeekday,
} from "./weeklyReports";
import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
} from "firebase-admin/firestore";
import type { Resend } from "resend";
import type { EmailRecipientResolution } from "./backendEmailRecipients";

type ResendSendResult = Awaited<ReturnType<Resend["emails"]["send"]>>;

export function normalizeEmailAddress(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function escapeEmailHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatEmailTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  const primaryTime = date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: GLOBAL_TRACKING_TIMEZONE,
  });
  const utcTime = date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
  return `${primaryTime} ${GLOBAL_TRACKING_TIMEZONE} (${utcTime} UTC)`;
}

export function getResendEmailId(result: ResendSendResult | null | undefined) {
  const candidate = result?.data && typeof result.data === "object" ? result.data.id : null;
  if (typeof candidate !== "string") {
    return null;
  }
  const normalized = candidate.trim();
  return normalized.length > 0 ? normalized : null;
}

export function getSafeAppUrl(
  rawAppUrl: string | null | undefined,
  fallbackAppUrl = "https://rankanalyzerpro.com",
) {
  const normalizedRaw = typeof rawAppUrl === "string" ? rawAppUrl.trim() : "";
  try {
    return new URL(normalizedRaw || fallbackAppUrl).toString();
  } catch {
    return fallbackAppUrl;
  }
}

function formatAlertChangedFieldLabel(field: string) {
  switch (field) {
    case "title":
      return "Title";
    case "description":
      return "Description";
    case "screenshots":
      return "Screenshots";
    case "icon":
      return "Icon";
    case "category":
      return "Category";
    default:
      return field;
  }
}

export function getAlertEmailSubject(event: AlertEvent) {
  return event.scope === "competitor_aso"
    ? `Competitor ASO alert: ${event.changedAppTitle || event.keyword}`
    : `Keyword alert: ${event.keyword}`;
}

export function getAlertBatchEmailSubject(events: AlertEvent[]) {
  if (events.length === 1) {
    return getAlertEmailSubject(events[0]);
  }
  return `Rank Analyzer Pro: ${events.length} alerts triggered`;
}

export function buildAlertEmailHtml(
  event: AlertEvent,
  dashboardUrl: string,
  preferencesUrl?: string,
) {
  const storeLabel = event.store === "ios" ? "iOS" : "Android";
  const changedFields =
    Array.isArray(event.changedFields) && event.changedFields.length
      ? event.changedFields
          .map((field) => formatAlertChangedFieldLabel(field))
          .join(", ")
      : null;
  const heading =
    event.scope === "competitor_aso"
      ? escapeEmailHtml(event.changedAppTitle || event.keyword)
      : escapeEmailHtml(event.keyword);

  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #0f172a;">
      <h2 style="margin: 0 0 12px; font-size: 22px;">${escapeEmailHtml(getAlertEmailSubject(event))}</h2>
      <p style="margin: 0 0 18px; color: #334155;">${escapeEmailHtml(event.message)}</p>
      <div style="border: 1px solid #cbd5e1; border-radius: 12px; background: #f8fafc; padding: 18px;">
        <p style="margin: 0 0 8px;"><strong>Target:</strong> ${heading}</p>
        <p style="margin: 0 0 8px;"><strong>Store:</strong> ${storeLabel}</p>
        <p style="margin: 0 0 8px;"><strong>Country:</strong> ${escapeEmailHtml(event.country.toUpperCase())}</p>
        <p style="margin: 0 0 8px;"><strong>Triggered:</strong> ${escapeEmailHtml(formatEmailTimestamp(event.createdAt))}</p>
        ${changedFields ? `<p style="margin: 0;"><strong>Changed fields:</strong> ${escapeEmailHtml(changedFields)}</p>` : ""}
      </div>
      <a href="${escapeEmailHtml(dashboardUrl)}" style="display: inline-block; margin-top: 20px; padding: 12px 20px; border-radius: 10px; background: #06b6d4; color: #082f49; text-decoration: none; font-weight: 700;">
        Open Workspace
      </a>
      ${preferencesUrl
        ? `<p style="margin: 18px 0 0; color: #64748b; font-size: 13px;"><a href="${escapeEmailHtml(preferencesUrl)}" style="color: #0f766e; text-decoration: underline;">Manage alert email preferences</a></p>`
        : ""}
    </div>
  `;
}

export function buildAlertBatchEmailHtml(
  events: AlertEvent[],
  dashboardUrl: string,
  preferencesUrl?: string,
) {
  const rows = events
    .slice()
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    )
    .map((event) => {
      const scopeLabel =
        event.scope === "competitor_aso" ? "Competitor ASO" : "Keyword";
      const heading =
        event.scope === "competitor_aso"
          ? event.changedAppTitle || event.keyword
          : event.keyword;
      const changedFields =
        Array.isArray(event.changedFields) && event.changedFields.length
          ? event.changedFields
              .map((field) => formatAlertChangedFieldLabel(field))
              .join(", ")
          : null;
      return `
        <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; background: #ffffff;">
          <div style="display: flex; justify-content: space-between; gap: 12px; align-items: baseline;">
            <strong style="color: #0f172a;">${escapeEmailHtml(heading)}</strong>
            <span style="color: #64748b; font-size: 12px;">${escapeEmailHtml(formatEmailTimestamp(event.createdAt))}</span>
          </div>
          <div style="margin-top: 6px; color: #334155; font-size: 13px; line-height: 1.55;">
            <div><strong>Scope:</strong> ${escapeEmailHtml(scopeLabel)}</div>
            <div><strong>Alert type:</strong> ${escapeEmailHtml(ALERT_CONDITION_LABELS[event.eventType])}</div>
            <div><strong>Store:</strong> ${escapeEmailHtml(event.store === "ios" ? "iOS" : "Android")}</div>
            <div><strong>Country:</strong> ${escapeEmailHtml(event.country.toUpperCase())}</div>
            <div style="margin-top: 4px;">${escapeEmailHtml(event.message)}</div>
            ${changedFields ? `<div style="margin-top: 4px;"><strong>Changed fields:</strong> ${escapeEmailHtml(changedFields)}</div>` : ""}
          </div>
        </div>
      `;
    })
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; color: #0f172a;">
      <h2 style="margin: 0 0 12px; font-size: 22px;">${escapeEmailHtml(getAlertBatchEmailSubject(events))}</h2>
      <p style="margin: 0 0 18px; color: #334155;">${escapeEmailHtml(`${events.length} alerts triggered`)}</p>
      <div style="display: grid; gap: 10px;">${rows}</div>
      <a href="${escapeEmailHtml(dashboardUrl)}" style="display: inline-block; margin-top: 20px; padding: 12px 20px; border-radius: 10px; background: #06b6d4; color: #082f49; text-decoration: none; font-weight: 700;">
        Open Workspace
      </a>
      ${preferencesUrl
        ? `<p style="margin: 18px 0 0; color: #64748b; font-size: 13px;"><a href="${escapeEmailHtml(preferencesUrl)}" style="color: #0f766e; text-decoration: underline;">Manage alert email preferences</a></p>`
        : ""}
    </div>
  `;
}

export function buildAlertEmailText(
  event: AlertEvent,
  dashboardUrl: string,
  preferencesUrl?: string,
) {
  const storeLabel = event.store === "ios" ? "iOS" : "Android";
  const changedFields =
    Array.isArray(event.changedFields) && event.changedFields.length
      ? event.changedFields
          .map((field) => formatAlertChangedFieldLabel(field))
          .join(", ")
      : null;
  const heading =
    event.scope === "competitor_aso"
      ? event.changedAppTitle || event.keyword
      : event.keyword;

  return [
    getAlertEmailSubject(event),
    "",
    event.message,
    `Target: ${heading}`,
    `Store: ${storeLabel}`,
    `Country: ${event.country.toUpperCase()}`,
    `Triggered: ${formatEmailTimestamp(event.createdAt)}`,
    ...(changedFields ? [`Changed fields: ${changedFields}`] : []),
    "",
    `Open workspace: ${dashboardUrl}`,
    ...(preferencesUrl
      ? [`Manage alert email preferences: ${preferencesUrl}`]
      : []),
  ].join("\n");
}

export function buildAlertBatchEmailText(
  events: AlertEvent[],
  dashboardUrl: string,
  preferencesUrl?: string,
) {
  const rows = events
    .slice()
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    )
    .map((event) => {
      const scopeLabel =
        event.scope === "competitor_aso" ? "Competitor ASO" : "Keyword";
      const heading =
        event.scope === "competitor_aso"
          ? event.changedAppTitle || event.keyword
          : event.keyword;
      const changedFields =
        Array.isArray(event.changedFields) && event.changedFields.length
          ? event.changedFields
              .map((field) => formatAlertChangedFieldLabel(field))
              .join(", ")
          : null;
      return [
        `- ${heading}`,
        `  Scope: ${scopeLabel}`,
        `  Alert type: ${ALERT_CONDITION_LABELS[event.eventType]}`,
        `  Store: ${event.store === "ios" ? "iOS" : "Android"}`,
        `  Country: ${event.country.toUpperCase()}`,
        `  Triggered: ${formatEmailTimestamp(event.createdAt)}`,
        `  Message: ${event.message}`,
        ...(changedFields ? [`  Changed fields: ${changedFields}`] : []),
      ].join("\n");
    })
    .join("\n\n");

  return [
    getAlertBatchEmailSubject(events),
    "",
    events.length === 1
      ? "One alert triggered in your workspace."
      : `${events.length} alerts triggered in your workspace.`,
    "",
    rows,
    "",
    `Open workspace: ${dashboardUrl}`,
    ...(preferencesUrl
      ? [`Manage alert email preferences: ${preferencesUrl}`]
      : []),
  ].join("\n");
}

async function updateAlertEmailStatus(
  userDocRef: DocumentReference<DocumentData>,
  event: AlertEvent,
  patch: DocumentData,
) {
  try {
    await userDocRef.collection("alert_events").doc(event.id).update(patch);
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
    if (code === 5 || code === "not-found") {
      return;
    }
    console.warn(`[email] Failed to persist delivery status for alert ${event.id}`, error);
  }
}

export async function updateAlertEmailStatuses(
  userDocRef: DocumentReference<DocumentData>,
  events: AlertEvent[],
  patchFactory: (event: AlertEvent) => DocumentData,
) {
  await Promise.all(
    events.map((event) =>
      updateAlertEmailStatus(userDocRef, event, patchFactory(event)),
    ),
  );
}

export async function sendAlertEmailEvents(
  userDocRef: DocumentReference<DocumentData>,
  events: AlertEvent[],
  input: {
    resend: Resend | null;
    fromEmail: string;
    dashboardUrl: string;
    resolveRecipient: (
      userDocRef: DocumentReference<DocumentData>,
    ) => Promise<string | null | EmailRecipientResolution>;
    preferencesUrl?: string;
    logPrefix?: string;
  },
) {
  if (!events.length) {
    return;
  }

  const logPrefix = input.logPrefix || "[email]";
  const attemptedAt = new Date().toISOString();

  if (!input.resend) {
    await updateAlertEmailStatuses(userDocRef, events, () => ({
          emailDeliveryStatus: "failed",
          emailDeliveryAttemptedAt: attemptedAt,
          emailDeliveryFailedAt: attemptedAt,
          emailDeliveryLastError: "resend-not-configured",
        }));
    console.info(`${logPrefix} Skipping alert email because Resend is not configured.`);
    return;
  }

  const sender = input.fromEmail.trim();
  if (!sender) {
    await updateAlertEmailStatuses(userDocRef, events, () => ({
          emailDeliveryStatus: "failed",
          emailDeliveryAttemptedAt: attemptedAt,
          emailDeliveryFailedAt: attemptedAt,
          emailDeliveryLastError: "sender-not-configured",
        }));
    console.info(`${logPrefix} Skipping alert email because sender email is not configured.`);
    return;
  }

  const recipientResolution = await input.resolveRecipient(userDocRef);
  const recipient =
    typeof recipientResolution === "string"
      ? recipientResolution
      : recipientResolution?.status === "ready"
        ? recipientResolution.email || null
        : null;
  if (!recipient) {
    const isSkipped =
      typeof recipientResolution === "object" &&
      recipientResolution !== null &&
      (recipientResolution.status === "opted_out" ||
        recipientResolution.status === "account_deleted");
    await updateAlertEmailStatuses(userDocRef, events, () => ({
          emailDeliveryStatus: isSkipped ? "skipped" : "failed",
          emailDeliveryAttemptedAt: attemptedAt,
          emailDeliveryFailedAt: isSkipped ? FieldValue.delete() : attemptedAt,
          emailDeliveryLastError:
            typeof recipientResolution === "object" && recipientResolution !== null
              ? recipientResolution.reason
              : "no-account-email",
        }));
    console.info(
      `${logPrefix} Skipping alert email for user ${userDocRef.id} because ${
        typeof recipientResolution === "object" && recipientResolution !== null
          ? recipientResolution.reason
          : "no account email is available"
      }.`,
    );
    return;
  }

  const eventAttemptedAt = new Date().toISOString();
  try {
    const result = await input.resend!.emails.send({
      from: `Rank Analyzer Pro <${sender}>`,
      to: recipient,
      subject: getAlertBatchEmailSubject(events),
      text:
        events.length === 1
          ? buildAlertEmailText(
              events[0],
              input.dashboardUrl,
              input.preferencesUrl,
            )
          : buildAlertBatchEmailText(
              events,
              input.dashboardUrl,
              input.preferencesUrl,
            ),
      html:
        events.length === 1
          ? buildAlertEmailHtml(
              events[0],
              input.dashboardUrl,
              input.preferencesUrl,
            )
          : buildAlertBatchEmailHtml(
              events,
              input.dashboardUrl,
              input.preferencesUrl,
            ),
    });
    if (result.error) {
      const failedAt = new Date().toISOString();
      await updateAlertEmailStatuses(userDocRef, events, () => ({
            emailDeliveryStatus: "failed",
            emailDeliveryRecipient: recipient,
            emailDeliveryAttemptedAt: eventAttemptedAt,
            emailDeliveryFailedAt: failedAt,
            emailDeliveryLastError:
              typeof result.error.message === "string" && result.error.message
                ? result.error.message
                : "provider-error",
          }));
      console.warn(`${logPrefix} Failed to deliver alert email batch for user ${userDocRef.id}`, result.error);
      return;
    }
    if (!getResendEmailId(result)) {
      console.warn(`${logPrefix} Alert email batch for user ${userDocRef.id} returned no message id.`);
    }
    const acceptedAt = new Date().toISOString();
    const providerMessageId = getResendEmailId(result);
    await updateAlertEmailStatuses(userDocRef, events, () => ({
          emailDeliveryStatus: "accepted",
          emailDeliveryRecipient: recipient,
          emailDeliveryAttemptedAt: eventAttemptedAt,
          emailDeliveryAcceptedAt: acceptedAt,
          emailDeliveryDeliveredAt: FieldValue.delete(),
          emailDeliveryFailedAt: FieldValue.delete(),
          emailDeliveryLastError: FieldValue.delete(),
          emailProviderMessageId: providerMessageId || FieldValue.delete(),
        }));
  } catch (error) {
    const message =
      error instanceof Error && error.message ? error.message : String(error);
    const failedAt = new Date().toISOString();
    await updateAlertEmailStatuses(userDocRef, events, () => ({
          emailDeliveryStatus: "failed",
          emailDeliveryRecipient: recipient,
          emailDeliveryAttemptedAt: eventAttemptedAt,
          emailDeliveryFailedAt: failedAt,
          emailDeliveryLastError: message,
        }));
    console.warn(`${logPrefix} Failed to deliver alert email batch for user ${userDocRef.id}`, error);
  }
}

export type WeeklyTrackedKeywordSummaryInput = {
  keyword: string;
  appId: string;
  appTitle: string;
  store: "android" | "ios";
  country: string;
  lastRank: number;
  lastCheckStatus?: string;
  lastChecked?: string;
};

export type WeeklyRankHistorySummaryInput = {
  appId: string;
  keyword: string;
  store: "android" | "ios";
  country: string;
  rank: number;
  timestamp: string;
  rankDepth?: number;
};

export type WeeklyCompetitorGroupSummaryInput = {
  groupId: string;
  ownApp: { title: string };
  competitors: Array<{ title: string }>;
};

export type WeeklyCompetitorTrackedKeywordSummaryInput = {
  trackedKeywordId: string;
  groupId: string;
  keyword: string;
  store: "android" | "ios";
  country: string;
  apps: Array<{
    appKey: string;
    title: string;
    lastRank: number;
    lastCheckStatus?: string;
  }>;
};

export type WeeklyCompetitorRankHistorySummaryInput = {
  trackedKeywordId: string;
  appKey: string;
  rank: number;
  timestamp: string;
  rankDepth?: number;
};

type WeeklyMovementItem = {
  keyword: string;
  appTitle: string;
  country: string;
  currentRankLabel: string;
  deltaLabel: string;
};

export type WeeklyReportEmailSummary = {
  rangeLabel: string;
  trackedKeywordCount: number;
  rankedKeywordCount: number;
  averageRankLabel: string;
  top10Count: number;
  top3Count: number;
  competitorGroupCount: number;
  competitorTrackedTermCount: number;
  competitorRankedPairCount: number;
  topMovers: WeeklyMovementItem[];
  topGainers: WeeklyMovementItem[];
  topLosers: WeeklyMovementItem[];
};

function getComparableRank(rank: number, rankDepth = 100) {
  return rank === -1 ? rankDepth + 1 : rank;
}

function formatRankLabel(rank: number, rankDepth = 100) {
  return rank === -1 ? `Not top ${rankDepth}` : `#${rank}`;
}

function formatDeltaLabel(delta: number) {
  return delta > 0 ? `+${delta}` : `${delta}`;
}

export function buildWeeklyReportEmailSummary(input: {
  trackedKeywords: WeeklyTrackedKeywordSummaryInput[];
  rankHistory: WeeklyRankHistorySummaryInput[];
  competitorGroups: WeeklyCompetitorGroupSummaryInput[];
  competitorTrackedKeywords: WeeklyCompetitorTrackedKeywordSummaryInput[];
  competitorRankHistory: WeeklyCompetitorRankHistorySummaryInput[];
  now?: Date;
  timeZone?: string;
}) {
  const now = input.now || new Date();
  const timeZone = input.timeZone || GLOBAL_TRACKING_TIMEZONE;
  const rangeStartStamp = getWeeklyReportDateStamp(now, timeZone) - 6 * 86400000;
  const rangeLabel = formatWeeklyReportRangeLabel(now, timeZone);

  const trackedRankedKeywords = input.trackedKeywords.filter(
    (entry) => entry.lastCheckStatus === "ok" && entry.lastRank !== -1,
  );
  const averageRank =
    trackedRankedKeywords.length > 0
      ? trackedRankedKeywords.reduce((sum, entry) => sum + entry.lastRank, 0) /
        trackedRankedKeywords.length
      : null;

  const movementCandidates = input.trackedKeywords
    .filter((entry) => entry.lastCheckStatus === "ok")
    .map((entry) => {
      const history = input.rankHistory
        .filter(
          (historyEntry) =>
            historyEntry.appId === entry.appId &&
            historyEntry.keyword === entry.keyword &&
            historyEntry.store === entry.store &&
            historyEntry.country === entry.country &&
            getWeeklyReportDateStamp(
              new Date(historyEntry.timestamp),
              timeZone,
            ) >= rangeStartStamp,
        )
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
      const currentRank = entry.lastRank;
      const currentComparable = getComparableRank(currentRank);
      const previousHistory = history[0];
      const previousComparable = previousHistory
        ? getComparableRank(previousHistory.rank, previousHistory.rankDepth)
        : currentComparable;
      const delta = previousComparable - currentComparable;
      return {
        keyword: entry.keyword,
        appTitle: entry.appTitle,
        country: entry.country.toUpperCase(),
        currentRankLabel: formatRankLabel(currentRank),
        delta,
      };
    })
    .filter((entry) => entry.delta !== 0);

  const movementToDisplay = (entry: {
    keyword: string;
    appTitle: string;
    country: string;
    currentRankLabel: string;
    delta: number;
  }): WeeklyMovementItem => ({
    keyword: entry.keyword,
    appTitle: entry.appTitle,
    country: entry.country,
    currentRankLabel: entry.currentRankLabel,
    deltaLabel: formatDeltaLabel(entry.delta),
  });

  const sortedMovers = [...movementCandidates].sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta),
  );
  const sortedGainers = movementCandidates
    .filter((entry) => entry.delta > 0)
    .sort((a, b) => b.delta - a.delta);
  const sortedLosers = movementCandidates
    .filter((entry) => entry.delta < 0)
    .sort((a, b) => a.delta - b.delta);

  const competitorRankedPairCount = input.competitorTrackedKeywords.reduce(
    (sum, record) =>
      sum +
      record.apps.filter(
        (app) => app.lastCheckStatus === "ok" && app.lastRank !== -1,
      ).length,
    0,
  );

  const summary: WeeklyReportEmailSummary = {
    rangeLabel,
    trackedKeywordCount: input.trackedKeywords.length,
    rankedKeywordCount: trackedRankedKeywords.length,
    averageRankLabel:
      averageRank === null ? "-" : averageRank.toFixed(1),
    top10Count: trackedRankedKeywords.filter((entry) => entry.lastRank <= 10)
      .length,
    top3Count: trackedRankedKeywords.filter((entry) => entry.lastRank <= 3)
      .length,
    competitorGroupCount: input.competitorGroups.length,
    competitorTrackedTermCount: input.competitorTrackedKeywords.length,
    competitorRankedPairCount,
    topMovers: sortedMovers.slice(0, 3).map(movementToDisplay),
    topGainers: sortedGainers.slice(0, 3).map(movementToDisplay),
    topLosers: sortedLosers.slice(0, 3).map(movementToDisplay),
  };

  return summary;
}

function renderWeeklyMovementSection(
  title: string,
  items: WeeklyMovementItem[],
  emptyLabel: string,
) {
  if (!items.length) {
    return `
      <div style="border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; background: #ffffff;">
        <h3 style="margin: 0 0 10px; font-size: 16px; color: #0f172a;">${escapeEmailHtml(title)}</h3>
        <p style="margin: 0; color: #64748b; font-size: 14px;">${escapeEmailHtml(emptyLabel)}</p>
      </div>
    `;
  }

  return `
    <div style="border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; background: #ffffff;">
      <h3 style="margin: 0 0 10px; font-size: 16px; color: #0f172a;">${escapeEmailHtml(title)}</h3>
      <div style="display: grid; gap: 10px;">
        ${items
          .map(
            (item) => `
              <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; background: #f8fafc;">
                <div style="display: flex; justify-content: space-between; gap: 12px; align-items: baseline;">
                  <strong style="color: #0f172a;">${escapeEmailHtml(item.keyword)}</strong>
                  <span style="color: #0891b2; font-weight: 700;">${escapeEmailHtml(item.deltaLabel)}</span>
                </div>
                <div style="margin-top: 4px; color: #334155; font-size: 13px;">${escapeEmailHtml(item.appTitle)} &middot; ${escapeEmailHtml(item.country)} &middot; ${escapeEmailHtml(item.currentRankLabel)}</div>
              </div>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

const WEEKDAY_VERB_LABELS: Record<WeeklyReportWeekday, string> = {
  sun: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

export function buildWeeklyReportWorkspaceUrl(
  appUrl: string,
  reportMode: "my" | "competitors" = "my",
) {
  const url = new URL(getSafeAppUrl(appUrl));
  url.searchParams.set("viewMode", "reports");
  url.searchParams.set("period", "7d");
  url.searchParams.set("reportMode", reportMode);
  url.searchParams.set("reportStore", "all");
  url.searchParams.set("reportCountry", "all");
  return url.toString();
}

export function buildWeeklyReportEmailHtml(input: {
  summary: WeeklyReportEmailSummary;
  reportUrl: string;
  weekday: WeeklyReportWeekday;
  preferencesUrl?: string;
}) {
  const hasTrackedData =
    input.summary.trackedKeywordCount > 0 || input.summary.rankedKeywordCount > 0;
  const hasCompetitorData =
    input.summary.competitorGroupCount > 0 ||
    input.summary.competitorTrackedTermCount > 0;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; color: #0f172a; background: #f8fafc; padding: 24px;">
      <div style="border-radius: 20px; background: linear-gradient(135deg, #22d3ee, #14b8a6); padding: 24px; color: #082f49;">
        <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;">Weekly Report</div>
        <h1 style="margin: 10px 0 8px; font-size: 28px; line-height: 1.15;">Your ASO summary for ${escapeEmailHtml(input.summary.rangeLabel)}</h1>
        <p style="margin: 0; font-size: 15px; line-height: 1.6;">Delivered on your ${escapeEmailHtml(WEEKDAY_VERB_LABELS[input.weekday])} schedule with a direct link into the full in-app report.</p>
      </div>

      <div style="display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); margin-top: 18px;">
        <div style="border: 1px solid #dbeafe; border-radius: 16px; padding: 16px; background: #ffffff;">
          <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">Tracked Keywords</div>
          <div style="margin-top: 8px; font-size: 28px; font-weight: 700;">${input.summary.trackedKeywordCount}</div>
        </div>
        <div style="border: 1px solid #dbeafe; border-radius: 16px; padding: 16px; background: #ffffff;">
          <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">Currently Ranked</div>
          <div style="margin-top: 8px; font-size: 28px; font-weight: 700;">${input.summary.rankedKeywordCount}</div>
        </div>
        <div style="border: 1px solid #dbeafe; border-radius: 16px; padding: 16px; background: #ffffff;">
          <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">Average Rank</div>
          <div style="margin-top: 8px; font-size: 28px; font-weight: 700;">${escapeEmailHtml(input.summary.averageRankLabel)}</div>
        </div>
        <div style="border: 1px solid #dbeafe; border-radius: 16px; padding: 16px; background: #ffffff;">
          <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em;">Top 10 / Top 3</div>
          <div style="margin-top: 8px; font-size: 28px; font-weight: 700;">${input.summary.top10Count} / ${input.summary.top3Count}</div>
        </div>
      </div>

      ${hasCompetitorData ? `
        <div style="margin-top: 18px; border: 1px solid #cbd5e1; border-radius: 16px; padding: 18px; background: #ffffff;">
          <h2 style="margin: 0 0 12px; font-size: 18px;">Competitor coverage</h2>
          <div style="display: grid; gap: 10px; grid-template-columns: repeat(3, minmax(0, 1fr));">
            <div><div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Groups</div><div style="margin-top: 6px; font-size: 22px; font-weight: 700;">${input.summary.competitorGroupCount}</div></div>
            <div><div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Tracked Terms</div><div style="margin-top: 6px; font-size: 22px; font-weight: 700;">${input.summary.competitorTrackedTermCount}</div></div>
            <div><div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Ranked Pairs</div><div style="margin-top: 6px; font-size: 22px; font-weight: 700;">${input.summary.competitorRankedPairCount}</div></div>
          </div>
        </div>
      ` : ""}

      <div style="display: grid; gap: 14px; margin-top: 18px;">
        ${renderWeeklyMovementSection("Biggest movers", input.summary.topMovers, hasTrackedData ? "No major movement in the current 7-day window." : "Tracking is active, but there is not enough rank history yet.")}
        ${renderWeeklyMovementSection("Top gains", input.summary.topGainers, hasTrackedData ? "No gains surfaced in the current 7-day window." : "Once tracked keywords build history, gains will appear here.")}
        ${renderWeeklyMovementSection("Top losses", input.summary.topLosers, hasTrackedData ? "No losses surfaced in the current 7-day window." : "Once tracked keywords build history, losses will appear here.")}
      </div>

      <div style="margin-top: 20px; border-radius: 16px; background: #ffffff; border: 1px solid #cbd5e1; padding: 18px;">
        <p style="margin: 0 0 14px; color: #334155; line-height: 1.6;">
          ${hasTrackedData
            ? "Open the full Reports workspace to inspect charts, keyword drilldowns, and the current 7-day movement view."
            : "Open the Reports workspace to finish setup, review your tracked keywords, and start building richer weekly summaries."}
        </p>
        <a href="${escapeEmailHtml(input.reportUrl)}" style="display: inline-block; padding: 12px 18px; border-radius: 10px; background: #06b6d4; color: #082f49; text-decoration: none; font-weight: 700;">
          View full report
        </a>
        ${input.preferencesUrl
          ? `<p style="margin: 14px 0 0; color: #64748b; font-size: 13px;"><a href="${escapeEmailHtml(input.preferencesUrl)}" style="color: #0f766e; text-decoration: underline;">Manage weekly email preferences</a></p>`
          : ""}
      </div>
    </div>
  `;
}

export function buildWeeklyReportEmailText(input: {
  summary: WeeklyReportEmailSummary;
  reportUrl: string;
  weekday: WeeklyReportWeekday;
  preferencesUrl?: string;
}) {
  const lines = [
    `Weekly Report: ${input.summary.rangeLabel}`,
    "",
    `Delivered on your ${WEEKDAY_VERB_LABELS[input.weekday]} schedule.`,
    `Tracked keywords: ${input.summary.trackedKeywordCount}`,
    `Currently ranked: ${input.summary.rankedKeywordCount}`,
    `Average rank: ${input.summary.averageRankLabel}`,
    `Top 10 / Top 3: ${input.summary.top10Count} / ${input.summary.top3Count}`,
  ];

  if (
    input.summary.competitorGroupCount > 0 ||
    input.summary.competitorTrackedTermCount > 0
  ) {
    lines.push(
      "",
      "Competitor coverage:",
      `- Groups: ${input.summary.competitorGroupCount}`,
      `- Tracked terms: ${input.summary.competitorTrackedTermCount}`,
      `- Ranked pairs: ${input.summary.competitorRankedPairCount}`,
    );
  }

  const appendMovementBlock = (
    title: string,
    items: WeeklyMovementItem[],
    emptyLabel: string,
  ) => {
    lines.push("", `${title}:`);
    if (!items.length) {
      lines.push(emptyLabel);
      return;
    }
    items.forEach((item) => {
      lines.push(
        `- ${item.keyword} (${item.appTitle}, ${item.country}) ${item.currentRankLabel} ${item.deltaLabel}`,
      );
    });
  };

  appendMovementBlock(
    "Biggest movers",
    input.summary.topMovers,
    "No major movement in the current 7-day window.",
  );
  appendMovementBlock(
    "Top gains",
    input.summary.topGainers,
    "No gains surfaced in the current 7-day window.",
  );
  appendMovementBlock(
    "Top losses",
    input.summary.topLosers,
    "No losses surfaced in the current 7-day window.",
  );

  lines.push("", `View full report: ${input.reportUrl}`);
  if (input.preferencesUrl) {
    lines.push(
      `Manage weekly email preferences: ${input.preferencesUrl}`,
    );
  }

  return lines.join("\n");
}

export function buildCronFailureEmailText(input: {
  runKey: string;
  trigger: "automatic" | "manual" | "watchdog" | "recovery";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  errorMessage: string;
  appUrl?: string;
}) {
  return [
    `Cron job failed: ${input.runKey}`,
    "",
    "The daily tracking cron job failed before completing.",
    `Trigger: ${input.trigger}`,
    `Started: ${formatEmailTimestamp(input.startedAt)}`,
    `Finished: ${formatEmailTimestamp(input.finishedAt)}`,
    `Duration: ${Math.max(0, Math.round(input.durationMs / 1000))}s`,
    `Error: ${input.errorMessage}`,
    "",
    `Open workspace: ${getSafeAppUrl(input.appUrl)}`,
  ].join("\n");
}
