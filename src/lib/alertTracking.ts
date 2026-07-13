export type AlertTrackingStore = "android" | "ios";

export type AlertTrackingStatus = "pending" | "ok" | "not_ranked" | "error";

export type CompetitorAlertTrackingRecord = {
  groupId: string;
  keyword: string;
  store: AlertTrackingStore;
  country: string;
  apps: Array<{
    appId: string;
    title: string;
    lastRank: number;
    lastChecked: string;
    lastCheckStatus?: AlertTrackingStatus;
    lastError?: string;
  }>;
};

export type AlertTrackingRecord = {
  groupId: string;
  keyword: string;
  appId: string;
  appTitle: string;
  store: AlertTrackingStore;
  country: string;
  lastRank: number;
  lastChecked: string;
  lastCheckStatus?: AlertTrackingStatus;
  lastError?: string;
};

export function flattenCompetitorTrackedKeywordsForAlerts(
  records: ReadonlyArray<CompetitorAlertTrackingRecord>,
): AlertTrackingRecord[] {
  return records.flatMap((record) =>
    record.apps.map((app) => ({
      groupId: record.groupId,
      keyword: record.keyword,
      appId: app.appId,
      appTitle: app.title,
      store: record.store,
      country: record.country,
      lastRank: app.lastRank,
      lastChecked: app.lastChecked,
      ...(app.lastCheckStatus ? { lastCheckStatus: app.lastCheckStatus } : {}),
      ...(app.lastError ? { lastError: app.lastError } : {}),
    })),
  );
}
