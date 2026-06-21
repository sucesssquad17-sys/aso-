import type { AlertRule, NotificationSettings } from "../../lib/alerts";
import { normalizeCountryCode } from "../../lib/countries";
import { TRACKED_KEYWORD_LEGACY_CREATED_AT } from "../../lib/planLimits";
import { safeStorage } from "../../lib/storage";

export type StoreType = "android" | "ios";
export type DiscoveryMode = "fast" | "deep";

export interface AppBookmark {
  appId: string;
  id?: number;
  title: string;
  icon: string;
  developer: string;
  store: StoreType;
  country: string;
  url?: string;
}

export interface AppDetails {
  title: string;
  appId: string;
  id?: number;
  description: string;
  icon: string;
  screenshots?: string[];
  score: number;
  developer: string;
  installs?: string;
  category?: string;
  url?: string;
}

export interface KeywordMetrics {
  demand?: number;
  volume?: number;
  difficulty?: number;
  relevance?: number;
  confidence?: "low" | "medium" | "high";
}

export interface RankedKeyword extends KeywordMetrics {
  keyword: string;
  rank: number;
}

export interface KeywordSuggestion extends KeywordMetrics {
  keyword: string;
}

export interface DiscoveryPayload {
  rankings: RankedKeyword[];
  suggestions: KeywordSuggestion[];
  checkedKeywords?: number;
  candidateCount?: number;
  searchDepth?: number;
  failedLookups?: number;
  mode: DiscoveryMode;
  loadedAt: string;
}

export type TrackedAppKind = "own" | "competitor";
export type TrackedAppSource = "manual" | "compare" | "discovery";

export interface TrackedAppRecord {
  appKey: string;
  appId: string;
  store: StoreType;
  title: string;
  developer: string;
  icon: string;
  url?: string;
  category?: string;
  kind: TrackedAppKind;
  source: TrackedAppSource;
  countries: string[];
  createdAt: string;
  updatedAt: string;
  lastAnalyzedAt?: string;
}

export interface AppAnalysisSnapshot {
  snapshotKey: string;
  appKey: string;
  appId: string;
  appTitle: string;
  store: StoreType;
  country: string;
  mode: DiscoveryMode;
  loadedAt: string;
  top10: number;
  top30: number;
  top100: number;
  averageRank: number | null;
  strongestKeyword?: RankedKeyword;
  bestSuggestion?: KeywordSuggestion;
  rankedKeywords: string[];
  suggestedKeywords: string[];
}

export type CompetitorGroupAppRole = "own" | "competitor";

export interface CompetitorGroupAppRecord {
  appKey: string;
  appId: string;
  store: StoreType;
  title: string;
  description: string;
  developer: string;
  icon: string;
  url?: string;
  category?: string;
  role: CompetitorGroupAppRole;
}

export interface CompetitorAnalysisInsight {
  appKey: string;
  role: CompetitorGroupAppRole;
  app: CompetitorGroupAppRecord;
  rankings: RankedKeyword[];
  suggestions: KeywordSuggestion[];
  top10: number;
  top30: number;
  top100: number;
  averageRank: number | null;
  strongestKeyword?: RankedKeyword;
  bestSuggestion?: KeywordSuggestion;
}

export interface CompetitorInsightRanking extends RankedKeyword {
  appKey: string;
  appTitle: string;
  role: CompetitorGroupAppRole;
}

export interface CompetitorInsightSuggestion extends KeywordSuggestion {
  appKey: string;
  appTitle: string;
  role: CompetitorGroupAppRole;
}

export interface CompetitorKeywordCoverageEntry {
  keyword: string;
  rankings: CompetitorInsightRanking[];
  suggestions: CompetitorInsightSuggestion[];
}

export interface CompetitorSharedBattle {
  keyword: string;
  rankedApps: CompetitorInsightRanking[];
  leader: CompetitorInsightRanking;
  runnerUp?: CompetitorInsightRanking;
  gap: number;
  averageVolume: number;
  averageDifficulty: number;
  averageRelevance: number;
}

export interface CompetitorGapOpportunity {
  keyword: string;
  leader?: CompetitorInsightRanking;
  missingApps: string[];
  rankedApps: CompetitorInsightRanking[];
  averageVolume: number;
  averageDifficulty: number;
  averageRelevance: number;
  score: number;
  isWhitespace: boolean;
}

export interface CompetitorGroupSnapshotRecord {
  snapshotId: string;
  groupId: string;
  store: StoreType;
  country: string;
  mode: DiscoveryMode;
  loadedAt: string;
  appInsights: CompetitorAnalysisInsight[];
  sharedBattles: CompetitorSharedBattle[];
  gapOpportunities: CompetitorGapOpportunity[];
}

export type CompetitorAsoFieldName =
  | "title"
  | "description"
  | "icon"
  | "category"
  | "screenshots";

export interface CompetitorAsoSnapshotPayload {
  title: string;
  description: string;
  icon: string;
  category: string;
  screenshots: string[];
}

export interface CompetitorAsoSnapshotRecord {
  snapshotId: string;
  groupId: string;
  appId: string;
  appKey: string;
  appTitle: string;
  store: StoreType;
  country: string;
  capturedAt: string;
  payload: CompetitorAsoSnapshotPayload;
}

export interface CompetitorAsoFieldChange {
  field: CompetitorAsoFieldName;
  previousValue: string | string[] | null;
  currentValue: string | string[] | null;
  summary: string;
}

export interface CompetitorAsoDiffRecord {
  diffId: string;
  groupId: string;
  appId: string;
  appKey: string;
  appTitle: string;
  store: StoreType;
  country: string;
  detectedAt: string;
  previousSnapshotId: string;
  currentSnapshotId: string;
  changedFields: CompetitorAsoFieldName[];
  changes: CompetitorAsoFieldChange[];
}

export interface CompetitorAsoSummaryBucket {
  key: string;
  count: number;
}

export interface CompetitorAsoSummary {
  totalDiffs: number;
  changedApps: number;
  changedCountries: number;
  latestDetectedAt?: string;
  fieldCounts: Record<CompetitorAsoFieldName, number>;
  topApps: CompetitorAsoSummaryBucket[];
  topCountries: CompetitorAsoSummaryBucket[];
}

export interface CompetitorGroupRecord {
  groupId: string;
  store: StoreType;
  country: string;
  mode: DiscoveryMode;
  ownApp: CompetitorGroupAppRecord;
  competitors: CompetitorGroupAppRecord[];
  trackedKeywordIds: string[];
  createdAt: string;
  updatedAt: string;
  lastAnalyzedAt?: string;
  latestSnapshotId?: string;
}

export type TrackedKeywordStatus = "pending" | "ok" | "not_ranked" | "error";

export interface CompetitorTrackedKeywordAppRecord
  extends CompetitorGroupAppRecord {
  lastRank: number;
  lastChecked: string;
  lastCheckStatus?: TrackedKeywordStatus;
  lastError?: string;
}

export interface CompetitorTrackedKeywordRecord {
  trackedKeywordId: string;
  groupId: string;
  keyword: string;
  store: StoreType;
  country: string;
  apps: CompetitorTrackedKeywordAppRecord[];
  createdAt: string;
  updatedAt: string;
  lastCheckedAt?: string;
}

export interface CompetitorDraftKeywordCandidateApp {
  appKey: string;
  title: string;
  role: CompetitorGroupAppRole;
  lastRank: number;
  lastCheckStatus?: TrackedKeywordStatus;
  lastError?: string;
}

export interface CompetitorDraftKeywordCandidate {
  keyword: string;
  source: "shared" | "search" | "gap";
  detail: string;
  apps: CompetitorDraftKeywordCandidateApp[];
}

export interface CompetitorRankHistoryEntry {
  trackedKeywordId: string;
  groupId: string;
  keyword: string;
  appId: string;
  appKey: string;
  store: StoreType;
  country: string;
  rank: number;
  timestamp: string;
  rankDepth?: number;
}

export interface CompareRankingResult extends KeywordMetrics {
  appTitle: string;
  rank: number;
}

export interface TrackedKeyword {
  groupId: string;
  keyword: string;
  appId: string;
  appTitle: string;
  store: StoreType;
  country: string;
  createdAt?: string;
  lastRank: number;
  lastChecked: string;
  lastCheckStatus?: "pending" | "ok" | "not_ranked" | "error";
  lastError?: string;
}

export interface TrackingSchedule {
  enabled: boolean;
  time: string;
  timezone: string;
  lastRunAt?: string;
  lastRunKey?: string;
}

export interface RankHistoryEntry {
  groupId?: string;
  appId: string;
  keyword: string;
  store: StoreType;
  country: string;
  rank: number;
  timestamp: string;
  rankDepth?: number;
  isSimulated?: boolean;
}

export interface ChartRankHistoryEntry {
  dayKey: string;
  timestamp: string;
  fullTime: string;
  rank: number;
  rawRank: number;
  rankDepth: number;
  rawTimestamp: string;
}

export interface CompetitorKeywordChartPoint {
  dayKey: string;
  timestamp: string;
  fullTime: string;
  rawTimestamp: string;
  [key: string]: string | number | undefined;
}

export type CsvValue = string | number | boolean | null | undefined;
export type CsvRow = Record<string, CsvValue>;

export interface TrackedCountryView {
  trackedKeyword: TrackedKeyword;
  tHistory: ChartRankHistoryEntry[];
  startRank: number | null;
  currentRank: number | null;
  improvement: number;
}

export interface TrackedKeywordGroupView {
  groupId: string;
  keyword: string;
  appId: string;
  appTitle: string;
  store: StoreType;
  countries: string[];
  countryViews: TrackedCountryView[];
  index: number;
  lastChecked: string;
  improvement: number;
}

export interface TrackedAppStoreGroupView {
  appId: string;
  trackedAppKey: string;
  appKind: TrackedAppKind;
  appSource: TrackedAppSource;
  analysisSnapshot: AppAnalysisSnapshot | null;
  store: StoreType;
  groups: TrackedKeywordGroupView[];
  totalRegions: number;
  rankedCount: number;
  needsAttentionCount: number;
  pendingCount: number;
  lastChecked: string;
  improvement: number;
  latestIndex: number;
}

export interface TrackedAppGroupView {
  appKey: string;
  appTitle: string;
  appKind: TrackedAppKind;
  competitorCountries: string[];
  storeGroups: TrackedAppStoreGroupView[];
  totalKeywordGroups: number;
  totalRegions: number;
  rankedCount: number;
  needsAttentionCount: number;
  pendingCount: number;
  lastChecked: string;
  improvement: number;
  latestIndex: number;
}

export interface UserAppStateDocument {
  bookmarks?: AppBookmark[];
  trackedApps?: TrackedAppRecord[];
  trackedKeywords?: TrackedKeyword[];
  rankHistory?: RankHistoryEntry[];
  appAnalysisSnapshots?: AppAnalysisSnapshot[];
  competitorGroups?: CompetitorGroupRecord[];
  competitorGroupSnapshots?: CompetitorGroupSnapshotRecord[];
  competitorTrackedKeywords?: CompetitorTrackedKeywordRecord[];
  competitorRankHistory?: CompetitorRankHistoryEntry[];
  trackingSchedule?: TrackingSchedule;
  alertRules?: AlertRule[];
  notificationSettings?: NotificationSettings;
  legalAcceptedAt?: string;
  legalVersion?: string;
  updatedAt?: string;
  migratedFromLocalAt?: string;
}

export type ApiErrorCode =
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_UNAVAILABLE"
  | "REQUEST_TIMEOUT"
  | "NETWORK_ERROR"
  | "INTERNAL_ERROR";

export type ApiErrorPayload = {
  error?: string;
  code?: ApiErrorCode;
  retryable?: boolean;
};

export class ApiRequestError extends Error {
  status?: number;
  code?: ApiErrorCode;
  retryable?: boolean;

  constructor(
    message: string,
    options?: {
      status?: number;
      code?: ApiErrorCode;
      retryable?: boolean;
    },
  ) {
    super(message);
    this.name = "ApiRequestError";
    this.status = options?.status;
    this.code = options?.code;
    this.retryable = options?.retryable;
  }
}

export const TRACKED_KEYWORD_REFRESH_CONCURRENCY = 1;
export const TRACKED_KEYWORD_RANKING_DEPTH = 100;
export const DISCOVERY_CACHE_TTL = 1000 * 60 * 60 * 12;
export const DISCOVERY_CACHE_VERSION = "v11";
export const SEARCH_CACHE_VERSION = "v2";
export const TRACKING_HISTORY_LIMIT = 2000;
export const TRACKING_CHART_TIMEZONE = "Asia/Kolkata";
export const API_REQUEST_TIMEOUT_MS = 45000;
export const DISCOVERY_FAST_TIMEOUT_MS = 240000;
export const DISCOVERY_DEEP_TIMEOUT_MS = 420000;
export const LEGAL_VERSION = "2026-05-26";

const COMPETITOR_GROUP_HISTORY_LIMIT = 8;

export function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function getDefaultTrackingSchedule(): TrackingSchedule {
  return {
    enabled: false,
    time: "09:00",
    timezone: "Asia/Kolkata",
  };
}

export function getLegacyTrackingGroupId({
  appId,
  keyword,
  store,
}: Pick<TrackedKeyword, "appId" | "keyword" | "store">) {
  return `legacy:${store}:${String(appId)}:${keyword.toLowerCase()}`;
}

export function resolveTrackingGroupId({
  groupId,
  appId,
  keyword,
  store,
}: {
  groupId?: string;
  appId: string;
  keyword: string;
  store: StoreType;
}) {
  return typeof groupId === "string" && groupId.trim()
    ? groupId.trim()
    : getLegacyTrackingGroupId({
        appId,
        keyword,
        store,
      });
}

export function createTrackingGroupId() {
  return `track-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getTrackedKeywordGroupKey({
  appId,
  keyword,
  store,
}: Pick<TrackedKeyword, "appId" | "keyword" | "store">) {
  return `${store}:${String(appId)}:${keyword.toLowerCase()}`;
}

export function getTrackedKeywordKey({
  groupId,
  appId,
  keyword,
  store,
  country,
}: {
  groupId?: string;
  appId: string;
  keyword: string;
  store: StoreType;
  country: string;
}) {
  return `${resolveTrackingGroupId({ groupId, appId, keyword, store })}:${store}:${country}:${String(appId)}:${keyword.toLowerCase()}`;
}

export function getBookmarkKey(
  bookmark: Pick<AppBookmark, "appId" | "id" | "store">,
) {
  return bookmark.store === "ios"
    ? `ios:${String(bookmark.id ?? bookmark.appId)}`
    : `android:${bookmark.appId}`;
}

export function getAppStoreId(
  app: Pick<AppDetails, "appId" | "id">,
  currentStore: StoreType,
) {
  return currentStore === "ios" ? String(app.id || app.appId) : app.appId;
}

export function getCompareAppKey(
  app: Pick<AppDetails, "appId" | "id">,
  currentStore: StoreType,
) {
  return `${currentStore}:${getAppStoreId(app, currentStore)}`;
}

export function getTrackedAppKeyFromValues(appId: string, store: StoreType) {
  return `${store}:${String(appId)}`;
}

export function normalizeTrackedAppKind(
  kind: unknown,
  fallback: TrackedAppKind = "own",
): TrackedAppKind {
  return kind === "competitor" || kind === "own" ? kind : fallback;
}

export function normalizeTrackedAppSource(
  source: unknown,
  fallback: TrackedAppSource = "manual",
): TrackedAppSource {
  return source === "compare" || source === "discovery" || source === "manual"
    ? source
    : fallback;
}

export function mergeTrackedKeywordCollections(
  existing: TrackedKeyword[],
  incoming: TrackedKeyword[],
) {
  const byKey = new Map<string, TrackedKeyword>();
  [...existing, ...incoming].forEach((trackedKeyword) => {
    const key = getTrackedKeywordKey(trackedKeyword);
    const current = byKey.get(key);
    const normalizedTrackedKeyword = {
      ...trackedKeyword,
      createdAt:
        trackedKeyword.createdAt || current?.createdAt || TRACKED_KEYWORD_LEGACY_CREATED_AT,
    };
    if (!current) {
      byKey.set(key, normalizedTrackedKeyword);
      return;
    }
    const currentTime = new Date(current.lastChecked).getTime();
    const nextTime = new Date(normalizedTrackedKeyword.lastChecked).getTime();
    const latestTrackedKeyword =
      nextTime >= currentTime ? normalizedTrackedKeyword : current;
    byKey.set(key, {
      ...latestTrackedKeyword,
      createdAt:
        new Date(current.createdAt || TRACKED_KEYWORD_LEGACY_CREATED_AT).getTime() <=
        new Date(
          normalizedTrackedKeyword.createdAt || TRACKED_KEYWORD_LEGACY_CREATED_AT,
        ).getTime()
          ? current.createdAt || TRACKED_KEYWORD_LEGACY_CREATED_AT
          : normalizedTrackedKeyword.createdAt || TRACKED_KEYWORD_LEGACY_CREATED_AT,
    });
  });
  return Array.from(byKey.values());
}

export function normalizeTrackedKeywordGroupIds(records: TrackedKeyword[]) {
  const canonicalGroupIdsByBaseKey = new Map<string, string>();
  const normalized = records.map((record) => {
    const baseKey = getTrackedKeywordGroupKey(record);
    const canonicalGroupId =
      canonicalGroupIdsByBaseKey.get(baseKey) || resolveTrackingGroupId(record);

    canonicalGroupIdsByBaseKey.set(baseKey, canonicalGroupId);

    return {
      ...record,
      country: normalizeCountryCode(record.country, "us"),
      createdAt: record.createdAt || TRACKED_KEYWORD_LEGACY_CREATED_AT,
      groupId: canonicalGroupId,
    };
  });

  return mergeTrackedKeywordCollections([], normalized);
}

export function normalizeTrackedRankHistoryGroupIds(
  entries: RankHistoryEntry[],
  trackedRecords: TrackedKeyword[],
) {
  const canonicalGroupIdsByBaseKey = new Map<string, string>();

  trackedRecords.forEach((record) => {
    canonicalGroupIdsByBaseKey.set(
      getTrackedKeywordGroupKey(record),
      resolveTrackingGroupId(record),
    );
  });

  const normalized = entries.map((entry) => {
    const baseKey = getTrackedKeywordGroupKey(entry);
    const canonicalGroupId =
      canonicalGroupIdsByBaseKey.get(baseKey) || resolveTrackingGroupId(entry);

    canonicalGroupIdsByBaseKey.set(baseKey, canonicalGroupId);

    return {
      ...entry,
      country: normalizeCountryCode(entry.country, "us"),
      groupId: canonicalGroupId,
    };
  });

  return mergeTrackedHistoryEntries([], normalized);
}

export function normalizeTrackedApps(input: unknown): TrackedAppRecord[] {
  if (!Array.isArray(input)) return [];
  const byKey = new Map<string, TrackedAppRecord>();

  input.forEach((item) => {
    const candidate = item as Partial<TrackedAppRecord>;
    if (
      typeof candidate?.appId !== "string" ||
      !candidate.appId.trim() ||
      (candidate.store !== "android" && candidate.store !== "ios")
    ) {
      return;
    }

    const appKey = getTrackedAppKeyFromValues(candidate.appId, candidate.store);
    const existing = byKey.get(appKey);
    const kind = normalizeTrackedAppKind(
      candidate.kind,
      existing?.kind ?? "own",
    );
    const source = normalizeTrackedAppSource(
      candidate.source,
      existing?.source ?? "manual",
    );
    const nextRecord: TrackedAppRecord = {
      appKey,
      appId: candidate.appId,
      store: candidate.store,
      title:
        typeof candidate.title === "string" && candidate.title.trim()
          ? candidate.title.trim()
          : existing?.title || candidate.appId,
      developer:
        typeof candidate.developer === "string" ? candidate.developer : "",
      icon: typeof candidate.icon === "string" ? candidate.icon : "",
      url: typeof candidate.url === "string" ? candidate.url : undefined,
      category:
        typeof candidate.category === "string" ? candidate.category : undefined,
      kind:
        existing?.kind === "own" || kind === "own" ? "own" : "competitor",
      source,
      countries: Array.from(
        new Set(
          (Array.isArray(candidate.countries) ? candidate.countries : [])
            .filter(
              (countryCode): countryCode is string =>
                typeof countryCode === "string",
            )
            .map((countryCode) => normalizeCountryCode(countryCode, "us"))
            .concat(existing?.countries || []),
        ),
      ).sort(),
      createdAt:
        typeof candidate.createdAt === "string" && candidate.createdAt
          ? candidate.createdAt
          : existing?.createdAt || new Date(0).toISOString(),
      updatedAt:
        typeof candidate.updatedAt === "string" && candidate.updatedAt
          ? candidate.updatedAt
          : existing?.updatedAt || new Date(0).toISOString(),
      lastAnalyzedAt:
        typeof candidate.lastAnalyzedAt === "string" && candidate.lastAnalyzedAt
          ? candidate.lastAnalyzedAt
          : existing?.lastAnalyzedAt,
    };

    byKey.set(appKey, nextRecord);
  });

  return Array.from(byKey.values()).sort((a, b) =>
    a.title.localeCompare(b.title),
  );
}

export function getAnalysisSnapshotKey(appKey: string, country: string) {
  return `${appKey}:${normalizeCountryCode(country, "us")}`;
}

export function normalizeAppAnalysisSnapshots(
  input: unknown,
): AppAnalysisSnapshot[] {
  if (!Array.isArray(input)) return [];
  const byKey = new Map<string, AppAnalysisSnapshot>();

  input.forEach((item) => {
    const candidate = item as Partial<AppAnalysisSnapshot>;
    if (
      typeof candidate?.appId !== "string" ||
      !candidate.appId.trim() ||
      (candidate.store !== "android" && candidate.store !== "ios") ||
      typeof candidate.country !== "string"
    ) {
      return;
    }

    const appKey = getTrackedAppKeyFromValues(candidate.appId, candidate.store);
    const snapshotKey = getAnalysisSnapshotKey(appKey, candidate.country);
    const current = byKey.get(snapshotKey);
    const candidateTime = new Date(candidate.loadedAt || 0).getTime();
    const currentTime = current ? new Date(current.loadedAt).getTime() : -1;
    if (current && currentTime > candidateTime) {
      return;
    }

    byKey.set(snapshotKey, {
      snapshotKey,
      appKey,
      appId: candidate.appId,
      appTitle:
        typeof candidate.appTitle === "string" && candidate.appTitle.trim()
          ? candidate.appTitle.trim()
          : candidate.appId,
      store: candidate.store,
      country: normalizeCountryCode(candidate.country, "us"),
      mode: candidate.mode === "fast" ? "fast" : "deep",
      loadedAt:
        typeof candidate.loadedAt === "string" && candidate.loadedAt
          ? candidate.loadedAt
          : new Date(0).toISOString(),
      top10: Number.isFinite(candidate.top10) ? Number(candidate.top10) : 0,
      top30: Number.isFinite(candidate.top30) ? Number(candidate.top30) : 0,
      top100: Number.isFinite(candidate.top100) ? Number(candidate.top100) : 0,
      averageRank: Number.isFinite(candidate.averageRank)
        ? Number(candidate.averageRank)
        : null,
      strongestKeyword:
        candidate.strongestKeyword &&
        typeof candidate.strongestKeyword.keyword === "string" &&
        Number.isFinite(candidate.strongestKeyword.rank)
          ? {
              ...candidate.strongestKeyword,
              rank: Number(candidate.strongestKeyword.rank),
            }
          : undefined,
      bestSuggestion:
        candidate.bestSuggestion &&
        typeof candidate.bestSuggestion.keyword === "string"
          ? {
              ...candidate.bestSuggestion,
            }
          : undefined,
      rankedKeywords: Array.isArray(candidate.rankedKeywords)
        ? candidate.rankedKeywords
            .filter((keyword): keyword is string => typeof keyword === "string")
            .slice(0, 12)
        : [],
      suggestedKeywords: Array.isArray(candidate.suggestedKeywords)
        ? candidate.suggestedKeywords
            .filter((keyword): keyword is string => typeof keyword === "string")
            .slice(0, 12)
        : [],
    });
  });

  return Array.from(byKey.values()).sort(
    (a, b) => new Date(b.loadedAt).getTime() - new Date(a.loadedAt).getTime(),
  );
}

export function createTrackedAppRecord(
  app: AppDetails,
  store: StoreType,
  kind: TrackedAppKind,
  source: TrackedAppSource,
  countries: string[] = [],
): TrackedAppRecord {
  const appId = String(getAppStoreId(app, store) || app.appId);
  const now = new Date().toISOString();
  return {
    appKey: getTrackedAppKeyFromValues(appId, store),
    appId,
    store,
    title: app.title || appId,
    developer: app.developer || "",
    icon: app.icon || "",
    url: app.url,
    category: app.category,
    kind,
    source,
    countries: Array.from(
      new Set(countries.map((country) => normalizeCountryCode(country, "us"))),
    ).sort(),
    createdAt: now,
    updatedAt: now,
  };
}

export function createAppAnalysisSnapshot(
  app: AppDetails,
  store: StoreType,
  country: string,
  payload: DiscoveryPayload,
): AppAnalysisSnapshot {
  const appId = String(getAppStoreId(app, store) || app.appId);
  const appKey = getTrackedAppKeyFromValues(appId, store);
  const rankings = payload.rankings || [];
  const suggestions = payload.suggestions || [];
  return {
    snapshotKey: getAnalysisSnapshotKey(appKey, country),
    appKey,
    appId,
    appTitle: app.title || appId,
    store,
    country: normalizeCountryCode(country, "us"),
    mode: payload.mode,
    loadedAt: payload.loadedAt,
    top10: rankings.filter((item) => item.rank <= 10).length,
    top30: rankings.filter((item) => item.rank <= 30).length,
    top100: rankings.filter((item) => item.rank <= 100).length,
    averageRank:
      rankings.length > 0
        ? Math.round(
            rankings.reduce((sum, item) => sum + item.rank, 0) /
              rankings.length,
          )
        : null,
    strongestKeyword:
      rankings.length > 0
        ? rankings.reduce((best, item) => (item.rank < best.rank ? item : best))
        : undefined,
    bestSuggestion: suggestions[0],
    rankedKeywords: rankings.map((item) => item.keyword).slice(0, 12),
    suggestedKeywords: suggestions.map((item) => item.keyword).slice(0, 12),
  };
}

export function getKeywordSuggestionScore(suggestion: KeywordSuggestion) {
  return (
    (suggestion.relevance ?? 0) * 0.55 +
    (suggestion.demand ?? suggestion.volume ?? 0) * 0.25 -
    (suggestion.difficulty ?? 50) * 0.2
  );
}

export function createCompetitorGroupId() {
  return `comp-group-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createCompetitorGroupSnapshotId(groupId: string) {
  return `${groupId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createCompetitorGroupAppRecord(
  app: AppDetails,
  store: StoreType,
  role: CompetitorGroupAppRole,
): CompetitorGroupAppRecord {
  const appId = String(getAppStoreId(app, store) || app.appId);
  return {
    appKey: getTrackedAppKeyFromValues(appId, store),
    appId,
    store,
    title: app.title || appId,
    description: app.description || "",
    developer: app.developer || "",
    icon: app.icon || "",
    url: app.url,
    category: app.category,
    role,
  };
}

export function toCompetitorGroupAppDetails(
  app: CompetitorGroupAppRecord,
): AppDetails {
  return {
    title: app.title,
    appId: app.appId,
    id:
      app.store === "ios" && Number.isFinite(Number(app.appId))
        ? Number(app.appId)
        : undefined,
    description: app.description,
    icon: app.icon,
    score: 0,
    developer: app.developer,
    category: app.category,
    url: app.url,
  };
}

export function normalizeCompetitorGroupAppRecord(
  input: unknown,
): CompetitorGroupAppRecord | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<CompetitorGroupAppRecord>;
  if (
    typeof candidate.appId !== "string" ||
    !candidate.appId.trim() ||
    (candidate.store !== "android" && candidate.store !== "ios")
  ) {
    return null;
  }
  const appKey = getTrackedAppKeyFromValues(candidate.appId, candidate.store);
  return {
    appKey,
    appId: candidate.appId,
    store: candidate.store,
    title:
      typeof candidate.title === "string" && candidate.title.trim()
        ? candidate.title.trim()
        : candidate.appId,
    description:
      typeof candidate.description === "string" ? candidate.description : "",
    developer:
      typeof candidate.developer === "string" ? candidate.developer : "",
    icon: typeof candidate.icon === "string" ? candidate.icon : "",
    url: typeof candidate.url === "string" ? candidate.url : undefined,
    category:
      typeof candidate.category === "string" ? candidate.category : undefined,
    role: candidate.role === "competitor" ? "competitor" : "own",
  };
}

export function normalizeCompetitorAnalysisInsight(
  input: unknown,
): CompetitorAnalysisInsight | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<CompetitorAnalysisInsight>;
  const app = normalizeCompetitorGroupAppRecord(candidate.app);
  if (!app) return null;
  const rankings = Array.isArray(candidate.rankings)
    ? candidate.rankings.flatMap((entry) => {
        if (
          entry &&
          typeof entry.keyword === "string" &&
          Number.isFinite(entry.rank)
        ) {
          return [{ ...entry, rank: Number(entry.rank) }];
        }
        return [];
      })
    : [];
  const suggestions = Array.isArray(candidate.suggestions)
    ? candidate.suggestions.flatMap((entry) => {
        if (entry && typeof entry.keyword === "string") {
          return [{ ...entry }];
        }
        return [];
      })
    : [];
  const strongestKeyword =
    candidate.strongestKeyword &&
    typeof candidate.strongestKeyword.keyword === "string" &&
    Number.isFinite(candidate.strongestKeyword.rank)
      ? {
          ...candidate.strongestKeyword,
          rank: Number(candidate.strongestKeyword.rank),
        }
      : undefined;
  const bestSuggestion =
    candidate.bestSuggestion &&
    typeof candidate.bestSuggestion.keyword === "string"
      ? { ...candidate.bestSuggestion }
      : undefined;
  return {
    appKey: app.appKey,
    role: app.role,
    app,
    rankings,
    suggestions,
    top10: Number.isFinite(candidate.top10) ? Number(candidate.top10) : 0,
    top30: Number.isFinite(candidate.top30) ? Number(candidate.top30) : 0,
    top100: Number.isFinite(candidate.top100) ? Number(candidate.top100) : 0,
    averageRank: Number.isFinite(candidate.averageRank)
      ? Number(candidate.averageRank)
      : null,
    strongestKeyword,
    bestSuggestion,
  };
}

export function normalizeCompetitorSharedBattle(
  input: unknown,
): CompetitorSharedBattle | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<CompetitorSharedBattle>;
  if (typeof candidate.keyword !== "string" || !candidate.keyword.trim()) {
    return null;
  }
  if (!Array.isArray(candidate.rankedApps) || candidate.rankedApps.length === 0) {
    return null;
  }
  const rankedApps = candidate.rankedApps.flatMap((entry) => {
    if (
      entry &&
      typeof entry.keyword === "string" &&
      Number.isFinite(entry.rank) &&
      typeof entry.appKey === "string" &&
      typeof entry.appTitle === "string"
    ) {
      const role: CompetitorGroupAppRole =
        entry.role === "own" ? "own" : "competitor";
      return [{ ...entry, rank: Number(entry.rank), role }];
    }
    return [];
  });
  if (rankedApps.length === 0) return null;
  return {
    keyword: candidate.keyword,
    rankedApps,
    leader: rankedApps[0],
    runnerUp: rankedApps[1],
    gap: Number.isFinite(candidate.gap) ? Number(candidate.gap) : 0,
    averageVolume: Number.isFinite(candidate.averageVolume)
      ? Number(candidate.averageVolume)
      : 0,
    averageDifficulty: Number.isFinite(candidate.averageDifficulty)
      ? Number(candidate.averageDifficulty)
      : 0,
    averageRelevance: Number.isFinite(candidate.averageRelevance)
      ? Number(candidate.averageRelevance)
      : 0,
  };
}

export function normalizeCompetitorGapOpportunity(
  input: unknown,
): CompetitorGapOpportunity | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<CompetitorGapOpportunity>;
  if (typeof candidate.keyword !== "string" || !candidate.keyword.trim()) {
    return null;
  }
  const rankedApps = Array.isArray(candidate.rankedApps)
    ? candidate.rankedApps.flatMap((entry) => {
        if (
          entry &&
          typeof entry.keyword === "string" &&
          Number.isFinite(entry.rank) &&
          typeof entry.appKey === "string" &&
          typeof entry.appTitle === "string"
        ) {
          const role: CompetitorGroupAppRole =
            entry.role === "own" ? "own" : "competitor";
          return [{ ...entry, rank: Number(entry.rank), role }];
        }
        return [];
      })
    : [];
  const leader =
    candidate.leader &&
    typeof candidate.leader.keyword === "string" &&
    Number.isFinite(candidate.leader.rank) &&
    typeof candidate.leader.appKey === "string" &&
    typeof candidate.leader.appTitle === "string"
      ? (() => {
          const role: CompetitorGroupAppRole =
            candidate.leader?.role === "own" ? "own" : "competitor";
          return {
            ...candidate.leader,
            rank: Number(candidate.leader.rank),
            role,
          };
        })()
      : undefined;
  return {
    keyword: candidate.keyword,
    leader,
    missingApps: Array.isArray(candidate.missingApps)
      ? candidate.missingApps.filter(
          (entry): entry is string =>
            typeof entry === "string" && entry.trim().length > 0,
        )
      : [],
    rankedApps,
    averageVolume: Number.isFinite(candidate.averageVolume)
      ? Number(candidate.averageVolume)
      : 0,
    averageDifficulty: Number.isFinite(candidate.averageDifficulty)
      ? Number(candidate.averageDifficulty)
      : 0,
    averageRelevance: Number.isFinite(candidate.averageRelevance)
      ? Number(candidate.averageRelevance)
      : 0,
    score: Number.isFinite(candidate.score) ? Number(candidate.score) : 0,
    isWhitespace: Boolean(candidate.isWhitespace),
  };
}

export function normalizeCompetitorGroups(
  input: unknown,
): CompetitorGroupRecord[] {
  if (!Array.isArray(input)) return [];
  const byId = new Map<string, CompetitorGroupRecord>();
  input.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const candidate = item as Partial<CompetitorGroupRecord>;
    const ownApp = normalizeCompetitorGroupAppRecord(candidate.ownApp);
    const competitors = Array.isArray(candidate.competitors)
      ? candidate.competitors
          .map((entry) => normalizeCompetitorGroupAppRecord(entry))
          .filter(
            (entry): entry is CompetitorGroupAppRecord =>
              Boolean(entry && entry.role === "competitor"),
          )
          .slice(0, 2)
      : [];
    if (
      typeof candidate.groupId !== "string" ||
      !candidate.groupId.trim() ||
      !ownApp ||
      competitors.length === 0 ||
      ownApp.role !== "own"
    ) {
      return;
    }
    const current = byId.get(candidate.groupId);
    const currentTime = current
      ? new Date(current.updatedAt || current.createdAt || 0).getTime()
      : -1;
    const candidateTime = new Date(
      candidate.updatedAt || candidate.createdAt || 0,
    ).getTime();
    if (current && currentTime > candidateTime) {
      return;
    }
    byId.set(candidate.groupId, {
      groupId: candidate.groupId,
      store: candidate.store === "ios" ? "ios" : "android",
      country: normalizeCountryCode(candidate.country, "us"),
      mode: candidate.mode === "fast" ? "fast" : "deep",
      ownApp,
      competitors,
      trackedKeywordIds: Array.isArray(candidate.trackedKeywordIds)
        ? candidate.trackedKeywordIds.filter(
            (entry): entry is string =>
              typeof entry === "string" && entry.trim().length > 0,
          )
        : [],
      createdAt:
        typeof candidate.createdAt === "string" && candidate.createdAt
          ? candidate.createdAt
          : new Date(0).toISOString(),
      updatedAt:
        typeof candidate.updatedAt === "string" && candidate.updatedAt
          ? candidate.updatedAt
          : new Date(0).toISOString(),
      lastAnalyzedAt:
        typeof candidate.lastAnalyzedAt === "string"
          ? candidate.lastAnalyzedAt
          : undefined,
      latestSnapshotId:
        typeof candidate.latestSnapshotId === "string"
          ? candidate.latestSnapshotId
          : undefined,
    });
  });
  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(b.updatedAt || b.createdAt).getTime() -
      new Date(a.updatedAt || a.createdAt).getTime(),
  );
}

export function normalizeCompetitorGroupSnapshots(
  input: unknown,
): CompetitorGroupSnapshotRecord[] {
  if (!Array.isArray(input)) return [];
  const byId = new Map<string, CompetitorGroupSnapshotRecord>();
  input.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const candidate = item as Partial<CompetitorGroupSnapshotRecord>;
    if (
      typeof candidate.snapshotId !== "string" ||
      !candidate.snapshotId.trim() ||
      typeof candidate.groupId !== "string" ||
      !candidate.groupId.trim()
    ) {
      return;
    }
    const appInsights = Array.isArray(candidate.appInsights)
      ? candidate.appInsights
          .map((entry) => normalizeCompetitorAnalysisInsight(entry))
          .filter(
            (entry): entry is CompetitorAnalysisInsight => Boolean(entry),
          )
      : [];
    if (appInsights.length < 2) return;
    byId.set(candidate.snapshotId, {
      snapshotId: candidate.snapshotId,
      groupId: candidate.groupId,
      store: candidate.store === "ios" ? "ios" : "android",
      country: normalizeCountryCode(candidate.country, "us"),
      mode: candidate.mode === "fast" ? "fast" : "deep",
      loadedAt:
        typeof candidate.loadedAt === "string" && candidate.loadedAt
          ? candidate.loadedAt
          : new Date(0).toISOString(),
      appInsights,
      sharedBattles: Array.isArray(candidate.sharedBattles)
        ? candidate.sharedBattles
            .map((entry) => normalizeCompetitorSharedBattle(entry))
            .filter((entry): entry is CompetitorSharedBattle => Boolean(entry))
        : [],
      gapOpportunities: Array.isArray(candidate.gapOpportunities)
        ? candidate.gapOpportunities
            .map((entry) => normalizeCompetitorGapOpportunity(entry))
            .filter((entry): entry is CompetitorGapOpportunity => Boolean(entry))
        : [],
    });
  });
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.loadedAt).getTime() - new Date(a.loadedAt).getTime(),
  );
}

export function upsertCompetitorGroupRecord(
  existing: CompetitorGroupRecord[],
  incoming: CompetitorGroupRecord,
) {
  return normalizeCompetitorGroups(
    existing.filter((group) => group.groupId !== incoming.groupId).concat(incoming),
  );
}

export function upsertCompetitorGroupSnapshot(
  existing: CompetitorGroupSnapshotRecord[],
  incoming: CompetitorGroupSnapshotRecord,
) {
  const filtered = existing.filter(
    (snapshot) => snapshot.snapshotId !== incoming.snapshotId,
  );
  const sameGroup = [incoming]
    .concat(filtered.filter((snapshot) => snapshot.groupId === incoming.groupId))
    .sort((a, b) => new Date(b.loadedAt).getTime() - new Date(a.loadedAt).getTime())
    .slice(0, COMPETITOR_GROUP_HISTORY_LIMIT);
  const otherGroups = filtered.filter(
    (snapshot) => snapshot.groupId !== incoming.groupId,
  );
  return normalizeCompetitorGroupSnapshots(otherGroups.concat(sameGroup));
}

export function normalizeTrackedKeywordStatus(
  input: unknown,
  lastRank: number,
): TrackedKeywordStatus {
  if (
    input === "pending" ||
    input === "ok" ||
    input === "not_ranked" ||
    input === "error"
  ) {
    return input;
  }
  if (lastRank === -1) return "not_ranked";
  return "ok";
}

export function createCompetitorTrackedKeywordId(
  groupId: string,
  keyword: string,
  country?: string,
) {
  const slug =
    keyword
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "keyword";
  const normalizedCountry = country
    ? normalizeCountryCode(country, "us")
    : undefined;
  return normalizedCountry
    ? `comp-track:${groupId}:${slug}:${normalizedCountry}`
    : `comp-track:${groupId}:${slug}`;
}

export function getCompetitorTrackedKeywordKey({
  groupId,
  keyword,
  country,
}: Pick<CompetitorTrackedKeywordRecord, "groupId" | "keyword" | "country">) {
  return `${groupId}:${normalizeCountryCode(country, "us")}:${keyword.toLowerCase()}`;
}

export function getCompetitorChartDataKey(appKey: string) {
  return `rank_${appKey.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

export function normalizeCompetitorTrackedKeywordAppRecord(
  input: unknown,
): CompetitorTrackedKeywordAppRecord | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<CompetitorTrackedKeywordAppRecord>;
  if (
    typeof candidate.appKey !== "string" ||
    !candidate.appKey.trim() ||
    typeof candidate.appId !== "string" ||
    !candidate.appId.trim() ||
    typeof candidate.title !== "string" ||
    !candidate.title.trim()
  ) {
    return null;
  }
  const role: CompetitorGroupAppRole =
    candidate.role === "own" ? "own" : "competitor";
  const lastRank = Number.isFinite(candidate.lastRank)
    ? Number(candidate.lastRank)
    : -1;
  return {
    appKey: candidate.appKey,
    appId: candidate.appId,
    store: candidate.store === "ios" ? "ios" : "android",
    role,
    title: candidate.title.trim(),
    description:
      typeof candidate.description === "string" ? candidate.description : "",
    developer:
      typeof candidate.developer === "string" ? candidate.developer : "",
    icon: typeof candidate.icon === "string" ? candidate.icon : "",
    category:
      typeof candidate.category === "string" ? candidate.category : undefined,
    url: typeof candidate.url === "string" ? candidate.url : undefined,
    lastRank,
    lastChecked:
      typeof candidate.lastChecked === "string" && candidate.lastChecked
        ? candidate.lastChecked
        : new Date(0).toISOString(),
    lastCheckStatus: normalizeTrackedKeywordStatus(
      candidate.lastCheckStatus,
      lastRank,
    ),
    lastError:
      typeof candidate.lastError === "string" && candidate.lastError.trim()
        ? candidate.lastError.trim()
        : undefined,
  };
}

export function normalizeCompetitorTrackedKeywords(
  input: unknown,
): CompetitorTrackedKeywordRecord[] {
  if (!Array.isArray(input)) return [];
  const byKey = new Map<string, CompetitorTrackedKeywordRecord>();
  input.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const candidate = item as Partial<CompetitorTrackedKeywordRecord>;
    if (
      typeof candidate.groupId !== "string" ||
      !candidate.groupId.trim() ||
      typeof candidate.keyword !== "string" ||
      !candidate.keyword.trim()
    ) {
      return;
    }
    const apps = Array.isArray(candidate.apps)
      ? candidate.apps
          .map((entry) => normalizeCompetitorTrackedKeywordAppRecord(entry))
          .filter(
            (entry): entry is CompetitorTrackedKeywordAppRecord => Boolean(entry),
          )
      : [];
    if (apps.length < 2) return;
    const keyword = candidate.keyword.trim();
    const normalized: CompetitorTrackedKeywordRecord = {
      trackedKeywordId:
        typeof candidate.trackedKeywordId === "string" &&
        candidate.trackedKeywordId.trim()
          ? candidate.trackedKeywordId
          : createCompetitorTrackedKeywordId(
              candidate.groupId,
              keyword,
              candidate.country,
            ),
      groupId: candidate.groupId,
      keyword,
      store: candidate.store === "ios" ? "ios" : "android",
      country: normalizeCountryCode(candidate.country, "us"),
      apps,
      createdAt:
        typeof candidate.createdAt === "string" && candidate.createdAt
          ? candidate.createdAt
          : new Date(0).toISOString(),
      updatedAt:
        typeof candidate.updatedAt === "string" && candidate.updatedAt
          ? candidate.updatedAt
          : new Date(0).toISOString(),
      lastCheckedAt:
        typeof candidate.lastCheckedAt === "string"
          ? candidate.lastCheckedAt
          : undefined,
    };
    const key = getCompetitorTrackedKeywordKey(normalized);
    const existing = byKey.get(key);
    if (
      !existing ||
      new Date(normalized.updatedAt).getTime() >=
        new Date(existing.updatedAt).getTime()
    ) {
      byKey.set(key, normalized);
    }
  });
  return Array.from(byKey.values()).sort(
    (a, b) =>
      new Date(b.updatedAt || b.createdAt).getTime() -
      new Date(a.updatedAt || a.createdAt).getTime(),
  );
}

export function normalizeCompetitorRankHistory(
  input: unknown,
): CompetitorRankHistoryEntry[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Partial<CompetitorRankHistoryEntry>;
    if (
      typeof candidate.trackedKeywordId !== "string" ||
      !candidate.trackedKeywordId.trim() ||
      typeof candidate.groupId !== "string" ||
      !candidate.groupId.trim() ||
      typeof candidate.keyword !== "string" ||
      !candidate.keyword.trim() ||
      typeof candidate.appId !== "string" ||
      !candidate.appId.trim() ||
      typeof candidate.appKey !== "string" ||
      !candidate.appKey.trim() ||
      (candidate.store !== "ios" && candidate.store !== "android") ||
      typeof candidate.country !== "string" ||
      !Number.isFinite(candidate.rank) ||
      typeof candidate.timestamp !== "string"
    ) {
      return [];
    }
    return [
      {
        trackedKeywordId: candidate.trackedKeywordId,
        groupId: candidate.groupId,
        keyword: candidate.keyword.trim(),
        appId: candidate.appId,
        appKey: candidate.appKey,
        store: candidate.store,
        country: normalizeCountryCode(candidate.country, "us"),
        rank: Number(candidate.rank),
        timestamp: candidate.timestamp,
        rankDepth: Number.isFinite(candidate.rankDepth)
          ? Number(candidate.rankDepth)
          : undefined,
      },
    ];
  });
}

export function mergeCompetitorTrackedKeywordCollections(
  existing: CompetitorTrackedKeywordRecord[],
  incoming: CompetitorTrackedKeywordRecord[],
) {
  const mergedByKey = new Map<string, CompetitorTrackedKeywordRecord>();
  const mergeApps = (
    currentApps: CompetitorTrackedKeywordAppRecord[],
    nextApps: CompetitorTrackedKeywordAppRecord[],
  ) => {
    const appsByKey = new Map<string, CompetitorTrackedKeywordAppRecord>();
    [...currentApps, ...nextApps].forEach((app) => {
      const current = appsByKey.get(app.appKey);
      if (
        !current ||
        new Date(app.lastChecked).getTime() >=
          new Date(current.lastChecked).getTime()
      ) {
        appsByKey.set(app.appKey, app);
      }
    });
    return Array.from(appsByKey.values()).sort((a, b) => {
      if (a.role === b.role) return a.title.localeCompare(b.title);
      return a.role === "own" ? -1 : 1;
    });
  };

  [...existing, ...incoming].forEach((entry) => {
    const key = getCompetitorTrackedKeywordKey(entry);
    const current = mergedByKey.get(key);
    if (!current) {
      mergedByKey.set(key, entry);
      return;
    }
    mergedByKey.set(key, {
      ...current,
      ...entry,
      trackedKeywordId: entry.trackedKeywordId || current.trackedKeywordId,
      createdAt:
        new Date(current.createdAt).getTime() <=
        new Date(entry.createdAt).getTime()
          ? current.createdAt
          : entry.createdAt,
      updatedAt:
        new Date(current.updatedAt).getTime() >=
        new Date(entry.updatedAt).getTime()
          ? current.updatedAt
          : entry.updatedAt,
      lastCheckedAt:
        new Date(current.lastCheckedAt || 0).getTime() >=
        new Date(entry.lastCheckedAt || 0).getTime()
          ? current.lastCheckedAt
          : entry.lastCheckedAt,
      apps: mergeApps(current.apps, entry.apps),
    });
  });

  return normalizeCompetitorTrackedKeywords(Array.from(mergedByKey.values()));
}

export function getCompetitorRankHistoryEntryKey(
  entry: CompetitorRankHistoryEntry,
) {
  return `${entry.trackedKeywordId}:${entry.appKey}:${getTrackingHistoryDayKey(entry.timestamp)}`;
}

export function mergeCompetitorRankHistoryEntries(
  existing: CompetitorRankHistoryEntry[],
  incoming: CompetitorRankHistoryEntry[],
) {
  const byKey = new Map<string, CompetitorRankHistoryEntry>();
  [...existing, ...incoming].forEach((entry) => {
    byKey.set(getCompetitorRankHistoryEntryKey(entry), entry);
  });
  return Array.from(byKey.values())
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )
    .slice(-TRACKING_HISTORY_LIMIT);
}

export function getCompetitorGroupLabel(group: CompetitorGroupRecord) {
  const competitorTitles = group.competitors.map((app) => app.title).join(" vs ");
  return `${group.ownApp.title} vs ${competitorTitles}`;
}

export function getCompetitorGroupSignature(
  ownAppKey: string,
  competitorAppKeys: string[],
  store: StoreType,
  country: string,
) {
  return [
    store,
    normalizeCountryCode(country, "us"),
    ownAppKey,
    ...competitorAppKeys.slice().sort(),
  ].join("|");
}

export function buildCompetitorAnalysisInsights(
  apps: CompetitorGroupAppRecord[],
  discoveries: Record<string, DiscoveryPayload>,
): CompetitorAnalysisInsight[] {
  return apps.flatMap((app) => {
    const discovery = discoveries[app.appKey];
    if (!discovery) return [];
    const rankings = Array.isArray(discovery.rankings) ? discovery.rankings : [];
    const suggestions = Array.isArray(discovery.suggestions)
      ? discovery.suggestions
      : [];
    const top10 = rankings.filter((item) => item.rank <= 10).length;
    const top30 = rankings.filter((item) => item.rank <= 30).length;
    const top100 = rankings.filter((item) => item.rank <= 100).length;
    const averageRank =
      rankings.length > 0
        ? Math.round(
            rankings.reduce((sum, item) => sum + item.rank, 0) /
              rankings.length,
          )
        : null;
    const strongestKeyword =
      rankings.length > 0
        ? rankings.reduce((best, item) => (item.rank < best.rank ? item : best))
        : undefined;
    const bestSuggestion =
      suggestions.length > 0
        ? [...suggestions].sort(
            (a, b) => getKeywordSuggestionScore(b) - getKeywordSuggestionScore(a),
          )[0]
        : undefined;
    return [
      {
        appKey: app.appKey,
        role: app.role,
        app,
        rankings,
        suggestions,
        top10,
        top30,
        top100,
        averageRank,
        strongestKeyword,
        bestSuggestion,
      },
    ];
  });
}

export function buildCompetitorKeywordCoverage(
  insights: CompetitorAnalysisInsight[],
): CompetitorKeywordCoverageEntry[] {
  const coverage = new Map<string, CompetitorKeywordCoverageEntry>();
  insights.forEach((insight) => {
    insight.rankings.forEach((rankingItem) => {
      const keywordKey = rankingItem.keyword.trim().toLowerCase();
      if (!keywordKey) return;
      const current = coverage.get(keywordKey) || {
        keyword: rankingItem.keyword,
        rankings: [],
        suggestions: [],
      };
      current.rankings.push({
        ...rankingItem,
        appKey: insight.appKey,
        appTitle: insight.app.title,
        role: insight.role,
      });
      coverage.set(keywordKey, current);
    });
    insight.suggestions.forEach((suggestionItem) => {
      const keywordKey = suggestionItem.keyword.trim().toLowerCase();
      if (!keywordKey) return;
      const current = coverage.get(keywordKey) || {
        keyword: suggestionItem.keyword,
        rankings: [],
        suggestions: [],
      };
      if (!current.rankings.some((item) => item.appKey === insight.appKey)) {
        current.suggestions.push({
          ...suggestionItem,
          appKey: insight.appKey,
          appTitle: insight.app.title,
          role: insight.role,
        });
      }
      coverage.set(keywordKey, current);
    });
  });
  return Array.from(coverage.values());
}

export function buildCompetitorSharedBattles(
  coverageEntries: CompetitorKeywordCoverageEntry[],
): CompetitorSharedBattle[] {
  return coverageEntries
    .filter((entry) => entry.rankings.length >= 2)
    .map((entry) => {
      const rankedApps = [...entry.rankings].sort((a, b) => a.rank - b.rank);
      const leader = rankedApps[0];
      const runnerUp = rankedApps[1];
      const metricSource = entry.rankings.length > 0 ? entry.rankings : entry.suggestions;
      const metricCount = metricSource.length || 1;
      return {
        keyword: entry.keyword,
        rankedApps,
        leader,
        runnerUp,
        gap: runnerUp ? runnerUp.rank - leader.rank : 0,
        averageVolume: Math.round(
          metricSource.reduce((sum, item) => sum + (item.demand ?? item.volume ?? 0), 0) /
            metricCount,
        ),
        averageDifficulty: Math.round(
          metricSource.reduce((sum, item) => sum + (item.difficulty ?? 0), 0) /
            metricCount,
        ),
        averageRelevance: Math.round(
          metricSource.reduce((sum, item) => sum + (item.relevance ?? 0), 0) /
            metricCount,
        ),
      };
    })
    .sort((a, b) => {
      if (b.rankedApps.length !== a.rankedApps.length) {
        return b.rankedApps.length - a.rankedApps.length;
      }
      if (a.leader.rank !== b.leader.rank) {
        return a.leader.rank - b.leader.rank;
      }
      return b.gap - a.gap;
    })
    .slice(0, 12);
}

export function buildCompetitorGapRows(
  coverageEntries: CompetitorKeywordCoverageEntry[],
  insights: CompetitorAnalysisInsight[],
): CompetitorGapOpportunity[] {
  return coverageEntries
    .map((entry) => {
      const rankedApps = [...entry.rankings].sort((a, b) => a.rank - b.rank);
      const rankedAppKeys = new Set(rankedApps.map((item) => item.appKey));
      const missingApps = insights
        .filter((insight) => !rankedAppKeys.has(insight.appKey))
        .map((insight) => insight.app.title);
      const leader = rankedApps[0];
      const metricSource = entry.rankings.length > 0 ? entry.rankings : entry.suggestions;
      if (missingApps.length === 0) return null;
      if (!leader && entry.suggestions.length < 2) return null;
      const metricCount = metricSource.length || 1;
      const averageVolume = Math.round(
        metricSource.reduce((sum, item) => sum + (item.demand ?? item.volume ?? 0), 0) /
          metricCount,
      );
      const averageDifficulty = Math.round(
        metricSource.reduce((sum, item) => sum + (item.difficulty ?? 0), 0) /
          metricCount,
      );
      const averageRelevance = Math.round(
        metricSource.reduce((sum, item) => sum + (item.relevance ?? 0), 0) /
          metricCount,
      );
      const score = Math.round(
        averageVolume * 0.45 +
          averageRelevance * 0.35 -
          averageDifficulty * 0.2 +
          missingApps.length * 14 +
          (leader ? Math.max(0, 120 - leader.rank) : 45),
      );
      return {
        keyword: entry.keyword,
        leader,
        missingApps,
        rankedApps,
        averageVolume,
        averageDifficulty,
        averageRelevance,
        score,
        isWhitespace: !leader,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12) as CompetitorGapOpportunity[];
}

export function createCompetitorGroupSnapshot(
  groupId: string,
  apps: CompetitorGroupAppRecord[],
  discoveries: Record<string, DiscoveryPayload>,
  store: StoreType,
  country: string,
  mode: DiscoveryMode,
): CompetitorGroupSnapshotRecord {
  const appInsights = buildCompetitorAnalysisInsights(apps, discoveries);
  const coverage = buildCompetitorKeywordCoverage(appInsights);
  return {
    snapshotId: createCompetitorGroupSnapshotId(groupId),
    groupId,
    store,
    country: normalizeCountryCode(country, "us"),
    mode,
    loadedAt: new Date().toISOString(),
    appInsights,
    sharedBattles: buildCompetitorSharedBattles(coverage),
    gapOpportunities: buildCompetitorGapRows(coverage, appInsights),
  };
}

export function getTrackedAppKindLabel(kind: TrackedAppKind) {
  return kind === "competitor" ? "Competitor" : "Own App";
}

export function slugifyFilenamePart(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "export"
  );
}

export function escapeCsvValue(value: CsvValue) {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function rowsToCsv(rows: CsvRow[]) {
  if (rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );
  return [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvValue(row[header])).join(","),
    ),
  ].join("\n");
}

export function downloadTextFile(
  content: string,
  mimeType: string,
  filename: string,
) {
  const blob = new Blob([content], {
    type: mimeType,
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

export function getRankHistoryKey(entry: RankHistoryEntry) {
  return `${resolveTrackingGroupId({ groupId: entry.groupId, appId: entry.appId, keyword: entry.keyword, store: entry.store })}:${entry.store}:${entry.country}:${entry.appId}:${entry.keyword.toLowerCase()}:${entry.rank}:${entry.timestamp}`;
}

export function getTrackingHistoryDayKey(timestamp: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TRACKING_CHART_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

export function formatTrackingChartDate(timestamp: string | Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(new Date(timestamp));
}

export function formatTrackingChartDateTime(timestamp: string | Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function createTrackedChartHistoryEntry(
  timestamp: string,
  rank: number,
  rankDepth: number,
): ChartRankHistoryEntry {
  return {
    dayKey: getTrackingHistoryDayKey(timestamp),
    timestamp: formatTrackingChartDate(timestamp),
    fullTime: formatTrackingChartDateTime(timestamp),
    rank: rank === -1 ? rankDepth + 1 : rank,
    rawRank: rank,
    rankDepth,
    rawTimestamp: timestamp,
  };
}

export function getTrackedHistoryEntryKey(
  entry: Pick<
    RankHistoryEntry,
    "groupId" | "store" | "country" | "appId" | "keyword" | "timestamp"
  >,
) {
  return `${resolveTrackingGroupId({ groupId: entry.groupId, appId: entry.appId, keyword: entry.keyword, store: entry.store })}:${entry.store}:${entry.country}:${entry.appId}:${entry.keyword.toLowerCase()}:${getTrackingHistoryDayKey(entry.timestamp)}`;
}

export function mergeTrackedHistoryEntries(
  existing: RankHistoryEntry[],
  incoming: RankHistoryEntry[],
) {
  const incomingKeys = new Set(
    incoming.map((entry) => getTrackedHistoryEntryKey(entry)),
  );
  const filteredExisting = existing.filter(
    (entry) => !incomingKeys.has(getTrackedHistoryEntryKey(entry)),
  );
  return mergeRankHistoryEntries(filteredExisting, incoming);
}

export function buildTrackedKeywordChartHistory(
  trackedKeyword: TrackedKeyword,
  history: ChartRankHistoryEntry[],
) {
  const sortedHistory = [...history].sort(
    (a, b) =>
      new Date(a.rawTimestamp).getTime() - new Date(b.rawTimestamp).getTime(),
  );
  const lastCheckedAt = new Date(trackedKeyword.lastChecked).getTime();
  if (
    !Number.isFinite(lastCheckedAt) ||
    lastCheckedAt <= 0 ||
    trackedKeyword.lastCheckStatus === "pending" ||
    trackedKeyword.lastCheckStatus === "error"
  ) {
    return sortedHistory;
  }
  const fallbackRankDepth =
    sortedHistory[sortedHistory.length - 1]?.rankDepth ??
    TRACKED_KEYWORD_RANKING_DEPTH;
  const currentPoint = createTrackedChartHistoryEntry(
    trackedKeyword.lastChecked,
    trackedKeyword.lastRank,
    fallbackRankDepth,
  );
  const existingIndex = sortedHistory.findIndex(
    (entry) => entry.dayKey === currentPoint.dayKey,
  );
  if (existingIndex >= 0) {
    const nextHistory = [...sortedHistory];
    nextHistory[existingIndex] = currentPoint;
    return nextHistory.sort(
      (a, b) =>
        new Date(a.rawTimestamp).getTime() - new Date(b.rawTimestamp).getTime(),
    );
  }
  return [...sortedHistory, currentPoint].sort(
    (a, b) =>
      new Date(a.rawTimestamp).getTime() - new Date(b.rawTimestamp).getTime(),
  );
}

export function buildTrackedAppChartHistory(
  appState: Pick<
    CompetitorTrackedKeywordAppRecord,
    "lastChecked" | "lastRank" | "lastCheckStatus"
  >,
  history: ChartRankHistoryEntry[],
) {
  const sortedHistory = [...history].sort(
    (a, b) =>
      new Date(a.rawTimestamp).getTime() - new Date(b.rawTimestamp).getTime(),
  );
  const lastCheckedAt = new Date(appState.lastChecked).getTime();
  if (
    !Number.isFinite(lastCheckedAt) ||
    lastCheckedAt <= 0 ||
    appState.lastCheckStatus === "pending" ||
    appState.lastCheckStatus === "error"
  ) {
    return sortedHistory;
  }
  const fallbackRankDepth =
    sortedHistory[sortedHistory.length - 1]?.rankDepth ??
    TRACKED_KEYWORD_RANKING_DEPTH;
  const currentPoint = createTrackedChartHistoryEntry(
    appState.lastChecked,
    appState.lastRank,
    fallbackRankDepth,
  );
  const existingIndex = sortedHistory.findIndex(
    (entry) => entry.dayKey === currentPoint.dayKey,
  );
  if (existingIndex >= 0) {
    const nextHistory = [...sortedHistory];
    nextHistory[existingIndex] = currentPoint;
    return nextHistory.sort(
      (a, b) =>
        new Date(a.rawTimestamp).getTime() - new Date(b.rawTimestamp).getTime(),
    );
  }
  return [...sortedHistory, currentPoint].sort(
    (a, b) =>
      new Date(a.rawTimestamp).getTime() - new Date(b.rawTimestamp).getTime(),
  );
}

export function getChartHistoryMovement(history: ChartRankHistoryEntry[]) {
  if (history.length < 2) return 0;
  const previous = history[history.length - 2];
  const current = history[history.length - 1];
  return previous.rank - current.rank;
}

export function mergeRankHistoryEntries(
  existing: RankHistoryEntry[],
  incoming: RankHistoryEntry[],
) {
  const byKey = new Map<string, RankHistoryEntry>();
  [...existing, ...incoming].forEach((entry) => {
    byKey.set(getRankHistoryKey(entry), entry);
  });
  return Array.from(byKey.values())
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )
    .slice(-TRACKING_HISTORY_LIMIT);
}

export function getTrackedRankDisplay(trackedKeyword: TrackedKeyword) {
  if (trackedKeyword.lastRank !== -1) {
    return {
      label: `#${trackedKeyword.lastRank}`,
      className: "text-cyan-400",
    };
  }
  if (trackedKeyword.lastCheckStatus === "error") {
    return {
      label: "Check failed",
      className: "text-amber-400",
    };
  }
  if (trackedKeyword.lastCheckStatus === "not_ranked") {
    return {
      label: `Not top ${TRACKED_KEYWORD_RANKING_DEPTH}`,
      className: "text-red-400",
    };
  }
  return {
    label: "Pending",
    className: "text-slate-400",
  };
}

export function normalizeTrackingScheduleState(
  schedule?: Partial<TrackingSchedule>,
): TrackingSchedule {
  return {
    enabled: Boolean(schedule?.enabled),
    time: "09:00",
    timezone: "Asia/Kolkata",
    lastRunAt: schedule?.lastRunAt,
    lastRunKey: schedule?.lastRunKey,
  };
}

export function readLegacyLocalUserState() {
  const readArray = <T,>(key: string): T[] => {
    try {
      const saved = safeStorage.getItem(key);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  return {
    bookmarks: readArray<AppBookmark>("aso-bookmarks"),
    trackedKeywords: readArray<TrackedKeyword>("aso-tracked-keywords"),
    rankHistory: readArray<RankHistoryEntry>("aso-rank-history"),
  };
}

export function getBrowserNotificationPermission():
  | NotificationPermission
  | "unsupported" {
  return "Notification" in window ? Notification.permission : "unsupported";
}

export function hasPersistedUserState(
  state: UserAppStateDocument | null,
): state is UserAppStateDocument {
  if (!state) {
    return false;
  }

  return Boolean(
    Array.isArray(state.bookmarks) ||
      Array.isArray(state.trackedApps) ||
      Array.isArray(state.trackedKeywords) ||
      Array.isArray(state.rankHistory) ||
      Array.isArray(state.appAnalysisSnapshots) ||
      Array.isArray(state.competitorGroups) ||
      Array.isArray(state.competitorGroupSnapshots) ||
      Array.isArray(state.competitorTrackedKeywords) ||
      Array.isArray(state.competitorRankHistory) ||
      Array.isArray(state.alertRules) ||
      state.trackingSchedule ||
      state.notificationSettings ||
      state.legalAcceptedAt ||
      state.legalVersion,
  );
}

export function serializeUserStateForFirestore(state: UserAppStateDocument) {
  return JSON.parse(JSON.stringify(state)) as UserAppStateDocument;
}

export function serializeEditableUserStateForApi(
  state: UserAppStateDocument,
) {
  return JSON.parse(
    JSON.stringify({
      bookmarks: state.bookmarks,
      trackedApps: state.trackedApps,
      trackedKeywords: state.trackedKeywords?.map((trackedKeyword) => ({
        groupId: trackedKeyword.groupId,
        keyword: trackedKeyword.keyword,
        appId: trackedKeyword.appId,
        appTitle: trackedKeyword.appTitle,
        store: trackedKeyword.store,
        country: trackedKeyword.country,
        createdAt: trackedKeyword.createdAt,
      })),
      rankHistory: state.rankHistory,
      appAnalysisSnapshots: state.appAnalysisSnapshots,
      competitorGroups: state.competitorGroups,
      competitorGroupSnapshots: state.competitorGroupSnapshots,
      competitorTrackedKeywords: state.competitorTrackedKeywords?.map(
        (trackedKeyword) => ({
          trackedKeywordId: trackedKeyword.trackedKeywordId,
          groupId: trackedKeyword.groupId,
          keyword: trackedKeyword.keyword,
          store: trackedKeyword.store,
          country: trackedKeyword.country,
          createdAt: trackedKeyword.createdAt,
          apps: trackedKeyword.apps.map((app) => ({
            appKey: app.appKey,
            appId: app.appId,
            store: app.store,
            title: app.title,
            description: app.description,
            developer: app.developer,
            icon: app.icon,
            url: app.url,
            category: app.category,
            role: app.role,
          })),
        }),
      ),
      competitorRankHistory: state.competitorRankHistory,
      trackingSchedule: state.trackingSchedule
        ? {
            enabled: state.trackingSchedule.enabled,
            time: "09:00",
            timezone: "Asia/Kolkata",
          }
        : undefined,
      alertRules: state.alertRules?.map((rule) => ({
        id: rule.id,
        enabled: rule.enabled,
        groupId: rule.groupId,
        appId: rule.appId,
        keyword: rule.keyword,
        store: rule.store,
        countries: rule.countries,
        channels: rule.channels,
        conditions: rule.conditions,
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
      })),
      notificationSettings: state.notificationSettings
        ? {
            inAppEnabled: state.notificationSettings.inAppEnabled,
            pushEnabled: state.notificationSettings.pushEnabled,
            permission: state.notificationSettings.permission,
          }
        : undefined,
      legalAcceptedAt: state.legalAcceptedAt,
      legalVersion: state.legalVersion,
      migratedFromLocalAt: state.migratedFromLocalAt,
      updatedAt: state.updatedAt,
    }),
  ) as UserAppStateDocument;
}

export function normalizeAppDetails(app: any, store: StoreType): AppDetails {
  return { ...app, category: store === "ios" ? app.primaryGenre : app.genre };
}

export async function fetchJson<T>(
  input: string,
  init?: RequestInit,
  options?: { timeoutMs?: number },
): Promise<T> {
  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? API_REQUEST_TIMEOUT_MS;
  let didTimeout = false;
  const timeoutId = window.setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const contentType = response.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => null);
    if (!response.ok) {
      const payload = (
        typeof body === "object" && body !== null ? body : null
      ) as ApiErrorPayload | null;
      throw new ApiRequestError(
        payload?.error || `Request failed with status ${response.status}`,
        {
          status: response.status,
          code: payload?.code,
          retryable: payload?.retryable,
        },
      );
    }
    return body as T;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      throw error;
    }
    if (
      error instanceof DOMException &&
      error.name === "AbortError" &&
      didTimeout
    ) {
      throw new ApiRequestError("Request timed out.", {
        code: "REQUEST_TIMEOUT",
        retryable: true,
      });
    }
    if (error instanceof TypeError) {
      throw new ApiRequestError("Network request failed.", {
        code: "NETWORK_ERROR",
        retryable: true,
      });
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const runWorker = async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= items.length) {
        return;
      }
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () =>
      runWorker(),
    ),
  );
  return results;
}
