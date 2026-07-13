import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Search,
  Loader2,
  Play,
  Apple,
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Globe,
  X,
  Layers,
  Bookmark,
  Trash2,
  ExternalLink,
  RefreshCw,
  Download,
  Bell,
  BellRing,
  Mail,
  LogOut,
  ShieldCheck,
  CreditCard,
  ChevronDown,
  MoreHorizontal,
  BookOpen,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ScatterChart,
  Scatter,
  ZAxis,
  PieChart,
  Pie,
  Label,
} from "recharts";
import { toast } from "sonner";
import type { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";
import ErrorBoundary from "../../components/ErrorBoundary";
import RankSparkline from "../../components/RankSparkline";
import { UpgradePage } from "./UpgradePage";
import ThemeToggle from "../../components/ThemeToggle";
import { PrivacyPolicyPage, TermsPage } from "../auth/components";
import { db, getFirebaseWebPushVapidKey, messaging } from "../../firebase";
import { loadArchivedHistoryCollections } from "../../lib/firestoreHistoryArchive";
import {
  type BillingAccessState,
  type BillingInterval,
  type BillingPlanId,
  type BillingStatus,
} from "../../lib/billing";
import { logError, getFriendlyErrorMessage } from "../../lib/errorHandler";
import {
  DataPdfExportError,
  exportDataPayloadToPdf,
} from "../../lib/dataPdfExport";
import type {
  DataExportPayload,
  PdfHistoryRange,
  ReportsPdfSnapshot,
} from "../../lib/dataExportTypes";
import { CacheService, TTL } from "../../lib/cache";
import { cn } from "../../lib/utils";
import {
  COUNTRY_OPTIONS as COUNTRIES,
  findCountryName,
  normalizeCountryCode,
  PRIORITY_TRACKING_COUNTRY_CODES,
  type CountryOption,
} from "../../lib/countries";
import type { WeeklyReportSettings } from "../../lib/weeklyReports";
import {
  CHART_TYPE_OPTIONS,
  getChartTypeLabel,
  type ChartCategoryOption,
  type ChartEntry,
  type ChartType,
} from "../../lib/categoryCharts";
import {
  getDefaultNotificationSettings,
  normalizeAlertRules,
  normalizeNotificationSettings,
  type AlertEvent,
  type AlertRule,
  type NotificationSettings,
} from "../../lib/alerts";
import { UnifiedAlertRuleManagerModal } from "../alerts/UnifiedAlertRuleManagerModal";
import { safeStorage } from "../../lib/storage";
import { isPreferenceStorageAllowed } from "../../lib/cookieConsent";
import type { ThemeMode } from "../../lib/theme";
import {
  getDiscoveryCacheLookupKeys,
  getDiscoveryCacheKey,
  hasDiscoveryCacheContent,
  trimDiscoveryPayloadForMode,
} from "../../lib/discoveryCache";
import {
  countPlanUsage,
  getCompetitorTrackedKeywordIdentityKey,
  getTrackedAppIdentityKeysForPlanUsage,
  getTrackedAppIdentityKeysFromTrackedKeywords,
  getTrackedKeywordActivity,
  getTrackedKeywordIdentityKey as getPlanTrackedKeywordIdentityKey,
  type PlanLimits,
} from "../../lib/planLimits";
import {
  ApiRequestError,
  API_REQUEST_TIMEOUT_MS,
  DISCOVERY_CACHE_TTL,
  DISCOVERY_DEEP_TIMEOUT_MS,
  DISCOVERY_FAST_TIMEOUT_MS,
  LEGAL_VERSION,
  SEARCH_CACHE_VERSION,
  TRACKED_KEYWORD_RANKING_DEPTH,
  TRACKED_KEYWORD_REFRESH_CONCURRENCY,
  TRACKING_HISTORY_LIMIT,
  type ApiErrorPayload,
  type AppAnalysisSnapshot,
  type AppBookmark,
  type AppDetails,
  type ChartRankHistoryEntry,
  type CompareRankingResult,
  type CompetitorAnalysisInsight,
  type CompetitorAsoDiffRecord,
  type CompetitorAsoFieldName,
  type CompetitorAsoSnapshotRecord,
  type CompetitorAsoSummary,
  type CompetitorDraftKeywordCandidate,
  type CompetitorDraftKeywordCandidateApp,
  type CompetitorGapOpportunity,
  type CompetitorGroupAppRecord,
  type CompetitorGroupAppRole,
  type CompetitorGroupRecord,
  type CompetitorGroupSnapshotRecord,
  type CompetitorKeywordChartPoint,
  type CompetitorKeywordCoverageEntry,
  type CompetitorRankHistoryEntry,
  type CompetitorSharedBattle,
  type CompetitorTrackedKeywordAppRecord,
  type CompetitorTrackedKeywordRecord,
  type CsvRow,
  type CsvValue,
  type DiscoveryMode,
  type DiscoveryPayload,
  type KeywordMetrics,
  type KeywordSuggestion,
  type RankHistoryEntry,
  type RankedKeyword,
  type StoreType,
  type TrackedAppGroupView,
  type TrackedAppKind,
  type TrackedAppRecord,
  type TrackedAppSource,
  type TrackedAppStoreGroupView,
  type TrackedCountryView,
  type TrackedKeyword,
  type TrackedKeywordGroupView,
  type TrackedKeywordStatus,
  type TrackingSchedule,
  type UserAppStateDocument,
  getBrowserTimeZone,
  getDefaultTrackingSchedule as getSharedDefaultTrackingSchedule,
  getDefaultWeeklyReportEmailSettings,
  normalizeTrackingScheduleState as normalizeSharedTrackingScheduleState,
  normalizeWeeklyReportSettingsState,
  reconcileCompetitorTrackedKeywordCountryEdit,
  serializeEditableUserStateForApi,
} from "../tracking/model";
import {
  WorkspaceEmptyBlock,
  WorkspaceMetricCard,
  WorkspaceMetricGrid,
  WorkspaceNavButton,
  WorkspacePageIntro,
  WorkspacePanel,
  MobileBottomNav,
  MobileDataCard,
  type WorkspacePageConfig,
  type WorkspaceViewMode,
} from "./workspacePrimitives";
import ReportsWorkspace, {
  type ReportMode,
  type ReportPeriodKey,
} from "../reports/ReportsWorkspace";
import BrandMark from "../../components/BrandMark";
import {
  DEFAULT_GLOBAL_TRACKING_TIME,
  formatGlobalTrackingTimeForLocalDisplay,
  GLOBAL_TRACKING_TIMEZONE,
  TRACKING_CHART_TIMEZONE,
} from "../../lib/trackingTime";

function getDefaultTrackingSchedule(): TrackingSchedule {
  return getSharedDefaultTrackingSchedule();
}

function getDefaultWeeklyReportSettings(): WeeklyReportSettings {
  return getDefaultWeeklyReportEmailSettings(getBrowserTimeZone());
}

type ReportsDeepLinkState = {
  reportMode?: ReportMode;
  period?: ReportPeriodKey;
  storeFilter?: StoreType | "all";
  countryFilter?: string;
};

function parseReportsDeepLinkFromLocation(): ReportsDeepLinkState | null {
  if (typeof window === "undefined") {
    return null;
  }
  const url = new URL(window.location.href);
  if (url.searchParams.get("viewMode") !== "reports") {
    return null;
  }

  const rawReportMode = url.searchParams.get("reportMode");
  const rawPeriod = url.searchParams.get("period");
  const rawStore = url.searchParams.get("reportStore");
  const rawCountry = url.searchParams.get("reportCountry");

  return {
    reportMode:
      rawReportMode === "my" || rawReportMode === "competitors"
        ? rawReportMode
        : undefined,
    period:
      rawPeriod === "7d" ||
      rawPeriod === "30d" ||
      rawPeriod === "90d" ||
      rawPeriod === "12m" ||
      rawPeriod === "all"
        ? rawPeriod
        : undefined,
    storeFilter:
      rawStore === "all" || rawStore === "android" || rawStore === "ios"
        ? rawStore
        : undefined,
    countryFilter:
      typeof rawCountry === "string" && rawCountry.trim()
        ? normalizeCountryCode(rawCountry, rawCountry)
        : undefined,
  };
}

function getLegacyTrackingGroupId({
  appId,
  keyword,
  store,
}: Pick<TrackedKeyword, "appId" | "keyword" | "store">) {
  return `legacy:${store}:${String(appId)}:${keyword.toLowerCase()}`;
}

function resolveTrackingGroupId({
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

function createTrackingGroupId() {
  return `track-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const PDF_EXPORT_ALL_COUNTRIES_CODE = "all";
const PDF_HISTORY_RANGE_OPTIONS: Array<{
  key: PdfHistoryRange;
  label: string;
}> = [
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "1 Month" },
  { key: "90d", label: "3 Months" },
  { key: "6m", label: "6 Months" },
  { key: "12m", label: "12 Months" },
  { key: "lifetime", label: "Lifetime" },
];

function normalizeTrackedKeywordGroupIds(records: TrackedKeyword[]) {
  const canonicalGroupIdsByBaseKey = new Map<string, string>();
  const normalized = records.map((record) => {
    const baseKey = getTrackedKeywordGroupKey(record);
    const canonicalGroupId =
      canonicalGroupIdsByBaseKey.get(baseKey) || resolveTrackingGroupId(record);

    canonicalGroupIdsByBaseKey.set(baseKey, canonicalGroupId);

    return {
      ...record,
      country: normalizeCountryCode(record.country, "us"),
      groupId: canonicalGroupId,
    };
  });

  return mergeTrackedKeywordCollections([], normalized);
}

function normalizeTrackedRankHistoryGroupIds(
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

function getTrackedKeywordKey({
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

function getTrackedKeywordGroupKey({
  appId,
  keyword,
  store,
}: Pick<TrackedKeyword, "appId" | "keyword" | "store">) {
  return `${store}:${String(appId)}:${keyword.toLowerCase()}`;
}

function getCompetitorTrackedKeywordGroupKey({
  groupId,
  keyword,
}: Pick<CompetitorTrackedKeywordRecord, "groupId" | "keyword">) {
  return `${groupId}:${keyword.toLowerCase()}`;
}

type CompetitorTrackedKeywordAppHistoryView = {
  app: CompetitorTrackedKeywordAppRecord;
  dataKey: string;
  history: ChartRankHistoryEntry[];
  movement: number;
};

type CompetitorTrackedKeywordCountryView = {
  trackedKeyword: CompetitorTrackedKeywordRecord;
  appHistoryViews: CompetitorTrackedKeywordAppHistoryView[];
  chartPoints: CompetitorKeywordChartPoint[];
  chartMax: number;
};

type CompetitorTrackedKeywordGroupView = {
  groupKey: string;
  groupId: string;
  keyword: string;
  store: StoreType;
  countries: string[];
  countryViews: CompetitorTrackedKeywordCountryView[];
  lastCheckedAt?: string;
};

export function getCompetitorTrackedKeywordCardState({
  keywordGroup,
  workspaceCountry,
  selectedCountriesByGroup,
}: {
  keywordGroup: Pick<
    CompetitorTrackedKeywordGroupView,
    "groupKey" | "groupId" | "keyword" | "countries" | "countryViews"
  >;
  workspaceCountry: string;
  selectedCountriesByGroup?: Record<string, string | undefined>;
}) {
  const defaultSummaryCountryCode =
    keywordGroup.countryViews.find(
      (countryView) =>
        countryView.trackedKeyword.country === workspaceCountry,
    )?.trackedKeyword.country ||
    [...keywordGroup.countryViews].sort(
      (a, b) =>
        new Date(b.trackedKeyword.lastCheckedAt || 0).getTime() -
        new Date(a.trackedKeyword.lastCheckedAt || 0).getTime(),
    )[0]?.trackedKeyword.country ||
    keywordGroup.countryViews[0]?.trackedKeyword.country;
  const selectedCountryView =
    keywordGroup.countryViews.find(
      (countryView) =>
        countryView.trackedKeyword.country ===
        selectedCountriesByGroup?.[keywordGroup.groupKey],
    ) ||
    keywordGroup.countryViews.find(
      (countryView) =>
        countryView.trackedKeyword.country === defaultSummaryCountryCode,
    ) ||
    keywordGroup.countryViews[0] ||
    null;

  return {
    selectedCountryView,
    showCountrySwitcher: keywordGroup.countries.length > 1,
    showEditCountries: selectedCountryView !== null,
    editCountriesInput: selectedCountryView
      ? {
          groupId: keywordGroup.groupId,
          keyword: keywordGroup.keyword,
        }
      : null,
  };
}

export function getTrackedAppUsageCountForOverview(
  trackedAppsOrKeywords:
    | TrackedAppRecord[]
    | Array<Pick<TrackedKeyword, "appId" | "store">>,
  trackedKeywords?: Array<Pick<TrackedKeyword, "appId" | "store">>,
) {
  const effectiveTrackedApps = trackedKeywords ? (trackedAppsOrKeywords as TrackedAppRecord[]) : [];
  const effectiveTrackedKeywords = trackedKeywords || trackedAppsOrKeywords;
  return getTrackedAppIdentityKeysForPlanUsage({
    trackedApps: effectiveTrackedApps,
    trackedKeywords: effectiveTrackedKeywords,
  }).size;
}

export function getTrackedViewAppCountForOverview(
  trackedAppGroups: Array<Pick<TrackedAppGroupView, "appKey">>,
) {
  return new Set(trackedAppGroups.map((group) => group.appKey)).size;
}

export function isTrackedKeywordKeyWithinActiveLimit(
  activity:
    | {
        activeKeys: Set<string>;
        pausedTrackedKeywords: number;
      }
    | null
    | undefined,
  trackedKeywordKey: string,
) {
  if (!activity || activity.pausedTrackedKeywords === 0) {
    return true;
  }

  return activity.activeKeys.has(trackedKeywordKey);
}

export function syncOwnTrackedAppsWithTrackedKeywords(
  trackedApps: TrackedAppRecord[],
  trackedKeywords: TrackedKeyword[],
) {
  const existingTrackedAppsByKey = new Map(
    trackedApps
      .filter((trackedApp) => trackedApp.kind === "own")
      .map((trackedApp) => [trackedApp.appKey, trackedApp]),
  );
  const nextTrackedAppsByKey = new Map<string, TrackedAppRecord>();

  trackedKeywords.forEach((trackedKeyword) => {
    const appKey = getTrackedAppKeyFromValues(
      trackedKeyword.appId,
      trackedKeyword.store,
    );
    const existingTrackedApp = nextTrackedAppsByKey.get(appKey);
    if (existingTrackedApp) {
      const country = normalizeCountryCode(trackedKeyword.country, "us");
      if (!existingTrackedApp.countries.includes(country)) {
        existingTrackedApp.countries.push(country);
        existingTrackedApp.countries.sort((left, right) => left.localeCompare(right));
      }
      return;
    }

    const matchedTrackedApp = existingTrackedAppsByKey.get(appKey);
    nextTrackedAppsByKey.set(appKey, {
      appKey,
      appId: trackedKeyword.appId,
      store: trackedKeyword.store,
      title:
        matchedTrackedApp?.title ||
        trackedKeyword.appTitle ||
        trackedKeyword.appId,
      developer: matchedTrackedApp?.developer || "",
      icon: matchedTrackedApp?.icon || "",
      url: matchedTrackedApp?.url,
      category: matchedTrackedApp?.category,
      kind: "own",
      source: matchedTrackedApp?.source || "manual",
      countries: [normalizeCountryCode(trackedKeyword.country, "us")],
      createdAt:
        matchedTrackedApp?.createdAt ||
        trackedKeyword.createdAt ||
        new Date().toISOString(),
      updatedAt: matchedTrackedApp?.updatedAt || new Date().toISOString(),
      lastAnalyzedAt: matchedTrackedApp?.lastAnalyzedAt,
    });
  });

  return normalizeTrackedApps(Array.from(nextTrackedAppsByKey.values()));
}

function getBookmarkKey(bookmark: Pick<AppBookmark, "appId" | "id" | "store">) {
  return bookmark.store === "ios"
    ? `ios:${String(bookmark.id ?? bookmark.appId)}`
    : `android:${bookmark.appId}`;
}

function getAppStoreId(
  app: Pick<AppDetails, "appId" | "id">,
  currentStore: StoreType,
) {
  return currentStore === "ios" ? String(app.id || app.appId) : app.appId;
}

function getCompareAppKey(
  app: Pick<AppDetails, "appId" | "id">,
  currentStore: StoreType,
) {
  return `${currentStore}:${getAppStoreId(app, currentStore)}`;
}

function getStoreAppIdentifiers(
  app: Pick<AppDetails, "appId" | "id">,
  currentStore: StoreType,
) {
  const identifiers = new Set<string>();
  if (typeof app.appId === "string" && app.appId.trim()) {
    identifiers.add(app.appId.trim());
  }
  if (app.id !== undefined && app.id !== null && String(app.id).trim()) {
    identifiers.add(String(app.id).trim());
  }
  if (identifiers.size === 0) {
    const fallbackId = getAppStoreId(app, currentStore);
    if (fallbackId) {
      identifiers.add(String(fallbackId).trim());
    }
  }
  return Array.from(identifiers);
}

function areSameStoreApps(
  left: Pick<AppDetails, "appId" | "id">,
  right: Pick<AppDetails, "appId" | "id">,
  currentStore: StoreType,
) {
  const leftIds = getStoreAppIdentifiers(left, currentStore);
  const rightIds = new Set(getStoreAppIdentifiers(right, currentStore));
  return leftIds.some((identifier) => rightIds.has(identifier));
}

function getTrackedAppKeyFromValues(appId: string, store: StoreType) {
  return `${store}:${String(appId)}`;
}

function normalizeTrackedAppKind(
  kind: unknown,
  fallback: TrackedAppKind = "own",
): TrackedAppKind {
  return kind === "competitor" || kind === "own" ? kind : fallback;
}

function normalizeTrackedAppSource(
  source: unknown,
  fallback: TrackedAppSource = "manual",
): TrackedAppSource {
  return source === "compare" || source === "discovery" || source === "manual"
    ? source
    : fallback;
}

function normalizeTrackedApps(input: unknown): TrackedAppRecord[] {
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
            .filter((countryCode): countryCode is string => typeof countryCode === "string")
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

function getAnalysisSnapshotKey(appKey: string, country: string) {
  return `${appKey}:${normalizeCountryCode(country, "us")}`;
}

function normalizeAppAnalysisSnapshots(input: unknown): AppAnalysisSnapshot[] {
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

function createTrackedAppRecord(
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

function mergeTrackedAppsWithIncoming(
  existing: TrackedAppRecord[],
  app: AppDetails,
  store: StoreType,
  kind: TrackedAppKind,
  source: TrackedAppSource,
  countries: string[] = [],
) {
  const incoming = createTrackedAppRecord(app, store, kind, source, countries);
  const matchedTrackedApp =
    existing.find(
      (trackedApp) =>
        trackedApp.store === incoming.store &&
        areSameStoreApps(trackedApp, app, store),
    ) || existing.find((trackedApp) => trackedApp.appKey === incoming.appKey);

  return normalizeTrackedApps(
    existing
      .filter(
        (trackedApp) =>
          !(
            trackedApp.store === incoming.store &&
            areSameStoreApps(trackedApp, app, store)
          ) && trackedApp.appKey !== incoming.appKey,
      )
      .concat({
        ...(matchedTrackedApp || incoming),
        ...incoming,
        kind:
          matchedTrackedApp?.kind === "own" || kind === "own"
            ? "own"
            : "competitor",
        createdAt: matchedTrackedApp?.createdAt || incoming.createdAt,
        countries: Array.from(
          new Set((matchedTrackedApp?.countries || []).concat(incoming.countries)),
        ),
        lastAnalyzedAt: matchedTrackedApp?.lastAnalyzedAt,
      }),
  );
}

function createAppAnalysisSnapshot(
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
            rankings.reduce((sum, item) => sum + item.rank, 0) / rankings.length,
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

function createDemoIconDataUri(label: string, start: string, end: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${start}" />
          <stop offset="100%" stop-color="${end}" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="28" fill="#020617" />
      <rect x="8" y="8" width="112" height="112" rx="24" fill="url(#g)" opacity="0.88" />
      <circle cx="64" cy="64" r="30" fill="rgba(2,6,23,0.28)" />
      <text x="64" y="78" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="52" font-weight="700" fill="#e2e8f0">${label}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createDemoRankHistoryEntries({
  groupId,
  appId,
  keyword,
  store,
  country,
  ranks,
}: {
  groupId: string;
  appId: string;
  keyword: string;
  store: StoreType;
  country: string;
  ranks: number[];
}) {
  const dayMs = 24 * 60 * 60 * 1000;
  const start = Date.now() - (ranks.length - 1) * dayMs;
  return ranks.map((rank, index) => ({
    groupId,
    appId,
    keyword,
    store,
    country,
    rank,
    timestamp: new Date(start + index * dayMs).toISOString(),
    rankDepth: TRACKED_KEYWORD_RANKING_DEPTH,
    isSimulated: true,
  }));
}

function createDemoCompetitorRankHistoryEntries({
  trackedKeywordId,
  groupId,
  keyword,
  appId,
  appKey,
  store,
  country,
  ranks,
}: {
  trackedKeywordId: string;
  groupId: string;
  keyword: string;
  appId: string;
  appKey: string;
  store: StoreType;
  country: string;
  ranks: number[];
}) {
  const dayMs = 24 * 60 * 60 * 1000;
  const start = Date.now() - (ranks.length - 1) * dayMs;
  return ranks.map((rank, index) => ({
    trackedKeywordId,
    groupId,
    keyword,
    appId,
    appKey,
    store,
    country,
    rank,
    timestamp: new Date(start + index * dayMs).toISOString(),
    rankDepth: TRACKED_KEYWORD_RANKING_DEPTH,
  }));
}

function buildDemoWorkspaceState() {
  const store: StoreType = "android";
  const country = "us";
  const now = Date.now();
  const hoursAgo = (hours: number) =>
    new Date(now - hours * 60 * 60 * 1000).toISOString();

  const ownApp: AppDetails = {
    title: "Bible Nova: AI Holy Bible KJV",
    appId: "com.demo.biblenova",
    description: "AI Bible study companion with verse chat and devotional tools.",
    icon: createDemoIconDataUri("B", "#38bdf8", "#6366f1"),
    score: 4.8,
    developer: "Bible Nova",
    installs: "100K+",
    category: "Books & Reference",
    url: "https://play.google.com/store/apps/details?id=com.demo.biblenova",
  };
  const competitorApp: AppDetails = {
    title: "Hallow: Prayer & Meditation",
    appId: "com.demo.hallow",
    description: "Prayer routines, guided meditation, and spiritual reflection.",
    icon: createDemoIconDataUri("H", "#22d3ee", "#34d399"),
    score: 4.7,
    developer: "Hallow, Inc.",
    installs: "5M+",
    category: "Health & Fitness",
    url: "https://play.google.com/store/apps/details?id=com.demo.hallow",
  };
  const benchmarkApp: AppDetails = {
    title: "YouVersion Bible App",
    appId: "com.demo.youversion",
    description: "Bible reading, audio, plans, and daily verse engagement.",
    icon: createDemoIconDataUri("Y", "#f59e0b", "#ef4444"),
    score: 4.9,
    developer: "Life.Church",
    installs: "100M+",
    category: "Books & Reference",
    url: "https://play.google.com/store/apps/details?id=com.demo.youversion",
  };

  const ownDiscovery: DiscoveryPayload = {
    mode: "fast",
    loadedAt: hoursAgo(2),
    rankings: [
      { keyword: "bible nova", rank: 1, volume: 91, difficulty: 24, relevance: 99 },
      { keyword: "holy bible kjv", rank: 1, volume: 88, difficulty: 33, relevance: 96 },
      { keyword: "bible study app", rank: 2, volume: 79, difficulty: 46, relevance: 92 },
      { keyword: "ai bible chat", rank: 3, volume: 74, difficulty: 28, relevance: 95 },
      { keyword: "daily bible verse", rank: 6, volume: 67, difficulty: 39, relevance: 89 },
      { keyword: "kjv audio bible", rank: 8, volume: 58, difficulty: 35, relevance: 83 },
    ],
    suggestions: [
      { keyword: "verse of the day app", volume: 72, difficulty: 31, relevance: 88 },
      { keyword: "bible prayer journal", volume: 63, difficulty: 27, relevance: 81 },
      { keyword: "christian ai assistant", volume: 51, difficulty: 22, relevance: 84 },
    ],
  };
  const competitorDiscovery: DiscoveryPayload = {
    mode: "fast",
    loadedAt: hoursAgo(3),
    rankings: [
      { keyword: "prayer app", rank: 2, volume: 86, difficulty: 41, relevance: 93 },
      { keyword: "christian meditation", rank: 2, volume: 68, difficulty: 29, relevance: 89 },
      { keyword: "sleep prayer", rank: 4, volume: 61, difficulty: 26, relevance: 86 },
      { keyword: "daily prayer", rank: 6, volume: 57, difficulty: 37, relevance: 80 },
      { keyword: "catholic prayer", rank: 9, volume: 49, difficulty: 42, relevance: 76 },
    ],
    suggestions: [
      { keyword: "night prayer app", volume: 58, difficulty: 23, relevance: 84 },
      { keyword: "guided prayer", volume: 52, difficulty: 27, relevance: 79 },
      { keyword: "meditation for christians", volume: 43, difficulty: 22, relevance: 82 },
    ],
  };
  const benchmarkDiscovery: DiscoveryPayload = {
    mode: "fast",
    loadedAt: hoursAgo(4),
    rankings: [
      { keyword: "bible app", rank: 1, volume: 97, difficulty: 52, relevance: 98 },
      { keyword: "daily bible verse", rank: 2, volume: 67, difficulty: 39, relevance: 91 },
      { keyword: "audio bible", rank: 3, volume: 73, difficulty: 44, relevance: 88 },
      { keyword: "verse of the day", rank: 4, volume: 69, difficulty: 35, relevance: 89 },
      { keyword: "bible reading plan", rank: 6, volume: 62, difficulty: 41, relevance: 85 },
    ],
    suggestions: [
      { keyword: "scripture app", volume: 54, difficulty: 33, relevance: 78 },
      { keyword: "family devotion app", volume: 41, difficulty: 24, relevance: 72 },
      { keyword: "study bible notes", volume: 37, difficulty: 29, relevance: 70 },
    ],
  };

  const trackedApps = [
    {
      ...createTrackedAppRecord(ownApp, store, "own", "discovery", ["us", "gb"]),
      lastAnalyzedAt: ownDiscovery.loadedAt,
    },
    {
      ...createTrackedAppRecord(
        competitorApp,
        store,
        "competitor",
        "compare",
        ["us"],
      ),
      lastAnalyzedAt: competitorDiscovery.loadedAt,
    },
  ];

  const trackedKeywords: TrackedKeyword[] = [
    {
      groupId: "demo-track-bible-nova",
      keyword: "bible nova",
      appId: ownApp.appId,
      appTitle: ownApp.title,
      store,
      country: "us",
      lastRank: 1,
      lastChecked: ownDiscovery.loadedAt,
      lastCheckStatus: "ok",
    },
    {
      groupId: "demo-track-bible-nova",
      keyword: "bible nova",
      appId: ownApp.appId,
      appTitle: ownApp.title,
      store,
      country: "gb",
      lastRank: 2,
      lastChecked: ownDiscovery.loadedAt,
      lastCheckStatus: "ok",
    },
    {
      groupId: "demo-track-kjv",
      keyword: "holy bible kjv",
      appId: ownApp.appId,
      appTitle: ownApp.title,
      store,
      country: "us",
      lastRank: 1,
      lastChecked: ownDiscovery.loadedAt,
      lastCheckStatus: "ok",
    },
    {
      groupId: "demo-track-daily-verse",
      keyword: "daily bible verse",
      appId: ownApp.appId,
      appTitle: ownApp.title,
      store,
      country: "us",
      lastRank: 6,
      lastChecked: ownDiscovery.loadedAt,
      lastCheckStatus: "ok",
    },
    {
      groupId: "demo-track-prayer",
      keyword: "prayer app",
      appId: competitorApp.appId,
      appTitle: competitorApp.title,
      store,
      country: "us",
      lastRank: 2,
      lastChecked: competitorDiscovery.loadedAt,
      lastCheckStatus: "ok",
    },
  ];

  const rankHistory = [
    ...createDemoRankHistoryEntries({
      groupId: "demo-track-bible-nova",
      appId: ownApp.appId,
      keyword: "bible nova",
      store,
      country: "us",
      ranks: [4, 3, 2, 2, 1, 1, 1],
    }),
    ...createDemoRankHistoryEntries({
      groupId: "demo-track-bible-nova",
      appId: ownApp.appId,
      keyword: "bible nova",
      store,
      country: "gb",
      ranks: [7, 6, 5, 4, 3, 3, 2],
    }),
    ...createDemoRankHistoryEntries({
      groupId: "demo-track-kjv",
      appId: ownApp.appId,
      keyword: "holy bible kjv",
      store,
      country: "us",
      ranks: [5, 4, 3, 2, 2, 1, 1],
    }),
    ...createDemoRankHistoryEntries({
      groupId: "demo-track-daily-verse",
      appId: ownApp.appId,
      keyword: "daily bible verse",
      store,
      country: "us",
      ranks: [13, 12, 10, 9, 8, 7, 6],
    }),
    ...createDemoRankHistoryEntries({
      groupId: "demo-track-prayer",
      appId: competitorApp.appId,
      keyword: "prayer app",
      store,
      country: "us",
      ranks: [6, 5, 5, 4, 3, 3, 2],
    }),
  ];

  const bookmarks: AppBookmark[] = [ownApp, competitorApp, benchmarkApp].map(
    (app) => ({
      appId: app.appId,
      title: app.title,
      icon: app.icon,
      developer: app.developer,
      store,
      country,
      url: app.url,
    }),
  );

  const ownCompetitorRecord: CompetitorGroupAppRecord = {
    appKey: getTrackedAppKeyFromValues(ownApp.appId, store),
    appId: ownApp.appId,
    store,
    title: ownApp.title,
    description: ownApp.description,
    developer: ownApp.developer,
    icon: ownApp.icon,
    url: ownApp.url,
    category: ownApp.category,
    role: "own",
  };
  const rivalCompetitorRecord: CompetitorGroupAppRecord = {
    appKey: getTrackedAppKeyFromValues(competitorApp.appId, store),
    appId: competitorApp.appId,
    store,
    title: competitorApp.title,
    description: competitorApp.description,
    developer: competitorApp.developer,
    icon: competitorApp.icon,
    url: competitorApp.url,
    category: competitorApp.category,
    role: "competitor",
  };
  const competitorGroupId = "demo-competitor-group";
  const competitorSnapshotId = "demo-competitor-snapshot";
  const competitorTrackedKeywordId = "demo-competitor-keyword";
  const competitorGroups: CompetitorGroupRecord[] = [
    {
      groupId: competitorGroupId,
      store,
      country,
      mode: "fast",
      ownApp: ownCompetitorRecord,
      competitors: [rivalCompetitorRecord],
      trackedKeywordIds: [competitorTrackedKeywordId],
      createdAt: hoursAgo(48),
      updatedAt: hoursAgo(2),
      lastAnalyzedAt: hoursAgo(2),
      latestSnapshotId: competitorSnapshotId,
    },
  ];
  const competitorGroupSnapshots: CompetitorGroupSnapshotRecord[] = [
    {
      snapshotId: competitorSnapshotId,
      groupId: competitorGroupId,
      store,
      country,
      mode: "fast",
      loadedAt: hoursAgo(2),
      appInsights: [
        {
          appKey: ownCompetitorRecord.appKey,
          role: "own",
          app: ownCompetitorRecord,
          rankings: ownDiscovery.rankings,
          suggestions: ownDiscovery.suggestions,
          top10: 6,
          top30: 6,
          top100: 6,
          averageRank: 4,
          strongestKeyword: ownDiscovery.rankings[0],
          bestSuggestion: ownDiscovery.suggestions[0],
        },
        {
          appKey: rivalCompetitorRecord.appKey,
          role: "competitor",
          app: rivalCompetitorRecord,
          rankings: competitorDiscovery.rankings,
          suggestions: competitorDiscovery.suggestions,
          top10: 5,
          top30: 5,
          top100: 5,
          averageRank: 5,
          strongestKeyword: competitorDiscovery.rankings[0],
          bestSuggestion: competitorDiscovery.suggestions[0],
        },
      ],
      sharedBattles: [
        {
          keyword: "christian meditation",
          rankedApps: [
            {
              ...competitorDiscovery.rankings[1],
              appKey: rivalCompetitorRecord.appKey,
              appTitle: rivalCompetitorRecord.title,
              role: "competitor",
            },
            {
              keyword: "christian meditation",
              rank: 5,
              volume: 68,
              difficulty: 29,
              relevance: 83,
              appKey: ownCompetitorRecord.appKey,
              appTitle: ownCompetitorRecord.title,
              role: "own",
            },
          ],
          leader: {
            ...competitorDiscovery.rankings[1],
            appKey: rivalCompetitorRecord.appKey,
            appTitle: rivalCompetitorRecord.title,
            role: "competitor",
          },
          runnerUp: {
            keyword: "christian meditation",
            rank: 5,
            volume: 68,
            difficulty: 29,
            relevance: 83,
            appKey: ownCompetitorRecord.appKey,
            appTitle: ownCompetitorRecord.title,
            role: "own",
          },
          gap: 3,
          averageVolume: 68,
          averageDifficulty: 29,
          averageRelevance: 86,
        },
      ],
      gapOpportunities: [
        {
          keyword: "night prayer app",
          leader: {
            keyword: "night prayer app",
            rank: 3,
            volume: 58,
            difficulty: 23,
            relevance: 84,
            appKey: rivalCompetitorRecord.appKey,
            appTitle: rivalCompetitorRecord.title,
            role: "competitor",
          },
          missingApps: [ownCompetitorRecord.title],
          rankedApps: [
            {
              keyword: "night prayer app",
              rank: 3,
              volume: 58,
              difficulty: 23,
              relevance: 84,
              appKey: rivalCompetitorRecord.appKey,
              appTitle: rivalCompetitorRecord.title,
              role: "competitor",
            },
          ],
          averageVolume: 58,
          averageDifficulty: 23,
          averageRelevance: 84,
          score: 87,
          isWhitespace: false,
        },
      ],
    },
  ];
  const competitorTrackedKeywords: CompetitorTrackedKeywordRecord[] = [
    {
      trackedKeywordId: competitorTrackedKeywordId,
      groupId: competitorGroupId,
      keyword: "christian meditation",
      store,
      country,
      apps: [
        {
          ...ownCompetitorRecord,
          lastRank: 5,
          lastChecked: hoursAgo(2),
          lastCheckStatus: "ok",
        },
        {
          ...rivalCompetitorRecord,
          lastRank: 2,
          lastChecked: hoursAgo(2),
          lastCheckStatus: "ok",
        },
      ],
      createdAt: hoursAgo(30),
      updatedAt: hoursAgo(2),
      lastCheckedAt: hoursAgo(2),
    },
  ];
  const competitorRankHistory = [
    ...createDemoCompetitorRankHistoryEntries({
      trackedKeywordId: competitorTrackedKeywordId,
      groupId: competitorGroupId,
      keyword: "christian meditation",
      appId: ownApp.appId,
      appKey: ownCompetitorRecord.appKey,
      store,
      country,
      ranks: [11, 10, 9, 8, 7, 6, 5],
    }),
    ...createDemoCompetitorRankHistoryEntries({
      trackedKeywordId: competitorTrackedKeywordId,
      groupId: competitorGroupId,
      keyword: "christian meditation",
      appId: competitorApp.appId,
      appKey: rivalCompetitorRecord.appKey,
      store,
      country,
      ranks: [4, 4, 3, 3, 3, 2, 2],
    }),
  ];

  return {
    store,
    country,
    selectedApp: ownApp,
    autoRankings: ownDiscovery.rankings,
    keywordSuggestions: ownDiscovery.suggestions,
    bookmarks,
    comparedApps: [competitorApp, benchmarkApp],
    compareDiscoveries: {
      [getCompareAppKey(competitorApp, store)]: competitorDiscovery,
      [getCompareAppKey(benchmarkApp, store)]: benchmarkDiscovery,
    },
    trackedApps,
    appAnalysisSnapshots: [
      createAppAnalysisSnapshot(ownApp, store, country, ownDiscovery),
      createAppAnalysisSnapshot(competitorApp, store, country, competitorDiscovery),
      createAppAnalysisSnapshot(benchmarkApp, store, country, benchmarkDiscovery),
    ],
    trackedKeywords,
    rankHistory,
    competitorGroups,
    competitorGroupSnapshots,
    competitorTrackedKeywords,
    competitorRankHistory,
    competitorDraftOwnApp: ownApp,
    competitorDraftApps: [competitorApp],
    competitorDraftAnalysis: competitorGroupSnapshots[0],
    competitorDraftSelectedKeywords: [
      {
        keyword: "christian meditation",
        selectedCountries: [country],
      },
      {
        keyword: "night prayer app",
        selectedCountries: [country],
      },
    ],
    trackingSchedule: {
      enabled: true,
      time: DEFAULT_GLOBAL_TRACKING_TIME,
      timezone: GLOBAL_TRACKING_TIMEZONE,
      lastRunAt: hoursAgo(2),
      lastRunKey: hoursAgo(2).slice(0, 10),
    },
    weeklyReportSettings: getDefaultWeeklyReportSettings(),
  };
}

const COMPETITOR_GROUP_HISTORY_LIMIT = 8;

type CompetitorDraftKeywordSelection = {
  keyword: string;
  selectedCountries: string[];
};

function normalizeCompetitorDraftKeywordSelections(
  input: unknown,
  fallbackCountry: string,
): CompetitorDraftKeywordSelection[] {
  if (!Array.isArray(input)) return [];
  const byKeyword = new Map<string, CompetitorDraftKeywordSelection>();
  input.forEach((entry) => {
    if (typeof entry === "string") {
      const keyword = entry.trim();
      if (!keyword) return;
      byKeyword.set(keyword.toLowerCase(), {
        keyword,
        selectedCountries: [normalizeCountryCode(fallbackCountry, "us")],
      });
      return;
    }
    if (!entry || typeof entry !== "object") return;
    const candidate = entry as Partial<CompetitorDraftKeywordSelection>;
    if (typeof candidate.keyword !== "string" || !candidate.keyword.trim()) return;
    const selectedCountries = Array.isArray(candidate.selectedCountries)
      ? Array.from(
          new Set(
            candidate.selectedCountries.map((countryCode) =>
              normalizeCountryCode(countryCode, fallbackCountry),
            ),
          ),
        ).sort((a, b) => a.localeCompare(b))
      : [];
    if (selectedCountries.length === 0) return;
    byKeyword.set(candidate.keyword.trim().toLowerCase(), {
      keyword: candidate.keyword.trim(),
      selectedCountries,
    });
  });
  return Array.from(byKeyword.values()).sort((a, b) =>
    a.keyword.localeCompare(b.keyword),
  );
}

function getKeywordSuggestionScore(suggestion: KeywordSuggestion) {
  return (
    (suggestion.relevance ?? 0) * 0.55 +
    (suggestion.demand ?? suggestion.volume ?? 0) * 0.25 -
    (suggestion.difficulty ?? 50) * 0.2
  );
}

function getEstimatedDemand(metric?: KeywordMetrics | null) {
  return metric?.demand ?? metric?.volume;
}

function createCompetitorGroupId() {
  return `comp-group-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function createCompetitorGroupSnapshotId(groupId: string) {
  return `${groupId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createCompetitorGroupAppRecord(
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

function toCompetitorGroupAppDetails(
  app: CompetitorGroupAppRecord,
): AppDetails {
  return {
    title: app.title,
    appId: app.appId,
    id: app.store === "ios" && Number.isFinite(Number(app.appId))
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

function normalizeCompetitorGroupAppRecord(
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

function normalizeCompetitorAnalysisInsight(
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

function normalizeCompetitorSharedBattle(
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
      return [{
        ...entry,
        rank: Number(entry.rank),
        role,
      }];
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

function normalizeCompetitorGapOpportunity(
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
          return [{
            ...entry,
            rank: Number(entry.rank),
            role,
          }];
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
            candidate.leader.role === "own" ? "own" : "competitor";
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
          (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
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

function normalizeCompetitorGroups(input: unknown): CompetitorGroupRecord[] {
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

function normalizeCompetitorGroupSnapshots(
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
            .filter(
              (entry): entry is CompetitorSharedBattle => Boolean(entry),
            )
        : [],
      gapOpportunities: Array.isArray(candidate.gapOpportunities)
        ? candidate.gapOpportunities
            .map((entry) => normalizeCompetitorGapOpportunity(entry))
            .filter(
              (entry): entry is CompetitorGapOpportunity => Boolean(entry),
            )
        : [],
    });
  });
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.loadedAt).getTime() - new Date(a.loadedAt).getTime(),
  );
}

function upsertCompetitorGroupRecord(
  existing: CompetitorGroupRecord[],
  incoming: CompetitorGroupRecord,
) {
  return normalizeCompetitorGroups(
    existing.filter((group) => group.groupId !== incoming.groupId).concat(incoming),
  );
}

function upsertCompetitorGroupSnapshot(
  existing: CompetitorGroupSnapshotRecord[],
  incoming: CompetitorGroupSnapshotRecord,
) {
  const filtered = existing.filter((snapshot) => snapshot.snapshotId !== incoming.snapshotId);
  const sameGroup = [incoming]
    .concat(filtered.filter((snapshot) => snapshot.groupId === incoming.groupId))
    .sort((a, b) => new Date(b.loadedAt).getTime() - new Date(a.loadedAt).getTime())
    .slice(0, COMPETITOR_GROUP_HISTORY_LIMIT);
  const otherGroups = filtered.filter(
    (snapshot) => snapshot.groupId !== incoming.groupId,
  );
  return normalizeCompetitorGroupSnapshots(otherGroups.concat(sameGroup));
}

function normalizeTrackedKeywordStatus(
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
  return lastRank === -1 ? "pending" : "ok";
}

function createCompetitorTrackedKeywordId(
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

function getCompetitorTrackedKeywordKey({
  groupId,
  keyword,
  country,
}: Pick<CompetitorTrackedKeywordRecord, "groupId" | "keyword" | "country">) {
  return `${groupId}:${normalizeCountryCode(country, "us")}:${keyword.toLowerCase()}`;
}

function getCompetitorChartDataKey(appKey: string) {
  return `rank_${appKey.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

function normalizeCompetitorTrackedKeywordAppRecord(
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

function normalizeCompetitorAsoLatestSnapshots(
  input: unknown,
): CompetitorAsoSnapshotRecord[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const candidate = entry as Partial<CompetitorAsoSnapshotRecord>;
    const payloadCandidate =
      candidate.payload && typeof candidate.payload === "object"
        ? candidate.payload
        : null;
    if (
      typeof candidate.snapshotId !== "string" ||
      !candidate.snapshotId.trim() ||
      typeof candidate.groupId !== "string" ||
      !candidate.groupId.trim() ||
      typeof candidate.appId !== "string" ||
      !candidate.appId.trim() ||
      typeof candidate.appKey !== "string" ||
      !candidate.appKey.trim() ||
      typeof candidate.appTitle !== "string" ||
      !candidate.appTitle.trim()
    ) {
      return [];
    }
    return [
      {
        snapshotId: candidate.snapshotId,
        groupId: candidate.groupId,
        appId: candidate.appId,
        appKey: candidate.appKey,
        appTitle: candidate.appTitle.trim(),
        store: candidate.store === "ios" ? "ios" : "android",
        country: normalizeCountryCode(candidate.country, "us"),
        capturedAt:
          typeof candidate.capturedAt === "string" && candidate.capturedAt
            ? candidate.capturedAt
            : new Date(0).toISOString(),
        payload: {
          title:
            typeof payloadCandidate?.title === "string"
              ? payloadCandidate.title
              : "",
          description:
            typeof payloadCandidate?.description === "string"
              ? payloadCandidate.description
              : "",
          icon:
            typeof payloadCandidate?.icon === "string"
              ? payloadCandidate.icon
              : "",
          category:
            typeof payloadCandidate?.category === "string"
              ? payloadCandidate.category
              : "",
          screenshots: Array.isArray(payloadCandidate?.screenshots)
            ? payloadCandidate.screenshots.filter(
                (item): item is string =>
                  typeof item === "string" && item.trim().length > 0,
              )
            : [],
        },
      },
    ];
  });
}

function normalizeCompetitorTrackedKeywords(
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

function normalizeCompetitorRankHistory(
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
    return [{
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
    }];
  });
}

function mergeCompetitorTrackedKeywordCollections(
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
        new Date(app.lastChecked).getTime() >= new Date(current.lastChecked).getTime()
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
        new Date(current.createdAt).getTime() <= new Date(entry.createdAt).getTime()
          ? current.createdAt
          : entry.createdAt,
      updatedAt:
        new Date(current.updatedAt).getTime() >= new Date(entry.updatedAt).getTime()
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

function getCompetitorRankHistoryEntryKey(entry: CompetitorRankHistoryEntry) {
  return `${entry.trackedKeywordId}:${entry.appKey}:${getTrackingHistoryDayKey(entry.timestamp)}`;
}

function mergeCompetitorRankHistoryEntries(
  existing: CompetitorRankHistoryEntry[],
  incoming: CompetitorRankHistoryEntry[],
) {
  const byKey = new Map<string, CompetitorRankHistoryEntry>();
  [...existing, ...incoming]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .forEach((entry) => {
      byKey.set(getCompetitorRankHistoryEntryKey(entry), entry);
    });
  return Array.from(byKey.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

function getCompetitorGroupLabel(group: CompetitorGroupRecord) {
  return [group.ownApp.title, ...group.competitors.map((app) => app.title)].join(
    " vs ",
  );
}

function getCompetitorGroupSignature(
  ownAppKey: string,
  competitorAppKeys: string[],
  store: StoreType,
  country: string,
) {
  return [
    store,
    normalizeCountryCode(country, "us"),
    ownAppKey,
    ...[...competitorAppKeys].sort(),
  ].join("|");
}

function buildCompetitorAnalysisInsights(
  apps: CompetitorGroupAppRecord[],
  discoveries: Record<string, DiscoveryPayload>,
): CompetitorAnalysisInsight[] {
  return apps.map((app) => {
    const discovery = discoveries[app.appKey];
    const rankings = discovery?.rankings ?? [];
    const suggestions = discovery?.suggestions ?? [];
    const top10 = rankings.filter((item) => item.rank <= 10).length;
    const top30 = rankings.filter((item) => item.rank <= 30).length;
    const top100 = rankings.filter((item) => item.rank <= 100).length;
    const averageRank =
      rankings.length > 0
        ? Math.round(
            rankings.reduce((sum, item) => sum + item.rank, 0) / rankings.length,
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
    return {
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
    };
  });
}

function buildCompetitorKeywordCoverage(
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

function buildCompetitorSharedBattles(
  coverageEntries: CompetitorKeywordCoverageEntry[],
): CompetitorSharedBattle[] {
  return coverageEntries
    .filter((entry) => entry.rankings.length >= 2)
    .map((entry) => {
      const rankedApps = [...entry.rankings].sort((a, b) => a.rank - b.rank);
      const leader = rankedApps[0];
      const runnerUp = rankedApps[1];
      const metricSource = entry.rankings.length > 0
        ? entry.rankings
        : entry.suggestions;
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

function buildCompetitorGapRows(
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
      const metricSource = entry.rankings.length > 0
        ? entry.rankings
        : entry.suggestions;
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
    .slice(0, 12);
}

function createCompetitorGroupSnapshot(
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

function getTrackedAppKindLabel(kind: TrackedAppKind) {
  return kind === "competitor" ? "Competitor" : "Own App";
}

function slugifyFilenamePart(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "export"
  );
}

function escapeCsvValue(value: CsvValue) {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function rowsToCsv(rows: CsvRow[]) {
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

function downloadTextFile(content: string, mimeType: string, filename: string) {
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

function getRankHistoryKey(entry: RankHistoryEntry) {
  return `${resolveTrackingGroupId({ groupId: entry.groupId, appId: entry.appId, keyword: entry.keyword, store: entry.store })}:${entry.store}:${entry.country}:${entry.appId}:${entry.keyword.toLowerCase()}:${entry.rank}:${entry.timestamp}`;
}

function getTrackingHistoryDayKey(timestamp: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TRACKING_CHART_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp));
  const lookup = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function formatTrackingChartDate(timestamp: string | Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(new Date(timestamp));
}

function formatTrackingChartDateTime(timestamp: string | Date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function createTrackedChartHistoryEntry(
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

function getTrackedHistoryEntryKey(
  entry: Pick<
    RankHistoryEntry,
    "groupId" | "store" | "country" | "appId" | "keyword" | "timestamp"
  >,
) {
  return `${resolveTrackingGroupId({ groupId: entry.groupId, appId: entry.appId, keyword: entry.keyword, store: entry.store })}:${entry.store}:${entry.country}:${entry.appId}:${entry.keyword.toLowerCase()}:${getTrackingHistoryDayKey(entry.timestamp)}`;
}

function mergeTrackedHistoryEntries(
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

function buildTrackedKeywordChartHistory(
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

function buildTrackedAppChartHistory(
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

function getChartHistoryMovement(history: ChartRankHistoryEntry[]) {
  if (history.length < 2) return 0;
  const previous = history[history.length - 2];
  const current = history[history.length - 1];
  return previous.rank - current.rank;
}

function mergeRankHistoryEntries(
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

function mergeTrackedKeywordCollections(
  existing: TrackedKeyword[],
  incoming: TrackedKeyword[],
) {
  const byKey = new Map<string, TrackedKeyword>();
  [...existing, ...incoming].forEach((trackedKeyword) => {
    const key = getTrackedKeywordKey(trackedKeyword);
    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, trackedKeyword);
      return;
    }
    const currentTime = new Date(current.lastChecked).getTime();
    const nextTime = new Date(trackedKeyword.lastChecked).getTime();
    byKey.set(key, nextTime >= currentTime ? trackedKeyword : current);
  });
  return Array.from(byKey.values());
}

function getTrackedRankDisplay(trackedKeyword: TrackedKeyword) {
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
    className: "text-app-text-muted",
  };
}

function normalizeTrackingScheduleState(
  schedule?: Partial<TrackingSchedule>,
): TrackingSchedule {
  return normalizeSharedTrackingScheduleState(schedule);
}

function normalizeWeeklyReportEmailSettings(
  settings?: Partial<WeeklyReportSettings>,
  fallbackTimezone = getBrowserTimeZone(),
): WeeklyReportSettings {
  return normalizeWeeklyReportSettingsState(settings, fallbackTimezone);
}

function readLegacyLocalUserState() {
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

function getBrowserNotificationPermission():
  | NotificationPermission
  | "unsupported" {
  return "Notification" in window ? Notification.permission : "unsupported";
}

function isLocalNotificationHost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  );
}

function isNotificationSecureContext() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.isSecureContext || isLocalNotificationHost(window.location.hostname);
}

async function getNotificationTokenId(token: string) {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    return null;
  }
  const digest = await window.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hasPersistedUserState(
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
      Array.isArray(state.competitorAsoLatestSnapshots) ||
      Array.isArray(state.competitorTrackedKeywords) ||
      Array.isArray(state.competitorRankHistory) ||
      Array.isArray(state.alertRules) ||
      state.trackingSchedule ||
      state.notificationSettings ||
      state.legalAcceptedAt ||
      state.legalVersion,
  );
}

function serializeUserStateForFirestore(state: UserAppStateDocument) {
  return serializeEditableUserStateForApi(state);
}

function formatAlertEventTime(timestamp: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(timestamp));
  } catch {
    return timestamp;
  }
}

type NotificationDiagnosticTone = "good" | "warn" | "bad" | "neutral";

type NotificationDiagnosticItem = {
  label: string;
  value: string;
  tone: NotificationDiagnosticTone;
};

type NotificationServerStatus = {
  adminConfigured: boolean;
  tokenCount: number;
  lastTokenUpdatedAt?: string | null;
};

type PersistUserStateResponse = {
  success: boolean;
  planLimits?: PlanLimits;
  usage?: BillingStatus["usage"];
  stateVersion?: number;
  serverUpdatedAt?: string;
};

type NotificationTestResult = {
  delivered: number;
  failed: number;
  reasons?: string[];
};

type TrackedKeywordRefreshResponse = {
  trackedKeyword: TrackedKeyword;
  alertEvents?: AlertEvent[];
};

function getNotificationDiagnosticToneClass(tone: NotificationDiagnosticTone) {
  switch (tone) {
    case "good":
      return "border-cyan-500/25 bg-cyan-500/10 text-cyan-200";
    case "warn":
      return "border-amber-500/25 bg-amber-500/10 text-amber-200";
    case "bad":
      return "border-red-500/25 bg-red-500/10 text-red-200";
    default:
      return "border-app-border/60 bg-app-surface-muted/70 text-app-text-muted";
  }
}

function getCompetitorAsoFieldLabel(field: CompetitorAsoFieldName) {
  switch (field) {
    case "title":
      return "Title";
    case "description":
      return "Description";
    case "icon":
      return "Icon";
    case "category":
      return "Category";
    case "screenshots":
      return "Screenshots";
  }
}

function formatCompetitorAsoValue(
  field: CompetitorAsoFieldName,
  value: string | string[] | null,
) {
  if (field === "screenshots") {
    return Array.isArray(value)
      ? `${value.length} screenshot${value.length === 1 ? "" : "s"}`
      : "0 screenshots";
  }
  if (typeof value !== "string" || !value.trim()) {
    return "-";
  }
  return value.length > 120 ? `${value.slice(0, 117)}...` : value;
}

function getCompetitorAsoScreenshotPreviewList(
  value: string | string[] | null,
  limit = 3,
) {
  return Array.isArray(value)
    ? value
        .filter(
          (entry): entry is string =>
            typeof entry === "string" && entry.trim().length > 0,
        )
        .slice(0, limit)
    : [];
}

type CompetitorAsoAlertGroupView = {
  groupId: string;
  title: string;
  store: StoreType;
  competitorApps: CompetitorGroupAppRecord[];
  countries: string[];
};

function normalizeAppDetails(app: any, store: StoreType): AppDetails {
  return {
    ...app,
    category: store === "ios" ? app.primaryGenre || app.genre : app.genre,
    screenshots: Array.isArray(app?.screenshots)
      ? app.screenshots.filter(
          (entry: unknown): entry is string =>
            typeof entry === "string" && entry.trim().length > 0,
        )
      : [],
  };
}
async function fetchJson<T>(
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
async function mapWithConcurrency<T, R>(
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
function getAuthErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was cancelled.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in popup.";
    case "auth/unauthorized-domain":
      return "This local URL is not authorized in Firebase Auth. Use localhost or add this domain in Firebase Authorized Domains.";
    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled in Firebase Auth yet.";
    case "auth/admin-restricted-operation":
      return "This sign-in method is restricted by your Firebase project settings.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a few minutes.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Authentication failed. Check your Firebase auth providers and try again.";
  }
}
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5">
      {" "}
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.68-.06-1.34-.19-1.97H12v3.73h5.39a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.98-4.3 2.98-7.28Z"
      />{" "}
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.44l-3.23-2.5c-.9.6-2.04.96-3.39.96-2.6 0-4.8-1.76-5.58-4.12H3.08v2.58A10 10 0 0 0 12 22Z"
      />{" "}
      <path
        fill="#FBBC04"
        d="M6.42 13.9A6 6 0 0 1 6.1 12c0-.66.12-1.3.32-1.9V7.52H3.08A10 10 0 0 0 2 12c0 1.6.38 3.1 1.08 4.48l3.34-2.58Z"
      />{" "}
      <path
        fill="#EA4335"
        d="M12 5.98c1.47 0 2.8.5 3.84 1.48l2.88-2.88C16.95 2.94 14.7 2 12 2a10 10 0 0 0-8.92 5.52L6.42 10.1C7.2 7.74 9.4 5.98 12 5.98Z"
      />{" "}
    </svg>
  );
}
function CountrySearchSelect({
  value,
  onChange,
  options,
  ariaLabel,
  includeAllOption,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: CountryOption[];
  ariaLabel: string;
  includeAllOption?: CountryOption;
  className?: string;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const [menuStyle, setMenuStyle] = React.useState<React.CSSProperties | null>(
    null,
  );
  const fullOptions = React.useMemo(
    () => (includeAllOption ? [includeAllOption, ...options] : options),
    [includeAllOption, options],
  );
  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return fullOptions;
    return fullOptions.filter(
      (option) =>
        option.name.toLowerCase().includes(normalizedQuery) ||
        option.code.toLowerCase().includes(normalizedQuery),
    );
  }, [fullOptions, query]);
  const selectedLabel = React.useMemo(() => {
    const selected = fullOptions.find((option) => option.code === value);
    return selected ? selected.name : value.toUpperCase();
  }, [fullOptions, value]);
  const updateMenuPosition = React.useCallback(() => {
    if (typeof window === "undefined" || !triggerRef.current) {
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const desiredWidth = Math.max(rect.width, 256);
    const width = Math.min(desiredWidth, viewportWidth - 32);
    const left = Math.min(
      Math.max(16, rect.left),
      Math.max(16, viewportWidth - width - 16),
    );
    const spaceBelow = viewportHeight - rect.bottom - 16;
    const spaceAbove = rect.top - 16;
    const openUpward = spaceBelow < 280 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      180,
      Math.min(320, (openUpward ? spaceAbove : spaceBelow) - 8),
    );
    const top = openUpward
      ? Math.max(16, rect.top - maxHeight - 8)
      : Math.min(rect.bottom + 8, viewportHeight - maxHeight - 16);

    setMenuStyle({
      left,
      maxHeight,
      position: "fixed",
      top,
      width,
      zIndex: 1200,
    });
  }, []);
  React.useEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return;
    }
    updateMenuPosition();
    const handleViewportChange = () => updateMenuPosition();
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (
        target &&
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isOpen, updateMenuPosition]);
  const menu = isOpen && menuStyle && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={menuRef}
          style={menuStyle}
          className="rounded-2xl border border-app-border/70 bg-app-surface/95 p-3 shadow-2xl backdrop-blur-xl"
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search countries..."
            className="input-field mb-3 w-full py-2"
            autoFocus
          />
          <div
            className="space-y-1 overflow-y-auto"
            style={{ maxHeight: Math.max(120, Number(menuStyle.maxHeight || 0) - 72) }}
          >
            {filteredOptions.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => {
                  onChange(option.code);
                  setIsOpen(false);
                  setQuery("");
                }}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${value === option.code ? "bg-cyan-500/15 text-cyan-200" : "text-app-text-muted hover:bg-app-surface-muted/80"}`}
              >
                <div className="font-medium">{option.name}</div>
                <div className="text-xs uppercase text-app-text-muted">
                  {option.code}
                </div>
              </button>
            ))}
            {filteredOptions.length === 0 ? (
              <div className="rounded-xl px-3 py-4 text-sm text-app-text-muted">
                No countries match your search.
              </div>
            ) : null}
          </div>
        </div>,
        document.body,
      )
    : null;
  return (
    <div className={`relative ${className || ""}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        onClick={() => setIsOpen((prev) => !prev)}
        className="workspace-select-trigger input-field w-full text-left flex items-center justify-between gap-2 py-1.5 text-xs sm:py-2 sm:text-sm"
      >
        <span className="truncate">{selectedLabel}</span>
        <span className="text-[10px] uppercase text-app-text-muted sm:text-xs">
          {value.toUpperCase()}
        </span>
      </button>{" "}
      {menu}
    </div>
  );
}
function CountryMultiSelectModal({
  disabledCountries,
  isOpen,
  keyword,
  selectedCountries,
  onToggleCountry,
  onClose,
  onSubmit,
  options,
  isSubmitting,
  title = "Track keyword by country",
  description,
  selectedLabel = "Selected",
  disabledLabel = "Tracked",
  addLabel = "Add",
  submitLabel = "Track Countries",
}: {
  disabledCountries: string[];
  isOpen: boolean;
  keyword: string;
  selectedCountries: string[];
  onToggleCountry: (country: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  options: CountryOption[];
  isSubmitting: boolean;
  title?: string;
  description?: React.ReactNode;
  selectedLabel?: string;
  disabledLabel?: string;
  addLabel?: string;
  submitLabel?: string;
}) {
  const [query, setQuery] = React.useState("");
  React.useEffect(() => {
    if (!isOpen) {
      setQuery("");
    }
  }, [isOpen]);
  const priorityOptions = React.useMemo(() => {
    const byCode = new Map(options.map((option) => [option.code, option]));
    return PRIORITY_TRACKING_COUNTRY_CODES.flatMap((countryCode) => {
      const option = byCode.get(countryCode);
      return option ? [option] : [];
    });
  }, [options]);
  const nonPriorityOptions = React.useMemo(() => {
    const priorityCodes = new Set<string>(PRIORITY_TRACKING_COUNTRY_CODES);
    return options.filter((option) => !priorityCodes.has(option.code));
  }, [options]);
  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter(
      (option) =>
        option.name.toLowerCase().includes(normalizedQuery) ||
        option.code.toLowerCase().includes(normalizedQuery),
    );
  }, [options, query]);
  const renderCountryButton = React.useCallback(
    (option: CountryOption) => {
      const isSelected = selectedCountries.includes(option.code);
      const isDisabled = disabledCountries.includes(option.code);
      return (
        <button
          key={option.code}
          type="button"
          onClick={() => {
            if (!isDisabled) {
              onToggleCountry(option.code);
            }
          }}
          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${isSelected ? "bg-cyan-500/15 text-cyan-200" : isDisabled ? "cursor-not-allowed text-slate-600" : "text-app-text-muted hover:bg-app-surface-muted/80"}`}
        >
          <div>
            <div className="font-medium">{option.name}</div>
            <div className="text-xs uppercase text-app-text-muted">
              {option.code}
            </div>
          </div>
          <div
            className={`text-xs font-semibold ${isSelected ? "text-cyan-300" : "text-app-text-muted"}`}
          >
            {isSelected ? selectedLabel : isDisabled ? disabledLabel : addLabel}
          </div>
        </button>
      );
    },
    [
      addLabel,
      disabledCountries,
      disabledLabel,
      onToggleCountry,
      selectedCountries,
      selectedLabel,
    ],
  );
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-app-surface/80 px-4 backdrop-blur-sm">
      {" "}
      <div className="w-full max-w-2xl rounded-3xl border border-app-border/70 bg-app-surface/95 p-6 shadow-2xl">
        {" "}
        <div className="flex items-start justify-between gap-4">
          {" "}
          <div>
            {" "}
            <h3 className="font-display text-xl font-bold text-app-text">
              {title}
            </h3>{" "}
            <p className="mt-2 text-sm text-app-text-muted">
              {description ?? (
                <>
                  {" "}
                  Select countries for{" "}
                  <span className="font-medium text-cyan-300">"{keyword}"</span>
                  .{" "}
                </>
              )}
            </p>{" "}
          </div>{" "}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-app-text-muted transition-colors hover:bg-white/5 hover:text-app-text"
          >
            {" "}
            <X className="w-4 h-4" />{" "}
          </button>{" "}
        </div>{" "}
        <div className="mt-5">
          {" "}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search countries..."
            className="input-field py-3 w-full"
            autoFocus
          />{" "}
        </div>{" "}
        <div className="mt-4 flex flex-wrap gap-2">
          {" "}
          {disabledCountries.map((countryCode) => (
            <span
              key={`tracked-${countryCode}`}
              className="rounded-full border border-app-border/70 bg-app-surface/60 px-3 py-1 text-xs text-app-text-muted"
            >
              {findCountryName(countryCode)} already tracked
            </span>
          ))}{" "}
          {selectedCountries.map((countryCode) => (
            <span
              key={countryCode}
              className="badge badge-cyan px-3 py-1 text-xs"
            >
              {" "}
              {findCountryName(countryCode)}{" "}
            </span>
          ))}{" "}
          {selectedCountries.length === 0 && (
            <span className="text-xs text-app-text-muted">
              Choose at least one country.
            </span>
          )}{" "}
        </div>{" "}
        <div className="mt-4 max-h-80 overflow-y-auto space-y-3 rounded-2xl border border-app-border/60 bg-app-surface-muted/40 p-3">
          {query.trim() ? (
            <>
              {filteredOptions.map(renderCountryButton)}
            </>
          ) : (
            <>
              <div>
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
                  Main Markets
                </p>
                <div className="space-y-2">
                  {priorityOptions.map(renderCountryButton)}
                </div>
              </div>
              <div className="border-t border-app-border/50 pt-3">
                <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                  All Countries
                </p>
                <div className="space-y-2">
                  {nonPriorityOptions.map(renderCountryButton)}
                </div>
              </div>
            </>
          )}
          {filteredOptions.length === 0 && (
            <div className="rounded-xl px-3 py-4 text-sm text-app-text-muted">
              No countries match your search.
            </div>
          )}
        </div>{" "}
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {" "}
          <div className="text-xs text-app-text-muted">
            {" "}
            {selectedCountries.length} selected{" "}
          </div>{" "}
          <div className="flex gap-3">
            {" "}
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost px-4 py-2 rounded-xl"
            >
              {" "}
              Cancel{" "}
            </button>{" "}
            <button
              type="button"
              onClick={onSubmit}
              disabled={selectedCountries.length === 0 || isSubmitting}
              className="btn-primary px-4 py-2 rounded-xl disabled:opacity-50"
            >
              {" "}
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bell className="w-4 h-4" />
              )}{" "}
              {submitLabel}{" "}
            </button>{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
    </div>
  );
}
function AuthenticatedApp({
  currentUser,
  onSignOut,
  onDeleteAccount,
  initialLegalAccepted,
  onLegalAcceptedPersisted,
  themeMode,
  onToggleTheme,
  demoMode = false,
}: {
  currentUser: User;
  onSignOut: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  initialLegalAccepted: boolean;
  onLegalAcceptedPersisted: () => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  demoMode?: boolean;
}) {
  const isDemoMode = demoMode === true;
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [messagingWorkerRegistration, setMessagingWorkerRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [messagingWorkerStatus, setMessagingWorkerStatus] = useState<
    "idle" | "unsupported" | "insecure" | "registering" | "registered" | "error"
  >("idle");
  const [messagingWorkerError, setMessagingWorkerError] = useState<string | null>(
    null,
  );
  const [tokenRegistrationStatus, setTokenRegistrationStatus] = useState<
    "idle" | "registering" | "registered" | "error"
  >("idle");
  const [tokenRegistrationError, setTokenRegistrationError] = useState<
    string | null
  >(null);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission | "unsupported">(
      getBrowserNotificationPermission(),
    );
  const [storeType, setStoreType] = useState<StoreType>("android");
  const [country, setCountry] = useState("us");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<AppDetails[]>([]);
  const [selectedApp, setSelectedApp] = useState<AppDetails | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [ranking, setRanking] = useState<{
    keyword: string;
    rank: number;
    demand?: number;
    volume?: number;
    difficulty?: number;
    relevance?: number;
    confidence?: "low" | "medium" | "high";
  } | null>(null);
  const [isCheckingRank, setIsCheckingRank] = useState(false);
  const [autoRankings, setAutoRankings] = useState<
    {
      keyword: string;
      rank: number;
      demand?: number;
      volume?: number;
      difficulty?: number;
      relevance?: number;
      confidence?: "low" | "medium" | "high";
    }[]
  >([]);
  const [keywordSuggestions, setKeywordSuggestions] = useState<
    {
      keyword: string;
      demand?: number;
      volume?: number;
      difficulty?: number;
      relevance?: number;
      confidence?: "low" | "medium" | "high";
    }[]
  >([]);
  const [isDiscoveringKeywords, setIsDiscoveringKeywords] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [discoveryRunMeta, setDiscoveryRunMeta] = useState<{
    checkedKeywords?: number;
    candidateCount?: number;
    failedLookups?: number;
  }>({});
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>("fast");
  const [isAdvancedInsightsOpen, setIsAdvancedInsightsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<WorkspaceViewMode | "charts">(
    "single",
  );
  const reportDeepLinkStateRef = React.useRef<ReportsDeepLinkState | null>(
    parseReportsDeepLinkFromLocation(),
  );
  const [initialReportsDeepLinkState, setInitialReportsDeepLinkState] =
    useState<ReportsDeepLinkState | null>(reportDeepLinkStateRef.current);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 1100px)").matches;
  });
  const [comparedApps, setComparedApps] = useState<AppDetails[]>([]);
  const [compareKeyword, setCompareKeyword] = useState("");
  const [compareRankings, setCompareRankings] = useState<
    CompareRankingResult[]
  >([]);
  const [isCheckingCompareRank, setIsCheckingCompareRank] = useState(false);
  const [compareDiscoveryMode, setCompareDiscoveryMode] =
    useState<DiscoveryMode>("fast");
  const [compareDiscoveries, setCompareDiscoveries] = useState<
    Record<string, DiscoveryPayload>
  >({});
  const [isAnalyzingCompare, setIsAnalyzingCompare] = useState(false);
  const [compareAnalysisError, setCompareAnalysisError] = useState<
    string | null
  >(null);
  const [trackedApps, setTrackedApps] = useState<TrackedAppRecord[]>([]);
  const [appAnalysisSnapshots, setAppAnalysisSnapshots] = useState<
    AppAnalysisSnapshot[]
  >([]);
  const [competitorGroups, setCompetitorGroups] = useState<
    CompetitorGroupRecord[]
  >([]);
  const [competitorGroupSnapshots, setCompetitorGroupSnapshots] = useState<
    CompetitorGroupSnapshotRecord[]
  >([]);
  const [competitorAsoLatestSnapshots, setCompetitorAsoLatestSnapshots] =
    useState<CompetitorAsoSnapshotRecord[]>([]);
  const [competitorTrackedKeywords, setCompetitorTrackedKeywords] = useState<
    CompetitorTrackedKeywordRecord[]
  >([]);
  const [competitorRankHistory, setCompetitorRankHistory] = useState<
    CompetitorRankHistoryEntry[]
  >([]);
  const [competitorDraftOwnApp, setCompetitorDraftOwnApp] =
    useState<AppDetails | null>(null);
  const [competitorDraftApps, setCompetitorDraftApps] = useState<AppDetails[]>(
    [],
  );
  const [competitorGroupMode, setCompetitorGroupMode] =
    useState<DiscoveryMode>("fast");
  const [competitorDraftAnalysis, setCompetitorDraftAnalysis] =
    useState<CompetitorGroupSnapshotRecord | null>(null);
  const [competitorDraftSelectedKeywords, setCompetitorDraftSelectedKeywords] =
    useState<CompetitorDraftKeywordSelection[]>([]);
  const [competitorDraftKeywordSearch, setCompetitorDraftKeywordSearch] =
    useState("");
  const [
    competitorDraftKeywordSearchResults,
    setCompetitorDraftKeywordSearchResults,
  ] = useState<CompetitorDraftKeywordCandidate[]>([]);
  const [
    competitorTrackedKeywordSearchByGroup,
    setCompetitorTrackedKeywordSearchByGroup,
  ] = useState<Record<string, string>>({});
  const [
    competitorTrackedKeywordSearchResultsByGroup,
    setCompetitorTrackedKeywordSearchResultsByGroup,
  ] = useState<Record<string, CompetitorDraftKeywordCandidate[]>>({});
  const [
    isCheckingCompetitorTrackedKeywordByGroup,
    setIsCheckingCompetitorTrackedKeywordByGroup,
  ] = useState<Record<string, boolean>>({});
  const [isCheckingCompetitorDraftKeyword, setIsCheckingCompetitorDraftKeyword] =
    useState(false);
  const [isAnalyzingCompetitorGroup, setIsAnalyzingCompetitorGroup] =
    useState(false);
  const [competitorGroupError, setCompetitorGroupError] = useState<
    string | null
  >(null);
  const [
    expandedCompetitorTrackedKeywordGroupKeys,
    setExpandedCompetitorTrackedKeywordGroupKeys,
  ] = useState<string[]>([]);
  const [isConfirmingDeleteAccount, setIsConfirmingDeleteAccount] =
    useState(false);
  const [deleteAccountConfirmationInput, setDeleteAccountConfirmationInput] =
    useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [allRankHistory, setAllRankHistory] = useState<RankHistoryEntry[]>([]);
  const [trackSortBy, setTrackSortBy] = useState<
    "date_added" | "last_checked" | "app" | "rank_change"
  >("date_added");
  const [trackFilterApp, setTrackFilterApp] = useState<string>("all");
  const [trackFilterCountry, setTrackFilterCountry] = useState<string>("all");
  const [trackSearchTerm, setTrackSearchTerm] = useState("");
  const deferredTrackSearchTerm = React.useDeferredValue(trackSearchTerm);
  const [trackedSummaryCountryByGroup, setTrackedSummaryCountryByGroup] =
    useState<Record<string, string>>({});
  const [
    competitorSummaryCountryByKeywordGroup,
    setCompetitorSummaryCountryByKeywordGroup,
  ] = useState<Record<string, string>>({});
  const [trackedSelectedStoreByApp, setTrackedSelectedStoreByApp] = useState<
    Record<string, StoreType>
  >({});
  const [expandedTrackedGroupIds, setExpandedTrackedGroupIds] = useState<
    string[]
  >([]);
  const [expandedCompetitorGroupIds, setExpandedCompetitorGroupIds] = useState<
    string[]
  >([]);
  const [competitorWorkspaceTab, setCompetitorWorkspaceTab] = useState<
    "build" | "saved"
  >("build");
  React.useEffect(() => {
    if (competitorGroups.length === 0) {
      setCompetitorWorkspaceTab("build");
    }
  }, [competitorGroups.length]);
  const [isTrackedControlsOpen, setIsTrackedControlsOpen] = useState(false);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>(() =>
      getDefaultNotificationSettings(getBrowserNotificationPermission()),
    );
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [isLoadingAlertEvents, setIsLoadingAlertEvents] = useState(false);
  const [alertEventsError, setAlertEventsError] = useState<string | null>(null);
  const [activeAlertGroupId, setActiveAlertGroupId] = useState<string | null>(
    null,
  );
  const [activeCompetitorAsoAlertGroupId, setActiveCompetitorAsoAlertGroupId] =
    useState<string | null>(null);
  const [activeCompetitorKeywordAlertGroupKey, setActiveCompetitorKeywordAlertGroupKey] =
    useState<string | null>(null);
  const [competitorAsoDiffs, setCompetitorAsoDiffs] = useState<
    CompetitorAsoDiffRecord[]
  >([]);
  const [isLoadingCompetitorAsoHistory, setIsLoadingCompetitorAsoHistory] =
    useState(false);
  const [competitorAsoHistoryError, setCompetitorAsoHistoryError] = useState<
    string | null
  >(null);
  const [competitorAsoFieldFilterByGroup, setCompetitorAsoFieldFilterByGroup] =
    useState<Record<string, CompetitorAsoFieldName | "all">>({});
  const [competitorAsoCountryFilterByGroup, setCompetitorAsoCountryFilterByGroup] =
    useState<Record<string, string>>({});
  const [competitorAsoAppFilterByGroup, setCompetitorAsoAppFilterByGroup] =
    useState<Record<string, string>>({});
  const [alertRefreshNonce, setAlertRefreshNonce] = useState(0);
  const [notificationServerStatus, setNotificationServerStatus] =
    useState<NotificationServerStatus | null>(null);
  const [notificationServerStatusError, setNotificationServerStatusError] =
    useState<string | null>(null);
  const [isLoadingNotificationServerStatus, setIsLoadingNotificationServerStatus] =
    useState(false);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(
    null,
  );
  const [billingError, setBillingError] = useState<string | null>(null);
  const [isLoadingBillingStatus, setIsLoadingBillingStatus] = useState(false);
  const [hasLoadedBillingStatus, setHasLoadedBillingStatus] = useState(isDemoMode);
  const [isPollingBillingActivation, setIsPollingBillingActivation] =
    useState(false);
  const [billingActivationTimedOut, setBillingActivationTimedOut] =
    useState(false);
  const [hasDismissedPaywall, setHasDismissedPaywall] = useState(false);
  const [isStartingBillingCheckout, setIsStartingBillingCheckout] =
    useState(false);
  const [isOpeningBillingPortal, setIsOpeningBillingPortal] = useState(false);
  const [isSendingTestNotification, setIsSendingTestNotification] =
    useState(false);
  const [lastTestNotificationResult, setLastTestNotificationResult] =
    useState<NotificationTestResult | null>(null);
  const [chartCategories, setChartCategories] = useState<ChartCategoryOption[]>(
    [],
  );
  const [selectedChartCategoryCode, setSelectedChartCategoryCode] =
    useState<string>("");
  const [selectedChartType, setSelectedChartType] =
    useState<ChartType>("free");
  const [chartEntries, setChartEntries] = useState<ChartEntry[]>([]);
  const [isLoadingChartCategories, setIsLoadingChartCategories] =
    useState(false);
  const [isLoadingCharts, setIsLoadingCharts] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [chartLoadedAt, setChartLoadedAt] = useState<string | null>(null);
  const [isMarketSnapshotOpen, setIsMarketSnapshotOpen] = useState(false);
  const [userStateHydrated, setUserStateHydrated] = useState(false);
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false);
  const [consentChecked, setConsentChecked] = useState(initialLegalAccepted);
  const [isSavingLegalConsent, setIsSavingLegalConsent] = useState(false);
  const [isOnboardingDismissed, setIsOnboardingDismissed] = useState(false);
  const [isSetupGuideOpen, setIsSetupGuideOpen] = useState(false);
  const [legalGateView, setLegalGateView] = useState<
    "consent" | "privacy" | "terms"
  >("consent");
  const [trackCountryPickerState, setTrackCountryPickerState] = useState<{
    keyword: string;
    app: AppDetails;
    store: StoreType;
    appKind: TrackedAppKind;
    appSource: TrackedAppSource;
    currentCountry: string;
    currentRank: number;
    currentRankKnown: boolean;
    existingTrackedCountries: string[];
    selectedCountries: string[];
    competitorGroupId?: string;
    selectionKind?:
      | "tracked_add"
      | "tracked_edit"
      | "competitor_draft"
      | "competitor_tracked_edit";
  } | null>(null);
  const [isSubmittingTrackCountries, setIsSubmittingTrackCountries] =
    useState(false);
  const refreshCompetitorTrackedKeywordBatchRef = React.useRef<
    | ((
        records: CompetitorTrackedKeywordRecord[],
        errorContext: string,
      ) => Promise<
        {
          updatedRecord: CompetitorTrackedKeywordRecord;
          historyEntries: CompetitorRankHistoryEntry[];
          failedApps: string[];
        }[]
      >)
    | null
  >(null);
  const trackCompetitorDraftKeywordsRef = React.useRef<
    | ((pendingSelection?: CompetitorDraftKeywordSelection) => Promise<void>)
    | null
  >(null);
  const isApplyingUserState = React.useRef(false);
  const pushSetupErrorRef = React.useRef<string | null>(null);
  const userStatePersistQueueRef = React.useRef<Promise<void>>(Promise.resolve());
  const userStatePersistVersionRef = React.useRef(0);
  const userStatePersistTimerRef = React.useRef<number | null>(null);
  const userStateBaseVersionRef = React.useRef(0);
  const lastPersistedUserStateSignatureRef = React.useRef<string | null>(null);
  const billingActivationPollRunRef = React.useRef(0);
  const seenAlertEventIdsRef = React.useRef<Set<string>>(new Set());
  const pendingAlertFetchAnnouncementRef = React.useRef(false);
  const deleteAccountConfirmationPhrase = "delete my account";
  const paywallDismissStorageKey = `aso-paywall-dismissed:${currentUser.uid}`;
  useEffect(() => {
    if (!isDemoMode) return;
    const demoState = buildDemoWorkspaceState();
    isApplyingUserState.current = false;
    setStoreType(demoState.store);
    setCountry(demoState.country);
    setSelectedApp(demoState.selectedApp);
    setAutoRankings(demoState.autoRankings);
    setKeywordSuggestions(demoState.keywordSuggestions);
    setBookmarks(demoState.bookmarks);
    setComparedApps(demoState.comparedApps);
    setCompareDiscoveries(demoState.compareDiscoveries);
    setCompareAnalysisError(null);
    setTrackedApps(demoState.trackedApps);
    setAppAnalysisSnapshots(demoState.appAnalysisSnapshots);
    setTrackedKeywords(demoState.trackedKeywords);
    setAllRankHistory(demoState.rankHistory);
    setCompetitorGroups(demoState.competitorGroups);
    setCompetitorGroupSnapshots(demoState.competitorGroupSnapshots);
    setCompetitorAsoLatestSnapshots([]);
    setCompetitorTrackedKeywords(demoState.competitorTrackedKeywords);
    setCompetitorRankHistory(demoState.competitorRankHistory);
    setCompetitorDraftOwnApp(demoState.competitorDraftOwnApp);
    setCompetitorDraftApps(demoState.competitorDraftApps);
    setCompetitorDraftAnalysis(demoState.competitorDraftAnalysis);
    setCompetitorDraftSelectedKeywords(
      normalizeCompetitorDraftKeywordSelections(
        demoState.competitorDraftSelectedKeywords,
        demoState.country,
      ),
    );
    setTrackingSchedule(demoState.trackingSchedule);
    setWeeklyReportSettings(demoState.weeklyReportSettings);
    setAlertRules([]);
    setAlertEvents([]);
    setNotificationServerStatus(null);
    setNotificationServerStatusError(null);
    setLastTestNotificationResult(null);
    setSuccessMessage("Workspace loaded.");
    setHasAcceptedLegal(true);
    setConsentChecked(true);
    setUserStateHydrated(true);
  }, [isDemoMode]);
  const userStateDocRef = React.useMemo(
    () => doc(db, "users", currentUser.uid),
    [currentUser.uid],
  );
  const singleExportRef = React.useRef<HTMLDivElement>(null);
  const compareExportRef = React.useRef<HTMLDivElement>(null);
  const compareSearchRef = React.useRef<HTMLDivElement>(null);
  const trackedExportRef = React.useRef<HTMLDivElement>(null);
  const competitorsExportRef = React.useRef<HTMLDivElement>(null);
  const reportsExportRef = React.useRef<HTMLDivElement>(null);
  const [reportsExportSnapshot, setReportsExportSnapshot] =
    React.useState<ReportsPdfSnapshot | null>(null);
  const [isPdfExportOptionsOpen, setIsPdfExportOptionsOpen] = React.useState(false);
  const [pdfHistoryRange, setPdfHistoryRange] =
    React.useState<PdfHistoryRange>("30d");
  const [pdfExportCountryScope, setPdfExportCountryScope] =
    React.useState<string>(() => normalizeCountryCode(country, "us"));
  const [isExporting, setIsExporting] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const firebaseVapidKey = getFirebaseWebPushVapidKey();
  const isNotificationSecure = React.useMemo(
    () => isNotificationSecureContext(),
    [],
  );
  const supportsNotificationApi = React.useMemo(
    () => typeof window !== "undefined" && "Notification" in window,
    [],
  );
  const supportsServiceWorkers = React.useMemo(
    () => typeof navigator !== "undefined" && "serviceWorker" in navigator,
    [],
  );
  const fetchAuthedJson = React.useCallback(
    async <T,>(input: string, init?: RequestInit, options?: { timeoutMs?: number }) => {
      if (isDemoMode) {
        throw new Error("This action is unavailable in the current session.");
      }
      const token = await currentUser.getIdToken();
      const headers = new Headers(init?.headers || {});
      headers.set("Authorization", `Bearer ${token}`);
      return fetchJson<T>(input, { ...init, headers }, options);
    },
    [currentUser, isDemoMode],
  );
  const persistUserStateRemotely = React.useCallback(
    async (
      state: UserAppStateDocument,
      options?: {
        signature?: string;
        baseStateVersion?: number;
      },
    ) => {
      if (isDemoMode) {
        return { success: true } satisfies PersistUserStateResponse;
      }
      const payload = serializeUserStateForFirestore(state);
      const result = await fetchAuthedJson<PersistUserStateResponse>(
        "/api/user-state",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            state: payload,
            baseStateVersion: options?.baseStateVersion ?? userStateBaseVersionRef.current,
          }),
        },
      );
      if (typeof result.stateVersion === "number") {
        userStateBaseVersionRef.current = result.stateVersion;
      }
      if (options?.signature) {
        lastPersistedUserStateSignatureRef.current = options.signature;
      }
      setBillingStatus((prev) =>
        prev
          ? {
              ...prev,
              planLimits: result.planLimits || prev.planLimits,
              usage: result.usage || prev.usage,
            }
          : prev,
      );
      return result;
    },
    [fetchAuthedJson, isDemoMode],
  );
  const persistLegalAcceptanceRemotely = React.useCallback(async () => {
    await fetchAuthedJson<{ success: boolean }>(
      "/api/account/legal-acceptance",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          legalVersion: LEGAL_VERSION,
        }),
      },
    );
  }, [fetchAuthedJson]);
  const queueUserStatePersist = React.useCallback(
    (state: UserAppStateDocument, signature: string) => {
      if (isDemoMode) {
        return Promise.resolve();
      }
      if (signature === lastPersistedUserStateSignatureRef.current) {
        return Promise.resolve();
      }
      const version = userStatePersistVersionRef.current + 1;
      userStatePersistVersionRef.current = version;
      if (userStatePersistTimerRef.current !== null) {
        window.clearTimeout(userStatePersistTimerRef.current);
      }
      return new Promise<void>((resolve, reject) => {
        userStatePersistTimerRef.current = window.setTimeout(() => {
          userStatePersistTimerRef.current = null;
          userStatePersistQueueRef.current = userStatePersistQueueRef.current
            .catch(() => undefined)
            .then(async () => {
              if (version !== userStatePersistVersionRef.current) {
                return;
              }
              await persistUserStateRemotely(state, {
                signature,
                baseStateVersion: userStateBaseVersionRef.current,
              });
            });
          userStatePersistQueueRef.current.then(resolve).catch(reject);
        }, 750);
      });
    },
    [isDemoMode, persistUserStateRemotely],
  );
  useEffect(() => {
    if (userStatePersistTimerRef.current !== null) {
      window.clearTimeout(userStatePersistTimerRef.current);
      userStatePersistTimerRef.current = null;
    }
    userStatePersistQueueRef.current = Promise.resolve();
    userStatePersistVersionRef.current = 0;
    userStateBaseVersionRef.current = 0;
    lastPersistedUserStateSignatureRef.current = null;
  }, [currentUser.uid]);
  useEffect(() => {
    setHasLoadedBillingStatus(isDemoMode);
    setIsPollingBillingActivation(false);
    setBillingActivationTimedOut(false);
    billingActivationPollRunRef.current = 0;
  }, [currentUser.uid, isDemoMode]);
  useEffect(() => {
    if (typeof window === "undefined") {
      setHasDismissedPaywall(false);
      return;
    }

    setHasDismissedPaywall(
      window.sessionStorage.getItem(paywallDismissStorageKey) === "1",
    );
  }, [paywallDismissStorageKey]);
  useEffect(() => {
    const syncNotificationPermission = () => {
      setNotificationPermission(getBrowserNotificationPermission());
    };

    syncNotificationPermission();
    window.addEventListener("focus", syncNotificationPermission);
    document.addEventListener("visibilitychange", syncNotificationPermission);
    return () => {
      window.removeEventListener("focus", syncNotificationPermission);
      document.removeEventListener(
        "visibilitychange",
        syncNotificationPermission,
      );
    };
  }, []);
  useEffect(() => {
    if (isDemoMode) {
      setMessagingWorkerRegistration(null);
      setMessagingWorkerStatus("unsupported");
      setMessagingWorkerError("Notifications are unavailable in the current session.");
      return;
    }
    if (!supportsNotificationApi || !supportsServiceWorkers || !messaging) {
      setMessagingWorkerRegistration(null);
      setMessagingWorkerStatus("unsupported");
      setMessagingWorkerError(
        "This browser environment does not support Firebase web push.",
      );
      return;
    }
    if (!isNotificationSecure) {
      setMessagingWorkerRegistration(null);
      setMessagingWorkerStatus("insecure");
      setMessagingWorkerError(
        "Push notifications require HTTPS or localhost.",
      );
      return;
    }

    let cancelled = false;
    setMessagingWorkerStatus("registering");
    setMessagingWorkerError(null);

    navigator.serviceWorker
      .register("/firebase-messaging-sw.js")
      .then((registration) => {
        if (cancelled) return;
        setMessagingWorkerRegistration(registration);
        setMessagingWorkerStatus("registered");
        setMessagingWorkerError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        logError(err, { context: "registerMessagingServiceWorker" });
        setMessagingWorkerRegistration(null);
        setMessagingWorkerStatus("error");
        setMessagingWorkerError(
          err instanceof Error
            ? err.message
            : "Failed to register the messaging service worker.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    isDemoMode,
    isNotificationSecure,
    messaging,
    supportsNotificationApi,
    supportsServiceWorkers,
  ]);
  useEffect(() => {
    if (isDemoMode) {
      setFcmToken(null);
      setTokenRegistrationStatus("idle");
      setTokenRegistrationError(null);
      pushSetupErrorRef.current = null;
      return;
    }
    if (!messaging) {
      setFcmToken(null);
      return;
    }
    if (notificationPermission !== "granted") {
      setFcmToken(null);
      setTokenRegistrationStatus("idle");
      setTokenRegistrationError(null);
      pushSetupErrorRef.current = null;
      return;
    }
    if (!supportsNotificationApi || !supportsServiceWorkers) {
      setFcmToken(null);
      if (pushSetupErrorRef.current !== "unsupported") {
        pushSetupErrorRef.current = "unsupported";
        toast.error("This browser does not support Firebase web push.");
      }
      return;
    }
    if (!isNotificationSecure) {
      setFcmToken(null);
      if (pushSetupErrorRef.current !== "insecure-context") {
        pushSetupErrorRef.current = "insecure-context";
        toast.error("Push notifications require HTTPS or localhost.");
      }
      return;
    }
    if (!firebaseVapidKey) {
      setFcmToken(null);
      if (pushSetupErrorRef.current !== "missing-vapid-key") {
        pushSetupErrorRef.current = "missing-vapid-key";
        toast.error(
          "Push notifications are unavailable because the runtime VAPID key is not configured on the server.",
        );
      }
      return;
    }
    if (!messagingWorkerRegistration) {
      setFcmToken(null);
      if (
        messagingWorkerStatus === "error" &&
        pushSetupErrorRef.current !== "service-worker-failed"
      ) {
        pushSetupErrorRef.current = "service-worker-failed";
        toast.error(
          messagingWorkerError ||
            "Push notifications could not be activated because the service worker failed to register.",
        );
      }
      return;
    }

    getToken(messaging, {
      vapidKey: firebaseVapidKey,
      serviceWorkerRegistration: messagingWorkerRegistration,
    })
      .then((currentToken) => {
        if (currentToken) {
          setFcmToken(currentToken);
          pushSetupErrorRef.current = null;
        } else {
          setFcmToken(null);
          if (pushSetupErrorRef.current !== "empty-token") {
            pushSetupErrorRef.current = "empty-token";
            toast.error(
              "Push notifications could not be activated. No device token was returned.",
            );
          }
        }
      })
      .catch((err) => {
        setFcmToken(null);
        logError(err, { context: "getMessagingToken" });
        if (pushSetupErrorRef.current !== "token-request-failed") {
          pushSetupErrorRef.current = "token-request-failed";
          toast.error(
            "Push notifications could not be activated. Check browser notification settings and try again.",
          );
        }
      });
  }, [
    firebaseVapidKey,
    isDemoMode,
    isNotificationSecure,
    messaging,
    messagingWorkerError,
    messagingWorkerRegistration,
    messagingWorkerStatus,
    notificationPermission,
    supportsNotificationApi,
    supportsServiceWorkers,
  ]);
  useEffect(() => {
    if (isDemoMode || !messaging) return;
    try {
      const unsubscribe = onMessage(messaging, (payload) => {
        toast.info(payload.notification?.title || "New Notification", {
          description: payload.notification?.body,
        });
        setAlertRefreshNonce((prev) => prev + 1);
      });
      return () => unsubscribe();
    } catch (e) {
      logError(e, { context: "firebaseOnMessage" });
    }
  }, [isDemoMode, messaging]);
  const requestNotificationPermission = async (): Promise<
    NotificationPermission | "unsupported"
  > => {
    if (!supportsNotificationApi) {
      setNotificationPermission("unsupported");
      toast.error("This browser does not support desktop notifications.");
      return "unsupported";
    }
    if (!isNotificationSecure) {
      toast.error("Push notifications require HTTPS or localhost.");
      return getBrowserNotificationPermission();
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      toast.success("Notifications enabled!");
    } else {
      toast.error("Notification permission denied.");
    }
    return permission;
  };
  useEffect(() => {
      setNotificationSettings((prev) =>
        normalizeNotificationSettings(
          {
            ...prev,
            permission: notificationPermission,
          pushEnabled:
            notificationPermission === "granted" ? prev.pushEnabled : false,
        },
        notificationPermission,
        ),
      );
  }, [notificationPermission]);
  const currentPagePdfExport = React.useMemo(() => {
    const exportMode: WorkspaceViewMode =
      viewMode === "charts" ? "single" : viewMode;
    if (exportMode === "single" && selectedApp) {
      return {
        mode: exportMode,
        filename: `app-analysis-${slugifyFilenamePart(selectedApp.title)}-${storeType}-${country}.pdf`,
      };
    }
    if (exportMode === "compare" && comparedApps.length > 0) {
      return {
        mode: exportMode,
        filename: `compare-${storeType}-${country}-${comparedApps.length}-apps.pdf`,
      };
    }
    if (exportMode === "tracked") {
      return {
        mode: exportMode,
        filename: `tracked-keywords-${storeType}-${country}.pdf`,
      };
    }
    if (exportMode === "competitors") {
      return {
        mode: exportMode,
        filename: `competitor-groups-${storeType}-${country}.pdf`,
      };
    }
    if (exportMode === "reports") {
      return {
        mode: exportMode,
        filename: `reports-${storeType}-${country}.pdf`,
      };
    }
    return null;
  }, [comparedApps.length, country, selectedApp, storeType, viewMode]);
  const exportToPDF = async () => {
    const exportConfig = currentPagePdfExport;
    if (!exportConfig) {
      toast.error("This page is not ready to export yet.");
      return;
    }
    setIsExporting(true);
    try {
      const selectedCountryCodes =
        pdfExportCountryScope === PDF_EXPORT_ALL_COUNTRIES_CODE
          ? pdfExportCountryOptions.map((option) =>
              normalizeCountryCode(option.code, "us"),
            )
          : [normalizeCountryCode(pdfExportCountryScope, "us")];
      const selectedCountryLabel =
        pdfExportCountryScope === PDF_EXPORT_ALL_COUNTRIES_CODE
          ? "All tracked countries"
          : pdfExportCountryOptions.find(
              (option) => option.code === pdfExportCountryScope,
            )?.name || (findCountryName(pdfExportCountryScope) || pdfExportCountryScope);
      const countrySuffix =
        pdfExportCountryScope === PDF_EXPORT_ALL_COUNTRIES_CODE &&
        pdfExportCountryOptions.length > 1
          ? "all-countries"
          : selectedCountryCodes[0] || normalizeCountryCode(country, "us");
      const filename =
        exportConfig.mode === "single" && selectedApp
          ? `app-analysis-${slugifyFilenamePart(selectedApp.title)}-${storeType}-${countrySuffix}.pdf`
          : exportConfig.mode === "compare"
            ? `compare-${storeType}-${countrySuffix}-${comparedApps.length}-apps.pdf`
            : exportConfig.mode === "tracked"
              ? `tracked-keywords-${storeType}-${countrySuffix}.pdf`
              : exportConfig.mode === "competitors"
                ? `competitor-groups-${storeType}-${countrySuffix}.pdf`
                : `reports-${storeType}-${countrySuffix}.pdf`;
      const result = await exportDataPayloadToPdf({
        filename,
        payload: buildExportPayload(),
        settings: {
          countries: selectedCountryCodes,
          countryLabel: selectedCountryLabel,
          historyRange: pdfHistoryRange,
        },
      });
      setIsPdfExportOptionsOpen(false);
      toast.success(
        result.openedInNewTab
          ? "Opened the PDF in a new tab."
          : "Downloaded this page as PDF.",
      );
    } catch (err) {
      const exportError =
        err instanceof DataPdfExportError
          ? err
          : new DataPdfExportError(
              err instanceof Error ? err.message : "Unknown export error.",
              "Failed to export PDF. Please try again.",
            );
      logError(err, {
        context: "exportToPDF",
        viewMode,
        appId: selectedApp?.appId,
        message: exportError.message,
      });
      setError(exportError.userMessage);
    } finally {
      setIsExporting(false);
    }
  };
  const saveRankHistory = React.useCallback(
    (
      appId: string,
      keyword: string,
      rank: number,
      overrideStore?: string,
      overrideCountry?: string,
      rankDepth = 100,
    ) => {
      try {
        const newEntry: RankHistoryEntry = {
          appId,
          keyword,
          store: (overrideStore || storeType) as StoreType,
          country: overrideCountry || country,
          rank,
          rankDepth,
          timestamp: new Date().toISOString(),
        };
        setAllRankHistory((prev) => {
          return mergeRankHistoryEntries(prev, [newEntry]);
        });
      } catch (err) {
        logError(err, { context: "saveRankHistory", appId, keyword });
      }
    },
    [country, storeType],
  );
  const saveTrackedRankHistory = React.useCallback(
    (
      groupId: string,
      appId: string,
      keyword: string,
      rank: number,
      overrideStore?: string,
      overrideCountry?: string,
      rankDepth = TRACKED_KEYWORD_RANKING_DEPTH,
    ) => {
      try {
        const newEntry: RankHistoryEntry = {
          groupId,
          appId,
          keyword,
          store: (overrideStore || storeType) as StoreType,
          country: overrideCountry || country,
          rank,
          rankDepth,
          timestamp: new Date().toISOString(),
        };
        setAllRankHistory((prev) =>
          mergeTrackedHistoryEntries(prev, [newEntry]),
        );
      } catch (err) {
        logError(err, {
          context: "saveTrackedRankHistory",
          appId,
          keyword,
          groupId,
        });
      }
    },
    [country, storeType],
  );
  const trackedHistoryByKey = React.useMemo(() => {
    const historyMap = new Map<string, Map<string, ChartRankHistoryEntry>>();
    allRankHistory.forEach((entry) => {
      if (entry.isSimulated) return;
      const key = getTrackedKeywordKey(entry);
      const nextEntry = createTrackedChartHistoryEntry(
        entry.timestamp,
        entry.rank,
        entry.rankDepth ?? TRACKED_KEYWORD_RANKING_DEPTH,
      );
      const byDay =
        historyMap.get(key) ?? new Map<string, ChartRankHistoryEntry>();
      const existing = byDay.get(nextEntry.dayKey);
      if (
        !existing ||
        new Date(nextEntry.rawTimestamp).getTime() >=
          new Date(existing.rawTimestamp).getTime()
      ) {
        byDay.set(nextEntry.dayKey, nextEntry);
      }
      historyMap.set(key, byDay);
    });
    return new Map(
      Array.from(historyMap.entries()).map(([key, byDay]) => [
        key,
        Array.from(byDay.values()).sort(
          (a, b) =>
            new Date(a.rawTimestamp).getTime() -
            new Date(b.rawTimestamp).getTime(),
        ),
      ]),
    );
  }, [allRankHistory]);
  const [bookmarks, setBookmarks] = useState<AppBookmark[]>([]);
  const [trackedKeywords, setTrackedKeywords] = useState<TrackedKeyword[]>([]);
  const [trackingSchedule, setTrackingSchedule] = useState<TrackingSchedule>(
    getDefaultTrackingSchedule,
  );
  const [weeklyReportSettings, setWeeklyReportSettings] =
    useState<WeeklyReportSettings>(getDefaultWeeklyReportSettings);
  const [isWeeklyReportSettingsOpen, setIsWeeklyReportSettingsOpen] =
    useState(false);
  useEffect(() => {
    if (viewMode !== "reports") {
      setIsWeeklyReportSettingsOpen(false);
    }
  }, [viewMode]);
  useEffect(() => {
    if (isDemoMode) return;
    let cancelled = false;
    // Safety net: if Firestore is unreachable for any reason, never leave the user on a blank screen.
    const safetyTimer = window.setTimeout(() => {
      if (!cancelled) {
        setUserStateHydrated(true);
      }
    }, 8000);
    const loadUserState = async () => {
      setUserStateHydrated(false);
      isApplyingUserState.current = true;
      setBookmarks([]);
      setTrackedApps([]);
      setTrackedKeywords([]);
      setAllRankHistory([]);
      setAppAnalysisSnapshots([]);
      setCompetitorGroups([]);
      setCompetitorGroupSnapshots([]);
      setCompetitorAsoLatestSnapshots([]);
      setCompetitorTrackedKeywords([]);
      setCompetitorRankHistory([]);
      setCompetitorDraftOwnApp(null);
      setCompetitorDraftApps([]);
      setCompetitorDraftAnalysis(null);
      setCompetitorDraftSelectedKeywords([]);
      setCompetitorGroupError(null);
      setExpandedCompetitorTrackedKeywordGroupKeys([]);
      setCompetitorSummaryCountryByKeywordGroup({});
      setTrackingSchedule(getDefaultTrackingSchedule());
      setWeeklyReportSettings(getDefaultWeeklyReportSettings());
      setAlertRules([]);
      setAlertEvents([]);
      setAlertEventsError(null);
      setCompetitorAsoDiffs([]);
      setCompetitorAsoHistoryError(null);
      setCompetitorAsoFieldFilterByGroup({});
      setCompetitorAsoCountryFilterByGroup({});
      setCompetitorAsoAppFilterByGroup({});
      setNotificationSettings(
        getDefaultNotificationSettings(getBrowserNotificationPermission()),
      );
      setNotificationServerStatus(null);
      setNotificationServerStatusError(null);
      setLastTestNotificationResult(null);
      try {
        const snapshot = await getDoc(userStateDocRef);
        const remoteState = snapshot.exists()
          ? (snapshot.data() as UserAppStateDocument)
          : null;
        const legacyState = readLegacyLocalUserState();
        const hasRemoteState = hasPersistedUserState(remoteState);
        const archivedHistory = hasRemoteState
          ? await loadArchivedHistoryCollections<
              RankHistoryEntry,
              CompetitorRankHistoryEntry
            >(userStateDocRef)
          : { rankHistory: [], competitorRankHistory: [] };
        const legalAlreadyAccepted = Boolean(
          remoteState?.legalAcceptedAt &&
          remoteState?.legalVersion === LEGAL_VERSION,
        );
        const shouldPersistInitialLegalAcceptance =
          !legalAlreadyAccepted && initialLegalAccepted;
        const nextLegalAcceptedAt = shouldPersistInitialLegalAcceptance
          ? new Date().toISOString()
          : remoteState?.legalAcceptedAt;
        const nextLegalVersion =
          legalAlreadyAccepted || shouldPersistInitialLegalAcceptance
            ? LEGAL_VERSION
            : remoteState?.legalVersion;
        const nextBookmarks = hasRemoteState
          ? Array.isArray(remoteState?.bookmarks)
            ? remoteState.bookmarks
            : []
          : legacyState.bookmarks;
        const normalizedTrackedApps = normalizeTrackedApps(
          hasRemoteState ? remoteState?.trackedApps : [],
        );
        const legacyCompetitorAppKeys = new Set(
          normalizedTrackedApps
            .filter((trackedApp) => trackedApp.kind === "competitor")
            .map((trackedApp) => trackedApp.appKey),
        );
        const nextTrackedKeywords = normalizeTrackedKeywordGroupIds(
          hasRemoteState
            ? Array.isArray(remoteState?.trackedKeywords)
              ? remoteState.trackedKeywords
              : []
            : legacyState.trackedKeywords,
        ).filter(
          (trackedKeyword) =>
            !legacyCompetitorAppKeys.has(
              getTrackedAppKeyFromValues(
                trackedKeyword.appId,
                trackedKeyword.store,
              ),
            ),
        );
        const nextTrackedApps = syncOwnTrackedAppsWithTrackedKeywords(
          normalizedTrackedApps,
          nextTrackedKeywords,
        );
        const nextRankHistory = normalizeTrackedRankHistoryGroupIds(
          hasRemoteState
            ? [
                ...archivedHistory.rankHistory,
                ...(Array.isArray(remoteState?.rankHistory)
                  ? remoteState.rankHistory
                  : []),
              ]
            : legacyState.rankHistory,
          nextTrackedKeywords,
        ).filter(
          (entry) =>
            !legacyCompetitorAppKeys.has(
              getTrackedAppKeyFromValues(entry.appId, entry.store),
            ),
        );
        const nextAppAnalysisSnapshots = normalizeAppAnalysisSnapshots(
          hasRemoteState ? remoteState?.appAnalysisSnapshots : [],
        ).filter(
          (snapshot) => !legacyCompetitorAppKeys.has(snapshot.appKey),
        );
        const nextCompetitorGroups = normalizeCompetitorGroups(
          hasRemoteState ? remoteState?.competitorGroups : [],
        );
        const nextCompetitorGroupSnapshots = normalizeCompetitorGroupSnapshots(
          hasRemoteState ? remoteState?.competitorGroupSnapshots : [],
        );
        const nextCompetitorAsoLatestSnapshots =
          normalizeCompetitorAsoLatestSnapshots(
            hasRemoteState ? remoteState?.competitorAsoLatestSnapshots : [],
          ).filter((snapshot) =>
            nextCompetitorGroups.some((group) => group.groupId === snapshot.groupId),
          );
        const nextCompetitorTrackedKeywords = normalizeCompetitorTrackedKeywords(
          hasRemoteState ? remoteState?.competitorTrackedKeywords : [],
        ).filter((record) => nextCompetitorGroups.some((group) => group.groupId === record.groupId));
        const validCompetitorTrackedKeywordIds = new Set(
          nextCompetitorTrackedKeywords.map((record) => record.trackedKeywordId),
        );
        const nextCompetitorRankHistory = normalizeCompetitorRankHistory(
          hasRemoteState
            ? [
                ...archivedHistory.competitorRankHistory,
                ...(Array.isArray(remoteState?.competitorRankHistory)
                  ? remoteState.competitorRankHistory
                  : []),
              ]
            : [],
        ).filter((entry) =>
          validCompetitorTrackedKeywordIds.has(entry.trackedKeywordId),
        );
        const competitorTrackedKeywordIdsByGroup = new Map<string, string[]>();
        nextCompetitorTrackedKeywords.forEach((record) => {
          const current = competitorTrackedKeywordIdsByGroup.get(record.groupId) || [];
          current.push(record.trackedKeywordId);
          competitorTrackedKeywordIdsByGroup.set(record.groupId, current);
        });
        const normalizedCompetitorGroupsWithKeywords = nextCompetitorGroups.map(
          (group) => ({
            ...group,
            trackedKeywordIds:
              competitorTrackedKeywordIdsByGroup.get(group.groupId) || [],
          }),
        );
        const nextTrackingSchedule = normalizeTrackingScheduleState(
          hasRemoteState ? remoteState?.trackingSchedule : undefined,
        );
        const nextWeeklyReportSettings = normalizeWeeklyReportEmailSettings(
          hasRemoteState ? remoteState?.weeklyReportSettings : undefined,
          getBrowserTimeZone(),
        );
        const nextAlertRules = normalizeAlertRules(
          hasRemoteState ? remoteState?.alertRules : [],
        );
        const nextNotificationSettings = normalizeNotificationSettings(
          hasRemoteState ? remoteState?.notificationSettings : undefined,
          getBrowserNotificationPermission(),
        );
        let bootstrappedState: UserAppStateDocument | null = null;
        if (cancelled) {
          return;
        }
        if (!hasRemoteState || shouldPersistInitialLegalAcceptance) {
          const initialState: UserAppStateDocument = {
            bookmarks: nextBookmarks,
            trackedApps: nextTrackedApps,
            trackedKeywords: nextTrackedKeywords,
            rankHistory: nextRankHistory,
            appAnalysisSnapshots: nextAppAnalysisSnapshots,
            competitorGroups: normalizedCompetitorGroupsWithKeywords,
            competitorGroupSnapshots: nextCompetitorGroupSnapshots,
            competitorAsoLatestSnapshots: nextCompetitorAsoLatestSnapshots,
            competitorTrackedKeywords: nextCompetitorTrackedKeywords,
            competitorRankHistory: nextCompetitorRankHistory,
            trackingSchedule: nextTrackingSchedule,
            weeklyReportSettings: nextWeeklyReportSettings,
            alertRules: nextAlertRules,
            notificationSettings: nextNotificationSettings,
            legalAcceptedAt: nextLegalAcceptedAt,
            legalVersion: nextLegalVersion,
            migratedFromLocalAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          bootstrappedState = initialState;
          const initialSignature = JSON.stringify(
            serializeUserStateForFirestore(initialState),
          );
          const persistedState = await persistUserStateRemotely(initialState, {
            signature: initialSignature,
            baseStateVersion:
              typeof remoteState?.stateVersion === "number"
                ? remoteState.stateVersion
                : 0,
          });
          if (typeof persistedState.stateVersion === "number") {
            userStateBaseVersionRef.current = persistedState.stateVersion;
          }
          if (shouldPersistInitialLegalAcceptance) {
            await persistLegalAcceptanceRemotely();
            onLegalAcceptedPersisted();
          }
          safeStorage.removeItem("aso-bookmarks");
          safeStorage.removeItem("aso-tracked-keywords");
          safeStorage.removeItem("aso-rank-history");
        }
        if (cancelled) {
          return;
        }
        const hydratedState: UserAppStateDocument = {
          bookmarks: nextBookmarks,
          trackedApps: nextTrackedApps,
          trackedKeywords: nextTrackedKeywords,
          rankHistory: nextRankHistory,
          appAnalysisSnapshots: nextAppAnalysisSnapshots,
          competitorGroups: normalizedCompetitorGroupsWithKeywords,
          competitorGroupSnapshots: nextCompetitorGroupSnapshots,
          competitorAsoLatestSnapshots: nextCompetitorAsoLatestSnapshots,
          competitorTrackedKeywords: nextCompetitorTrackedKeywords,
          competitorRankHistory: nextCompetitorRankHistory,
          trackingSchedule: nextTrackingSchedule,
          weeklyReportSettings: nextWeeklyReportSettings,
          alertRules: nextAlertRules,
          notificationSettings: nextNotificationSettings,
          legalAcceptedAt:
            bootstrappedState?.legalAcceptedAt ?? nextLegalAcceptedAt,
          legalVersion: bootstrappedState?.legalVersion ?? nextLegalVersion,
          migratedFromLocalAt:
            bootstrappedState?.migratedFromLocalAt ?? remoteState?.migratedFromLocalAt,
        };
        userStateBaseVersionRef.current =
          typeof remoteState?.stateVersion === "number"
            ? remoteState.stateVersion
            : userStateBaseVersionRef.current;
        lastPersistedUserStateSignatureRef.current = JSON.stringify(
          serializeUserStateForFirestore(hydratedState),
        );
        setBookmarks(nextBookmarks);
        setTrackedApps(nextTrackedApps);
        setTrackedKeywords(nextTrackedKeywords);
        setAllRankHistory(nextRankHistory);
        setAppAnalysisSnapshots(nextAppAnalysisSnapshots);
        setCompetitorGroups(normalizedCompetitorGroupsWithKeywords);
        setCompetitorGroupSnapshots(nextCompetitorGroupSnapshots);
        setCompetitorAsoLatestSnapshots(nextCompetitorAsoLatestSnapshots);
        setCompetitorTrackedKeywords(nextCompetitorTrackedKeywords);
        setCompetitorRankHistory(nextCompetitorRankHistory);
        setTrackingSchedule(nextTrackingSchedule);
        setWeeklyReportSettings(nextWeeklyReportSettings);
        setAlertRules(nextAlertRules);
        setNotificationSettings(nextNotificationSettings);
        setHasAcceptedLegal(
          legalAlreadyAccepted || shouldPersistInitialLegalAcceptance,
        );
        setConsentChecked(initialLegalAccepted);
        setUserStateHydrated(true);
      } catch (err) {
        if (!cancelled) {
          logError(err, { context: "loadUserState", uid: currentUser.uid });
          toast.error("Failed to load your account data.");
          setUserStateHydrated(true);
        }
      } finally {
        if (!cancelled) {
          window.setTimeout(() => {
            isApplyingUserState.current = false;
          }, 0);
        }
      }
    };
    void loadUserState();
    return () => {
      cancelled = true;
      window.clearTimeout(safetyTimer);
    };
  }, [
    currentUser.uid,
    initialLegalAccepted,
    isDemoMode,
    onLegalAcceptedPersisted,
    persistLegalAcceptanceRemotely,
    persistUserStateRemotely,
    userStateDocRef,
  ]);
  const persistLegalAcceptance = async () => {
    if (!consentChecked) {
      toast.error(
        "You need to accept the Terms & Conditions and Privacy Policy first.",
      );
      return;
    }
    setIsSavingLegalConsent(true);
    try {
      await persistLegalAcceptanceRemotely();
      setHasAcceptedLegal(true);
      onLegalAcceptedPersisted();
      toast.success("Legal acceptance saved.");
    } catch (err) {
      logError(err, {
        context: "persistLegalAcceptance",
        uid: currentUser.uid,
      });
      toast.error("Failed to save legal acceptance.");
    } finally {
      setIsSavingLegalConsent(false);
    }
  };
  useEffect(() => {
    if (isDemoMode || !userStateHydrated || isApplyingUserState.current) return;
    const persistUserState = async () => {
      const nextState: UserAppStateDocument = {
        bookmarks,
        trackedApps,
        trackedKeywords,
        rankHistory: allRankHistory,
        appAnalysisSnapshots,
        competitorGroups,
        competitorGroupSnapshots,
        competitorAsoLatestSnapshots,
        competitorTrackedKeywords,
        competitorRankHistory,
        trackingSchedule,
        weeklyReportSettings,
        alertRules,
        notificationSettings,
        updatedAt: new Date().toISOString(),
      };
      const signature = JSON.stringify(serializeUserStateForFirestore(nextState));
      if (signature === lastPersistedUserStateSignatureRef.current) {
        return;
      }
      try {
        await queueUserStatePersist(nextState, signature);
      } catch (err) {
        if (err instanceof ApiRequestError && err.status === 409) {
          lastPersistedUserStateSignatureRef.current = signature;
          toast.error(
            "This account changed in another session. Refresh to sync the latest saved data.",
          );
          return;
        }
        logError(err, { context: "persistUserState", uid: currentUser.uid });
      }
    };
    void persistUserState();
  }, [
    allRankHistory,
    appAnalysisSnapshots,
    alertRules,
    bookmarks,
    competitorAsoLatestSnapshots,
    competitorGroupSnapshots,
    competitorGroups,
    competitorRankHistory,
    competitorTrackedKeywords,
    currentUser.uid,
    isDemoMode,
    notificationSettings,
    queueUserStatePersist,
    trackedApps,
    trackedKeywords,
    trackingSchedule,
    weeklyReportSettings,
    userStateHydrated,
  ]);
  const loadAlertEvents = React.useCallback(async () => {
    setIsLoadingAlertEvents(true);
    setAlertEventsError(null);
    try {
      const data = await fetchAuthedJson<{ events?: AlertEvent[] }>(
        "/api/alerts/events?limit=40",
      );
      setAlertEvents(Array.isArray(data.events) ? data.events : []);
    } catch (err) {
      logError(err, { context: "loadAlertEvents", uid: currentUser.uid });
      setAlertEventsError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoadingAlertEvents(false);
    }
  }, [currentUser.uid, fetchAuthedJson]);
  const loadCompetitorAsoHistory = React.useCallback(async () => {
    setIsLoadingCompetitorAsoHistory(true);
    setCompetitorAsoHistoryError(null);
    try {
      const data = await fetchAuthedJson<{
        diffs?: CompetitorAsoDiffRecord[];
        summary?: CompetitorAsoSummary;
      }>("/api/competitors/aso/history?limit=250");
      setCompetitorAsoDiffs(Array.isArray(data.diffs) ? data.diffs : []);
    } catch (err) {
      logError(err, {
        context: "loadCompetitorAsoHistory",
        uid: currentUser.uid,
      });
      setCompetitorAsoDiffs([]);
      setCompetitorAsoHistoryError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoadingCompetitorAsoHistory(false);
    }
  }, [currentUser.uid, fetchAuthedJson]);
  const loadNotificationServerStatus = React.useCallback(async () => {
    setIsLoadingNotificationServerStatus(true);
    setNotificationServerStatusError(null);
    try {
      const data = await fetchAuthedJson<NotificationServerStatus>(
        "/api/notifications/status",
      );
      setNotificationServerStatus(data);
    } catch (err) {
      logError(err, {
        context: "loadNotificationServerStatus",
        uid: currentUser.uid,
      });
      setNotificationServerStatus(null);
      setNotificationServerStatusError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoadingNotificationServerStatus(false);
    }
  }, [currentUser.uid, fetchAuthedJson]);
  const loadBillingStatus = React.useCallback(async (): Promise<BillingStatus | null> => {
    setIsLoadingBillingStatus(true);
    setBillingError(null);
    try {
      const data = await fetchAuthedJson<BillingStatus>("/api/billing/status");
      setBillingStatus(data);
      return data;
    } catch (err) {
      logError(err, {
        context: "loadBillingStatus",
        uid: currentUser.uid,
      });
      setBillingError(getFriendlyErrorMessage(err));
      return null;
    } finally {
      setIsLoadingBillingStatus(false);
      setHasLoadedBillingStatus(true);
    }
  }, [currentUser.uid, fetchAuthedJson]);
  const loadChartCategories = React.useCallback(async () => {
    setIsLoadingChartCategories(true);
    setChartError(null);
    try {
      const params = new URLSearchParams({
        store: storeType,
        country,
      });
      const data = await fetchJson<{ categories?: ChartCategoryOption[] }>(
        `/api/chart-categories?${params.toString()}`,
      );
      const nextCategories = Array.isArray(data.categories) ? data.categories : [];
      setChartCategories(nextCategories);
      setSelectedChartCategoryCode((current) =>
        nextCategories.some((category) => category.code === current)
          ? current
          : nextCategories[0]?.code || "",
      );
    } catch (err) {
      logError(err, {
        context: "loadChartCategories",
        store: storeType,
        country,
      });
      setChartCategories([]);
      setSelectedChartCategoryCode("");
      setChartEntries([]);
      setChartLoadedAt(null);
      setChartError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoadingChartCategories(false);
    }
  }, [country, storeType]);
  const loadCharts = React.useCallback(async () => {
    if (!selectedChartCategoryCode) {
      setChartEntries([]);
      setChartLoadedAt(null);
      return;
    }
    setIsLoadingCharts(true);
    setChartError(null);
    try {
      const params = new URLSearchParams({
        store: storeType,
        country,
        category: selectedChartCategoryCode,
        chartType: selectedChartType,
        num: "100",
      });
      const data = await fetchJson<{
        entries?: ChartEntry[];
        loadedAt?: string | null;
      }>(`/api/charts?${params.toString()}`);
      setChartEntries(Array.isArray(data.entries) ? data.entries : []);
      setChartLoadedAt(
        typeof data.loadedAt === "string" && data.loadedAt ? data.loadedAt : null,
      );
    } catch (err) {
      logError(err, {
        context: "loadCharts",
        store: storeType,
        country,
        chartType: selectedChartType,
        category: selectedChartCategoryCode,
      });
      setChartEntries([]);
      setChartLoadedAt(null);
      setChartError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoadingCharts(false);
    }
  }, [country, selectedChartCategoryCode, selectedChartType, storeType]);
  useEffect(() => {
    void loadChartCategories();
  }, [loadChartCategories]);
  useEffect(() => {
    void loadCharts();
  }, [loadCharts]);
  useEffect(() => {
    if (isDemoMode || !userStateHydrated) return;
    void loadAlertEvents();
  }, [alertRefreshNonce, isDemoMode, loadAlertEvents, userStateHydrated]);
  useEffect(() => {
    if (isDemoMode || !userStateHydrated) return;
    const intervalId = window.setInterval(() => {
      pendingAlertFetchAnnouncementRef.current = true;
      void loadAlertEvents();
    }, 60_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [isDemoMode, loadAlertEvents, userStateHydrated]);
  useEffect(() => {
    if (isDemoMode || !userStateHydrated) return;
    void loadCompetitorAsoHistory();
  }, [isDemoMode, loadCompetitorAsoHistory, userStateHydrated]);
  useEffect(() => {
    if (isDemoMode || !userStateHydrated) return;
    void loadNotificationServerStatus();
  }, [
    isDemoMode,
    loadNotificationServerStatus,
    tokenRegistrationStatus,
    userStateHydrated,
  ]);
  useEffect(() => {
    if (isDemoMode) return;
    void loadBillingStatus();
  }, [isDemoMode, loadBillingStatus]);
  useEffect(() => {
    if (isDemoMode || typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    if (url.searchParams.get("billing_return") !== "1") {
      return;
    }

    const status = (url.searchParams.get("status") || "").toLowerCase();
    if (status === "active" || status === "succeeded") {
      toast.success("Checkout completed. Activating your trial.");
      setBillingActivationTimedOut(false);
    } else if (status === "cancelled" || status === "failed") {
      toast.error("Checkout did not complete.");
    } else {
      toast.message("Returned from checkout. Billing status is refreshing.");
    }

    void loadBillingStatus();
    url.searchParams.delete("billing_return");
    url.searchParams.delete("status");
    url.searchParams.delete("payment_id");
    url.searchParams.delete("subscription_id");
    window.history.replaceState({}, document.title, url.toString());
  }, [isDemoMode, loadBillingStatus]);
  useEffect(() => {
    if (isDemoMode || !userStateHydrated || typeof window === "undefined") {
      return;
    }
    if (!initialReportsDeepLinkState) {
      return;
    }

    setViewMode("reports");

    const url = new URL(window.location.href);
    url.searchParams.delete("viewMode");
    url.searchParams.delete("reportMode");
    url.searchParams.delete("period");
    url.searchParams.delete("reportStore");
    url.searchParams.delete("reportCountry");
    window.history.replaceState({}, document.title, url.toString());
  }, [initialReportsDeepLinkState, isDemoMode, userStateHydrated]);
  useEffect(() => {
    if (viewMode === "reports" && initialReportsDeepLinkState) {
      setInitialReportsDeepLinkState(null);
    }
  }, [initialReportsDeepLinkState, viewMode]);
  const onboardingDismissStorageKey = React.useMemo(
    () => `aso-onboarding-dismissed:${currentUser.uid}`,
    [currentUser.uid],
  );
  useEffect(() => {
    if (!isPreferenceStorageAllowed()) {
      setIsOnboardingDismissed(false);
      return;
    }

    setIsOnboardingDismissed(
      safeStorage.getItem(onboardingDismissStorageKey) === "1",
    );
  }, [onboardingDismissStorageKey]);
  useEffect(() => {
    if (isDemoMode) return;
    if (!fcmToken || notificationPermission !== "granted") {
      if (notificationPermission !== "granted") {
        setTokenRegistrationStatus("idle");
        setTokenRegistrationError(null);
      }
      return;
    }
    const registerToken = async () => {
      setTokenRegistrationStatus("registering");
      setTokenRegistrationError(null);
      try {
        const tokenId = await getNotificationTokenId(fcmToken);
        if (
          notificationSettings.lastToken === fcmToken ||
          (tokenId &&
            notificationSettings.lastTokenId === tokenId &&
            notificationSettings.pushEnabled)
        ) {
          setTokenRegistrationStatus("registered");
          setTokenRegistrationError(null);
          return;
        }
        const result = await fetchAuthedJson<{
          ok: boolean;
          tokenId?: string;
        }>("/api/notifications/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token: fcmToken,
            platform: navigator.platform || "web",
            userAgent: navigator.userAgent,
          }),
        });
        const registeredTokenId =
          typeof result.tokenId === "string" && result.tokenId
            ? result.tokenId
            : tokenId;
        setNotificationSettings((prev) =>
          normalizeNotificationSettings(
            {
              ...prev,
              permission: notificationPermission,
              pushEnabled: true,
              lastToken: fcmToken,
              ...(registeredTokenId ? { lastTokenId: registeredTokenId } : {}),
              tokenUpdatedAt: new Date().toISOString(),
            },
            notificationPermission,
          ),
        );
        setTokenRegistrationStatus("registered");
      } catch (err) {
        logError(err, {
          context: "registerNotificationToken",
          uid: currentUser.uid,
        });
        setTokenRegistrationStatus("error");
        setTokenRegistrationError(getFriendlyErrorMessage(err));
        toast.error(
          "Push notifications were allowed, but device registration failed. Refresh and try again.",
        );
      }
    };
    void registerToken();
  }, [
    currentUser.uid,
    fcmToken,
    fetchAuthedJson,
    isDemoMode,
    notificationPermission,
    notificationSettings.lastToken,
    notificationSettings.lastTokenId,
    notificationSettings.pushEnabled,
  ]);
  const startBillingCheckout = React.useCallback(async (
    planId: BillingPlanId = "starter",
    interval: BillingInterval = "monthly",
  ) => {
    setIsStartingBillingCheckout(true);
    try {
      const data = await fetchAuthedJson<{ checkoutUrl: string }>(
        "/api/billing/checkout",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ plan: planId, interval }),
        },
      );
      if (!data.checkoutUrl) {
        throw new Error("Checkout URL was not returned by the server.");
      }
      window.location.assign(data.checkoutUrl);
    } catch (err) {
      logError(err, {
        context: "startBillingCheckout",
        uid: currentUser.uid,
      });
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setIsStartingBillingCheckout(false);
    }
  }, [currentUser.uid, fetchAuthedJson]);
  const openBillingPortal = React.useCallback(async () => {
    setIsOpeningBillingPortal(true);
    try {
      const data = await fetchAuthedJson<{ portalUrl: string }>(
        "/api/billing/portal",
        {
          method: "POST",
        },
      );
      if (!data.portalUrl) {
        throw new Error("Billing portal URL was not returned by the server.");
      }
      window.location.assign(data.portalUrl);
    } catch (err) {
      logError(err, {
        context: "openBillingPortal",
        uid: currentUser.uid,
      });
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setIsOpeningBillingPortal(false);
    }
  }, [currentUser.uid, fetchAuthedJson]);
  const sendTestNotification = React.useCallback(async () => {
    setIsSendingTestNotification(true);
    setLastTestNotificationResult(null);
    try {
      const result = await fetchAuthedJson<NotificationTestResult>(
        "/api/notifications/test",
        {
          method: "POST",
        },
      );
      setLastTestNotificationResult(result);
      if (result.delivered > 0) {
        toast.success("Test notification sent.");
      } else {
        toast.error(
          result.reasons?.join(", ") ||
            "The server did not deliver a test notification.",
        );
      }
      void loadNotificationServerStatus();
    } catch (err) {
      logError(err, {
        context: "sendTestNotification",
        uid: currentUser.uid,
      });
      toast.error(getFriendlyErrorMessage(err));
    } finally {
      setIsSendingTestNotification(false);
    }
  }, [currentUser.uid, fetchAuthedJson, loadNotificationServerStatus]);
  const markAlertEventsRead = React.useCallback(
    async (eventIds: string[]) => {
      if (!eventIds.length) return;
      try {
        await fetchAuthedJson<{ ok: boolean }>("/api/alerts/events/mark-read", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ eventIds }),
        });
        const nowIso = new Date().toISOString();
        setAlertEvents((prev) =>
          prev.map((event) =>
            eventIds.includes(event.id)
              ? { ...event, readAt: event.readAt || nowIso }
              : event,
          ),
        );
      } catch (err) {
        logError(err, { context: "markAlertEventsRead", uid: currentUser.uid });
      }
    },
    [currentUser.uid, fetchAuthedJson],
  );
  const markAllAlertEventsRead = React.useCallback(async () => {
    try {
      await fetchAuthedJson<{ ok: boolean }>("/api/alerts/events/mark-read", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ markAll: true }),
      });
      const nowIso = new Date().toISOString();
      setAlertEvents((prev) =>
        prev.map((event) => ({ ...event, readAt: event.readAt || nowIso })),
      );
    } catch (err) {
      logError(err, { context: "markAllAlertEventsRead", uid: currentUser.uid });
    }
  }, [currentUser.uid, fetchAuthedJson]);
  const appendAlertEvents = React.useCallback((events: AlertEvent[]) => {
    if (!events.length) return;
    setAlertEvents((prev) => {
      const byId = new Map(prev.map((event) => [event.id, event]));
      events.forEach((event) => {
        byId.set(event.id, event);
      });
      return Array.from(byId.values()).sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    });
  }, []);
  const announceInAppAlertEvents = React.useCallback(
    (events: AlertEvent[]) => {
      if (!events.length) return;
      const inAppRuleIds = new Set(
        alertRules
          .filter((rule) => rule.channels.inApp)
          .map((rule) => rule.id),
      );
      events
        .filter((event) => inAppRuleIds.has(event.ruleId))
        .forEach((event) => {
          toast.info(event.keyword, {
            description: event.message,
          });
        });
    },
    [alertRules],
  );
  useEffect(() => {
    if (!alertEvents.length) {
      pendingAlertFetchAnnouncementRef.current = false;
      return;
    }
    const unseenUnreadEvents = alertEvents.filter(
      (event) =>
        !seenAlertEventIdsRef.current.has(event.id) &&
        !event.readAt,
    );
    if (
      pendingAlertFetchAnnouncementRef.current &&
      unseenUnreadEvents.length
    ) {
      announceInAppAlertEvents(unseenUnreadEvents);
    }
    alertEvents.forEach((event) => {
      seenAlertEventIdsRef.current.add(event.id);
    });
    pendingAlertFetchAnnouncementRef.current = false;
  }, [alertEvents, announceInAppAlertEvents]);
  const bookmarkedAppKeys = React.useMemo(
    () => new Set(bookmarks.map((bookmark) => getBookmarkKey(bookmark))),
    [bookmarks],
  );
  const trackedKeywordGroupKeys = React.useMemo(
    () =>
      new Set(
        trackedKeywords.map((trackedKeyword) =>
          getTrackedKeywordGroupKey(trackedKeyword),
        ),
      ),
    [trackedKeywords],
  );
  const trackedAppTitles = React.useMemo(
    () =>
      Array.from(
        new Set(
          trackedKeywords.map((trackedKeyword) => trackedKeyword.appTitle),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [trackedKeywords],
  );
  const trackedAppsByKey = React.useMemo(
    () =>
      new Map(trackedApps.map((trackedApp) => [trackedApp.appKey, trackedApp])),
    [trackedApps],
  );
  const trackedAppUsageCount = React.useMemo(
    () => getTrackedAppUsageCountForOverview(trackedApps, trackedKeywords),
    [trackedApps, trackedKeywords],
  );
  const billingAccessState: BillingAccessState = isDemoMode
    ? "active"
    : billingStatus?.accessState || "selection_required";
  const hasBillingStatusLoadFailure =
    !isDemoMode && hasLoadedBillingStatus && !billingStatus && Boolean(billingError);
  const hasActiveBillingAccess =
    isDemoMode || billingAccessState === "active";
  const effectivePlanLimits = React.useMemo(
    () =>
      hasActiveBillingAccess && billingStatus?.planLimits
        ? billingStatus.planLimits
        : null,
    [billingStatus, hasActiveBillingAccess],
  );
  const currentTrackedAppLimitKeys = React.useMemo(
    () =>
      getTrackedAppIdentityKeysForPlanUsage({
        trackedApps,
        trackedKeywords,
      }),
    [trackedApps, trackedKeywords],
  );
  const currentCompetitorGroupLimitKeys = React.useMemo(
    () => new Set(competitorGroups.map((group) => group.groupId)),
    [competitorGroups],
  );
  const currentTrackedKeywordLimitKeys = React.useMemo(
    () =>
      new Set(
        trackedKeywords
          .map((trackedKeyword) => getPlanTrackedKeywordIdentityKey(trackedKeyword))
          .concat(
            competitorTrackedKeywords.map((trackedKeyword) =>
              getCompetitorTrackedKeywordIdentityKey(trackedKeyword),
            ),
          ),
      ),
    [competitorTrackedKeywords, trackedKeywords],
  );
  const localPlanUsage = React.useMemo(
    () =>
      effectivePlanLimits
        ? countPlanUsage(
            {
              trackedApps,
              competitorGroups,
              trackedKeywords,
              competitorTrackedKeywords,
            },
            effectivePlanLimits,
          )
        : null,
    [
      competitorGroups,
      competitorTrackedKeywords,
      effectivePlanLimits,
      trackedApps,
      trackedKeywords,
    ],
  );
  const trackedKeywordLimitActivity = React.useMemo(
    () =>
      effectivePlanLimits
        ? getTrackedKeywordActivity(
            {
              trackedApps,
              competitorGroups,
              trackedKeywords,
              competitorTrackedKeywords,
            },
            effectivePlanLimits,
          )
        : null,
    [
      competitorGroups,
      competitorTrackedKeywords,
      effectivePlanLimits,
      trackedApps,
      trackedKeywords,
    ],
  );
  const billingStatusForUi = React.useMemo(
    () =>
      billingStatus
        ? {
            ...billingStatus,
            planLimits: effectivePlanLimits || billingStatus.planLimits,
            usage: localPlanUsage || billingStatus.usage,
          }
        : null,
    [billingStatus, effectivePlanLimits, localPlanUsage],
  );
  const showUpgradePage = viewMode === "upgrade" || !hasActiveBillingAccess;
  const openUpgradeForBillingAccess = React.useCallback(
    (
      message = "Select a subscription to start your 7-day trial before using the workspace.",
    ) => {
      toast.error(message);
      setViewMode("upgrade");
    },
    [],
  );
  const openUpgradeForLimit = React.useCallback(
    (
      scope: keyof PlanLimits,
      limit: number,
      options?: { overLimitExisting?: boolean },
    ) => {
      if (!hasActiveBillingAccess) {
        openUpgradeForBillingAccess();
        return;
      }
      const label =
        scope === "trackedApps"
          ? "tracked apps"
          : scope === "competitorGroups"
            ? "competitor groups"
            : "tracked keywords";
      const message = options?.overLimitExisting
        ? `Your current plan is already over its ${label} limit. Remove existing items before adding new ones.`
        : `You have reached your ${label} limit of ${limit.toLocaleString()} on this plan.`;
      toast.error(message);
      setViewMode("upgrade");
    },
    [hasActiveBillingAccess, openUpgradeForBillingAccess],
  );
  const guardGovernedAddition = React.useCallback(
    (
      scope: keyof PlanLimits,
      currentKeys: Set<string>,
      nextKeys: Set<string>,
    ) => {
      if (!hasActiveBillingAccess) {
        openUpgradeForBillingAccess();
        return false;
      }
      if (!effectivePlanLimits) {
        return true;
      }
      const limit = effectivePlanLimits[scope];
      if (limit === null) {
        return true;
      }
      const currentCount = currentKeys.size;
      const nextCount = nextKeys.size;
      const hasNewIdentity = Array.from(nextKeys).some(
        (entry) => !currentKeys.has(entry),
      );
      if (currentCount > limit && hasNewIdentity) {
        openUpgradeForLimit(scope, limit, { overLimitExisting: true });
        return false;
      }
      if (currentCount <= limit && nextCount > limit) {
        openUpgradeForLimit(scope, limit);
        return false;
      }
      return true;
    },
    [effectivePlanLimits, hasActiveBillingAccess, openUpgradeForBillingAccess, openUpgradeForLimit],
  );
  const pollForBillingActivation = React.useCallback(async () => {
    if (isDemoMode) {
      return;
    }
    const runId = billingActivationPollRunRef.current + 1;
    billingActivationPollRunRef.current = runId;
    setIsPollingBillingActivation(true);
    setBillingActivationTimedOut(false);

    try {
      const deadline = Date.now() + 60_000;
      while (billingActivationPollRunRef.current === runId) {
        const nextStatus = await loadBillingStatus();
        if (billingActivationPollRunRef.current !== runId) {
          return;
        }
        if (nextStatus?.accessState === "active") {
          setBillingActivationTimedOut(false);
          return;
        }
        if (nextStatus?.accessState !== "activating") {
          return;
        }
        if (Date.now() >= deadline) {
          setBillingActivationTimedOut(true);
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
      }
    } finally {
      if (billingActivationPollRunRef.current === runId) {
        setIsPollingBillingActivation(false);
      }
    }
  }, [isDemoMode, loadBillingStatus]);
  useEffect(() => {
    if (isDemoMode || !hasLoadedBillingStatus) {
      return;
    }
    if (billingAccessState !== "activating") {
      billingActivationPollRunRef.current += 1;
      setIsPollingBillingActivation(false);
      setBillingActivationTimedOut(false);
      return;
    }
    if (!isPollingBillingActivation && !billingActivationTimedOut) {
      void pollForBillingActivation();
    }
  }, [
    billingAccessState,
    billingActivationTimedOut,
    hasLoadedBillingStatus,
    isDemoMode,
    isPollingBillingActivation,
    pollForBillingActivation,
  ]);
  const isTrackedKeywordWithinActiveLimit = React.useCallback(
    (trackedKeyword: TrackedKeyword) =>
      isTrackedKeywordKeyWithinActiveLimit(
        trackedKeywordLimitActivity
          ? {
              activeKeys: trackedKeywordLimitActivity.activeTrackedKeywordKeys,
              pausedTrackedKeywords:
                trackedKeywordLimitActivity.pausedTrackedKeywords,
            }
          : null,
        getPlanTrackedKeywordIdentityKey(trackedKeyword),
      ),
    [trackedKeywordLimitActivity],
  );
  const isCompetitorTrackedKeywordWithinActiveLimit = React.useCallback(
    (trackedKeyword: CompetitorTrackedKeywordRecord) =>
      isTrackedKeywordKeyWithinActiveLimit(
        trackedKeywordLimitActivity
          ? {
              activeKeys:
                trackedKeywordLimitActivity.activeCompetitorTrackedKeywordKeys,
              pausedTrackedKeywords:
                trackedKeywordLimitActivity.pausedTrackedKeywords,
            }
          : null,
        getCompetitorTrackedKeywordIdentityKey(trackedKeyword),
      ),
    [trackedKeywordLimitActivity],
  );
  const appAnalysisSnapshotsByKey = React.useMemo(
    () =>
      new Map(
        appAnalysisSnapshots.map((snapshot) => [snapshot.snapshotKey, snapshot]),
      ),
    [appAnalysisSnapshots],
  );
  const latestAppAnalysisSnapshotByAppKey = React.useMemo(() => {
    const byAppKey = new Map<string, AppAnalysisSnapshot>();
    appAnalysisSnapshots.forEach((snapshot) => {
      const current = byAppKey.get(snapshot.appKey);
      if (
        !current ||
        new Date(snapshot.loadedAt).getTime() >
          new Date(current.loadedAt).getTime()
      ) {
        byAppKey.set(snapshot.appKey, snapshot);
      }
    });
    return byAppKey;
  }, [appAnalysisSnapshots]);
  const competitorSnapshotHistoryByGroupId = React.useMemo(() => {
    const byGroupId = new Map<string, CompetitorGroupSnapshotRecord[]>();
    competitorGroupSnapshots.forEach((snapshot) => {
      const current = byGroupId.get(snapshot.groupId) || [];
      current.push(snapshot);
      byGroupId.set(snapshot.groupId, current);
    });
    byGroupId.forEach((entries, groupId) => {
      byGroupId.set(
        groupId,
        [...entries].sort(
          (a, b) => new Date(b.loadedAt).getTime() - new Date(a.loadedAt).getTime(),
        ),
      );
    });
    return byGroupId;
  }, [competitorGroupSnapshots]);
  const competitorLatestSnapshotByGroupId = React.useMemo(() => {
    const byGroupId = new Map<string, CompetitorGroupSnapshotRecord>();
    competitorSnapshotHistoryByGroupId.forEach((entries, groupId) => {
      if (entries[0]) {
        byGroupId.set(groupId, entries[0]);
      }
    });
    return byGroupId;
  }, [competitorSnapshotHistoryByGroupId]);
  const competitorTrackedKeywordsByGroupId = React.useMemo(() => {
    const byGroupId = new Map<string, CompetitorTrackedKeywordRecord[]>();
    competitorTrackedKeywords.forEach((record) => {
      const current = byGroupId.get(record.groupId) || [];
      current.push(record);
      byGroupId.set(record.groupId, current);
    });
    byGroupId.forEach((records, groupId) => {
      byGroupId.set(
        groupId,
        [...records].sort((a, b) => a.keyword.localeCompare(b.keyword)),
      );
    });
    return byGroupId;
  }, [competitorTrackedKeywords]);
  const competitorAsoDiffsByGroupId = React.useMemo(() => {
    const byGroupId = new Map<string, CompetitorAsoDiffRecord[]>();
    competitorAsoDiffs.forEach((diff) => {
      const current = byGroupId.get(diff.groupId) || [];
      current.push(diff);
      byGroupId.set(diff.groupId, current);
    });
    byGroupId.forEach((entries, groupId) => {
      byGroupId.set(
        groupId,
        [...entries].sort(
          (a, b) =>
            new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime(),
        ),
      );
    });
    return byGroupId;
  }, [competitorAsoDiffs]);
  const competitorAsoLatestSnapshotsByGroupId = React.useMemo(() => {
    const byGroupId = new Map<string, CompetitorAsoSnapshotRecord[]>();
    competitorAsoLatestSnapshots.forEach((snapshot) => {
      const current = byGroupId.get(snapshot.groupId) || [];
      current.push(snapshot);
      byGroupId.set(snapshot.groupId, current);
    });
    byGroupId.forEach((entries, groupId) => {
      byGroupId.set(
        groupId,
        [...entries].sort(
          (a, b) =>
            new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
        ),
      );
    });
    return byGroupId;
  }, [competitorAsoLatestSnapshots]);
  const competitorRankHistoryByTrackedKeywordId = React.useMemo(() => {
    const byTrackedKeywordId = new Map<
      string,
      Map<string, ChartRankHistoryEntry[]>
    >();
    competitorRankHistory.forEach((entry) => {
      const chartEntry = createTrackedChartHistoryEntry(
        entry.timestamp,
        entry.rank,
        entry.rankDepth ?? TRACKED_KEYWORD_RANKING_DEPTH,
      );
      const historyByApp =
        byTrackedKeywordId.get(entry.trackedKeywordId) || new Map<string, ChartRankHistoryEntry[]>();
      const existingByDay = new Map(
        (historyByApp.get(entry.appKey) || []).map((historyEntry) => [
          historyEntry.dayKey,
          historyEntry,
        ]),
      );
      const current = existingByDay.get(chartEntry.dayKey);
      if (
        !current ||
        new Date(chartEntry.rawTimestamp).getTime() >=
          new Date(current.rawTimestamp).getTime()
      ) {
        existingByDay.set(chartEntry.dayKey, chartEntry);
      }
      historyByApp.set(
        entry.appKey,
        Array.from(existingByDay.values()).sort(
          (a, b) =>
            new Date(a.rawTimestamp).getTime() -
            new Date(b.rawTimestamp).getTime(),
        ),
      );
      byTrackedKeywordId.set(entry.trackedKeywordId, historyByApp);
    });
    return byTrackedKeywordId;
  }, [competitorRankHistory]);
  const processedCompetitorTrackedKeywordGroupsByGroupId = React.useMemo(() => {
    const byGroupId = new Map<string, CompetitorTrackedKeywordGroupView[]>();

    competitorTrackedKeywordsByGroupId.forEach((records, groupId) => {
      const grouped = new Map<string, CompetitorTrackedKeywordGroupView>();

      records.forEach((trackedKeyword) => {
        const historyByApp =
          competitorRankHistoryByTrackedKeywordId.get(
            trackedKeyword.trackedKeywordId,
          ) || new Map<string, ChartRankHistoryEntry[]>();
        const appHistoryViews = trackedKeyword.apps.map((app) => {
          const dataKey = getCompetitorChartDataKey(app.appKey);
          const history = buildTrackedAppChartHistory(
            app,
            historyByApp.get(app.appKey) || [],
          );

          return {
            app,
            dataKey,
            history,
            movement: getChartHistoryMovement(history),
          };
        });
        const chartPointsMap = new Map<string, CompetitorKeywordChartPoint>();
        appHistoryViews.forEach((view) => {
          view.history.forEach((entry) => {
            const current = chartPointsMap.get(entry.dayKey) || {
              dayKey: entry.dayKey,
              timestamp: entry.timestamp,
              fullTime: entry.fullTime,
              rawTimestamp: entry.rawTimestamp,
            };

            current[view.dataKey] = entry.rank;
            current[`${view.dataKey}_raw`] = entry.rawRank;
            current[`${view.dataKey}_depth`] = entry.rankDepth;
            chartPointsMap.set(entry.dayKey, current);
          });
        });
        const chartPoints = Array.from(chartPointsMap.values()).sort(
          (a, b) =>
            new Date(a.rawTimestamp).getTime() -
            new Date(b.rawTimestamp).getTime(),
        );
        const chartMax = Math.max(
          TRACKED_KEYWORD_RANKING_DEPTH + 1,
          ...appHistoryViews.flatMap((view) =>
            view.history.flatMap((entry) => [entry.rank, entry.rankDepth + 1]),
          ),
        );
        const countryView: CompetitorTrackedKeywordCountryView = {
          trackedKeyword,
          appHistoryViews,
          chartPoints,
          chartMax,
        };
        const groupKey = getCompetitorTrackedKeywordGroupKey(trackedKeyword);
        const existing = grouped.get(groupKey);

        if (!existing) {
          grouped.set(groupKey, {
            groupKey,
            groupId,
            keyword: trackedKeyword.keyword,
            store: trackedKeyword.store,
            countries: [trackedKeyword.country],
            countryViews: [countryView],
            lastCheckedAt: trackedKeyword.lastCheckedAt,
          });
          return;
        }

        existing.countries.push(trackedKeyword.country);
        existing.countryViews.push(countryView);

        const currentLastCheckedTime = new Date(
          trackedKeyword.lastCheckedAt || 0,
        ).getTime();
        const existingLastCheckedTime = new Date(
          existing.lastCheckedAt || 0,
        ).getTime();
        if (currentLastCheckedTime > existingLastCheckedTime) {
          existing.lastCheckedAt = trackedKeyword.lastCheckedAt;
        }
      });

      byGroupId.set(
        groupId,
        Array.from(grouped.values())
          .map((group) => ({
            ...group,
            countries: Array.from(new Set(group.countries)).sort((a, b) =>
              findCountryName(a).localeCompare(findCountryName(b)),
            ),
            countryViews: [...group.countryViews].sort((a, b) =>
              findCountryName(a.trackedKeyword.country).localeCompare(
                findCountryName(b.trackedKeyword.country),
              ),
            ),
          }))
          .sort((a, b) => a.keyword.localeCompare(b.keyword)),
      );
    });

    return byGroupId;
  }, [
    competitorRankHistoryByTrackedKeywordId,
    competitorTrackedKeywordsByGroupId,
  ]);
  const competitorDraftKeywordCandidates = React.useMemo(() => {
    const searchResults = competitorDraftKeywordSearchResults.filter(
      (candidate) => candidate.apps.length > 0,
    );
    if (!competitorDraftAnalysis) return searchResults;
    const maxSharedCandidates =
      competitorDraftAnalysis.mode === "deep" ? 12 : 8;
    const maxGapCandidates = competitorDraftAnalysis.mode === "deep" ? 12 : 8;
    const buildCandidateApps = (keyword: string) =>
      competitorDraftAnalysis.appInsights.map((insight) => {
        const ranking = insight.rankings.find(
          (entry) => entry.keyword.trim().toLowerCase() === keyword,
        );
        return {
          appKey: insight.appKey,
          title: insight.app.title,
          role: insight.role,
          lastRank: ranking?.rank ?? -1,
          lastCheckStatus: ranking ? "ok" : "not_ranked",
        } satisfies CompetitorDraftKeywordCandidateApp;
      });

    const byKeyword = new Map<string, CompetitorDraftKeywordCandidate>();
    searchResults.forEach((candidate) => {
      const normalized = candidate.keyword.trim().toLowerCase();
      if (!normalized) return;
      byKeyword.set(normalized, candidate);
    });

    competitorDraftAnalysis.sharedBattles
      .slice(0, maxSharedCandidates)
      .forEach((battle) => {
      const normalized = battle.keyword.trim().toLowerCase();
      if (!normalized || byKeyword.has(normalized)) return;
      byKeyword.set(normalized, {
        keyword: battle.keyword,
        source: battle.leader.role === "own" ? "own_win" : "competitor_win",
        detail: `${battle.leader.appTitle} leads at #${battle.leader.rank}`,
        apps: buildCandidateApps(normalized),
      });
    });

    competitorDraftAnalysis.gapOpportunities
      .slice(0, maxGapCandidates)
      .forEach((opportunity) => {
        const normalized = opportunity.keyword.trim().toLowerCase();
        if (!normalized || byKeyword.has(normalized)) return;
        const leaderLabel = opportunity.leader
          ? `${opportunity.leader.appTitle} ranks #${opportunity.leader.rank}`
          : "No app is ranking yet";
        const missingLabel =
          opportunity.missingApps.length > 0
            ? `${opportunity.missingApps.join(", ")} missing`
            : "Coverage gap";
        byKeyword.set(normalized, {
          keyword: opportunity.keyword,
          source: "gap",
          detail: `${missingLabel}. ${leaderLabel}.`,
          apps: buildCandidateApps(normalized),
        });
      });

    return Array.from(byKeyword.values());
  }, [competitorDraftAnalysis, competitorDraftKeywordSearchResults]);
  const competitorDraftStarted = Boolean(
    competitorDraftOwnApp || competitorDraftApps.length > 0 || competitorDraftAnalysis,
  );
  const competitorDraftHasAnalysis = Boolean(competitorDraftAnalysis);
  React.useEffect(() => {
    setCompetitorDraftSelectedKeywords((prev) => {
      const normalized = normalizeCompetitorDraftKeywordSelections(prev, country);
      if (
        prev.length === normalized.length &&
        prev.every((entry, index) => {
          const current = normalized[index];
          return (
            entry.keyword === current.keyword &&
            entry.selectedCountries.length === current.selectedCountries.length &&
            entry.selectedCountries.every(
              (countryCode, countryIndex) =>
                countryCode === current.selectedCountries[countryIndex],
            )
          );
        })
      ) {
        return prev;
      }
      return normalized;
    });
  }, [country]);
  const competitorDraftCanAnalyze = Boolean(
    competitorDraftOwnApp && competitorDraftApps.length > 0,
  );
  const matchingCompetitorDraftGroup = React.useMemo(
    () =>
      competitorGroups.find(
        (group) =>
          competitorDraftOwnApp &&
          getCompetitorGroupSignature(
            group.ownApp.appKey,
            group.competitors.map((app) => app.appKey),
            group.store,
            group.country,
          ) ===
            getCompetitorGroupSignature(
              createCompetitorGroupAppRecord(
                competitorDraftOwnApp,
                storeType,
                "own",
              ).appKey,
              competitorDraftApps.map(
                (app) =>
                  createCompetitorGroupAppRecord(
                    app,
                    storeType,
                    "competitor",
                  ).appKey,
              ),
              storeType,
              country,
            ),
      ) || null,
    [competitorDraftApps, competitorDraftOwnApp, competitorGroups, country, storeType],
  );
  const competitorDraftTrackedCountryMap = React.useMemo(() => {
    const byKeyword = new Map<string, string[]>();
    const targetGroupId = matchingCompetitorDraftGroup?.groupId;
    if (!targetGroupId) return byKeyword;
    competitorTrackedKeywords
      .filter((record) => record.groupId === targetGroupId)
      .forEach((record) => {
        const normalizedKeyword = record.keyword.trim().toLowerCase();
        const current = byKeyword.get(normalizedKeyword) || [];
        if (!current.includes(record.country)) {
          byKeyword.set(
            normalizedKeyword,
            current.concat(record.country).sort((a, b) => a.localeCompare(b)),
          );
        }
      });
    return byKeyword;
  }, [competitorTrackedKeywords, matchingCompetitorDraftGroup]);
  const competitorDraftSelectedCountryCount = React.useMemo(
    () =>
      competitorDraftSelectedKeywords.reduce(
        (sum, entry) => sum + entry.selectedCountries.length,
        0,
      ),
    [competitorDraftSelectedKeywords],
  );
  const competitorDraftTrackingHint = !competitorDraftOwnApp
    ? "Select your app first."
    : competitorDraftApps.length === 0
      ? "Add one competitor."
      : !competitorDraftAnalysis ||
          competitorDraftAnalysis.appInsights.length < 2
        ? "Analyze the comparison before tracking keywords."
        : competitorDraftSelectedKeywords.length === 0
          ? "Choose Track Keyword on a result to begin."
          : `Ready to track ${competitorDraftSelectedKeywords.length} keyword${
              competitorDraftSelectedKeywords.length === 1 ? "" : "s"
            } across ${competitorDraftSelectedCountryCount} countr${
              competitorDraftSelectedCountryCount === 1 ? "y" : "ies"
            }.`;
  const upsertTrackedApp = React.useCallback(
    (
      app: AppDetails,
      currentStore: StoreType,
      kind: TrackedAppKind,
      source: TrackedAppSource,
      countries: string[] = [],
    ) => {
      const incoming = createTrackedAppRecord(
        app,
        currentStore,
        kind,
        source,
        countries,
      );
      setTrackedApps((prev) =>
        mergeTrackedAppsWithIncoming(
          prev,
          app,
          currentStore,
          kind,
          source,
          countries,
        ),
      );
      return incoming.appKey;
    },
    [],
  );
  const updateTrackedAppAnalysisSnapshot = React.useCallback(
    (
      app: AppDetails,
      currentStore: StoreType,
      currentCountry: string,
      payload: DiscoveryPayload,
      options?: { kind?: TrackedAppKind; source?: TrackedAppSource },
    ) => {
      const appKey = getTrackedAppKeyFromValues(
        String(getAppStoreId(app, currentStore) || app.appId),
        currentStore,
      );
      const existingTrackedApp = trackedAppsByKey.get(appKey);
      const shouldUpdateTrackedApp = Boolean(existingTrackedApp || options?.kind);
      if (shouldUpdateTrackedApp) {
        upsertTrackedApp(
          app,
          currentStore,
          options?.kind || existingTrackedApp?.kind || "competitor",
          options?.source || existingTrackedApp?.source || "discovery",
          [currentCountry],
        );
      }

      const snapshot = createAppAnalysisSnapshot(
        app,
        currentStore,
        currentCountry,
        payload,
      );
      setAppAnalysisSnapshots((prev) =>
        normalizeAppAnalysisSnapshots(
          prev
            .filter((entry) => entry.snapshotKey !== snapshot.snapshotKey)
            .concat(snapshot),
        ),
      );
      if (!shouldUpdateTrackedApp) {
        return;
      }
      setTrackedApps((prev) =>
        normalizeTrackedApps(
          prev.map((trackedApp) =>
            trackedApp.appKey === snapshot.appKey
              ? {
                  ...trackedApp,
                  countries: Array.from(
                    new Set(
                      trackedApp.countries.concat(
                        normalizeCountryCode(currentCountry, "us"),
                      ),
                    ),
                  ).sort(),
                  lastAnalyzedAt: payload.loadedAt,
                  updatedAt: new Date().toISOString(),
                }
              : trackedApp,
          ),
        ),
      );
    },
    [trackedAppsByKey, upsertTrackedApp],
  );
  const mergeTrackedKeywordUpdates = React.useCallback(
    (updates: TrackedKeyword[]) => {
      if (!updates.length) return;
      const updatesByKey = new Map(
        updates.map((trackedKeyword) => [
          getTrackedKeywordKey(trackedKeyword),
          trackedKeyword,
        ]),
      );
      setTrackedKeywords((prev) =>
        prev.map(
          (trackedKeyword) =>
            updatesByKey.get(getTrackedKeywordKey(trackedKeyword)) ||
            trackedKeyword,
        ),
      );
    },
    [],
  );
  const refreshTrackedKeyword = React.useCallback(
    async (
      trackedKeyword: TrackedKeyword,
      options: {
        notifyOnSignificantChange: boolean;
        markCheckedOnError?: boolean;
        errorContext: string;
      },
    ) => {
      if (!hasActiveBillingAccess) {
        openUpgradeForBillingAccess();
        return {
          updatedTrackedKeyword: trackedKeyword,
          significantChange: false,
          hadError: true,
        };
      }
      if (!isTrackedKeywordWithinActiveLimit(trackedKeyword)) {
        toast.error(
          "This tracked keyword is paused because your current plan keyword limit has been reached.",
        );
        setViewMode("upgrade");
        return {
          updatedTrackedKeyword: trackedKeyword,
          significantChange: false,
          hadError: true,
        };
      }
      try {
        const data = await fetchAuthedJson<TrackedKeywordRefreshResponse>(
          "/api/tracked-keywords/refresh",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              groupId: trackedKeyword.groupId,
              keyword: trackedKeyword.keyword,
              appId: trackedKeyword.appId,
              store: trackedKeyword.store,
              country: trackedKeyword.country,
              depth: TRACKED_KEYWORD_RANKING_DEPTH,
            }),
          },
        );
        const updatedTrackedKeyword = data.trackedKeyword;
        const newRank = updatedTrackedKeyword.lastRank;
        const rankDepth = TRACKED_KEYWORD_RANKING_DEPTH;
        const oldRank = trackedKeyword.lastRank;
        let significantChange = false;
        let changeMessage = "";
        if (oldRank === -1 && newRank !== -1) {
          significantChange = true;
          changeMessage = `Entered top 100 at #${newRank}!`;
        } else if (oldRank !== -1 && newRank === -1) {
          significantChange = true;
          changeMessage = `Dropped out of top 100 (was #${oldRank}).`;
        } else if (
          oldRank !== -1 &&
          newRank !== -1 &&
          Math.abs(oldRank - newRank) >= 5
        ) {
          significantChange = true;
          const direction = newRank < oldRank ? "Up" : "Down";
          changeMessage = `${direction} ${Math.abs(oldRank - newRank)} spots to #${newRank}.`;
        }
        if (significantChange && options.notifyOnSignificantChange) {
          toast(
            <div className="flex flex-col gap-1">
              {" "}
              <span className="font-semibold text-app-text">
                {trackedKeyword.appTitle}
              </span>{" "}
              <span className="text-sm text-app-text-muted">
                Keyword:{" "}
                <span className="font-medium text-cyan-400">
                  "{trackedKeyword.keyword}"
                </span>
              </span>{" "}
              <span className="text-sm font-medium text-cyan-400">
                {changeMessage}
              </span>{" "}
            </div>,
            { duration: 6000 },
          );
        }
        if (updatedTrackedKeyword.lastCheckStatus !== "error") {
          saveTrackedRankHistory(
            trackedKeyword.groupId,
            trackedKeyword.appId,
            trackedKeyword.keyword,
            newRank,
            trackedKeyword.store,
            trackedKeyword.country,
            rankDepth,
          );
        }
        if (Array.isArray(data.alertEvents) && data.alertEvents.length) {
          appendAlertEvents(data.alertEvents);
          announceInAppAlertEvents(data.alertEvents);
          setAlertRefreshNonce((prev) => prev + 1);
        }
        return {
          updatedTrackedKeyword,
          significantChange,
          hadError: updatedTrackedKeyword.lastCheckStatus === "error",
        };
      } catch (err) {
        logError(err, {
          context: options.errorContext,
          keyword: trackedKeyword.keyword,
          appId: trackedKeyword.appId,
          store: trackedKeyword.store,
          country: trackedKeyword.country,
        });
        return {
          updatedTrackedKeyword: options.markCheckedOnError
            ? {
                ...trackedKeyword,
                lastChecked: new Date().toISOString(),
                lastCheckStatus: "error" as const,
                lastError:
                  err instanceof Error ? err.message : "Keyword check failed.",
              }
            : trackedKeyword,
          significantChange: false,
          hadError: true,
        };
      }
    },
    [
      announceInAppAlertEvents,
      appendAlertEvents,
      fetchAuthedJson,
      hasActiveBillingAccess,
      isTrackedKeywordWithinActiveLimit,
      openUpgradeForBillingAccess,
      saveTrackedRankHistory,
    ],
  );
  const refreshTrackedKeywordBatch = React.useCallback(
    async (
      batch: TrackedKeyword[],
      options: {
        notifyOnSignificantChange: boolean;
        markCheckedOnError?: boolean;
        errorContext: string;
      },
    ) =>
      mapWithConcurrency(
        batch,
        TRACKED_KEYWORD_REFRESH_CONCURRENCY,
        (trackedKeyword) => refreshTrackedKeyword(trackedKeyword, options),
      ),
    [refreshTrackedKeyword],
  );
  const openTrackCountryPicker = React.useCallback(
    (
      keyword: string,
      app: AppDetails,
      currentStore: StoreType,
      currentCountry: string,
      currentRank: number,
      currentRankKnown: boolean,
      appKind: TrackedAppKind = "own",
      appSource: TrackedAppSource = "manual",
    ) => {
      const normalizedCurrentCountry = normalizeCountryCode(
        currentCountry,
        country,
      );
      const targetAppId = getAppStoreId(app, currentStore);
      const trackingGroupKey = getTrackedKeywordGroupKey({
        keyword,
        appId: targetAppId,
        store: currentStore,
      });
      const existingTrackedCountries = Array.from(
        new Set(
          trackedKeywords
            .filter(
              (trackedKeyword) =>
                getTrackedKeywordGroupKey(trackedKeyword) === trackingGroupKey,
            )
            .map((trackedKeyword) => trackedKeyword.country),
        ),
      ).sort();
      const initialSelectedCountries = Array.from(
        new Set(
          existingTrackedCountries.includes(normalizedCurrentCountry)
            ? existingTrackedCountries
            : [...existingTrackedCountries, normalizedCurrentCountry],
        ),
      ).sort((a, b) => a.localeCompare(b));

      setTrackCountryPickerState({
        keyword,
        app,
        store: currentStore,
        appKind,
        appSource,
        currentCountry: normalizedCurrentCountry,
        currentRank,
        currentRankKnown,
        existingTrackedCountries,
        selectedCountries:
          existingTrackedCountries.length > 0
            ? initialSelectedCountries
            : [normalizedCurrentCountry],
        selectionKind:
          existingTrackedCountries.length > 0 ? "tracked_edit" : "tracked_add",
      });
    },
    [country, trackedKeywords],
  );
  const openCompetitorTrackedKeywordCountryPicker = React.useCallback(
    ({ groupId, keyword }: { groupId: string; keyword: string }) => {
      const group = competitorGroups.find((entry) => entry.groupId === groupId);
      if (!group) {
        toast.error("This competitor group could not be found.");
        return;
      }
      const existingTrackedCountries = Array.from(
        new Set(
          competitorTrackedKeywords
            .filter(
              (record) =>
                record.groupId === groupId &&
                record.keyword.trim().toLowerCase() === keyword.trim().toLowerCase(),
            )
            .map((record) => normalizeCountryCode(record.country, country)),
        ),
      ).sort((a, b) => a.localeCompare(b));
      const initialCountry =
        existingTrackedCountries[0] ||
        normalizeCountryCode(group.country, country);
      setTrackCountryPickerState({
        keyword: keyword.trim(),
        app: toCompetitorGroupAppDetails(group.ownApp),
        store: group.store,
        appKind: "own",
        appSource: "manual",
        currentCountry: initialCountry,
        currentRank: -1,
        currentRankKnown: false,
        existingTrackedCountries,
        selectedCountries:
          existingTrackedCountries.length > 0
            ? existingTrackedCountries
            : [initialCountry],
        competitorGroupId: groupId,
        selectionKind: "competitor_tracked_edit",
      });
    },
    [competitorGroups, competitorTrackedKeywords, country],
  );
  const closeTrackCountryPicker = React.useCallback(() => {
    if (isSubmittingTrackCountries) return;
    setTrackCountryPickerState(null);
  }, [isSubmittingTrackCountries]);
  const toggleTrackCountrySelection = React.useCallback(
    (countryCode: string) => {
      setTrackCountryPickerState((prev) => {
        if (!prev) return prev;
        const normalizedCode = normalizeCountryCode(
          countryCode,
          prev.currentCountry,
        );
        if (
          prev.selectionKind !== "tracked_edit" &&
          prev.selectionKind !== "competitor_tracked_edit" &&
          prev.existingTrackedCountries.includes(normalizedCode)
        ) {
          return prev;
        }
        const isSelected = prev.selectedCountries.includes(normalizedCode);
        if (isSelected) {
          return {
            ...prev,
            selectedCountries: prev.selectedCountries.filter(
              (entry) => entry !== normalizedCode,
            ),
          };
        }
        return {
          ...prev,
          selectedCountries: [...prev.selectedCountries, normalizedCode],
        };
      });
    },
    [],
  );
  const removeTrackedKeywordGroup = React.useCallback(
    (groupId: string, keyword: string) => {
      const confirmed = window.confirm(
        `Stop tracking "${keyword}" and remove this tracked group?`,
      );
      if (!confirmed) {
        return;
      }
      const nextTrackedKeywords = trackedKeywords.filter(
        (trackedKeyword) => resolveTrackingGroupId(trackedKeyword) !== groupId,
      );
      setTrackedKeywords(nextTrackedKeywords);
      setTrackedApps((prev) =>
        syncOwnTrackedAppsWithTrackedKeywords(prev, nextTrackedKeywords),
      );
      setAllRankHistory((prev) =>
        prev.filter((entry) => resolveTrackingGroupId(entry) !== groupId),
      );
      setExpandedTrackedGroupIds((prev) =>
        prev.filter((entry) => entry !== groupId),
      );
      setTrackedSummaryCountryByGroup((prev) => {
        const next = { ...prev };
        delete next[groupId];
        return next;
      });
      setAlertRules((prev) => prev.filter((rule) => rule.groupId !== groupId));
      setAlertEvents((prev) =>
        prev.filter((event) => event.groupId !== groupId),
      );
      setActiveAlertGroupId((prev) => (prev === groupId ? null : prev));
      toast.success(`Stopped tracking "${keyword}" for this country group`);
    },
    [trackedKeywords],
  );
  const toggleTrackedGroupExpansion = React.useCallback((groupId: string) => {
    setExpandedTrackedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((entry) => entry !== groupId)
        : [...prev, groupId],
    );
  }, []);
  const toggleCompetitorGroupExpansion = React.useCallback((groupId: string) => {
    const groupTrackedKeywordKeys = (
      processedCompetitorTrackedKeywordGroupsByGroupId.get(groupId) || []
    ).map((entry) => entry.groupKey);
    setExpandedCompetitorGroupIds((prev) => {
      const isExpanded = prev.includes(groupId);
      if (isExpanded) {
        setExpandedCompetitorTrackedKeywordGroupKeys((current) =>
          current.filter(
            (groupKey) => !groupTrackedKeywordKeys.includes(groupKey),
          ),
        );
        return prev.filter((entry) => entry !== groupId);
      }
      setExpandedCompetitorTrackedKeywordGroupKeys((current) =>
        Array.from(new Set([...current, ...groupTrackedKeywordKeys])),
      );
      return [...prev, groupId];
    });
  }, [processedCompetitorTrackedKeywordGroupsByGroupId]);
  const setTrackedSummaryCountry = React.useCallback(
    (groupId: string, countryCode: string) => {
      setTrackedSummaryCountryByGroup((prev) => ({
        ...prev,
        [groupId]: countryCode,
      }));
    },
    [],
  );
  const setCompetitorSummaryCountry = React.useCallback(
    (groupKey: string, countryCode: string) => {
      setCompetitorSummaryCountryByKeywordGroup((prev) => ({
        ...prev,
        [groupKey]: countryCode,
      }));
    },
    [],
  );
  const focusTrackedGroupFromAlert = React.useCallback(
    (groupId: string, countryCode?: string) => {
      setViewMode("tracked");
      setExpandedTrackedGroupIds((prev) =>
        prev.includes(groupId) ? prev : [...prev, groupId],
      );
      if (countryCode) {
        setTrackedSummaryCountry(groupId, countryCode);
      }
    },
    [setTrackedSummaryCountry],
  );
  const submitTrackCountrySelection = React.useCallback(async () => {
    if (!trackCountryPickerState) return;
    const normalizedCountries = Array.from(
      new Set(
        trackCountryPickerState.selectedCountries.map((entry) =>
          normalizeCountryCode(entry, trackCountryPickerState.currentCountry),
        ),
      ),
    );
    if (normalizedCountries.length === 0) {
      toast.error("Select at least one country to start tracking.");
      return;
    }
    if (trackCountryPickerState.selectionKind === "competitor_draft") {
      const pendingSelection = {
        keyword: trackCountryPickerState.keyword,
        selectedCountries: normalizedCountries,
      } satisfies CompetitorDraftKeywordSelection;
      const trackDraftKeywords = trackCompetitorDraftKeywordsRef.current;
      if (!trackDraftKeywords) {
        toast.error("Competitor tracking is not ready yet. Try again.");
        return;
      }
      setIsSubmittingTrackCountries(true);
      try {
        await trackDraftKeywords(pendingSelection);
      } finally {
        setTrackCountryPickerState(null);
        setIsSubmittingTrackCountries(false);
      }
      return;
    }
    if (trackCountryPickerState.selectionKind === "competitor_tracked_edit") {
      const competitorGroupId = trackCountryPickerState.competitorGroupId;
      if (!competitorGroupId) {
        toast.error("This competitor keyword is missing its group reference.");
        return;
      }
      const group = competitorGroups.find(
        (entry) => entry.groupId === competitorGroupId,
      );
      if (!group) {
        toast.error("This competitor group could not be found.");
        return;
      }
      const nowIso = new Date().toISOString();
      const reconciliation = reconcileCompetitorTrackedKeywordCountryEdit({
        existingRecords: competitorTrackedKeywords,
        group,
        keyword: trackCountryPickerState.keyword,
        nowIso,
        selectedCountries: normalizedCountries,
      });
      if (
        reconciliation.addedRecords.length === 0 &&
        reconciliation.removedRecords.length === 0
      ) {
        toast.error("No country changes to save.");
        return;
      }
      const nextCompetitorTrackedKeywords = competitorTrackedKeywords
        .filter(
          (record) =>
            !(
              record.groupId === competitorGroupId &&
              record.keyword.trim().toLowerCase() ===
                reconciliation.normalizedKeyword.toLowerCase()
            ),
        )
        .concat(reconciliation.nextRecords);
      const nextTrackedKeywordLimitKeys = new Set(
        trackedKeywords
          .map((trackedKeyword) => getPlanTrackedKeywordIdentityKey(trackedKeyword))
          .concat(
            nextCompetitorTrackedKeywords.map((trackedKeyword) =>
              getCompetitorTrackedKeywordIdentityKey(trackedKeyword),
            ),
          ),
      );
      if (
        reconciliation.addedRecords.length > 0 &&
        !guardGovernedAddition(
          "trackedKeywords",
          currentTrackedKeywordLimitKeys,
          nextTrackedKeywordLimitKeys,
        )
      ) {
        return;
      }
      setIsSubmittingTrackCountries(true);
      setCompetitorTrackedKeywords(nextCompetitorTrackedKeywords);
      if (reconciliation.removedTrackedKeywordIds.length > 0) {
        setCompetitorRankHistory((prev) =>
          prev.filter(
            (entry) =>
              !reconciliation.removedTrackedKeywordIds.includes(
                entry.trackedKeywordId,
              ),
          ),
        );
      }
      setCompetitorGroups((prev) =>
        prev.map((entry) =>
          entry.groupId === competitorGroupId
            ? {
                ...entry,
                trackedKeywordIds: reconciliation.nextTrackedKeywordIds,
                updatedAt: nowIso,
              }
            : entry,
        ),
      );
      if (reconciliation.removedCountries.length > 0) {
        const keywordGroupKey = getCompetitorTrackedKeywordGroupKey({
          groupId: competitorGroupId,
          keyword: reconciliation.normalizedKeyword,
        });
        setCompetitorSummaryCountryByKeywordGroup((prev) => {
          const currentCountry = prev[keywordGroupKey];
          if (
            !currentCountry ||
            !reconciliation.removedCountries.includes(currentCountry)
          ) {
            return prev;
          }
          const next = { ...prev };
          if (reconciliation.normalizedSelectedCountries[0]) {
            next[keywordGroupKey] = reconciliation.normalizedSelectedCountries[0];
          } else {
            delete next[keywordGroupKey];
          }
          return next;
        });
      }
      toast.success(
        `Updated "${reconciliation.normalizedKeyword}" to ${normalizedCountries.length} ${normalizedCountries.length === 1 ? "country" : "countries"} in this competitor group.`,
      );
      try {
        if (reconciliation.addedRecords.length > 0) {
          const refreshCompetitorBatch =
            refreshCompetitorTrackedKeywordBatchRef.current;
          if (!refreshCompetitorBatch) {
            toast.error("Competitor tracking refresh is not ready yet.");
            return;
          }
          const refreshResults = await refreshCompetitorBatch(
            reconciliation.addedRecords,
            "submitTrackCountrySelection_competitor_batch",
          );
          setCompetitorTrackedKeywords((prev) =>
            mergeCompetitorTrackedKeywordCollections(
              prev,
              refreshResults.map((entry) => entry.updatedRecord),
            ),
          );
          setCompetitorRankHistory((prev) =>
            mergeCompetitorRankHistoryEntries(
              prev,
              refreshResults.flatMap((entry) => entry.historyEntries),
            ),
          );
        }
        setTrackCountryPickerState(null);
      } catch (err) {
        logError(err, {
          context: "submitTrackCountrySelection_competitor_batch",
          groupId: competitorGroupId,
          keyword: reconciliation.normalizedKeyword,
          store: group.store,
        });
      } finally {
        setIsSubmittingTrackCountries(false);
      }
      return;
    }
    if (trackCountryPickerState.appKind !== "own") {
      toast.error("Only tracked keywords can be started from this picker.");
      setTrackCountryPickerState(null);
      return;
    }
    const targetAppId = getAppStoreId(
      trackCountryPickerState.app,
      trackCountryPickerState.store,
    );
    if (!targetAppId) {
      toast.error("This app is missing a store identifier and cannot be tracked.");
      return;
    }
    const trackingGroupKey = getTrackedKeywordGroupKey({
      keyword: trackCountryPickerState.keyword,
      appId: targetAppId,
      store: trackCountryPickerState.store,
    });
    const existingGroupMatches = trackedKeywords.filter(
      (trackedKeyword) =>
        getTrackedKeywordGroupKey(trackedKeyword) === trackingGroupKey,
    );
    const groupId = existingGroupMatches[0]?.groupId ?? createTrackingGroupId();
    const newCountries = normalizedCountries.filter(
      (countryCode) =>
        !trackCountryPickerState.existingTrackedCountries.includes(countryCode),
    );
    const removedCountries =
      trackCountryPickerState.selectionKind === "tracked_edit"
        ? trackCountryPickerState.existingTrackedCountries.filter(
            (countryCode) => !normalizedCountries.includes(countryCode),
          )
        : [];
    if (newCountries.length === 0 && removedCountries.length === 0) {
      toast.error(
        trackCountryPickerState.selectionKind === "tracked_edit"
          ? "No country changes to save."
          : "All selected countries are already tracked for this keyword.",
      );
      return;
    }
    const nowIso = new Date().toISOString();
    const trackedEntries: TrackedKeyword[] = newCountries.map(
      (countryCode) => {
        const isCurrentCountry =
          countryCode === trackCountryPickerState.currentCountry;
        const hasKnownRank =
          isCurrentCountry && trackCountryPickerState.currentRankKnown;
        return {
          groupId,
          keyword: trackCountryPickerState.keyword,
          appId: targetAppId,
          appTitle: trackCountryPickerState.app.title,
          store: trackCountryPickerState.store,
          country: countryCode,
          createdAt: nowIso,
          lastRank: hasKnownRank ? trackCountryPickerState.currentRank : -1,
          lastChecked: hasKnownRank ? nowIso : new Date(0).toISOString(),
          lastCheckStatus: hasKnownRank
            ? trackCountryPickerState.currentRank === -1
              ? "not_ranked"
              : "ok"
            : "pending",
          lastError: undefined,
        };
      },
    );
    const nextTrackedKeywords = mergeTrackedKeywordCollections(
      trackedKeywords.filter(
        (trackedKeyword) =>
          !(
            getTrackedKeywordGroupKey(trackedKeyword) === trackingGroupKey &&
            removedCountries.includes(trackedKeyword.country)
          ),
      ),
      trackedEntries,
    );
    const targetAppKey = getTrackedAppKeyFromValues(
      targetAppId,
      trackCountryPickerState.store,
    );
    const nextTrackedAppCountries = Array.from(
      new Set(
        nextTrackedKeywords
          .filter(
            (trackedKeyword) =>
              trackedKeyword.appId === targetAppId &&
              trackedKeyword.store === trackCountryPickerState.store,
          )
          .map((trackedKeyword) => trackedKeyword.country),
      ),
    ).sort((a, b) => a.localeCompare(b));
    const candidateTrackedApps =
      trackedEntries.length > 0
        ? mergeTrackedAppsWithIncoming(
            trackedApps,
            trackCountryPickerState.app,
            trackCountryPickerState.store,
            trackCountryPickerState.appKind,
            trackCountryPickerState.appSource,
            nextTrackedAppCountries,
          )
        : normalizeTrackedApps(
            trackedApps.map((trackedApp) =>
              trackedApp.appKey === targetAppKey
                ? {
                    ...trackedApp,
                    countries: nextTrackedAppCountries,
                    updatedAt: nowIso,
                  }
                : trackedApp,
            ),
          );
    const nextTrackedApps = syncOwnTrackedAppsWithTrackedKeywords(
      candidateTrackedApps,
      nextTrackedKeywords,
    );
    const nextTrackedAppLimitKeys =
      getTrackedAppIdentityKeysFromTrackedKeywords(nextTrackedKeywords);
    if (
      !guardGovernedAddition(
        "trackedApps",
        currentTrackedAppLimitKeys,
        nextTrackedAppLimitKeys,
      )
    ) {
      return;
    }
    const nextTrackedKeywordLimitKeys = new Set(
      nextTrackedKeywords
        .map((trackedKeyword) => getPlanTrackedKeywordIdentityKey(trackedKeyword))
        .concat(
          competitorTrackedKeywords.map((trackedKeyword) =>
            getCompetitorTrackedKeywordIdentityKey(trackedKeyword),
          ),
        ),
    );
    if (
      trackedEntries.length > 0 &&
      !guardGovernedAddition(
        "trackedKeywords",
        currentTrackedKeywordLimitKeys,
        nextTrackedKeywordLimitKeys,
      )
    ) {
      return;
    }
    setIsSubmittingTrackCountries(true);
    if (trackedEntries.length > 0) {
      upsertTrackedApp(
        trackCountryPickerState.app,
        trackCountryPickerState.store,
        trackCountryPickerState.appKind,
        trackCountryPickerState.appSource,
        nextTrackedAppCountries,
      );
    }
    setTrackedKeywords(nextTrackedKeywords);
    setTrackedApps(nextTrackedApps);
    if (removedCountries.length > 0) {
      setAllRankHistory((prev) =>
        prev.filter(
          (entry) =>
            !(
              resolveTrackingGroupId(entry) === groupId &&
              entry.appId === targetAppId &&
              entry.store === trackCountryPickerState.store &&
              removedCountries.includes(entry.country)
            ),
        ),
      );
      setTrackedSummaryCountryByGroup((prev) => {
        const currentSummaryCountry = prev[groupId];
        if (!currentSummaryCountry || !removedCountries.includes(currentSummaryCountry)) {
          return prev;
        }
        const next = { ...prev };
        if (normalizedCountries[0]) {
          next[groupId] = normalizedCountries[0];
        } else {
          delete next[groupId];
        }
        return next;
      });
    }
    if (
      trackCountryPickerState.currentRankKnown &&
      newCountries.includes(trackCountryPickerState.currentCountry)
    ) {
      saveTrackedRankHistory(
        groupId,
        targetAppId,
        trackCountryPickerState.keyword,
        trackCountryPickerState.currentRank,
        trackCountryPickerState.store,
        trackCountryPickerState.currentCountry,
        TRACKED_KEYWORD_RANKING_DEPTH,
      );
    }
    toast.success(
      trackCountryPickerState.selectionKind === "tracked_edit"
        ? `Updated "${trackCountryPickerState.keyword}" to ${normalizedCountries.length} ${normalizedCountries.length === 1 ? "country" : "countries"}.`
        : `Tracking updated for "${trackCountryPickerState.keyword}" in ${newCountries.length} ${newCountries.length === 1 ? "country" : "countries"}`,
    );
    try {
      const refreshResults = await refreshTrackedKeywordBatch(trackedEntries, {
        notifyOnSignificantChange: false,
        markCheckedOnError: true,
        errorContext: "submitTrackCountrySelection_batch",
      });
      mergeTrackedKeywordUpdates(
        refreshResults.map((result) => result.updatedTrackedKeyword),
      );
      setTrackCountryPickerState(null);
    } catch (err) {
      logError(err, {
        context: "submitTrackCountrySelection_batch",
        keyword: trackCountryPickerState.keyword,
        appId: targetAppId,
        store: trackCountryPickerState.store,
        groupId,
      });
    } finally {
      setIsSubmittingTrackCountries(false);
    }
  }, [
    competitorGroups,
    competitorTrackedKeywords,
    currentTrackedAppLimitKeys,
    currentTrackedKeywordLimitKeys,
    getAppStoreId,
    guardGovernedAddition,
    trackedApps,
    trackedKeywords,
    mergeTrackedKeywordUpdates,
    refreshTrackedKeywordBatch,
    saveTrackedRankHistory,
    trackCountryPickerState,
    upsertTrackedApp,
  ]);
  const toggleBookmark = (
    app: AppDetails,
    store: StoreType,
    currentCountry: string,
  ) => {
    setBookmarks((prevBookmarks) => {
      const isBookmarked = prevBookmarks.some(
        (b) =>
          b.store === store &&
          (store === "ios" ? b.id === app.id : b.appId === app.appId),
      );
      if (isBookmarked) {
        return prevBookmarks.filter(
          (b) =>
            !(
              b.store === store &&
              (store === "ios" ? b.id === app.id : b.appId === app.appId)
            ),
        );
      } else {
        return [
          ...prevBookmarks,
          {
            appId: app.appId,
            id: app.id,
            title: app.title,
            icon: app.icon,
            developer: app.developer,
            store,
            country: currentCountry,
            url: app.url,
          },
        ];
      }
    });
  };
  const getUnavailableMetrics = (): KeywordMetrics => ({});
  const estimateKeywordMetrics = async (
    kw: string,
    appOverride?: AppDetails | null,
  ) => {
    try {
      const targetApp = appOverride || selectedApp;
      if (!targetApp) return getUnavailableMetrics();
      const title = targetApp.title
        ? String(targetApp.title).split("-")[0].split(":")[0].trim()
        : "App";
      const data = await fetchAuthedJson<{ metrics?: KeywordMetrics[] }>(
        "/api/metrics",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keywords: [kw],
            title,
            description: targetApp.description || "",
            category: targetApp.category || "",
            developer: targetApp.developer || "",
            store: storeType,
            country,
          }),
        },
      );
      if (data.metrics?.[0]) return data.metrics[0];
    } catch (e) {
      logError(e, { context: "estimateKeywordMetrics", keyword: kw });
    }
    return getUnavailableMetrics();
  };
  const fetchDiscoveryForApp = React.useCallback(
    async (
      app: AppDetails,
      currentStore: StoreType,
      currentCountry: string,
      options?: { force?: boolean; mode?: DiscoveryMode },
    ) => {
      const activeMode = options?.mode ?? discoveryMode;
      const id = getAppStoreId(app, currentStore);
      if (!id) {
        return null;
      }
      const cacheInput = {
        mode: activeMode,
        store: currentStore,
        country: currentCountry,
        appId: String(id),
        title: app.title || "App",
        description: app.description || "",
        category: app.category || "",
        developer: app.developer || "",
      } as const;
      const cacheKey = getDiscoveryCacheKey(cacheInput);
      const cacheLookupKeys = !options?.force
        ? getDiscoveryCacheLookupKeys(cacheInput)
        : [];
      for (const lookupKey of cacheLookupKeys) {
        const cachedDiscovery = CacheService.get<DiscoveryPayload>(lookupKey);
        if (!hasDiscoveryCacheContent(cachedDiscovery)) {
          continue;
        }
        const hydratedPayload = {
          ...cachedDiscovery,
          mode: cachedDiscovery.mode || activeMode,
        } satisfies DiscoveryPayload;
        return lookupKey === cacheKey
          ? hydratedPayload
          : trimDiscoveryPayloadForMode(hydratedPayload, activeMode);
      }
      const data = await fetchAuthedJson<{
        rankings?: RankedKeyword[];
        suggestions?: KeywordSuggestion[];
        checkedKeywords?: number;
        candidateCount?: number;
        searchDepth?: number;
        failedLookups?: number;
      }>(
        "/api/discover",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appId: String(id),
            title: app.title || "App",
            description: app.description || "",
            category: app.category || "",
            developer: app.developer || "",
            store: currentStore,
            country: currentCountry,
            mode: activeMode,
            force: options?.force === true,
          }),
        },
        {
          timeoutMs:
            activeMode === "deep"
              ? DISCOVERY_DEEP_TIMEOUT_MS
              : DISCOVERY_FAST_TIMEOUT_MS,
        },
      );
      const payload: DiscoveryPayload = {
        rankings: Array.isArray(data.rankings) ? data.rankings : [],
        suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
        checkedKeywords: data.checkedKeywords,
        candidateCount: data.candidateCount,
        searchDepth: data.searchDepth,
        failedLookups: data.failedLookups,
        mode: activeMode,
        loadedAt: new Date().toISOString(),
      };
      if (payload.rankings.length > 0 || payload.suggestions.length > 0) {
        CacheService.set(cacheKey, payload, DISCOVERY_CACHE_TTL);
        if (activeMode === "deep") {
          CacheService.set(
            getDiscoveryCacheKey({ ...cacheInput, mode: "fast" }),
            trimDiscoveryPayloadForMode(payload, "fast"),
            DISCOVERY_CACHE_TTL,
          );
        }
      } else {
        CacheService.remove(cacheKey);
      }
      payload.rankings.forEach((rankingItem) => {
        saveRankHistory(
          String(id),
          rankingItem.keyword,
          rankingItem.rank,
          currentStore,
          currentCountry,
          payload.searchDepth ?? 100,
        );
      });
      return payload;
    },
    [discoveryMode, fetchAuthedJson, saveRankHistory],
  );
  const loadAppDetailsForContext = React.useCallback(
    async (
      app: AppDetails,
      currentStore: StoreType,
      currentCountry: string,
    ) => {
      const id = currentStore === "ios" ? app.id : app.appId;
      if (!id) {
        throw new Error("Missing app identifier.");
      }
      const cacheKey = `app-${currentStore}-${currentCountry}-${id}`;
      const cachedData = CacheService.get<AppDetails>(cacheKey);
      if (cachedData) {
        return cachedData;
      }
      const fullDetails = await fetchJson<any>(
        `/api/app?id=${id}&store=${currentStore}&country=${currentCountry}`,
      );
      const normalizedDetails = normalizeAppDetails(fullDetails, currentStore);
      CacheService.set(cacheKey, normalizedDetails, TTL.APP_DETAILS);
      return normalizedDetails;
    },
    [],
  );
  const discoverKeywords = async (
    app: AppDetails,
    currentStore: StoreType,
    currentCountry: string,
    options?: { force?: boolean; mode?: DiscoveryMode },
  ) => {
    const activeMode = options?.mode ?? discoveryMode;
    setIsDiscoveringKeywords(true);
    setDiscoveryError(null);
    try {
      const payload = await fetchDiscoveryForApp(
        app,
        currentStore,
        currentCountry,
        options,
      );
      if (!payload) return;
      setAutoRankings(payload.rankings);
      setKeywordSuggestions(payload.suggestions);
      setDiscoveryRunMeta({
        checkedKeywords: payload.checkedKeywords,
        candidateCount: payload.candidateCount,
        failedLookups: payload.failedLookups,
      });
      updateTrackedAppAnalysisSnapshot(app, currentStore, currentCountry, payload);
      if (options?.force) {
        const summary =
          `${activeMode === "deep" ? "Deep" : "Fast"} discovery found ${payload.rankings.length} ranking keyword${payload.rankings.length === 1 ? "" : "s"}` +
          (typeof payload.checkedKeywords === "number" &&
          typeof payload.candidateCount === "number"
            ? ` after checking ${payload.checkedKeywords}/${payload.candidateCount} candidates`
            : "");
        if (payload.rankings.length === 0) {
          toast.info(`${summary}. No ranked keywords found in this scan.`);
        } else if ((payload.failedLookups ?? 0) > 0) {
          toast.info(
            `${summary}. ${payload.failedLookups} lookup${payload.failedLookups === 1 ? "" : "s"} timed out.`,
          );
        } else {
          toast.success(summary);
        }
      }
    } catch (err) {
      logError(err, { context: "discoverKeywords", appTitle: app.title });
      const message = "Keyword discovery could not complete. Try rerunning the scan.";
      setDiscoveryError(message);
      toast.error(
        message,
      );
    } finally {
      setIsDiscoveringKeywords(false);
    }
  };
  const rerunKeywordDiscovery = () => {
    if (!selectedApp) return;
    discoverKeywords(selectedApp, storeType, country, {
      force: true,
      mode: discoveryMode,
    });
  };
  const analyzeComparedApps = React.useCallback(
    async (options?: { force?: boolean; mode?: DiscoveryMode }) => {
      if (comparedApps.length === 0) return;
      const activeMode = options?.mode ?? compareDiscoveryMode;
      setIsAnalyzingCompare(true);
      setCompareAnalysisError(null);
      try {
        const results = await mapWithConcurrency(
          comparedApps,
          2,
          async (app) => {
            try {
              const payload = await fetchDiscoveryForApp(
                app,
                storeType,
                country,
                { force: options?.force, mode: activeMode },
              );
              return { status: "fulfilled" as const, value: { app, payload } };
            } catch (error) {
              return { status: "rejected" as const, reason: error };
            }
          },
        );
        const nextDiscoveries: Record<string, DiscoveryPayload> = {};
        const failures: string[] = [];
        results.forEach((result, index) => {
          const app = comparedApps[index];
          const compareKey = getCompareAppKey(app, storeType);
          if (result.status === "fulfilled" && result.value.payload) {
            nextDiscoveries[compareKey] = result.value.payload;
            updateTrackedAppAnalysisSnapshot(
              app,
              storeType,
              country,
              result.value.payload,
            );
            return;
          }
          failures.push(app.title);
        });
        setCompareDiscoveries((prev) => {
          const retainedEntries = Object.entries(prev).filter(([key]) =>
            comparedApps.some(
              (app) => getCompareAppKey(app, storeType) === key,
            ),
          );
          return { ...Object.fromEntries(retainedEntries), ...nextDiscoveries };
        });
        if (failures.length > 0) {
          const message =
            failures.length === comparedApps.length
              ? "Failed to analyze the compare set."
              : `Analyzed ${comparedApps.length - failures.length}/${comparedApps.length} apps. ${failures.join(", ")} could not be refreshed.`;
          setCompareAnalysisError(message);
          if (failures.length === comparedApps.length) {
            toast.error(message);
          } else if (options?.force) {
            toast.info(message);
          }
        } else if (options?.force) {
          toast.success(
            `Compare analysis refreshed for ${comparedApps.length} app${comparedApps.length === 1 ? "" : "s"}.`,
          );
        }
      } catch (err) {
        logError(err, {
          context: "analyzeComparedApps",
          comparedCount: comparedApps.length,
          storeType,
          country,
        });
        const message = "Failed to analyze the compare set.";
        setCompareAnalysisError(message);
        toast.error(message);
      } finally {
        setIsAnalyzingCompare(false);
      }
    },
    [
      comparedApps,
      compareDiscoveryMode,
      country,
      fetchDiscoveryForApp,
      storeType,
      updateTrackedAppAnalysisSnapshot,
    ],
  );
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    setError(null);
    setSelectedCategory(null);
    if (viewMode === "single") {
      setSelectedApp(null);
      setRanking(null);
      setAutoRankings([]);
      setKeywordSuggestions([]);
    }
    try {
      /* Check if searchTerm is a URL */ let isUrl = false;
      let extractedId = "";
      let detectedStore = storeType;
      try {
        const url = new URL(searchTerm);
        if (url.hostname.includes("play.google.com")) {
          extractedId = url.searchParams.get("id") || "";
          detectedStore = "android";
          isUrl = true;
        } else if (url.hostname.includes("apps.apple.com")) {
          const match = url.pathname.match(/\/id(\d+)/);
          if (match) {
            extractedId = match[1];
            detectedStore = "ios";
            isUrl = true;
          }
        }
      } catch (e) {
        /* Not a valid URL, proceed with normal search */
      }
      if (isUrl && extractedId) {
        if (detectedStore !== storeType) {
          setStoreType(detectedStore as StoreType);
          setSelectedApp(null);
          setComparedApps([]);
          setCompareDiscoveries({});
          setCompareAnalysisError(null);
          setCompetitorDraftOwnApp(null);
          setCompetitorDraftApps([]);
          setCompetitorDraftAnalysis(null);
          setCompetitorGroupError(null);
          setRanking(null);
          setAutoRankings([]);
          setKeywordSuggestions([]);
        }
        /* If it's a URL, fetch the app directly */ const cacheKey = `app-${detectedStore}-${country}-${extractedId}`;
        const cachedData = CacheService.get<AppDetails>(cacheKey);
        if (cachedData) {
          if (viewMode === "single") {
            handleSelectApp(cachedData, detectedStore, country);
          } else {
            /* Compare mode */ setSearchResults([cachedData]);
          }
          setIsSearching(false);
          return;
        }
        const data = await fetchJson<any>(
          `/api/app?id=${extractedId}&store=${detectedStore}&country=${country}`,
        );
        const normalizedData = normalizeAppDetails(
          data,
          detectedStore as StoreType,
        );
        CacheService.set(cacheKey, normalizedData, TTL.APP_DETAILS);
        if (viewMode === "single") {
          handleSelectApp(normalizedData, detectedStore, country);
        } else {
          setSearchResults([normalizedData]);
        }
        setIsSearching(false);
        return;
      }
      /* Normal search */ const cacheKey = `search-${SEARCH_CACHE_VERSION}-${storeType}-${country}-${searchTerm.toLowerCase()}`;
      const cachedData = CacheService.get<AppDetails[]>(cacheKey);
      if (Array.isArray(cachedData) && cachedData.length > 0) {
        setSearchResults(cachedData);
        setIsSearching(false);
        return;
      }
      const data = await fetchJson<any[]>(
        `/api/search?term=${encodeURIComponent(searchTerm)}&store=${storeType}&country=${country}`,
      );
      /* Normalize category field */ const normalizedData = data.map(
        (app: any) => normalizeAppDetails(app, storeType),
      );
      if (normalizedData.length > 0) {
        CacheService.set(cacheKey, normalizedData, TTL.SEARCH);
      } else {
        CacheService.remove(cacheKey);
      }
      setSearchResults(normalizedData);
    } catch (err) {
      logError(err, {
        context: "handleSearch",
        searchTerm,
        storeType,
        country,
      });
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsSearching(false);
    }
  };
  const handleSelectApp = async (
    app: AppDetails,
    overrideStore?: StoreType,
    overrideCountry?: string,
    overrideViewMode?: "single" | "compare",
  ) => {
    const currentStore = overrideStore || storeType;
    const currentCountry = overrideCountry || country;
    const currentViewMode = overrideViewMode || viewMode;
    if (currentViewMode === "compare") {
      if (comparedApps.length >= 5) {
        setError("You can compare up to 5 apps at a time.");
        return;
      }
      if (
        comparedApps.some(
          (existingApp) => areSameStoreApps(existingApp, app, currentStore),
        )
      ) {
        setSelectedCategory(null);
        return;
      }
      setSelectedCategory(null);
      setCompareRankings([]);
      try {
        const normalizedDetails = await loadAppDetailsForContext(
          app,
          currentStore,
          currentCountry,
        );
        setComparedApps((prev) =>
          prev.some(
            (existingApp) =>
              areSameStoreApps(existingApp, normalizedDetails, currentStore),
          )
            ? prev
            : [...prev, normalizedDetails],
        );
      } catch (err) {
        logError(err, {
          context: "handleSelectApp_compare",
          appId: app.appId,
          store: currentStore,
          country: currentCountry,
        });
        setError(getFriendlyErrorMessage(err));
      }
      return;
    }
    setSelectedApp(app);
    setSearchResults([]);
    setSelectedCategory(null);
    setRanking(null);
    setAutoRankings([]);
    setKeywordSuggestions([]);
    setDiscoveryError(null);
    setDiscoveryRunMeta({});
    try {
      const normalizedDetails = await loadAppDetailsForContext(
        app,
        currentStore,
        currentCountry,
      );
      setSelectedApp(normalizedDetails);
    } catch (err) {
      logError(err, {
        context: "handleSelectApp_single",
        appId: app.appId,
        store: currentStore,
        country: currentCountry,
      });
      setError(getFriendlyErrorMessage(err));
    }
  };
  const clearCompetitorDraftAnalysis = React.useCallback(() => {
    setCompetitorDraftAnalysis(null);
    setCompetitorDraftSelectedKeywords([]);
    setCompetitorDraftKeywordSearch("");
    setCompetitorDraftKeywordSearchResults([]);
    setCompetitorGroupError(null);
  }, []);
  const resetCompetitorDraft = React.useCallback(() => {
    setCompetitorDraftOwnApp(null);
    setCompetitorDraftApps([]);
    setCompetitorDraftAnalysis(null);
    setCompetitorDraftSelectedKeywords([]);
    setCompetitorDraftKeywordSearch("");
    setCompetitorDraftKeywordSearchResults([]);
    setCompetitorGroupError(null);
  }, []);
  const assignCompetitorDraftOwnApp = React.useCallback(
    async (app: AppDetails) => {
      try {
        const fullDetails = await loadAppDetailsForContext(app, storeType, country);
        clearCompetitorDraftAnalysis();
        setCompetitorDraftOwnApp(fullDetails);
        setCompetitorDraftApps((prev) =>
          prev.filter(
            (entry) => !areSameStoreApps(entry, fullDetails, storeType),
          ),
        );
      } catch (err) {
        logError(err, {
          context: "assignCompetitorDraftOwnApp",
          appId: app.appId,
          store: storeType,
          country,
        });
        setError(getFriendlyErrorMessage(err));
      }
    },
    [
      clearCompetitorDraftAnalysis,
      country,
      loadAppDetailsForContext,
      storeType,
    ],
  );
  const addCompetitorDraftApp = React.useCallback(
    async (app: AppDetails) => {
      if (
        competitorDraftOwnApp &&
        areSameStoreApps(competitorDraftOwnApp, app, storeType)
      ) {
        toast.error("Your app cannot also be added as a competitor.");
        return;
      }
      if (
        competitorDraftApps.some(
          (entry) => areSameStoreApps(entry, app, storeType),
        )
      ) {
        return;
      }
      if (competitorDraftApps.length >= 1) {
        toast.error("You can add only 1 rival app per group.");
        return;
      }
      try {
        const fullDetails = await loadAppDetailsForContext(app, storeType, country);
        clearCompetitorDraftAnalysis();
        setCompetitorDraftApps((prev) =>
          prev.some(
            (entry) => areSameStoreApps(entry, fullDetails, storeType),
          )
            ? prev
            : [...prev, fullDetails],
        );
      } catch (err) {
        logError(err, {
          context: "addCompetitorDraftApp",
          appId: app.appId,
          store: storeType,
          country,
        });
        setError(getFriendlyErrorMessage(err));
      }
    },
    [
      clearCompetitorDraftAnalysis,
      competitorDraftApps,
      competitorDraftOwnApp,
      country,
      loadAppDetailsForContext,
      storeType,
    ],
  );
  const removeCompetitorDraftApp = React.useCallback(
    (appKey: string) => {
      const appToRemove =
        competitorDraftApps.find(
          (entry) => getCompareAppKey(entry, storeType) === appKey,
        ) || null;
      const confirmed = window.confirm(
        appToRemove
          ? `Remove "${appToRemove.title}" from this competitor comparison?`
          : "Remove this app from the competitor comparison?",
      );
      if (!confirmed) {
        return;
      }
      clearCompetitorDraftAnalysis();
      setCompetitorDraftApps((prev) =>
        prev.filter((entry) => getCompareAppKey(entry, storeType) !== appKey),
      );
    },
    [clearCompetitorDraftAnalysis, competitorDraftApps, storeType],
  );
  const openCompetitorDraftKeywordCountryPicker = React.useCallback(
    (keyword: string) => {
      if (!competitorDraftOwnApp) {
        toast.error("Select your app first.");
        return;
      }
      const trimmedKeyword = keyword.trim();
      if (!trimmedKeyword) return;
      const normalizedKeyword = trimmedKeyword.toLowerCase();
      const existingSelection =
        competitorDraftSelectedKeywords.find(
          (entry) => entry.keyword.trim().toLowerCase() === normalizedKeyword,
        ) || null;
      const existingTrackedCountries =
        competitorDraftTrackedCountryMap.get(normalizedKeyword) || [];
      const normalizedCurrentCountry = normalizeCountryCode(country, "us");
      const initialSelectedCountries =
        existingSelection?.selectedCountries.length
          ? existingSelection.selectedCountries
          : existingTrackedCountries.includes(normalizedCurrentCountry)
            ? []
            : [normalizedCurrentCountry];
      setTrackCountryPickerState({
        keyword: trimmedKeyword,
        app: competitorDraftOwnApp,
        store: storeType,
        appKind: "competitor",
        appSource: "manual",
        currentCountry: normalizedCurrentCountry,
        currentRank: -1,
        currentRankKnown: false,
        existingTrackedCountries,
        selectedCountries: initialSelectedCountries,
        selectionKind: "competitor_draft",
      });
    },
    [
      competitorDraftOwnApp,
      competitorDraftSelectedKeywords,
      competitorDraftTrackedCountryMap,
      country,
      storeType,
    ],
  );
  const removeCompetitorDraftKeyword = React.useCallback((keyword: string) => {
    const confirmed = window.confirm(
      `Remove "${keyword}" from the tracking selection?`,
    );
    if (!confirmed) {
      return;
    }
    const normalized = keyword.trim().toLowerCase();
    setCompetitorDraftSelectedKeywords((prev) =>
      prev.filter((entry) => entry.keyword.trim().toLowerCase() !== normalized),
    );
  }, []);
  const searchCompetitorDraftKeyword = React.useCallback(async () => {
    const keyword = competitorDraftKeywordSearch.trim();
    if (!keyword) {
      toast.error("Enter a keyword to check for both apps.");
      return;
    }
    if (!competitorDraftOwnApp || competitorDraftApps.length === 0) {
      toast.error("Choose your app and one rival first.");
      return;
    }

    const appsToCheck = [
      createCompetitorGroupAppRecord(competitorDraftOwnApp, storeType, "own"),
      ...competitorDraftApps.map((app) =>
        createCompetitorGroupAppRecord(app, storeType, "competitor"),
      ),
    ];

    setIsCheckingCompetitorDraftKeyword(true);
    try {
      const appResults = await Promise.all(
        appsToCheck.map(async (app) => {
          try {
            const data = await fetchAuthedJson<{
              keyword: string;
              rank: number;
              depth?: number;
            }>(
              `/api/ranking?keyword=${encodeURIComponent(keyword)}&appId=${encodeURIComponent(app.appId)}&store=${storeType}&country=${country}&refresh=true&depth=${TRACKED_KEYWORD_RANKING_DEPTH}`,
            );
            return {
              appKey: app.appKey,
              title: app.title,
              role: app.role,
              lastRank: data.rank,
              lastCheckStatus:
                data.rank === -1
                  ? ("not_ranked" as const)
                  : ("ok" as const),
              lastError: undefined,
            } satisfies CompetitorDraftKeywordCandidateApp;
          } catch (err) {
            logError(err, {
              context: "searchCompetitorDraftKeyword",
              keyword,
              appId: app.appId,
              store: storeType,
              country,
            });
            return {
              appKey: app.appKey,
              title: app.title,
              role: app.role,
              lastRank: -1,
              lastCheckStatus: "error" as const,
              lastError: getFriendlyErrorMessage(err),
            } satisfies CompetitorDraftKeywordCandidateApp;
          }
        }),
      );

      if (appResults.every((entry) => entry.lastCheckStatus === "error")) {
        toast.error("Could not check this keyword right now.");
        return;
      }

      setCompetitorDraftKeywordSearchResults((prev) => {
        const normalized = keyword.toLowerCase();
        const next = prev.filter(
          (entry) => entry.keyword.trim().toLowerCase() !== normalized,
        );
        return [
          {
            keyword,
            source: "search",
            detail: "Custom search across both apps",
            apps: appResults,
          },
          ...next,
        ];
      });
      toast.success("Checked this keyword for both apps.");
    } finally {
      setIsCheckingCompetitorDraftKeyword(false);
    }
  }, [
    competitorDraftApps,
    competitorDraftKeywordSearch,
    competitorDraftOwnApp,
    country,
    storeType,
  ]);
  const searchTrackedCompetitorGroupKeyword = React.useCallback(
    async (group: CompetitorGroupRecord) => {
      const keyword =
        competitorTrackedKeywordSearchByGroup[group.groupId]?.trim() || "";
      if (!keyword) {
        toast.error("Enter a keyword to check for this competitor group.");
        return;
      }

      const appsToCheck = [group.ownApp, ...group.competitors];
      setIsCheckingCompetitorTrackedKeywordByGroup((prev) => ({
        ...prev,
        [group.groupId]: true,
      }));
      try {
        const appResults = await Promise.all(
          appsToCheck.map(async (app) => {
            try {
              const data = await fetchAuthedJson<{
                keyword: string;
                rank: number;
                depth?: number;
              }>(
                `/api/ranking?keyword=${encodeURIComponent(keyword)}&appId=${encodeURIComponent(app.appId)}&store=${group.store}&country=${group.country}&refresh=true&depth=${TRACKED_KEYWORD_RANKING_DEPTH}`,
              );
              return {
                appKey: app.appKey,
                title: app.title,
                role: app.role,
                lastRank: data.rank,
                lastCheckStatus:
                  data.rank === -1
                    ? ("not_ranked" as const)
                    : ("ok" as const),
                lastError: undefined,
              } satisfies CompetitorDraftKeywordCandidateApp;
            } catch (err) {
              logError(err, {
                context: "searchTrackedCompetitorGroupKeyword",
                groupId: group.groupId,
                keyword,
                appId: app.appId,
                store: group.store,
                country: group.country,
              });
              return {
                appKey: app.appKey,
                title: app.title,
                role: app.role,
                lastRank: -1,
                lastCheckStatus: "error" as const,
                lastError: getFriendlyErrorMessage(err),
              } satisfies CompetitorDraftKeywordCandidateApp;
            }
          }),
        );

        if (appResults.every((entry) => entry.lastCheckStatus === "error")) {
          toast.error("Could not check this keyword right now.");
          return;
        }

        setCompetitorTrackedKeywordSearchResultsByGroup((prev) => {
          const current = prev[group.groupId] || [];
          const normalized = keyword.toLowerCase();
          const next = current.filter(
            (entry) => entry.keyword.trim().toLowerCase() !== normalized,
          );
          return {
            ...prev,
            [group.groupId]: [
              {
                keyword,
                source: "search",
                detail: "Custom search across this competitor group",
                apps: appResults,
              },
              ...next,
            ],
          };
        });
        toast.success("Checked this keyword for the whole group.");
      } finally {
        setIsCheckingCompetitorTrackedKeywordByGroup((prev) => ({
          ...prev,
          [group.groupId]: false,
        }));
      }
    },
    [competitorTrackedKeywordSearchByGroup, fetchAuthedJson],
  );
  const toggleExpandedCompetitorTrackedKeyword = React.useCallback(
    (groupKey: string) => {
      setExpandedCompetitorTrackedKeywordGroupKeys((prev) =>
        prev.includes(groupKey)
          ? prev.filter((entry) => entry !== groupKey)
          : [...prev, groupKey],
      );
    },
    [],
  );
  const refreshCompetitorTrackedKeyword = React.useCallback(
    async (
      record: CompetitorTrackedKeywordRecord,
      errorContext: string,
    ): Promise<{
      updatedRecord: CompetitorTrackedKeywordRecord;
      historyEntries: CompetitorRankHistoryEntry[];
      failedApps: string[];
    }> => {
      if (!hasActiveBillingAccess) {
        openUpgradeForBillingAccess();
        return {
          updatedRecord: record,
          historyEntries: [],
          failedApps: [],
        };
      }
      if (!isCompetitorTrackedKeywordWithinActiveLimit(record)) {
        toast.error(
          "This competitor tracked keyword is paused because your current plan keyword limit has been reached.",
        );
        setViewMode("upgrade");
        return {
          updatedRecord: record,
          historyEntries: [],
          failedApps: [],
        };
      }
      const refreshedAt = new Date().toISOString();
      const appResults = await Promise.all(
        record.apps.map(async (app) => {
          try {
            const data = await fetchAuthedJson<{ keyword: string; rank: number; depth?: number }>(
              `/api/ranking?keyword=${encodeURIComponent(record.keyword)}&appId=${encodeURIComponent(app.appId)}&store=${record.store}&country=${record.country}&refresh=true&depth=${TRACKED_KEYWORD_RANKING_DEPTH}`,
            );
            return {
              app: {
                ...app,
                lastRank: data.rank,
                lastChecked: refreshedAt,
                lastCheckStatus:
                  data.rank === -1 ? ("not_ranked" as const) : ("ok" as const),
                lastError: undefined,
              },
              historyEntry: {
                trackedKeywordId: record.trackedKeywordId,
                groupId: record.groupId,
                keyword: record.keyword,
                appId: app.appId,
                appKey: app.appKey,
                store: record.store,
                country: record.country,
                rank: data.rank,
                rankDepth: data.depth ?? TRACKED_KEYWORD_RANKING_DEPTH,
                timestamp: refreshedAt,
              } satisfies CompetitorRankHistoryEntry,
              failed: false,
            };
          } catch (err) {
            logError(err, {
              context: errorContext,
              keyword: record.keyword,
              appId: app.appId,
              store: record.store,
              country: record.country,
            });
            return {
              app: {
                ...app,
                lastChecked: refreshedAt,
                lastCheckStatus: "error" as const,
                lastError: getFriendlyErrorMessage(err),
              },
              historyEntry: null,
              failed: true,
            };
          }
        }),
      );
      return {
        updatedRecord: {
          ...record,
          apps: appResults.map((result) => result.app),
          updatedAt: refreshedAt,
          lastCheckedAt: refreshedAt,
        },
        historyEntries: appResults.flatMap((result) =>
          result.historyEntry ? [result.historyEntry] : [],
        ),
        failedApps: appResults
          .filter((result) => result.failed)
          .map((result) => result.app.title),
      };
    },
    [
      hasActiveBillingAccess,
      isCompetitorTrackedKeywordWithinActiveLimit,
      openUpgradeForBillingAccess,
    ],
  );
  const refreshCompetitorTrackedKeywordBatch = React.useCallback(
    async (
      records: CompetitorTrackedKeywordRecord[],
      errorContext: string,
    ) =>
      mapWithConcurrency(
        records,
        TRACKED_KEYWORD_REFRESH_CONCURRENCY,
        (record) => refreshCompetitorTrackedKeyword(record, errorContext),
      ),
    [refreshCompetitorTrackedKeyword],
  );
  refreshCompetitorTrackedKeywordBatchRef.current =
    refreshCompetitorTrackedKeywordBatch;
  const analyzeCompetitorDraftGroup = React.useCallback(async () => {
    if (!competitorDraftOwnApp) {
      toast.error("Select your app first.");
      return;
    }
    if (competitorDraftApps.length === 0) {
      toast.error("Add at least one competitor app.");
      return;
    }
    const draftTargets = [
      {
        appRecord: createCompetitorGroupAppRecord(
          competitorDraftOwnApp,
          storeType,
          "own",
        ),
        appDetails: competitorDraftOwnApp,
      },
      ...competitorDraftApps.map((app) => ({
        appRecord: createCompetitorGroupAppRecord(app, storeType, "competitor"),
        appDetails: app,
      })),
    ];
    setIsAnalyzingCompetitorGroup(true);
    setCompetitorGroupError(null);
    try {
      const results = await mapWithConcurrency(
        draftTargets,
        2,
        async ({ appDetails }) => {
          try {
            const payload = await fetchDiscoveryForApp(
              appDetails,
              storeType,
              country,
              {
                force: true,
                mode: competitorGroupMode,
              },
            );
            return { status: "fulfilled" as const, value: payload };
          } catch (error) {
            return { status: "rejected" as const, reason: error };
          }
        },
      );
      const nextDiscoveries: Record<string, DiscoveryPayload> = {};
      const failures: string[] = [];
      results.forEach((result, index) => {
        const appRecord = draftTargets[index]?.appRecord;
        if (!appRecord) {
          return;
        }
        if (result.status === "fulfilled" && result.value) {
          nextDiscoveries[appRecord.appKey] = result.value;
          return;
        }
        failures.push(appRecord.title);
      });
      const successfulCount = Object.keys(nextDiscoveries).length;
      const ownAppKey = draftTargets[0]?.appRecord.appKey;
      const successfulCompetitorCount = draftTargets
        .slice(1)
        .filter((entry) => Boolean(nextDiscoveries[entry.appRecord.appKey])).length;
      if (
        !ownAppKey ||
        !nextDiscoveries[ownAppKey] ||
        successfulCount < 2 ||
        successfulCompetitorCount < 1
      ) {
        const message =
          "Could not build a useful competitor group analysis. Try again.";
        setCompetitorDraftAnalysis(null);
        setCompetitorGroupError(message);
        toast.error(message);
        return;
      }
      const snapshot = createCompetitorGroupSnapshot(
        "draft",
        draftTargets
          .map((entry) => entry.appRecord)
          .filter((app) => Boolean(nextDiscoveries[app.appKey])),
        nextDiscoveries,
        storeType,
        country,
        competitorGroupMode,
      );
      setCompetitorDraftAnalysis(snapshot);
      if (failures.length > 0) {
        const message = `Analyzed ${successfulCount}/${draftTargets.length} apps. ${failures.join(", ")} could not be refreshed.`;
        setCompetitorGroupError(message);
        toast.info(message);
      } else {
        toast.success("Competitor analysis is ready.");
      }
    } catch (err) {
      logError(err, {
        context: "analyzeCompetitorDraftGroup",
        store: storeType,
        country,
      });
      const message = "Failed to analyze this competitor group.";
      setCompetitorDraftAnalysis(null);
      setCompetitorGroupError(message);
      toast.error(message);
    } finally {
      setIsAnalyzingCompetitorGroup(false);
    }
  }, [
    competitorDraftApps,
    competitorDraftOwnApp,
    competitorGroupMode,
    country,
    fetchDiscoveryForApp,
    storeType,
  ]);
  const trackCompetitorDraftKeywords = React.useCallback(
    async (pendingSelection?: CompetitorDraftKeywordSelection) => {
    if (!competitorDraftOwnApp || competitorDraftApps.length === 0) {
      toast.error("Choose your app and one rival before tracking a keyword.");
      return;
    }
    if (!competitorDraftAnalysis || competitorDraftAnalysis.appInsights.length < 2) {
      toast.error("Analyze this competitor pair before tracking a keyword.");
      return;
    }
    const selectedKeywordEntries = normalizeCompetitorDraftKeywordSelections(
      pendingSelection
        ? competitorDraftSelectedKeywords.concat(pendingSelection)
        : competitorDraftSelectedKeywords,
      country,
    );
    if (selectedKeywordEntries.length === 0) {
      toast.error("Choose at least one keyword to track.");
      return;
    }
    setCompetitorDraftSelectedKeywords(selectedKeywordEntries);
    const groupId = createCompetitorGroupId();
    const ownApp = createCompetitorGroupAppRecord(
      competitorDraftOwnApp,
      storeType,
      "own",
    );
    const competitors = competitorDraftApps.map((app) =>
      createCompetitorGroupAppRecord(app, storeType, "competitor"),
    );
    const existingGroup = matchingCompetitorDraftGroup;
    const targetGroupId = existingGroup?.groupId || groupId;
    const snapshotId = createCompetitorGroupSnapshotId(targetGroupId);
    const nowIso = new Date().toISOString();
    const snapshot: CompetitorGroupSnapshotRecord = {
      ...competitorDraftAnalysis,
      snapshotId,
      groupId: targetGroupId,
      store: storeType,
      country: normalizeCountryCode(country, "us"),
      mode: competitorGroupMode,
      loadedAt: nowIso,
    };
    const trackedKeywordEntries = selectedKeywordEntries.flatMap((entry) => {
      const trimmedKeyword = entry.keyword.trim();
      if (!trimmedKeyword) return [];
      const selectedCountries = Array.from(
        new Set(
          entry.selectedCountries.map((selectedCountry) =>
            normalizeCountryCode(selectedCountry, country),
          ),
        ),
      ).sort((a, b) => a.localeCompare(b));
      if (selectedCountries.length === 0) return [];
      return [{ keyword: trimmedKeyword, selectedCountries }];
    });
    const existingTrackedKeywords = competitorTrackedKeywords.filter(
      (record) => record.groupId === targetGroupId,
    );
    const trackedKeywordSeeds = trackedKeywordEntries.flatMap(
      ({ keyword, selectedCountries }) =>
        selectedCountries.map((countryCode) => {
          const normalizedKeyword = keyword.toLowerCase();
          const existingRecord = existingTrackedKeywords.find(
            (record) =>
              record.keyword.toLowerCase() === normalizedKeyword &&
              record.country === countryCode,
          );
          const appsForKeyword = [ownApp, ...competitors].map((app) => {
            const currentInsight = competitorDraftAnalysis.appInsights.find(
              (insight) => insight.appKey === app.appKey,
            );
            const discoveredRank = currentInsight?.rankings.find(
              (ranking) =>
                ranking.keyword.trim().toLowerCase() === normalizedKeyword,
            );
            const existingApp =
              existingRecord?.apps.find((entry) => entry.appKey === app.appKey) ||
              null;
            const canUseDiscoveryRank =
              countryCode === normalizeCountryCode(country, "us");
            return {
              ...(existingApp || app),
              appKey: app.appKey,
              appId: app.appId,
              store: app.store,
              role: app.role,
              title: app.title,
              description: app.description,
              developer: app.developer,
              icon: app.icon,
              category: app.category,
              url: app.url,
              lastRank:
                canUseDiscoveryRank
                  ? discoveredRank?.rank ?? existingApp?.lastRank ?? -1
                  : existingApp?.lastRank ?? -1,
              lastChecked:
                canUseDiscoveryRank && discoveredRank
                  ? snapshot.loadedAt
                  : existingApp?.lastChecked || new Date(0).toISOString(),
              lastCheckStatus:
                canUseDiscoveryRank && discoveredRank
                  ? "ok"
                  : existingApp?.lastCheckStatus || "pending",
              lastError:
                canUseDiscoveryRank && discoveredRank
                  ? undefined
                  : existingApp?.lastError,
            } satisfies CompetitorTrackedKeywordAppRecord;
          });
          return {
            trackedKeywordId:
              existingRecord?.trackedKeywordId ||
              createCompetitorTrackedKeywordId(
                targetGroupId,
                keyword,
                countryCode,
              ),
            groupId: targetGroupId,
            keyword,
            store: storeType,
            country: countryCode,
            apps: appsForKeyword,
            createdAt: existingRecord?.createdAt || nowIso,
            updatedAt: nowIso,
            lastCheckedAt: existingRecord?.lastCheckedAt,
          } satisfies CompetitorTrackedKeywordRecord;
        }),
    );
    const newTrackedKeywordSeeds = trackedKeywordSeeds.filter(
      (record) =>
        !existingTrackedKeywords.some(
          (existingRecord) =>
            existingRecord.keyword.trim().toLowerCase() ===
              record.keyword.trim().toLowerCase() &&
            existingRecord.country === record.country,
        ),
    );
    if (newTrackedKeywordSeeds.length === 0) {
      setTrackCountryPickerState(null);
      setCompetitorDraftSelectedKeywords([]);
      toast.info("This keyword is already tracked in the selected countries.");
      return;
    }
    const nextGroup: CompetitorGroupRecord = {
      groupId: targetGroupId,
      store: storeType,
      country: normalizeCountryCode(country, "us"),
      mode: competitorGroupMode,
      ownApp,
      competitors,
      trackedKeywordIds: Array.from(
        new Set(
          (existingGroup?.trackedKeywordIds || []).concat(
            trackedKeywordSeeds.map((record) => record.trackedKeywordId),
          ),
        ),
      ),
      createdAt: existingGroup?.createdAt || nowIso,
      updatedAt: nowIso,
      lastAnalyzedAt: snapshot.loadedAt,
      latestSnapshotId: snapshot.snapshotId,
    };
    const nextCompetitorGroups = upsertCompetitorGroupRecord(
      competitorGroups,
      nextGroup,
    );
    const nextCompetitorGroupLimitKeys = new Set(
      nextCompetitorGroups.map((group) => group.groupId),
    );
    if (
      !guardGovernedAddition(
        "competitorGroups",
        currentCompetitorGroupLimitKeys,
        nextCompetitorGroupLimitKeys,
      )
    ) {
      return;
    }
    const nextCompetitorTrackedKeywords = mergeCompetitorTrackedKeywordCollections(
      competitorTrackedKeywords,
      trackedKeywordSeeds,
    );
    const nextTrackedKeywordLimitKeys = new Set(
      trackedKeywords
        .map((trackedKeyword) => getPlanTrackedKeywordIdentityKey(trackedKeyword))
        .concat(
          nextCompetitorTrackedKeywords.map((trackedKeyword) =>
            getCompetitorTrackedKeywordIdentityKey(trackedKeyword),
          ),
        ),
    );
    if (
      !guardGovernedAddition(
        "trackedKeywords",
        currentTrackedKeywordLimitKeys,
        nextTrackedKeywordLimitKeys,
      )
    ) {
      return;
    }
    setCompetitorGroups(nextCompetitorGroups);
    setCompetitorGroupSnapshots((prev) =>
      upsertCompetitorGroupSnapshot(prev, snapshot),
    );
    setCompetitorTrackedKeywords(nextCompetitorTrackedKeywords);
    setExpandedCompetitorGroupIds((prev) =>
      prev.includes(targetGroupId) ? prev : [...prev, targetGroupId],
    );
    setExpandedCompetitorTrackedKeywordGroupKeys((prev) =>
      Array.from(
        new Set(
          prev.concat(
            trackedKeywordSeeds.map((record) =>
              getCompetitorTrackedKeywordGroupKey(record),
            ),
          ),
        ),
      ),
    );
    try {
      const refreshedKeywords = await refreshCompetitorTrackedKeywordBatch(
        newTrackedKeywordSeeds,
        "trackCompetitorDraftKeywords_refresh",
      );
      setCompetitorTrackedKeywords((prev) =>
        mergeCompetitorTrackedKeywordCollections(
          prev,
          refreshedKeywords.map((entry) => entry.updatedRecord),
        ),
      );
      setCompetitorRankHistory((prev) =>
        mergeCompetitorRankHistoryEntries(
          prev,
          refreshedKeywords.flatMap((entry) => entry.historyEntries),
        ),
      );
      const failedApps = Array.from(
        new Set(refreshedKeywords.flatMap((entry) => entry.failedApps)),
      );
      resetCompetitorDraft();
      if (failedApps.length > 0) {
        toast.success(
          `Tracking started. Some app checks failed: ${failedApps.join(", ")}.`,
        );
      } else {
        toast.success(
          existingGroup
            ? `Keyword added to ${getCompetitorGroupLabel(nextGroup)}.`
            : "Competitor tracking started. Your group was created automatically.",
        );
      }
    } catch (err) {
      logError(err, {
        context: "trackCompetitorDraftKeywords",
        groupId: targetGroupId,
        store: storeType,
        country,
      });
      toast.error(
        existingGroup
          ? "The group was updated, but rank refresh failed. Try again from the tracked group."
          : "Tracking started, but rank refresh failed. Try again from the tracked group.",
      );
    }
  }, [
    competitorDraftAnalysis,
    competitorDraftApps,
    competitorDraftOwnApp,
    competitorDraftSelectedKeywords,
    competitorGroupMode,
    competitorGroups,
    competitorTrackedKeywords,
    country,
    currentCompetitorGroupLimitKeys,
    currentTrackedKeywordLimitKeys,
    guardGovernedAddition,
    matchingCompetitorDraftGroup,
    refreshCompetitorTrackedKeywordBatch,
    resetCompetitorDraft,
    storeType,
    trackedKeywords,
  ]);
  trackCompetitorDraftKeywordsRef.current = trackCompetitorDraftKeywords;
  const removeCompetitorGroup = React.useCallback((groupId: string) => {
    const groupToRemove =
      competitorGroups.find((group) => group.groupId === groupId) || null;
    const confirmed = window.confirm(
      groupToRemove
        ? `Remove competitor group "${getCompetitorGroupLabel(groupToRemove)}"?`
        : "Remove this competitor group?",
    );
    if (!confirmed) {
      return;
    }
    setCompetitorGroups((prev) => prev.filter((group) => group.groupId !== groupId));
    setCompetitorGroupSnapshots((prev) =>
      prev.filter((snapshot) => snapshot.groupId !== groupId),
    );
    setCompetitorTrackedKeywords((prev) =>
      prev.filter((record) => record.groupId !== groupId),
    );
    setCompetitorRankHistory((prev) =>
      prev.filter((entry) => entry.groupId !== groupId),
    );
    const removedTrackedKeywordGroupKeys = new Set(
      competitorTrackedKeywords
        .filter((record) => record.groupId === groupId)
        .map((record) => getCompetitorTrackedKeywordGroupKey(record)),
    );
    setExpandedCompetitorTrackedKeywordGroupKeys((prev) =>
      prev.filter((groupKey) => !removedTrackedKeywordGroupKeys.has(groupKey)),
    );
    setExpandedCompetitorGroupIds((prev) =>
      prev.filter((entry) => entry !== groupId),
    );
    toast.success("Competitor tracking group removed.");
  }, [competitorGroups, competitorTrackedKeywords]);
  const removeCompetitorTrackedKeywordFromGroup = React.useCallback(
    (
      groupId: string,
      trackedKeywordId: string,
      keyword: string,
      trackedCountry?: string,
    ) => {
      const countryLabel = trackedCountry
        ? findCountryName(trackedCountry) || trackedCountry.toUpperCase()
        : null;
      const confirmed = window.confirm(
        countryLabel
          ? `Remove "${keyword}" in ${countryLabel} from this competitor group?`
          : `Remove "${keyword}" from this competitor group?`,
      );
      if (!confirmed) {
        return;
      }
      setCompetitorTrackedKeywords((prev) =>
        prev.filter((record) => record.trackedKeywordId !== trackedKeywordId),
      );
      setCompetitorRankHistory((prev) =>
        prev.filter((entry) => entry.trackedKeywordId !== trackedKeywordId),
      );
      setCompetitorGroups((prev) =>
        prev.map((group) =>
          group.groupId === groupId
            ? {
                ...group,
                trackedKeywordIds: group.trackedKeywordIds.filter(
                  (entry) => entry !== trackedKeywordId,
                ),
                updatedAt: new Date().toISOString(),
              }
            : group,
        ),
      );
      setExpandedCompetitorTrackedKeywordGroupKeys((prev) =>
        prev.filter(
          (entry) =>
            entry !==
            getCompetitorTrackedKeywordGroupKey({ groupId, keyword }),
        ),
      );
      toast.success(
        `Removed "${keyword}"${trackedCountry ? ` in ${findCountryName(trackedCountry) || trackedCountry.toUpperCase()}` : ""} from this competitor group.`,
      );
    },
    [],
  );
  const refreshCompetitorGroup = React.useCallback(
    async (group: CompetitorGroupRecord) => {
      const apps = [group.ownApp, ...group.competitors];
      setIsAnalyzingCompetitorGroup(true);
      setCompetitorGroupError(null);
      try {
        const results = await mapWithConcurrency(
          apps,
          2,
          async (app) => {
            try {
              const payload = await fetchDiscoveryForApp(
                toCompetitorGroupAppDetails(app),
                group.store,
                group.country,
                { force: true, mode: group.mode },
              );
              return { status: "fulfilled" as const, value: { app, payload } };
            } catch (error) {
              return { status: "rejected" as const, reason: error };
            }
          },
        );
        const nextDiscoveries: Record<string, DiscoveryPayload> = {};
        const failures: string[] = [];
        results.forEach((result, index) => {
          const app = apps[index];
          if (result.status === "fulfilled" && result.value.payload) {
            nextDiscoveries[app.appKey] = result.value.payload;
            return;
          }
          failures.push(app.title);
        });
        const successfulApps = apps.filter(
          (app) => Boolean(nextDiscoveries[app.appKey]),
        );
        const ownAppKey = group.ownApp.appKey;
        const successfulCompetitorCount = group.competitors.filter((app) =>
          Boolean(nextDiscoveries[app.appKey]),
        ).length;
        if (
          !nextDiscoveries[ownAppKey] ||
          successfulApps.length < 2 ||
          successfulCompetitorCount < 1
        ) {
          throw new Error("Not enough competitor apps could be analyzed.");
        }
        const snapshot = createCompetitorGroupSnapshot(
          group.groupId,
          successfulApps,
          nextDiscoveries,
          group.store,
          group.country,
          group.mode,
        );
        setCompetitorGroupSnapshots((prev) =>
          upsertCompetitorGroupSnapshot(prev, snapshot),
        );
        setCompetitorGroups((prev) =>
          upsertCompetitorGroupRecord(prev, {
            ...group,
            trackedKeywordIds: group.trackedKeywordIds,
            updatedAt: new Date().toISOString(),
            lastAnalyzedAt: snapshot.loadedAt,
            latestSnapshotId: snapshot.snapshotId,
          }),
        );
        if (failures.length > 0) {
          const message = `Refreshed ${successfulApps.length}/${apps.length} apps. ${failures.join(", ")} could not be refreshed.`;
          setCompetitorGroupError(message);
          toast.info(message);
        } else {
          toast.success(`Refreshed ${getCompetitorGroupLabel(group)}.`);
        }
      } catch (err) {
        logError(err, {
          context: "refreshCompetitorGroup",
          groupId: group.groupId,
          store: group.store,
          country: group.country,
        });
        const message = `Failed to refresh ${getCompetitorGroupLabel(group)}.`;
        setCompetitorGroupError(message);
        toast.error(message);
      } finally {
        setIsAnalyzingCompetitorGroup(false);
      }
    },
    [fetchDiscoveryForApp],
  );
  const categories = React.useMemo(
    () =>
      Array.from(
        new Set(searchResults.map((app) => app.category).filter(Boolean)),
      ) as string[],
    [searchResults],
  );
  const filteredResults = React.useMemo(
    () =>
      selectedCategory
        ? searchResults.filter((app) => app.category === selectedCategory)
        : searchResults,
    [searchResults, selectedCategory],
  );
  const shouldShowSearchResults =
    viewMode === "compare" || viewMode === "competitors" || !selectedApp;
  const compareAppInsights = React.useMemo(() => {
    const compareApps = comparedApps.map((app) => ({
      appDetails: app,
      record: createCompetitorGroupAppRecord(app, storeType, "competitor"),
    }));
    return buildCompetitorAnalysisInsights(
      compareApps.map((entry) => entry.record),
      compareDiscoveries,
    ).map((insight) => ({
      ...insight,
      appDetails:
        compareApps.find((entry) => entry.record.appKey === insight.appKey)
          ?.appDetails || toCompetitorGroupAppDetails(insight.app),
      compareKey: insight.appKey,
      discovery: compareDiscoveries[insight.appKey],
    }));
  }, [comparedApps, compareDiscoveries, storeType]);
  const compareKeywordCoverage = React.useMemo(
    () => buildCompetitorKeywordCoverage(compareAppInsights),
    [compareAppInsights],
  );
  const compareSharedBattles = React.useMemo(
    () => buildCompetitorSharedBattles(compareKeywordCoverage),
    [compareKeywordCoverage],
  );
  const compareGapRows = React.useMemo(
    () => buildCompetitorGapRows(compareKeywordCoverage, compareAppInsights),
    [compareAppInsights, compareKeywordCoverage],
  );
  const compareCoverageChartData = React.useMemo(
    () =>
      compareAppInsights.map((insight) => ({
        appTitle: insight.app.title,
        top10: insight.top10,
        top30: insight.top30,
        top100: insight.top100,
      })),
    [compareAppInsights],
  );
  const compareAnalyzedCount = React.useMemo(
    () =>
      compareAppInsights.filter(
        (insight) => insight.rankings.length > 0 || insight.suggestions.length > 0,
      ).length,
    [compareAppInsights],
  );
  const compareCoverageLeaders = React.useMemo(
    () =>
      [...compareAppInsights]
        .sort(
          (a, b) =>
            b.top100 - a.top100 ||
            b.top30 - a.top30 ||
            b.top10 - a.top10 ||
            (a.averageRank ?? Number.POSITIVE_INFINITY) -
              (b.averageRank ?? Number.POSITIVE_INFINITY),
        )
        .slice(0, 4),
    [compareAppInsights],
  );
  const compareCoverageLeader = compareCoverageLeaders[0] || null;
  const formatCompareCoverageAxisLabel = React.useCallback(
    (value: unknown) => {
      const label = typeof value === "string" ? value : "";
      if (!label) return "";
      const maxLength = isMobileViewport ? 10 : 18;
      return label.length > maxLength ? `${label.slice(0, maxLength)}...` : label;
    },
    [isMobileViewport],
  );
  const selectedAppExportHistory = React.useMemo(() => {
    if (!selectedApp) return [];
    const appStoreId = getAppStoreId(selectedApp, storeType);
    return allRankHistory.filter(
      (entry) =>
        entry.appId === appStoreId &&
        entry.store === storeType &&
        entry.country === country,
    );
  }, [allRankHistory, country, selectedApp, storeType]);
  const selectedAppExportTrackedKeywords = React.useMemo(() => {
    if (!selectedApp) return [];
    const appStoreId = getAppStoreId(selectedApp, storeType);
    return trackedKeywords.filter(
      (entry) =>
        entry.appId === appStoreId &&
        entry.store === storeType &&
        entry.country === country,
    );
  }, [country, selectedApp, storeType, trackedKeywords]);
  const getExportFilenameBase = React.useCallback(() => {
    if (viewMode === "single" && selectedApp) {
      return `${slugifyFilenamePart(selectedApp.title)}-${storeType}-${country}`;
    }
    if (viewMode === "compare") {
      return `compare-${storeType}-${country}-${comparedApps.length}-apps`;
    }
    return `aso-export-${storeType}-${country}`;
  }, [comparedApps.length, country, selectedApp, storeType, viewMode]);
  const buildExportPayload = (): DataExportPayload => {
    const exportedAt = new Date().toISOString();
    const countryName =
      COUNTRIES.find((entry) => entry.code === country)?.name || country;
    const exportMode: WorkspaceViewMode =
      viewMode === "charts" ? "single" : viewMode;
    if (exportMode === "single" && selectedApp) {
      return {
        exportedAt,
        viewMode: "single",
        store: storeType,
        country,
        countryName,
        app: selectedApp,
        currentRankCheck: ranking || null,
        discoveredRankings: autoRankings,
        keywordSuggestions,
        trackedKeywords: selectedAppExportTrackedKeywords.map((entry) => ({
          appId: entry.appId,
          appTitle: entry.appTitle,
          country: entry.country,
          groupId: entry.groupId,
          keyword: entry.keyword,
          lastCheckStatus: entry.lastCheckStatus || "unknown",
          lastChecked: entry.lastChecked,
          lastError: entry.lastError,
          lastRank: entry.lastRank,
          store: entry.store,
        })),
        rankHistory: selectedAppExportHistory.map((entry) => ({
          isSimulated: entry.isSimulated,
          keyword: entry.keyword,
          rank: entry.rank,
          rankDepth: entry.rankDepth ?? 100,
          timestamp: entry.timestamp,
        })),
      };
    }
    if (exportMode === "compare") {
      return {
        exportedAt,
        viewMode: "compare",
        store: storeType,
        country,
        countryName,
        compareKeyword,
        comparedApps,
        compareRankings: compareRankings.map((entry) => ({
          appTitle: entry.appTitle,
          confidence: entry.confidence,
          demand: entry.demand,
          difficulty: entry.difficulty,
          rank: entry.rank,
          relevance: entry.relevance,
          volume: entry.volume,
        })),
        compareSummary: {
          analyzedApps: compareAnalyzedCount,
          totalApps: comparedApps.length,
          mode: compareDiscoveryMode,
        },
        appInsights: compareAppInsights.map((insight) => ({
          app: insight.appDetails,
          top10: insight.top10,
          top30: insight.top30,
          top100: insight.top100,
          averageRank: insight.averageRank,
          strongestKeyword: insight.strongestKeyword,
          bestSuggestion: insight.bestSuggestion,
          rankings: insight.rankings,
          suggestions: insight.suggestions,
        })),
        contestedKeywords: compareSharedBattles.map((entry) => ({
          averageDifficulty: entry.averageDifficulty,
          averageRelevance: entry.averageRelevance,
          averageVolume: entry.averageVolume,
          gap: entry.gap,
          keyword: entry.keyword,
          leaderApp: entry.leader.appTitle,
          leaderRank: entry.leader.rank,
          rankedApps: entry.rankedApps
            .map((rankedApp) => `${rankedApp.appTitle} #${rankedApp.rank}`)
            .join(" | "),
          runnerUpApp: entry.runnerUp?.appTitle || null,
          runnerUpRank: entry.runnerUp?.rank ?? null,
        })),
        gapOpportunities: compareGapRows.map((entry) => ({
          averageDifficulty: entry.averageDifficulty,
          averageRelevance: entry.averageRelevance,
          averageVolume: entry.averageVolume,
          isWhitespace: entry.isWhitespace,
          keyword: entry.keyword,
          leaderApp: entry.leader?.appTitle || null,
          leaderRank: entry.leader?.rank ?? null,
          missingApps: entry.missingApps,
          score: entry.score,
        })),
      };
    }
    if (exportMode === "tracked") {
      return {
        exportedAt,
        viewMode: "tracked",
        store: storeType,
        country,
        countryName,
        filters: {
          app: trackFilterApp,
          country:
            trackFilterCountry === "all"
              ? "all"
              : findCountryName(trackFilterCountry) || trackFilterCountry,
          search: deferredTrackSearchTerm.trim(),
          sortBy: trackSortBy,
        },
        groups: processedTrackedKeywordGroups.map((group) => ({
          appId: group.appId,
          appTitle: group.appTitle,
          countries: group.countries,
          errorRegions: group.countryViews.filter(
            (countryView) =>
              countryView.trackedKeyword.lastCheckStatus === "error",
          ).length,
          groupId: group.groupId,
          improvement: group.improvement,
          keyword: group.keyword,
          lastChecked: group.lastChecked,
          pendingRegions: group.countryViews.filter(
            (countryView) =>
              countryView.trackedKeyword.lastCheckStatus === "pending",
          ).length,
          rankedRegions: group.countryViews.filter(
            (countryView) => countryView.trackedKeyword.lastRank !== -1,
          ).length,
          store: group.store,
        })),
        regions: processedTrackedKeywordGroups.flatMap((group) =>
          group.countryViews.map((countryView) => ({
            appId: group.appId,
            appTitle: group.appTitle,
            country: countryView.trackedKeyword.country,
            currentRank: countryView.currentRank,
            groupId: group.groupId,
            history: countryView.tHistory.map((point) => ({
              rank: point.rawRank,
              rankDepth: point.rankDepth,
              timestamp: point.rawTimestamp,
            })),
            historyPoints: countryView.tHistory.length,
            improvement: countryView.improvement,
            keyword: group.keyword,
            lastCheckStatus: countryView.trackedKeyword.lastCheckStatus,
            lastChecked: countryView.trackedKeyword.lastChecked,
            lastError: countryView.trackedKeyword.lastError,
            lastRank: countryView.trackedKeyword.lastRank,
            startRank: countryView.startRank,
            store: group.store,
          })),
        ),
        summary: {
          averageRank: trackedOverviewStats.averageRank,
          needsAttentionCount: trackedDashboardStats.needsAttentionCount,
          pendingCount: trackedDashboardStats.pendingCount,
          rankedCount: trackedDashboardStats.rankedCount,
          top10Count: trackedOverviewStats.top10Count,
          top3Count: trackedOverviewStats.top3Count,
          totalGroups: trackedDashboardStats.totalGroups,
          totalRegions: trackedDashboardStats.totalRegions,
          trackedAppCount: trackedAppUsageCount,
        },
      };
    }
    if (exportMode === "competitors") {
      return {
        exportedAt,
        viewMode: "competitors",
        store: storeType,
        country,
        countryName,
        appRoster: competitorDashboardCards.flatMap((card) => {
          const groupName = getCompetitorGroupLabel(card.group);
          return [card.group.ownApp, ...card.group.competitors].map((app) => ({
            appId: app.appId,
            groupId: card.group.groupId,
            groupName,
            role: app.role,
            title: app.title,
          }));
        }),
        groups: competitorDashboardCards.map((card) => ({
          competitorTitles: card.group.competitors.map((app) => app.title),
          groupId: card.group.groupId,
          groupName: getCompetitorGroupLabel(card.group),
          lastKeywordRefreshAt: card.lastKeywordRefreshAt,
          ownAppTitle: card.group.ownApp.title,
          rankedPairCount: card.rankedPairCount,
          snapshotLoadedAt: card.snapshot?.loadedAt || null,
          trackedKeywordCount: card.trackedKeywords.length,
        })),
        historyRows: competitorDashboardCards.flatMap((card) =>
          card.trackedKeywords.flatMap((record) => {
            const historyByApp =
              competitorRankHistoryByTrackedKeywordId.get(
                record.trackedKeywordId,
              ) || new Map<string, ChartRankHistoryEntry[]>();
            return record.apps.map((app) => ({
              appTitle: app.title,
              country: record.country,
              history: buildTrackedAppChartHistory(
                app,
                historyByApp.get(app.appKey) || [],
              ).map((point) => ({
                rank: point.rawRank,
                rankDepth: point.rankDepth,
                timestamp: point.rawTimestamp,
              })),
              keyword: record.keyword,
              store: record.store,
            }));
          }),
        ),
        keywords: competitorDashboardCards.flatMap((card) => {
          const groupName = getCompetitorGroupLabel(card.group);
          return card.trackedKeywords.map((record) => ({
            appCount: record.apps.length,
            country: record.country,
            groupId: card.group.groupId,
            groupName,
            keyword: record.keyword,
            lastCheckedAt: record.lastCheckedAt || null,
            rankedApps:
              [...record.apps]
                .filter((app) => app.lastRank !== -1)
                .sort((a, b) => a.lastRank - b.lastRank)
                .map((app) => `${app.title} #${app.lastRank}`)
                .join(" | ") || "-",
            store: record.store,
          }));
        }),
        summary: {
          groupCount: competitorGroupStats.groupCount,
          rankedPairCount: competitorDashboardCards.reduce(
            (sum, card) => sum + card.rankedPairCount,
            0,
          ),
          snapshotCount: competitorGroupStats.snapshotCount,
          trackedKeywordCount: competitorGroupStats.trackedKeywordCount,
          withSnapshots: competitorGroupStats.withSnapshots,
        },
      };
    }
    if (exportMode === "reports") {
      if (!reportsExportSnapshot) {
        throw new Error("Reports data is still loading.");
      }
      return {
        exportedAt,
        viewMode: "reports",
        store: storeType,
        country,
        countryName,
        report: reportsExportSnapshot,
      };
    }
    throw new Error("This page cannot be exported.");
  };
  const buildExportRows = (): CsvRow[] => {
    const payload = buildExportPayload();
    const rows: CsvRow[] = [
      {
        section: "metadata",
        exportedAt: payload.exportedAt,
        viewMode: payload.viewMode,
        store: payload.store,
        country: payload.country,
        countryName: payload.countryName,
      },
    ];
    if (payload.viewMode === "single" && "app" in payload) {
      rows.push({
        section: "app",
        title: payload.app.title,
        developer: payload.app.developer,
        appId: payload.app.appId,
        storeId: getAppStoreId(payload.app, storeType),
        category: payload.app.category,
        score: payload.app.score,
        installs: payload.app.installs,
        url: payload.app.url,
      });
      if (payload.currentRankCheck) {
        rows.push({
          section: "current_rank_check",
          keyword: payload.currentRankCheck.keyword,
          rank: payload.currentRankCheck.rank,
          demand: payload.currentRankCheck.demand,
          volume: payload.currentRankCheck.volume,
          difficulty: payload.currentRankCheck.difficulty,
          relevance: payload.currentRankCheck.relevance,
          confidence: payload.currentRankCheck.confidence,
        });
      }
      payload.discoveredRankings.forEach((entry, index) => {
        rows.push({
          section: "discovered_rankings",
          row: index + 1,
          keyword: entry.keyword,
          rank: entry.rank,
          demand: entry.demand,
          volume: entry.volume,
          difficulty: entry.difficulty,
          relevance: entry.relevance,
          confidence: entry.confidence,
        });
      });
      payload.keywordSuggestions.forEach((entry, index) => {
        rows.push({
          section: "keyword_suggestions",
          row: index + 1,
          keyword: entry.keyword,
          demand: entry.demand,
          volume: entry.volume,
          difficulty: entry.difficulty,
          relevance: entry.relevance,
          confidence: entry.confidence,
        });
      });
      payload.trackedKeywords.forEach((entry, index) => {
        rows.push({
          section: "tracked_keywords",
          row: index + 1,
          keyword: entry.keyword,
          appTitle: entry.appTitle,
          lastRank: entry.lastRank,
          lastChecked: entry.lastChecked,
          lastCheckStatus: entry.lastCheckStatus,
          lastError: entry.lastError,
        });
      });
      payload.rankHistory.forEach((entry, index) => {
        rows.push({
          section: "rank_history",
          row: index + 1,
          keyword: entry.keyword,
          rank: entry.rank,
          rankDepth: entry.rankDepth,
          timestamp: entry.timestamp,
          isSimulated: entry.isSimulated,
        });
      });
    }
    if (payload.viewMode === "compare" && "comparedApps" in payload) {
      rows.push({
        section: "compare_summary",
        compareKeyword: payload.compareKeyword,
        analyzedApps: payload.compareSummary.analyzedApps,
        totalApps: payload.compareSummary.totalApps,
        mode: payload.compareSummary.mode,
      });
      payload.comparedApps.forEach((app, index) => {
        rows.push({
          section: "compared_apps",
          row: index + 1,
          title: app.title,
          developer: app.developer,
          appId: app.appId,
          storeId: getAppStoreId(app, storeType),
          category: app.category,
          score: app.score,
          url: app.url,
        });
      });
      payload.compareRankings.forEach((entry, index) => {
        rows.push({
          section: "compare_rankings",
          row: index + 1,
          appTitle: entry.appTitle,
          rank: entry.rank,
          demand: entry.demand,
          volume: entry.volume,
          difficulty: entry.difficulty,
          relevance: entry.relevance,
          confidence: entry.confidence,
        });
      });
      payload.appInsights.forEach((entry, index) => {
        rows.push({
          section: "compare_app_insights",
          row: index + 1,
          appTitle: entry.app.title,
          appId: entry.app.appId,
          top10: entry.top10,
          top30: entry.top30,
          top100: entry.top100,
          averageRank: entry.averageRank,
          strongestKeyword: entry.strongestKeyword?.keyword,
          strongestKeywordRank: entry.strongestKeyword?.rank,
          bestSuggestion: entry.bestSuggestion?.keyword,
        });
      });
      payload.contestedKeywords.forEach((entry, index) => {
        rows.push({
          section: "contested_keywords",
          row: index + 1,
          keyword: entry.keyword,
          leaderApp: entry.leaderApp,
          leaderRank: entry.leaderRank,
          runnerUpApp: entry.runnerUpApp,
          runnerUpRank: entry.runnerUpRank,
          gap: entry.gap,
          averageVolume: entry.averageVolume,
          averageDifficulty: entry.averageDifficulty,
          averageRelevance: entry.averageRelevance,
          rankedApps: entry.rankedApps,
        });
      });
      payload.gapOpportunities.forEach((entry, index) => {
        rows.push({
          section: "gap_opportunities",
          row: index + 1,
          keyword: entry.keyword,
          leaderApp: entry.leaderApp,
          leaderRank: entry.leaderRank,
          score: entry.score,
          averageVolume: entry.averageVolume,
          averageDifficulty: entry.averageDifficulty,
          averageRelevance: entry.averageRelevance,
          isWhitespace: entry.isWhitespace,
          missingApps: entry.missingApps.join(" | "),
        });
      });
    }
    if (payload.viewMode === "tracked" && "groups" in payload) {
      rows.push({
        section: "tracked_summary",
        totalGroups: payload.summary.totalGroups,
        totalRegions: payload.summary.totalRegions,
        rankedCount: payload.summary.rankedCount,
        top10Count: payload.summary.top10Count,
        top3Count: payload.summary.top3Count,
        averageRank: payload.summary.averageRank,
        trackedAppCount: payload.summary.trackedAppCount,
        needsAttentionCount: payload.summary.needsAttentionCount,
        pendingCount: payload.summary.pendingCount,
        filterApp: payload.filters.app,
        filterCountry: payload.filters.country,
        search: payload.filters.search,
        sortBy: payload.filters.sortBy,
      });
      payload.groups.forEach((entry, index) => {
        rows.push({
          section: "tracked_groups",
          row: index + 1,
          keyword: entry.keyword,
          appTitle: entry.appTitle,
          appId: entry.appId,
          store: entry.store,
          countries: entry.countries.join(" | "),
          rankedRegions: entry.rankedRegions,
          pendingRegions: entry.pendingRegions,
          errorRegions: entry.errorRegions,
          improvement: entry.improvement,
          lastChecked: entry.lastChecked,
        });
      });
      payload.regions.forEach((entry, index) => {
        rows.push({
          section: "tracked_regions",
          row: index + 1,
          keyword: entry.keyword,
          appTitle: entry.appTitle,
          appId: entry.appId,
          store: entry.store,
          country: entry.country,
          lastRank: entry.lastRank,
          lastCheckStatus: entry.lastCheckStatus,
          lastChecked: entry.lastChecked,
          lastError: entry.lastError,
          startRank: entry.startRank,
          currentRank: entry.currentRank,
          improvement: entry.improvement,
          historyPoints: entry.historyPoints,
        });
      });
    }
    if (payload.viewMode === "competitors" && "groups" in payload) {
      rows.push({
        section: "competitor_summary",
        groupCount: payload.summary.groupCount,
        withSnapshots: payload.summary.withSnapshots,
        snapshotCount: payload.summary.snapshotCount,
        trackedKeywordCount: payload.summary.trackedKeywordCount,
        rankedPairCount: payload.summary.rankedPairCount,
      });
      payload.groups.forEach((entry, index) => {
        rows.push({
          section: "competitor_groups",
          row: index + 1,
          groupId: entry.groupId,
          groupName: entry.groupName,
          ownAppTitle: entry.ownAppTitle,
          competitorTitles: entry.competitorTitles.join(" | "),
          trackedKeywordCount: entry.trackedKeywordCount,
          rankedPairCount: entry.rankedPairCount,
          snapshotLoadedAt: entry.snapshotLoadedAt,
          lastKeywordRefreshAt: entry.lastKeywordRefreshAt,
        });
      });
      payload.appRoster.forEach((entry, index) => {
        rows.push({
          section: "competitor_app_roster",
          row: index + 1,
          groupId: entry.groupId,
          groupName: entry.groupName,
          role: entry.role,
          appTitle: entry.title,
          appId: entry.appId,
        });
      });
      payload.keywords.forEach((entry, index) => {
        rows.push({
          section: "competitor_keywords",
          row: index + 1,
          groupId: entry.groupId,
          groupName: entry.groupName,
          keyword: entry.keyword,
          store: entry.store,
          country: entry.country,
          appCount: entry.appCount,
          rankedApps: entry.rankedApps,
          lastCheckedAt: entry.lastCheckedAt,
        });
      });
    }
    if (payload.viewMode === "reports" && "report" in payload) {
      payload.report.summaryItems.forEach((entry, index) => {
        rows.push({
          section: "report_summary",
          row: index + 1,
          label: entry.label,
          value: entry.value,
          hint: entry.hint,
          reportMode: payload.report.reportMode,
          period: payload.report.period,
        });
      });
      payload.report.trendSummaryItems.forEach((entry, index) => {
        rows.push({
          section: "report_trend_summary",
          row: index + 1,
          label: entry.label,
          value: entry.value,
          hint: entry.hint,
        });
      });
      payload.report.trackedOverviewItems.forEach((entry, index) => {
        rows.push({
          section: "report_tracked_overview",
          row: index + 1,
          label: entry.label,
          value: entry.value,
          hint: entry.hint,
        });
      });
      payload.report.movement.movers.forEach((entry, index) => {
        rows.push({
          section: "report_movers",
          row: index + 1,
          keyword: entry.keyword,
          appTitle: entry.appTitle,
          store: entry.store,
          country: entry.country,
          previousRank: entry.previousRank,
          currentRank: entry.currentRank,
          delta: entry.delta,
          historyLabel: entry.historyLabel,
          trendLabel: entry.trendLabel,
        });
      });
      payload.report.movement.gainers.forEach((entry, index) => {
        rows.push({
          section: "report_gainers",
          row: index + 1,
          keyword: entry.keyword,
          appTitle: entry.appTitle,
          store: entry.store,
          country: entry.country,
          previousRank: entry.previousRank,
          currentRank: entry.currentRank,
          delta: entry.delta,
          historyLabel: entry.historyLabel,
          trendLabel: entry.trendLabel,
        });
      });
      payload.report.movement.losers.forEach((entry, index) => {
        rows.push({
          section: "report_losers",
          row: index + 1,
          keyword: entry.keyword,
          appTitle: entry.appTitle,
          store: entry.store,
          country: entry.country,
          previousRank: entry.previousRank,
          currentRank: entry.currentRank,
          delta: entry.delta,
          historyLabel: entry.historyLabel,
          trendLabel: entry.trendLabel,
        });
      });
      payload.report.keywordBattles.forEach((entry, index) => {
        rows.push({
          section: "report_keyword_battles",
          row: index + 1,
          keyword: entry.keyword,
          rankedApps: entry.rankedApps,
          rankedAppsCount: entry.rankedAppsCount,
        });
      });
    }
    return rows;
  };
  const exportDataAsJson = React.useCallback(() => {
    setIsExporting(true);
    try {
      const payload = buildExportPayload();
      downloadTextFile(
        JSON.stringify(payload, null, 2),
        "application/json;charset=utf-8",
        `${getExportFilenameBase()}.json`,
      );
      toast.success("Downloaded analysis data as JSON.");
    } catch (err) {
      logError(err, {
        context: "exportDataAsJson",
        viewMode,
        appId: selectedApp?.appId,
      });
      setError("Failed to export JSON. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [buildExportPayload, getExportFilenameBase, selectedApp?.appId, viewMode]);
  const exportDataAsCsv = React.useCallback(() => {
    setIsExporting(true);
    try {
      const csv = rowsToCsv(buildExportRows());
      downloadTextFile(
        csv,
        "text/csv;charset=utf-8",
        `${getExportFilenameBase()}.csv`,
      );
      toast.success("Downloaded analysis data as CSV.");
    } catch (err) {
      logError(err, {
        context: "exportDataAsCsv",
        viewMode,
        appId: selectedApp?.appId,
      });
      setError("Failed to export CSV. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [buildExportRows, getExportFilenameBase, selectedApp?.appId, viewMode]);
  const handleExportAction = React.useCallback(
    async (format: "pdf" | "csv" | "json") => {
      setIsExportMenuOpen(false);
      if (format === "pdf") {
        await exportToPDF();
        return;
      }
      if (format === "csv") {
        exportDataAsCsv();
        return;
      }
      exportDataAsJson();
    },
    [exportDataAsCsv, exportDataAsJson, exportToPDF],
  );
  useEffect(() => {
    setCompareDiscoveries((prev) => {
      const activeKeys = new Set(
        comparedApps.map((app) => getCompareAppKey(app, storeType)),
      );
      const nextEntries = Object.entries(prev).filter(([key]) =>
        activeKeys.has(key),
      );
      if (nextEntries.length === Object.keys(prev).length) {
        return prev;
      }
      return Object.fromEntries(nextEntries);
    });
  }, [comparedApps, storeType]);
  useEffect(() => {
    setIsExportMenuOpen(false);
    setIsPdfExportOptionsOpen(false);
  }, [selectedApp, viewMode, comparedApps.length]);
  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    setSearchResults([]);
    setHasSearched(false);
    if (viewMode === "competitors") {
      clearCompetitorDraftAnalysis();
    }
    if (viewMode === "single" && selectedApp) {
      handleSelectApp(selectedApp, storeType, newCountry);
    } else if (viewMode === "compare" && comparedApps.length > 0) {
      const fetchCompared = async () => {
        try {
          const newComparedApps = await Promise.all(
            comparedApps.map(async (app) => {
              const id = storeType === "ios" ? app.id : app.appId;
              if (!id) return app;
              const fullDetails = await fetchJson<any>(
                `/api/app?id=${id}&store=${storeType}&country=${newCountry}`,
              );
              return normalizeAppDetails(fullDetails, storeType);
            }),
          );
          setComparedApps(newComparedApps);
          setCompareDiscoveries({});
          setCompareAnalysisError(null);
          setCompareRankings([]);
        } catch (err) {
          logError(err, {
            context: "handleCountryChange",
            newCountry,
            storeType,
          });
          setError(getFriendlyErrorMessage(err));
        }
      };
      fetchCompared();
    }
  };
  const handleStoreTypeChange = (newStore: StoreType) => {
    if (newStore === storeType) return;
    setStoreType(newStore);
    setSelectedApp(null);
    setComparedApps([]);
    setCompareDiscoveries({});
    setCompareAnalysisError(null);
    setSearchResults([]);
    setHasSearched(false);
    setAutoRankings([]);
    setKeywordSuggestions([]);
    setRanking(null);
    setCompareRankings([]);
    resetCompetitorDraft();
  };
  const checkRanking = async (
    e?: React.FormEvent,
    isRefresh: boolean = false,
  ) => {
    if (e) e.preventDefault();
    if (!keyword || !keyword.trim() || !selectedApp) return;
    const id = storeType === "ios" ? selectedApp.id : selectedApp.appId;
    if (!id) return;
    const cacheKey = `ranking-${storeType}-${country}-${id}-${keyword.toLowerCase()}`;
    if (!isRefresh) {
      const cachedData = CacheService.get<{
        keyword: string;
        rank: number;
        demand?: number;
        volume?: number;
        difficulty?: number;
        relevance?: number;
        confidence?: "low" | "medium" | "high";
      }>(cacheKey);
      if (cachedData) {
        setRanking(cachedData);
        return;
      }
    }
    setIsCheckingRank(true);
    try {
      const [data, metrics] = await Promise.all([
        fetchAuthedJson<{ keyword: string; rank: number; depth?: number }>(
          `/api/ranking?keyword=${encodeURIComponent(keyword)}&appId=${String(id)}&store=${storeType}&country=${country}${isRefresh ? "&refresh=true" : ""}`,
        ),
        estimateKeywordMetrics(keyword),
      ]);
      const rankingData = { ...data, ...metrics };
      CacheService.set(cacheKey, rankingData, TTL.RANKING);
      setRanking(rankingData);
      saveRankHistory(
        String(id),
        keyword,
        data.rank,
        storeType,
        country,
        data.depth ?? 100,
      );
      if (isRefresh) {
        setSuccessMessage(`Ranking for "${keyword}" updated!`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      logError(err, {
        context: "checkRanking",
        keyword,
        appId: String(id),
        store: storeType,
        country,
      });
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsCheckingRank(false);
    }
  };
  const removeCompareApp = (appToRemove: AppDetails) => {
    const confirmed = window.confirm(
      `Remove "${appToRemove.title}" from this compare set?`,
    );
    if (!confirmed) {
      return;
    }
    setComparedApps((prev) =>
      prev.filter(
        (app) => !areSameStoreApps(app, appToRemove, storeType),
      ),
    );
    setCompareRankings([]);
    setCompareDiscoveries((prev) => {
      const next = { ...prev };
      delete next[getCompareAppKey(appToRemove, storeType)];
      return next;
    });
  };
  const checkCompareRanking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compareKeyword.trim() || comparedApps.length === 0) return;
    setIsCheckingCompareRank(true);
    try {
      const rankPromises = comparedApps.map(async (app) => {
        const id = getAppStoreId(app, storeType);
        if (!id)
          return {
            appTitle: app.title,
            rank: -1,
          } satisfies CompareRankingResult;
        try {
          const [data, metrics] = await Promise.all([
            fetchAuthedJson<{ keyword: string; rank: number }>(
              `/api/ranking?keyword=${encodeURIComponent(compareKeyword)}&appId=${id}&store=${storeType}&country=${country}`,
            ),
            estimateKeywordMetrics(compareKeyword, app),
          ]);
          return {
            appTitle: app.title,
            rank: data.rank,
            ...metrics,
          } satisfies CompareRankingResult;
        } catch (err) {
          logError(err, {
            context: "checkCompareRanking_fetch",
            keyword: compareKeyword,
            appId: id,
            store: storeType,
            country,
          });
          return {
            appTitle: app.title,
            rank: -1,
          } satisfies CompareRankingResult;
        }
      });
      const results = await Promise.all(rankPromises);
      setCompareRankings(
        results.sort((a, b) => {
          if (a.rank === -1) return 1;
          if (b.rank === -1) return -1;
          return a.rank - b.rank;
        }),
      );
    } catch (err) {
      logError(err, { context: "checkCompareRanking", compareKeyword });
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsCheckingCompareRank(false);
    }
  };
  const trackedKeywordGroupCount = React.useMemo(
    () =>
      new Set(
        trackedKeywords.map((trackedKeyword) =>
          resolveTrackingGroupId(trackedKeyword),
        ),
      ).size,
    [trackedKeywords],
  );
  const processedTrackedKeywordGroups = React.useMemo(() => {
    const grouped = new Map<string, TrackedKeywordGroupView>();
    trackedKeywords.forEach((trackedKeyword, index) => {
      const baseHistory =
        trackedHistoryByKey.get(getTrackedKeywordKey(trackedKeyword)) || [];
      const tHistory = buildTrackedKeywordChartHistory(
        trackedKeyword,
        baseHistory,
      );
      const startRank = tHistory.length > 0 ? tHistory[0].rank : null;
      const currentRank =
        tHistory.length > 0 ? tHistory[tHistory.length - 1].rank : null;
      const improvement =
        startRank !== null && currentRank !== null
          ? startRank - currentRank
          : 0;
      const groupId = resolveTrackingGroupId(trackedKeyword);
      const countryView: TrackedCountryView = {
        trackedKeyword,
        tHistory,
        startRank,
        currentRank,
        improvement,
      };
      const existing = grouped.get(groupId);
      if (!existing) {
        grouped.set(groupId, {
          groupId,
          keyword: trackedKeyword.keyword,
          appId: trackedKeyword.appId,
          appTitle: trackedKeyword.appTitle,
          store: trackedKeyword.store,
          countries: [trackedKeyword.country],
          countryViews: [countryView],
          index,
          lastChecked: trackedKeyword.lastChecked,
          improvement,
        });
        return;
      }
      existing.countries.push(trackedKeyword.country);
      existing.countryViews.push(countryView);
      existing.index = Math.max(existing.index, index);
      if (
        new Date(trackedKeyword.lastChecked).getTime() >
        new Date(existing.lastChecked).getTime()
      ) {
        existing.lastChecked = trackedKeyword.lastChecked;
      }
      existing.improvement += improvement;
    });
    let processed = Array.from(grouped.values()).map((group) => ({
      ...group,
      countries: Array.from(new Set(group.countries)).sort((a, b) =>
        findCountryName(a).localeCompare(findCountryName(b)),
      ),
      countryViews: [...group.countryViews].sort((a, b) =>
        findCountryName(a.trackedKeyword.country).localeCompare(
          findCountryName(b.trackedKeyword.country),
        ),
      ),
    }));
    if (trackFilterCountry !== "all") {
      processed = processed.filter((group) =>
        group.countries.includes(trackFilterCountry),
      );
    }
    if (trackFilterApp !== "all") {
      processed = processed.filter(
        (group) => group.appTitle === trackFilterApp,
      );
    }
    const normalizedTrackSearch = deferredTrackSearchTerm.trim().toLowerCase();
    if (normalizedTrackSearch) {
      processed = processed.filter(
        (group) =>
          group.appTitle.toLowerCase().includes(normalizedTrackSearch) ||
          group.keyword.toLowerCase().includes(normalizedTrackSearch) ||
          group.countries.some(
            (countryCode) =>
              countryCode.toLowerCase().includes(normalizedTrackSearch) ||
              findCountryName(countryCode)
                .toLowerCase()
                .includes(normalizedTrackSearch),
          ),
      );
    }
    processed.sort((a, b) => {
      if (trackSortBy === "date_added") return b.index - a.index;
      if (trackSortBy === "last_checked")
        return (
          new Date(b.lastChecked).getTime() - new Date(a.lastChecked).getTime()
        );
      if (trackSortBy === "app") return a.appTitle.localeCompare(b.appTitle);
      if (trackSortBy === "rank_change") return b.improvement - a.improvement;
      return 0;
    });
    return processed;
  }, [
    trackFilterApp,
    trackFilterCountry,
    deferredTrackSearchTerm,
    trackSortBy,
    trackedHistoryByKey,
    trackedKeywords,
  ]);
  const trackedCountryRowsForReports = React.useMemo(
    () =>
      trackedKeywords.map((trackedKeyword) => ({
        appId: trackedKeyword.appId,
        appTitle: trackedKeyword.appTitle,
        country: trackedKeyword.country,
        groupId: trackedKeyword.groupId,
        history: buildTrackedKeywordChartHistory(
          trackedKeyword,
          trackedHistoryByKey.get(getTrackedKeywordKey(trackedKeyword)) || [],
        ),
        keyword: trackedKeyword.keyword,
        lastChecked: trackedKeyword.lastChecked,
        lastCheckStatus: trackedKeyword.lastCheckStatus,
        store: trackedKeyword.store,
      })),
    [trackedHistoryByKey, trackedKeywords],
  );
  const trackedDashboardStats = React.useMemo(() => {
    const totalRegions = processedTrackedKeywordGroups.reduce(
      (sum, group) => sum + group.countries.length,
      0,
    );
    const rankedCount = processedTrackedKeywordGroups.reduce(
      (sum, group) =>
        sum +
        group.countryViews.filter(
          (countryView) => countryView.trackedKeyword.lastRank !== -1,
        ).length,
      0,
    );
    const needsAttentionCount = processedTrackedKeywordGroups.reduce(
      (sum, group) =>
        sum +
        group.countryViews.filter(
          (countryView) =>
            countryView.trackedKeyword.lastCheckStatus === "error",
        ).length,
      0,
    );
    const pendingCount = processedTrackedKeywordGroups.reduce(
      (sum, group) =>
        sum +
        group.countryViews.filter(
          (countryView) =>
            countryView.trackedKeyword.lastCheckStatus === "pending",
        ).length,
      0,
    );
    return {
      totalGroups: processedTrackedKeywordGroups.length,
      totalRegions,
      rankedCount,
      needsAttentionCount,
      pendingCount,
    };
  }, [processedTrackedKeywordGroups]);
  const trackedOverviewStats = React.useMemo(() => {
    const countryViews = processedTrackedKeywordGroups.flatMap(
      (group) => group.countryViews,
    );
    const rankedViews = countryViews.filter(
      (countryView) => countryView.trackedKeyword.lastRank !== -1,
    );
    const averageRank = rankedViews.length
      ? rankedViews.reduce(
          (sum, countryView) => sum + countryView.trackedKeyword.lastRank,
          0,
        ) / rankedViews.length
      : null;
    const top3Count = rankedViews.filter(
      (countryView) => countryView.trackedKeyword.lastRank <= 3,
    ).length;
    const top10Count = rankedViews.filter(
      (countryView) => countryView.trackedKeyword.lastRank <= 10,
    ).length;
    const range4To10Count = rankedViews.filter((countryView) => {
      const rank = countryView.trackedKeyword.lastRank;
      return rank >= 4 && rank <= 10;
    }).length;
    const range11To50Count = rankedViews.filter((countryView) => {
      const rank = countryView.trackedKeyword.lastRank;
      return rank >= 11 && rank <= 50;
    }).length;

    return {
      averageRank,
      top3Count,
      top10Count,
      range4To10Count,
      range11To50Count,
    };
  }, [processedTrackedKeywordGroups]);
  const competitorGroupStats = React.useMemo(
    () => ({
      groupCount: competitorGroups.length,
      withSnapshots: competitorGroups.filter((group) =>
        competitorLatestSnapshotByGroupId.has(group.groupId),
      ).length,
      snapshotCount: competitorGroupSnapshots.length,
      trackedKeywordCount: competitorTrackedKeywords.length,
    }),
    [
      competitorGroupSnapshots.length,
      competitorGroups,
      competitorLatestSnapshotByGroupId,
      competitorTrackedKeywords.length,
    ],
  );
  const competitorDashboardCards = React.useMemo(() => {
    return competitorGroups
      .map((group) => {
        const snapshot =
          competitorLatestSnapshotByGroupId.get(group.groupId) || null;
        const history =
          competitorSnapshotHistoryByGroupId.get(group.groupId) || [];
        const asoLatestSnapshots =
          competitorAsoLatestSnapshotsByGroupId.get(group.groupId) || [];
        const trackedKeywords =
          competitorTrackedKeywordsByGroupId.get(group.groupId) || [];
        const trackedKeywordGroups =
          processedCompetitorTrackedKeywordGroupsByGroupId.get(group.groupId) ||
          [];
        const rankedPairCount = trackedKeywords.reduce(
          (sum, record) =>
            sum +
            record.apps.filter(
              (app) => app.lastRank !== -1 && app.lastCheckStatus === "ok",
            ).length,
          0,
        );
        const lastKeywordRefreshAt = trackedKeywords.reduce<string | null>(
          (latest, record) => {
            const candidate = record.lastCheckedAt || null;
            if (!candidate) return latest;
            if (!latest) return candidate;
            return new Date(candidate).getTime() > new Date(latest).getTime()
              ? candidate
              : latest;
          },
          null,
        );
        return {
          group,
          snapshot,
          history,
          asoLatestSnapshots,
          trackedKeywords,
          trackedKeywordGroups,
          rankedPairCount,
          lastKeywordRefreshAt,
        };
      })
      .sort((a, b) => {
        const aTime = new Date(
          a.lastKeywordRefreshAt ||
            a.asoLatestSnapshots[0]?.capturedAt ||
            a.snapshot?.loadedAt ||
            a.group.updatedAt ||
            0,
        ).getTime();
        const bTime = new Date(
          b.lastKeywordRefreshAt ||
            b.asoLatestSnapshots[0]?.capturedAt ||
            b.snapshot?.loadedAt ||
            b.group.updatedAt ||
            0,
        ).getTime();
        return bTime - aTime;
      });
  }, [
    competitorGroups,
    competitorAsoLatestSnapshotsByGroupId,
    competitorLatestSnapshotByGroupId,
    competitorSnapshotHistoryByGroupId,
    processedCompetitorTrackedKeywordGroupsByGroupId,
    competitorTrackedKeywordsByGroupId,
  ]);
  const pdfExportCountryOptions = React.useMemo(() => {
    const exportMode: WorkspaceViewMode =
      viewMode === "charts" ? "single" : viewMode;
    const workspaceTrackedCountries = [
      ...trackedKeywords.map((entry) => entry.country),
      ...Array.from(competitorTrackedKeywordsByGroupId.values()).flatMap((records) =>
        records.map((record) => record.country),
      ),
    ];
    let codes: string[] = [];
    if (exportMode === "tracked") {
      codes = processedTrackedKeywordGroups.flatMap((group) => group.countries);
    } else if (exportMode === "competitors") {
      codes = competitorDashboardCards.flatMap((card) =>
        card.trackedKeywords.map((record) => record.country),
      );
    } else if (exportMode === "reports") {
      codes = [
        ...workspaceTrackedCountries,
        ...(reportsExportSnapshot?.historyRows.map((entry) => entry.country) || []),
      ];
    } else {
      codes = workspaceTrackedCountries;
    }
    const uniqueCodes = Array.from(
      new Set(codes.filter(Boolean).map((code) => normalizeCountryCode(code, "us"))),
    ).sort((a, b) =>
      (findCountryName(a) || a).localeCompare(findCountryName(b) || b),
    );
    const normalizedCodes =
      uniqueCodes.length > 0 ? uniqueCodes : [normalizeCountryCode(country, "us")];
    return normalizedCodes.map((code) => ({
      code,
      name: findCountryName(code) || code.toUpperCase(),
    }));
  }, [
    competitorDashboardCards,
    competitorTrackedKeywordsByGroupId,
    country,
    processedTrackedKeywordGroups,
    reportsExportSnapshot,
    trackedKeywords,
    viewMode,
  ]);
  useEffect(() => {
    if (pdfExportCountryScope === PDF_EXPORT_ALL_COUNTRIES_CODE) {
      return;
    }
    const hasSelectedCountry = pdfExportCountryOptions.some(
      (option) => option.code === pdfExportCountryScope,
    );
    if (hasSelectedCountry) {
      return;
    }
    const normalizedCurrentCountry = normalizeCountryCode(country, "us");
    setPdfExportCountryScope(
      pdfExportCountryOptions.find((option) => option.code === normalizedCurrentCountry)
        ?.code ||
        pdfExportCountryOptions[0]?.code ||
        normalizedCurrentCountry,
    );
  }, [country, pdfExportCountryOptions, pdfExportCountryScope]);
  const processedTrackedAppGroups = React.useMemo(() => {
    const appMap = new Map<
      string,
      {
        appKey: string;
        appTitle: string;
        appKind: TrackedAppKind;
        competitorCountries: Set<string>;
        stores: Map<StoreType, TrackedAppStoreGroupView>;
        latestIndex: number;
        lastChecked: string;
        improvement: number;
      }
    >();
    processedTrackedKeywordGroups.forEach((group) => {
      const appKey = group.appTitle.trim().toLowerCase();
      const trackedAppKey = getTrackedAppKeyFromValues(group.appId, group.store);
      const trackedAppMeta = trackedAppsByKey.get(trackedAppKey);
      const appKind = normalizeTrackedAppKind(trackedAppMeta?.kind);
      const analysisSnapshot =
        appAnalysisSnapshotsByKey.get(getAnalysisSnapshotKey(trackedAppKey, country)) ||
        latestAppAnalysisSnapshotByAppKey.get(trackedAppKey) ||
        null;
      const existingApp = appMap.get(appKey);
      if (!existingApp) {
        appMap.set(appKey, {
          appKey,
          appTitle: group.appTitle,
          appKind,
          competitorCountries:
            appKind === "competitor"
              ? new Set(trackedAppMeta?.countries || group.countries)
              : new Set<string>(),
          stores: new Map<StoreType, TrackedAppStoreGroupView>([
            [
              group.store,
              {
                appId: group.appId,
                trackedAppKey,
                appKind,
                appSource: normalizeTrackedAppSource(trackedAppMeta?.source),
                analysisSnapshot,
                store: group.store,
                groups: [group],
                totalRegions: group.countries.length,
                rankedCount: group.countryViews.filter(
                  (countryView) => countryView.trackedKeyword.lastRank !== -1,
                ).length,
                needsAttentionCount: group.countryViews.filter(
                  (countryView) =>
                    countryView.trackedKeyword.lastCheckStatus === "error",
                ).length,
                pendingCount: group.countryViews.filter(
                  (countryView) =>
                    countryView.trackedKeyword.lastCheckStatus === "pending",
                ).length,
                lastChecked: group.lastChecked,
                improvement: group.improvement,
                latestIndex: group.index,
              },
            ],
          ]),
          latestIndex: group.index,
          lastChecked: group.lastChecked,
          improvement: group.improvement,
        });
        return;
      }
      if (existingApp.appKind !== "own" && appKind === "own") {
        existingApp.appKind = "own";
      }
      if (appKind === "competitor") {
        (trackedAppMeta?.countries || group.countries).forEach((countryCode) =>
          existingApp.competitorCountries.add(countryCode),
        );
      }
      existingApp.latestIndex = Math.max(existingApp.latestIndex, group.index);
      existingApp.improvement += group.improvement;
      if (
        new Date(group.lastChecked).getTime() >
        new Date(existingApp.lastChecked).getTime()
      ) {
        existingApp.lastChecked = group.lastChecked;
      }
      const existingStore = existingApp.stores.get(group.store);
      if (!existingStore) {
        existingApp.stores.set(group.store, {
          appId: group.appId,
          trackedAppKey,
          appKind,
          appSource: normalizeTrackedAppSource(trackedAppMeta?.source),
          analysisSnapshot,
          store: group.store,
          groups: [group],
          totalRegions: group.countries.length,
          rankedCount: group.countryViews.filter(
            (countryView) => countryView.trackedKeyword.lastRank !== -1,
          ).length,
          needsAttentionCount: group.countryViews.filter(
            (countryView) =>
              countryView.trackedKeyword.lastCheckStatus === "error",
          ).length,
          pendingCount: group.countryViews.filter(
            (countryView) =>
              countryView.trackedKeyword.lastCheckStatus === "pending",
          ).length,
          lastChecked: group.lastChecked,
          improvement: group.improvement,
          latestIndex: group.index,
        });
        return;
      }
      existingStore.groups.push(group);
      existingStore.analysisSnapshot =
        existingStore.analysisSnapshot ||
        analysisSnapshot ||
        existingStore.analysisSnapshot;
      if (existingStore.appKind !== "own" && appKind === "own") {
        existingStore.appKind = "own";
      }
      existingStore.totalRegions += group.countries.length;
      existingStore.rankedCount += group.countryViews.filter(
        (countryView) => countryView.trackedKeyword.lastRank !== -1,
      ).length;
      existingStore.needsAttentionCount += group.countryViews.filter(
        (countryView) =>
          countryView.trackedKeyword.lastCheckStatus === "error",
      ).length;
      existingStore.pendingCount += group.countryViews.filter(
        (countryView) =>
          countryView.trackedKeyword.lastCheckStatus === "pending",
      ).length;
      existingStore.improvement += group.improvement;
      existingStore.latestIndex = Math.max(existingStore.latestIndex, group.index);
      if (
        new Date(group.lastChecked).getTime() >
        new Date(existingStore.lastChecked).getTime()
      ) {
        existingStore.lastChecked = group.lastChecked;
      }
    });
    return Array.from(appMap.values())
      .map((appGroup): TrackedAppGroupView => {
        const storeGroups = Array.from(appGroup.stores.values()).sort((a, b) =>
          a.store === b.store ? 0 : a.store === "android" ? -1 : 1,
        );
        return {
          appKey: appGroup.appKey,
          appTitle: appGroup.appTitle,
          appKind: appGroup.appKind,
          competitorCountries: Array.from(appGroup.competitorCountries).sort(),
          storeGroups,
          totalKeywordGroups: storeGroups.reduce(
            (sum, storeGroup) => sum + storeGroup.groups.length,
            0,
          ),
          totalRegions: storeGroups.reduce(
            (sum, storeGroup) => sum + storeGroup.totalRegions,
            0,
          ),
          rankedCount: storeGroups.reduce(
            (sum, storeGroup) => sum + storeGroup.rankedCount,
            0,
          ),
          needsAttentionCount: storeGroups.reduce(
            (sum, storeGroup) => sum + storeGroup.needsAttentionCount,
            0,
          ),
          pendingCount: storeGroups.reduce(
            (sum, storeGroup) => sum + storeGroup.pendingCount,
            0,
          ),
          lastChecked: appGroup.lastChecked,
          improvement: appGroup.improvement,
          latestIndex: appGroup.latestIndex,
        };
      })
      .sort((a, b) => {
        if (trackSortBy === "date_added") return b.latestIndex - a.latestIndex;
        if (trackSortBy === "last_checked") {
          return (
            new Date(b.lastChecked).getTime() -
            new Date(a.lastChecked).getTime()
          );
        }
        if (trackSortBy === "app") {
          return a.appTitle.localeCompare(b.appTitle);
        }
        if (trackSortBy === "rank_change") {
          return b.improvement - a.improvement;
        }
        return 0;
      });
  }, [
    appAnalysisSnapshotsByKey,
    country,
    latestAppAnalysisSnapshotByAppKey,
    processedTrackedKeywordGroups,
    trackedAppsByKey,
    trackSortBy,
  ]);
  const trackedViewAppCount = React.useMemo(
    () => getTrackedViewAppCountForOverview(processedTrackedAppGroups),
    [processedTrackedAppGroups],
  );
  const activeAlertGroup = React.useMemo(
    () =>
      activeAlertGroupId
        ? processedTrackedKeywordGroups.find(
            (group) => group.groupId === activeAlertGroupId,
          ) || null
        : null,
    [activeAlertGroupId, processedTrackedKeywordGroups],
  );
  const activeCompetitorAsoAlertGroup = React.useMemo<
    CompetitorAsoAlertGroupView | null
  >(
    () =>
      activeCompetitorAsoAlertGroupId
        ? (() => {
            const group = competitorGroups.find(
              (entry) => entry.groupId === activeCompetitorAsoAlertGroupId,
            );
            if (!group) {
              return null;
            }
            const countries = Array.from(
              new Set([
                group.country,
                ...(competitorTrackedKeywordsByGroupId.get(group.groupId) || []).map(
                  (record) => record.country,
                ),
              ]),
            ).sort((a, b) => a.localeCompare(b));
            return {
              groupId: group.groupId,
              title: getCompetitorGroupLabel(group),
              store: group.store,
              competitorApps: group.competitors,
              countries,
            };
          })()
        : null,
    [
      activeCompetitorAsoAlertGroupId,
      competitorGroups,
      competitorTrackedKeywordsByGroupId,
    ],
  );
  const activeKeywordAlertTarget = React.useMemo(
    () =>
      activeAlertGroup
        ? ({ mode: "keyword" as const, group: activeAlertGroup })
        : null,
    [activeAlertGroup],
  );
  const activeCompetitorKeywordAlertTarget = React.useMemo(() => {
    if (!activeCompetitorKeywordAlertGroupKey) {
      return null;
    }
    for (const keywordGroups of processedCompetitorTrackedKeywordGroupsByGroupId.values()) {
      const keywordGroup = keywordGroups.find(
        (entry) => entry.groupKey === activeCompetitorKeywordAlertGroupKey,
      );
      if (!keywordGroup) {
        continue;
      }
      const parentGroup = competitorGroups.find(
        (entry) => entry.groupId === keywordGroup.groupId,
      );
      if (!parentGroup) {
        return null;
      }
      return {
        mode: "keyword" as const,
        group: {
          groupId: keywordGroup.groupId,
          keyword: keywordGroup.keyword,
          appId: parentGroup.ownApp.appId,
          appTitle: parentGroup.ownApp.title,
          store: keywordGroup.store,
          countries: keywordGroup.countries,
          countryViews: [],
          index: 0,
          lastChecked: keywordGroup.lastCheckedAt || "",
          improvement: 0,
          targetAppIds: Array.from(
            new Set([
              parentGroup.ownApp.appId,
              ...parentGroup.competitors.map((app) => app.appId),
            ]),
          ),
        },
      };
    }
    return null;
  }, [
    activeCompetitorKeywordAlertGroupKey,
    competitorGroups,
    processedCompetitorTrackedKeywordGroupsByGroupId,
  ]);
  const activeCompetitorAsoAlertTarget = React.useMemo(
    () =>
      activeCompetitorAsoAlertGroup
        ? ({
            mode: "competitor_aso" as const,
            group: activeCompetitorAsoAlertGroup,
          })
        : null,
    [activeCompetitorAsoAlertGroup],
  );
  const ownTrackedAppCount = React.useMemo(
    () => trackedAppUsageCount,
    [trackedAppUsageCount],
  );
  const focusAppSearch = React.useCallback(() => {
    window.requestAnimationFrame(() => {
      const input = document.getElementById("app-search");
      if (!(input instanceof HTMLInputElement)) return;
      input.scrollIntoView({
        behavior: window.matchMedia("(max-width: 1100px)").matches
          ? "auto"
          : "smooth",
        block: "center",
      });
      input.focus();
    });
  }, []);
  const dismissOnboarding = React.useCallback(() => {
    setIsOnboardingDismissed(true);
    if (isPreferenceStorageAllowed()) {
      safeStorage.setItem(onboardingDismissStorageKey, "1");
    }
  }, [onboardingDismissStorageKey]);
  const reopenOnboarding = React.useCallback(() => {
    setIsOnboardingDismissed(false);
    safeStorage.removeItem(onboardingDismissStorageKey);
  }, [onboardingDismissStorageKey]);
  const onboardingSteps = React.useMemo(
    () => [
      {
        id: "first-app",
        title: "Analyze your first app",
        description:
          "Search for your app and open the main analysis view to start the workflow.",
        isComplete:
          Boolean(selectedApp) ||
          ownTrackedAppCount > 0 ||
          appAnalysisSnapshots.length > 0,
        actionLabel: "Open Analyze",
        action: () => {
          setViewMode("single");
          focusAppSearch();
        },
      },
      {
        id: "first-keyword",
        title: "Track your first keyword",
        description:
          "Check a ranking, then click Track Keyword so daily monitoring begins.",
        isComplete: trackedKeywords.length > 0,
        actionLabel: "Go to Tracking Setup",
        action: () => {
          setViewMode("single");
          focusAppSearch();
        },
      },
      {
        id: "first-competitor-group",
        title: "Create a competitor group",
        description:
          "Add your app with rival apps, analyze the group, then save its tracked keywords.",
        isComplete: competitorGroups.length > 0,
        actionLabel: "Open Competitors",
        action: () => {
          setViewMode("competitors");
          focusAppSearch();
        },
      },
      {
        id: "first-alert",
        title: "Create your first alert",
        description:
          "Open a tracked keyword group and add an alert rule for important rank changes.",
        isComplete: alertRules.length > 0,
        actionLabel: "Open Alerts",
        action: () => {
          setViewMode("tracked");
          const firstGroupId = processedTrackedKeywordGroups[0]?.groupId;
          if (firstGroupId) {
            setActiveAlertGroupId(firstGroupId);
          }
        },
      },
    ],
    [
      alertRules.length,
      appAnalysisSnapshots.length,
      competitorGroups.length,
      focusAppSearch,
      ownTrackedAppCount,
      processedTrackedKeywordGroups,
      selectedApp,
      trackedKeywords.length,
    ],
  );
  const completedOnboardingStepCount = React.useMemo(
    () => onboardingSteps.filter((step) => step.isComplete).length,
    [onboardingSteps],
  );
  const onboardingVisible =
    userStateHydrated &&
    hasAcceptedLegal &&
    completedOnboardingStepCount < onboardingSteps.length &&
    !isOnboardingDismissed;
  const selectedChartCategory = React.useMemo(
    () =>
      chartCategories.find((category) => category.code === selectedChartCategoryCode) ||
      null,
    [chartCategories, selectedChartCategoryCode],
  );
  const selectedAppChartId = React.useMemo(
    () =>
      selectedApp ? String(getAppStoreId(selectedApp, storeType) || "") : null,
    [selectedApp, storeType],
  );
  const selectedAppChartEntry = React.useMemo(
    () =>
      selectedAppChartId
        ? chartEntries.find((entry) => String(entry.appId) === selectedAppChartId) ||
          null
        : null,
    [chartEntries, selectedAppChartId],
  );
  const comparedChartAppIds = React.useMemo(
    () =>
      new Set(
        comparedApps.map((app) => String(getAppStoreId(app, storeType) || "")),
      ),
    [comparedApps, storeType],
  );
  const visibleTrackedGroupIds = React.useMemo(
    () =>
      processedTrackedAppGroups.flatMap((appGroup) => {
        const selectedStore =
          (trackedSelectedStoreByApp[appGroup.appKey] &&
          appGroup.storeGroups.some(
            (storeGroup) =>
              storeGroup.store === trackedSelectedStoreByApp[appGroup.appKey],
          )
            ? trackedSelectedStoreByApp[appGroup.appKey]
            : undefined) ||
          (appGroup.storeGroups.some(
            (storeGroup) => storeGroup.store === storeType,
          )
            ? storeType
            : undefined) ||
          appGroup.storeGroups[0]?.store;
        return (
          appGroup.storeGroups.find(
            (storeGroup) => storeGroup.store === selectedStore,
          )?.groups.map((group) => group.groupId) || []
        );
      }),
    [processedTrackedAppGroups, storeType, trackedSelectedStoreByApp],
  );
  const selectedAppBookmarkKey = React.useMemo(
    () =>
      selectedApp
        ? getBookmarkKey({
            appId: selectedApp.appId,
            id: selectedApp.id,
            store: storeType,
          })
        : null,
    [selectedApp, storeType],
  );
  const selectedAppTrackedId = React.useMemo(
    () => (selectedApp ? getAppStoreId(selectedApp, storeType) : null),
    [selectedApp, storeType],
  );
  const isSelectedAppBookmarked = selectedAppBookmarkKey
    ? bookmarkedAppKeys.has(selectedAppBookmarkKey)
    : false;
  const selectedWorkspaceAppKey = React.useMemo(
    () =>
      selectedApp
        ? getTrackedAppKeyFromValues(
            String(getAppStoreId(selectedApp, storeType) || selectedApp.appId || ""),
            storeType,
          )
        : null,
    [selectedApp, storeType],
  );
  const selectedAppAnalysisSnapshot = React.useMemo(
    () =>
      selectedWorkspaceAppKey
        ? appAnalysisSnapshotsByKey.get(
            getAnalysisSnapshotKey(selectedWorkspaceAppKey, country),
          ) ||
          latestAppAnalysisSnapshotByAppKey.get(selectedWorkspaceAppKey) ||
          null
        : null,
    [
      appAnalysisSnapshotsByKey,
      country,
      latestAppAnalysisSnapshotByAppKey,
      selectedWorkspaceAppKey,
    ],
  );
  const bookmarksByStore = React.useMemo(
    () => ({
      android: bookmarks.filter((bookmark) => bookmark.store === "android").length,
      ios: bookmarks.filter((bookmark) => bookmark.store === "ios").length,
      countries: new Set(bookmarks.map((bookmark) => bookmark.country)).size,
    }),
    [bookmarks],
  );
  const compareAverageRank = React.useMemo(() => {
    const avgRanks = compareAppInsights
      .map((insight) => insight.averageRank)
      .filter((value): value is number => value !== null);
    if (avgRanks.length === 0) return null;
    return avgRanks.reduce((sum, value) => sum + value, 0) / avgRanks.length;
  }, [compareAppInsights]);
  const competitorRankedPairs = React.useMemo(
    () =>
      competitorDashboardCards.reduce(
        (sum, card) => sum + card.rankedPairCount,
        0,
      ),
    [competitorDashboardCards],
  );
  const workspacePageConfigs = React.useMemo<WorkspacePageConfig[]>(
    () => [
      {
        id: "single",
        label: "Analyze",
        shortLabel: "Analyze",
        icon: Search,
        eyebrow: "Keyword Research",
        title: selectedApp ? selectedApp.title : "Analyze Apps",
        description: selectedApp
          ? `Context: ${selectedApp.developer} · ${findCountryName(country) || country}.`
          : "Search an app and inspect its current keyword footprint.",
      },
      {
        id: "compare",
        label: "Compare",
        shortLabel: "Compare",
        icon: Layers,
        eyebrow: "Competitive Set",
        title: "Compare Apps",
        description: "Compare keyword coverage and contested opportunities.",
        badge: comparedApps.length > 0 ? comparedApps.length : undefined,
      },
      {
        id: "reports",
        label: "Reports",
        shortLabel: "Reports",
        icon: BarChart3,
        eyebrow: "Movement Analysis",
        title: "Reports",
        description: "Review movers, losers, and competitor movement by period.",
      },
      {
        id: "bookmarks",
        label: "Bookmarks",
        shortLabel: "Saved",
        icon: Bookmark,
        eyebrow: "Quick Access",
        title: "Bookmarked Apps",
        description: "Keep priority apps one click away for quick re-entry.",
        badge: bookmarks.length > 0 ? bookmarks.length : undefined,
      },
      {
        id: "competitors",
        label: "Competitors",
        shortLabel: "Rivals",
        icon: Globe,
        eyebrow: "Battle Groups",
        title: "Competitor Groups",
        description: "Discover a rival, compare keyword coverage, and track changes in one place.",
        badge:
          competitorGroupStats.groupCount > 0
            ? competitorGroupStats.groupCount
            : undefined,
      },
      {
        id: "tracked",
        label: "Tracked",
        shortLabel: "Tracked",
        icon: Bell,
        eyebrow: "Daily Monitoring",
        title: "Tracked Keywords",
        description: "Monitor rank movement, region coverage, and refresh health.",
        badge:
          trackedAppUsageCount > 0 ? trackedAppUsageCount : undefined,
      },
    ],
    [
      bookmarks.length,
      comparedApps.length,
      competitorGroupStats.groupCount,
      country,
      selectedApp,
      trackedAppUsageCount,
    ],
  );
  const mobileWorkspacePageConfigs = React.useMemo(
    () => {
      const pageConfigById = new Map(
        workspacePageConfigs.map((page) => [page.id, page]),
      );

      return ["single", "compare", "reports", "bookmarks", "tracked"]
        .map((pageId) => {
          const page = pageConfigById.get(pageId as WorkspaceViewMode);
          if (!page) return null;
          return page;
        })
        .filter((page): page is WorkspacePageConfig => Boolean(page));
    },
    [workspacePageConfigs],
  );
  const visibleWorkspaceMode: WorkspaceViewMode =
    viewMode === "charts" ? "single" : viewMode;
  const activeWorkspacePage =
    workspacePageConfigs.find((page) => page.id === visibleWorkspaceMode) ||
    workspacePageConfigs[0];
  const isAnalyzeLandingSummary =
    visibleWorkspaceMode === "single" && !selectedApp;
  const isDenseWorkspaceLandingSummary =
    (visibleWorkspaceMode === "single" && !selectedApp) ||
    visibleWorkspaceMode === "compare" ||
    visibleWorkspaceMode === "bookmarks" ||
    visibleWorkspaceMode === "competitors" ||
    visibleWorkspaceMode === "tracked";
  const compactWorkspaceLandingCopy = React.useMemo<
    Partial<
      Record<
        WorkspaceViewMode,
        {
          title: string;
          description: string;
        }
      >
    >
  >(
    () => ({
      single: {
        title: "Analyze",
        description: "Search an app for keywords.",
      },
      compare: {
        title: "Compare",
        description: "Compare apps for keywords.",
      },
      bookmarks: {
        title: "Bookmarks",
        description: "Keep apps ready to reopen.",
      },
      competitors: {
        title: "Competitors",
        description: "Track rival groups and terms.",
      },
      tracked: {
        title: "Tracked",
        description: "Monitor rank movement and health.",
      },
    }),
    [],
  );
  const activeWorkspaceLandingCopy =
    compactWorkspaceLandingCopy[visibleWorkspaceMode];
  const isMobileTrackWorkspace =
    isMobileViewport &&
    (visibleWorkspaceMode === "tracked" ||
      visibleWorkspaceMode === "competitors");

  const scrollPositions = React.useRef<Record<string, number>>({});
  const prevModeRef = React.useRef<WorkspaceViewMode>(visibleWorkspaceMode);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const previousMode = prevModeRef.current;
    if (previousMode === visibleWorkspaceMode) return;

    if (
      previousMode === "tracked" ||
      previousMode === "competitors"
    ) {
      scrollPositions.current[previousMode] = window.scrollY;
    }

    if (isMobileTrackWorkspace) {
      const savedScroll = scrollPositions.current[visibleWorkspaceMode] || 0;
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: savedScroll, left: 0, behavior: "auto" });
      });
    }

    prevModeRef.current = visibleWorkspaceMode;
  }, [isMobileTrackWorkspace, visibleWorkspaceMode]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const mediaQuery = window.matchMedia("(max-width: 1100px)");
    const syncViewport = (matches: boolean) => {
      setIsMobileViewport(matches);
    };
    const handleChange = (event: MediaQueryListEvent) => {
      syncViewport(event.matches);
    };

    syncViewport(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  const getTrackedStatusPills = React.useCallback(
    (pendingCount: number, errorCount: number) => {
      const pills: Array<{
        key: "pending" | "error";
        label: string;
        className: string;
      }> = [];

      if (pendingCount > 0) {
        pills.push({
          key: "pending",
          label: `${pendingCount} pending`,
          className:
            "rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-amber-300",
        });
      }

      if (errorCount > 0) {
        pills.push({
          key: "error",
          label: `${errorCount} errors`,
          className:
            "rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-rose-300",
        });
      }

      return pills;
    },
    [],
  );

  const workspaceSummaryCards = React.useMemo<
    Array<{
      label: string;
      value: React.ReactNode;
      hint?: React.ReactNode;
      trend?: React.ReactNode;
      accent: "cyan" | "emerald" | "amber" | "violet" | "slate";
    }>
  >(() => {
    if (visibleWorkspaceMode === "reports") {
      return [];
    }
    if (visibleWorkspaceMode === "single" && !selectedApp) {
      return [];
    }
    if (visibleWorkspaceMode === "compare" && compareAnalyzedCount === 0) {
      return [];
    }
    if (visibleWorkspaceMode === "tracked") {
      const trackedStatusPills = getTrackedStatusPills(
        trackedDashboardStats.pendingCount,
        trackedDashboardStats.needsAttentionCount,
      );

      return [
        {
          label: "Regions Ranked",
          value: trackedDashboardStats.rankedCount,
          hint: `${trackedDashboardStats.totalGroups} group${trackedDashboardStats.totalGroups === 1 ? "" : "s"} in view`,
          accent: "cyan" as const,
        },
        {
          label: "Regions Monitored",
          value: trackedDashboardStats.totalRegions,
          hint: `${trackedViewAppCount} tracked app${trackedViewAppCount === 1 ? "" : "s"}`,
          accent: "cyan" as const,
        },
        {
          label: "Average Rank",
          value: trackedOverviewStats.averageRank
            ? trackedOverviewStats.averageRank.toFixed(1)
            : "-",
          hint: "Across ranked regions",
          accent: "violet" as const,
        },
        {
          label: "Needs Attention",
          value:
            trackedDashboardStats.pendingCount +
            trackedDashboardStats.needsAttentionCount,
          hint: "Statuses needing follow-up",
          trend:
            trackedStatusPills.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {trackedStatusPills.map((pill) => (
                  <span
                    key={pill.key}
                    className={cn("text-[10px] font-semibold sm:text-xs", pill.className)}
                  >
                    {pill.label}
                  </span>
                ))}
              </div>
            ) : undefined,
          accent: "amber" as const,
        },
      ];
    }
    if (visibleWorkspaceMode === "compare") {
      return [
        {
          label: "Apps In Set",
          value: comparedApps.length,
          hint: "Current set",
          accent: "cyan" as const,
        },
        {
          label: "Analyzed",
          value: `${compareAnalyzedCount}/${comparedApps.length || 0}`,
          hint: "Coverage loaded",
          accent: "cyan" as const,
        },
        {
          label: "Contested Keywords",
          value: compareSharedBattles.length,
          hint: "Direct overlaps",
          accent: "violet" as const,
        },
        {
          label: "Avg Rank",
          value: compareAverageRank ? compareAverageRank.toFixed(1) : "-",
          hint: compareAverageRank ? "Across analyzed apps" : "Awaiting analysis",
          accent: "amber" as const,
        },
      ];
    }
    if (visibleWorkspaceMode === "competitors") {
      return [
        {
          label: "Saved Groups",
          value: competitorGroupStats.groupCount,
          hint: isMobileViewport
            ? `${competitorGroupStats.withSnapshots} snap`
            : `${competitorGroupStats.withSnapshots} with snapshots`,
          accent: "cyan" as const,
        },
        {
          label: "Snapshots",
          value: competitorGroupStats.snapshotCount,
          hint: isMobileViewport ? "Saved runs" : "Saved analyses",
          accent: "violet" as const,
        },
        {
          label: "Tracked Terms",
          value: competitorGroupStats.trackedKeywordCount,
          hint: isMobileViewport ? "In groups" : "Terms in groups",
          accent: "cyan" as const,
        },
        {
          label: "Ranked Pairs",
          value: competitorRankedPairs,
          hint: isMobileViewport ? "Live now" : "Pairs ranking now",
          accent: "amber" as const,
        },
      ];
    }
    if (visibleWorkspaceMode === "bookmarks") {
      return [
        {
          label: "Saved Apps",
          value: bookmarks.length,
          hint: "Quick entry points",
          accent: "cyan" as const,
        },
        {
          label: "Play Store",
          value: bookmarksByStore.android,
          hint: "Android saved",
          accent: "cyan" as const,
        },
        {
          label: "App Store",
          value: bookmarksByStore.ios,
          hint: "iOS saved",
          accent: "violet" as const,
        },
        {
          label: "Markets",
          value: bookmarksByStore.countries,
          hint: "Countries saved",
          accent: "slate" as const,
        },
      ];
    }
    return [
      {
        label: "Discovered Rankings",
        value: autoRankings.length,
        hint: selectedAppAnalysisSnapshot
          ? `${selectedAppAnalysisSnapshot.top10} in top 10`
          : "Auto results",
        accent: "cyan" as const,
      },
      {
        label: "Average Rank",
        value: selectedAppAnalysisSnapshot?.averageRank
          ? selectedAppAnalysisSnapshot.averageRank.toFixed(1)
          : "-",
        hint: selectedAppAnalysisSnapshot
          ? `${selectedAppAnalysisSnapshot.top100} ranked keywords`
          : "Run scan",
        accent: "cyan" as const,
      },
      {
        label: "Chart Position",
        value: selectedAppChartEntry ? `#${selectedAppChartEntry.position}` : "-",
        hint: selectedChartCategory?.label || "Chart",
        accent: "amber" as const,
      },
    ];
  }, [
    autoRankings.length,
    bookmarks.length,
    bookmarksByStore.android,
    bookmarksByStore.countries,
    bookmarksByStore.ios,
    comparedApps.length,
    compareAnalyzedCount,
    compareAverageRank,
    compareSharedBattles.length,
    competitorGroupStats.groupCount,
    competitorGroupStats.snapshotCount,
    competitorGroupStats.trackedKeywordCount,
    competitorGroupStats.withSnapshots,
    competitorRankedPairs,
    isMobileViewport,
    selectedAppAnalysisSnapshot,
    selectedAppChartEntry,
    selectedChartCategory?.label,
    trackedDashboardStats.needsAttentionCount,
    trackedDashboardStats.pendingCount,
    trackedDashboardStats.rankedCount,
    trackedDashboardStats.totalRegions,
    trackedKeywordGroupCount,
    trackedOverviewStats.averageRank,
    trackedViewAppCount,
    getTrackedStatusPills,
    visibleWorkspaceMode,
  ]);
  const isLightTheme = themeMode === "light";
  const discoveryCardBaseClass =
    "px-3 py-3 sm:px-4 sm:py-2.5 rounded-xl text-sm flex flex-col gap-2 transition-all hover:shadow-lg hover:-translate-y-0.5";
  const rankedKeywordCardClass = isLightTheme
    ? `${discoveryCardBaseClass} border border-sky-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(238,247,253,0.84))] text-slate-800 hover:border-sky-400/70 hover:shadow-sky-200/60`
    : `${discoveryCardBaseClass} bg-cyan-950/40 border border-cyan-500/20 text-cyan-300 hover:shadow-cyan-500/10 hover:border-cyan-500/40`;
  const getDiscoveryTrackButtonClass = (isTracked: boolean) =>
    isLightTheme
      ? `inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border bg-white/95 px-2.5 py-2 shadow-sm transition-all hover:scale-105 ${
          isTracked
            ? "border-amber-300/80 hover:bg-amber-50 text-amber-600"
            : "border-emerald-300/80 hover:bg-emerald-50 text-emerald-600"
        }`
      : `inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border bg-app-surface-muted/90 px-2.5 py-2 shadow-sm transition-all hover:scale-105 ${
          isTracked
            ? "border-amber-500/50 hover:bg-amber-500/20 text-amber-400"
            : "border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400"
        }`;
  const renderDiscoveryKeywordCard = (
    keywordItem: RankedKeyword,
    index: number,
  ) => {
    const trackedKey = getTrackedKeywordGroupKey({
      keyword: keywordItem.keyword,
      appId: selectedAppTrackedId || "",
      store: storeType,
    });
    const isTracked = trackedKeywordGroupKeys.has(trackedKey);
    const rank = keywordItem.rank;
    const estimatedDemand = getEstimatedDemand(keywordItem);
    const metricItems = [
      { label: "Vol", value: estimatedDemand },
      { label: "Diff", value: keywordItem.difficulty },
      { label: "Rel", value: keywordItem.relevance },
    ].filter(
      (item): item is { label: string; value: number } =>
        typeof item.value === "number",
    );

    return (
      <div
        key={`ranked-${keywordItem.keyword}-${index}`}
        className={cn(rankedKeywordCardClass, "workspace-discovery-card")}
      >
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            {selectedApp?.icon ? (
              <img
                src={selectedApp.icon}
                alt=""
                className={`mt-0.5 h-5 w-5 shrink-0 rounded-md shadow-sm ${
                  isLightTheme
                    ? "border border-sky-200/80"
                    : "border border-cyan-500/30"
                }`}
                referrerPolicy="no-referrer"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-start gap-1.5">
                <span className="workspace-discovery-keyword min-w-0 flex-1 text-sm font-semibold leading-tight">
                  {keywordItem.keyword}
                </span>
                <span
                  className={
                    isLightTheme
                      ? "shrink-0 rounded-md border border-emerald-200/80 bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700 sm:text-xs"
                      : "shrink-0 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-300 sm:text-xs"
                  }
                >
                  #{rank}
                </span>
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-app-text-muted">
                Verified ranking
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              selectedApp &&
              openTrackCountryPicker(
                keywordItem.keyword,
                selectedApp,
                storeType,
                country,
                rank,
                true,
                "own",
                "discovery",
              )
            }
            className={getDiscoveryTrackButtonClass(isTracked)}
            title={isTracked ? "Track more countries" : "Track keyword"}
            aria-label={isTracked ? "Track more countries" : "Track keyword"}
          >
            {isTracked ? (
              <BellRing className="h-3.5 w-3.5" />
            ) : (
              <Bell className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        {metricItems.length > 0 ? (
          <div className="workspace-discovery-metrics" aria-label="Keyword metrics">
            {metricItems.map((metric) => (
              <span
                key={metric.label}
                className="workspace-discovery-metric"
                title={
                  metric.label === "Vol"
                    ? "Estimated Volume"
                    : metric.label === "Diff"
                      ? "Estimated Ranking Difficulty"
                      : "Estimated App Relevance"
                }
              >
                <span className="workspace-discovery-metric-label">{metric.label}</span>
                <strong className="workspace-discovery-metric-value">{metric.value}</strong>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  };
  const rankingPanelStyle = {
    background: "var(--color-surface)",
    borderColor: "var(--color-border)",
    boxShadow: "var(--shadow-card)",
  };
  const chartSurfaceStyle = {
    background: "var(--color-surface-muted)",
    border: "1px solid var(--color-border)",
    boxShadow: "var(--shadow-card)",
  };
  const chartTooltipStyle = {
    backgroundColor: "var(--color-chart-tooltip-bg)",
    borderRadius: "12px",
    border: "1px solid var(--color-chart-tooltip-border)",
    color: "var(--color-chart-tooltip-text)",
    boxShadow: "var(--shadow-card)",
  };
  const chartGridStroke = "var(--color-chart-grid)";
  const chartAxisTickColor = "var(--color-chart-axis)";
  const chartAxisLabelColor = "var(--color-chart-axis)";
  const chartLegendTextColor = "var(--color-text-secondary)";
  if (!isDemoMode && !hasLoadedBillingStatus) {
    return (
      <ErrorBoundary>
        <div
          className="min-h-screen text-app-text font-sans relative flex items-center justify-center"
          style={{ background: "var(--bg-primary)" }}
        >
          <div className="bg-orb bg-orb-1" />
          <div className="bg-orb bg-orb-2" />
          <div className="bg-orb bg-orb-3" />
          <div className="card-glow relative z-10 px-8 py-10 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-300 mx-auto mb-4" />
            <p className="text-sm uppercase tracking-[0.18em] text-app-text-muted">
              Checking billing access
            </p>
          </div>
        </div>
      </ErrorBoundary>
    );
  }
  if (!userStateHydrated && hasActiveBillingAccess) {
    return (
      <ErrorBoundary>
        <div
          className="min-h-screen text-app-text font-sans relative flex items-center justify-center"
          style={{ background: "var(--bg-primary)" }}
        >
          <div className="bg-orb bg-orb-1" />
          <div className="bg-orb bg-orb-2" />
          <div className="bg-orb bg-orb-3" />
          <div className="card-glow relative z-10 px-8 py-10 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-300 mx-auto mb-4" />
            <p className="text-sm uppercase tracking-[0.18em] text-app-text-muted">
              Loading account data
            </p>
          </div>
        </div>
      </ErrorBoundary>
    );
  }
  if (hasBillingStatusLoadFailure) {
    return (
      <ErrorBoundary>
        <div
          className="min-h-screen text-app-text font-sans relative flex items-center justify-center"
          style={{ background: "var(--bg-primary)" }}
        >
          <div className="bg-orb bg-orb-1" />
          <div className="bg-orb bg-orb-2" />
          <div className="bg-orb bg-orb-3" />
          <div className="card-glow relative z-10 max-w-md px-8 py-10 text-center">
            <AlertCircle className="mx-auto mb-4 h-8 w-8 text-amber-300" />
            <p className="text-sm uppercase tracking-[0.18em] text-app-text-muted">
              Billing status unavailable
            </p>
            <p className="mt-4 text-sm leading-6 text-app-text-muted">
              {billingError ||
                "We couldn't verify billing access right now. Retry before showing the upgrade gate."}
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => void loadBillingStatus()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/20"
              >
                <RefreshCw className="h-4 w-4" />
                Retry billing check
              </button>
              <button
                type="button"
                onClick={() => void onSignOut()}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-app-border bg-app-surface-muted/70 px-4 py-2 text-sm font-semibold text-app-text transition-colors hover:bg-app-surface-strong"
              >
                <LogOut className="h-4 w-4" />
                Use different account
              </button>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }
  if (!hasAcceptedLegal) {
    if (legalGateView === "privacy") {
      return (
        <PrivacyPolicyPage
          onBack={() => setLegalGateView("consent")}
          themeMode={themeMode}
          onToggleTheme={onToggleTheme}
        />
      );
    }
    if (legalGateView === "terms") {
      return (
        <TermsPage
          onBack={() => setLegalGateView("consent")}
          themeMode={themeMode}
          onToggleTheme={onToggleTheme}
        />
      );
    }
    return (
      <div className="auth-shell">
        {" "}
        <div className="auth-orb auth-orb-cyan" />{" "}
        <div className="auth-orb auth-orb-indigo" />{" "}
        <div className="auth-orb auth-orb-cyan" />{" "}
        <div className="auth-panel">
          <div className="mb-4 flex justify-end">
            <ThemeToggle themeMode={themeMode} onToggle={onToggleTheme} />
          </div>
          {" "}
          <div className="inline-flex items-center gap-2 badge badge-cyan mb-4">
            {" "}
            <ShieldCheck className="w-3.5 h-3.5" /> First login{" "}
          </div>{" "}
          <h1 className="font-display text-3xl font-bold text-app-text tracking-tight">
            Accept the legal terms
          </h1>{" "}
          <p className="text-app-text-muted mt-3 text-sm leading-6">
            {" "}
            Before entering the app for the first time, review and accept the
            Privacy Policy and Terms &amp; Conditions.{" "}
          </p>{" "}
          <div className="space-y-3 mt-6">
            {" "}
            <button
              type="button"
              onClick={() => setLegalGateView("privacy")}
              className="btn-ghost w-full justify-start px-4 py-3 rounded-2xl"
            >
              {" "}
              Privacy Policy{" "}
            </button>{" "}
            <button
              type="button"
              onClick={() => setLegalGateView("terms")}
              className="btn-ghost w-full justify-start px-4 py-3 rounded-2xl"
            >
              {" "}
              Terms &amp; Conditions{" "}
            </button>{" "}
          </div>{" "}
          <label
            className="flex items-start gap-3 rounded-2xl px-4 py-3 text-sm mt-6"
            style={{
              background: isLightTheme
                ? "rgba(255,255,255,0.9)"
                : "rgba(15,23,42,0.65)",
              border: isLightTheme
                ? "1px solid rgba(148,163,184,0.32)"
                : "1px solid rgba(51,65,85,0.45)",
              boxShadow: isLightTheme
                ? "0 12px 30px rgba(148,163,184,0.12), inset 0 1px 0 rgba(255,255,255,0.6)"
                : undefined,
            }}
          >
            {" "}
            <input
              type="checkbox"
              checked={consentChecked}
              onChange={(event) => setConsentChecked(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-app-border bg-app-surface-muted text-cyan-400 focus:ring-cyan-500"
            />{" "}
            <span className="text-app-text-muted leading-6">
              {" "}
              I have read and agree to the Terms &amp; Conditions and Privacy
              Policy.{" "}
            </span>{" "}
          </label>{" "}
          <button
            type="button"
            onClick={persistLegalAcceptance}
            disabled={!consentChecked || isSavingLegalConsent}
            className="btn-primary w-full mt-6"
          >
            {" "}
            {isSavingLegalConsent ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : null}{" "}
            Continue to app{" "}
          </button>{" "}
        </div>{" "}
      </div>
    );
  }

  const renderSearchSection = (isCompact = false) => (
    <WorkspacePanel className={`workspace-search-panel workspace-toolbar-panel ${isCompact ? (isMobileViewport ? "mb-4 p-2.5" : "mb-6 p-3") : isMobileViewport ? "mb-5" : "mb-8"}`} tone={isCompact ? "muted" : "strong"}>
      {isCompact && visibleWorkspaceMode === "single" && selectedApp ? (
        <div className="workspace-selected-app-controls flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src={selectedApp.icon}
              alt=""
              className="h-9 w-9 shrink-0 rounded-xl border border-app-border/60 object-cover"
            />
            <div className="min-w-0">
              <p className="workspace-chip-label">Selected app</p>
              <p className="truncate text-sm font-semibold text-app-text">
                {selectedApp.title}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="workspace-store-toggle shrink-0">
              <button
                type="button"
                onClick={() => handleStoreTypeChange("android")}
                aria-label="Use Google Play"
                className={cn(
                  "workspace-store-button",
                  storeType === "android" && "workspace-store-button-active",
                )}
              >
                <Play
                  className="h-3.5 w-3.5"
                  fill={storeType === "android" ? "currentColor" : "none"}
                />
                Play
              </button>
              <button
                type="button"
                onClick={() => handleStoreTypeChange("ios")}
                aria-label="Use App Store"
                className={cn(
                  "workspace-store-button",
                  storeType === "ios" && "workspace-store-button-active",
                )}
              >
                <Apple className="h-3.5 w-3.5" />
                iOS
              </button>
            </div>
            <div className="workspace-topbar-country workspace-utility-chip shrink-0">
              <Globe className="hidden h-3.5 w-3.5 text-app-text-muted sm:block" />
              <CountrySearchSelect
                value={country}
                onChange={handleCountryChange}
                options={COUNTRIES}
                ariaLabel="Change analysis country"
                className="w-[112px] min-w-0 sm:w-[150px] sm:min-w-[150px]"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedApp(null);
                setRanking(null);
                setAutoRankings([]);
                setKeywordSuggestions([]);
                setSearchResults([]);
                setSearchTerm("");
                setHasSearched(false);
              }}
              className="workspace-btn-secondary min-h-11 rounded-xl px-3 py-2 text-xs font-semibold"
            >
              Change app
            </button>
          </div>
        </div>
      ) : null}
      {!(isCompact && visibleWorkspaceMode === "single" && selectedApp) && (
        <>
              {!isCompact && (
<div className="workspace-search-composer-header mb-3 flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="workspace-chip-label">Search Composer</div>
                  <h2 className="workspace-search-composer-title mt-1 text-base font-semibold text-app-text sm:text-lg">
                    {visibleWorkspaceMode === "single"
                      ? "Find an app to analyze"
                      : visibleWorkspaceMode === "competitors"
                        ? "Discover competitors"
                        : "Search and add apps to compare"}
                  </h2>
                  <p className="workspace-search-composer-description mt-1 text-[11px] text-app-text-muted sm:text-sm">
                    {visibleWorkspaceMode === "single"
                      ? "Search by app name or paste a store URL."
                      : visibleWorkspaceMode === "competitors"
                        ? "Choose your app, add a rival, and analyze keyword coverage."
                        : "Add up to five apps and compare keywords side by side."}
                  </p>
                </div>
                <div className="workspace-search-composer-meta flex flex-wrap gap-1.5">
                  {visibleWorkspaceMode === "compare" && (
                    <span className="workspace-status-chip">Max 5 apps</span>
                  )}
                  {visibleWorkspaceMode === "competitors" && (
                    <span className="workspace-status-chip">1 own + 1 rival</span>
                  )}
                </div>
              </div>
              )}
              <div className={`workspace-search-composer-body flex flex-col ${isMobileViewport ? "gap-1.5" : "gap-2"}`}>
                <div className="workspace-search-composer-controls flex flex-wrap items-center gap-1.5">
                  <div className="workspace-store-toggle shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStoreTypeChange("android")}
                      className={cn(
                        "workspace-store-button",
                        storeType === "android" && "workspace-store-button-active",
                      )}
                    >
                      <Play
                        className="h-3.5 w-3.5"
                        fill={storeType === "android" ? "currentColor" : "none"}
                      />
                      Play
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStoreTypeChange("ios")}
                      className={cn(
                        "workspace-store-button",
                        storeType === "ios" && "workspace-store-button-active",
                      )}
                    >
                      <Apple className="h-3.5 w-3.5" />
                      iOS
                    </button>
                  </div>
                  <div className="workspace-topbar-country workspace-utility-chip shrink-0">
                    <Globe className="hidden h-3.5 w-3.5 text-app-text-muted sm:block" />
                    <CountrySearchSelect
                      value={country}
                      onChange={handleCountryChange}
                      options={COUNTRIES}
                      ariaLabel="Select storefront country"
                      className={`${isMobileViewport ? "w-[112px]" : "w-[120px]"} min-w-0 sm:w-[168px] sm:min-w-[168px]`}
                    />
                  </div>
                </div>
                <form
                  onSubmit={handleSearch}
                  className="workspace-search-form flex flex-col gap-1.5 w-full sm:flex-row"
                >
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-app-text-muted" />
                    <input
                      id="app-search"
                      name="appSearch"
                      aria-label="Search apps or paste an app store URL"
                      type="text"
                      autoComplete="off"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder={`Search apps or paste a ${storeType === "android" ? "Play Store" : "App Store"} URL...`}
                      className={`input-field workspace-search-composer-input w-full text-sm ${isMobileViewport ? "!py-1.5" : "!py-2"} sm:!py-2.5 sm:text-[0.95rem]`}
                      style={{
                        paddingLeft: "2.45rem",
                        paddingRight: searchTerm ? "2.45rem" : "1rem",
                      }}
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm("");
                          setSearchResults([]);
                          setHasSearched(false);
                        }}
                        aria-label="Clear app search"
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text-muted transition-colors p-1 rounded-full hover:bg-app-surface-muted bg-app-surface-muted"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={isSearching || !searchTerm.trim()}
                    className={`btn-primary workspace-search-composer-submit w-full text-sm sm:w-auto sm:!px-6 sm:!py-2.5 sm:text-[0.9rem] ${isMobileViewport ? "!px-4 !py-1.5" : "!px-4 !py-2"}`}
                  >
                    {isSearching ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        Search
                      </>
                    )}
                  </button>
                </form>
                {visibleWorkspaceMode === "competitors" &&
                  !isCompact &&
                  competitorDraftStarted && (
                  <div className={`mt-3 rounded-2xl border border-app-border/60 bg-app-surface/45 ${isMobileViewport ? "p-2.5" : "p-3 sm:p-4"}`}>
                    <div className="flex flex-col gap-3">
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className={`rounded-xl border border-app-border/60 bg-app-surface-muted/65 ${isMobileViewport ? "px-2.5 py-2.5" : "px-3 py-3"}`}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/70">
                              Your app
                            </p>
                            {!competitorDraftOwnApp ? (
                              <span className="text-[10px] font-semibold text-cyan-400">
                                Choose first
                              </span>
                            ) : null}
                          </div>
                          {competitorDraftOwnApp ? (
                            <div className="mt-2 flex items-center gap-3">
                              <img
                                src={competitorDraftOwnApp.icon}
                                alt={competitorDraftOwnApp.title}
                                className="h-10 w-10 rounded-lg border border-app-border/60 bg-app-surface-muted/80"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-app-text">
                                  {competitorDraftOwnApp.title}
                                </p>
                                <p className="truncate text-xs text-app-text-muted">
                                  {competitorDraftOwnApp.developer}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  clearCompetitorDraftAnalysis();
                                  setCompetitorDraftOwnApp(null);
                                }}
                                aria-label="Change selected app"
                                title="Change app"
                                className="rounded-lg border border-app-border/60 bg-app-surface-muted/70 p-2 text-app-text-muted transition-colors hover:text-app-text"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-app-text-muted">
                              Select your app from the results above.
                            </p>
                          )}
                        </div>
                        <div className={`rounded-xl border border-app-border/60 bg-app-surface-muted/65 ${isMobileViewport ? "px-2.5 py-2.5" : "px-3 py-3"}`}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                              Rival
                            </p>
                            <span className="text-[10px] font-semibold text-app-text-muted">
                              {competitorDraftApps.length}/1
                            </span>
                          </div>
                          {competitorDraftApps.length > 0 ? (
                            <div className="mt-2 space-y-2">
                              {competitorDraftApps.map((app) => (
                                <div
                                  key={getCompareAppKey(app, storeType)}
                                  className="flex items-center gap-3"
                                >
                                  <img
                                    src={app.icon}
                                    alt={app.title}
                                    className="h-10 w-10 rounded-lg border border-app-border/60 bg-app-surface-muted/80"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-app-text">
                                      {app.title}
                                    </p>
                                    <p className="truncate text-xs text-app-text-muted">
                                      {app.developer}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                    removeCompetitorDraftApp(
                                        getCompareAppKey(app, storeType),
                                      )
                                    }
                                    aria-label="Change rival"
                                    title="Change rival"
                                    className="rounded-lg border border-app-border/60 bg-app-surface-muted/70 p-2 text-app-text-muted transition-colors hover:text-app-text"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-2 text-xs text-app-text-muted">
                              {competitorDraftOwnApp
                                ? "Add one competitor from the results above."
                                : "Choose your app to find a rival."}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div className="inline-flex w-fit rounded-xl border border-app-border/70 bg-app-surface-muted/60 p-1">
                          {(["fast", "deep"] as DiscoveryMode[]).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => {
                                if (mode === competitorGroupMode) return;
                                setCompetitorGroupMode(mode);
                                clearCompetitorDraftAnalysis();
                              }}
                              className={`rounded-lg ${isMobileViewport ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-xs"} font-semibold uppercase tracking-wide transition-colors ${competitorGroupMode === mode ? "bg-app-surface-muted text-cyan-100 ring-1 ring-inset ring-cyan-300/10" : "text-app-text-muted hover:text-app-text"}`}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void analyzeCompetitorDraftGroup()}
                            disabled={
                              isAnalyzingCompetitorGroup || !competitorDraftCanAnalyze
                            }
                            className={isMobileViewport ? "btn-primary !px-3 !py-1.5 !text-[11px]" : "btn-primary"}
                          >
                            {isAnalyzingCompetitorGroup ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                            Analyze
                          </button>
                          {competitorDraftStarted ? (
                            <button
                              type="button"
                              onClick={resetCompetitorDraft}
                              className={isMobileViewport ? "btn-ghost !px-3 !py-1.5 !text-[11px]" : "btn-ghost"}
                            >
                              Reset
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {competitorGroupError ? (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-amber-200">
                          {competitorGroupError}
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
              {error && (
                <div
                  className="mt-4 p-4 rounded-xl flex items-center justify-between gap-2"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                  }}
                >
                  {" "}
                  <div
                    className="flex items-center gap-2 text-sm font-medium"
                    style={{ color: "#f87171" }}
                  >
                    {" "}
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />{" "}
                    {error}{" "}
                  </div>{" "}
                  <button
                    onClick={() => setError(null)}
                    className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors text-red-400"
                  >
                    {" "}
                    <X className="w-4 h-4" />{" "}
                  </button>{" "}
                </div>
              )}{" "}
              {/* Search Results Skeleton */}{" "}
              {isSearching && (
                <div
                  className="workspace-search-results-list mt-4 rounded-2xl overflow-hidden border border-app-border/40 bg-app-surface/60"
                >
                  {" "}
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="workspace-search-result-skeleton flex items-center justify-between gap-3 sm:gap-4"
                      style={{
                        borderBottom:
                          i < 4 ? "1px solid rgba(30,41,59,0.8)" : "none",
                      }}
                    >
                      {" "}
                      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                        {" "}
                        <div className="skeleton h-11 w-11 rounded-xl sm:h-14 sm:w-14 sm:rounded-2xl" />{" "}
                        <div className="space-y-2 flex-1 min-w-0">
                          {" "}
                          <div
                            className="skeleton h-4 rounded-lg"
                            style={{ width: "58%" }}
                          />{" "}
                          <div
                            className="skeleton h-3 rounded-lg"
                            style={{ width: "34%" }}
                          />{" "}
                        </div>{" "}
                      </div>{" "}
                      <div className="skeleton h-8 w-20 rounded-lg sm:h-10 sm:w-28 sm:rounded-xl" />{" "}
                    </div>
                  ))}{" "}
                </div>
              )}{" "}
              {!isSearching &&
                hasSearched &&
                searchResults.length === 0 &&
                !error &&
                shouldShowSearchResults && (
                  <div className="mt-3">
                    {isMobileViewport ? (
                      <div className="workspace-empty-block px-4 py-5">
                        <div className="workspace-empty-icon !h-10 !w-10">
                          <Search className="h-5 w-5" />
                        </div>
                        <h3 className="workspace-empty-title !text-sm">No apps found</h3>
                        <p className="workspace-empty-description !max-w-[18rem] !text-[11px]">
                          Try adjusting your search term or paste a direct store URL.
                        </p>
                      </div>
                    ) : (
                      <WorkspaceEmptyBlock
                        icon={Search}
                        title="No apps found"
                        description="Try adjusting your search term or paste a direct store URL."
                      />
                    )}
                  </div>
                )}{" "}
              {!isSearching && searchResults.length > 0 && shouldShowSearchResults && (
                <div className="mt-4 space-y-2.5">
                  {" "}
                  {/* Category Filters */}{" "}
                  {categories.length > 1 && (
                    <div className="workspace-search-category-filters flex overflow-x-auto scrollbar-hide gap-2 pb-2">
                      {" "}
                      <button
                        onClick={() => setSelectedCategory(null)}
                        className={`min-h-11 px-3 py-2 rounded-xl text-xs font-semibold transition-all border whitespace-nowrap ${selectedCategory === null ? "text-black border-transparent" : "text-app-text-muted hover:text-app-text"}`}
                        style={
                          selectedCategory === null
                            ? {
                                background:
                                  "linear-gradient(135deg,#67e8f9,#14b8a6)",
                                boxShadow: "0 4px 12px rgba(34, 211, 238,0.25)",
                              }
                            : {
                                background: isLightTheme
                                  ? "rgba(241,245,249,0.96)"
                                  : "rgba(30,41,59,0.6)",
                                borderColor: isLightTheme
                                  ? "rgba(148,163,184,0.45)"
                                  : "rgba(51,65,85,0.5)",
                              }
                        }
                      >
                        All
                      </button>{" "}
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`min-h-11 px-3 py-2 rounded-xl text-xs font-semibold transition-all border whitespace-nowrap ${selectedCategory === cat ? "text-black border-transparent" : "text-app-text-muted hover:text-app-text"}`}
                          style={
                            selectedCategory === cat
                              ? {
                                  background:
                                    "linear-gradient(135deg,#67e8f9,#14b8a6)",
                                  boxShadow: "0 4px 12px rgba(34, 211, 238,0.25)",
                                }
                              : {
                                  background: isLightTheme
                                    ? "rgba(241,245,249,0.96)"
                                    : "rgba(30,41,59,0.6)",
                                  borderColor: isLightTheme
                                    ? "rgba(148,163,184,0.45)"
                                    : "rgba(51,65,85,0.5)",
                                }
                          }
                        >
                          {cat}
                        </button>
                      ))}{" "}
                    </div>
                  )}{" "}
                  {filteredResults.length > 3 ? (
                    <div className="flex items-center justify-between rounded-xl border border-app-border/40 bg-app-surface-muted/45 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-app-text-muted sm:hidden">
                      <span>{filteredResults.length} apps found</span>
                      <span>Scroll for more</span>
                    </div>
                  ) : null}
                  <div
                    className="workspace-search-results-list rounded-2xl overflow-hidden overflow-y-auto border border-app-border/40 bg-app-surface/70"
                  >
                    {" "}
                    {filteredResults.length > 0 ? (
                      filteredResults.map((app, idx) => {
                        const isComparedApp = comparedApps.some(
                          (entry) => areSameStoreApps(entry, app, storeType),
                        );
                        const isDraftOwnApp = Boolean(
                          competitorDraftOwnApp &&
                            areSameStoreApps(competitorDraftOwnApp, app, storeType),
                        );
                        const isDraftCompetitorApp = competitorDraftApps.some((entry) =>
                          areSameStoreApps(entry, app, storeType),
                        );
                        return (
                        <div
                          key={app.appId || app.id}
                          className={`workspace-search-result-row group flex items-center justify-between gap-3 sm:gap-4 transition-all hover:bg-app-surface-strong/50 ${
                            idx < filteredResults.length - 1 ? "border-b border-app-border/70" : ""
                          }`}
                        >
                          {" "}
                          <div
                            className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0 cursor-pointer"
                            onClick={() =>
                              viewMode === "single"
                                ? handleSelectApp(app)
                                : undefined
                            }
                          >
                            {" "}
                            <img
                              src={app.icon}
                              alt={app.title}
                              className="h-11 w-11 rounded-xl border border-app-border/40 object-cover shadow-lg flex-shrink-0 sm:h-14 sm:w-14 sm:rounded-2xl"
                            />{" "}
                            <div className="min-w-0">
                              {" "}
                              <h3
                                className="mb-0.5 line-clamp-1 text-sm font-semibold text-app-text sm:text-[0.9375rem]"
                              >
                                {app.title}
                              </h3>{" "}
                              <div className="flex min-w-0 items-center gap-2">
                                {" "}
                                <p className="line-clamp-1 text-xs text-app-text-muted sm:text-sm">
                                  {app.developer}
                                </p>{" "}
                                {app.category && (
                                  <span className="badge badge-cyan hidden sm:inline-flex">
                                    {app.category}
                                  </span>
                                )}{" "}
                              </div>{" "}
                            </div>{" "}
                          </div>{" "}
                          {viewMode === "compare" ? (
                            <button
                              onClick={() => handleSelectApp(app)}
                              disabled={isComparedApp || comparedApps.length >= 5}
                              className="workspace-search-result-action text-[11px] font-bold transition-all disabled:opacity-40 flex-shrink-0"
                              style={
                                isComparedApp
                                  ? {
                                      background: "rgba(16,185,129,0.1)",
                                      border: "1px solid rgba(16,185,129,0.3)",
                                      color: "#34d399",
                                    }
                                  : {
                                      background: "rgba(34, 211, 238,0.08)",
                                      border: "1px solid rgba(34, 211, 238,0.2)",
                                      color: "#22d3ee",
                                    }
                              }
                            >
                              {" "}
                              {isComparedApp ? "Added" : "+ Compare"}{" "}
                            </button>
                          ) : viewMode === "competitors" ? (
                            <div className="workspace-search-result-actions flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                              {!competitorDraftOwnApp ? (
                                <button
                                  onClick={() => void assignCompetitorDraftOwnApp(app)}
                                  disabled={isDraftOwnApp}
                                  className="workspace-search-result-action text-[11px] font-bold transition-all disabled:opacity-40"
                                  style={
                                    isDraftOwnApp
                                      ? {
                                          background: "rgba(16,185,129,0.1)",
                                          border: "1px solid rgba(16,185,129,0.3)",
                                          color: "#34d399",
                                        }
                                      : {
                                          background: "rgba(34, 211, 238,0.08)",
                                          border: "1px solid rgba(34, 211, 238,0.2)",
                                          color: "#22d3ee",
                                        }
                                  }
                                >
                                  {isDraftOwnApp ? "Selected" : "Select App"}
                                </button>
                              ) : isDraftOwnApp ? (
                                <button
                                  type="button"
                                  disabled
                                  className="workspace-search-result-action text-[11px] font-bold transition-all disabled:opacity-40"
                                  style={{
                                    background: "rgba(16,185,129,0.1)",
                                    border: "1px solid rgba(16,185,129,0.3)",
                                    color: "#34d399",
                                  }}
                                >
                                  Selected App
                                </button>
                              ) : (
                                <button
                                  onClick={() => void addCompetitorDraftApp(app)}
                                  disabled={
                                    isDraftCompetitorApp || competitorDraftApps.length >= 1
                                  }
                                  className="workspace-search-result-action text-[11px] font-bold transition-all disabled:opacity-40"
                                  style={
                                    isDraftCompetitorApp
                                      ? {
                                          background: "rgba(16,185,129,0.1)",
                                          border: "1px solid rgba(16,185,129,0.3)",
                                          color: "#34d399",
                                        }
                                      : {
                                          background: "rgba(34, 211, 238,0.08)",
                                          border: "1px solid rgba(34, 211, 238,0.2)",
                                          color: "#22d3ee",
                                        }
                                  }
                                >
                                  {isDraftCompetitorApp ? "Selected" : "Add Competitor"}
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              onClick={() => handleSelectApp(app)}
                              className="workspace-search-result-primary btn-primary text-[11px] flex-shrink-0"
                            >
                              Analyze
                            </button>
                          )}{" "}
                        </div>
                        );
                      })
                    ) : (
                      <div className="p-10 text-center text-app-text-muted flex flex-col items-center">
                        {" "}
                        <Search className="w-8 h-8 mb-3 opacity-40" /> No apps
                        in this category.{" "}
                      </div>
                    )}{" "}
                  </div>{" "}
                </div>
               )}{" "}
        </>
      )}
    </WorkspacePanel>
  );
  return (
    <ErrorBoundary>
      {showUpgradePage ? (
        <UpgradePage
          billingStatus={billingStatusForUi}
          accessState={billingAccessState}
          billingError={billingError}
          isLoading={isLoadingBillingStatus}
          isStartingCheckout={isStartingBillingCheckout}
          isOpeningPortal={isOpeningBillingPortal}
          currentUserLabel={
            currentUser.displayName || currentUser.email || "Authenticated user"
          }
          currentUserEmail={currentUser.email}
          isPollingActivation={isPollingBillingActivation}
          activationTimedOut={billingActivationTimedOut}
          onStartCheckout={(planId, interval) => void startBillingCheckout(planId, interval)}
          onOpenPortal={() => void openBillingPortal()}
          onRetryBillingStatus={() => void pollForBillingActivation()}
          onSignOut={() => void onSignOut()}
          onReturn={hasActiveBillingAccess ? () => setViewMode("single") : undefined}
        />
      ) : (
      <div className="workspace-shell min-h-screen text-app-text font-sans relative pb-20 md:pb-0">
        <MobileBottomNav
          tabs={mobileWorkspacePageConfigs}
          activeId={viewMode === "charts" ? "single" : viewMode}
          onTabChange={(id) => setViewMode(id)}
        />
        <div className="bg-orb bg-orb-1" />
        <div className="bg-orb bg-orb-2" />
        <div className="bg-orb bg-orb-3" />
        <header className="workspace-topbar">
          <div className="workspace-topbar-inner">
            <div className="flex w-full items-center justify-between md:w-auto md:justify-start">
              <div className="workspace-brand">
                <BrandMark
                  size="md"
                  subtitle={activeWorkspacePage.eyebrow}
                  className="workspace-brand-copy min-w-0"
                />
              </div>
              <div className="workspace-mobile-only flex items-center gap-2">
                <button
                  onClick={onSignOut}
                  aria-label="Sign out"
                  className="h-8 w-8 overflow-hidden rounded-full border border-app-border/50 bg-app-surface-strong focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-950 sm:h-9 sm:w-9"
                  title="Sign out"
                >
                  {currentUser.photoURL ? (
                    <img src={currentUser.photoURL} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-cyan-300">
                      {(currentUser.displayName || currentUser.email || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                </button>
              </div>
            </div>
            <div className="workspace-topbar-controls">
              <div className="workspace-desktop-only workspace-utility-chip">
                <div className="min-w-0">
                  <p className="workspace-chip-label">Signed in as</p>
                  <p className="truncate text-sm font-semibold text-app-text max-w-[180px]">
                    {currentUser.displayName ||
                      currentUser.email ||
                      "Authenticated user"}
                  </p>
                </div>
                {notificationPermission !== "granted" && (
                  <button
                    onClick={requestNotificationPermission}
                    aria-label="Enable push notifications"
                    className="workspace-icon-button text-amber-300"
                    title="Enable Push Notifications"
                  >
                    <BellRing className="h-4 w-4" />
                  </button>
                )}
                {!isDemoMode && (
                  <button
                    onClick={() => setViewMode("upgrade")}
                    aria-label="View plans"
                    className="workspace-icon-button"
                    title="View plans"
                  >
                    <CreditCard className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={onSignOut}
                  aria-label="Sign out"
                  className="workspace-icon-button"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
                <div className="relative">
                  <button
                    onClick={() => {
                      setIsConfirmingDeleteAccount((prev) => !prev);
                      setDeleteAccountConfirmationInput("");
                    }}
                    aria-label="Delete account"
                    className={cn(
                      "workspace-icon-button",
                      isConfirmingDeleteAccount && "border-red-500/20 bg-red-500/10 text-red-300",
                    )}
                    title="Delete account"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  {isConfirmingDeleteAccount && (
                    <div className="workspace-popover absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl p-4">
                      <p className="mb-2 text-sm font-semibold text-red-200">
                        Delete this account?
                      </p>
                      <p className="mb-3 text-xs leading-relaxed text-app-text-muted">
                        This removes your saved bookmarks, tracked apps,
                        competitor snapshots, tracked keywords, rank history,
                        and Firebase login for this account.
                      </p>
                      <p className="mb-3 text-xs leading-relaxed text-amber-300">
                        If Firebase asks for a recent login, sign in again and
                        retry.
                      </p>
                      <label className="mb-3 block text-xs text-app-text-muted">
                        Type{" "}
                        <span className="font-semibold text-app-text">
                          {deleteAccountConfirmationPhrase}
                        </span>{" "}
                        to confirm.
                        <input
                          type="text"
                          value={deleteAccountConfirmationInput}
                          onChange={(event) =>
                            setDeleteAccountConfirmationInput(event.target.value)
                          }
                          placeholder={deleteAccountConfirmationPhrase}
                          className="mt-2 w-full rounded-xl border border-app-border bg-app-surface/80 px-3 py-2 text-sm text-app-text outline-none transition-colors focus:border-cyan-500/40"
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => {
                            setIsDeletingAccount(true);
                            try {
                              await onDeleteAccount();
                            } finally {
                              setIsDeletingAccount(false);
                              setIsConfirmingDeleteAccount(false);
                              setDeleteAccountConfirmationInput("");
                            }
                          }}
                          disabled={
                            isDeletingAccount ||
                            deleteAccountConfirmationInput.trim().toLowerCase() !==
                              deleteAccountConfirmationPhrase
                          }
                          className="flex-1 rounded-lg bg-red-600/95 py-2 text-xs font-bold text-white transition-colors disabled:opacity-60"
                        >
                          {isDeletingAccount ? "Deleting..." : "Delete"}
                        </button>
                        <button
                          onClick={() => {
                            setIsConfirmingDeleteAccount(false);
                            setDeleteAccountConfirmationInput("");
                          }}
                          disabled={isDeletingAccount}
                          className="workspace-secondary-button flex-1 py-2 text-xs disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {!onboardingVisible &&
                  userStateHydrated &&
                  hasAcceptedLegal &&
                  completedOnboardingStepCount < onboardingSteps.length && (
                    <div className="relative">
                      <button
                        onClick={() => setIsSetupGuideOpen((prev) => !prev)}
                        className={cn(
                          "workspace-icon-button workspace-setup-trigger inline-flex items-center gap-1.5",
                          isSetupGuideOpen && "bg-cyan-500/10 text-cyan-300",
                        )}
                        title="Show setup guide"
                      >
                        <BookOpen className="h-4 w-4" />
                        <span className="workspace-setup-trigger-copy">
                          Setup {completedOnboardingStepCount}/{onboardingSteps.length}
                        </span>
                      </button>
                      {isSetupGuideOpen && (
                        <div className="workspace-popover workspace-setup-popover absolute right-0 top-full z-50 mt-2 shadow-xl sm:w-80 sm:max-w-sm sm:p-4">
                          <div className="mb-2 flex items-center justify-between sm:mb-4">
                            <div className="flex items-center gap-2">
                              <BellRing className="h-4 w-4 text-cyan-400" />
                              <h3 className="font-bold text-app-text">Quick Start</h3>
                            </div>
                            <div className="text-xs font-bold text-cyan-400">
                              {completedOnboardingStepCount}/{onboardingSteps.length}
                            </div>
                          </div>
                          <p className="workspace-setup-popover-copy mb-3 text-[10px] leading-relaxed text-app-text-muted sm:mb-4 sm:text-xs">
                            Follow these steps once and the app starts paying you back: analyze your app, track a keyword, add competitors, then turn on alerts.
                          </p>
                          <div className="flex flex-col gap-1.5 sm:gap-2">
                            {onboardingSteps.map((step, index) => (
                              <div
                                key={step.id}
                                className={cn(
                                  "workspace-setup-step rounded-xl border p-2 sm:p-3",
                                  step.isComplete
                                    ? "border-app-border/50 bg-app-surface-strong/50"
                                    : "border-app-border/60 bg-app-surface-strong/80"
                                )}
                              >
                                <div className="flex items-start gap-2 sm:gap-3">
                                  <div
                                    className={cn(
                                      "mt-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold sm:h-5 sm:w-5 sm:text-[10px]",
                                      step.isComplete
                                        ? "bg-cyan-500/20 text-cyan-300"
                                        : "bg-app-surface-muted text-app-text-muted"
                                    )}
                                  >
                                    {step.isComplete ? "✓" : index + 1}
                                  </div>
                                  <div className="flex-1">
                                    <h4
                                      className={cn(
                                        "text-[11px] font-semibold sm:text-xs",
                                        step.isComplete ? "text-app-text-muted" : "text-app-text"
                                      )}
                                    >
                                      {step.title}
                                    </h4>
                                    <p className="workspace-setup-step-copy mt-0.5 text-[9px] leading-tight text-app-text-muted sm:mt-1 sm:text-[10px]">
                                      {step.description}
                                    </p>
                                    {!step.isComplete && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsSetupGuideOpen(false);
                                          step.action();
                                        }}
                                        className="workspace-secondary-button mt-2 px-2 py-1 text-[9px] sm:text-[10px]"
                                      >
                                        {step.actionLabel}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
              </div>

              <div className="workspace-topbar-actions">
                <ThemeToggle
                  themeMode={themeMode}
                  onToggle={onToggleTheme}
                  className="workspace-theme-toggle"
                />
                {notificationPermission !== "granted" && (
                  <button
                    onClick={requestNotificationPermission}
                    aria-label="Enable push notifications"
                    className="workspace-mobile-only workspace-icon-button text-amber-300"
                    title="Enable Push Notifications"
                  >
                    <BellRing className="h-4 w-4" />
                  </button>
                )}
                {!isDemoMode && (
                  <button
                    onClick={() => setViewMode("upgrade")}
                    aria-label="View plans"
                    className="workspace-mobile-only workspace-icon-button"
                    title="View plans"
                  >
                    <CreditCard className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={onSignOut}
                  aria-label="Sign out"
                  className="workspace-mobile-only workspace-icon-button"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
                <button
                  onClick={async () => {
                    const confirmation = window.prompt(
                      `Type "${deleteAccountConfirmationPhrase}" to delete this account.`,
                    );
                    if (
                      confirmation?.trim().toLowerCase() !==
                      deleteAccountConfirmationPhrase
                    ) {
                      toast.error("Deletion cancelled. Confirmation phrase did not match.");
                      return;
                    }
                    setIsDeletingAccount(true);
                    try {
                      await onDeleteAccount();
                    } finally {
                      setIsDeletingAccount(false);
                    }
                  }}
                  disabled={isDeletingAccount}
                  aria-label="Delete account"
                  className="workspace-mobile-only workspace-icon-button disabled:opacity-60"
                  title="Delete account"
                >
                  {isDeletingAccount ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
                {!onboardingVisible &&
                  userStateHydrated &&
                  hasAcceptedLegal &&
                  completedOnboardingStepCount < onboardingSteps.length && (
                    <div className="relative workspace-mobile-only">
                      <button
                        onClick={() => setIsSetupGuideOpen((prev) => !prev)}
                        className={cn(
                          "workspace-icon-button workspace-setup-trigger inline-flex items-center gap-1.5",
                          isSetupGuideOpen && "bg-cyan-500/10 text-cyan-300",
                        )}
                        title="Show setup guide"
                      >
                        <BookOpen className="h-4 w-4" />
                        <span className="workspace-setup-trigger-copy">
                          Setup {completedOnboardingStepCount}/{onboardingSteps.length}
                        </span>
                      </button>
                      {isSetupGuideOpen && (
                        <div className="workspace-popover workspace-setup-popover absolute right-0 top-full z-50 mt-2 shadow-xl sm:w-80 sm:max-w-sm sm:p-4">
                          <div className="mb-2 flex items-center justify-between sm:mb-4">
                            <div className="flex items-center gap-2">
                              <BellRing className="h-4 w-4 text-cyan-400" />
                              <h3 className="font-bold text-app-text">Quick Start</h3>
                            </div>
                            <div className="text-xs font-bold text-cyan-400">
                              {completedOnboardingStepCount}/{onboardingSteps.length}
                            </div>
                          </div>
                          <p className="workspace-setup-popover-copy mb-3 text-[10px] leading-relaxed text-app-text-muted sm:mb-4 sm:text-xs">
                            Follow these steps once and the app starts paying you back: analyze your app, track a keyword, add competitors, then turn on alerts.
                          </p>
                          <div className="flex flex-col gap-1.5 sm:gap-2">
                            {onboardingSteps.map((step, index) => (
                              <div
                                key={step.id}
                                className={cn(
                                  "workspace-setup-step rounded-xl border p-2 sm:p-3",
                                  step.isComplete
                                    ? "border-app-border/50 bg-app-surface-strong/50"
                                    : "border-app-border/60 bg-app-surface-strong/80"
                                )}
                              >
                                <div className="flex items-start gap-2 sm:gap-3">
                                  <div
                                    className={cn(
                                      "mt-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold sm:h-5 sm:w-5 sm:text-[10px]",
                                      step.isComplete
                                        ? "bg-cyan-500/20 text-cyan-300"
                                        : "bg-app-surface-muted text-app-text-muted"
                                    )}
                                  >
                                    {step.isComplete ? "✓" : index + 1}
                                  </div>
                                  <div className="flex-1">
                                    <h4
                                      className={cn(
                                        "text-[11px] font-semibold sm:text-xs",
                                        step.isComplete ? "text-app-text-muted" : "text-app-text"
                                      )}
                                    >
                                      {step.title}
                                    </h4>
                                    <p className="workspace-setup-step-copy mt-0.5 text-[9px] leading-tight text-app-text-muted sm:mt-1 sm:text-[10px]">
                                      {step.description}
                                    </p>
                                    {!step.isComplete && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsSetupGuideOpen(false);
                                          step.action();
                                        }}
                                        className="workspace-secondary-button mt-2 px-2 py-1 text-[9px] sm:text-[10px]"
                                      >
                                        {step.actionLabel}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
              </div>
            </div>
          </div>
        </header>
        <div className="workspace-layout">
          <aside className="workspace-sidebar">
            <div className="workspace-rail">
              {workspacePageConfigs.map((item) => (
                <WorkspaceNavButton
                  key={item.id}
                  active={visibleWorkspaceMode === item.id}
                  item={item}
                  onClick={() => setViewMode(item.id)}
                />
              ))}
            </div>
            <WorkspacePanel
              className="workspace-sidebar-panel workspace-sidebar-context hidden xl:block"
              tone="muted"
            >
              <div className="workspace-chip-label">Live context</div>
              <div className="mt-3 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-app-text-muted">Market</span>
                  <span className="font-medium text-app-text">
                    {findCountryName(country) || country}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-app-text-muted">Store</span>
                  <span className="font-medium text-app-text">
                    {storeType === "ios" ? "iOS" : "Google Play"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-app-text-muted">Tracked apps</span>
                  <span className="font-medium text-app-text">
                    {trackedAppUsageCount}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-app-text-muted">Bookmarks</span>
                  <span className="font-medium text-app-text">
                    {bookmarks.length}
                  </span>
                </div>
              </div>
            </WorkspacePanel>
          </aside>
          <main className="workspace-main">
            {successMessage && (
              <div className="workspace-success-banner">
                <div className="flex items-center gap-2.5 text-sm font-medium text-cyan-300">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
                  {successMessage}
                </div>
                <button
                  onClick={() => setSuccessMessage(null)}
                  className="workspace-icon-button h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {isDemoMode && (
              <WorkspacePanel className="mb-6" tone="muted">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/80">
                      Session access
                    </p>
                    <p className="mt-1 text-sm leading-6 text-app-text-muted">
                      Some actions are unavailable in this session. Sign in to manage your live workspace data.
                    </p>
                  </div>
                  <button onClick={onSignOut} className="workspace-secondary-button">
                    Sign Out
                  </button>
                </div>
              </WorkspacePanel>
            )}
            <WorkspacePanel className="workspace-page-header-panel" tone="strong">
                <WorkspacePageIntro
                  eyebrow={activeWorkspacePage.eyebrow}
                  title={
                    isDenseWorkspaceLandingSummary &&
                    activeWorkspaceLandingCopy?.title
                      ? activeWorkspaceLandingCopy.title
                      : activeWorkspacePage.title
                  }
                  description={
                    isDenseWorkspaceLandingSummary &&
                    activeWorkspaceLandingCopy?.description
                      ? activeWorkspaceLandingCopy.description
                      : activeWorkspacePage.description
                  }
                  icon={activeWorkspacePage.icon}
                  compact
                  dense={isDenseWorkspaceLandingSummary}
                  aside={
                    <div
                      className={cn(
                        "workspace-page-context",
                        isDenseWorkspaceLandingSummary &&
                          "workspace-page-context-dense",
                      )}
                    >
                      <span className="workspace-status-chip">
                        {storeType === "ios" ? "iOS" : "Play"}
                      </span>
                      <span className="workspace-status-chip">
                        {findCountryName(country) || country}
                      </span>
                      {visibleWorkspaceMode === "tracked" ? (
                        <span
                          className={cn(
                            "workspace-status-chip",
                            isDenseWorkspaceLandingSummary &&
                              "workspace-status-chip-dense hidden sm:inline-flex",
                          )}
                        >
                          {isDenseWorkspaceLandingSummary ? "" : "Updated "}
                          {trackingSchedule.lastRunAt
                            ? formatTrackingChartDateTime(
                                trackingSchedule.lastRunAt,
                              )
                            : "Not yet"}
                        </span>
                      ) : null}
                      {currentPagePdfExport &&
                      !(isDenseWorkspaceLandingSummary && isMobileViewport) ? (
                        <div
                          className={cn(
                            "flex items-center gap-2",
                            isDenseWorkspaceLandingSummary &&
                              "workspace-page-action-row-dense",
                          )}
                        >
                          {visibleWorkspaceMode === "reports" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setIsPdfExportOptionsOpen(false);
                                setIsWeeklyReportSettingsOpen(true);
                              }}
                              className="workspace-secondary-button inline-flex items-center gap-1.5 px-3 py-2 text-xs"
                            >
                              <Mail className="h-4 w-4" />
                              <span className="hidden sm:inline">Weekly Email</span>
                              <span className="sm:hidden">Email</span>
                            </button>
                          ) : null}
                        <div className="workspace-pdf-export-anchor relative">
                          <button
                            type="button"
                            onClick={() => setIsPdfExportOptionsOpen((prev) => !prev)}
                            disabled={isExporting}
                            className={cn(
                              "workspace-secondary-button workspace-pdf-export-trigger inline-flex items-center gap-1.5 px-3 py-2 text-xs disabled:opacity-60",
                              isDenseWorkspaceLandingSummary &&
                                "workspace-secondary-button-dense",
                            )}
                          >
                            {isExporting ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                            {isDenseWorkspaceLandingSummary ? null : (
                              <>
                                <span className="hidden sm:inline">Export PDF</span>
                                <span className="sm:hidden">PDF</span>
                              </>
                            )}
                          </button>
                          {isPdfExportOptionsOpen ? (
                            <div className="workspace-popover workspace-pdf-export-popover absolute right-0 top-full z-50 mt-2 w-[calc(100vw-1rem)] max-w-sm rounded-2xl p-3 shadow-xl sm:p-4">
                              <div className="workspace-pdf-export-header flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="workspace-chip-label">PDF Export</div>
                                  <h3 className="workspace-pdf-export-title mt-1 text-sm font-semibold text-app-text">
                                    Choose timeline and country
                                  </h3>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setIsPdfExportOptionsOpen(false)}
                                  className="workspace-icon-button h-8 w-8"
                                  aria-label="Close export options"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="workspace-pdf-export-body mt-4 space-y-4">
                                <div>
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                                    Timeline
                                  </div>
                                  <div className="workspace-pdf-timeline-grid mt-2 grid grid-cols-2 gap-2">
                                    {PDF_HISTORY_RANGE_OPTIONS.map((option) => (
                                      <button
                                        key={option.key}
                                        type="button"
                                        onClick={() => setPdfHistoryRange(option.key)}
                                        className={cn(
                                          "workspace-pdf-timeline-option rounded-xl border px-3 py-2 text-xs font-semibold transition-colors",
                                          pdfHistoryRange === option.key
                                            ? "border-cyan-500/30 bg-cyan-500/15 text-cyan-200"
                                            : "border-app-border/70 bg-app-surface/60 text-app-text-muted hover:text-app-text",
                                        )}
                                      >
                                        {option.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                                    Country Scope
                                  </div>
                                  <div className="workspace-pdf-export-country-select mt-2">
                                    <CountrySearchSelect
                                      value={pdfExportCountryScope}
                                      onChange={setPdfExportCountryScope}
                                      options={pdfExportCountryOptions}
                                      includeAllOption={
                                        pdfExportCountryOptions.length > 1
                                          ? {
                                              code: PDF_EXPORT_ALL_COUNTRIES_CODE,
                                              name: "All tracked countries",
                                            }
                                          : undefined
                                    }
                                    ariaLabel="Select PDF export country scope"
                                    className="w-full"
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="workspace-pdf-export-actions mt-4 flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setIsPdfExportOptionsOpen(false)}
                                  className="workspace-secondary-button px-3 py-2 text-xs"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void exportToPDF()}
                                  disabled={isExporting}
                                  className="workspace-pdf-download-button rounded-xl bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:opacity-60"
                                >
                                  <span className="hidden sm:inline">Download PDF</span>
                                  <span className="sm:hidden">Download</span>
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                        </div>
                      ) : null}
                    </div>
                  }
                />
                {isMobileTrackWorkspace ? (
                  <div
                    className="workspace-mobile-track-switcher"
                    role="tablist"
                    aria-label="Tracking workspace views"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={visibleWorkspaceMode === "tracked"}
                      onClick={() => setViewMode("tracked")}
                      className={cn(
                        "workspace-mobile-track-button",
                        visibleWorkspaceMode === "tracked" &&
                          "workspace-mobile-track-button-active",
                      )}
                    >
                      <BellRing className="h-3.5 w-3.5" />
                      Tracked Keywords
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={visibleWorkspaceMode === "competitors"}
                      onClick={() => setViewMode("competitors")}
                      className={cn(
                        "workspace-mobile-track-button",
                        visibleWorkspaceMode === "competitors" &&
                          "workspace-mobile-track-button-active",
                      )}
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Competitor Groups
                    </button>
                  </div>
                ) : null}
                {workspaceSummaryCards.length > 0 ? (
                  <WorkspaceMetricGrid compact dense={isDenseWorkspaceLandingSummary}>
                    {workspaceSummaryCards.map((card) => (
                      <WorkspaceMetricCard
                        key={card.label}
                        label={card.label}
                        value={card.value}
                        hint={card.hint}
                        trend={card.trend}
                        accent={card.accent}
                        compact
                        dense={isDenseWorkspaceLandingSummary}
                      />
                    ))}
                  </WorkspaceMetricGrid>
                ) : null}
            </WorkspacePanel>

          {/* Search Section */}{" "}
          {visibleWorkspaceMode !== "bookmarks" &&
            visibleWorkspaceMode !== "tracked" &&
            visibleWorkspaceMode !== "reports" &&
            visibleWorkspaceMode !== "competitors" &&
            !(visibleWorkspaceMode === "single" && selectedApp) &&
            !(visibleWorkspaceMode === "compare" && comparedApps.length > 0) &&
            renderSearchSection(false)
          }          {/* Competitors Dashboard */}{" "}
          {viewMode === "competitors" && (
            <div className={isMobileViewport ? "space-y-4" : "space-y-6"} ref={competitorsExportRef}>
              <div
                className="workspace-view-tabs"
                role="tablist"
                aria-label="Competitor workspace views"
              >
                <button
                  type="button"
                  role="tab"
                  id="competitor-tab-discover"
                  aria-controls="competitor-panel-discover"
                  aria-selected={competitorWorkspaceTab === "build"}
                  tabIndex={competitorWorkspaceTab === "build" ? 0 : -1}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "End") {
                      event.preventDefault();
                      setCompetitorWorkspaceTab("saved");
                      document.getElementById("competitor-tab-saved")?.focus();
                    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "Home") {
                      event.preventDefault();
                      setCompetitorWorkspaceTab("build");
                      event.currentTarget.focus();
                    }
                  }}
                  onClick={() => setCompetitorWorkspaceTab("build")}
                  className={cn(
                    "workspace-view-tab",
                    competitorWorkspaceTab === "build" && "workspace-view-tab-active",
                  )}
                >
                  <Layers className="h-4 w-4" />
                  <span>Discover Competitors</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  id="competitor-tab-saved"
                  aria-controls="competitor-panel-saved"
                  aria-selected={competitorWorkspaceTab === "saved"}
                  tabIndex={competitorWorkspaceTab === "saved" ? 0 : -1}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "Home") {
                      event.preventDefault();
                      setCompetitorWorkspaceTab("build");
                      document.getElementById("competitor-tab-discover")?.focus();
                    } else if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "End") {
                      event.preventDefault();
                      setCompetitorWorkspaceTab("saved");
                    }
                  }}
                  onClick={() => setCompetitorWorkspaceTab("saved")}
                  className={cn(
                    "workspace-view-tab",
                    competitorWorkspaceTab === "saved" && "workspace-view-tab-active",
                  )}
                >
                  <Bookmark className="h-4 w-4" />
                  <span>Saved Groups</span>
                  <span className="workspace-view-tab-count">
                    {competitorDashboardCards.length}
                  </span>
                </button>
              </div>
              {competitorWorkspaceTab === "build" && !competitorDraftHasAnalysis ? (
                <div
                  id="competitor-panel-discover"
                  role="tabpanel"
                  aria-labelledby="competitor-tab-discover"
                  tabIndex={0}
                >
                  {renderSearchSection(false)}
                </div>
              ) : null}
              {competitorWorkspaceTab === "build" && competitorDraftHasAnalysis && renderSearchSection(true)}
              {competitorWorkspaceTab === "build" && competitorDraftHasAnalysis ? (
                <div
                  id="competitor-panel-discover"
                  role="tabpanel"
                  aria-labelledby="competitor-tab-discover"
                  tabIndex={0}
                  className={`card ${isMobileViewport ? "p-2.5" : "p-5 md:p-6"}`}
                >
                  <div className={`flex flex-col ${isMobileViewport ? "gap-3" : "gap-5"}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h3 className="section-header">
                          <span
                            className="section-header-icon"
                            style={{
                              background: "rgba(148,163,184,0.12)",
                              border: "1px solid rgba(125,211,252,0.16)",
                            }}
                          >
                            <Layers className="w-4 h-4 text-cyan-100" />
                          </span>
                          Competitor Analysis
                        </h3>
                      </div>
                      <div className={`flex flex-wrap ${isMobileViewport ? "gap-1.5" : "gap-2"}`}>
                        <div className="inline-flex rounded-xl border border-app-border/70 bg-app-surface-muted/60 p-1">
                          {(["fast", "deep"] as DiscoveryMode[]).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => {
                                if (mode === competitorGroupMode) return;
                                setCompetitorGroupMode(mode);
                                clearCompetitorDraftAnalysis();
                              }}
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${competitorGroupMode === mode ? "bg-app-surface-muted text-cyan-100 ring-1 ring-inset ring-cyan-300/10" : "text-app-text-muted hover:text-app-text"}`}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => void analyzeCompetitorDraftGroup()}
                          disabled={
                            isAnalyzingCompetitorGroup || !competitorDraftCanAnalyze
                          }
                          className={isMobileViewport ? "btn-primary !px-3 !py-1.5 !text-[11px]" : "btn-primary"}
                        >
                          {isAnalyzingCompetitorGroup ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}
                          Analyze
                        </button>
                        <button
                          type="button"
                          onClick={resetCompetitorDraft}
                          className={isMobileViewport ? "btn-ghost !px-3 !py-1.5 !text-[11px]" : "btn-ghost"}
                        >
                          Start over
                        </button>
                      </div>
                    </div>

                    <div className={`flex flex-wrap items-center text-xs ${isMobileViewport ? "gap-1.5" : "gap-2"}`}>
                      <span className="workspace-status-chip">
                        Base market {findCountryName(country) || country}
                      </span>
                      <span className="workspace-status-chip">
                        {competitorDraftSelectedKeywords.length} keywords
                      </span>
                      <span className="workspace-status-chip">
                        {competitorDraftSelectedCountryCount} country scopes
                      </span>
                    </div>

                    <div className={isMobileViewport ? "space-y-3" : "space-y-4"}>
                      <div className={`grid ${isMobileViewport ? "gap-2.5" : "gap-4"} md:grid-cols-2`}>
                        <div className={cn(
                          `rounded-2xl border border-app-border/60 bg-app-surface-muted/65 shadow-[inset_0_1px_0_rgba(148,163,184,0.05)] transition-all ${isMobileViewport ? "p-3" : "p-4"}`,
                          competitorDraftOwnApp && competitorDraftApps.length > 0 ? "opacity-60 md:opacity-100" : "opacity-100"
                        )}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/70">
                            <span className="md:hidden mr-1">Step 1:</span>Your app
                          </p>
                          {!competitorDraftOwnApp && (
                            <span className="md:hidden text-[10px] font-semibold text-cyan-400 animate-pulse">Action required</span>
                          )}
                        </div>
                        {competitorDraftOwnApp ? (
                          <div className={`flex items-start ${isMobileViewport ? "mt-2 gap-2.5" : "mt-3 gap-3"}`}>
                            <img
                              src={competitorDraftOwnApp.icon}
                              alt={competitorDraftOwnApp.title}
                              className={`${isMobileViewport ? "h-11 w-11 rounded-xl" : "h-14 w-14 rounded-2xl"} border border-app-border/60 bg-app-surface-muted/80`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-app-text">
                                {competitorDraftOwnApp.title}
                              </p>
                              <p className="truncate text-xs text-app-text-muted">
                                {competitorDraftOwnApp.developer}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                clearCompetitorDraftAnalysis();
                                setCompetitorDraftOwnApp(null);
                              }}
                              aria-label="Change selected app"
                              title="Change app"
                              className="rounded-lg border border-app-border/60 bg-app-surface-muted/70 p-2 text-app-text-muted transition-colors hover:text-app-text"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <p className={`${isMobileViewport ? "mt-2 text-[12px]" : "mt-3 text-sm"} text-app-text-muted`}>
                            Search above and select your app first.
                          </p>
                        )}
                      </div>

                        <div className={cn(
                          `rounded-2xl border border-app-border/70 bg-app-surface-muted/45 transition-all ${isMobileViewport ? "p-3" : "p-4"}`,
                          !competitorDraftOwnApp ? "hidden md:block opacity-40 pointer-events-none" : "block",
                          competitorDraftApps.length > 0 ? "opacity-60 md:opacity-100" : "opacity-100"
                        )}>
                          <div className={`flex items-center justify-between gap-3 ${isMobileViewport ? "mb-1.5" : "mb-2"}`}>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                              <span className="md:hidden mr-1">Step 2:</span>Rival
                            </p>
                            <span className="text-xs text-app-text-muted">
                              {competitorDraftApps.length}/1
                            </span>
                          </div>
                        {competitorDraftApps.length > 0 ? (
                          <div className={`${isMobileViewport ? "mt-2 space-y-2" : "mt-3 space-y-3"}`}>
                            {competitorDraftApps.map((app) => (
                              <div
                                key={getCompareAppKey(app, storeType)}
                                className={`flex items-start rounded-2xl border border-app-border/50 bg-app-surface/45 ${isMobileViewport ? "gap-2.5 p-2.5" : "gap-3 p-3"}`}
                              >
                                <img
                                  src={app.icon}
                                  alt={app.title}
                                  className={`${isMobileViewport ? "h-10 w-10" : "h-12 w-12"} rounded-xl border border-app-border/60 bg-app-surface-muted/80`}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold text-app-text">
                                    {app.title}
                                  </p>
                                  <p className="truncate text-xs text-app-text-muted">
                                    {app.developer}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeCompetitorDraftApp(
                                      getCompareAppKey(app, storeType),
                                    )
                                  }
                                  aria-label="Change rival"
                                  title="Change rival"
                                  className="rounded-lg border border-app-border/60 bg-app-surface-muted/70 p-2 text-app-text-muted transition-colors hover:text-app-text"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className={`${isMobileViewport ? "mt-2 text-[12px]" : "mt-3 text-sm"} text-app-text-muted`}>
                            Add one rival app from the search results.
                          </p>
                        )}
                      </div>
                      </div>

                      <div className={cn(
                        `rounded-2xl border border-app-border/60 bg-app-surface/40 transition-all ${isMobileViewport ? "p-3" : "p-4"}`,
                        competitorDraftApps.length === 0 ? "hidden md:block opacity-40 pointer-events-none" : "block"
                      )}>
                        <div className="md:hidden mb-3 border-b border-app-border pb-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400">
                            Step 3: Analyze & Track Keywords
                          </p>
                        </div>
                      {competitorGroupError && (
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
                          {competitorGroupError}
                        </div>
                      )}
                      {competitorDraftAnalysis ? (
                        <div className={`${isMobileViewport ? "space-y-2.5" : "space-y-4"}`}>
                          <div className={`grid ${isMobileViewport ? "gap-2" : "gap-3"} ${isMobileViewport ? "grid-cols-1" : "md:grid-cols-2"}`}>
                            {competitorDraftAnalysis.appInsights.map((insight) => (
                              <div
                                key={`draft-${insight.appKey}`}
                                className={`rounded-2xl border ${isMobileViewport ? "p-2.5" : "p-4"} ${insight.role === "own" ? "border-cyan-400/20 bg-app-surface-muted/70 ring-1 ring-inset ring-cyan-300/10" : "border-app-border/60 bg-app-surface-muted/60"}`}
                              >
                                <div className={`flex items-start ${isMobileViewport ? "gap-2.5" : "gap-3"}`}>
                                  <img
                                    src={insight.app.icon}
                                    alt={insight.app.title}
                                    className={`${isMobileViewport ? "h-9 w-9" : "h-11 w-11"} rounded-xl border border-app-border/60 bg-app-surface-muted/80`}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-app-text">
                                      {insight.app.title}
                                    </p>
                                    <p className="text-[11px] text-app-text-muted uppercase tracking-[0.18em]">
                                      {insight.role === "own" ? "Your app" : "Competitor"}
                                    </p>
                                  </div>
                                </div>
                                <div className={`grid grid-cols-2 gap-2 text-xs ${isMobileViewport ? "mt-1.5" : "mt-3"}`}>
                                  <div className={`rounded-xl border border-app-border/50 bg-app-surface-muted/60 text-app-text-muted ${isMobileViewport ? "px-2.5 py-1.5" : "px-3 py-2"}`}>
                                    Top 10/30/100
                                    <div className="mt-1 font-semibold text-app-text">
                                      {insight.top10}/{insight.top30}/{insight.top100}
                                    </div>
                                  </div>
                                  <div className={`rounded-xl border border-app-border/50 bg-app-surface-muted/60 text-app-text-muted ${isMobileViewport ? "px-2.5 py-1.5" : "px-3 py-2"}`}>
                                    Avg rank
                                    <div className="mt-1 font-semibold text-app-text">
                                      {insight.averageRank ? `#${insight.averageRank}` : "No data"}
                                    </div>
                                  </div>
                                </div>
                                <p className={`${isMobileViewport ? "mt-2 line-clamp-1" : "mt-3"} text-xs text-app-text-muted`}>
                                  Best rank:{" "}
                                  <span className="font-semibold text-app-text">
                                    {insight.strongestKeyword
                                      ? `${insight.strongestKeyword.keyword} (#${insight.strongestKeyword.rank})`
                                      : "None yet"}
                                  </span>
                                </p>
                              </div>
                            ))}
                          </div>
                          <div className={`rounded-2xl border border-app-border/60 bg-app-surface-muted/65 shadow-[inset_0_1px_0_rgba(148,163,184,0.05)] ${isMobileViewport ? "p-2" : "p-4"}`}>
                            <div className={`flex flex-col ${isMobileViewport ? "gap-2.5" : "gap-3"} xl:flex-row xl:items-start xl:justify-between`}>
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/70">
                                  Select Keywords to Track
                                </p>
                                <p className={`${isMobileViewport ? "mt-1 text-[11px] line-clamp-2" : "mt-2 text-sm"} text-app-text-muted`}>
                                  Add from keywords both apps rank for, or search
                                  any keyword and check both apps before tracking it.
                                </p>
                                <p className={`${isMobileViewport ? "mt-1" : "mt-2"} text-xs text-app-text-muted`}>
                                  {competitorDraftTrackingHint}
                                </p>
                                <p className={`${isMobileViewport ? "mt-0.5 text-[10px]" : "mt-1 text-[11px]"} text-cyan-200/80`}>
                                  Tracking creates or updates the matching competitor group automatically.
                                </p>
                              </div>
                              <div className={`flex w-full max-w-xl flex-col ${isMobileViewport ? "gap-1.5" : "gap-2"} sm:flex-row`}>
                                <div className="relative flex-1">
                                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted" />
                                  <input
                                    type="text"
                                    value={competitorDraftKeywordSearch}
                                    onChange={(event) =>
                                      setCompetitorDraftKeywordSearch(
                                        event.target.value,
                                      )
                                    }
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        void searchCompetitorDraftKeyword();
                                      }
                                    }}
                                    placeholder="Search a keyword for both apps"
                                    className={`w-full rounded-xl border border-app-border/60 bg-app-surface/70 pl-9 pr-3 text-app-text outline-none transition-colors placeholder:text-app-text-muted focus:border-cyan-400/30 ${isMobileViewport ? "py-1.5 text-[12px]" : "py-2 sm:py-2.5 text-[13px] sm:text-sm"}`}
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void searchCompetitorDraftKeyword()}
                                  disabled={
                                    isCheckingCompetitorDraftKeyword ||
                                    !competitorDraftOwnApp ||
                                    competitorDraftApps.length === 0 ||
                                    !competitorDraftKeywordSearch.trim()
                                  }
                                  className={`rounded-xl border border-app-border/70 bg-app-surface-muted/80 font-semibold text-app-text transition-colors hover:border-cyan-400/30 hover:bg-app-surface-muted disabled:opacity-40 ${isMobileViewport ? "px-3 py-1.5 text-[12px]" : "px-4 py-2 sm:py-2.5 text-[13px] sm:text-sm"}`}
                                >
                                  {isCheckingCompetitorDraftKeyword ? (
                                    <span className="inline-flex items-center gap-2">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Checking
                                    </span>
                                  ) : (
                                    "Check Keyword"
                                  )}
                                </button>
                              </div>
                            </div>
                            <div className={`flex flex-wrap ${isMobileViewport ? "mt-2 gap-1.5" : "mt-4 gap-2"}`}>
                              {competitorDraftSelectedKeywords.length > 0 ? (
                                competitorDraftSelectedKeywords.map((selection) => (
                                  <button
                                    key={`selected-${selection.keyword}`}
                                    type="button"
                                    onClick={() =>
                                      removeCompetitorDraftKeyword(selection.keyword)
                                    }
                                    className={`inline-flex items-center gap-1.5 rounded-full border border-app-border/70 bg-app-surface-muted/80 font-semibold text-app-text transition-colors hover:border-cyan-400/30 hover:bg-app-surface-muted ${isMobileViewport ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"}`}
                                  >
                                    {selection.keyword} · {selection.selectedCountries.length}{" "}
                                    {selection.selectedCountries.length === 1
                                      ? "country"
                                      : "countries"}
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                ))
                              ) : (
                                <p className={`${isMobileViewport ? "text-[12px]" : "text-sm"} text-app-text-muted`}>
                                  No keywords selected yet.
                                </p>
                              )}
                            </div>
                            <div className={`${isMobileViewport ? "mt-2.5 space-y-1.5" : "mt-5 space-y-3"}`}>
                              {competitorDraftKeywordCandidates.length > 0 ? (
                                competitorDraftKeywordCandidates.map((candidate) => {
                                  const trackedCountries =
                                    competitorDraftTrackedCountryMap.get(
                                      candidate.keyword.trim().toLowerCase(),
                                    ) || [];
                                  const activeSelection =
                                    competitorDraftSelectedKeywords.find(
                                      (entry) =>
                                        entry.keyword.trim().toLowerCase() ===
                                        candidate.keyword.trim().toLowerCase(),
                                    ) || null;
                                  return (
                                    <div
                                      key={`${candidate.source}:${candidate.keyword}`}
                                      className={`rounded-2xl border border-app-border/50 bg-app-surface/45 ${isMobileViewport ? "p-2" : "p-4"}`}
                                    >
                                      <div className={`flex flex-col lg:flex-row lg:items-start lg:justify-between ${isMobileViewport ? "gap-2" : "gap-3"}`}>
                                        <div>
                                          <div className={`flex flex-wrap items-center ${isMobileViewport ? "gap-1.5" : "gap-2"}`}>
                                            <p className={`${isMobileViewport ? "text-[13px]" : "text-sm"} font-semibold text-slate-900 dark:text-app-text`}>
                                              {candidate.keyword}
                                            </p>
                                            {candidate.source === "search" && (
                                              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                                                Searched
                                              </span>
                                            )}
                                            {candidate.source === "shared" && (
                                              <span className="rounded-full border border-sky-300 bg-sky-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-600 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-200">
                                                Shared Keyword
                                              </span>
                                            )}
                                            {candidate.source === "own_win" && (
                                              <span className="rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-200">
                                                Your Win
                                              </span>
                                            )}
                                            {candidate.source === "competitor_win" && (
                                              <span className="rounded-full border border-violet-300 bg-violet-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-600 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-200">
                                                Competitor Win
                                              </span>
                                            )}
                                            {candidate.source === "gap" && (
                                              <span className="rounded-full border border-fuchsia-300 bg-fuchsia-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-fuchsia-600 dark:border-fuchsia-500/20 dark:bg-fuchsia-500/10 dark:text-fuchsia-200">
                                                Opportunity
                                              </span>
                                            )}
                                            {activeSelection && (
                                              <span className="rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:border-cyan-500/20 dark:bg-cyan-500/10 dark:text-cyan-200">
                                                {activeSelection.selectedCountries.length}{" "}
                                                {activeSelection.selectedCountries.length === 1
                                                  ? "country"
                                                  : "countries"}
                                              </span>
                                            )}
                                            {!activeSelection && trackedCountries.length > 0 && (
                                              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
                                                Already tracking
                                              </span>
                                            )}
                                          </div>
                                          <p className={`text-xs text-app-text-muted ${isMobileViewport ? "mt-0.5 line-clamp-2" : "mt-1"}`}>
                                            {candidate.detail}
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openCompetitorDraftKeywordCountryPicker(
                                              candidate.keyword,
                                            )
                                          }
                                          className={`rounded-lg border font-semibold transition-colors ${isMobileViewport ? "px-2 py-1 text-[9px]" : "px-3 py-2 text-[11px]"} ${activeSelection ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-200" : "border-app-border/70 bg-app-surface-muted/80 text-app-text hover:border-cyan-400/30 hover:bg-app-surface-muted"}`}
                                        >
                                          {activeSelection
                                                ? "Edit Countries"
                                            : trackedCountries.length > 0
                                              ? "Track in More Countries"
                                              : "Track Keyword"}
                                        </button>
                                      </div>
                                      <div className={`grid gap-1.5 md:grid-cols-2 ${isMobileViewport ? "mt-1.5" : "mt-3"}`}>
                                        {candidate.apps.map((app) => {
                                          const rankDisplay = getTrackedRankDisplay({
                                            groupId: "draft",
                                            keyword: candidate.keyword,
                                            appId: app.appKey,
                                            appTitle: app.title,
                                            store: storeType,
                                            country,
                                            lastRank: app.lastRank,
                                            lastChecked: competitorDraftAnalysis.loadedAt,
                                            lastCheckStatus: app.lastCheckStatus,
                                            lastError: app.lastError,
                                          });
                                          return (
                                            <div
                                              key={`${candidate.keyword}:${app.appKey}`}
                                              className={`rounded-xl border ${isMobileViewport ? "px-2 py-1.5" : "px-3 py-3"} ${app.role === "own" ? "border-cyan-400/20 bg-app-surface-muted/75 ring-1 ring-inset ring-cyan-300/10" : "border-app-border/50 bg-app-surface-muted/60"}`}
                                            >
                                              <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                  <p className={`${isMobileViewport ? "text-[11px]" : "text-xs"} truncate font-semibold text-app-text`}>
                                                    {app.title}
                                                  </p>
                                                  <p className={`${isMobileViewport ? "mt-0.5" : "mt-1"} text-[10px] uppercase tracking-[0.18em] text-app-text-muted`}>
                                                    {app.role === "own"
                                                      ? "Your app"
                                                      : "Rival"}
                                                  </p>
                                                </div>
                                                <p
                                                  className={`${isMobileViewport ? "text-[13px]" : "text-sm"} font-display font-bold ${rankDisplay.className}`}
                                                >
                                                  {rankDisplay.label}
                                                </p>
                                              </div>
                                              {app.lastCheckStatus === "error" &&
                                                app.lastError && (
                                                  <p className="mt-2 rounded-lg bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300">
                                                    {app.lastError}
                                                  </p>
                                                )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className="rounded-2xl border border-dashed border-app-border/60 bg-app-surface/35 px-4 py-8 text-center">
                                  <p className="text-sm font-medium text-app-text-muted">
                                    No shared ranked keywords surfaced yet.
                                  </p>
                                  <p className="mt-1 text-sm text-app-text-muted">
                                    Search any keyword above to check both apps
                                    and add it to this group.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-app-border/60 bg-app-surface/35 px-4 py-8 text-center">
                          <p className="text-sm font-medium text-app-text-muted">
                            Run analysis to load keyword battles for this comparison.
                          </p>
                          <p className="mt-1 text-sm text-app-text-muted">
                            Detailed movement history appears after you start tracking.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  </div>
                </div>
              ) : null}

              {competitorWorkspaceTab === "saved" && (
                <div
                  id="competitor-panel-saved"
                  role="tabpanel"
                  aria-labelledby="competitor-tab-saved"
                  tabIndex={0}
                  className={isMobileViewport ? "space-y-2.5" : "space-y-3"}
                >
                  {competitorDashboardCards.length === 0 ? (
                    <WorkspaceEmptyBlock
                      icon={Globe}
                      title="No tracked competitor groups yet"
                      description="Discover your app and one rival, analyze the pair, then track a keyword to create a group here."
                    />
                  ) : (
                <div className={`grid min-w-0 ${isMobileViewport ? "gap-3" : "gap-5"}`}>
                  {competitorDashboardCards.map((card) => {
                    const competitorLinePalette = [
                      "var(--color-brand-hover)",
                      "var(--color-comparison)",
                      "var(--color-success)",
                    ];
                    const isExpanded = expandedCompetitorGroupIds.includes(
                      card.group.groupId,
                    );
                    const compactGroupContext = [
                      card.group.store === "ios" ? "iOS" : "Android",
                      card.group.country.toUpperCase(),
                      card.group.mode.toUpperCase(),
                    ].join(" · ");
                    const compactGroupStatus = `${card.trackedKeywords.length} keyword${
                      card.trackedKeywords.length === 1 ? "" : "s"
                    } tracked · updated ${
                      card.lastKeywordRefreshAt
                        ? formatTrackingChartDateTime(card.lastKeywordRefreshAt)
                        : card.group.lastAnalyzedAt
                          ? formatTrackingChartDateTime(card.group.lastAnalyzedAt)
                          : "not started"
                    }`;
                    const groupAsoDiffs =
                      competitorAsoDiffsByGroupId.get(card.group.groupId) || [];
                    const groupAsoSnapshots = card.asoLatestSnapshots;
                    const asoFieldFilter =
                      competitorAsoFieldFilterByGroup[card.group.groupId] ||
                      "all";
                    const asoCountryFilter =
                      competitorAsoCountryFilterByGroup[card.group.groupId] ||
                      "all";
                    const asoAppFilter =
                      competitorAsoAppFilterByGroup[card.group.groupId] || "all";
                    const groupAsoTrackedCountries = Array.from(
                      new Set([
                        card.group.country,
                        ...card.trackedKeywords.map(
                          (trackedKeyword) => trackedKeyword.country,
                        ),
                      ]),
                    ).sort((a, b) => a.localeCompare(b));
                    const groupAsoCountries = Array.from(
                      new Set([
                        ...groupAsoTrackedCountries,
                        ...groupAsoSnapshots.map((snapshot) => snapshot.country),
                        ...groupAsoDiffs.map((diff) => diff.country),
                      ]),
                    ).sort((a, b) => a.localeCompare(b));
                    const filteredGroupAsoDiffs = groupAsoDiffs
                      .filter((diff) =>
                        asoFieldFilter === "all"
                          ? true
                          : diff.changedFields.includes(asoFieldFilter),
                      )
                      .filter((diff) => {
                        if (
                          asoCountryFilter !== "all" &&
                          diff.country !== asoCountryFilter
                        ) {
                          return false;
                        }
                        if (asoAppFilter !== "all" && diff.appId !== asoAppFilter) {
                          return false;
                        }
                        return true;
                      });
                    const groupAsoChangedApps = new Set(
                      groupAsoDiffs.map((diff) => diff.appId),
                    );
                    const groupAsoChangedCountries = new Set(
                      groupAsoDiffs.map((diff) => diff.country),
                    );
                    const groupAsoSnapshotCount = groupAsoSnapshots.length;
                    const groupAsoExpectedSnapshotCount =
                      card.group.competitors.length * groupAsoTrackedCountries.length;
                    const hasCompleteAsoBaseline =
                      groupAsoExpectedSnapshotCount > 0 &&
                      groupAsoSnapshotCount >= groupAsoExpectedSnapshotCount;
                    const groupAsoLatestSnapshotAt =
                      groupAsoSnapshots[0]?.capturedAt || null;
                    const groupAsoFieldCounts =
                      groupAsoDiffs.reduce<Record<CompetitorAsoFieldName, number>>(
                        (counts, diff) => {
                          diff.changedFields.forEach((field) => {
                            counts[field] += 1;
                          });
                          return counts;
                        },
                        {
                          title: 0,
                          description: 0,
                          icon: 0,
                          category: 0,
                          screenshots: 0,
                        },
                      );
                    const groupAsoChangedFieldEntries = (
                      [
                        "title",
                        "description",
                        "screenshots",
                        "icon",
                        "category",
                      ] as CompetitorAsoFieldName[]
                    )
                      .map((field) => ({
                        field,
                        count: groupAsoFieldCounts[field],
                      }))
                      .filter((entry) => entry.count > 0)
                      .sort(
                        (a, b) =>
                          b.count - a.count ||
                          getCompetitorAsoFieldLabel(a.field).localeCompare(
                            getCompetitorAsoFieldLabel(b.field),
                          ),
                      );
                    const groupAsoChangedFieldSummary =
                      groupAsoChangedFieldEntries.length > 0
                        ? groupAsoChangedFieldEntries
                            .slice(0, 3)
                            .map((entry) => getCompetitorAsoFieldLabel(entry.field))
                            .join(", ")
                        : null;
                    const groupAsoStatus =
                      groupAsoDiffs.length > 0
                        ? {
                            tone: "border-emerald-500/20 bg-emerald-500/10 text-emerald-100",
                            title: "Changes detected",
                            message:
                              groupAsoChangedFieldSummary
                                ? `Recent ASO metadata changes were detected for this competitor group: ${groupAsoChangedFieldSummary}.`
                                : "Recent ASO metadata changes were detected for this competitor group.",
                          }
                        : groupAsoSnapshotCount === 0
                          ? {
                              tone: "border-app-border/60 bg-app-surface/40 text-app-text-muted",
                              title: "Baseline pending",
                              message:
                                "The first daily ASO run still needs to capture the initial store snapshot.",
                          }
                          : !hasCompleteAsoBaseline
                            ? {
                                tone: "border-cyan-500/20 bg-cyan-500/10 text-cyan-100",
                                title: "Baseline in progress",
                                message:
                                  `Captured ${groupAsoSnapshotCount}/${groupAsoExpectedSnapshotCount || 1} ASO baseline snapshots. Comparison starts after all current targets have a baseline.`,
                              }
                            : {
                                tone: "border-app-border/60 bg-app-surface/40 text-app-text-muted",
                                title: "Baseline captured",
                                message:
                                  "Monitoring is active. New rows appear when a later run detects store metadata changes.",
                              };
                    return (
                      <div
                        key={card.group.groupId}
                        className={`competitor-group-card min-w-0 border border-app-border/80 bg-app-surface-muted/75 shadow-xl shadow-black/25 ring-1 ring-inset ring-slate-400/10 ${isMobileViewport ? "rounded-2xl" : "rounded-3xl"}`}
                      >
                        <div className={`competitor-group-header border-b border-app-border/70 bg-app-surface-muted/35 ${isMobileViewport ? "px-2.5 py-2.5" : "px-5 py-5"}`}>
                          <div className={`flex flex-col ${isMobileViewport ? "gap-2" : "gap-4"} lg:flex-row lg:items-start lg:justify-between`}>
                            <div className="min-w-0">
                              <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                <h3 className="competitor-group-title max-w-full truncate text-base font-semibold text-app-text">
                                  {getCompetitorGroupLabel(card.group)}
                                </h3>
                                <span className="hidden rounded-full border border-app-border/70 bg-app-surface-muted/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100 sm:inline-flex">
                                  {card.group.store === "ios" ? "iOS" : "Android"}
                                </span>
                                <span className="hidden rounded-full border border-app-border/60 bg-app-surface-muted/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-app-text-muted sm:inline-flex">
                                  {card.group.country.toUpperCase()}
                                </span>
                                <span className="hidden rounded-full border border-app-border/70 bg-app-surface-muted/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-app-text-muted sm:inline-flex">
                                  {card.group.mode}
                                </span>
                              </div>
                              <p className="mt-1 text-[12px] text-app-text-muted sm:hidden">
                                {compactGroupContext}
                              </p>
                              <p className="mt-0.5 text-[11px] text-app-text-muted sm:hidden">
                                {compactGroupStatus}
                              </p>
                              <p className="mt-2 hidden text-sm text-app-text-muted sm:block">
                                Last analyzed{" "}
                                {card.group.lastAnalyzedAt
                                  ? formatTrackingChartDateTime(card.group.lastAnalyzedAt)
                                  : "not yet"}
                              </p>
                              <p className="mt-1 hidden text-xs text-app-text-muted sm:block">
                                Keyword refresh{" "}
                                {card.lastKeywordRefreshAt
                                  ? formatTrackingChartDateTime(
                                      card.lastKeywordRefreshAt,
                                    )
                                  : "not started"}
                              </p>
                            </div>
                            <div className={`competitor-group-actions flex flex-wrap items-center ${isMobileViewport ? "gap-1" : "gap-2"}`}>
                              <button
                                type="button"
                                onClick={() =>
                                  toggleCompetitorGroupExpansion(
                                    card.group.groupId,
                                  )
                                }
                                className={`competitor-group-action inline-flex items-center justify-center gap-2 rounded-xl border border-app-border/60 bg-app-surface-muted/70 font-semibold text-app-text transition-colors hover:bg-app-surface-muted/80 ${isMobileViewport ? "px-2.5 py-1.5 text-[10px]" : "px-3 py-2 text-xs"}`}
                              >
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                />
                                {isExpanded ? "Close Group" : "Open Group"}
                              </button>
                              <details className="workspace-more-menu">
                                <summary
                                  className={`competitor-group-action inline-flex cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-app-border/60 bg-app-surface-muted/70 font-semibold text-app-text transition-colors hover:bg-app-surface-muted/80 ${isMobileViewport ? "px-2.5 py-1.5 text-[10px]" : "px-3 py-2 text-xs"}`}
                                  aria-label={`More actions for ${getCompetitorGroupLabel(card.group)}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span>More</span>
                                </summary>
                                <div className="workspace-more-menu-popover">
                                  <button
                                    type="button"
                                    onClick={() => void refreshCompetitorGroup(card.group)}
                                    className="workspace-more-menu-item"
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                    Reanalyze
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setExpandedCompetitorGroupIds((prev) =>
                                        prev.includes(card.group.groupId)
                                          ? prev
                                          : [...prev, card.group.groupId],
                                      );
                                      requestAnimationFrame(() => {
                                        document
                                          .getElementById(
                                            `competitor-tracked-keywords-${card.group.groupId}`,
                                          )
                                          ?.scrollIntoView({
                                            behavior: "smooth",
                                            block: "start",
                                          });
                                      });
                                    }}
                                    className="workspace-more-menu-item"
                                  >
                                    <BookOpen className="h-4 w-4" />
                                    Edit Tracked Keywords
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setActiveCompetitorAsoAlertGroupId(
                                        card.group.groupId,
                                      )
                                    }
                                    className="workspace-more-menu-item"
                                  >
                                    <Bell className="h-4 w-4" />
                                    ASO Alerts
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeCompetitorGroup(card.group.groupId)
                                    }
                                    className="workspace-more-menu-item workspace-more-menu-item-danger"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Remove Group
                                  </button>
                                </div>
                              </details>
                            </div>
                          </div>
                        </div>

                        <div className={`competitor-group-body ${isMobileViewport ? "space-y-2.5 p-2.5" : "space-y-4 p-5"}`}>
                          {!isExpanded ? (
                            <div className={`rounded-2xl border border-app-border/70 bg-app-surface-muted/55 text-app-text-muted shadow-[inset_0_1px_0_rgba(148,163,184,0.05)] ${isMobileViewport ? "px-2.5 py-2 text-[11px]" : "px-4 py-4 text-sm"}`}>
                              {1 + card.group.competitors.length} apps,{" "}
                              {card.trackedKeywords.length} tracked keywords,{" "}
                              {card.rankedPairCount} ranked pairs.
                            </div>
                          ) : (
                            <>
                          <div className={`competitor-group-section rounded-2xl border border-app-border/75 bg-app-surface-muted/60 shadow-[inset_0_1px_0_rgba(148,163,184,0.06)] ${isMobileViewport ? "px-3 py-3" : "px-4 py-4"}`}>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                              Group Apps
                            </p>
                            <div className={`competitor-app-roster ${isMobileViewport ? "mt-2 grid gap-2" : "mt-3 grid gap-3"} md:grid-cols-3`}>
                              {[card.group.ownApp, ...card.group.competitors].map((app) => (
                                <div
                                  key={`${card.group.groupId}:${app.appKey}`}
                                  className={`competitor-app-card rounded-2xl border shadow-[inset_0_1px_0_rgba(148,163,184,0.05)] ${isMobileViewport ? "p-2.5" : "p-3"} ${app.role === "own" ? "border-cyan-400/20 bg-app-surface-muted/75 ring-1 ring-inset ring-cyan-300/10" : "border-app-border/70 bg-app-surface/70"}`}
                                >
                                  <div className={`flex items-start ${isMobileViewport ? "gap-2.5" : "gap-3"}`}>
                                    <img
                                      src={app.icon}
                                      alt={app.title}
                                      className="h-9 w-9 rounded-xl border border-app-border/60 bg-app-surface-muted/80 sm:h-11 sm:w-11"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold text-app-text">
                                        {app.title}
                                      </p>
                                      <p className="truncate text-xs text-app-text-muted">
                                        {app.developer}
                                      </p>
                                      <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-app-text-muted sm:text-[11px]">
                                        {app.role === "own" ? "Your app" : "Competitor"}
                                      </p>
                                    </div>
                                  </div>
                                  {app.url && (
                                    <a
                                      href={app.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-app-text-muted transition-colors hover:text-cyan-100 sm:mt-3"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" />
                                      <span className="sm:hidden">Store</span>
                                      <span className="hidden sm:inline">Open Store</span>
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className={`competitor-group-section rounded-2xl border border-app-border/60 bg-app-surface-muted/65 shadow-[inset_0_1px_0_rgba(148,163,184,0.05)] ${isMobileViewport ? "px-3 py-3" : "px-4 py-4"}`}>
                            <div className={`flex flex-col ${isMobileViewport ? "gap-2" : "gap-3"} md:flex-row md:items-start md:justify-between`}>
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/70">
                                  Daily ASO Changes
                                </p>
                                <p className="mt-2 hidden text-sm text-app-text-muted sm:block">
                                  Review title, description, icon, category, and
                                  screenshot changes detected for this
                                  competitor set.
                                </p>
                              </div>
                              <div className={`competitor-aso-actions flex flex-wrap ${isMobileViewport ? "gap-1.5" : "gap-2"}`}>
                                <span className={`rounded-full border border-app-border/60 bg-app-surface/60 font-semibold text-app-text ${isMobileViewport ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"}`}>
                                  {groupAsoDiffs.length} changes logged
                                </span>
                                <span className={`rounded-full border border-app-border/60 bg-app-surface/60 font-semibold text-app-text ${isMobileViewport ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"}`}>
                                  {groupAsoSnapshotCount} snapshots
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setActiveCompetitorAsoAlertGroupId(
                                      card.group.groupId,
                                    )
                                  }
                                  className={`rounded-full border border-cyan-500/25 bg-cyan-500/10 font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/20 ${isMobileViewport ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"}`}
                                >
                                  <span className="sm:hidden">Alerts</span>
                                  <span className="hidden sm:inline">Manage ASO Alerts</span>
                                </button>
                              </div>
                            </div>
                            <div className="competitor-aso-metrics mt-4 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-4">
                              <div className="workspace-metric-card flex flex-col p-3 sm:p-5">
                                <div className="workspace-chip-label mb-1 !text-[10px] sm:!text-[11px]">
                                  Total Changes
                                </div>
                                <div className="workspace-metric-value !text-xl sm:!text-3xl">
                                  {groupAsoDiffs.length}
                                </div>
                              </div>
                              <div className="workspace-metric-card flex flex-col p-3 sm:p-5">
                                <div className="workspace-chip-label mb-1 !text-[10px] sm:!text-[11px]">
                                  Changed Apps
                                </div>
                                <div className="workspace-metric-value !text-xl sm:!text-3xl">
                                  {groupAsoChangedApps.size}
                                </div>
                              </div>
                              <div className="workspace-metric-card flex flex-col p-3 sm:p-5">
                                <div className="workspace-chip-label mb-1 !text-[10px] sm:!text-[11px]">
                                  Countries
                                </div>
                                <div className="workspace-metric-value !text-xl sm:!text-3xl">
                                  {groupAsoChangedCountries.size}
                                </div>
                              </div>
                              <div className="workspace-metric-card flex flex-col p-3 sm:p-5">
                                <div className="workspace-chip-label mb-1 !text-[10px] sm:!text-[11px]">
                                  Last Snapshot
                                </div>
                                <div className="workspace-metric-value !text-[14px] sm:!text-[16px] lg:!text-lg">
                                  {groupAsoLatestSnapshotAt
                                    ? formatTrackingChartDateTime(
                                        groupAsoLatestSnapshotAt,
                                      )
                                    : "—"}
                                </div>
                                <div className="workspace-metric-hint mt-auto line-clamp-2 pt-1.5 !text-[10px] leading-tight sm:pt-2 sm:!text-xs">
                                  {groupAsoDiffs[0]
                                    ? `Latest change ${formatTrackingChartDateTime(
                                        groupAsoDiffs[0].detectedAt,
                                      )}`
                                    : groupAsoSnapshotCount === 0
                                      ? "No baseline captured yet"
                                      : !hasCompleteAsoBaseline
                                        ? `${groupAsoSnapshotCount}/${groupAsoExpectedSnapshotCount || 1} baselines captured`
                                        : "No recent changes detected"}
                                </div>
                              </div>
                            </div>
                            <div
                              className={`competitor-aso-status mt-4 rounded-2xl border px-4 py-3 text-sm ${groupAsoDiffs.length === 0 ? "hidden sm:block" : ""} ${groupAsoStatus.tone}`}
                            >
                              <span className="font-semibold">
                                {groupAsoStatus.title}.
                              </span>{" "}
                              {groupAsoStatus.message}
                            </div>
                            {groupAsoChangedFieldEntries.length > 0 ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {groupAsoChangedFieldEntries.map((entry) => (
                                  <span
                                    key={`${card.group.groupId}:aso-field:${entry.field}`}
                                    className="rounded-full border border-app-border/60 bg-app-surface/60 px-3 py-1.5 text-[11px] font-semibold text-app-text"
                                  >
                                    {getCompetitorAsoFieldLabel(entry.field)}{" "}
                                    <span className="text-app-text-muted">
                                      {entry.count}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            <div
                              className={`competitor-aso-filters mt-4 grid gap-3 xl:grid-cols-[220px_220px_minmax(0,1fr)] ${groupAsoDiffs.length === 0 ? "hidden sm:grid" : ""}`}
                            >
                              <select
                                value={asoAppFilter}
                                onChange={(event) =>
                                  setCompetitorAsoAppFilterByGroup((prev) => ({
                                    ...prev,
                                    [card.group.groupId]: event.target.value,
                                  }))
                                }
                                className="input-field py-2.5"
                              >
                                <option value="all">All competitor apps</option>
                                {card.group.competitors.map((app) => (
                                  <option key={app.appId} value={app.appId}>
                                    {app.title}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={asoCountryFilter}
                                onChange={(event) =>
                                  setCompetitorAsoCountryFilterByGroup((prev) => ({
                                    ...prev,
                                    [card.group.groupId]: event.target.value,
                                  }))
                                }
                                className="input-field py-2.5"
                              >
                                <option value="all">All countries</option>
                                {groupAsoCountries.map((countryCode) => (
                                  <option key={countryCode} value={countryCode}>
                                    {findCountryName(countryCode) ||
                                      countryCode.toUpperCase()}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={asoFieldFilter}
                                onChange={(event) =>
                                  setCompetitorAsoFieldFilterByGroup((prev) => ({
                                    ...prev,
                                    [card.group.groupId]:
                                      event.target.value === "all"
                                        ? "all"
                                        : (event.target.value as CompetitorAsoFieldName),
                                  }))
                                }
                                className="input-field py-2.5"
                              >
                                <option value="all">All change types</option>
                                {(
                                  [
                                    "title",
                                    "description",
                                    "screenshots",
                                    "icon",
                                    "category",
                                  ] as CompetitorAsoFieldName[]
                                ).map((field) => (
                                  <option key={field} value={field}>
                                    {getCompetitorAsoFieldLabel(field)}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {competitorAsoHistoryError ? (
                              <div className="competitor-aso-empty mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                                {competitorAsoHistoryError}
                              </div>
                            ) : null}
                            {isLoadingCompetitorAsoHistory ? (
                              <div className="competitor-aso-empty mt-4 rounded-2xl border border-app-border/60 bg-app-surface/40 px-4 py-6 text-sm text-app-text-muted">
                                Loading competitor ASO change history...
                              </div>
                            ) : filteredGroupAsoDiffs.length === 0 ? (
                              <div className="competitor-aso-empty mt-4 rounded-2xl border border-dashed border-app-border/60 bg-app-surface/40 px-4 py-6 text-sm text-app-text-muted">
                                {groupAsoDiffs.length === 0
                                  ? groupAsoSnapshotCount === 0
                                    ? "Baseline not captured yet. The first ASO snapshot will appear after the next scheduled monitoring run."
                                    : groupAsoSnapshotCount === 1
                                      ? "Baseline captured. The next scheduled monitoring run will create the first ASO change alert entry."
                                      : "No ASO changes detected yet for this group. New rows appear only when store metadata changes."
                                  : "No ASO changes match the current filters."}
                              </div>
                            ) : (
                              <div className="workspace-panel competitor-aso-diff-table mt-4 overflow-hidden !p-0">
                                <div className="competitor-aso-diff-header grid min-w-[720px] grid-cols-[140px_170px_110px_minmax(0,150px)_minmax(0,1fr)] gap-3 border-b border-app-border/60 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                                  <div>Detected</div>
                                  <div>App</div>
                                  <div>Country</div>
                                  <div>Fields</div>
                                  <div>Details</div>
                                </div>
                                <div className="max-h-[28rem] overflow-y-auto">
                                  {filteredGroupAsoDiffs.map((diff) => (
                                    <div
                                      key={diff.diffId}
                                      className="competitor-aso-diff-row grid min-w-[720px] grid-cols-[140px_170px_110px_minmax(0,150px)_minmax(0,1fr)] gap-3 border-b border-app-border/80 px-4 py-3 text-sm text-app-text-muted last:border-b-0"
                                    >
                                      <div className="competitor-aso-diff-detected text-xs text-app-text-muted">
                                        {formatTrackingChartDateTime(
                                          diff.detectedAt,
                                        )}
                                      </div>
                                      <div className="competitor-aso-diff-app min-w-0">
                                        <p className="truncate font-semibold text-app-text">
                                          {diff.appTitle}
                                        </p>
                                      </div>
                                      <div className="competitor-aso-diff-country text-xs font-semibold uppercase tracking-[0.16em] text-app-text-muted">
                                        {diff.country}
                                      </div>
                                      <div className="competitor-aso-diff-fields flex flex-wrap gap-1">
                                        {diff.changedFields.map((field) => (
                                          <span
                                            key={`${diff.diffId}:${field}`}
                                            className="inline-flex self-start rounded-full border border-app-border/60 bg-app-surface-muted/70 px-2 py-1 text-[10px] font-semibold text-app-text"
                                          >
                                            {getCompetitorAsoFieldLabel(field)}
                                          </span>
                                        ))}
                                      </div>
                                      <div className="competitor-aso-diff-details min-w-0 space-y-2">
                                        {diff.changes.map((change) => (
                                          <div
                                            key={`${diff.diffId}:${change.field}`}
                                            className="rounded-xl border border-app-border/80 bg-app-surface-muted/60 px-3 py-2"
                                          >
                                            <div className="text-[11px] font-semibold text-app-text">
                                              {getCompetitorAsoFieldLabel(
                                                change.field,
                                              )}
                                            </div>
                                            <div className="mt-1 text-[11px] text-app-text-muted">
                                              {change.summary}
                                            </div>
                                            <div className="mt-2 grid gap-2 md:grid-cols-2">
                                              <div>
                                                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-app-text-muted">
                                                  Previous
                                                </div>
                                                <div className="mt-1 text-[11px] text-app-text-muted">
                                                  {formatCompetitorAsoValue(
                                                    change.field,
                                                    change.previousValue,
                                                  )}
                                                </div>
                                                {change.field ===
                                                  "screenshots" &&
                                                getCompetitorAsoScreenshotPreviewList(
                                                  change.previousValue,
                                                ).length > 0 ? (
                                                  <div className="mt-2 flex flex-wrap gap-2">
                                                    {getCompetitorAsoScreenshotPreviewList(
                                                      change.previousValue,
                                                    ).map((src, index) => (
                                                      <img
                                                        key={`${diff.diffId}:${change.field}:previous:${index}`}
                                                        src={src}
                                                        alt=""
                                                        loading="lazy"
                                                        referrerPolicy="no-referrer"
                                                        className="h-16 w-9 rounded-lg border border-app-border/60 bg-app-surface object-cover"
                                                        onError={(event) => {
                                                          event.currentTarget.style.display =
                                                            "none";
                                                        }}
                                                      />
                                                    ))}
                                                  </div>
                                                ) : null}
                                              </div>
                                              <div>
                                                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-app-text-muted">
                                                  Current
                                                </div>
                                                <div className="mt-1 text-[11px] text-app-text-muted">
                                                  {formatCompetitorAsoValue(
                                                    change.field,
                                                    change.currentValue,
                                                  )}
                                                </div>
                                                {change.field ===
                                                  "screenshots" &&
                                                getCompetitorAsoScreenshotPreviewList(
                                                  change.currentValue,
                                                ).length > 0 ? (
                                                  <div className="mt-2 flex flex-wrap gap-2">
                                                    {getCompetitorAsoScreenshotPreviewList(
                                                      change.currentValue,
                                                    ).map((src, index) => (
                                                      <img
                                                        key={`${diff.diffId}:${change.field}:current:${index}`}
                                                        src={src}
                                                        alt=""
                                                        loading="lazy"
                                                        referrerPolicy="no-referrer"
                                                        className="h-16 w-9 rounded-lg border border-app-border/60 bg-app-surface object-cover"
                                                        onError={(event) => {
                                                          event.currentTarget.style.display =
                                                            "none";
                                                        }}
                                                      />
                                                    ))}
                                                  </div>
                                                ) : null}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div
                            id={`competitor-tracked-keywords-${card.group.groupId}`}
                            className="competitor-group-section rounded-2xl border border-app-border/60 bg-app-surface-muted/65 px-4 py-4 shadow-[inset_0_1px_0_rgba(148,163,184,0.05)]"
                          >
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/70">
                                  Tracked Group Keywords
                                </p>
                                <p className="mt-2 hidden text-sm text-app-text-muted sm:block">
                                  Each keyword keeps one shared chart with rank
                                  lines for every app in this battle group.
                                </p>
                              </div>
                              <span className="rounded-full border border-app-border/60 bg-app-surface/60 px-3 py-1.5 text-xs font-semibold text-app-text">
                                {card.trackedKeywordGroups.length} monitored
                              </span>
                            </div>
                            <div className="mt-4 rounded-2xl border border-app-border/60 bg-app-surface/40 p-3">
                              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/70">
                                    Search a keyword
                                  </p>
                                  <p className="mt-1 text-xs text-app-text-muted">
                                    Check any keyword across both apps, then add countries to start tracking it in this group.
                                  </p>
                                </div>
                                <div className="flex w-full max-w-xl flex-col gap-2 sm:flex-row">
                                  <div className="relative flex-1">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-text-muted" />
                                    <input
                                      type="text"
                                      value={competitorTrackedKeywordSearchByGroup[card.group.groupId] || ""}
                                      onChange={(event) =>
                                        setCompetitorTrackedKeywordSearchByGroup((prev) => ({
                                          ...prev,
                                          [card.group.groupId]: event.target.value,
                                        }))
                                      }
                                      onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                          event.preventDefault();
                                          void searchTrackedCompetitorGroupKeyword(card.group);
                                        }
                                      }}
                                      placeholder="Search a keyword for this group"
                                      className="w-full rounded-xl border border-app-border/60 bg-app-surface/70 py-2 pl-9 pr-3 text-[13px] text-app-text outline-none transition-colors placeholder:text-app-text-muted focus:border-cyan-400/30"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void searchTrackedCompetitorGroupKeyword(card.group)
                                    }
                                    disabled={
                                      isCheckingCompetitorTrackedKeywordByGroup[card.group.groupId] ||
                                      !(competitorTrackedKeywordSearchByGroup[card.group.groupId] || "").trim()
                                    }
                                    className="rounded-xl border border-app-border/70 bg-app-surface-muted/80 px-4 py-2 text-[13px] font-semibold text-app-text transition-colors hover:border-cyan-400/30 hover:bg-app-surface-muted disabled:opacity-40"
                                  >
                                    {isCheckingCompetitorTrackedKeywordByGroup[card.group.groupId] ? (
                                      <span className="inline-flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Checking
                                      </span>
                                    ) : (
                                      "Check Keyword"
                                    )}
                                  </button>
                                </div>
                              </div>
                              {(competitorTrackedKeywordSearchResultsByGroup[card.group.groupId] || []).length > 0 ? (
                                <div className="mt-3 space-y-2">
                                  {(competitorTrackedKeywordSearchResultsByGroup[card.group.groupId] || []).map((candidate) => (
                                    <div
                                      key={`${card.group.groupId}:${candidate.keyword}`}
                                      className="rounded-2xl border border-app-border/50 bg-app-surface/45 p-3"
                                    >
                                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                        <div>
                                          <div className="flex flex-wrap items-center gap-2">
                                            <p className="text-sm font-semibold text-app-text">
                                              {candidate.keyword}
                                            </p>
                                            <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-600 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                                              Searched
                                            </span>
                                          </div>
                                          <p className="mt-1 text-xs text-app-text-muted">
                                            {candidate.detail}
                                          </p>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openCompetitorTrackedKeywordCountryPicker({
                                              groupId: card.group.groupId,
                                              keyword: candidate.keyword,
                                            })
                                          }
                                          className="rounded-lg border border-app-border/70 bg-app-surface-muted/80 px-3 py-2 text-[11px] font-semibold text-app-text transition-colors hover:border-cyan-400/30 hover:bg-app-surface-muted"
                                        >
                                          Choose Countries
                                        </button>
                                      </div>
                                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                                        {candidate.apps.map((app) => {
                                          const rankDisplay = getTrackedRankDisplay({
                                            groupId: card.group.groupId,
                                            keyword: candidate.keyword,
                                            appId: app.appKey,
                                            appTitle: app.title,
                                            store: card.group.store,
                                            country: card.group.country,
                                            lastRank: app.lastRank,
                                            lastChecked: card.lastKeywordRefreshAt || card.group.lastAnalyzedAt || "",
                                            lastCheckStatus: app.lastCheckStatus,
                                            lastError: app.lastError,
                                          });
                                          return (
                                            <div
                                              key={`${card.group.groupId}:${candidate.keyword}:${app.appKey}`}
                                              className={`rounded-xl border px-3 py-3 ${app.role === "own" ? "border-cyan-400/20 bg-app-surface-muted/75 ring-1 ring-inset ring-cyan-300/10" : "border-app-border/50 bg-app-surface-muted/60"}`}
                                            >
                                              <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                  <p className="truncate text-xs font-semibold text-app-text">
                                                    {app.title}
                                                  </p>
                                                  <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-app-text-muted">
                                                    {app.role === "own" ? "Your app" : "Competitor"}
                                                  </p>
                                                </div>
                                                <p className={`text-sm font-display font-bold ${rankDisplay.className}`}>
                                                  {rankDisplay.label}
                                                </p>
                                              </div>
                                              {app.lastCheckStatus === "error" && app.lastError ? (
                                                <p className="mt-2 rounded-lg bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300">
                                                  {app.lastError}
                                                </p>
                                              ) : null}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            {card.trackedKeywordGroups.length > 0 ? (
                              <div className="mt-4 space-y-3">
                                {card.trackedKeywordGroups.map((keywordGroup) => {
                                  const keywordCardState =
                                    getCompetitorTrackedKeywordCardState({
                                      keywordGroup,
                                      workspaceCountry: country,
                                      selectedCountriesByGroup:
                                        competitorSummaryCountryByKeywordGroup,
                                    });
                                  const selectedCountryView =
                                    keywordCardState.selectedCountryView;
                                  const trackedKeyword =
                                    selectedCountryView?.trackedKeyword;
                                  const isExpanded =
                                    expandedCompetitorTrackedKeywordGroupKeys.includes(
                                      keywordGroup.groupKey,
                                    );
                                  if (!selectedCountryView || !trackedKeyword) {
                                    return null;
                                  }
                                  return (
                                    <div
                                      key={keywordGroup.groupKey}
                                      className="competitor-keyword-card rounded-2xl border border-app-border/80 border-l-2 border-l-cyan-400/25 bg-app-surface-muted/70 p-4 shadow-[inset_0_1px_0_rgba(148,163,184,0.05)]"
                                    >
                                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div>
                                          <p className="text-sm font-semibold text-app-text">
                                            {trackedKeyword.keyword}
                                          </p>
                                          <p className="mt-1 text-xs text-app-text-muted">
                                            {keywordGroup.countries.length}{" "}
                                            {keywordGroup.countries.length === 1
                                              ? "country scope"
                                              : "country scopes"}{" "}
                                            · Updated{" "}
                                            {trackedKeyword.lastCheckedAt
                                              ? formatTrackingChartDateTime(
                                                  trackedKeyword.lastCheckedAt,
                                                )
                                              : "pending"}
                                          </p>
                                        </div>
                                        <div className="competitor-keyword-actions flex flex-wrap items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setActiveCompetitorKeywordAlertGroupKey(
                                                keywordGroup.groupKey,
                                              )
                                            }
                                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-[11px] font-semibold text-cyan-200 transition-colors hover:border-cyan-400/45 hover:bg-cyan-500/15"
                                            aria-label={`Manage keyword alerts for ${keywordGroup.keyword}`}
                                            title="Manage keyword alerts"
                                          >
                                            <Bell className="h-3.5 w-3.5" />
                                            <span>Alerts</span>
                                          </button>
                                          {keywordCardState.showCountrySwitcher && (
                                            <select
                                              value={trackedKeyword.country}
                                              onChange={(event) =>
                                                setCompetitorSummaryCountry(
                                                  keywordGroup.groupKey,
                                                  event.target.value,
                                                )
                                              }
                                              className="rounded-lg border border-app-border/60 bg-app-surface-muted/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-app-text outline-none"
                                              aria-label={`Select competitor keyword country for ${trackedKeyword.keyword}`}
                                            >
                                              {keywordGroup.countryViews.map(
                                                (countryView) => (
                                                  <option
                                                    key={`${keywordGroup.groupKey}:${countryView.trackedKeyword.country}`}
                                                    value={
                                                      countryView.trackedKeyword
                                                        .country
                                                    }
                                                  >
                                                    {countryView.trackedKeyword.country.toUpperCase()}{" "}
                                                    -{" "}
                                                    {findCountryName(
                                                      countryView.trackedKeyword
                                                        .country,
                                                    )}
                                                  </option>
                                                ),
                                              )}
                                            </select>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              toggleExpandedCompetitorTrackedKeyword(
                                                keywordGroup.groupKey,
                                              )
                                            }
                                            className="rounded-lg border border-app-border/70 bg-app-surface-muted/80 px-3 py-2 text-[11px] font-semibold text-app-text transition-colors hover:border-cyan-400/30 hover:bg-app-surface-muted"
                                          >
                                            <span className="sm:hidden">
                                              {isExpanded ? "Hide" : "Chart"}
                                            </span>
                                            <span className="hidden sm:inline">
                                              {isExpanded ? "Hide Chart" : "Open Chart"}
                                            </span>
                                          </button>
                                          <details className="workspace-more-menu">
                                            <summary className="inline-flex min-h-[2.25rem] cursor-pointer list-none items-center justify-center gap-1.5 rounded-lg border border-app-border/70 bg-app-surface-muted/80 px-3 py-2 text-[11px] font-semibold text-app-text transition-colors hover:border-cyan-400/30 hover:bg-app-surface-muted">
                                              <MoreHorizontal className="h-3.5 w-3.5" />
                                              More
                                            </summary>
                                            <div className="workspace-more-menu-popover">
                                              {keywordCardState.showEditCountries && (
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    openCompetitorTrackedKeywordCountryPicker(
                                                      {
                                                        groupId: keywordGroup.groupId,
                                                        keyword: keywordGroup.keyword,
                                                      },
                                                    )
                                                  }
                                                  className="workspace-more-menu-item"
                                                  aria-label={`Edit tracked countries for ${keywordGroup.keyword}`}
                                                >
                                                  <Globe className="h-4 w-4" />
                                                  Edit Countries
                                                </button>
                                              )}
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  removeCompetitorTrackedKeywordFromGroup(
                                                    card.group.groupId,
                                                    trackedKeyword.trackedKeywordId,
                                                    trackedKeyword.keyword,
                                                    trackedKeyword.country,
                                                  )
                                                }
                                                className="workspace-more-menu-item workspace-more-menu-item-danger"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                                Remove
                                              </button>
                                            </div>
                                          </details>
                                        </div>
                                      </div>
                                      <div className="mt-3 flex flex-wrap items-center gap-2">
                                        {keywordGroup.countryViews.map(
                                          (countryView) => {
                                            const countrySummaryAppView =
                                              countryView.appHistoryViews.find(
                                                (view) =>
                                                  view.app.role === "own",
                                              ) ||
                                              countryView.appHistoryViews[0];
                                            const countryRankDisplay =
                                              getTrackedRankDisplay(
                                                countrySummaryAppView
                                                  ? {
                                                      groupId:
                                                        countryView.trackedKeyword.groupId,
                                                      keyword:
                                                        countryView.trackedKeyword.keyword,
                                                      appId:
                                                        countrySummaryAppView.app.appId,
                                                      appTitle:
                                                        countrySummaryAppView.app.title,
                                                      store:
                                                        countryView.trackedKeyword.store,
                                                      country:
                                                        countryView.trackedKeyword.country,
                                                      lastRank:
                                                        countrySummaryAppView.app.lastRank,
                                                      lastChecked:
                                                        countrySummaryAppView.app.lastChecked,
                                                      lastCheckStatus:
                                                        countrySummaryAppView.app.lastCheckStatus,
                                                      lastError:
                                                        countrySummaryAppView.app.lastError,
                                                    }
                                                  : {
                                                      groupId:
                                                        countryView.trackedKeyword.groupId,
                                                      keyword:
                                                        countryView.trackedKeyword.keyword,
                                                      appId: "",
                                                      appTitle: "",
                                                      store:
                                                        countryView.trackedKeyword.store,
                                                      country:
                                                        countryView.trackedKeyword.country,
                                                      lastRank: -1,
                                                      lastChecked: "",
                                                      lastCheckStatus:
                                                        undefined,
                                                      lastError: undefined,
                                                    },
                                              );
                                            const isSelectedCountry =
                                              countryView.trackedKeyword.country ===
                                              trackedKeyword.country;
                                            return (
                                              <span
                                                key={`${keywordGroup.groupKey}:${countryView.trackedKeyword.country}:badge`}
                                                className={`inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] ${
                                                  isSelectedCountry
                                                    ? "border-cyan-400/30 bg-cyan-500/12 ring-1 ring-inset ring-cyan-300/10"
                                                    : "border-app-border/60 bg-app-surface-muted/80"
                                                }`}
                                              >
                                                <span className="truncate text-app-text-muted">
                                                  {findCountryName(
                                                    countryView.trackedKeyword.country,
                                                  ) ||
                                                    countryView.trackedKeyword.country.toUpperCase()}
                                                </span>
                                                <span className="text-app-text-muted">
                                                  {countryView.trackedKeyword.country.toUpperCase()}
                                                </span>
                                                <span
                                                  className={`font-bold ${countryRankDisplay.className}`}
                                                >
                                                  {countryRankDisplay.label}
                                                </span>
                                              </span>
                                            );
                                          },
                                        )}
                                      </div>
                                      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                                        {selectedCountryView.appHistoryViews.map(
                                          (view) => {
                                          const rankDisplay = getTrackedRankDisplay({
                                            groupId: trackedKeyword.groupId,
                                            keyword: trackedKeyword.keyword,
                                            appId: view.app.appId,
                                            appTitle: view.app.title,
                                            store: trackedKeyword.store,
                                            country: trackedKeyword.country,
                                            lastRank: view.app.lastRank,
                                            lastChecked: view.app.lastChecked,
                                            lastCheckStatus:
                                              view.app.lastCheckStatus,
                                            lastError: view.app.lastError,
                                          });
                                          return (
                                            <div
                                              key={`${trackedKeyword.trackedKeywordId}:${view.app.appKey}`}
                                              className={`rounded-xl border px-2 py-2 sm:px-3 sm:py-3 ${view.app.role === "own" ? "border-cyan-400/20 bg-app-surface-muted/75 ring-1 ring-inset ring-cyan-300/10" : "border-app-border/50 bg-app-surface-muted/60"}`}
                                            >
                                              <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                  <p className="truncate text-xs font-semibold text-app-text">
                                                    {view.app.title}
                                                  </p>
                                                  <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-app-text-muted">
                                                    {view.app.role === "own"
                                                      ? "Your app"
                                                      : "Competitor"}
                                                  </p>
                                                </div>
                                                <div className="text-right">
                                                  <p
                                                    className={`text-base font-display font-bold sm:text-lg ${rankDisplay.className}`}
                                                  >
                                                    {rankDisplay.label}
                                                  </p>
                                                  {view.movement !== 0 && (
                                                    <p
                                                      className={`mt-1 text-[10px] font-semibold ${view.movement > 0 ? "text-cyan-400" : "text-red-400"}`}
                                                    >
                                                      {view.movement > 0 ? "+" : ""}
                                                      {view.movement}
                                                    </p>
                                                  )}
                                                </div>
                                              </div>
                                              {view.app.lastCheckStatus === "error" &&
                                                view.app.lastError && (
                                                  <p className="mt-2 rounded-lg bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300">
                                                    {view.app.lastError}
                                                  </p>
                                                )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                      {isExpanded && (
                                        <div className="competitor-rank-chart mt-4 rounded-2xl border border-app-border/50 bg-app-surface/50 p-3 sm:p-4">
                                          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                                            <div className="min-w-0">
                                              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                                                {findCountryName(
                                                  trackedKeyword.country,
                                                ) ||
                                                  trackedKeyword.country.toUpperCase()}
                                              </p>
                                              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100/80">
                                                {trackedKeyword.country.toUpperCase()}
                                              </p>
                                            </div>
                                            <div className="text-right text-[11px] text-app-text-muted">
                                              {trackedKeyword.lastCheckedAt
                                                ? `Updated ${formatTrackingChartDateTime(trackedKeyword.lastCheckedAt)}`
                                                : "Pending"}
                                            </div>
                                          </div>
                                          <div className="workspace-mobile-chart h-56 w-full min-w-0 sm:h-72">
                                            {selectedCountryView.chartPoints.length >
                                            0 ? (
                                              <ResponsiveContainer
                                                width="100%"
                                                height="100%"
                                              >
                                                <LineChart
                                                  data={selectedCountryView.chartPoints}
                                                  margin={{
                                                    top: 8,
                                                    right: 12,
                                                    left: 4,
                                                    bottom: 4,
                                                  }}
                                                >
                                                  <CartesianGrid
                                                    strokeDasharray="3 3"
                                                    vertical={false}
                                                    stroke={chartGridStroke}
                                                  />
                                                  <XAxis
                                                    dataKey="timestamp"
                                                    fontSize={10}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tick={{ fill: chartAxisLabelColor }}
                                                  />
                                                  <YAxis
                                                    domain={[
                                                      1,
                                                      selectedCountryView.chartMax,
                                                    ]}
                                                    fontSize={10}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tick={{ fill: chartAxisLabelColor }}
                                                    width={30}
                                                    tickFormatter={(value) =>
                                                      `#${value}`
                                                    }
                                                  />
                                                  <Tooltip
                                                    labelFormatter={(
                                                      _value,
                                                      payload,
                                                    ) =>
                                                      payload[0]?.payload?.fullTime ||
                                                      _value
                                                    }
                                                    contentStyle={{
                                                      ...chartTooltipStyle,
                                                      borderRadius: "8px",
                                                      fontSize: "10px",
                                                    }}
                                                    formatter={(
                                                      value: number,
                                                      name: string | number,
                                                      props: any,
                                                    ) => {
                                                      const dataKey = String(
                                                        props.dataKey || name,
                                                      );
                                                      const rawRank = Number(
                                                        props.payload?.[
                                                          `${dataKey}_raw`
                                                        ] ?? value,
                                                      );
                                                      const rankDepth = Number(
                                                        props.payload?.[
                                                          `${dataKey}_depth`
                                                        ] ?? TRACKED_KEYWORD_RANKING_DEPTH,
                                                      );
                                                      return [
                                                        rawRank === -1
                                                          ? `Not in top ${rankDepth}`
                                                          : `#${value}`,
                                                        name,
                                                      ];
                                                    }}
                                                  />
                                                  <Legend
                                                    wrapperStyle={{
                                                      fontSize: "12px",
                                                      color: chartLegendTextColor,
                                                    }}
                                                  />
                                                  {selectedCountryView.appHistoryViews.map(
                                                    (view, index) => {
                                                      const color =
                                                        view.app.role === "own"
                                                          ? competitorLinePalette[0]
                                                          : competitorLinePalette[
                                                              (index % 2) + 1
                                                            ];
                                                      return (
                                                        <Line
                                                          key={view.app.appKey}
                                                          type="monotone"
                                                          dataKey={view.dataKey}
                                                          name={view.app.title}
                                                          stroke={color}
                                                          strokeWidth={
                                                            view.app.role === "own"
                                                              ? 2.75
                                                              : 2
                                                          }
                                                          dot={false}
                                                          activeDot={{
                                                            r: 3,
                                                            fill: color,
                                                            stroke: "var(--color-chart-tooltip-bg)",
                                                            strokeWidth: 1.5,
                                                          }}
                                                          connectNulls
                                                          isAnimationActive={false}
                                                        />
                                                      );
                                                    },
                                                  )}
                                                </LineChart>
                                              </ResponsiveContainer>
                                            ) : (
                                              <div className="flex h-full items-center justify-center text-sm text-app-text-muted">
                                                No rank history yet.
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="mt-4 text-sm text-app-text-muted">
                                Analyze the comparison, then track a keyword to
                                start competitor monitoring here.
                              </p>
                            )}
                          </div>

                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                  )}
                </div>
              )}
            </div>
          )}{" "}
          {viewMode === "reports" && (
            <div ref={reportsExportRef}>
              <ReportsWorkspace
                trackedKeywords={trackedKeywords}
                trackedHistoryByKey={trackedHistoryByKey}
                trackedCountryRowsForExport={trackedCountryRowsForReports}
                competitorGroups={competitorGroups}
                competitorAsoDiffs={competitorAsoDiffs}
                competitorAsoLatestSnapshots={competitorAsoLatestSnapshots}
                competitorTrackedKeywordsByGroupId={
                  competitorTrackedKeywordsByGroupId
                }
                competitorRankHistoryByTrackedKeywordId={
                  competitorRankHistoryByTrackedKeywordId
                }
                trackedOverview={{
                  lastRefreshLabel: trackingSchedule.lastRunAt
                    ? formatTrackingChartDateTime(trackingSchedule.lastRunAt)
                    : "Not yet",
                  keywordGroups: trackedKeywordGroupCount,
                  rankedKeywords: trackedDashboardStats.rankedCount,
                  top10Count: trackedOverviewStats.top10Count,
                  top3Count: trackedOverviewStats.top3Count,
                  trackedAppCount: trackedAppUsageCount,
                  averageRank: trackedOverviewStats.averageRank,
                  range4To10Count: trackedOverviewStats.range4To10Count,
                  range11To50Count: trackedOverviewStats.range11To50Count,
                }}
                defaultCountry={country}
                defaultStore={storeType}
                initialReportMode={initialReportsDeepLinkState?.reportMode}
                initialPeriod={initialReportsDeepLinkState?.period}
                initialStoreFilter={initialReportsDeepLinkState?.storeFilter}
                initialCountryFilter={initialReportsDeepLinkState?.countryFilter}
                weeklyReportSettings={weeklyReportSettings}
                isWeeklyReportSettingsOpen={isWeeklyReportSettingsOpen}
                onWeeklyReportSettingsOpenChange={setIsWeeklyReportSettingsOpen}
                onWeeklyReportSettingsChange={(nextSettings) =>
                  setWeeklyReportSettings((current) =>
                    normalizeWeeklyReportEmailSettings(
                      {
                        ...current,
                        ...nextSettings,
                        timezone: getBrowserTimeZone(),
                      },
                      getBrowserTimeZone(),
                    ),
                  )
                }
                onEditCompetitorKeywordCountries={
                  openCompetitorTrackedKeywordCountryPicker
                }
                onExportSnapshotChange={setReportsExportSnapshot}
              />
            </div>
          )}{" "}
          {/* Bookmarks Dashboard */}{" "}
          {viewMode === "bookmarks" && (
            <div className="space-y-6">
              <WorkspacePanel tone="muted">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="workspace-chip-label">Saved Shortcuts</div>
                    <h2 className="mt-1 text-xl font-semibold text-app-text">
                      Bookmarked Apps
                    </h2>
                    <p className="mt-2 text-sm text-app-text-muted">
                      Use bookmarks as your quick-launch rail for apps you revisit
                      frequently across markets and stores.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="workspace-status-chip">
                      {bookmarksByStore.android} Play
                    </span>
                    <span className="workspace-status-chip">
                      {bookmarksByStore.ios} iOS
                    </span>
                    <span className="workspace-status-chip">
                      {bookmarksByStore.countries} markets
                    </span>
                  </div>
                </div>
              </WorkspacePanel>
              {bookmarks.length === 0 ? (
                <WorkspaceEmptyBlock
                  icon={Bookmark}
                  title="No bookmarks yet"
                  description="Analyze an app and use the bookmark action to keep it in this quick-access workspace."
                />
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {" "}
                  {bookmarks.map((b) => (
                    <div
                      key={`${b.store}-${b.appId || b.id}`}
                      className="workspace-bookmark-card group cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:ring-offset-2 focus:ring-offset-app-surface"
                      role="button"
                      tabIndex={0}
                      aria-label={`Open bookmarked app ${b.title}`}
                      onClick={() => {
                        setStoreType(b.store);
                        setCountry(b.country);
                        handleSelectApp(
                          {
                            appId: b.appId,
                            id: b.id,
                            title: b.title,
                            icon: b.icon,
                            developer: b.developer,
                            description: "",
                            score: 0,
                            url: b.url,
                          } as AppDetails,
                          b.store,
                          b.country,
                          "single",
                        );
                        setViewMode("single");
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        setStoreType(b.store);
                        setCountry(b.country);
                        handleSelectApp(
                          {
                            appId: b.appId,
                            id: b.id,
                            title: b.title,
                            icon: b.icon,
                            developer: b.developer,
                            description: "",
                            score: 0,
                            url: b.url,
                          } as AppDetails,
                          b.store,
                          b.country,
                          "single",
                        );
                        setViewMode("single");
                      }}
                    >
                      {" "}
                      <img
                        src={b.icon}
                        alt={b.title}
                        className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                        style={{ border: "1px solid rgba(51,65,85,0.5)" }}
                      />{" "}
                      <div className="flex-1 min-w-0">
                        {" "}
                        <h3 className="font-semibold text-app-text truncate text-sm">
                          {b.title}
                        </h3>{" "}
                        <p className="text-xs text-app-text-muted truncate mt-0.5">
                          {b.developer}
                        </p>{" "}
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {" "}
                          {b.store === "ios" ? (
                            <Apple className="w-3 h-3 text-slate-600" />
                          ) : (
                            <Play className="w-3 h-3 text-slate-600" />
                          )}{" "}
                          <span
                            className="badge badge-cyan"
                            style={{ fontSize: "0.6rem" }}
                          >
                            {b.country.toUpperCase()}
                          </span>{" "}
                        </div>{" "}
                      </div>{" "}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBookmarks((prev) =>
                            prev.filter(
                              (bm) =>
                                !(
                                  bm.store === b.store &&
                                  (b.store === "ios"
                                    ? bm.id === b.id
                                    : bm.appId === b.appId)
                                ),
                            ),
                          );
                        }}
                        className="workspace-bookmark-remove p-2 rounded-xl transition-all hover:bg-red-500/10 text-app-text-muted hover:text-red-400"
                        aria-label={`Remove ${b.title} bookmark`}
                      >
                        {" "}
                        <X className="w-4 h-4" />{" "}
                      </button>{" "}
                    </div>
                  ))}{" "}
                </div>
              )}{" "}
            </div>
          )}{" "}
          {/* Tracked Keywords Dashboard */}{" "}
          {viewMode === "tracked" && (
            <div className="space-y-6" ref={trackedExportRef}>
              <div className="space-y-3">
                <WorkspacePanel tone="strong" className="workspace-toolbar-panel">
                  <div className="flex flex-col gap-3 lg:gap-5 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                      <div className="workspace-chip-label">Tracking</div>
                      <h2 className="mt-1 text-lg lg:text-xl font-semibold text-app-text">
                        Tracked Keywords
                      </h2>
                      <p className="mt-1 text-[11px] lg:text-sm text-app-text-muted lg:mt-1.5">
                        Focus on the latest rank, region coverage, and what needs attention.
                      </p>
                    </div>
                    {trackedKeywordGroupCount > 0 ? (
                      <div className="flex flex-wrap items-center gap-1.5 lg:gap-2 text-[10px] lg:text-xs">
                        <span className="rounded-full border border-app-border/60 bg-app-surface/45 px-2 py-1 lg:px-3 lg:py-1.5 text-app-text-muted">
                          {trackedViewAppCount} tracked app{trackedViewAppCount === 1 ? "" : "s"}
                        </span>
                        <span className="rounded-full border border-app-border/60 bg-app-surface/45 px-2 py-1 lg:px-3 lg:py-1.5 text-app-text-muted">
                          {trackedDashboardStats.totalGroups} keyword group{trackedDashboardStats.totalGroups === 1 ? "" : "s"}
                        </span>
                        <span className="rounded-full border border-app-border/60 bg-app-surface/45 px-2 py-1 lg:px-3 lg:py-1.5 text-emerald-300">
                          {trackedDashboardStats.rankedCount} ranking
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {trackedKeywordGroupCount > 0 && (
                    <>
                      <div className="workspace-compact-controls mt-3 grid grid-cols-2 gap-2 lg:mt-4 lg:gap-3 lg:grid-cols-[minmax(0,1.5fr)_220px_220px_220px]">
                        <div className="col-span-2 lg:col-span-1 relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 lg:h-4 lg:w-4 -translate-y-1/2 text-app-text-muted" />
                          <input
                            type="text"
                            value={trackSearchTerm}
                            onChange={(event) => setTrackSearchTerm(event.target.value)}
                            placeholder="Search app, keyword, or country..."
                            className="input-field w-full py-2 pl-9 pr-3 text-xs lg:py-2.5 lg:pl-10 lg:pr-4 lg:text-sm"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsTrackedControlsOpen((previous) => !previous)}
                          aria-expanded={isTrackedControlsOpen}
                          className="workspace-mobile-filter-toggle col-span-2 inline-flex min-h-[2.45rem] items-center justify-between rounded-xl border border-app-border/60 bg-app-surface-muted/70 px-3 text-xs font-semibold text-app-text-muted md:hidden"
                        >
                          Filters & actions
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform",
                              isTrackedControlsOpen && "rotate-180",
                            )}
                          />
                        </button>
                        <div className={cn(
                          "col-span-2 sm:col-span-1 lg:col-span-1",
                          !isTrackedControlsOpen && "hidden md:block",
                        )}>
                          <CountrySearchSelect
                            value={trackFilterCountry}
                            onChange={setTrackFilterCountry}
                            options={COUNTRIES}
                            includeAllOption={{
                              code: "all",
                              name: "All Countries",
                            }}
                            ariaLabel="Filter tracked keywords by country"
                            className="w-full text-xs lg:text-sm"
                          />
                        </div>
                        <div className={cn(
                          "col-span-1 lg:col-span-1",
                          !isTrackedControlsOpen && "hidden md:block",
                        )}>
                          <select
                            id="tracked-app-filter"
                            name="trackedAppFilter"
                            aria-label="Filter tracked keywords by app"
                            value={trackFilterApp}
                            onChange={(e) => setTrackFilterApp(e.target.value)}
                            className="input-field w-full py-2 text-xs lg:py-2.5 lg:text-sm"
                            style={{ paddingRight: "1.5rem" }}
                          >
                            <option value="all">All Apps</option>
                            {trackedAppTitles.map((title) => (
                              <option key={title} value={title}>
                                {title}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className={cn(
                          "col-span-1 lg:col-span-1",
                          !isTrackedControlsOpen && "hidden md:block",
                        )}>
                          <select
                            id="tracked-sort"
                            name="trackedSort"
                            aria-label="Sort tracked keywords"
                            value={trackSortBy}
                            onChange={(e) => setTrackSortBy(e.target.value as any)}
                            className="input-field w-full py-2 text-xs lg:py-2.5 lg:text-sm"
                            style={{ paddingRight: "1.5rem" }}
                          >
                            <option value="date_added">Newest first</option>
                            <option value="last_checked">Recently checked</option>
                            <option value="app">App name</option>
                            <option value="rank_change">Biggest change</option>
                          </select>
                        </div>
                      </div>

                      <div className={cn(
                        "workspace-compact-controls mt-2 flex flex-wrap items-center gap-1 text-[10px] lg:mt-3 lg:gap-2 lg:text-xs",
                        !isTrackedControlsOpen && "hidden md:flex",
                      )}>
                        <button
                          type="button"
                          onClick={() => setExpandedTrackedGroupIds(visibleTrackedGroupIds)}
                          className="btn-ghost rounded-lg px-2 py-1.5 lg:rounded-xl lg:px-3 lg:py-2"
                          disabled={visibleTrackedGroupIds.length === 0}
                        >
                          Expand all
                        </button>
                        <button
                          type="button"
                          onClick={() => setExpandedTrackedGroupIds([])}
                          className="btn-ghost rounded-lg px-2 py-1.5 lg:rounded-xl lg:px-3 lg:py-2"
                          disabled={expandedTrackedGroupIds.length === 0}
                        >
                          Collapse all
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTrackSearchTerm("");
                            setTrackFilterCountry("all");
                            setTrackFilterApp("all");
                            setTrackSortBy("date_added");
                          }}
                          className="btn-ghost rounded-lg px-2 py-1.5 lg:rounded-xl lg:px-3 lg:py-2"
                        >
                          Reset filters
                        </button>
                      </div>
                    </>
                  )}
                </WorkspacePanel>

                {billingStatusForUi?.usage?.pausedTrackedKeywords ? (
                  <div className="workspace-warning-banner workspace-compact-banner rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <div className="workspace-warning-copy inline-flex items-center gap-2">
                        <AlertCircle className="workspace-warning-icon h-4 w-4 text-amber-300" />
                        {billingStatusForUi.usage.pausedTrackedKeywords} tracked
                        keyword
                        {billingStatusForUi.usage.pausedTrackedKeywords === 1
                          ? ""
                          : "s"}{" "}
                        are paused because this plan refreshes only the oldest{" "}
                        {effectivePlanLimits?.trackedKeywords?.toLocaleString() ||
                          billingStatusForUi.usage.activeTrackedKeywords}{" "}
                        keyword records each day.
                      </div>
                      <button
                        type="button"
                        onClick={() => setViewMode("upgrade")}
                        className="workspace-warning-button btn-ghost rounded-xl px-3 py-2 text-xs text-amber-100 hover:text-app-text"
                      >
                        View plans
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="workspace-compact-banner rounded-2xl border border-app-border/60 bg-app-surface/40 px-4 py-3 text-xs text-app-text-muted">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="inline-flex items-center gap-2">
                      <BellRing className="w-4 h-4 text-cyan-400" />
                      Daily tracking refresh at{" "}
                      <span className="text-app-text">
                        {formatGlobalTrackingTimeForLocalDisplay(new Date(), {
                          includeTimeZoneName: true,
                        })}
                      </span>
                    </div>
                    <div className="text-app-text-muted">
                      Last refresh: {trackingSchedule.lastRunAt ? formatTrackingChartDateTime(trackingSchedule.lastRunAt) : "Not yet"}
                    </div>
                  </div>
                </div>
              </div>
              {(() => {
                if (trackedKeywordGroupCount === 0) {
                  return (
                    <WorkspaceEmptyBlock
                      icon={Bell}
                      title="No keywords tracked yet"
                      description='Search for an app, check a keyword ranking, and tap "Track Keyword" to monitor it here.'
                    />
                  );
                }
                if (processedTrackedAppGroups.length === 0) {
                  return (
                    <WorkspaceEmptyBlock
                      icon={Search}
                      title="No tracked groups match"
                      description={`No tracked keyword groups for ${
                        trackFilterCountry === "all"
                          ? "all countries"
                          : findCountryName(trackFilterCountry) || trackFilterCountry
                      } match this filter.`}
                    />
                  );
                }
                return (
                  <div className="space-y-4">
                    {processedTrackedAppGroups.map((appGroup) => {
                        const selectedStore =
                          (trackedSelectedStoreByApp[appGroup.appKey] &&
                          appGroup.storeGroups.some(
                            (storeGroup) =>
                              storeGroup.store ===
                              trackedSelectedStoreByApp[appGroup.appKey],
                          )
                            ? trackedSelectedStoreByApp[appGroup.appKey]
                            : undefined) ||
                          (appGroup.storeGroups.some(
                            (storeGroup) => storeGroup.store === storeType,
                          )
                            ? storeType
                            : undefined) ||
                          appGroup.storeGroups[0]?.store;
                        const selectedStoreGroup =
                          appGroup.storeGroups.find(
                            (storeGroup) => storeGroup.store === selectedStore,
                          ) || appGroup.storeGroups[0];
                        if (!selectedStoreGroup) return null;
                        const appLastChecked =
                          selectedStoreGroup.lastChecked &&
                          new Date(selectedStoreGroup.lastChecked).getTime() > 0
                            ? formatTrackingChartDateTime(
                                selectedStoreGroup.lastChecked,
                              )
                            : "Not checked yet";
                        return (
                          <div
                            key={appGroup.appKey}
                            className="workspace-compact-card rounded-3xl border border-app-border/80 bg-app-surface/55 shadow-xl shadow-black/35 ring-1 ring-inset ring-slate-400/10"
                          >
                            <div className="workspace-compact-card-header border-b border-app-border/70 bg-app-surface-muted/35 px-4 py-4 sm:px-5">
                              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                <div className="flex items-start gap-3">
                                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-app-border/75 bg-app-surface-muted/90 shadow-[inset_0_1px_0_rgba(148,163,184,0.06)] sm:h-11 sm:w-11">
                                    {selectedStoreGroup.store === "ios" ? (
                                      <Apple className="h-4 w-4 text-app-text" />
                                    ) : (
                                      <Play className="h-4 w-4 text-app-text" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h3 className="workspace-mobile-clamp-2 text-base font-semibold text-app-text sm:truncate">
                                        {appGroup.appTitle}
                                      </h3>
                                      <span className="rounded-full border border-app-border/60 bg-app-surface-muted/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                                        {selectedStoreGroup.store === "ios"
                                          ? "iOS"
                                          : "Android"}
                                      </span>
                                    </div>
                                    <p className="workspace-mobile-subtle-copy mt-1 text-sm text-app-text-muted">
                                      Tracked keywords stay inside this app, and the store switch only changes this app block.
                                    </p>
                                    <p className="mt-1 text-xs text-app-text-muted">
                                      Last checked {appLastChecked}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-col gap-3 xl:items-end">
                                  <div className="inline-flex rounded-xl border border-app-border/70 bg-app-surface-muted/80 p-1">
                                    {appGroup.storeGroups.map((storeGroup) => {
                                      const isActive =
                                        storeGroup.store === selectedStoreGroup.store;
                                      return (
                                        <button
                                          key={`${appGroup.appKey}:${storeGroup.store}`}
                                          type="button"
                                          onClick={() =>
                                            setTrackedSelectedStoreByApp((prev) => ({
                                              ...prev,
                                              [appGroup.appKey]: storeGroup.store,
                                            }))
                                          }
                                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                            isActive
                                              ? "bg-cyan-300 text-black"
                                              : "text-app-text-muted hover:text-app-text"
                                          }`}
                                        >
                                          {storeGroup.store === "ios" ? (
                                            <Apple className="h-3.5 w-3.5" />
                                          ) : (
                                            <Play
                                              className="h-3.5 w-3.5"
                                              fill={
                                                isActive ? "currentColor" : "none"
                                              }
                                            />
                                          )}
                                          {storeGroup.store === "ios"
                                            ? "iOS"
                                            : "Play"}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] sm:gap-2 sm:text-xs">
                                    <span className="rounded-full border border-app-border/60 bg-app-surface/55 px-3 py-1.5 text-cyan-300">
                                      {selectedStoreGroup.groups.length} keywords
                                    </span>
                                    <span className="rounded-full border border-app-border/60 bg-app-surface/55 px-3 py-1.5 text-app-text-muted">
                                      {selectedStoreGroup.totalRegions} regions
                                    </span>
                                    <span className="rounded-full border border-app-border/60 bg-app-surface/55 px-3 py-1.5 text-cyan-300">
                                      {selectedStoreGroup.rankedCount} ranking
                                    </span>
                                    {getTrackedStatusPills(
                                      selectedStoreGroup.pendingCount,
                                      selectedStoreGroup.needsAttentionCount,
                                    ).map((pill) => (
                                      <span
                                        key={`${selectedStoreGroup.store}:${pill.key}`}
                                        className={cn(
                                          "px-3 py-1.5 text-[11px] sm:text-xs",
                                          pill.className,
                                        )}
                                      >
                                        {pill.label}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                              <div className="workspace-compact-card-body space-y-3 bg-app-surface/20 p-3 sm:p-4">
                              {selectedStoreGroup.groups.map((group) => {
                        const groupImprovement = group.improvement;
                        const isExpanded = expandedTrackedGroupIds.includes(
                          group.groupId,
                        );
                        const defaultSummaryCountryCode =
                          group.countryViews.find(
                            (cv) => cv.trackedKeyword.country === country,
                          )?.trackedKeyword.country ||
                          [...group.countryViews].sort(
                            (a, b) =>
                              new Date(b.trackedKeyword.lastChecked).getTime() -
                              new Date(a.trackedKeyword.lastChecked).getTime(),
                          )[0]?.trackedKeyword.country ||
                          group.countryViews[0]?.trackedKeyword.country;
                        const summaryCountryView =
                          group.countryViews.find(
                            (cv) =>
                              cv.trackedKeyword.country ===
                              trackedSummaryCountryByGroup[group.groupId],
                          ) ||
                          group.countryViews.find(
                            (cv) =>
                              cv.trackedKeyword.country ===
                              defaultSummaryCountryCode,
                          ) ||
                          group.countryViews[0];
                        const summaryRankDisplay = summaryCountryView
                          ? getTrackedRankDisplay(
                              summaryCountryView.trackedKeyword,
                            )
                          : null;
                        const summaryHistory =
                          summaryCountryView?.tHistory || [];
                        const summaryValidHistory = summaryHistory.filter(
                          (entry) => entry.rawRank !== -1,
                        );
                        const summaryImprovement =
                          summaryCountryView?.improvement ?? 0;
                        const summaryLineColor =
                          summaryImprovement >= 0
                            ? "var(--color-success)"
                            : "var(--color-danger)";
                        const summaryBestRank =
                          summaryValidHistory.length > 0
                            ? Math.min(
                                ...summaryValidHistory.map(
                                  (entry) => entry.rawRank,
                                ),
                              )
                            : null;
                        const summaryWorstRank =
                          summaryValidHistory.length > 0
                            ? Math.max(
                                ...summaryValidHistory.map(
                                  (entry) => entry.rawRank,
                                ),
                              )
                            : null;
                        const summaryLatestRank =
                          summaryValidHistory.length > 0
                            ? summaryValidHistory[
                                summaryValidHistory.length - 1
                              ].rawRank
                            : null;
                        const summaryLastChecked =
                          summaryCountryView?.trackedKeyword.lastChecked &&
                          new Date(
                            summaryCountryView.trackedKeyword.lastChecked,
                          ).getTime() > 0
                            ? formatTrackingChartDateTime(
                                summaryCountryView.trackedKeyword.lastChecked,
                              )
                            : "Not checked yet";
                        return (
                          <div
                            key={group.groupId}
                            className="workspace-compact-card rounded-2xl border border-app-border/80 border-l-2 border-l-cyan-400/35 bg-app-surface-muted/75 shadow-[inset_0_1px_0_rgba(148,163,184,0.05)]"
                          >
                            <div className="flex flex-col gap-2.5 px-3 py-2.5 sm:px-5 lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)_72px_minmax(280px,1.35fr)_76px_32px] lg:items-center lg:gap-4">
                              {" "}
                              {/* App + keyword */}{" "}
                              <button
                                type="button"
                                onClick={() =>
                                  toggleTrackedGroupExpansion(group.groupId)
                                }
                                className="flex items-center gap-3 text-left min-w-0"
                              >
                                {" "}
                                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-app-surface-muted border border-app-border flex items-center justify-center">
                                  {" "}
                                  {group.store === "ios" ? (
                                    <Apple className="w-3.5 h-3.5 text-app-text-muted" />
                                  ) : (
                                    <Play className="w-3.5 h-3.5 text-app-text-muted" />
                                  )}{" "}
                                </div>{" "}
                                <div className="min-w-0">
                                  {" "}
                                  <p className="workspace-mobile-clamp-2 text-sm font-semibold text-app-text sm:truncate leading-tight">
                                    {group.appTitle}
                                  </p>{" "}
                                  <p className="text-xs text-cyan-400/80 font-medium truncate mt-0.5">
                                    "{group.keyword}"
                                  </p>{" "}
                                </div>{" "}
                                <ChevronDown
                                  className={`w-4 h-4 text-app-text-muted flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                />{" "}
                              </button>{" "}
                              {/* Regions - hidden on mobile */}{" "}
                              <div className="flex flex-wrap items-center gap-2">
                                <select
                                  value={
                                    summaryCountryView?.trackedKeyword.country ||
                                    ""
                                  }
                                  onChange={(event) =>
                                    setTrackedSummaryCountry(
                                      group.groupId,
                                      event.target.value,
                                    )
                                  }
                                  onClick={(event) => event.stopPropagation()}
                                  className="rounded-full border border-app-border/60 bg-app-surface-muted/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-app-text-muted outline-none"
                                  aria-label={`Select summary country for ${group.keyword}`}
                                >
                                  {group.countryViews.map((cv) => (
                                    <option
                                      key={`${group.groupId}:${cv.trackedKeyword.country}:summary-option`}
                                      value={cv.trackedKeyword.country}
                                    >
                                      {cv.trackedKeyword.country.toUpperCase()} - {findCountryName(cv.trackedKeyword.country)}
                                    </option>
                                  ))}
                                </select>
                                {" "}
                                {group.countryViews.map((cv) => {
                                  const rd = getTrackedRankDisplay(
                                    cv.trackedKeyword,
                                  );
                                  return (
                                    <span
                                      key={cv.trackedKeyword.country}
                                      className="inline-flex items-center gap-1 rounded-full bg-app-surface-muted/80 border border-app-border/60 px-2 py-0.5 text-[10px]"
                                    >
                                      {" "}
                                      <span className="text-app-text-muted">
                                        {cv.trackedKeyword.country.toUpperCase()}
                                      </span>{" "}
                                      <span
                                        className={`font-bold ${rd.className}`}
                                      >
                                        {rd.label}
                                      </span>{" "}
                                    </span>
                                  );
                                })}{" "}
                              </div>{" "}
                              {/* Primary rank */}{" "}
                              <div className="flex flex-col items-end">
                                {" "}
                                {summaryRankDisplay ? (
                                  <span
                                    className={`text-xl font-display font-bold leading-none ${summaryRankDisplay.className}`}
                                  >
                                    {summaryRankDisplay.label}
                                  </span>
                                ) : (
                                  <span className="text-xs text-app-text-muted">
                                    Pending
                                  </span>
                                )}{" "}
                              </div>{" "}
                              <div className="rounded-xl border border-app-border/50 bg-app-surface/45 px-3 py-2.5 sm:px-4 sm:py-3">
                                <div className="mb-2 flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                                      {summaryCountryView
                                        ? findCountryName(
                                            summaryCountryView.trackedKeyword.country,
                                          )
                                        : "Selected Country"}
                                    </p>
                                    <p className="mt-0.5 truncate text-[11px] text-app-text-muted">
                                      Updated {summaryLastChecked}
                                    </p>
                                  </div>
                                  <span className="rounded-full border border-app-border/60 bg-app-surface-muted/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-app-text-muted">
                                    {summaryValidHistory.length} pts
                                  </span>
                                </div>
                                <div className="h-32">
                                  <RankSparkline
                                    data={summaryHistory}
                                    stroke={summaryLineColor}
                                  />
                                </div>
                                <div className="mt-2 grid grid-cols-3 gap-1.5 border-t border-app-border/40 pt-2">
                                  {[
                                    {
                                      label: "Best",
                                      value:
                                        summaryBestRank !== null
                                          ? `#${summaryBestRank}`
                                          : "-",
                                      color: "text-cyan-400",
                                    },
                                    {
                                      label: "Latest",
                                      value:
                                        summaryLatestRank !== null
                                          ? `#${summaryLatestRank}`
                                          : "-",
                                      color: "text-cyan-400",
                                    },
                                    {
                                      label: "Worst",
                                      value:
                                        summaryWorstRank !== null
                                          ? `#${summaryWorstRank}`
                                          : "-",
                                      color: "text-rose-400",
                                    },
                                  ].map(({ label, value, color }) => (
                                    <div
                                      key={label}
                                      className="rounded-lg bg-app-surface-muted/60 py-1 text-center"
                                    >
                                      <p className="text-[8px] font-semibold uppercase tracking-[0.16em] text-app-text-muted">
                                        {label}
                                      </p>
                                      <p
                                        className={`mt-0.5 text-[11px] font-bold font-display ${color}`}
                                      >
                                        {value}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>{" "}
                              {/* Change badge */}{" "}
                              <div className="flex justify-start lg:justify-center">
                                {" "}
                                {summaryImprovement !== 0 ? (
                                  <span
                                    className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-lg ${summaryImprovement > 0 ? "bg-cyan-500/15 text-cyan-400" : "bg-red-500/15 text-red-400"}`}
                                  >
                                    {" "}
                                    {summaryImprovement > 0 ? (
                                      <TrendingDown className="w-3 h-3" />
                                    ) : (
                                      <TrendingUp className="w-3 h-3" />
                                    )}{" "}
                                    {Math.abs(summaryImprovement)}{" "}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-600">
                                    -
                                  </span>
                                )}{" "}
                              </div>{" "}
                              {/* Delete */}{" "}
                              <div className="flex justify-end">
                                {" "}
                                <button
                                  type="button"
                                  onClick={() =>
                                    openTrackCountryPicker(
                                      group.keyword,
                                      {
                                        title: group.appTitle,
                                        appId: group.appId,
                                        id:
                                          group.store === "ios" &&
                                          Number.isFinite(Number(group.appId))
                                            ? Number(group.appId)
                                            : undefined,
                                        description: "",
                                        icon: "",
                                        score: 0,
                                        developer: "",
                                      },
                                      group.store,
                                      summaryCountryView?.trackedKeyword.country ||
                                        group.countries[0] ||
                                        country,
                                      summaryCountryView?.trackedKeyword.lastRank || -1,
                                      Boolean(summaryCountryView),
                                      "own",
                                      "manual",
                                    )
                                  }
                                  className="mr-1.5 rounded-lg border border-app-border/60 bg-app-surface-muted/80 px-2.5 py-1.5 text-[11px] font-semibold text-app-text-muted transition-colors hover:border-cyan-400/30 hover:text-cyan-200"
                                  title="Edit tracked countries"
                                >
                                  Edit Countries
                                </button>{" "}
                                <button
                                  type="button"
                                  onClick={() => setActiveAlertGroupId(group.groupId)}
                                  className="mr-1.5 p-1.5 text-app-text-muted hover:text-cyan-300 hover:bg-cyan-500/10 rounded-lg transition-colors"
                                  title="Manage alerts"
                                >
                                  <Bell className="w-4 h-4" />
                                </button>{" "}
                                <button
                                  type="button"
                                  onClick={() =>
                                    removeTrackedKeywordGroup(
                                      group.groupId,
                                      group.keyword,
                                    )
                                  }
                                  className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                  title="Stop tracking"
                                >
                                  {" "}
                                  <Trash2 className="w-4 h-4" />{" "}
                                </button>{" "}
                              </div>{" "}
                            </div>{" "}
                            {/* Expanded detail */}{" "}
                            {isExpanded && (
                              <div className="border-t border-app-border/45 bg-app-surface/40 px-5 pb-5 pt-2">
                                {" "}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                  {" "}
                                  {group.countryViews.map((countryView) => {
                                    const {
                                      trackedKeyword,
                                      tHistory,
                                      improvement,
                                    } = countryView;
                                    const rankDisplay =
                                      getTrackedRankDisplay(trackedKeyword);
                                    const validHistory = tHistory.filter(
                                      (e) => e.rawRank !== -1,
                                    );
                                    const bestRank =
                                      validHistory.length > 0
                                        ? Math.min(
                                            ...validHistory.map(
                                              (e) => e.rawRank,
                                            ),
                                          )
                                        : null;
                                    const worstRank =
                                      validHistory.length > 0
                                        ? Math.max(
                                            ...validHistory.map(
                                              (e) => e.rawRank,
                                            ),
                                          )
                                        : null;
                                    const avgRank =
                                      validHistory.length > 0
                                        ? Math.round(
                                            validHistory.reduce(
                                              (s, e) => s + e.rawRank,
                                              0,
                                            ) / validHistory.length,
                                          )
                                        : null;
                                    const isPositive = improvement >= 0;
                                    const lineColor = isPositive
                                      ? "var(--color-success)"
                                      : "var(--color-danger)";
                                    return (
                                      <div
                                        key={`${group.groupId}:${trackedKeyword.country}`}
                                        className="rounded-xl border border-app-border/75 bg-app-surface-muted/75 p-3 shadow-[inset_0_1px_0_rgba(148,163,184,0.05)]"
                                      >
                                        {" "}
                                        {/* Country header */}{" "}
                                        <div className="flex items-center justify-between mb-2">
                                          {" "}
                                          <div>
                                            {" "}
                                            <p className="text-[9px] uppercase tracking-widest text-app-text-muted font-semibold">
                                              {findCountryName(
                                                trackedKeyword.country,
                                              )}
                                            </p>{" "}
                                            <p className="text-xs font-bold text-app-text-muted mt-0.5">
                                              {trackedKeyword.country.toUpperCase()}
                                            </p>{" "}
                                          </div>{" "}
                                          <div className="text-right">
                                            {" "}
                                            <p
                                              className={`text-2xl font-display font-bold leading-none ${rankDisplay.className}`}
                                            >
                                              {rankDisplay.label}
                                            </p>{" "}
                                            {improvement !== 0 && (
                                              <span
                                                className={`text-[10px] font-bold flex items-center justify-end gap-0.5 mt-1 ${improvement > 0 ? "text-[color:var(--color-success)]" : "text-[color:var(--color-danger)]"}`}
                                              >
                                                {" "}
                                                {improvement > 0 ? (
                                                  <TrendingDown className="w-3 h-3" />
                                                ) : (
                                                  <TrendingUp className="w-3 h-3" />
                                                )}{" "}
                                                {Math.abs(improvement)}{" "}
                                              </span>
                                            )}{" "}
                                          </div>{" "}
                                        </div>{" "}
                                        {trackedKeyword.lastCheckStatus ===
                                          "error" &&
                                          trackedKeyword.lastError && (
                                            <p className="mb-2 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-1 rounded">
                                              {trackedKeyword.lastError}
                                            </p>
                                          )}{" "}
                                        {/* Mini chart */}{" "}
                                        {tHistory.length > 0 ? (
                                          <>
                                            {" "}
                                            <div className="h-24 -mx-1">
                                              <RankSparkline
                                                data={tHistory}
                                                stroke={lineColor}
                                              />
                                            </div>{" "}
                                            {validHistory.length > 0 && (
                                              <div className="grid grid-cols-3 gap-1.5 mt-2 pt-2 border-t border-app-border/40">
                                                {" "}
                                                {[
                                                  {
                                                    label: "Best",
                                                    value:
                                                      bestRank !== null
                                                        ? `#${bestRank}`
                                                        : "-",
                                                    color: "text-cyan-400",
                                                  },
                                                  {
                                                    label: "Avg",
                                                    value:
                                                      avgRank !== null
                                                        ? `#${avgRank}`
                                                        : "-",
                                                    color: "text-cyan-400",
                                                  },
                                                  {
                                                    label: "Worst",
                                                    value:
                                                      worstRank !== null
                                                        ? `#${worstRank}`
                                                        : "-",
                                                    color: "text-rose-400",
                                                  },
                                                ].map(
                                                  ({ label, value, color }) => (
                                                    <div
                                                      key={label}
                                                      className="text-center bg-app-surface-muted/50 rounded-lg py-1"
                                                    >
                                                      {" "}
                                                      <p className="text-[8px] uppercase tracking-wider text-app-text-muted font-semibold">
                                                        {label}
                                                      </p>{" "}
                                                      <p
                                                        className={`text-[11px] font-bold font-display mt-0.5 ${color}`}
                                                      >
                                                        {value}
                                                      </p>{" "}
                                                    </div>
                                                  ),
                                                )}{" "}
                                              </div>
                                            )}{" "}
                                          </>
                                        ) : (
                                          <div className="h-16 flex items-center justify-center text-xs text-slate-600">
                                            No history yet
                                          </div>
                                        )}{" "}
                                      </div>
                                    );
                                  })}{" "}
                                </div>{" "}
                              </div>
                            )}{" "}
                          </div>
                        );
                      })}
                            </div>
                          </div>
                        );
                      })}{" "}
                  </div>
                );
              })()}{" "}
            </div>
          )}{" "}
          {false &&
            ((viewMode === "single" && selectedApp) ||
            (viewMode === "compare" && comparedApps.length > 0)) && (
            <div className="mt-6 card p-6">
              <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h3 className="section-header">
                    <span
                      className="section-header-icon"
                      style={{
                        background: "rgba(34, 211, 238,0.1)",
                        border: "1px solid rgba(34, 211, 238,0.2)",
                      }}
                    >
                      <BarChart3 className="w-4 h-4 text-cyan-400" />
                    </span>
                    Market Snapshot
                  </h3>
                  <p className="mt-3 text-sm text-app-text-muted">
                    {viewMode === "single"
                      ? `Snapshot of ${getChartTypeLabel(selectedChartType).toLowerCase()} in ${selectedChartCategory?.label || "this category"} for ${findCountryName(country) || country}.`
                      : "Compare overall category-chart visibility for this market snapshot, not just keyword rankings."}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <select
                    value={selectedChartType}
                    onChange={(event) =>
                      setSelectedChartType(event.target.value as ChartType)
                    }
                    className="rounded-xl border border-app-border/70 bg-app-surface/60 px-3 py-2 text-sm text-app-text"
                  >
                    {CHART_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedChartCategoryCode}
                    onChange={(event) =>
                      setSelectedChartCategoryCode(event.target.value)
                    }
                    className="rounded-xl border border-app-border/70 bg-app-surface/60 px-3 py-2 text-sm text-app-text sm:col-span-2"
                    disabled={
                      isLoadingChartCategories || chartCategories.length === 0
                    }
                  >
                    {chartCategories.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {viewMode === "single" && selectedApp ? (
                <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
                  <div className="rounded-2xl border border-app-border/60 bg-app-surface/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                      {selectedApp.title}
                    </p>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-sm text-app-text-muted">
                          Current chart position
                        </p>
                        <p className="mt-2 font-display text-4xl font-bold text-cyan-300">
                          {selectedAppChartEntry
                            ? `#${selectedAppChartEntry.position}`
                            : "-"}
                        </p>
                      </div>
                      <div className="text-right text-xs text-app-text-muted">
                        <p>{selectedChartCategory?.label || "Category"}</p>
                        <p className="mt-1">
                          {getChartTypeLabel(selectedChartType)}
                        </p>
                        <p className="mt-1">
                          {chartLoadedAt
                            ? `Loaded ${formatAlertEventTime(chartLoadedAt)}`
                            : "Waiting for chart data"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 rounded-xl border border-app-border/50 bg-app-surface-muted/60 px-3 py-3 text-sm text-app-text-muted">
                      {isLoadingCharts ? (
                        <div className="flex items-center gap-2 text-app-text-muted">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading category chart...
                        </div>
                      ) : chartError ? (
                        <div className="text-amber-300">{chartError}</div>
                      ) : selectedAppChartEntry ? (
                        <div>
                          <p className="font-semibold text-app-text">
                            Ranking live in the current snapshot.
                          </p>
                          <p className="mt-1 text-xs text-app-text-muted">
                            Use this as a quick benchmark against the wider
                            category, not just keyword visibility.
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="font-semibold text-app-text">
                            This app is not in the loaded top chart slice.
                          </p>
                          <p className="mt-1 text-xs text-app-text-muted">
                            Increase the chart scope later if you want deeper
                            snapshots beyond the current top 100.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-app-border/60 bg-app-surface/50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                        Current leaders
                      </p>
                      <p className="text-xs text-app-text-muted">
                        {isLoadingCharts
                          ? "Refreshing..."
                          : `${chartEntries.length} rows`}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {(isLoadingCharts ? [] : chartEntries.slice(0, 10)).map(
                        (entry) => {
                          const isSelected =
                            selectedAppChartId === String(entry.appId);
                          return (
                            <div
                              key={`${entry.chartType}-${entry.appId}`}
                              className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${isSelected ? "border-cyan-500/30 bg-cyan-500/10" : "border-app-border/50 bg-app-surface-muted/50"}`}
                            >
                              <div
                                className={`w-9 text-center text-sm font-bold ${isSelected ? "text-cyan-300" : "text-app-text-muted"}`}
                              >
                                #{entry.position}
                              </div>
                              <img
                                src={entry.icon}
                                alt=""
                                className="h-10 w-10 rounded-xl border border-app-border/50"
                                referrerPolicy="no-referrer"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-app-text">
                                  {entry.title}
                                </p>
                                <p className="truncate text-xs text-app-text-muted">
                                  {entry.developer}
                                </p>
                              </div>
                              {isSelected && (
                                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                                  Your app
                                </span>
                              )}
                            </div>
                          );
                        },
                      )}
                      {!isLoadingCharts &&
                        !chartError &&
                        chartEntries.length === 0 && (
                          <div className="rounded-xl border border-app-border/50 bg-app-surface-muted/50 px-3 py-6 text-center text-sm text-app-text-muted">
                            No chart data available for this store / country /
                            category combination right now.
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between gap-3 text-xs text-app-text-muted">
                    <span>
                      {getChartTypeLabel(selectedChartType)} -{" "}
                      {selectedChartCategory?.label || "Category"} -{" "}
                      {findCountryName(country) || country}
                    </span>
                    <span>
                      {chartLoadedAt
                        ? `Loaded ${formatAlertEventTime(chartLoadedAt)}`
                        : isLoadingCharts
                          ? "Refreshing..."
                          : "No snapshot yet"}
                    </span>
                  </div>
                  {chartError ? (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-300">
                      {chartError}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {isLoadingCharts ? (
                        <div className="flex items-center gap-2 workspace-metric-card text-sm text-app-text-muted">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading category chart snapshot...
                        </div>
                      ) : chartEntries.length === 0 ? (
                        <div className="workspace-metric-card text-sm text-app-text-muted">
                          No chart data available for this combination right
                          now.
                        </div>
                      ) : (
                        chartEntries.slice(0, 20).map((entry) => {
                          const isComparedApp = comparedChartAppIds.has(
                            String(entry.appId),
                          );
                          return (
                            <div
                              key={`${entry.chartType}-${entry.appId}-compare`}
                              className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${isComparedApp ? "border-cyan-500/20 bg-cyan-500/[0.06]" : "border-app-border/50 bg-app-surface-muted/50"}`}
                            >
                              <div
                                className={`w-10 text-center text-sm font-bold ${isComparedApp ? "text-cyan-200" : "text-app-text-muted"}`}
                              >
                                #{entry.position}
                              </div>
                              <img
                                src={entry.icon}
                                alt=""
                                className="h-10 w-10 rounded-xl border border-app-border/50"
                                referrerPolicy="no-referrer"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-app-text">
                                  {entry.title}
                                </p>
                                <p className="truncate text-xs text-app-text-muted">
                                  {entry.developer}
                                </p>
                              </div>
                              {isComparedApp && (
                                <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                                  Compared app
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}{" "}
          {viewMode === "single" && !selectedApp && (
            <WorkspaceEmptyBlock
              icon={Search}
              title="No app selected yet"
              description="Search above to load an app workspace. Once selected, this page switches into keyword, chart, and tracking analysis for that app."
            />
          )}
          {/* Selected App Dashboard */}{" "}
          {viewMode === "single" && selectedApp && (
            <div className={isMobileViewport ? "space-y-4" : "space-y-6"} ref={singleExportRef}>
              {" "}
              {/* App Hero Card */}{" "}
              <div className={`card-glow flex flex-col md:flex-row items-center md:items-start ${isMobileViewport ? "gap-3 p-4" : "gap-6 p-6 md:p-8"}`}>
                {" "}
                {/* Icon with ring */}{" "}
                <div className="relative flex-shrink-0">
                  {" "}
                  <div
                    className={isMobileViewport ? "rounded-[22px] p-1" : "rounded-[28px] p-1"}
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(34, 211, 238,0.3), rgba(129,140,248,0.3))",
                    }}
                  >
                    {" "}
                    <img
                      src={selectedApp.icon}
                      alt={selectedApp.title}
                      className={`${isMobileViewport ? "h-20 w-20 rounded-[18px]" : "h-28 w-28 rounded-[24px] md:h-32 md:w-32"} object-cover`}
                    />{" "}
                  </div>{" "}
                </div>{" "}
                <div className="flex-1 w-full text-center md:text-left">
                  {" "}
                  <div className={`flex flex-col md:flex-row justify-between items-center md:items-start ${isMobileViewport ? "gap-2" : "gap-4"}`}>
                    {" "}
                    <div className="flex-1">
                      {" "}
                      <div className={`flex flex-wrap justify-center md:justify-start items-center ${isMobileViewport ? "mb-1 gap-2" : "mb-1.5 gap-2.5"}`}>
                        {" "}
                        <h2
                          className={`font-display font-bold text-app-text ${isMobileViewport ? "max-w-[16rem]" : ""}`}
                          style={{
                            fontSize: isMobileViewport ? "1.1rem" : "1.75rem",
                            letterSpacing: "-0.03em",
                            lineHeight: "1.1",
                          }}
                        >
                          {selectedApp.title}
                        </h2>{" "}
                        {selectedApp.url && (
                          <a
                            href={selectedApp.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex-shrink-0 transition-all ${isMobileViewport ? "rounded-lg p-1.5" : "rounded-xl p-2"}`}
                            style={{
                              background: "rgba(34, 211, 238,0.08)",
                              border: "1px solid rgba(34, 211, 238,0.2)",
                              color: "#22d3ee",
                            }}
                            title="Open in Store"
                          >
                            {" "}
                            <ExternalLink className={isMobileViewport ? "h-3.5 w-3.5" : "w-4 h-4"} />{" "}
                          </a>
                        )}{" "}
                      </div>{" "}
                      <p className={`${isMobileViewport ? "text-base" : ""} text-app-text-muted font-medium`}>
                        {selectedApp.developer}
                      </p>{" "}
                    </div>{" "}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          toggleBookmark(selectedApp, storeType, country)
                        }
                        className={`transition-all flex items-center justify-center ${isMobileViewport ? "rounded-lg p-2" : "rounded-xl p-2.5"}`}
                        style={
                          isSelectedAppBookmarked
                            ? {
                                background: "rgba(34, 211, 238,0.15)",
                                border: "1px solid rgba(34, 211, 238,0.3)",
                                color: "#22d3ee",
                              }
                            : {
                                background: "rgba(30,41,59,0.7)",
                                border: "1px solid rgba(51,65,85,0.5)",
                                color: "#64748b",
                              }
                        }
                        title={
                          isSelectedAppBookmarked
                            ? "Remove Bookmark"
                            : "Add Bookmark"
                        }
                      >
                        {" "}
                        <Bookmark
                          className={`${isMobileViewport ? "h-4 w-4" : "w-5 h-5"} ${isSelectedAppBookmarked ? "fill-current" : ""}`}
                        />{" "}
                      </button>{" "}
                    </div>{" "}
                  </div>{" "}
                  {/* Stats row */}{" "}
                  <div className={`flex flex-wrap justify-center md:justify-start ${isMobileViewport ? "mt-3 gap-1.5" : "mt-5 gap-2"}`}>
                    {" "}
                    <div className={isMobileViewport ? "stat-card !min-h-0 !rounded-2xl !px-3 !py-2" : "stat-card"}>
                      {" "}
                      <span style={{ color: "#fbbf24", fontSize: isMobileViewport ? "1rem" : "1.125rem" }}>
                        &#9733;
                      </span>{" "}
                      <span className={`${isMobileViewport ? "text-[13px]" : "text-sm"} font-semibold text-app-text font-mono`}>
                        {selectedApp.score
                          ? Number(selectedApp.score).toFixed(1)
                          : "N/A"}
                      </span>{" "}
                    </div>{" "}
                    {selectedApp.installs && (
                      <div className={isMobileViewport ? "stat-card !min-h-0 !rounded-2xl !px-3 !py-2" : "stat-card"}>
                        {" "}
                        <Download
                          className={isMobileViewport ? "h-3.5 w-3.5" : "w-4 h-4"}
                          style={{ color: "#64748b" }}
                        />{" "}
                        <span className={`${isMobileViewport ? "text-[13px]" : "text-sm"} font-medium text-app-text-muted`}>
                          {selectedApp.installs}
                        </span>{" "}
                      </div>
                    )}{" "}
                    {selectedApp.category && (
                      <div className={isMobileViewport ? "stat-card !min-h-0 !rounded-2xl !px-3 !py-2" : "stat-card"}>
                        {" "}
                        <span
                          className="badge badge-cyan"
                          style={{ fontSize: isMobileViewport ? "0.56rem" : "0.625rem" }}
                        >
                          {selectedApp.category}
                        </span>{" "}
                      </div>
                    )}{" "}
                  </div>{" "}
                </div>{" "}
              </div>{" "}
              <div className="space-y-6">
                {" "}
                {/* Compact Search Section for Single Analysis */}
                {viewMode === "single" && selectedApp && renderSearchSection(true)}
                {" "}
                {/* Keyword Ranking Checker */}{" "}
                <div className="workspace-analysis-panel card-glow p-4 sm:p-6 lg:p-7">
                  {" "}
                  <h3 className="section-header mb-2">
                    {" "}
                    <span
                      className="section-header-icon"
                      style={{
                        background: "rgba(16,185,129,0.1)",
                        border: "1px solid rgba(16,185,129,0.2)",
                      }}
                    >
                      {" "}
                      <TrendingUp
                        className="w-4 h-4"
                        style={{ color: "#10b981" }}
                      />{" "}
                    </span>{" "}
                    Keyword discovery{" "}
                  </h3>{" "}
                  <p className="max-w-2xl text-xs text-app-text-muted sm:text-sm">
                    Discovery results include only keywords currently verified for this app.
                  </p>
                  {/* Auto Discovered Rankings */}{" "}
                  <div className="workspace-discovery-block mb-7 mt-5">
                    {" "}
                    <h4 className="text-xs font-bold uppercase tracking-widest text-app-text-muted mb-3">
                      Discovery scan
                    </h4>{" "}
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {" "}
                      <p className="max-w-xl text-xs text-app-text-muted">
                        Fast is quicker; Deep checks a wider candidate set. Switch modes without losing the current results.
                      </p>{" "}
                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                        {" "}
                        <div className="inline-flex rounded-xl border border-app-border/70 bg-app-surface-muted/60 p-1">
                          {" "}
                          {(["fast", "deep"] as DiscoveryMode[]).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              disabled={isDiscoveringKeywords}
                              onClick={() => {
                                if (mode === discoveryMode) return;
                                setDiscoveryMode(mode);
                                if (selectedApp) {
                                  discoverKeywords(
                                    selectedApp,
                                    storeType,
                                    country,
                                    { mode },
                                  );
                                }
                              }}
                              className={`min-h-11 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 ${discoveryMode === mode ? "bg-cyan-500/20 text-cyan-300" : "text-app-text-muted hover:text-app-text"}`}
                            >
                              {" "}
                              {mode}{" "}
                            </button>
                          ))}{" "}
                        </div>{" "}
                        <button
                          type="button"
                          onClick={rerunKeywordDiscovery}
                          disabled={!selectedApp || isDiscoveringKeywords}
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/15 disabled:opacity-50 sm:w-auto"
                        >
                          {" "}
                          {isDiscoveringKeywords ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}{" "}
                          Refresh Scan{" "}
                        </button>{" "}
                      </div>{" "}
                    </div>{" "}
                    <div className="workspace-discovery-status-row" role="status" aria-live="polite">
                      <div className="flex min-w-0 items-center gap-2 text-sm text-app-text-muted">
                        {isDiscoveringKeywords ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cyan-400" />
                        ) : discoveryRunMeta.failedLookups ? (
                          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                        ) : (
                          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
                        )}
                        <span className="truncate">
                          {isDiscoveringKeywords
                            ? `Running ${discoveryMode} discovery. Existing results stay visible while this refreshes.`
                            : discoveryRunMeta.failedLookups
                              ? `Partial scan: ${discoveryRunMeta.failedLookups} lookup${discoveryRunMeta.failedLookups === 1 ? "" : "s"} need retry.`
                              : discoveryRunMeta.checkedKeywords && discoveryRunMeta.candidateCount
                                ? `Checked ${discoveryRunMeta.checkedKeywords}/${discoveryRunMeta.candidateCount} candidates.`
                                : "Verified rankings for this app."}
                        </span>
                      </div>
                    </div>
                    {discoveryError ? (
                      <div className="workspace-discovery-error mt-3" role="alert">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{discoveryError}</span>
                      </div>
                    ) : null}
                    <div className={cn("workspace-discovery-results mt-4 space-y-4", isDiscoveringKeywords && "opacity-75")}>
                      {autoRankings.length > 0 ? (
                        <section className="workspace-discovery-section" aria-labelledby="verified-rankings-heading">
                          <div className="workspace-discovery-section-heading">
                            <div>
                              <h5 id="verified-rankings-heading" className="text-sm font-semibold text-app-text">
                                Verified rankings
                              </h5>
                              <p className="mt-0.5 text-xs text-app-text-muted">
                                Keywords where this app currently ranks.
                              </p>
                            </div>
                            <span className="workspace-status-chip">{autoRankings.length} checked</span>
                          </div>
                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                            {autoRankings.map((keywordItem, index) =>
                              renderDiscoveryKeywordCard(keywordItem, index),
                            )}
                          </div>
                        </section>
                      ) : null}
                      {!isDiscoveringKeywords && autoRankings.length === 0 ? (
                        <div className="workspace-discovery-empty">
                          <Search className="h-5 w-5 text-cyan-400" />
                          <div>
                            <p className="font-semibold text-app-text">No discovery results yet</p>
                            <p className="mt-1 text-xs text-app-text-muted">
                              Run a scan to load verified rankings.
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </div>{" "}
                  </div>{" "}
                  <div className="divider my-6" />{" "}
                  <h4 className="text-xs font-bold text-app-text-muted uppercase tracking-widest mb-4">
                    Check Specific Keyword
                  </h4>{" "}
                  <form
                    onSubmit={checkRanking}
                    className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4 sm:mb-6"
                  >
                    {" "}
                    <div className="relative flex-1">
                      {" "}
                      <input
                        id="keyword-input"
                        name="keyword"
                        aria-label="Keyword to check"
                        type="text"
                        autoComplete="off"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="Enter a keyword to check rank..."
                        className="input-field !py-2.5 sm:!py-[0.875rem] pl-4 pr-4 text-sm sm:text-[0.9375rem]"
                      />{" "}
                    </div>{" "}
                    <button
                      type="submit"
                      disabled={isCheckingRank || !keyword.trim()}
                      className="btn-primary btn-cyan sm:w-auto w-full !py-2.5 sm:!py-[0.875rem] !px-4 sm:!px-8 text-sm sm:text-[0.9375rem]"
                    >
                      {" "}
                      {isCheckingRank ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        "Check Rank"
                      )}{" "}
                    </button>{" "}
                  </form>{" "}
                  {ranking && (
                    <div
                      className="rounded-2xl border text-center relative p-6"
                      style={rankingPanelStyle}
                    >
                      <p
                        className={`mb-4 pr-0 text-sm sm:pr-40 ${
                          isLightTheme ? "text-slate-600" : "text-app-text-muted"
                        }`}
                      >
                        Ranking for{" "}
                        <span
                          className={`font-semibold ${
                            isLightTheme ? "text-slate-900" : "text-app-text"
                          }`}
                        >
                          "{ranking.keyword}"
                        </span>
                      </p>
                      <div className="mb-4 flex flex-wrap justify-center gap-1.5 sm:absolute sm:right-4 sm:top-4 sm:mb-0 sm:max-w-[10rem] sm:justify-end">
                        {getEstimatedDemand(ranking) !== undefined && (
                          <span
                            className="metric-chip badge-cyan"
                            title="Estimated Volume"
                          >
                            Est. Vol {getEstimatedDemand(ranking)}
                          </span>
                        )}
                        {ranking.difficulty !== undefined && (
                          <span
                            className="metric-chip badge-amber"
                            title="Estimated Difficulty"
                          >
                            Est. Diff {ranking.difficulty}
                          </span>
                        )}
                        {ranking.relevance !== undefined && (
                          <span
                            className="metric-chip badge-purple"
                            title="Estimated Relevance"
                          >
                            Est. Rel {ranking.relevance}
                          </span>
                        )}
                      </div>
                      {ranking.rank !== -1 ? (
                        <div className="flex flex-col items-center gap-2">
                          {selectedApp?.icon && (
                            <img
                              src={selectedApp.icon}
                              alt=""
                              className={`w-12 h-12 rounded-2xl shadow-xl ${
                                isLightTheme
                                  ? "border border-sky-200/80"
                                  : "border border-app-border/50"
                              }`}
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <div
                            className="rank-number"
                            style={{ fontSize: "4rem" }}
                          >
                            #{ranking.rank}
                          </div>
                          <p
                            className={`text-xs ${
                              isLightTheme ? "text-slate-600" : "text-app-text-muted"
                            }`}
                          >
                            in{" "}
                            {COUNTRIES.find((c) => c.code === country)?.name ||
                              country}
                          </p>
                        </div>
                      ) : (
                        <div
                          className="text-lg font-semibold py-6"
                          style={{ color: "var(--color-danger)" }}
                        >
                          Not in top 100
                        </div>
                      )}{" "}
                      <div
                        className="mt-5 flex items-center justify-center gap-5 pt-4"
                        style={{
                          borderTop: "1px solid var(--color-border)",
                        }}
                      >
                        {" "}
                        <button
                          onClick={() => checkRanking(undefined, true)}
                          disabled={isCheckingRank}
                          className="text-sm flex items-center gap-1.5 transition-colors font-medium disabled:opacity-40"
                          style={{
                            color: "var(--color-success)",
                          }}
                        >
                          {" "}
                          {isCheckingRank ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4" />
                          )}{" "}
                          Refresh{" "}
                        </button>{" "}
                        <button
                          onClick={() =>
                            selectedApp &&
                            openTrackCountryPicker(
                              ranking.keyword,
                              selectedApp,
                              storeType,
                              country,
                              ranking.rank,
                              true,
                              "own",
                              "manual",
                            )
                          }
                          className={`text-sm flex items-center gap-1.5 transition-colors font-medium ${trackedKeywordGroupKeys.has(getTrackedKeywordGroupKey({ keyword: ranking.keyword, appId: selectedAppTrackedId || "", store: storeType })) ? "text-amber-400" : isLightTheme ? "text-slate-600 hover:text-slate-900" : "text-app-text-muted hover:text-app-text-muted"}`}
                        >
                          {" "}
                          {trackedKeywordGroupKeys.has(
                            getTrackedKeywordGroupKey({
                              keyword: ranking.keyword,
                              appId: selectedAppTrackedId || "",
                              store: storeType,
                            }),
                          ) ? (
                            <>
                              <BellRing className="w-4 h-4" /> Track More
                              Countries
                            </>
                          ) : (
                            <>
                              <Bell className="w-4 h-4" /> Track Keyword
                            </>
                          )}{" "}
                        </button>{" "}
                      </div>{" "}
                    </div>
                  )}{" "}
                </div>{" "}
              </div>{" "}
              {/* Advanced Keyword Analysis Charts Section */}{" "}
              {autoRankings.length > 0 && (
                <div className="workspace-advanced-insights space-y-3">
                  <div className="workspace-advanced-insights-header flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="workspace-chip-label">Advanced insights</p>
                      <h3 className="mt-1 text-base font-semibold text-app-text">
                        Discovery charts
                      </h3>
                      <p className="mt-1 text-xs text-app-text-muted">
                        Explore keyword quality and rank distribution when you need more detail.
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-expanded={isAdvancedInsightsOpen}
                      onClick={() => setIsAdvancedInsightsOpen((open) => !open)}
                      className="workspace-btn-secondary min-h-11 shrink-0 rounded-xl px-3 py-2 text-xs font-semibold"
                    >
                      {isAdvancedInsightsOpen ? "Hide charts" : "Show charts"}
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform",
                          isAdvancedInsightsOpen && "rotate-180",
                        )}
                      />
                    </button>
                  </div>
                  {isAdvancedInsightsOpen ? (
                    <div className="grid gap-5 md:grid-cols-2">
                  {" "}
                  {/* Keyword Density Chart */}{" "}
                  <div className="card p-6">
                    {" "}
                    <h3 className="section-header mb-6">
                      {" "}
                      <span
                        className="section-header-icon"
                        style={{
                          background: "var(--color-brand-soft)",
                          border: "1px solid var(--color-brand-border)",
                        }}
                      >
                        {" "}
                        <BarChart3
                          className="w-4 h-4"
                          style={{ color: "var(--color-brand)" }}
                        />{" "}
                      </span>{" "}
                      Keyword Metrics Density{" "}
                    </h3>{" "}
                      <div
                        className="h-72 w-full min-w-0 rounded-xl p-2"
                      style={chartSurfaceStyle}
                    >
                      {" "}
                      <ResponsiveContainer width="100%" height="100%">
                        {" "}
                        <BarChart
                          data={autoRankings.slice(0, 5)}
                          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                        >
                          {" "}
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke={chartGridStroke}
                          />{" "}
                          <XAxis
                            dataKey="keyword"
                            angle={-45}
                            textAnchor="end"
                            interval={0}
                            height={80}
                            fontSize={12}
                            tick={{ fill: chartAxisLabelColor }}
                          />{" "}
                          <YAxis
                            domain={[0, 100]}
                            fontSize={12}
                            tick={{ fill: chartAxisTickColor }}
                          />{" "}
                          <Tooltip
                            cursor={{
                              fill: "var(--color-brand-soft)",
                            }}
                            contentStyle={chartTooltipStyle}
                          />{" "}
                          <Legend
                            verticalAlign="top"
                            height={36}
                            wrapperStyle={{
                              fontSize: "12px",
                              color: chartLegendTextColor,
                            }}
                          />{" "}
                          <Bar
                            dataKey="demand"
                            name="Estimated Volume"
                            fill="var(--color-brand)"
                            radius={[6, 6, 0, 0]}
                          />{" "}
                          <Bar
                            dataKey="difficulty"
                            name="Estimated Difficulty"
                            fill="var(--color-warning)"
                            radius={[6, 6, 0, 0]}
                          />{" "}
                          <Bar
                            dataKey="relevance"
                            name="Estimated Relevance"
                            fill="var(--color-comparison)"
                            radius={[6, 6, 0, 0]}
                          />{" "}
                        </BarChart>{" "}
                      </ResponsiveContainer>{" "}
                    </div>{" "}
                    <p
                      className={`text-sm mt-6 text-center ${
                        isLightTheme ? "text-slate-600" : "text-app-text-muted"
                      }`}
                    >
                      {" "}
                      This chart visualizes estimated demand, estimated
                      difficulty, and estimated app relevance for your top 5
                      discovered keywords.{" "}
                    </p>{" "}
                  </div>{" "}
                  {/* Radar Chart for Top Keyword */}{" "}
                  <div className="card p-6">
                    {" "}
                    <h3 className="section-header mb-6">
                      {" "}
                      <span
                        className="section-header-icon"
                        style={{
                          background: "var(--color-brand-soft)",
                          border: "1px solid var(--color-brand-border)",
                        }}
                      >
                        {" "}
                        <TrendingUp
                          className="w-4 h-4"
                          style={{ color: "var(--color-brand)" }}
                        />{" "}
                      </span>{" "}
                      Estimated Keyword Profile{" "}
                    </h3>{" "}
                    <div
                      className="h-72 w-full rounded-xl p-2 flex items-center justify-center"
                      style={chartSurfaceStyle}
                    >
                      {" "}
                      <ResponsiveContainer width="100%" height="100%">
                        {" "}
                        <RadarChart
                          cx="50%"
                          cy="50%"
                          outerRadius="70%"
                          data={[
                            {
                              metric: "Est. Volume",
                              value:
                                autoRankings[0]?.demand ??
                                autoRankings[0]?.volume ??
                                0,
                              fullMark: 100,
                            },
                            {
                              metric: "Est. Difficulty",
                              value: autoRankings[0]?.difficulty || 0,
                              fullMark: 100,
                            },
                            {
                              metric: "Est. Relevance",
                              value: autoRankings[0]?.relevance || 0,
                              fullMark: 100,
                            },
                            {
                              metric: "Rank Score",
                              value: Math.max(
                                0,
                                100 - (autoRankings[0]?.rank || 100),
                              ),
                              fullMark: 100,
                            } /* Reverse rank score */,
                          ]}
                        >
                          {" "}
                          <PolarGrid stroke={chartGridStroke} />{" "}
                          <PolarAngleAxis
                            dataKey="metric"
                            tick={{ fill: chartAxisTickColor, fontSize: 12 }}
                          />{" "}
                          <PolarRadiusAxis
                            angle={30}
                            domain={[0, 100]}
                            tick={{ fill: chartAxisLabelColor }}
                          />{" "}
                          <Radar
                            name={autoRankings[0]?.keyword || "Keyword"}
                            dataKey="value"
                            stroke="var(--color-brand)"
                            fill="var(--color-brand)"
                            fillOpacity={0.5}
                          />{" "}
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                          />{" "}
                        </RadarChart>{" "}
                      </ResponsiveContainer>{" "}
                    </div>{" "}
                    <p
                      className={`text-xs mt-4 text-center ${
                        isLightTheme ? "text-slate-600" : "text-app-text-muted"
                      }`}
                    >
                      Profile of top keyword "{autoRankings[0]?.keyword}". Rank
                      Score = proximity to #1.
                    </p>{" "}
                  </div>{" "}
                  {/* Opportunity Matrix */}{" "}
                  <div className="card p-6">
                    {" "}
                    <h3 className="section-header mb-6">
                      {" "}
                      <span
                        className="section-header-icon"
                        style={{
                          background: "var(--color-success-soft)",
                          border: "1px solid var(--color-success-border)",
                        }}
                      >
                        {" "}
                        <Search
                          className="w-4 h-4"
                          style={{ color: "var(--color-success)" }}
                        />{" "}
                      </span>{" "}
                      Opportunity Matrix{" "}
                    </h3>{" "}
                    <div
                      className="h-72 w-full rounded-xl p-2"
                      style={chartSurfaceStyle}
                    >
                      {" "}
                      <ResponsiveContainer width="100%" height="100%">
                        {" "}
                        <ScatterChart
                          margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                        >
                          {" "}
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke={chartGridStroke}
                          />{" "}
                          <XAxis
                            type="number"
                            dataKey="difficulty"
                            name="Estimated Difficulty"
                            domain={[0, 100]}
                            fontSize={12}
                            tick={{ fill: chartAxisLabelColor }}
                          >
                            {" "}
                            <Label
                              value="Estimated Difficulty"
                              position="insideBottom"
                              offset={-15}
                              style={{ fill: chartAxisTickColor, fontSize: 12 }}
                            />{" "}
                          </XAxis>{" "}
                          <YAxis
                            type="number"
                            dataKey="demand"
                            name="Estimated Volume"
                            domain={[0, 100]}
                            fontSize={12}
                            tick={{ fill: chartAxisLabelColor }}
                          >
                            {" "}
                            <Label
                              value="Estimated Volume"
                              angle={-90}
                              position="insideLeft"
                              style={{ fill: chartAxisTickColor, fontSize: 12 }}
                            />{" "}
                          </YAxis>{" "}
                          <ZAxis
                            type="number"
                            dataKey="relevance"
                            range={[50, 400]}
                            name="Estimated Relevance"
                          />{" "}
                          <Tooltip
                            cursor={{ strokeDasharray: "3 3" }}
                            contentStyle={chartTooltipStyle}
                            labelStyle={{
                              color: "var(--color-chart-tooltip-text)",
                              fontWeight: 700,
                            }}
                            itemStyle={{
                              color: "var(--color-text-secondary)",
                            }}
                            formatter={(value, name) => [value, name]}
                          />{" "}
                          <Scatter
                            name="Keywords"
                            data={autoRankings.map((r) => ({
                              name: r.keyword,
                              difficulty: r.difficulty || 0,
                              demand: r.demand ?? r.volume ?? 0,
                              relevance: r.relevance || 0,
                              fill:
                                r.rank <= 10
                                  ? "var(--color-success)"
                                  : r.rank <= 50
                                    ? "var(--color-warning)"
                                    : "var(--color-text-tertiary)",
                            }))}
                          >
                            {" "}
                            {autoRankings.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={
                                  entry.rank <= 10
                                    ? "var(--color-success)"
                                    : entry.rank <= 50
                                      ? "var(--color-warning)"
                                      : "var(--color-text-tertiary)"
                                }
                              />
                            ))}{" "}
                          </Scatter>{" "}
                        </ScatterChart>{" "}
                      </ResponsiveContainer>{" "}
                    </div>{" "}
                    <p
                      className={`text-xs mt-4 text-center ${
                        isLightTheme ? "text-slate-600" : "text-app-text-muted"
                      }`}
                    >
                      Top-left = lower estimated difficulty + higher estimated
                      demand. Bubble size = estimated relevance.
                    </p>{" "}
                  </div>{" "}
                  {/* Rank Distribution Pie */}{" "}
                  <div className="card p-6">
                    {" "}
                    <h3 className="section-header mb-6">
                      {" "}
                      <span
                        className="section-header-icon"
                        style={{
                          background: "var(--color-brand-soft)",
                          border: "1px solid var(--color-brand-border)",
                        }}
                      >
                        {" "}
                        <Layers
                          className="w-4 h-4"
                          style={{ color: "var(--color-brand)" }}
                        />{" "}
                      </span>{" "}
                      Rank Distribution{" "}
                    </h3>{" "}
                    <div
                      className="h-72 w-full rounded-xl p-2 flex items-center justify-center"
                      style={chartSurfaceStyle}
                    >
                      {" "}
                      <ResponsiveContainer width="100%" height="100%">
                        {" "}
                        <PieChart>
                          {" "}
                          <Pie
                            data={[
                              {
                                name: "Top 10",
                                value: autoRankings.filter((r) => r.rank <= 10)
                                  .length,
                              },
                              {
                                name: "Top 11-30",
                                value: autoRankings.filter(
                                  (r) => r.rank > 10 && r.rank <= 30,
                                ).length,
                              },
                              {
                                name: "Top 31-100",
                                value: autoRankings.filter((r) => r.rank > 30)
                                  .length,
                              },
                            ].filter((d) => d.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={70}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {" "}
                            {[
                              {
                                name: "Top 10",
                                value: autoRankings.filter((r) => r.rank <= 10)
                                  .length,
                                color: "var(--color-success)",
                              },
                              {
                                name: "Top 11-30",
                                value: autoRankings.filter(
                                  (r) => r.rank > 10 && r.rank <= 30,
                                ).length,
                                color: "var(--color-warning)",
                              },
                              {
                                name: "Top 31-100",
                                value: autoRankings.filter((r) => r.rank > 30)
                                  .length,
                                color: "var(--color-danger)",
                              },
                            ]
                              .filter((d) => d.value > 0)
                              .map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={entry.color}
                                />
                              ))}{" "}
                          </Pie>{" "}
                          <Tooltip
                            contentStyle={chartTooltipStyle}
                          />{" "}
                          <Legend
                            verticalAlign="bottom"
                            height={36}
                            wrapperStyle={{
                              fontSize: "12px",
                              color: chartLegendTextColor,
                            }}
                          />{" "}
                        </PieChart>{" "}
                      </ResponsiveContainer>{" "}
                    </div>{" "}
                    <p
                      className={`text-xs mt-4 text-center ${
                        isLightTheme ? "text-slate-600" : "text-app-text-muted"
                      }`}
                    >
                      Distribution of discovered keyword rankings across
                      position ranges.
                    </p>{" "}
                  </div>{" "}
                    </div>
                  ) : null}
                </div>
              )}{" "}
            </div>
          )}{" "}
          {false && viewMode === "single" && selectedApp && (
            <div className="mt-6 card p-6">
              <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="section-header">
                    <span
                      className="section-header-icon"
                      style={{
                        background: "rgba(34, 211, 238,0.1)",
                        border: "1px solid rgba(34, 211, 238,0.2)",
                      }}
                    >
                      <BarChart3 className="w-4 h-4 text-cyan-400" />
                    </span>
                    Category Charts
                  </h3>
                  <p className="mt-3 text-sm text-app-text-muted">
                    Snapshot of {getChartTypeLabel(selectedChartType).toLowerCase()} in{" "}
                    {selectedChartCategory?.label || "this category"} for{" "}
                    {findCountryName(country) || country}.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <select
                    value={selectedChartType}
                    onChange={(event) =>
                      setSelectedChartType(event.target.value as ChartType)
                    }
                    className="rounded-xl border border-app-border/70 bg-app-surface/60 px-3 py-2 text-sm text-app-text"
                  >
                    {CHART_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedChartCategoryCode}
                    onChange={(event) =>
                      setSelectedChartCategoryCode(event.target.value)
                    }
                    className="rounded-xl border border-app-border/70 bg-app-surface/60 px-3 py-2 text-sm text-app-text sm:col-span-2"
                    disabled={isLoadingChartCategories || chartCategories.length === 0}
                  >
                    {chartCategories.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
                <div className="rounded-2xl border border-app-border/60 bg-app-surface/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                    {selectedApp.title}
                  </p>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-sm text-app-text-muted">Current chart position</p>
                      <p className="mt-2 font-display text-4xl font-bold text-cyan-300">
                        {selectedAppChartEntry ? `#${selectedAppChartEntry.position}` : "-"}
                      </p>
                    </div>
                    <div className="text-right text-xs text-app-text-muted">
                      <p>{selectedChartCategory?.label || "Category"}</p>
                      <p className="mt-1">{getChartTypeLabel(selectedChartType)}</p>
                      <p className="mt-1">
                        {chartLoadedAt ? `Loaded ${formatAlertEventTime(chartLoadedAt)}` : "Waiting for chart data"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl border border-app-border/50 bg-app-surface-muted/60 px-3 py-3 text-sm text-app-text-muted">
                    {isLoadingCharts ? (
                      <div className="flex items-center gap-2 text-app-text-muted">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading category chart...
                      </div>
                    ) : chartError ? (
                      <div className="text-amber-300">{chartError}</div>
                    ) : selectedAppChartEntry ? (
                      <div>
                        <p className="font-semibold text-app-text">
                          Ranking live in the current snapshot.
                        </p>
                        <p className="mt-1 text-xs text-app-text-muted">
                          Use this as a quick benchmark against the wider category, not just keyword visibility.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="font-semibold text-app-text">
                          This app is not in the loaded top chart slice.
                        </p>
                        <p className="mt-1 text-xs text-app-text-muted">
                          Increase the chart scope later if you want deeper snapshots beyond the current top 100.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-2xl border border-app-border/60 bg-app-surface/50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                      Current leaders
                    </p>
                    <p className="text-xs text-app-text-muted">
                      {isLoadingCharts ? "Refreshing..." : `${chartEntries.length} rows`}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {(isLoadingCharts ? [] : chartEntries.slice(0, 10)).map((entry) => {
                      const isSelected = selectedAppChartId === String(entry.appId);
                      return (
                        <div
                          key={`${entry.chartType}-${entry.appId}`}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${isSelected ? "border-cyan-500/30 bg-cyan-500/10" : "border-app-border/50 bg-app-surface-muted/50"}`}
                        >
                          <div className={`w-9 text-center text-sm font-bold ${isSelected ? "text-cyan-300" : "text-app-text-muted"}`}>
                            #{entry.position}
                          </div>
                          <img
                            src={entry.icon}
                            alt=""
                            className="h-10 w-10 rounded-xl border border-app-border/50"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-app-text">
                              {entry.title}
                            </p>
                            <p className="truncate text-xs text-app-text-muted">
                              {entry.developer}
                            </p>
                          </div>
                          {isSelected && (
                            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                              Your app
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {!isLoadingCharts && !chartError && chartEntries.length === 0 && (
                      <div className="rounded-xl border border-app-border/50 bg-app-surface-muted/50 px-3 py-6 text-center text-sm text-app-text-muted">
                        No chart data available for this store / country / category combination right now.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}{" "}
          {/* Compare Dashboard */}{" "}
          {viewMode === "compare" && (
            <>
            {comparedApps.length === 0 ? (
              <WorkspaceEmptyBlock
                icon={Layers}
                title="No compare set yet"
                description="Use the search composer to add apps into the compare set. Coverage, battle, and opportunity modules will populate after that."
              />
            ) : (
               <div className="workspace-compare-view space-y-6" ref={compareExportRef}>
               <div ref={compareSearchRef}>{renderSearchSection(true)}</div>
               <WorkspacePanel tone="muted" className="workspace-compare-overview workspace-compare-header">
                 <div className="flex flex-col gap-3">
                   <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                     <div className="min-w-0">
                       <div className="workspace-chip-label">Compare workspace</div>
                       <h3 className="mt-1 text-lg font-semibold text-app-text">
                         Compare Apps
                       </h3>
                       <p className="mt-1 text-sm text-app-text-muted">
                         {comparedApps.length} apps · {compareAnalyzedCount}/{comparedApps.length} analyzed ·{" "}
                         {COUNTRIES.find((c) => c.code === country)?.name || country}
                       </p>
                     </div>
                     <button
                       type="button"
                       onClick={() =>
                         compareSearchRef.current?.scrollIntoView({
                           behavior: "smooth",
                           block: "start",
                         })
                       }
                       className="workspace-btn-secondary min-h-11 shrink-0 rounded-xl px-3 py-2 text-xs font-semibold"
                     >
                       <Layers className="h-4 w-4" />
                       Change apps
                     </button>
                   </div>
                   <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                     <WorkspaceMetricCard
                       label="Coverage Leader"
                       value={compareCoverageLeader?.app.title || "-"}
                      hint={
                        compareCoverageLeader
                          ? `${compareCoverageLeader.top100} ranked keywords`
                          : "Awaiting analysis"
                      }
                      accent="cyan"
                    />
                    <WorkspaceMetricCard
                      label="Gap Opportunities"
                      value={compareGapRows.length}
                      hint="Whitespace and uneven coverage"
                       accent="cyan"
                     />
                   </div>
                 </div>
               </WorkspacePanel>
               <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-end">
                 {" "}
                 <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  {" "}
                  <div className="inline-flex rounded-xl border border-app-border/70 bg-app-surface-muted/60 p-1">
                    {" "}
                    {(["fast", "deep"] as DiscoveryMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        disabled={isAnalyzingCompare}
                        onClick={() => {
                          if (mode === compareDiscoveryMode) return;
                          setCompareDiscoveryMode(mode);
                        }}
                        className={`min-h-11 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 ${compareDiscoveryMode === mode ? "bg-cyan-500/20 text-cyan-200" : "text-app-text-muted hover:text-app-text"}`}
                      >
                        {" "}
                        {mode}{" "}
                      </button>
                    ))}{" "}
                  </div>{" "}
                  <button
                    type="button"
                    onClick={() =>
                      void analyzeComparedApps({
                        force: true,
                        mode: compareDiscoveryMode,
                      })
                    }
                    disabled={isAnalyzingCompare || comparedApps.length === 0}
                    className="btn-primary min-h-11 w-full sm:w-auto"
                  >
                    {" "}
                    {isAnalyzingCompare ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}{" "}
                    Refresh Compare{" "}
                  </button>{" "}
                </div>{" "}
              </div>{" "}
              <div className="workspace-compare-status-bar workspace-panel !px-4 !py-3 !flex-col md:!flex-row md:!items-center md:!justify-between gap-2 text-sm text-app-text-muted">
                {" "}
                <span>
                  {" "}
                  Analysis mode:{" "}
                  <span className="font-semibold text-app-text uppercase">
                    {compareDiscoveryMode}
                  </span>{" "}
                </span>{" "}
                <span>
                  {" "}
                  Coverage loaded for{" "}
                  <span className="font-semibold text-app-text">
                    {compareAnalyzedCount}/{comparedApps.length}
                  </span>{" "}
                  apps in{" "}
                  {COUNTRIES.find((c) => c.code === country)?.name || country}
                  .{" "}
                </span>{" "}
              </div>{" "}
              {compareAnalysisError && (
                <div
                  className="rounded-2xl px-4 py-3 text-sm flex items-start gap-3"
                  style={{
                    background: "rgba(245,158,11,0.08)",
                    border: "1px solid rgba(245,158,11,0.18)",
                    color: "#fbbf24",
                  }}
                >
                  {" "}
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />{" "}
                  <span>{compareAnalysisError}</span>{" "}
                </div>
              )}{" "}
              {false && (<div className="card p-6">
                <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <h3 className="section-header">
                      <span
                        className="section-header-icon"
                        style={{
                          background: "rgba(34, 211, 238,0.1)",
                          border: "1px solid rgba(34, 211, 238,0.2)",
                        }}
                      >
                        <Globe className="w-4 h-4 text-cyan-400" />
                      </span>
                      Category Charts
                    </h3>
                    <p className="mt-3 text-sm text-app-text-muted">
                      Compare overall category-chart visibility for this market snapshot, not just keyword rankings.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <select
                      value={selectedChartType}
                      onChange={(event) =>
                        setSelectedChartType(event.target.value as ChartType)
                      }
                      className="rounded-xl border border-app-border/70 bg-app-surface/60 px-3 py-2 text-sm text-app-text"
                    >
                      {CHART_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedChartCategoryCode}
                      onChange={(event) =>
                        setSelectedChartCategoryCode(event.target.value)
                      }
                      className="rounded-xl border border-app-border/70 bg-app-surface/60 px-3 py-2 text-sm text-app-text sm:col-span-2"
                      disabled={isLoadingChartCategories || chartCategories.length === 0}
                    >
                      {chartCategories.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mb-3 flex items-center justify-between gap-3 text-xs text-app-text-muted">
                  <span>
                    {getChartTypeLabel(selectedChartType)} - {selectedChartCategory?.label || "Category"} - {findCountryName(country) || country}
                  </span>
                  <span>
                    {chartLoadedAt
                      ? `Loaded ${formatAlertEventTime(chartLoadedAt)}`
                      : isLoadingCharts
                        ? "Refreshing..."
                        : "No snapshot yet"}
                  </span>
                </div>
                {chartError ? (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-300">
                    {chartError}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {isLoadingCharts ? (
                      <div className="flex items-center gap-2 workspace-metric-card text-sm text-app-text-muted">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading category chart snapshot...
                      </div>
                    ) : chartEntries.length === 0 ? (
                      <div className="workspace-metric-card text-sm text-app-text-muted">
                        No chart data available for this combination right now.
                      </div>
                    ) : (
                      chartEntries.slice(0, 20).map((entry) => {
                        const isComparedApp = comparedChartAppIds.has(String(entry.appId));
                        return (
                          <div
                            key={`${entry.chartType}-${entry.appId}-compare`}
                            className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${isComparedApp ? "border-cyan-500/20 bg-cyan-500/[0.06]" : "border-app-border/50 bg-app-surface-muted/50"}`}
                          >
                            <div className={`w-10 text-center text-sm font-bold ${isComparedApp ? "text-cyan-200" : "text-app-text-muted"}`}>
                              #{entry.position}
                            </div>
                            <img
                              src={entry.icon}
                              alt=""
                              className="h-10 w-10 rounded-xl border border-app-border/50"
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-app-text">
                                {entry.title}
                              </p>
                              <p className="truncate text-xs text-app-text-muted">
                                {entry.developer}
                              </p>
                            </div>
                            {isComparedApp && (
                              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                                Compared app
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>)}{" "}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {" "}
                {compareAppInsights.map((insight) => (
                  <div
                    key={insight.compareKey}
                    className={`workspace-compare-app-card workspace-panel relative transition-all hover:shadow-cyan-500/10 hover:border-cyan-500/30 ${
                      isMobileViewport ? "!p-3" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => removeCompareApp(insight.appDetails)}
                      aria-label={`Remove ${insight.appDetails.title} from compare set`}
                      className="workspace-compare-remove absolute right-3 top-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-app-surface-muted/80 text-app-text-muted shadow-sm transition-colors hover:bg-red-500 hover:text-white"
                    >
                      {" "}
                      <X className="w-3.5 h-3.5" />{" "}
                    </button>{" "}
                    {isMobileViewport ? (
                      <div className="flex items-center gap-3 pr-10">
                        <img
                          src={insight.appDetails.icon}
                          alt={insight.appDetails.title}
                          className="h-12 w-12 flex-shrink-0 rounded-2xl border border-app-border/50 shadow-sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h3 className="truncate text-sm font-semibold text-app-text">
                              {insight.appDetails.title}
                            </h3>
                            {insight.appDetails.url && (
                              <a
                                href={insight.appDetails.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0 rounded-md bg-cyan-500/10 p-1 text-cyan-400 transition-colors hover:bg-cyan-500 hover:text-app-text"
                                title="Open in Store"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-[11px] font-medium text-app-text-muted">
                            {insight.appDetails.developer}
                          </p>
                          <span className="workspace-compare-role-chip mt-2 inline-flex">
                            In compare set
                          </span>
                          <p className="mt-1 truncate text-[11px] text-app-text-muted">
                            {insight.top10}/{insight.top30}/{insight.top100} top 10/30/100
                            {" · "}
                            {insight.averageRank ? `avg #${insight.averageRank}` : "no avg"}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <img
                          src={insight.appDetails.icon}
                          alt={insight.appDetails.title}
                          className="w-16 h-16 rounded-2xl shadow-md mb-4 border border-app-border/50"
                        />{" "}
                        <div className="flex items-center gap-1.5 justify-center mb-1">
                          {" "}
                          <h3 className="font-semibold text-app-text text-sm line-clamp-1">
                            {insight.appDetails.title}
                          </h3>{" "}
                          {insight.appDetails.url && (
                            <a
                              href={insight.appDetails.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-400 hover:text-app-text transition-colors flex-shrink-0 bg-cyan-500/10 hover:bg-cyan-500 p-1.5 rounded-md"
                              title="Open in Store"
                            >
                              {" "}
                              <ExternalLink className="w-3 h-3" />{" "}
                            </a>
                          )}{" "}
                        </div>{" "}
                        <p className="text-[11px] text-app-text-muted font-medium line-clamp-1 mb-4">
                          {insight.appDetails.developer}
                        </p>{" "}
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                          <span className="workspace-compare-role-chip">
                            In compare set
                          </span>
                        </div>
                        <div className="w-full space-y-3 mb-4">
                          {" "}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {" "}
                            <div className="rounded-xl border border-app-border/70 bg-app-surface/70 px-3 py-2 text-app-text-muted">
                              {" "}
                              Top 10 / 30 / 100{" "}
                              <div className="mt-1 font-semibold text-app-text">
                                {insight.top10} / {insight.top30} / {insight.top100}
                              </div>{" "}
                            </div>{" "}
                            <div className="rounded-xl border border-app-border/70 bg-app-surface/70 px-3 py-2 text-app-text-muted">
                              {" "}
                              Avg Rank{" "}
                              <div className="mt-1 font-semibold text-app-text">
                                {insight.averageRank
                                  ? `#${insight.averageRank}`
                                  : "No data"}
                              </div>{" "}
                            </div>{" "}
                          </div>{" "}
                          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-left text-xs">
                            {" "}
                            <div className="uppercase tracking-wide text-cyan-300/70">
                              Strongest Keyword
                            </div>{" "}
                            <div className="mt-1 text-app-text font-medium">
                              {insight.strongestKeyword
                                ? `${insight.strongestKeyword.keyword} (#${insight.strongestKeyword.rank})`
                                : "No ranked keywords yet"}
                            </div>{" "}
                          </div>{" "}
                          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-left text-xs">
                            {" "}
                            <div className="uppercase tracking-wide text-cyan-300/70">
                              Next Opportunity
                            </div>{" "}
                            <div className="mt-1 text-app-text font-medium">
                              {insight.bestSuggestion
                                ? insight.bestSuggestion.keyword
                                : "No suggestion surfaced yet"}
                            </div>{" "}
                          </div>{" "}
                        </div>{" "}
                        <div className="mt-auto text-xs font-semibold text-app-text bg-app-surface px-3 py-2 rounded-xl w-full border border-app-border/80 shadow-inner flex items-center justify-center gap-1.5">
                          {" "}
                          <span className="text-amber-400 text-sm">&#9733;</span>{" "}
                          {insight.appDetails.score
                            ? Number(insight.appDetails.score).toFixed(1)
                            : "N/A"}{" "}
                        </div>{" "}
                      </>
                    )}
                  </div>
                ))}{" "}
              </div>{" "}
              {compareAnalyzedCount > 0 ? (
                <div className="space-y-6">
                  {" "}
                  <div className={`grid xl:grid-cols-[1.05fr_0.95fr] ${isMobileViewport ? "gap-3" : "gap-6"}`}>
                    {" "}
                    <div className={`card ${isMobileViewport ? "p-3" : "p-6"}`}>
                      {" "}
                      <h3 className="section-header mb-6">
                        {" "}
                        <span
                          className="section-header-icon"
                          style={{
                            background: "rgba(34, 211, 238,0.1)",
                            border: "1px solid rgba(34, 211, 238,0.2)",
                          }}
                        >
                          {" "}
                          <BarChart3
                            className="w-4 h-4"
                            style={{ color: "var(--color-brand)" }}
                          />{" "}
                        </span>{" "}
                        Search Footprint Snapshot{" "}
                      </h3>{" "}
                      <div
                        className={`workspace-compare-chart ${isMobileViewport ? "h-40 p-1.5" : "h-72 p-2"} w-full min-w-0 rounded-xl`}
                        style={chartSurfaceStyle}
                      >
                        {" "}
                        <ResponsiveContainer width="100%" height="100%">
                          {" "}
                          <BarChart
                            data={compareCoverageChartData}
                            layout={isMobileViewport ? "vertical" : "horizontal"}
                            barCategoryGap={isMobileViewport ? 8 : 16}
                            margin={
                              isMobileViewport
                                ? { top: 12, right: 12, left: 0, bottom: 4 }
                                : { top: 20, right: 20, left: 0, bottom: 50 }
                            }
                          >
                            {" "}
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                              stroke={chartGridStroke}
                            />{" "}
                            {isMobileViewport ? (
                              <>
                                <XAxis
                                  type="number"
                                  allowDecimals={false}
                                  fontSize={11}
                                  tick={{ fill: chartAxisTickColor }}
                                  axisLine={{ stroke: chartGridStroke }}
                                  tickLine={{ stroke: chartGridStroke }}
                                />
                                <YAxis
                                  type="category"
                                  dataKey="appTitle"
                                  width={92}
                                  fontSize={11}
                                  tick={{ fill: chartAxisTickColor }}
                                  tickFormatter={formatCompareCoverageAxisLabel}
                                  axisLine={false}
                                  tickLine={false}
                                />
                              </>
                            ) : (
                              <>
                                <XAxis
                                  dataKey="appTitle"
                                  angle={-20}
                                  textAnchor="end"
                                  interval={0}
                                  height={60}
                                  fontSize={12}
                                  tick={{ fill: chartAxisTickColor }}
                                  tickFormatter={formatCompareCoverageAxisLabel}
                                  axisLine={{ stroke: chartGridStroke }}
                                  tickLine={{ stroke: chartGridStroke }}
                                />{" "}
                                <YAxis
                                  fontSize={12}
                                  tick={{ fill: chartAxisTickColor }}
                                  axisLine={{ stroke: chartGridStroke }}
                                  tickLine={{ stroke: chartGridStroke }}
                                  allowDecimals={false}
                                />{" "}
                              </>
                            )}
                            <Tooltip
                              contentStyle={chartTooltipStyle}
                              formatter={(value: number, name: string) => [
                                value,
                                name,
                              ]}
                              labelFormatter={(label) => String(label)}
                            />{" "}
                            <Legend
                              verticalAlign="top"
                              align={isMobileViewport ? "left" : "center"}
                              height={isMobileViewport ? 24 : 36}
                              iconSize={isMobileViewport ? 10 : 14}
                              wrapperStyle={{
                                fontSize: isMobileViewport ? "11px" : "12px",
                                color: chartLegendTextColor,
                              }}
                            />{" "}
                            <Bar
                              dataKey="top10"
                              name="Top 10"
                              fill="var(--color-success)"
                              radius={[6, 6, 0, 0]}
                            />{" "}
                            <Bar
                              dataKey="top30"
                              name="Top 30"
                              fill="var(--color-warning)"
                              radius={[6, 6, 0, 0]}
                            />{" "}
                            <Bar
                              dataKey="top100"
                              name="Top 100"
                              fill="var(--color-comparison)"
                              radius={[6, 6, 0, 0]}
                            />{" "}
                          </BarChart>{" "}
                        </ResponsiveContainer>{" "}
                      </div>{" "}
                      <p className={`${isMobileViewport ? "mt-3 text-xs line-clamp-2" : "mt-5 text-sm"} text-app-text-muted`}>
                        {" "}
                        This gives a fast read on how much ranked keyword
                        coverage each app has, not just who wins on a single
                        term.{" "}
                      </p>{" "}
                      <div className={`grid md:grid-cols-3 ${isMobileViewport ? "mt-3 gap-2" : "mt-5 gap-3"}`}>
                        <div className={`workspace-panel ${isMobileViewport ? "!px-3 !py-2.5" : "!px-4 !py-3"}`}>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                            Coverage leader
                          </p>
                          <p className={`${isMobileViewport ? "mt-1.5 text-xs" : "mt-2 text-sm"} font-semibold text-app-text`}>
                            {compareCoverageLeader?.appDetails.title || "No data"}
                          </p>
                          <p className={`${isMobileViewport ? "line-clamp-2" : ""} mt-1 text-xs text-app-text-muted`}>
                            {compareCoverageLeader
                              ? `${compareCoverageLeader.top100} top-100 rankings`
                              : "Refresh compare analysis to load coverage data."}
                          </p>
                        </div>
                        <div className={`workspace-panel ${isMobileViewport ? "!px-3 !py-2.5" : "!px-4 !py-3"}`}>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                            Contested keywords
                          </p>
                          <p className={`${isMobileViewport ? "mt-1.5 text-xs" : "mt-2 text-sm"} font-semibold text-app-text`}>
                            {compareSharedBattles.length}
                          </p>
                          <p className="mt-1 text-xs text-app-text-muted">
                            Terms where multiple compared apps already rank.
                          </p>
                        </div>
                        <div className={`workspace-panel ${isMobileViewport ? "!px-3 !py-2.5" : "!px-4 !py-3"}`}>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                            Opportunity gaps
                          </p>
                          <p className={`${isMobileViewport ? "mt-1.5 text-xs" : "mt-2 text-sm"} font-semibold text-app-text`}>
                            {compareGapRows.length}
                          </p>
                          <p className="mt-1 text-xs text-app-text-muted">
                            Keywords with whitespace or uneven coverage.
                          </p>
                        </div>
                      </div>
                      <div className={`workspace-panel ${isMobileViewport ? "mt-3 !px-3 !py-2.5" : "mt-5"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                            Coverage ladder
                          </p>
                          <p className="text-xs text-app-text-muted">
                            {compareCoverageLeaders.length} apps ranked
                          </p>
                        </div>
                        <div className={`${isMobileViewport ? "mt-2 space-y-1.5" : "mt-3 space-y-2"}`}>
                          {compareCoverageLeaders.map((insight, index) => (
                            <div
                              key={`coverage-leader-${insight.compareKey}`}
                              className={`workspace-metric-card !flex-row items-center ${isMobileViewport ? "gap-2 !px-2.5 !py-2" : "gap-3 !px-3 !py-2.5"}`}
                            >
                              <div className="w-8 text-center text-xs font-bold text-app-text-muted">
                                #{index + 1}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={`${isMobileViewport ? "text-xs" : "text-sm"} truncate font-semibold text-app-text`}>
                                  {insight.appDetails.title}
                                </p>
                                <p className="truncate text-xs text-app-text-muted">
                                  {insight.top10}/{insight.top30}/{insight.top100} in
                                  top 10/30/100
                                </p>
                              </div>
                              <div className="text-right text-xs text-app-text-muted">
                                <p className="font-semibold text-app-text">
                                  {insight.averageRank
                                    ? `#${insight.averageRank}`
                                    : "No avg"}
                                </p>
                                <p className="mt-1">avg rank</p>
                              </div>
                            </div>
                          ))}
                          {compareCoverageLeaders.length === 0 && (
                            <p className="text-sm text-app-text-muted">
                              Coverage details appear here after compare analysis
                              loads.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>{" "}
                    <div className={`card ${isMobileViewport ? "p-3" : "p-6"}`}>
                      {" "}
                      <h3 className="section-header mb-6">
                        {" "}
                        <span
                          className="section-header-icon"
                          style={{
                            background: "var(--color-success-soft)",
                            border: "1px solid var(--color-success-border)",
                          }}
                        >
                          {" "}
                          <Globe className="w-4 h-4 text-[color:var(--color-success)]" />{" "}
                        </span>{" "}
                        Highest-Value Gaps{" "}
                      </h3>{" "}
                      <div className={`${isMobileViewport ? "space-y-2" : "space-y-3"}`}>
                        {" "}
                        {compareGapRows.length > 0 ? (
                          compareGapRows.slice(0, 5).map((gapRow, index) => (
                            <div
                              key={`${gapRow.keyword}-${index}`}
                              className={`workspace-panel ${isMobileViewport ? "!px-3 !py-2.5" : ""}`}
                            >
                              {" "}
                              <div className="flex items-start justify-between gap-3">
                                {" "}
                                <div>
                                  {" "}
                                  <div className={`${isMobileViewport ? "text-sm" : ""} font-semibold text-app-text`}>
                                    {gapRow.keyword}
                                  </div>{" "}
                                  <div className={`${isMobileViewport ? "line-clamp-2" : ""} mt-1 text-xs text-app-text-muted`}>
                                    {" "}
                                    {gapRow.isWhitespace
                                      ? `Emerging whitespace: suggested across ${gapRow.rankedApps.length + gapRow.missingApps.length} apps, but nobody ranks yet.`
                                      : `${gapRow.leader?.appTitle} leads at #${gapRow.leader?.rank}; ${gapRow.missingApps.length} app${gapRow.missingApps.length === 1 ? "" : "s"} are absent.`}{" "}
                                  </div>{" "}
                                </div>{" "}
                                <span className="badge badge-cyan">
                                  Score {gapRow.score}
                                </span>{" "}
                              </div>{" "}
                              <div className={`flex flex-wrap text-xs ${isMobileViewport ? "mt-2 gap-1.5" : "mt-3 gap-2"}`}>
                                {" "}
                                <span className="metric-chip badge-cyan">
                                  Est. Vol {gapRow.averageVolume}
                                </span>{" "}
                                <span className="metric-chip badge-amber">
                                  Est. Diff {gapRow.averageDifficulty}
                                </span>{" "}
                                <span className="metric-chip badge-purple">
                                  Est. Rel {gapRow.averageRelevance}
                                </span>{" "}
                              </div>{" "}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-app-text-muted">
                            No opportunity gaps yet. Refresh compare analysis to
                            expand the keyword set.
                          </p>
                        )}{" "}
                      </div>{" "}
                    </div>{" "}
                  </div>{" "}
                  <div className={`grid xl:grid-cols-2 ${isMobileViewport ? "gap-3" : "gap-6"}`}>
                    {" "}
                    <div className={`card ${isMobileViewport ? "p-3" : "p-6"}`}>
                      {" "}
                      <h3 className="section-header mb-6">
                        {" "}
                        <span
                          className="section-header-icon"
                          style={{
                            background: "var(--color-brand-soft)",
                            border: "1px solid var(--color-brand-border)",
                          }}
                        >
                          {" "}
                          <Layers
                            className="w-4 h-4"
                            style={{ color: "var(--color-brand)" }}
                          />{" "}
                        </span>{" "}
                        Contested Keywords{" "}
                      </h3>{" "}
                      <div className={`${isMobileViewport ? "space-y-2" : "space-y-3"}`}>
                        {" "}
                        {compareSharedBattles.length > 0 ? (
                          compareSharedBattles.map((battle) => (
                            <div
                              key={battle.keyword}
                              className={`workspace-panel ${isMobileViewport ? "!px-3 !py-2.5" : ""}`}
                            >
                              {" "}
                              <div className={`flex flex-col md:flex-row md:items-start md:justify-between ${isMobileViewport ? "gap-2" : "gap-3"}`}>
                                {" "}
                                <div>
                                  {" "}
                                  <div className={`${isMobileViewport ? "text-sm" : ""} font-semibold text-app-text`}>
                                    {battle.keyword}
                                  </div>{" "}
                                  <div className={`${isMobileViewport ? "line-clamp-2" : ""} mt-1 text-xs text-app-text-muted`}>
                                    {" "}
                                    Winner: {battle.leader.appTitle} at #{battle.leader.rank};
                                    the next ranked app is {battle.gap} position{battle.gap === 1 ? "" : "s"} behind.{" "}
                                  </div>{" "}
                                </div>{" "}
                                <div className={`flex flex-wrap text-xs ${isMobileViewport ? "gap-1.5" : "gap-2"}`}>
                                  {" "}
                                  <span className="metric-chip badge-amber">
                                    Rank gap {battle.gap}
                                  </span>{" "}
                                  <span className="metric-chip badge-cyan">
                                    Est. Vol {battle.averageVolume}
                                  </span>{" "}
                                  <span className="metric-chip badge-amber">
                                    Est. Diff {battle.averageDifficulty}
                                  </span>{" "}
                                  <span className="metric-chip badge-purple">
                                    Est. Rel {battle.averageRelevance}
                                  </span>{" "}
                                </div>{" "}
                              </div>{" "}
                              <div className={`flex flex-wrap ${isMobileViewport ? "mt-2 gap-1.5" : "mt-3 gap-2"}`}>
                                {" "}
                                {battle.rankedApps.map((rankedApp) => (
                                  <span
                                    key={`${battle.keyword}-${rankedApp.appKey}`}
                                    className={`workspace-compare-rank-chip rounded-lg border text-xs font-semibold ${isMobileViewport ? "px-2.5 py-1" : "px-3 py-1.5"} ${rankedApp.appKey === battle.leader.appKey ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-300" : "bg-app-surface-muted/80 border-app-border/80 text-app-text-muted"}`}
                                  >
                                    {" "}
                                    {rankedApp.appTitle} #{rankedApp.rank}{rankedApp.appKey === battle.leader.appKey ? " · winner" : ""}{" "}
                                  </span>
                                ))}{" "}
                              </div>{" "}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-app-text-muted">
                            No overlapping ranked keywords surfaced yet.
                          </p>
                        )}{" "}
                      </div>{" "}
                    </div>{" "}
                    <div className={`card ${isMobileViewport ? "p-3" : "p-6"}`}>
                      {" "}
                      <h3 className="section-header mb-6">
                        {" "}
                        <span
                          className="section-header-icon"
                          style={{
                            background: "rgba(16,185,129,0.1)",
                            border: "1px solid rgba(16,185,129,0.2)",
                          }}
                        >
                          {" "}
                          <Search
                            className="w-4 h-4"
                            style={{ color: "var(--color-success)" }}
                          />{" "}
                        </span>{" "}
                        Gap Opportunities{" "}
                      </h3>{" "}
                      <div className="space-y-3">
                        {" "}
                        {compareGapRows.length > 0 ? (
                          compareGapRows.map((gapRow, index) => (
                            <div
                              key={`${gapRow.keyword}-${index}`}
                              className={`workspace-panel ${
                                isMobileViewport ? "!px-3 !py-2.5" : ""
                              }`}
                            >
                              {" "}
                              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                {" "}
                                <div>
                                  {" "}
                                  <div className={`${isMobileViewport ? "text-sm" : ""} font-semibold text-app-text`}>
                                    {gapRow.keyword}
                                  </div>{" "}
                                  <div
                                    className={`mt-1 text-xs text-app-text-muted ${
                                      isMobileViewport ? "line-clamp-2" : ""
                                    }`}
                                  >
                                    {" "}
                                    {gapRow.isWhitespace
                                      ? `Suggested by multiple apps, but none currently rank.`
                                      : `${gapRow.leader?.appTitle} owns the visibility here while ${gapRow.missingApps.join(", ")} are absent.`}{" "}
                                  </div>{" "}
                                </div>{" "}
                                <span className="badge badge-cyan">
                                  Priority {gapRow.score}
                                </span>{" "}
                              </div>{" "}
                              <div
                                className={`flex flex-wrap text-xs ${
                                  isMobileViewport ? "mt-2 gap-1.5" : "mt-3 gap-2"
                                }`}
                              >
                                {" "}
                                <span className="metric-chip badge-cyan">
                                  Est. Vol {gapRow.averageVolume}
                                </span>{" "}
                                <span className="metric-chip badge-amber">
                                  Est. Diff {gapRow.averageDifficulty}
                                </span>{" "}
                                <span className="metric-chip badge-purple">
                                  Est. Rel {gapRow.averageRelevance}
                                </span>{" "}
                              </div>{" "}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-app-text-muted">
                            No gap opportunities surfaced yet.
                          </p>
                        )}{" "}
                      </div>{" "}
                    </div>{" "}
                  </div>{" "}
                  <div className={`card ${isMobileViewport ? "p-3" : "p-6 md:p-8"}`}>
                    {" "}
                    <h3 className="section-header mb-6">
                      {" "}
                      <span
                        className="section-header-icon"
                        style={{
                          background: "rgba(16,185,129,0.1)",
                          border: "1px solid rgba(16,185,129,0.2)",
                        }}
                      >
                        {" "}
                        <TrendingUp className="w-4 h-4 text-cyan-400" />{" "}
                      </span>{" "}
                      Keyword Battle{" "}
                    </h3>{" "}
                    <form
                      onSubmit={checkCompareRanking}
                      className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4"
                    >
                      {" "}
                      <div className="relative flex-1">
                        {" "}
                        <input
                          id="compare-keyword-input"
                          name="compareKeyword"
                          aria-label="Keyword to compare"
                          type="text"
                          autoComplete="off"
                          value={compareKeyword}
                          onChange={(e) => setCompareKeyword(e.target.value)}
                          placeholder="Enter a keyword to compare..."
                          className="input-field !py-2.5 sm:!py-[0.875rem] text-sm sm:text-[0.9375rem]"
                        />{" "}
                      </div>{" "}
                      <button
                        type="submit"
                        disabled={
                          isCheckingCompareRank || !compareKeyword.trim()
                        }
                        className="btn-primary btn-cyan sm:w-auto w-full !py-2.5 sm:!py-[0.875rem] !px-4 sm:!px-8 text-sm sm:text-[0.9375rem]"
                      >
                        {" "}
                        {isCheckingCompareRank ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          "Check All"
                        )}{" "}
                      </button>{" "}
                    </form>{" "}
                    <p className={`${isMobileViewport ? "mb-3 line-clamp-2" : "mb-6"} text-xs text-app-text-muted`}>
                      {" "}
                      Relevance is estimated per app, so this section is useful
                      for side-by-side fit as well as rank.{" "}
                    </p>{" "}
                    {compareRankings.length > 0 && (
                      <div className={`${isMobileViewport ? "space-y-2" : "space-y-3"}`}>
                        {" "}
                        <p className="text-sm text-app-text-muted">
                          Rankings for "{compareKeyword}"
                        </p>{" "}
                        {compareRankings.map((result, index) => (
                          <div
                            key={`${result.appTitle}-${index}`}
                            className={`workspace-panel !flex-col md:!flex-row md:!items-center md:!justify-between ${isMobileViewport ? "!px-3 !py-2.5 gap-2" : "gap-3"}`}
                          >
                            {" "}
                            <div>
                              {" "}
                              <div className={`${isMobileViewport ? "text-sm" : ""} font-medium text-app-text`}>
                                {result.appTitle}
                              </div>{" "}
                              <div className={`flex flex-wrap text-xs ${isMobileViewport ? "mt-1.5 gap-1.5" : "mt-2 gap-2"}`}>
                                {" "}
                                {getEstimatedDemand(result) !== undefined && (
                                  <span className="metric-chip badge-cyan">
                                    Est. Vol {getEstimatedDemand(result)}
                                  </span>
                                )}{" "}
                                {result.difficulty !== undefined && (
                                  <span className="metric-chip badge-amber">
                                    Est. Diff {result.difficulty}
                                  </span>
                                )}{" "}
                                {result.relevance !== undefined && (
                                  <span className="metric-chip badge-purple">
                                    Est. Rel {result.relevance}
                                  </span>
                                )}{" "}

                              </div>{" "}
                            </div>{" "}
                            {result.rank !== -1 ? (
                              <span className="bg-cyan-500/20 text-cyan-300 font-bold px-3 py-1.5 rounded-lg whitespace-nowrap shadow-sm">
                                {" "}
                                #{result.rank}{" "}
                              </span>
                            ) : (
                              <span className="bg-app-surface-strong text-app-text-muted font-medium px-3 py-1.5 rounded-lg text-sm whitespace-nowrap">
                                {" "}
                                &gt; 100{" "}
                              </span>
                            )}{" "}
                          </div>
                        ))}{" "}
                      </div>
                    )}{" "}
                  </div>{" "}
                </div>
              ) : (
                <div className="card p-8 text-center text-app-text-muted">
                  {" "}
                  {isAnalyzingCompare ? (
                    <div className="flex items-center justify-center gap-3">
                      {" "}
                      <Loader2 className="w-5 h-5 animate-spin" /> Running
                      compare analysis. This can take a little longer...{" "}
                    </div>
                  ) : (
                    "No compare analysis loaded yet. Refresh the compare set to generate the footprint and opportunity views."
                  )}{" "}
                </div>
              )}{" "}
            </div>
            )}
            </>
          )}{" "}
          {false && viewMode === "charts" && (
            <div className="space-y-6">
              <div className="card p-6 md:p-7">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <h2 className="section-header">
                      <span
                        className="section-header-icon"
                        style={{
                          background: "rgba(34, 211, 238,0.1)",
                          border: "1px solid rgba(34, 211, 238,0.2)",
                        }}
                      >
                        <BarChart3 className="w-4 h-4 text-cyan-400" />
                      </span>
                      Top Charts
                    </h2>
                    <p className="mt-2 text-sm text-app-text-muted">
                      Browse the market directly by store, country, chart type,
                      and category without mixing that workflow into app
                      analysis.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-app-border/60 bg-app-surface/45 px-3 py-1.5 text-app-text-muted">
                      {findCountryName(country) || country}
                    </span>
                    <span className="rounded-full border border-app-border/60 bg-app-surface/45 px-3 py-1.5 text-cyan-300">
                      {getChartTypeLabel(selectedChartType)}
                    </span>
                    <span className="rounded-full border border-app-border/60 bg-app-surface/45 px-3 py-1.5 text-app-text-muted">
                      {selectedChartCategory?.label || "Category"}
                    </span>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
                  <select
                    value={selectedChartType}
                    onChange={(event) =>
                      setSelectedChartType(event.target.value as ChartType)
                    }
                    className="rounded-xl border border-app-border/70 bg-app-surface/60 px-3 py-2.5 text-sm text-app-text"
                  >
                    {CHART_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedChartCategoryCode}
                    onChange={(event) =>
                      setSelectedChartCategoryCode(event.target.value)
                    }
                    className="rounded-xl border border-app-border/70 bg-app-surface/60 px-3 py-2.5 text-sm text-app-text"
                    disabled={
                      isLoadingChartCategories || chartCategories.length === 0
                    }
                  >
                    {chartCategories.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <div className="rounded-xl border border-app-border/60 bg-app-surface/45 px-4 py-2.5 text-sm text-app-text-muted">
                    {chartLoadedAt
                      ? `Loaded ${formatAlertEventTime(chartLoadedAt)}`
                      : isLoadingCharts
                        ? "Refreshing..."
                        : "No snapshot yet"}
                  </div>
                </div>
              </div>
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="card p-6">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                        Leaderboard
                      </p>
                      <p className="mt-2 text-sm text-app-text-muted">
                        {selectedChartCategory?.label || "Category"} in{" "}
                        {findCountryName(country) || country}.
                      </p>
                    </div>
                    <p className="text-xs text-app-text-muted">
                      {isLoadingCharts ? "Refreshing..." : `${chartEntries.length} rows`}
                    </p>
                  </div>
                  {chartError ? (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-300">
                      {chartError}
                    </div>
                  ) : isLoadingCharts ? (
                    <div className="flex items-center gap-2 workspace-metric-card text-sm text-app-text-muted">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading chart leaderboard...
                    </div>
                  ) : chartEntries.length === 0 ? (
                    <div className="workspace-empty-block !py-10">
                      No chart data available for this store / country /
                      category combination right now.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {chartEntries.slice(0, 25).map((entry) => {
                        const isSelected =
                          selectedAppChartId === String(entry.appId);
                        const isCompared = comparedChartAppIds.has(
                          String(entry.appId),
                        );
                        return (
                          <div
                            key={`${entry.chartType}-${entry.appId}-page`}
                            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${isSelected ? "border-cyan-500/30 bg-cyan-500/10" : isCompared ? "border-cyan-500/20 bg-cyan-500/[0.06]" : "border-app-border/50 bg-app-surface-muted/50"}`}
                          >
                            <div
                              className={`w-10 text-center text-sm font-bold ${isSelected ? "text-cyan-300" : isCompared ? "text-cyan-200" : "text-app-text-muted"}`}
                            >
                              #{entry.position}
                            </div>
                            <img
                              src={entry.icon}
                              alt=""
                              className="h-11 w-11 rounded-xl border border-app-border/50"
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-app-text">
                                {entry.title}
                              </p>
                              <p className="truncate text-xs text-app-text-muted">
                                {entry.developer}
                              </p>
                            </div>
                            {isSelected ? (
                              <span className="rounded-full border border-cyan-500/30 bg-cyan-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-200">
                                Selected app
                              </span>
                            ) : isCompared ? (
                              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                                Compared
                              </span>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="space-y-6">
                  <div className="card p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                      Snapshot Stats
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                      <div className="workspace-panel !px-4 !py-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-app-text-muted">
                          Rows loaded
                        </p>
                        <p className="mt-2 font-display text-2xl font-bold text-app-text">
                          {chartEntries.length}
                        </p>
                      </div>
                      <div className="workspace-panel !px-4 !py-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-app-text-muted">
                          Store
                        </p>
                        <p className="mt-2 font-display text-2xl font-bold text-app-text">
                          {storeType === "ios" ? "iOS" : "Android"}
                        </p>
                      </div>
                      <div className="workspace-panel !px-4 !py-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-app-text-muted">
                          Selected app
                        </p>
                        <p className="mt-2 font-display text-2xl font-bold text-app-text">
                          {selectedAppChartEntry
                            ? `#${selectedAppChartEntry.position}`
                            : selectedApp
                              ? "Out"
                              : "None"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="card p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                      App Spotlight
                    </p>
                    {selectedApp ? (
                      <div className="workspace-panel mt-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={selectedApp.icon}
                            alt={selectedApp.title}
                            className="h-14 w-14 rounded-2xl border border-app-border/50"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-app-text">
                              {selectedApp.title}
                            </p>
                            <p className="truncate text-xs text-app-text-muted">
                              {selectedApp.developer}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div className="workspace-metric-card !p-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-app-text-muted">
                              Chart rank
                            </p>
                            <p className="mt-2 font-display text-2xl font-bold text-cyan-300">
                              {selectedAppChartEntry
                                ? `#${selectedAppChartEntry.position}`
                                : "-"}
                            </p>
                          </div>
                          <div className="workspace-metric-card !p-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-app-text-muted">
                              Chart type
                            </p>
                            <p className="mt-2 text-sm font-semibold text-app-text">
                              {getChartTypeLabel(selectedChartType)}
                            </p>
                          </div>
                        </div>
                        <p className="mt-4 text-xs text-app-text-muted">
                          {selectedAppChartEntry
                            ? "The current selection is present in this chart snapshot."
                            : "The current selection is not in the loaded chart slice for this market."}
                        </p>
                      </div>
                    ) : (
                      <div className="workspace-panel mt-4 !py-6 text-sm text-app-text-muted">
                        Analyze an app first if you want its chart rank pinned
                        against this leaderboard.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}{" "}
          {false &&
            ((viewMode === "single" && selectedApp) ||
            (viewMode === "compare" && comparedApps.length > 0)) && (
            <div className="mt-8 flex justify-end">
              <aside className="w-full xl:max-w-md">
                <div className="rounded-2xl border border-app-border/60 bg-app-surface/50 shadow-lg backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={() =>
                      setIsMarketSnapshotOpen((current) => !current)
                    }
                    className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
                    aria-expanded={isMarketSnapshotOpen}
                  >
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-app-text-muted">
                        Market Context
                      </p>
                      <h3 className="mt-2 flex items-center gap-2 text-base font-semibold text-app-text">
                        <span
                          className="section-header-icon"
                          style={{
                            background: "rgba(34, 211, 238,0.1)",
                            border: "1px solid rgba(34, 211, 238,0.2)",
                          }}
                        >
                          <BarChart3 className="w-4 h-4 text-cyan-400" />
                        </span>
                        Market Snapshot
                      </h3>
                      <p className="mt-2 text-sm text-app-text-muted">
                        {viewMode === "single"
                          ? "Collapsed by default so the core app analysis stays first."
                          : "Keep chart rankings nearby without competing with the compare findings."}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="rounded-full border border-app-border/70 bg-app-surface-muted/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                        {selectedChartCategory?.label || "Category"}
                      </span>
                      <ChevronDown
                        className={`h-5 w-5 text-app-text-muted transition-transform ${isMarketSnapshotOpen ? "rotate-180" : ""}`}
                      />
                    </div>
                  </button>
                  <div className="border-t border-slate-900/70 px-5 py-3 text-xs text-app-text-muted">
                    <span>{getChartTypeLabel(selectedChartType)}</span>
                    <span className="mx-2 text-slate-700">/</span>
                    <span>{findCountryName(country) || country}</span>
                    <span className="mx-2 text-slate-700">/</span>
                    <span>
                      {chartLoadedAt
                        ? `Loaded ${formatAlertEventTime(chartLoadedAt)}`
                        : isLoadingCharts
                          ? "Refreshing..."
                          : "No snapshot yet"}
                    </span>
                  </div>
                  {isMarketSnapshotOpen && (
                    <div className="space-y-4 border-t border-slate-900/70 px-5 py-5">
                      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                        <select
                          value={selectedChartType}
                          onChange={(event) =>
                            setSelectedChartType(event.target.value as ChartType)
                          }
                          className="rounded-xl border border-app-border/70 bg-app-surface/60 px-3 py-2 text-sm text-app-text"
                        >
                          {CHART_TYPE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <select
                          value={selectedChartCategoryCode}
                          onChange={(event) =>
                            setSelectedChartCategoryCode(event.target.value)
                          }
                          className="rounded-xl border border-app-border/70 bg-app-surface/60 px-3 py-2 text-sm text-app-text sm:col-span-2 xl:col-span-1"
                          disabled={
                            isLoadingChartCategories || chartCategories.length === 0
                          }
                        >
                          {chartCategories.map((option) => (
                            <option key={option.code} value={option.code}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {viewMode === "single" && selectedApp ? (
                        <>
                          <div className="workspace-panel">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                              {selectedApp.title}
                            </p>
                            <div className="mt-4 flex items-end justify-between gap-3">
                              <div>
                                <p className="text-sm text-app-text-muted">
                                  Current chart position
                                </p>
                                <p className="mt-2 font-display text-4xl font-bold text-cyan-300">
                                  {selectedAppChartEntry
                                    ? `#${selectedAppChartEntry.position}`
                                    : "-"}
                                </p>
                              </div>
                              <div className="text-right text-xs text-app-text-muted">
                                <p>{selectedChartCategory?.label || "Category"}</p>
                                <p className="mt-1">
                                  {getChartTypeLabel(selectedChartType)}
                                </p>
                              </div>
                            </div>
                            <div className="workspace-metric-card mt-4 !p-3 text-sm text-app-text-muted">
                              {isLoadingCharts ? (
                                <div className="flex items-center gap-2 text-app-text-muted">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Loading category chart...
                                </div>
                              ) : chartError ? (
                                <div className="text-amber-300">{chartError}</div>
                              ) : selectedAppChartEntry ? (
                                <div>
                                  <p className="font-semibold text-app-text">
                                    Ranking live in the current snapshot.
                                  </p>
                                  <p className="mt-1 text-xs text-app-text-muted">
                                    Use this as a quick benchmark against the
                                    wider category, not just keyword visibility.
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <p className="font-semibold text-app-text">
                                    This app is not in the loaded top chart
                                    slice.
                                  </p>
                                  <p className="mt-1 text-xs text-app-text-muted">
                                    Increase the chart scope later if you want
                                    deeper snapshots beyond the current top 100.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="workspace-panel">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                                Current leaders
                              </p>
                              <p className="text-xs text-app-text-muted">
                                {isLoadingCharts
                                  ? "Refreshing..."
                                  : `${chartEntries.length} rows`}
                              </p>
                            </div>
                            <div className="space-y-2">
                              {(isLoadingCharts
                                ? []
                                : chartEntries.slice(0, 8)).map((entry) => {
                                const isSelected =
                                  selectedAppChartId === String(entry.appId);
                                return (
                                  <div
                                    key={`${entry.chartType}-${entry.appId}-side`}
                                    className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${isSelected ? "border-cyan-500/30 bg-cyan-500/10" : "border-app-border/50 bg-app-surface/50"}`}
                                  >
                                    <div
                                      className={`w-9 text-center text-sm font-bold ${isSelected ? "text-cyan-300" : "text-app-text-muted"}`}
                                    >
                                      #{entry.position}
                                    </div>
                                    <img
                                      src={entry.icon}
                                      alt=""
                                      className="h-10 w-10 rounded-xl border border-app-border/50"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold text-app-text">
                                        {entry.title}
                                      </p>
                                      <p className="truncate text-xs text-app-text-muted">
                                        {entry.developer}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                              {!isLoadingCharts &&
                                !chartError &&
                                chartEntries.length === 0 && (
                                  <div className="workspace-empty-block !p-6">
                                    No chart data available for this store /
                                    country / category combination right now.
                                  </div>
                                )}
                            </div>
                          </div>
                        </>
                      ) : chartError ? (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-300">
                          {chartError}
                        </div>
                      ) : (
                        <div className="workspace-panel">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-muted">
                              Category leaders
                            </p>
                            <p className="text-xs text-app-text-muted">
                              {isLoadingCharts
                                ? "Refreshing..."
                                : `${chartEntries.length} rows`}
                            </p>
                          </div>
                          <div className="space-y-2">
                            {isLoadingCharts ? (
                              <div className="workspace-metric-card !flex-row items-center gap-2 text-sm text-app-text-muted">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading category chart snapshot...
                              </div>
                            ) : chartEntries.length === 0 ? (
                              <div className="workspace-metric-card text-sm text-app-text-muted">
                                No chart data available for this combination
                                right now.
                              </div>
                            ) : (
                              chartEntries.slice(0, 12).map((entry) => {
                                const isComparedApp = comparedChartAppIds.has(
                                  String(entry.appId),
                                );
                                return (
                                  <div
                                    key={`${entry.chartType}-${entry.appId}-compare-side`}
                                    className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${isComparedApp ? "border-cyan-500/20 bg-cyan-500/[0.06]" : "border-app-border/50 bg-app-surface/50"}`}
                                  >
                                    <div
                                      className={`w-10 text-center text-sm font-bold ${isComparedApp ? "text-cyan-200" : "text-app-text-muted"}`}
                                    >
                                      #{entry.position}
                                    </div>
                                    <img
                                      src={entry.icon}
                                      alt=""
                                      className="h-10 w-10 rounded-xl border border-app-border/50"
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold text-app-text">
                                        {entry.title}
                                      </p>
                                      <p className="truncate text-xs text-app-text-muted">
                                        {entry.developer}
                                      </p>
                                    </div>
                                    {isComparedApp && (
                                      <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                                        Compared
                                      </span>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </aside>
            </div>
          )}{" "}
        </main>{" "}
        </div>
        <CountryMultiSelectModal
          disabledCountries={
            trackCountryPickerState?.selectionKind === "tracked_edit" ||
            trackCountryPickerState?.selectionKind === "competitor_tracked_edit"
              ? []
              : trackCountryPickerState?.existingTrackedCountries || []
          }
          isOpen={Boolean(trackCountryPickerState)}
          keyword={trackCountryPickerState?.keyword || ""}
          selectedCountries={trackCountryPickerState?.selectedCountries || []}
          onToggleCountry={toggleTrackCountrySelection}
          onClose={closeTrackCountryPicker}
          onSubmit={() => void submitTrackCountrySelection()}
          options={COUNTRIES}
          isSubmitting={isSubmittingTrackCountries}
          title={
            trackCountryPickerState?.selectionKind === "competitor_draft"
              ? "Choose countries for this competitor keyword"
              : trackCountryPickerState?.selectionKind ===
                    "competitor_tracked_edit"
                ? "Edit competitor tracked countries"
              : trackCountryPickerState?.selectionKind === "tracked_edit"
                ? "Edit tracked countries"
                : "Track keyword by country"
          }
          description={
            trackCountryPickerState?.selectionKind === "competitor_draft" ? (
              <>
                Add countries for{" "}
                <span className="font-medium text-cyan-300">
                  "{trackCountryPickerState?.keyword || ""}"
                </span>{" "}
                . Confirm to start tracking; the matching competitor group is
                created or updated automatically.
              </>
            ) : trackCountryPickerState?.selectionKind ===
                "competitor_tracked_edit" ? (
              <>
                Add or remove countries for{" "}
                <span className="font-medium text-cyan-300">
                  "{trackCountryPickerState?.keyword || ""}"
                </span>{" "}
                inside this competitor group.
              </>
            ) : trackCountryPickerState?.selectionKind === "tracked_edit" ? (
              <>
                Add or remove countries for{" "}
                <span className="font-medium text-cyan-300">
                  "{trackCountryPickerState?.keyword || ""}"
                </span>
                .
              </>
            ) : undefined
          }
          selectedLabel={
            trackCountryPickerState?.selectionKind === "competitor_draft"
              ? "Selected"
              : trackCountryPickerState?.selectionKind ===
                  "competitor_tracked_edit"
                ? "Tracking"
              : trackCountryPickerState?.selectionKind === "tracked_edit"
                ? "Tracking"
                : "Selected"
          }
          disabledLabel={
            trackCountryPickerState?.selectionKind === "competitor_draft"
              ? "Already tracking"
              : "Tracked"
          }
          submitLabel={
            trackCountryPickerState?.selectionKind === "competitor_draft"
              ? (trackCountryPickerState?.selectedCountries.length || 0) > 1
                ? `Track in ${trackCountryPickerState?.selectedCountries.length} Countries`
                : "Track Keyword"
              : trackCountryPickerState?.selectionKind ===
                  "competitor_tracked_edit"
                ? "Save Countries"
              : trackCountryPickerState?.selectionKind === "tracked_edit"
                ? "Save Countries"
              : "Track Countries"
          }
        />{" "}
        <UnifiedAlertRuleManagerModal
          isOpen={Boolean(activeAlertGroup)}
          target={activeKeywordAlertTarget}
          rules={alertRules}
          onClose={() => setActiveAlertGroupId(null)}
          onChange={setAlertRules}
          notificationPermission={notificationPermission}
          onRequestPushPermission={requestNotificationPermission}
        />
        <UnifiedAlertRuleManagerModal
          isOpen={Boolean(activeCompetitorKeywordAlertTarget)}
          target={activeCompetitorKeywordAlertTarget}
          rules={alertRules}
          onClose={() => setActiveCompetitorKeywordAlertGroupKey(null)}
          onChange={setAlertRules}
          notificationPermission={notificationPermission}
          onRequestPushPermission={requestNotificationPermission}
        />
        <UnifiedAlertRuleManagerModal
          isOpen={Boolean(activeCompetitorAsoAlertGroup)}
          target={activeCompetitorAsoAlertTarget}
          rules={alertRules}
          onClose={() => setActiveCompetitorAsoAlertGroupId(null)}
          onChange={setAlertRules}
          notificationPermission={notificationPermission}
          onRequestPushPermission={requestNotificationPermission}
        />
      </div>
      )}
    </ErrorBoundary>
  );
}

export { AuthenticatedApp };
