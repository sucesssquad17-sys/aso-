import React, { useEffect, useRef, useState } from "react";
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
  LogOut,
  Mail,
  Lock,
  ShieldCheck,
  ArrowLeft,
  ChevronDown,
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
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getToken, onMessage } from "firebase/messaging";
import ErrorBoundary from "./components/ErrorBoundary";
import LandingPage from "./components/LandingPage";
import ThemeToggle from "./components/ThemeToggle";
import { AuthenticatedApp as WorkspaceAuthenticatedApp } from "./features/app/AuthenticatedWorkspace";
import { WorkspaceEmptyBlock, WorkspacePanel } from "./features/app/workspacePrimitives";
import {
  DEFAULT_GLOBAL_TRACKING_TIME,
  formatGlobalTrackingTimeForLocalDisplay,
  GLOBAL_TRACKING_TIMEZONE,
  TRACKING_CHART_TIMEZONE,
} from "./lib/trackingTime";
import {
  clearPendingGoogleRedirectAttempt,
  createAuthAttemptId,
  createGoogleProvider,
  detectGoogleSignInFlow,
  getAuthErrorCode,
  getShortAuthErrorMessage,
  readPendingGoogleRedirectAttempt,
  persistPendingGoogleRedirectAttempt,
  type GoogleSignInFlow,
} from "./features/auth/googleSignIn";
import { sendAuthEvent, type AuthEventPayload } from "./features/auth/telemetry";
import { getAuthErrorMessage } from "./features/auth/utils";
import { auth, db, messaging } from "./firebase";
import {
  DISCOVERY_CACHE_TTL,
  getDiscoveryCacheLookupKeys,
  getDiscoveryCacheKey,
  hasDiscoveryCacheContent,
  trimDiscoveryPayloadForMode,
} from "./lib/discoveryCache";
import { loadArchivedHistoryCollections } from "./lib/firestoreHistoryArchive";
import { logError, getFriendlyErrorMessage } from "./lib/errorHandler";
import {
  DataPdfExportError,
  exportDataPayloadToPdf,
} from "./lib/dataPdfExport";
import type { DataExportPayload } from "./lib/dataExportTypes";
import { CacheService, TTL } from "./lib/cache";
import {
  COUNTRY_OPTIONS as COUNTRIES,
  findCountryName,
  normalizeCountryCode,
  type CountryOption,
} from "./lib/countries";
import { safeStorage } from "./lib/storage";
import {
  THEME_STORAGE_KEY,
  applyTheme,
  getInitialTheme,
  type ThemeMode,
} from "./lib/theme";
type StoreType = "android" | "ios";
type DiscoveryMode = "fast" | "deep";
interface AppBookmark {
  appId: string;
  id?: number;
  title: string;
  icon: string;
  developer: string;
  store: StoreType;
  country: string;
  url?: string;
}
interface AppDetails {
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
interface KeywordMetrics {
  demand?: number;
  volume?: number;
  difficulty?: number;
  relevance?: number;
  confidence?: "low" | "medium" | "high";
}
interface RankedKeyword extends KeywordMetrics {
  keyword: string;
  rank: number;
}
interface KeywordSuggestion extends KeywordMetrics {
  keyword: string;
}
interface DiscoveryPayload {
  rankings: RankedKeyword[];
  suggestions: KeywordSuggestion[];
  checkedKeywords?: number;
  candidateCount?: number;
  searchDepth?: number;
  failedLookups?: number;
  mode: DiscoveryMode;
  loadedAt: string;
}
interface CompareRankingResult extends KeywordMetrics {
  appTitle: string;
  rank: number;
}

function getEstimatedDemand(metric?: KeywordMetrics | null) {
  return metric?.demand ?? metric?.volume;
}
interface TrackedKeyword {
  groupId: string;
  keyword: string;
  appId: string;
  appTitle: string;
  store: StoreType;
  country: string;
  lastRank: number;
  lastChecked: string;
  lastCheckStatus?: "pending" | "ok" | "not_ranked" | "error";
  lastError?: string;
}
interface TrackingSchedule {
  enabled: boolean;
  time: string;
  timezone: string;
  lastRunAt?: string;
  lastRunKey?: string;
}
interface RankHistoryEntry {
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
interface ChartRankHistoryEntry {
  dayKey: string;
  timestamp: string;
  fullTime: string;
  rank: number;
  rawRank: number;
  rankDepth: number;
  rawTimestamp: string;
}
type CsvValue = string | number | boolean | null | undefined;
type CsvRow = Record<string, CsvValue>;
interface TrackedCountryView {
  trackedKeyword: TrackedKeyword;
  tHistory: ChartRankHistoryEntry[];
  startRank: number | null;
  currentRank: number | null;
  improvement: number;
}
interface TrackedKeywordGroupView {
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
interface UserAppStateDocument {
  bookmarks?: AppBookmark[];
  trackedKeywords?: TrackedKeyword[];
  rankHistory?: RankHistoryEntry[];
  trackingSchedule?: TrackingSchedule;
  legalAcceptedAt?: string;
  legalVersion?: string;
  updatedAt?: string;
  migratedFromLocalAt?: string;
}
type ApiErrorCode =
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_UNAVAILABLE"
  | "REQUEST_TIMEOUT"
  | "NETWORK_ERROR"
  | "INTERNAL_ERROR";
type ApiErrorPayload = {
  error?: string;
  code?: ApiErrorCode;
  retryable?: boolean;
};
class ApiRequestError extends Error {
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
const TRACKED_KEYWORD_REFRESH_CONCURRENCY = 1;
const TRACKED_KEYWORD_RANKING_DEPTH = 100;
const SEARCH_CACHE_VERSION = "v2";
const TRACKING_HISTORY_LIMIT = 2000;
const API_REQUEST_TIMEOUT_MS = 45000;
const DISCOVERY_FAST_TIMEOUT_MS = 240000;
const DISCOVERY_DEEP_TIMEOUT_MS = 420000;
const LEGAL_VERSION = "2026-05-26";

function getDefaultTrackingSchedule(): TrackingSchedule {
  return {
    enabled: true,
    time: DEFAULT_GLOBAL_TRACKING_TIME,
    timezone: GLOBAL_TRACKING_TIMEZONE,
  };
}

function getBrowserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
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
    timeZone: TRACKING_CHART_TIMEZONE,
    day: "2-digit",
    month: "short",
  }).format(new Date(timestamp));
}

function formatTrackingChartDateTime(timestamp: string | Date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TRACKING_CHART_TIMEZONE,
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
      className: "text-emerald-400",
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
  const defaults = getDefaultTrackingSchedule();
  return {
    enabled: true,
    time: schedule?.time || defaults.time,
    timezone: schedule?.timezone || defaults.timezone,
    lastRunAt: schedule?.lastRunAt,
    lastRunKey: schedule?.lastRunKey,
  };
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
function serializeUserStateForFirestore(state: UserAppStateDocument) {
  const {
    legalAcceptedAt: _legalAcceptedAt,
    legalVersion: _legalVersion,
    ...persistableState
  } = state;
  return JSON.parse(JSON.stringify(persistableState)) as UserAppStateDocument;
}
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
  return (
    <div className={`relative ${className || ""}`}>
      {" "}
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setIsOpen((prev) => !prev)}
        className="input-field py-2 w-full text-left flex items-center justify-between gap-3"
      >
        {" "}
        <span className="truncate">{selectedLabel}</span>{" "}
        <span className="text-app-text-muted text-xs uppercase">
          {value.toUpperCase()}
        </span>{" "}
      </button>{" "}
      {isOpen && (
        <div className="absolute z-40 mt-2 w-full min-w-[16rem] rounded-2xl border border-app-border/70 bg-app-surface/95 p-3 shadow-2xl backdrop-blur-xl">
          {" "}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search countries..."
            className="input-field py-2 w-full mb-3"
            autoFocus
          />{" "}
          <div className="max-h-64 overflow-y-auto space-y-1">
            {" "}
            {filteredOptions.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => {
                  onChange(option.code);
                  setIsOpen(false);
                  setQuery("");
                }}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${value === option.code ? "bg-cyan-500/15 text-cyan-200" : "text-app-text-muted hover:bg-app-surface-strong/80"}`}
              >
                {" "}
                <div className="font-medium">{option.name}</div>{" "}
                <div className="text-xs text-app-text-muted uppercase">
                  {option.code}
                </div>{" "}
              </button>
            ))}{" "}
            {filteredOptions.length === 0 && (
              <div className="rounded-xl px-3 py-4 text-sm text-app-text-muted">
                No countries match your search.
              </div>
            )}{" "}
          </div>{" "}
        </div>
      )}{" "}
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
}) {
  const [query, setQuery] = React.useState("");
  React.useEffect(() => {
    if (!isOpen) {
      setQuery("");
    }
  }, [isOpen]);
  const filteredOptions = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter(
      (option) =>
        option.name.toLowerCase().includes(normalizedQuery) ||
        option.code.toLowerCase().includes(normalizedQuery),
    );
  }, [options, query]);
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
              Track keyword by country
            </h3>{" "}
            <p className="mt-2 text-sm text-app-text-muted">
              {" "}
              Select countries for{" "}
              <span className="font-medium text-cyan-300">"{keyword}"</span>
              .{" "}
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
        <div className="mt-4 max-h-80 overflow-y-auto space-y-2 rounded-2xl border border-app-border/60 bg-app-surface-muted/40 p-3">
          {" "}
          {filteredOptions.map((option) => {
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
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${isSelected ? "bg-cyan-500/15 text-cyan-200" : isDisabled ? "cursor-not-allowed text-slate-600" : "text-app-text-muted hover:bg-app-surface-strong/80"}`}
              >
                {" "}
                <div>
                  {" "}
                  <div className="font-medium">{option.name}</div>{" "}
                  <div className="text-xs uppercase text-app-text-muted">
                    {option.code}
                  </div>{" "}
                </div>{" "}
                <div
                  className={`text-xs font-semibold ${isSelected ? "text-cyan-300" : "text-app-text-muted"}`}
                >
                  {" "}
                  {isSelected
                    ? "Selected"
                    : isDisabled
                      ? "Tracked"
                      : "Add"}{" "}
                </div>{" "}
              </button>
            );
          })}{" "}
          {filteredOptions.length === 0 && (
            <div className="rounded-xl px-3 py-4 text-sm text-app-text-muted">
              No countries match your search.
            </div>
          )}{" "}
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
              Track Countries{" "}
            </button>{" "}
          </div>{" "}
        </div>{" "}
      </div>{" "}
    </div>
  );
}
function LegalDocumentScreen({
  title,
  subtitle,
  onBack,
  themeMode,
  onToggleTheme,
  children,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="auth-shell">
      {" "}
      <div className="auth-orb auth-orb-cyan" />{" "}
      <div className="auth-orb auth-orb-indigo" />{" "}
      <div className="auth-orb auth-orb-cyan" />{" "}
      <div className="auth-panel max-h-[88vh] overflow-y-auto">
        {" "}
        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-app-text-muted transition-colors hover:text-app-text"
          >
            {" "}
            <ArrowLeft className="w-4 h-4" /> Back{" "}
          </button>
          <ThemeToggle themeMode={themeMode} onToggle={onToggleTheme} />
        </div>{" "}
        <div className="mb-6">
          {" "}
          <div className="inline-flex items-center gap-2 badge badge-cyan mb-4">
            {" "}
            <ShieldCheck className="w-3.5 h-3.5" /> Legal{" "}
          </div>{" "}
          <h1 className="font-display text-3xl font-bold text-app-text tracking-tight">
            {title}
          </h1>{" "}
          <p className="text-app-text-muted mt-3 text-sm leading-6">
            {subtitle}
          </p>{" "}
        </div>{" "}
        <div
          className={`prose prose-sm max-w-none ${
            themeMode === "light" ? "prose-slate text-slate-600" : "prose-invert text-app-text-muted"
          }`}
        >
          {" "}
          {children}{" "}
        </div>{" "}
      </div>{" "}
    </div>
  );
}
function PrivacyPolicyPage({
  onBack,
  themeMode,
  onToggleTheme,
}: {
  onBack: () => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}) {
  return (
    <LegalDocumentScreen
      title="Privacy Policy"
      subtitle="How Rank Analyzer Pro stores and uses account data."
      onBack={onBack}
      themeMode={themeMode}
      onToggleTheme={onToggleTheme}
    >
      <p>Effective date: June 30, 2026.</p>
      <h2>Information We Collect</h2>
      <p>
        Rank Analyzer Pro stores account and workspace data needed to run the
        app. This includes your Firebase user ID, email address or sign-in
        provider details, bookmarks, tracked apps, competitor groups, tracked
        keywords, rank history, report snapshots, alert rules, alert events,
        notification settings, legal acceptance metadata, and account-level app
        preferences.
      </p>
      <p>
        If you enable browser notifications, we also store device registration
        tokens so notification delivery can work. If you use a paid plan or
        trial, we also store billing status and related metadata such as plan,
        interval, subscription state, Dodo customer or product identifiers, and
        transaction references required to manage access.
      </p>
      <h2>Local Browser Storage</h2>
      <p>
        The app uses local browser storage for essential sign-in flow state,
        theme, cookie consent, workspace preferences, and optional performance
        cache behavior. Some discovery and app data may also be cached on the
        server for performance and stability.
      </p>
      <h2>How We Use Data</h2>
      <p>
        We use your data to provide Analyze, Compare, Reports, Bookmarks,
        Tracked Keywords, Competitor Group monitoring, export features, billing
        access, account support, and notification delivery by in-app feed,
        browser push, and email.
      </p>
      <p>
        We may also use service logs and operational metadata to debug failures,
        protect the platform from abuse, enforce plan limits, and improve
        performance, discovery quality, and delivery reliability.
      </p>
      <h2>Third-Party Services</h2>
      <p>
        Rank Analyzer Pro uses Firebase Authentication, Firestore, and Firebase
        Cloud Messaging; Dodo Payments for subscriptions, checkout, and billing
        portal access; Resend for transactional or announcement email delivery;
        Google Gemini for keyword refinement during discovery; and cloud-hosted
        backend infrastructure including Cloud Run and Firebase Hosting.
      </p>
      <p>
        App search, ranking, chart, and metadata features depend on third-party
        store data sources and supporting network services, including Google
        Play, iOS App Store data providers, and proxy infrastructure used to
        complete some store lookups.
      </p>
      <h2>Data Retention</h2>
      <p>
        Workspace data remains associated with your account until you delete the
        relevant records or delete the account. Billing, legal acceptance,
        fraud-prevention, notification, operational, and support-related records
        may be retained for legitimate business, accounting, tax, security,
        dispute, or legal compliance reasons.
      </p>
      <h2>Your Choices</h2>
      <p>
        You can manage or remove tracked data inside the app, control whether
        optional storage is allowed, update notification settings, and delete
        your account from the product. Paid subscriptions can be cancelled using
        the billing portal when available. Deleting an account does not
        automatically remove records we must retain for billing, fraud, or legal
        compliance.
      </p>
      <h2>No Sale of Payment Card Data</h2>
      <p>
        We do not store full payment card numbers in the app database. Payment
        processing is handled by the billing provider.
      </p>
      <h2>Contact</h2>
      <p>
        For support, billing, or sales questions, contact{" "}
        <a href="mailto:vantalumstudio@gmail.com">vantalumstudio@gmail.com</a>.
      </p>
    </LegalDocumentScreen>
  );
}
function TermsPage({
  onBack,
  themeMode,
  onToggleTheme,
}: {
  onBack: () => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}) {
  return (
    <LegalDocumentScreen
      title="Terms & Conditions"
      subtitle="The basic terms for using Rank Analyzer Pro."
      onBack={onBack}
      themeMode={themeMode}
      onToggleTheme={onToggleTheme}
    >
      <p>Effective date: June 30, 2026.</p>
      <h2>Service Scope</h2>
      <p>
        Rank Analyzer Pro provides app keyword research, app-store discovery,
        competitor group analysis, reports, bookmarking, alerting, export, and
        related monitoring tools for iOS and Google Play research workflows.
      </p>
      <h2>Account Responsibility</h2>
      <p>
        You are responsible for activity under your account, the security of
        your sign-in methods, and the accuracy of information you submit through
        the service.
      </p>
      <h2>Subscriptions, Trials, and Billing</h2>
      <p>
        Paid access, trials, and plan limits are governed by the pricing and
        checkout terms shown at purchase. Subscription billing, renewals,
        cancellations, and billing portal access may be handled through Dodo
        Payments or another payment provider used by the service.
      </p>
      <p>
        Plans may include limits on tracked apps, competitor groups, tracked
        keywords, notification volume, or other operational usage. We may
        enforce those limits inside the product.
      </p>
      <h2>Cancellations and Refunds</h2>
      <p>
        You may cancel a subscription through the billing portal when available
        or by contacting{" "}
        <a href="mailto:vantalumstudio@gmail.com">vantalumstudio@gmail.com</a>. Cancellation generally stops future renewals
        but does not automatically create a refund for charges already incurred.
        Refund decisions, if offered, are handled case by case and may depend on
        payment-provider rules, trial use, abuse review, and applicable law.
      </p>
      <h2>Data and Availability</h2>
      <p>
        Search rankings, keyword suggestions, discovery results, charts, alerts,
        app metadata, and other outputs are provided on a best-effort basis.
        They may be delayed, incomplete, estimated, unavailable, or changed by
        upstream services without notice.
      </p>
      <h2>Acceptable Use</h2>
      <p>
        You must not misuse the service, interfere with its operation, attempt
        unauthorized access, bypass plan or rate limits, reverse engineer
        protected systems, resell unauthorized access, send unlawful or abusive
        content through notifications or email features, or use the service in
        violation of store policies or applicable law.
      </p>
      <h2>Suspension</h2>
      <p>
        Access may be suspended, limited, or terminated for unpaid balances,
        chargebacks, fraud concerns, abuse, excessive automated use, policy
        violations, or behavior that creates operational or legal risk.
      </p>
      <h2>Intellectual Property</h2>
      <p>
        The service, its software, and its product content remain the property
        of their respective owners. You retain rights to data you submit, but
        you grant us the rights needed to host, process, and display it in order
        to operate the service.
      </p>
      <h2>Termination</h2>
      <p>
        You may stop using the service at any time. You may also delete your
        account from within the app. Termination or account deletion does not
        automatically erase outstanding payment obligations or records that must
        be retained for legal, billing, or security reasons.
      </p>
      <h2>Changes</h2>
      <p>
        We may update these terms as the product evolves. Continued use after a
        legal update may require renewed acceptance.
      </p>
      <h2>Contact</h2>
      <p>
        For support, billing, or sales questions, contact{" "}
        <a href="mailto:vantalumstudio@gmail.com">vantalumstudio@gmail.com</a>.
      </p>
    </LegalDocumentScreen>
  );
}
function LoginScreen({
  authMode,
  authError,
  email,
  password,
  isSubmitting,
  legalAccepted,
  onAuthModeChange,
  onEmailChange,
  onPasswordChange,
  onLegalAcceptedChange,
  onEmailSubmit,
  onGoogleSignIn,
  onOpenPrivacy,
  onOpenTerms,
  themeMode,
  onToggleTheme,
}: {
  authMode: "signin" | "signup";
  authError: string | null;
  email: string;
  password: string;
  isSubmitting: boolean;
  legalAccepted: boolean;
  onAuthModeChange: (mode: "signin" | "signup") => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onLegalAcceptedChange: (value: boolean) => void;
  onEmailSubmit: (event: React.FormEvent) => Promise<void>;
  onGoogleSignIn: () => Promise<void>;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}) {
  const isSignIn = authMode === "signin";
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
        <div className="flex items-center justify-center mb-6">
          {" "}
          <div
            className="logo-icon relative flex items-center justify-center w-14 h-14 rounded-2xl"
            style={{
              background: "linear-gradient(135deg, #67e8f9 0%, #2dd4bf 100%)",
              boxShadow: "0 0 28px rgba(34, 211, 238, 0.24)",
            }}
          >
            {" "}
            <Search
              className="w-7 h-7 text-slate-950"
              strokeWidth={2.4}
            />{" "}
          </div>{" "}
        </div>{" "}
        <div className="text-center mb-8">
          {" "}
          <div className="inline-flex items-center gap-2 badge badge-cyan mb-4">
            {" "}
            <ShieldCheck className="w-3.5 h-3.5" /> Secure access{" "}
          </div>{" "}
          <h1 className="font-display text-3xl font-bold text-app-text tracking-tight">
            Sign in to Rank Analyzer Pro
          </h1>{" "}
          <p className="text-app-text-muted mt-3 text-sm leading-6">
            {" "}
            Use Google or your email and password to access the analyzer
            workspace.{" "}
          </p>{" "}
        </div>{" "}
        <div
          className="flex gap-2 p-1 rounded-2xl mb-6"
          style={
            themeMode === "light"
              ? {
                  background: "rgba(241, 245, 249, 0.92)",
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                }
              : {
                  background: "rgba(15,23,42,0.75)",
                  border: "1px solid rgba(51,65,85,0.45)",
                }
          }
        >
          {" "}
          <button
            type="button"
            onClick={() => onAuthModeChange("signin")}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all"
            style={
              isSignIn
                ? themeMode === "light"
                  ? {
                      background: "rgba(255, 255, 255, 0.8)",
                      color: "#0f172a",
                      border: "1px solid rgba(148, 163, 184, 0.4)",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }
                  : {
                      background:
                        "linear-gradient(135deg, rgba(34,211,238,0.18), rgba(129,140,248,0.18))",
                      color: "#e0f2fe",
                      border: "1px solid rgba(34,211,238,0.25)",
                    }
                : { color: themeMode === "light" ? "#64748b" : "#94a3b8" }
            }
          >
            {" "}
            Sign in{" "}
          </button>{" "}
          <button
            type="button"
            onClick={() => onAuthModeChange("signup")}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all"
            style={
              !isSignIn
                ? themeMode === "light"
                  ? {
                      background: "rgba(255, 255, 255, 0.8)",
                      color: "#0f172a",
                      border: "1px solid rgba(148, 163, 184, 0.4)",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    }
                  : {
                      background:
                        "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(34,211,238,0.18))",
                      color: "#d1fae5",
                      border: "1px solid rgba(16,185,129,0.25)",
                    }
                : { color: themeMode === "light" ? "#64748b" : "#94a3b8" }
            }
          >
            {" "}
            Create account{" "}
          </button>{" "}
        </div>{" "}
        <button
          type="button"
          onClick={onGoogleSignIn}
          disabled={isSubmitting || !legalAccepted}
          className="btn-google w-full mb-6"
        >
          {" "}
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <GoogleMark />
          )}{" "}
          Continue with Google{" "}
        </button>{" "}
        <div className="auth-divider mb-6">
          {" "}
          <span>or use email</span>{" "}
        </div>{" "}
        <form onSubmit={onEmailSubmit} className="space-y-4">
          {" "}
          <label className="block">
            {" "}
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-muted">
              Email
            </span>{" "}
            <div className="relative mt-2">
              {" "}
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" />{" "}
              <input
                type="email"
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                className="input-field"
                placeholder="you@company.com"
                autoComplete="email"
                style={{ paddingLeft: "2.85rem" }}
              />{" "}
            </div>{" "}
          </label>{" "}
          <label className="block">
            {" "}
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-muted">
              Password
            </span>{" "}
            <div className="relative mt-2">
              {" "}
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" />{" "}
              <input
                type="password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                className="input-field"
                placeholder={
                  isSignIn ? "Enter your password" : "Create a password"
                }
                autoComplete={isSignIn ? "current-password" : "new-password"}
                style={{ paddingLeft: "2.85rem" }}
              />{" "}
            </div>{" "}
          </label>{" "}
          {authError && (
            <div
              className="rounded-2xl px-4 py-3 text-sm"
              style={
                themeMode === "light"
                  ? {
                      background: "rgba(254, 226, 226, 0.5)",
                      border: "1px solid rgba(248, 113, 113, 0.3)",
                      color: "#991b1b",
                    }
                  : {
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.18)",
                      color: "#fca5a5",
                    }
              }
            >
              {" "}
              {authError}{" "}
            </div>
          )}{" "}
          <label
            className="flex items-start gap-3 rounded-2xl px-4 py-3 text-sm"
            style={
              themeMode === "light"
                ? {
                    background: "rgba(241, 245, 249, 0.92)",
                    border: "1px solid rgba(148, 163, 184, 0.3)",
                  }
                : {
                    background: "rgba(15,23,42,0.65)",
                    border: "1px solid rgba(51,65,85,0.45)",
                  }
            }
          >
            {" "}
            <input
              type="checkbox"
              checked={legalAccepted}
              onChange={(event) => onLegalAcceptedChange(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-app-border bg-app-surface-muted text-cyan-400 focus:ring-cyan-500"
            />{" "}
            <span className="text-app-text-muted leading-6">
              {" "}
              I agree to the{" "}
              <button
                type="button"
                onClick={onOpenTerms}
                className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
              >
                {" "}
                Terms &amp; Conditions{" "}
              </button>{" "}
              and{" "}
              <button
                type="button"
                onClick={onOpenPrivacy}
                className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
              >
                {" "}
                Privacy Policy{" "}
              </button>{" "}
              .{" "}
            </span>{" "}
          </label>{" "}
          <button
            type="submit"
            disabled={
              isSubmitting ||
              !email.trim() ||
              !password.trim() ||
              !legalAccepted
            }
            className="btn-primary w-full"
          >
            {" "}
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : null}{" "}
            {isSignIn ? "Sign in with email" : "Create account"}{" "}
          </button>{" "}
        </form>{" "}
        <p className="text-xs text-app-text-muted leading-6 mt-6 text-center">
          {" "}
          Review our{" "}
          <button
            type="button"
            onClick={onOpenPrivacy}
            className="text-app-text-muted hover:text-app-text underline underline-offset-4"
          >
            {" "}
            Privacy Policy{" "}
          </button>{" "}
          and{" "}
          <button
            type="button"
            onClick={onOpenTerms}
            className="text-app-text-muted hover:text-app-text underline underline-offset-4"
          >
            {" "}
            Terms &amp; Conditions{" "}
          </button>{" "}
          before continuing.{" "}
        </p>{" "}
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
  themeMode = getInitialTheme(),
  onToggleTheme = () => {},
}: {
  currentUser: User;
  onSignOut: () => Promise<void>;
  onDeleteAccount: () => Promise<void>;
  initialLegalAccepted: boolean;
  onLegalAcceptedPersisted: () => void;
  themeMode?: ThemeMode;
  onToggleTheme?: () => void;
}) {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>(
      "Notification" in window ? Notification.permission : "default",
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
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>("fast");
  const [viewMode, setViewMode] = useState<
    "single" | "compare" | "bookmarks" | "tracked"
  >("single");
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
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [isConfirmingDeleteAccount, setIsConfirmingDeleteAccount] =
    useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [allRankHistory, setAllRankHistory] = useState<RankHistoryEntry[]>([]);
  const [trackSortBy, setTrackSortBy] = useState<
    "date_added" | "last_checked" | "app" | "rank_change"
  >("date_added");
  const [trackFilterApp, setTrackFilterApp] = useState<string>("all");
  const [trackFilterCountry, setTrackFilterCountry] = useState<string>("all");
  const [trackSearchTerm, setTrackSearchTerm] = useState("");
  const [trackedSummaryCountryByGroup, setTrackedSummaryCountryByGroup] =
    useState<Record<string, string>>({});
  const [expandedTrackedGroupIds, setExpandedTrackedGroupIds] = useState<
    string[]
  >([]);
  const [userStateHydrated, setUserStateHydrated] = useState(false);
  const [hasAcceptedLegal, setHasAcceptedLegal] = useState(false);
  const [consentChecked, setConsentChecked] = useState(initialLegalAccepted);
  const [isSavingLegalConsent, setIsSavingLegalConsent] = useState(false);
  const [legalGateView, setLegalGateView] = useState<
    "consent" | "privacy" | "terms"
  >("consent");
  const [trackCountryPickerState, setTrackCountryPickerState] = useState<{
    keyword: string;
    app: AppDetails;
    store: StoreType;
    currentCountry: string;
    currentRank: number;
    currentRankKnown: boolean;
    existingTrackedCountries: string[];
    selectedCountries: string[];
  } | null>(null);
  const [isSubmittingTrackCountries, setIsSubmittingTrackCountries] =
    useState(false);
  const isApplyingUserState = React.useRef(false);
  const userStateDocRef = React.useMemo(
    () => doc(db, "users", currentUser.uid),
    [currentUser.uid],
  );
  const fetchAuthedJson = React.useCallback(
    async <T,>(input: string, init?: RequestInit, options?: { timeoutMs?: number }) => {
      const token = await currentUser.getIdToken();
      const headers = new Headers(init?.headers || {});
      headers.set("Authorization", `Bearer ${token}`);
      return fetchJson<T>(input, { ...init, headers }, options);
    },
    [currentUser],
  );
  const exportRef = React.useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  useEffect(() => {
    if (!messaging) return;
    if (notificationPermission === "granted") {
      getToken(messaging)
        .then((currentToken) => {
          if (currentToken) {
            setFcmToken(currentToken);
            console.log("FCM Token:", currentToken);
          } else {
            console.log(
              "No registration token available. Request permission to generate one.",
            );
          }
        })
        .catch((err) => {
          console.warn("An error occurred while retrieving token. ", err);
        });
    }
    try {
      const unsubscribe = onMessage(messaging, (payload) => {
        console.log("Message received. ", payload);
        toast.info(payload.notification?.title || "New Notification", {
          description: payload.notification?.body,
        });
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Background messaging failed", e);
    }
  }, [notificationPermission]);
  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      toast.error("This browser does not support desktop notifications.");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      toast.success("Notifications enabled!");
    } else {
      toast.error("Notification permission denied.");
    }
  };
  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      const filename =
        viewMode === "single" && selectedApp
          ? `rank-report-${selectedApp.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`
          : "rank-compare-report.pdf";
      const result = await exportDataPayloadToPdf({
        filename,
        payload: buildExportPayload(),
      });
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
  useEffect(() => {
    let cancelled = false;
    const loadUserState = async () => {
      setUserStateHydrated(false);
      isApplyingUserState.current = true;
      setBookmarks([]);
      setTrackedKeywords([]);
      setAllRankHistory([]);
      setTrackingSchedule(getDefaultTrackingSchedule());
      try {
        const snapshot = await getDoc(userStateDocRef);
        const remoteState = snapshot.exists()
          ? (snapshot.data() as UserAppStateDocument)
          : null;
        const legacyState = readLegacyLocalUserState();
        const hasRemoteState = Boolean(
          remoteState &&
          (Array.isArray(remoteState.bookmarks) ||
            Array.isArray(remoteState.trackedKeywords) ||
            Array.isArray(remoteState.rankHistory) ||
            remoteState.trackingSchedule),
        );
        const archivedHistory = hasRemoteState
          ? await loadArchivedHistoryCollections<RankHistoryEntry>(userStateDocRef)
          : { rankHistory: [], competitorRankHistory: [] };
        const legalAlreadyAccepted = Boolean(
          remoteState?.legalAcceptedAt &&
          remoteState?.legalVersion === LEGAL_VERSION,
        );
        const shouldPersistInitialLegalAcceptance =
          !legalAlreadyAccepted && initialLegalAccepted;
        const nextBookmarks = hasRemoteState
          ? Array.isArray(remoteState?.bookmarks)
            ? remoteState.bookmarks
            : []
          : legacyState.bookmarks;
        const nextTrackedKeywords = normalizeTrackedKeywordGroupIds(
          hasRemoteState
            ? Array.isArray(remoteState?.trackedKeywords)
              ? remoteState.trackedKeywords
              : []
            : legacyState.trackedKeywords,
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
        );
        const nextTrackingSchedule = normalizeTrackingScheduleState(
          hasRemoteState ? remoteState?.trackingSchedule : undefined,
        );
        if (cancelled) {
          return;
        }
        if (!hasRemoteState || shouldPersistInitialLegalAcceptance) {
          await fetchAuthedJson<{ success: boolean }>("/api/user-state", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              state: serializeUserStateForFirestore({
                bookmarks: nextBookmarks,
                trackedKeywords: nextTrackedKeywords,
                rankHistory: nextRankHistory,
                trackingSchedule: nextTrackingSchedule,
                migratedFromLocalAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              }),
            }),
          });
          if (shouldPersistInitialLegalAcceptance) {
            await fetchAuthedJson<{ success: boolean }>("/api/account/legal-acceptance", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                legalVersion: LEGAL_VERSION,
              }),
            });
            onLegalAcceptedPersisted();
          }
          safeStorage.removeItem("aso-bookmarks");
          safeStorage.removeItem("aso-tracked-keywords");
          safeStorage.removeItem("aso-rank-history");
        }
        if (cancelled) {
          return;
        }
        setBookmarks(nextBookmarks);
        setTrackedKeywords(nextTrackedKeywords);
        setAllRankHistory(nextRankHistory);
        setTrackingSchedule(nextTrackingSchedule);
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
    };
  }, [currentUser.uid, fetchAuthedJson, userStateDocRef]);
  const persistLegalAcceptance = async () => {
    if (!consentChecked) {
      toast.error(
        "You need to accept the Terms & Conditions and Privacy Policy first.",
      );
      return;
    }
    setIsSavingLegalConsent(true);
    try {
      await fetchAuthedJson<{ success: boolean }>("/api/account/legal-acceptance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          legalVersion: LEGAL_VERSION,
        }),
      });
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
    if (!userStateHydrated || isApplyingUserState.current) return;
    const persistUserState = async () => {
      try {
        await fetchAuthedJson<{ success: boolean }>("/api/user-state", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            state: serializeUserStateForFirestore({
              bookmarks,
              trackedKeywords,
              rankHistory: allRankHistory,
              trackingSchedule,
              updatedAt: new Date().toISOString(),
            }),
          }),
        });
      } catch (err) {
        logError(err, { context: "persistUserState", uid: currentUser.uid });
        console.warn("Failed to save user state", err);
      }
    };
    void persistUserState();
  }, [
    allRankHistory,
    bookmarks,
    currentUser.uid,
    fetchAuthedJson,
    trackedKeywords,
    trackingSchedule,
    userStateHydrated,
  ]);
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
      try {
        const data = await fetchAuthedJson<{
          keyword: string;
          rank: number;
          depth?: number;
        }>(
          `/api/ranking?keyword=${encodeURIComponent(trackedKeyword.keyword)}&appId=${encodeURIComponent(trackedKeyword.appId)}&store=${trackedKeyword.store}&country=${trackedKeyword.country}&refresh=true&depth=${TRACKED_KEYWORD_RANKING_DEPTH}`,
        );
        const newRank = data.rank;
        const rankDepth = data.depth ?? TRACKED_KEYWORD_RANKING_DEPTH;
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
              <span className="text-sm font-medium text-emerald-400">
                {changeMessage}
              </span>{" "}
            </div>,
            { duration: 6000 },
          );
        }
        const updatedTrackedKeyword = {
          ...trackedKeyword,
          lastRank: newRank,
          lastChecked: new Date().toISOString(),
          lastCheckStatus:
            newRank === -1 ? ("not_ranked" as const) : ("ok" as const),
          lastError: undefined,
        };
        saveTrackedRankHistory(
          trackedKeyword.groupId,
          trackedKeyword.appId,
          trackedKeyword.keyword,
          newRank,
          trackedKeyword.store,
          trackedKeyword.country,
          rankDepth,
        );
        return { updatedTrackedKeyword, significantChange, hadError: false };
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
    [saveTrackedRankHistory],
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

      setTrackCountryPickerState({
        keyword,
        app,
        store: currentStore,
        currentCountry: normalizedCurrentCountry,
        currentRank,
        currentRankKnown,
        existingTrackedCountries,
        selectedCountries: existingTrackedCountries.includes(normalizedCurrentCountry)
          ? []
          : [normalizedCurrentCountry],
      });
    },
    [country, trackedKeywords],
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
        if (prev.existingTrackedCountries.includes(normalizedCode)) {
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
      setTrackedKeywords((prev) =>
        prev.filter(
          (trackedKeyword) =>
            resolveTrackingGroupId(trackedKeyword) !== groupId,
        ),
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
      toast.success(`Stopped tracking "${keyword}" for this country group`);
    },
    [],
  );
  const toggleTrackedGroupExpansion = React.useCallback((groupId: string) => {
    setExpandedTrackedGroupIds((prev) =>
      prev.includes(groupId)
        ? prev.filter((entry) => entry !== groupId)
        : [...prev, groupId],
    );
  }, []);
  const setTrackedSummaryCountry = React.useCallback(
    (groupId: string, countryCode: string) => {
      setTrackedSummaryCountryByGroup((prev) => ({
        ...prev,
        [groupId]: countryCode,
      }));
    },
    [],
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
    const targetAppId = getAppStoreId(
      trackCountryPickerState.app,
      trackCountryPickerState.store,
    );
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
    if (newCountries.length === 0) {
      toast.error(
        "All selected countries are already tracked for this keyword.",
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
    setIsSubmittingTrackCountries(true);
    setTrackedKeywords((prev) =>
      mergeTrackedKeywordCollections(prev, trackedEntries),
    );
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
      `Tracking updated for "${trackCountryPickerState.keyword}" in ${newCountries.length} ${newCountries.length === 1 ? "country" : "countries"}`,
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
    getAppStoreId,
    trackedKeywords,
    mergeTrackedKeywordUpdates,
    refreshTrackedKeywordBatch,
    saveTrackedRankHistory,
    trackCountryPickerState,
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
      console.warn("Metric estimation failed", e);
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
  const discoverKeywords = async (
    app: AppDetails,
    currentStore: StoreType,
    currentCountry: string,
    options?: { force?: boolean; mode?: DiscoveryMode },
  ) => {
    const activeMode = options?.mode ?? discoveryMode;
    setIsDiscoveringKeywords(true);
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
      if (options?.force) {
        const summary =
          `${activeMode === "deep" ? "Deep" : "Fast"} discovery found ${payload.rankings.length} ranking keyword${payload.rankings.length === 1 ? "" : "s"}` +
          (typeof payload.checkedKeywords === "number" &&
          typeof payload.candidateCount === "number"
            ? ` after checking ${payload.checkedKeywords}/${payload.candidateCount} candidates`
            : "");
        if (payload.rankings.length === 0 && payload.suggestions.length > 0) {
          toast.info(
            `${summary}. Showing ${payload.suggestions.length} keyword suggestion${payload.suggestions.length === 1 ? "" : "s"} instead.`,
          );
        } else if (payload.rankings.length === 0) {
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
      toast.error(
        "Keyword discovery could not complete. Try rerunning the scan.",
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
        comparedApps.some((a) => (a.appId || a.id) === (app.appId || app.id))
      ) {
        setSearchResults([]);
        setSelectedCategory(null);
        return;
      }
      setSearchResults([]);
      setSelectedCategory(null);
      setCompareRankings([]);
      try {
        const id = currentStore === "ios" ? app.id : app.appId;
        if (!id) return;
        const cacheKey = `app-${currentStore}-${currentCountry}-${id}`;
        const cachedData = CacheService.get<AppDetails>(cacheKey);
        if (cachedData) {
          setComparedApps((prev) => [...prev, cachedData]);
          return;
        }
        const fullDetails = await fetchJson<any>(
          `/api/app?id=${id}&store=${currentStore}&country=${currentCountry}`,
        );
        const normalizedDetails = normalizeAppDetails(
          fullDetails,
          currentStore,
        );
        CacheService.set(cacheKey, normalizedDetails, TTL.APP_DETAILS);
        setComparedApps((prev) => [...prev, normalizedDetails]);
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
    /* Fetch full details */ try {
      const id = currentStore === "ios" ? app.id : app.appId;
      if (!id) return;
      const cacheKey = `app-${currentStore}-${currentCountry}-${id}`;
      const cachedData = CacheService.get<AppDetails>(cacheKey);
      if (cachedData) {
        setSelectedApp(cachedData);
        return;
      }
      const fullDetails = await fetchJson<any>(
        `/api/app?id=${id}&store=${currentStore}&country=${currentCountry}`,
      );
      const normalizedDetails = normalizeAppDetails(fullDetails, currentStore);
      CacheService.set(cacheKey, normalizedDetails, TTL.APP_DETAILS);
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
  const compareAppInsights = React.useMemo(() => {
    const getSuggestionScore = (suggestion: KeywordSuggestion) =>
      (suggestion.demand ?? suggestion.volume ?? 0) * 0.45 +
      (suggestion.relevance ?? 0) * 0.4 -
      (suggestion.difficulty ?? 50) * 0.2;
    return comparedApps.map((app) => {
      const compareKey = getCompareAppKey(app, storeType);
      const discovery = compareDiscoveries[compareKey];
      const rankings = discovery?.rankings ?? [];
      const suggestions = discovery?.suggestions ?? [];
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
          ? rankings.reduce((best, item) =>
              item.rank < best.rank ? item : best,
            )
          : null;
      const bestSuggestion =
        suggestions.length > 0
          ? [...suggestions].sort(
              (a, b) => getSuggestionScore(b) - getSuggestionScore(a),
            )[0]
          : null;
      return {
        app,
        compareKey,
        discovery,
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
  }, [comparedApps, compareDiscoveries, storeType]);
  const compareKeywordCoverage = React.useMemo(() => {
    const coverage = new Map<
      string,
      {
        keyword: string;
        rankings: Array<RankedKeyword & { appKey: string; appTitle: string }>;
        suggestions: Array<
          KeywordSuggestion & { appKey: string; appTitle: string }
        >;
      }
    >();
    compareAppInsights.forEach((insight) => {
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
          appKey: insight.compareKey,
          appTitle: insight.app.title,
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
        if (
          !current.rankings.some((item) => item.appKey === insight.compareKey)
        ) {
          current.suggestions.push({
            ...suggestionItem,
            appKey: insight.compareKey,
            appTitle: insight.app.title,
          });
        }
        coverage.set(keywordKey, current);
      });
    });
    return Array.from(coverage.values());
  }, [compareAppInsights]);
  const compareSharedBattles = React.useMemo(
    () =>
      compareKeywordCoverage
        .filter((entry) => entry.rankings.length >= 2)
        .map((entry) => {
          const rankedApps = [...entry.rankings].sort(
            (a, b) => a.rank - b.rank,
          );
          const leader = rankedApps[0];
          const runnerUp = rankedApps[1];
          const metricSource =
            entry.rankings.length > 0 ? entry.rankings : entry.suggestions;
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
              metricSource.reduce(
                (sum, item) => sum + (item.difficulty ?? 0),
                0,
              ) / metricCount,
            ),
            averageRelevance: Math.round(
              metricSource.reduce(
                (sum, item) => sum + (item.relevance ?? 0),
                0,
              ) / metricCount,
            ),
          };
        })
        .sort((a, b) => {
          if (b.rankedApps.length !== a.rankedApps.length)
            return b.rankedApps.length - a.rankedApps.length;
          if (a.leader.rank !== b.leader.rank)
            return a.leader.rank - b.leader.rank;
          return b.gap - a.gap;
        })
        .slice(0, 12),
    [compareKeywordCoverage],
  );
  const compareGapRows = React.useMemo(
    () =>
      compareKeywordCoverage
        .map((entry) => {
          const rankedApps = [...entry.rankings].sort(
            (a, b) => a.rank - b.rank,
          );
          const rankedAppKeys = new Set(rankedApps.map((item) => item.appKey));
          const missingApps = compareAppInsights
            .filter((insight) => !rankedAppKeys.has(insight.compareKey))
            .map((insight) => insight.app.title);
          const leader = rankedApps[0];
          const metricSource =
            entry.rankings.length > 0 ? entry.rankings : entry.suggestions;
          if (missingApps.length === 0) return null;
          if (!leader && entry.suggestions.length < 2) return null;
          const metricCount = metricSource.length || 1;
          const averageVolume = Math.round(
            metricSource.reduce((sum, item) => sum + (item.demand ?? item.volume ?? 0), 0) /
              metricCount,
          );
          const averageDifficulty = Math.round(
            metricSource.reduce(
              (sum, item) => sum + (item.difficulty ?? 0),
              0,
            ) / metricCount,
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
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .sort((a, b) => b.score - a.score)
        .slice(0, 12),
    [compareAppInsights, compareKeywordCoverage],
  );
  const compareCoverageChartData = React.useMemo(
    () =>
      compareAppInsights.map((insight) => ({
        appTitle:
          insight.app.title.length > 18
            ? `${insight.app.title.slice(0, 18)}...`
            : insight.app.title,
        top10: insight.top10,
        top30: insight.top30,
        top100: insight.top100,
      })),
    [compareAppInsights],
  );
  const compareAnalyzedCount = React.useMemo(
    () =>
      compareAppInsights.filter((insight) => Boolean(insight.discovery)).length,
    [compareAppInsights],
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
  const buildExportPayload = React.useCallback((): DataExportPayload => {
    const exportedAt = new Date().toISOString();
    const countryName =
      COUNTRIES.find((entry) => entry.code === country)?.name || country;
    if (viewMode === "single" && selectedApp) {
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
    if (viewMode === "compare") {
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
          app: insight.app,
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
    throw new Error("This page cannot be exported.");
  }, [
    autoRankings,
    compareAnalyzedCount,
    compareAppInsights,
    compareDiscoveryMode,
    compareGapRows,
    compareKeyword,
    compareRankings,
    compareSharedBattles,
    comparedApps,
    country,
    keywordSuggestions,
    ranking,
    selectedApp,
    selectedAppExportHistory,
    selectedAppExportTrackedKeywords,
    storeType,
    viewMode,
  ]);
  const buildExportRows = React.useCallback((): CsvRow[] => {
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
          volume: payload.currentRankCheck.volume,
          difficulty: payload.currentRankCheck.difficulty,
          relevance: payload.currentRankCheck.relevance,
        });
      }
      payload.discoveredRankings.forEach((entry, index) => {
        rows.push({
          section: "discovered_rankings",
          row: index + 1,
          keyword: entry.keyword,
          rank: entry.rank,
          volume: entry.volume,
          difficulty: entry.difficulty,
          relevance: entry.relevance,
        });
      });
      payload.keywordSuggestions.forEach((entry, index) => {
        rows.push({
          section: "keyword_suggestions",
          row: index + 1,
          keyword: entry.keyword,
          volume: entry.volume,
          difficulty: entry.difficulty,
          relevance: entry.relevance,
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
          volume: entry.volume,
          difficulty: entry.difficulty,
          relevance: entry.relevance,
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
    return rows;
  }, [buildExportPayload, storeType]);
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
  }, [selectedApp, viewMode, comparedApps.length]);
  useEffect(() => {
    if (
      viewMode !== "compare" ||
      comparedApps.length === 0 ||
      isAnalyzingCompare
    )
      return;
    const needsAnalysis = comparedApps.some((app) => {
      const payload = compareDiscoveries[getCompareAppKey(app, storeType)];
      return !payload || payload.mode !== compareDiscoveryMode;
    });
    if (needsAnalysis) {
      void analyzeComparedApps({ mode: compareDiscoveryMode });
    }
  }, [
    analyzeComparedApps,
    compareDiscoveries,
    compareDiscoveryMode,
    comparedApps,
    isAnalyzingCompare,
    storeType,
    viewMode,
  ]);
  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    setSearchResults([]);
    setHasSearched(false);
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
    setComparedApps((prev) =>
      prev.filter(
        (app) =>
          (app.appId || app.id) !== (appToRemove.appId || appToRemove.id),
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
    const normalizedTrackSearch = trackSearchTerm.trim().toLowerCase();
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
    trackSearchTerm,
    trackSortBy,
    trackedHistoryByKey,
    trackedKeywords,
  ]);
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
  const visibleTrackedGroupIds = React.useMemo(
    () => processedTrackedKeywordGroups.map((group) => group.groupId),
    [processedTrackedKeywordGroups],
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
  if (!userStateHydrated) {
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
              background: themeMode === "light"
                ? "rgba(255,255,255,0.9)"
                : "rgba(15,23,42,0.65)",
              border: themeMode === "light"
                ? "1px solid rgba(148,163,184,0.32)"
                : "1px solid rgba(51,65,85,0.45)",
              boxShadow: themeMode === "light"
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
  return (
    <ErrorBoundary>
      <div
        className="min-h-screen text-app-text font-sans relative"
        style={{ background: "#020617" }}
      >
        {" "}
        {/* Ambient background orbs */} <div className="bg-orb bg-orb-1" />{" "}
        <div className="bg-orb bg-orb-2" /> <div className="bg-orb bg-orb-3" />{" "}
        <header
          className="sticky top-0 z-30 transition-all duration-300"
          style={{
            background: "rgba(2,6,23,0.85)",
            backdropFilter: "blur(24px) saturate(1.5)",
            borderBottom: "1px solid rgba(51,65,85,0.4)",
          }}
        >
          {" "}
          <div className="max-w-6xl mx-auto px-3 sm:px-5 py-3 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
            {" "}
            {/* Brand */}{" "}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {" "}
              <div
                className="logo-icon relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl"
                style={{
                  background:
                    "linear-gradient(135deg, #22d3ee 0%, #818cf8 100%)",
                  boxShadow: "0 0 20px rgba(34,211,238,0.3)",
                }}
              >
                {" "}
                <TrendingUp
                  className="w-4 h-4 sm:w-5 sm:h-5 text-slate-950"
                  strokeWidth={2.5}
                />{" "}
              </div>{" "}
              <h1
                className="font-display font-bold tracking-tight text-app-text flex items-center gap-2 text-base sm:text-lg"
                style={{ letterSpacing: "-0.02em" }}
              >
                {" "}
                <span className="hidden xs:inline sm:inline">
                  Rank Analyzer
                </span>{" "}
                <span
                  className="px-1.5 sm:px-2 py-0.5 rounded-lg text-[9px] sm:text-[10px] uppercase font-bold tracking-widest"
                  style={{
                    background: "rgba(129,140,248,0.15)",
                    border: "1px solid rgba(129,140,248,0.25)",
                    color: "#a5b4fc",
                  }}
                >
                  Pro
                </span>{" "}
              </h1>{" "}
            </div>{" "}
            {/* Controls */}{" "}
            <div className="flex items-center gap-1.5 sm:gap-3">
              {" "}
              <div
                className="hidden lg:flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{
                  background: "rgba(15,23,42,0.8)",
                  border: "1px solid rgba(51,65,85,0.5)",
                }}
              >
                {" "}
                <div className="min-w-0">
                  {" "}
                  <p className="text-[11px] uppercase tracking-[0.18em] text-app-text-muted">
                    Signed in as
                  </p>{" "}
                  <p className="text-sm font-semibold text-app-text truncate max-w-[180px]">
                    {" "}
                    {currentUser.displayName ||
                      currentUser.email ||
                      "Authenticated user"}{" "}
                  </p>{" "}
                </div>{" "}
                {notificationPermission !== "granted" && (
                  <button
                    onClick={requestNotificationPermission}
                    className="p-2 rounded-xl text-amber-400 hover:text-amber-300 transition-all hover:bg-amber-500/10"
                    title="Enable Push Notifications"
                  >
                    {" "}
                    <BellRing className="w-4 h-4" />{" "}
                  </button>
                )}{" "}
                <button
                  onClick={onSignOut}
                  className="p-2 rounded-xl text-app-text-muted hover:text-app-text transition-all hover:bg-white/5"
                  title="Sign out"
                >
                  {" "}
                  <LogOut className="w-4 h-4" />{" "}
                </button>{" "}
                <div className="relative">
                  {" "}
                  <button
                    onClick={() =>
                      setIsConfirmingDeleteAccount((prev) => !prev)
                    }
                    className={`p-2 rounded-xl transition-all ${isConfirmingDeleteAccount ? "text-red-300 bg-red-500/10 border border-red-500/20" : "text-app-text-muted hover:text-red-300 hover:bg-red-500/10"}`}
                    title="Delete account"
                  >
                    {" "}
                    <Trash2 className="w-4 h-4" />{" "}
                  </button>{" "}
                  {isConfirmingDeleteAccount && (
                    <div
                      className="absolute top-full right-0 mt-2 w-72 rounded-2xl shadow-2xl p-4 z-50"
                      style={{
                        background: "rgba(10,15,35,0.97)",
                        border: "1px solid rgba(127,29,29,0.7)",
                        backdropFilter: "blur(20px)",
                      }}
                    >
                      {" "}
                      <p className="text-sm font-semibold text-red-200 mb-2">
                        Delete this account?
                      </p>{" "}
                      <p className="text-xs text-app-text-muted mb-3 leading-relaxed">
                        {" "}
                        This removes your saved bookmarks, tracked keywords,
                        rank history, and Firebase login for this account.{" "}
                      </p>{" "}
                      <p className="text-xs text-amber-300 mb-3 leading-relaxed">
                        {" "}
                        If Firebase asks for a recent login, sign in again and
                        retry.{" "}
                      </p>{" "}
                      <div className="flex gap-2">
                        {" "}
                        <button
                          onClick={async () => {
                            setIsDeletingAccount(true);
                            try {
                              await onDeleteAccount();
                            } finally {
                              setIsDeletingAccount(false);
                              setIsConfirmingDeleteAccount(false);
                            }
                          }}
                          disabled={isDeletingAccount}
                          className="flex-1 text-app-text text-xs font-bold py-2 rounded-lg transition-colors disabled:opacity-60"
                          style={{ background: "rgba(220,38,38,0.95)" }}
                        >
                          {" "}
                          {isDeletingAccount ? "Deleting..." : "Delete"}{" "}
                        </button>{" "}
                        <button
                          onClick={() => setIsConfirmingDeleteAccount(false)}
                          disabled={isDeletingAccount}
                          className="flex-1 text-app-text-muted text-xs font-bold py-2 rounded-lg transition-colors hover:text-app-text disabled:opacity-60"
                          style={{
                            background: "rgba(30,41,59,0.8)",
                            border: "1px solid rgba(51,65,85,0.5)",
                          }}
                        >
                          {" "}
                          Cancel{" "}
                        </button>{" "}
                      </div>{" "}
                    </div>
                  )}{" "}
                </div>{" "}
              </div>{" "}
              {/* Country selector */}{" "}
              <div
                className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl flex-shrink-0"
                style={{
                  background: "rgba(15,23,42,0.8)",
                  border: "1px solid rgba(51,65,85,0.5)",
                }}
              >
                {" "}
                <Globe className="hidden sm:block w-3.5 h-3.5 text-app-text-muted flex-shrink-0" />{" "}
                <CountrySearchSelect
                  value={country}
                  onChange={handleCountryChange}
                  options={COUNTRIES}
                  ariaLabel="Select storefront country"
                  className="min-w-[10rem] sm:min-w-[13rem]"
                />{" "}
              </div>{" "}
              {/* Store toggle */}{" "}
              <div
                className="flex p-1 rounded-xl relative"
                style={{
                  background: "rgba(15,23,42,0.8)",
                  border: "1px solid rgba(51,65,85,0.5)",
                }}
              >
                {" "}
                <button
                  onClick={() => handleStoreTypeChange("android")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 relative z-10 ${storeType === "android" ? "text-slate-950" : "text-app-text-muted hover:text-app-text"}`}
                >
                  {" "}
                  <Play
                    className="w-3.5 h-3.5"
                    fill={storeType === "android" ? "currentColor" : "none"}
                  />{" "}
                  Play{" "}
                </button>{" "}
                <button
                  onClick={() => handleStoreTypeChange("ios")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 relative z-10 ${storeType === "ios" ? "text-slate-950" : "text-app-text-muted hover:text-app-text"}`}
                >
                  {" "}
                  <Apple className="w-3.5 h-3.5" /> iOS{" "}
                </button>{" "}
                <div
                  className="absolute top-1 bottom-1 rounded-lg pointer-events-none transition-all duration-300 shadow-sm"
                  style={{
                    background: "linear-gradient(135deg, #22d3ee, #818cf8)",
                    width: storeType === "ios" ? "62px" : "68px",
                    transform:
                      storeType === "ios"
                        ? "translateX(64px)"
                        : "translateX(0)",
                  }}
                />{" "}
              </div>{" "}
              {/* Cache clear */}{" "}
              <div className="relative">
                {" "}
                <button
                  onClick={() => setIsConfirmingClear(!isConfirmingClear)}
                  className={`p-2 rounded-xl transition-all ${isConfirmingClear ? "text-red-400 bg-red-500/10 border border-red-500/20" : "text-app-text-muted hover:text-red-400"}`}
                  style={{
                    border: isConfirmingClear
                      ? undefined
                      : "1px solid transparent",
                  }}
                  title="Clear Cache"
                >
                  {" "}
                  <Trash2 className="w-4 h-4" />{" "}
                </button>{" "}
                {isConfirmingClear && (
                  <div
                    className="absolute top-full right-0 mt-2 w-52 rounded-2xl shadow-2xl p-4 z-50"
                    style={{
                      background: "rgba(10,15,35,0.97)",
                      border: "1px solid rgba(51,65,85,0.6)",
                      backdropFilter: "blur(20px)",
                    }}
                  >
                    {" "}
                    <p className="text-xs text-app-text-muted mb-3 leading-relaxed">
                      Clear search cache? Bookmarks & tracked keywords are safe.
                    </p>{" "}
                    <div className="flex gap-2">
                      {" "}
                      <button
                        onClick={() => {
                          try {
                            const keysToRemove = safeStorage
                              .keys()
                              .filter(
                                (key) =>
                                  key.startsWith("search-") ||
                                  key.startsWith("app-") ||
                                  key.startsWith("aso-analysis-") ||
                                  key.startsWith("ranking-"),
                              );
                            keysToRemove.forEach((key) =>
                              safeStorage.removeItem(key),
                            );
                            setIsConfirmingClear(false);
                            setSuccessMessage("Cache cleared!");
                            setTimeout(() => setSuccessMessage(null), 3000);
                          } catch (e) {
                            setIsConfirmingClear(false);
                          }
                        }}
                        className="flex-1 text-app-text text-xs font-bold py-2 rounded-lg transition-colors"
                        style={{ background: "rgba(239,68,68,0.9)" }}
                      >
                        Clear
                      </button>{" "}
                      <button
                        onClick={() => setIsConfirmingClear(false)}
                        className="flex-1 text-app-text-muted text-xs font-bold py-2 rounded-lg transition-colors hover:text-app-text"
                        style={{
                          background: "rgba(30,41,59,0.8)",
                          border: "1px solid rgba(51,65,85,0.5)",
                        }}
                      >
                        Cancel
                      </button>{" "}
                    </div>{" "}
                  </div>
                )}{" "}
              </div>{" "}
              {notificationPermission !== "granted" && (
                <button
                  onClick={requestNotificationPermission}
                  className="lg:hidden p-2 rounded-xl text-amber-400 hover:text-amber-300 transition-all hover:bg-amber-500/10"
                  title="Enable Push Notifications"
                >
                  {" "}
                  <BellRing className="w-4 h-4" />{" "}
                </button>
              )}{" "}
              <button
                onClick={onSignOut}
                className="lg:hidden p-2 rounded-xl text-app-text-muted hover:text-app-text transition-all hover:bg-white/5"
                title="Sign out"
              >
                {" "}
                <LogOut className="w-4 h-4" />{" "}
              </button>{" "}
              <button
                onClick={async () => {
                  const confirmed = window.confirm(
                    "Delete this account and all saved app data? This cannot be undone.",
                  );
                  if (!confirmed) return;
                  setIsDeletingAccount(true);
                  try {
                    await onDeleteAccount();
                  } finally {
                    setIsDeletingAccount(false);
                  }
                }}
                disabled={isDeletingAccount}
                className="lg:hidden p-2 rounded-xl text-app-text-muted hover:text-red-300 transition-all hover:bg-red-500/10 disabled:opacity-60"
                title="Delete account"
              >
                {" "}
                {isDeletingAccount ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}{" "}
              </button>{" "}
            </div>{" "}
          </div>{" "}
        </header>{" "}
        <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {" "}
          {successMessage && (
            <div
              className="mb-5 p-4 rounded-2xl flex items-center justify-between"
              style={{
                background: "rgba(16,185,129,0.08)",
                border: "1px solid rgba(16,185,129,0.2)",
              }}
            >
              {" "}
              <div
                className="flex items-center gap-2.5 text-sm font-medium"
                style={{ color: "#34d399" }}
              >
                {" "}
                <div
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: "#10b981" }}
                />{" "}
                {successMessage}{" "}
              </div>{" "}
              <button
                onClick={() => setSuccessMessage(null)}
                className="text-app-text-muted hover:text-app-text-muted transition-colors p-1 rounded-lg hover:bg-white/5"
              >
                {" "}
                <X className="w-4 h-4" />{" "}
              </button>{" "}
            </div>
          )}{" "}
          {/* Navigation Tabs */}
          <div className="flex gap-1 mb-6 sm:mb-8 p-1 rounded-2xl w-full sm:w-fit overflow-x-auto scrollbar-hide bg-app-surface/70 border border-app-border/50 backdrop-blur-sm">
            {(
              [
                { id: "single", label: "Analyze", icon: Search },
                { id: "compare", label: "Compare", icon: Layers },
                {
                  id: "bookmarks",
                  label: "Bookmarks",
                  icon: Bookmark,
                  badge: bookmarks.length > 0 ? bookmarks.length : undefined,
                },
                {
                  id: "tracked",
                  label: "Tracked",
                  icon: Bell,
                  badge:
                    trackedKeywordGroupCount > 0
                      ? trackedKeywordGroupCount
                      : undefined,
                },
              ] as Array<{
                id: "single" | "compare" | "bookmarks" | "tracked";
                label: string;
                icon: any;
                badge?: number;
              }>
            ).map(({ id, label, icon: Icon, badge }) => (
              <button
                key={id}
                onClick={() => setViewMode(id)}
                className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                  viewMode === id
                    ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 shadow-sm"
                    : "text-app-text-muted border border-transparent hover:text-app-text"
                }`}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{label}</span>
                {badge !== undefined && (
                  <span className={`ml-0.5 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    viewMode === id
                      ? "bg-cyan-500/20 text-cyan-300"
                      : "bg-app-surface-strong text-app-text-muted"
                  }`}>
                    {badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Search Section */}
          {viewMode !== "bookmarks" && viewMode !== "tracked" && (
            <WorkspacePanel tone="strong" className="mb-8">
              <div className="flex flex-col gap-3 lg:gap-5 xl:flex-row xl:items-end xl:justify-between mb-5">
                <div>
                  <div className="workspace-chip-label">
                    {viewMode === "single" ? "Analyze" : "Compare"}
                  </div>
                  <h2 className="mt-1 text-lg lg:text-xl font-semibold text-app-text flex items-center gap-2">
                    {viewMode === "single" ? "Find an App to Analyze" : "Search & Add Apps to Compare"}
                    {viewMode === "compare" && (
                      <span className="badge badge-cyan">Max 5</span>
                    )}
                  </h2>
                  <p className="mt-1 text-xs lg:text-sm text-app-text-muted lg:mt-2">
                    {viewMode === "single" 
                      ? "Search the store to discover keywords, estimate volume, and analyze visibility."
                      : "Add up to 5 apps to compare their rankings and keyword overlaps side-by-side."}
                  </p>
                </div>
              </div>
              <form
                onSubmit={handleSearch}
                className="flex flex-col sm:flex-row gap-3"
              >
                {" "}
                <div className="relative flex-1">
                  {" "}
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-app-text-muted" />{" "}
                  <input
                    id="app-search"
                    name="appSearch"
                    aria-label="Search apps or paste an app store URL"
                    type="text"
                    autoComplete="off"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={`Search apps or paste a ${storeType === "android" ? "Play Store" : "App Store"} URL...`}
                    className="input-field"
                    style={{
                      paddingLeft: "3rem",
                      paddingRight: searchTerm ? "3rem" : "1.25rem",
                      fontSize: "1rem",
                    }}
                  />{" "}
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm("");
                        setSearchResults([]);
                        setHasSearched(false);
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-app-text-muted hover:text-app-text-muted transition-colors p-1 rounded-full hover:bg-app-surface-strong bg-app-surface-muted"
                    >
                      {" "}
                      <X className="w-4 h-4" />{" "}
                    </button>
                  )}{" "}
                </div>{" "}
                <button
                  type="submit"
                  disabled={isSearching || !searchTerm.trim()}
                  className="btn-primary sm:w-auto w-full"
                  style={{ padding: "0.875rem 2rem", fontSize: "0.9375rem" }}
                >
                  {" "}
                  {isSearching ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Search
                    </>
                  )}{" "}
                </button>{" "}
              </form>{" "}
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
                  className="mt-4 rounded-2xl overflow-hidden"
                  style={{
                    border: "1px solid rgba(51,65,85,0.4)",
                    background: "rgba(10,15,35,0.6)",
                  }}
                >
                  {" "}
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="p-5 flex items-center justify-between gap-4"
                      style={{
                        borderBottom:
                          i < 4 ? "1px solid rgba(30,41,59,0.8)" : "none",
                      }}
                    >
                      {" "}
                      <div className="flex items-center gap-4 flex-1">
                        {" "}
                        <div className="skeleton w-14 h-14 rounded-2xl" />{" "}
                        <div className="space-y-2.5 flex-1">
                          {" "}
                          <div
                            className="skeleton h-4 rounded-lg"
                            style={{ width: "40%" }}
                          />{" "}
                          <div
                            className="skeleton h-3 rounded-lg"
                            style={{ width: "25%" }}
                          />{" "}
                        </div>{" "}
                      </div>{" "}
                      <div className="skeleton w-28 h-10 rounded-xl" />{" "}
                    </div>
                  ))}{" "}
                </div>
              )}{" "}
              {!isSearching &&
                hasSearched &&
                searchResults.length === 0 &&
                !error &&
                !selectedApp && (
                  <div className="mt-4">
                    <WorkspaceEmptyBlock
                      icon={Search}
                      title="No apps found"
                      description="Try adjusting your search term or paste a direct store URL."
                    />
                  </div>
                )}{" "}
              {!isSearching && searchResults.length > 0 && !selectedApp && (
                <div className="mt-5 space-y-3">
                  {" "}
                  {/* Category Filters */}{" "}
                  {categories.length > 1 && (
                    <div className="flex overflow-x-auto scrollbar-hide gap-2 pb-2">
                      {" "}
                      <button
                        onClick={() => setSelectedCategory(null)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border whitespace-nowrap ${selectedCategory === null ? "text-slate-950 border-transparent" : "text-app-text-muted hover:text-app-text"}`}
                        style={
                          selectedCategory === null
                            ? {
                                background:
                                  "linear-gradient(135deg,#22d3ee,#818cf8)",
                                boxShadow: "0 4px 12px rgba(34,211,238,0.25)",
                              }
                            : {
                                background: "rgba(30,41,59,0.6)",
                                borderColor: "rgba(51,65,85,0.5)",
                              }
                        }
                      >
                        All
                      </button>{" "}
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border whitespace-nowrap ${selectedCategory === cat ? "text-slate-950 border-transparent" : "text-app-text-muted hover:text-app-text"}`}
                          style={
                            selectedCategory === cat
                              ? {
                                  background:
                                    "linear-gradient(135deg,#22d3ee,#818cf8)",
                                  boxShadow: "0 4px 12px rgba(34,211,238,0.25)",
                                }
                              : {
                                  background: "rgba(30,41,59,0.6)",
                                  borderColor: "rgba(51,65,85,0.5)",
                                }
                          }
                        >
                          {cat}
                        </button>
                      ))}{" "}
                    </div>
                  )}{" "}
                  <div
                    className="rounded-2xl overflow-hidden max-h-[560px] overflow-y-auto"
                    style={{
                      border: "1px solid rgba(51,65,85,0.4)",
                      background: "rgba(10,15,35,0.7)",
                    }}
                  >
                    {" "}
                    {filteredResults.length > 0 ? (
                      filteredResults.map((app, idx) => (
                        <div
                          key={app.appId || app.id}
                          className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 transition-all hover:bg-white/[0.03] cursor-pointer"
                          style={{
                            borderBottom:
                              idx < filteredResults.length - 1
                                ? "1px solid rgba(30,41,59,0.7)"
                                : "none",
                          }}
                        >
                          {" "}
                          <div
                            className="flex items-center gap-4 flex-1 min-w-0"
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
                              className="w-14 h-14 rounded-2xl shadow-lg object-cover flex-shrink-0"
                              style={{ border: "1px solid rgba(51,65,85,0.4)" }}
                            />{" "}
                            <div className="min-w-0">
                              {" "}
                              <h3
                                className="font-semibold text-app-text line-clamp-1 mb-0.5"
                                style={{ fontSize: "0.9375rem" }}
                              >
                                {app.title}
                              </h3>{" "}
                              <div className="flex flex-wrap items-center gap-2">
                                {" "}
                                <p className="text-sm text-app-text-muted">
                                  {app.developer}
                                </p>{" "}
                                {app.category && (
                                  <span className="badge badge-cyan">
                                    {app.category}
                                  </span>
                                )}{" "}
                              </div>{" "}
                            </div>{" "}
                          </div>{" "}
                          {viewMode === "compare" ? (
                            <button
                              onClick={() => handleSelectApp(app)}
                              disabled={
                                comparedApps.some(
                                  (a) =>
                                    (a.appId || a.id) === (app.appId || app.id),
                                ) || comparedApps.length >= 5
                              }
                              className="text-xs font-bold px-5 py-2.5 rounded-xl transition-all disabled:opacity-40 flex-shrink-0"
                              style={
                                comparedApps.some(
                                  (a) =>
                                    (a.appId || a.id) === (app.appId || app.id),
                                )
                                  ? {
                                      background: "rgba(16,185,129,0.1)",
                                      border: "1px solid rgba(16,185,129,0.3)",
                                      color: "#34d399",
                                    }
                                  : {
                                      background: "rgba(34,211,238,0.08)",
                                      border: "1px solid rgba(34,211,238,0.2)",
                                      color: "#22d3ee",
                                    }
                              }
                            >
                              {" "}
                              {comparedApps.some(
                                (a) =>
                                  (a.appId || a.id) === (app.appId || app.id),
                              )
                                ? "âœ“ Added"
                                : "+ Compare"}{" "}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSelectApp(app)}
                              className="btn-primary text-xs flex-shrink-0"
                              style={{ padding: "0.6rem 1.25rem" }}
                            >
                              Analyze
                            </button>
                          )}{" "}
                        </div>
                      ))
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
            </WorkspacePanel>
          )}{" "}
          {/* Bookmarks Dashboard */}
          {viewMode === "bookmarks" && (
            <div className="space-y-6">
              <WorkspacePanel tone="strong">
                <div className="flex flex-col gap-3 lg:gap-5 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <div className="workspace-chip-label">Bookmarks</div>
                    <h2 className="mt-1 text-lg lg:text-xl font-semibold text-app-text">
                      Bookmarked Apps
                    </h2>
                    <p className="mt-1 text-xs lg:text-sm text-app-text-muted lg:mt-2">
                      Quickly access apps you've saved for later analysis.
                    </p>
                  </div>
                </div>
              </WorkspacePanel>
              {bookmarks.length === 0 ? (
                <WorkspaceEmptyBlock
                  icon={Bookmark}
                  title="No bookmarks yet"
                  description="Analyze an app and click the bookmark icon to save it here."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {" "}
                  {bookmarks.map((b) => (
                    <div
                      key={`${b.store}-${b.appId || b.id}`}
                      className="card group p-4 flex items-center gap-4 cursor-pointer hover:-translate-y-1"
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
                    >
                      {" "}
                      <img
                        src={b.icon}
                        alt={b.title}
                        className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-app-border/60"
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
                        className="p-2 rounded-xl transition-all opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-app-text-muted hover:text-red-400"
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
            <div className="space-y-6">
              {" "}
              <div className="space-y-3">
                <WorkspacePanel tone="strong">
                  <div className="flex flex-col gap-3 lg:gap-5 xl:flex-row xl:items-end xl:justify-between">
                    <div>
                      <div className="workspace-chip-label">Tracking</div>
                      <h2 className="mt-1 text-lg lg:text-xl font-semibold text-app-text">
                        Tracked Keywords
                      </h2>
                      <p className="mt-1 text-xs lg:text-sm text-app-text-muted lg:mt-2">
                        Focus on the latest rank, region coverage, and what needs attention.
                      </p>
                    </div>
                    {trackedKeywordGroupCount > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 lg:gap-2 text-[10px] lg:text-xs">
                        <span className="rounded-full border border-app-border/60 bg-app-surface/45 px-2 py-1 lg:px-3 lg:py-1.5 text-app-text-muted">
                          {trackedDashboardStats.totalGroups} groups
                        </span>
                        <span className="rounded-full border border-app-border/60 bg-app-surface/45 px-2 py-1 lg:px-3 lg:py-1.5 text-emerald-300">
                          {trackedDashboardStats.rankedCount} ranking
                        </span>
                        {(trackedDashboardStats.pendingCount > 0 || trackedDashboardStats.needsAttentionCount > 0) && (
                          <span className="rounded-full border border-app-border/60 bg-app-surface/45 px-2 py-1 lg:px-3 lg:py-1.5 text-amber-300">
                            {trackedDashboardStats.pendingCount} pending / {trackedDashboardStats.needsAttentionCount} errors
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {trackedKeywordGroupCount > 0 && (
                    <>
                      <div className="mt-3 grid grid-cols-2 gap-2 lg:mt-4 lg:gap-3 lg:grid-cols-[minmax(0,1.5fr)_220px_220px_220px]">
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
                        <div className="col-span-2 sm:col-span-1 lg:col-span-1">
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
                        <select
                          id="tracked-app-filter"
                          name="trackedAppFilter"
                          aria-label="Filter tracked keywords by app"
                          value={trackFilterApp}
                          onChange={(e) => setTrackFilterApp(e.target.value)}
                          className="input-field py-2 w-full col-span-1 lg:col-span-1 text-xs lg:py-2.5 lg:text-sm"
                          style={{ paddingRight: "1.5rem" }}
                        >
                          <option value="all">All Apps</option>
                          {trackedAppTitles.map((title) => (
                            <option key={title} value={title}>
                              {title}
                            </option>
                          ))}
                        </select>
                        <select
                          id="tracked-sort"
                          name="trackedSort"
                          aria-label="Sort tracked keywords"
                          value={trackSortBy}
                          onChange={(e) => setTrackSortBy(e.target.value as any)}
                          className="input-field py-2 w-full col-span-1 lg:col-span-1 text-xs lg:py-2.5 lg:text-sm"
                          style={{ paddingRight: "1.5rem" }}
                        >
                          <option value="date_added">Newest first</option>
                          <option value="last_checked">Recently checked</option>
                          <option value="app">App name</option>
                          <option value="rank_change">Biggest change</option>
                        </select>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1 lg:gap-2 lg:mt-3 text-[10px] lg:text-xs">
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

                <div className="rounded-2xl border border-app-border/60 bg-app-surface/40 px-4 py-3 text-xs text-app-text-muted">
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
                      Last refresh: {trackingSchedule.lastRunAt ? new Date(trackingSchedule.lastRunAt).toLocaleString() : "Not yet"}
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
                      description='Search for an app, check a keyword ranking, and click "Track Keyword" to monitor it here.'
                    />
                  );
                }
                if (processedTrackedKeywordGroups.length === 0) {
                  return (
                    <WorkspaceEmptyBlock
                      icon={Search}
                      title="No results match your filter"
                      description={`No tracked keyword groups for ${
                        trackFilterCountry === "all"
                          ? "all countries"
                          : findCountryName(trackFilterCountry) || trackFilterCountry
                      } match your filter.`}
                    />
                  );
                }
                return (
                  <div className="space-y-3">
                    {processedTrackedKeywordGroups.map((group) => {
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
                        const summaryImprovement =
                          summaryCountryView?.improvement ?? 0;
                        const summaryLineColor =
                          summaryImprovement >= 0 ? "#10b981" : "#f43f5e";
                        return (
                          <div
                            key={group.groupId}
                            className="rounded-2xl border border-app-border/60 bg-app-surface-muted/60 shadow-sm"
                          >
                            <div className="flex flex-col gap-3 px-4 py-3 sm:px-5 lg:grid lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.3fr)_72px_96px_76px_32px] lg:items-center lg:gap-4">
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
                                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-app-surface-strong border border-app-border flex items-center justify-center">
                                  {" "}
                                  {group.store === "ios" ? (
                                    <Apple className="w-3.5 h-3.5 text-app-text-muted" />
                                  ) : (
                                    <Play className="w-3.5 h-3.5 text-app-text-muted" />
                                  )}{" "}
                                </div>{" "}
                                <div className="min-w-0">
                                  {" "}
                                  <p className="text-sm font-semibold text-app-text truncate leading-tight">
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
                              {/* Regions — hidden on mobile */}{" "}
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
                                  className="rounded-full border border-app-border/60 bg-app-surface-strong/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-app-text-muted outline-none"
                                  aria-label={`Select summary country for ${group.keyword}`}
                                >
                                  {group.countryViews.map((cv) => (
                                    <option
                                      key={`${group.groupId}:${cv.trackedKeyword.country}:summary-option`}
                                      value={cv.trackedKeyword.country}
                                    >
                                      {cv.trackedKeyword.country.toUpperCase()} · {findCountryName(cv.trackedKeyword.country)}
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
                                      className="inline-flex items-center gap-1 rounded-full bg-app-surface-strong/80 border border-app-border/60 px-2 py-0.5 text-[10px]"
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
                              {/* Sparkline */}{" "}
                              <div className="hidden md:block h-9 w-24">
                                {" "}
                                {summaryHistory.length > 1 ? (
                                  <ResponsiveContainer
                                    width="100%"
                                    height="100%"
                                  >
                                    {" "}
                                    <LineChart data={summaryHistory}>
                                      {" "}
                                      <YAxis
                                        hide
                                        domain={["dataMin - 2", "dataMax + 2"]}
                                      />{" "}
                                      <Line
                                        type="monotone"
                                        dataKey="rank"
                                        stroke={summaryLineColor}
                                        strokeWidth={2}
                                        dot={false}
                                        isAnimationActive={false}
                                      />{" "}
                                    </LineChart>{" "}
                                  </ResponsiveContainer>
                                ) : (
                                  <div className="flex h-full items-center justify-center text-[10px] text-slate-600">
                                    —
                                  </div>
                                )}{" "}
                              </div>{" "}
                              {/* Change badge */}{" "}
                              <div className="flex justify-start lg:justify-center">
                                {" "}
                                {summaryImprovement !== 0 ? (
                                  <span
                                    className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-1 rounded-lg ${summaryImprovement > 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}
                                  >
                                    {" "}
                                    {summaryImprovement > 0 ? (
                                      <TrendingUp className="w-3 h-3" />
                                    ) : (
                                      <TrendingDown className="w-3 h-3" />
                                    )}{" "}
                                    {Math.abs(summaryImprovement)}{" "}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-600">
                                    —
                                  </span>
                                )}{" "}
                              </div>{" "}
                              {/* Delete */}{" "}
                              <div className="flex justify-end">
                                {" "}
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
                              <div className="px-5 pb-5 pt-2 border-t border-app-border/40 bg-app-surface/30">
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
                                    const chartRankDepth = Math.max(
                                      100,
                                      ...tHistory.map((e) => e.rankDepth),
                                    );
                                    const chartMax = Math.max(
                                      chartRankDepth + 1,
                                      worstRank ?? chartRankDepth + 1,
                                    );
                                    const isPositive = improvement >= 0;
                                    const lineColor = isPositive
                                      ? "#10b981"
                                      : "#f43f5e";
                                    const gradientId =
                                      `cg-${group.groupId}-${trackedKeyword.country}`.replace(
                                        /[^a-z0-9-]/gi,
                                        "-",
                                      );
                                    const currentRankVal =
                                      tHistory[tHistory.length - 1]?.rawRank;
                                    const yTicks = Array.from(
                                      new Set([
                                        1,
                                        ...(currentRankVal &&
                                        currentRankVal !== -1
                                          ? [currentRankVal]
                                          : []),
                                        ...(bestRank &&
                                        bestRank !== 1 &&
                                        bestRank !== currentRankVal
                                          ? [bestRank]
                                          : []),
                                        chartMax,
                                      ]),
                                    ).sort((a, b) => a - b);
                                    return (
                                      <div
                                        key={`${group.groupId}:${trackedKeyword.country}`}
                                        className="rounded-xl border border-app-border/50 bg-app-surface-muted/60 p-3"
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
                                                className={`text-[10px] font-bold flex items-center justify-end gap-0.5 mt-1 ${improvement > 0 ? "text-emerald-400" : "text-red-400"}`}
                                              >
                                                {" "}
                                                {improvement > 0 ? (
                                                  <TrendingUp className="w-3 h-3" />
                                                ) : (
                                                  <TrendingDown className="w-3 h-3" />
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
                                              {" "}
                                              <ResponsiveContainer
                                                width="100%"
                                                height="100%"
                                              >
                                                {" "}
                                                <LineChart
                                                  data={tHistory}
                                                  margin={{
                                                    top: 4,
                                                    right: 4,
                                                    bottom: 0,
                                                    left: 0,
                                                  }}
                                                >
                                                  {" "}
                                                  <defs>
                                                    {" "}
                                                    <linearGradient
                                                      id={gradientId}
                                                      x1="0"
                                                      y1="0"
                                                      x2="0"
                                                      y2="1"
                                                    >
                                                      {" "}
                                                      <stop
                                                        offset="5%"
                                                        stopColor={lineColor}
                                                        stopOpacity={0.2}
                                                      />{" "}
                                                      <stop
                                                        offset="95%"
                                                        stopColor={lineColor}
                                                        stopOpacity={0}
                                                      />{" "}
                                                    </linearGradient>{" "}
                                                  </defs>{" "}
                                                  <CartesianGrid
                                                    strokeDasharray="3 3"
                                                    vertical={false}
                                                    stroke="rgba(148,163,184,0.05)"
                                                  />{" "}
                                                  <XAxis
                                                    dataKey="timestamp"
                                                    fontSize={8}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tick={{ fill: "#475569" }}
                                                    interval="preserveStartEnd"
                                                  />{" "}
                                                  <YAxis
                                                    domain={[1, chartMax]}
                                                    ticks={yTicks}
                                                    fontSize={8}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    tick={{ fill: "#64748b" }}
                                                    width={24}
                                                    tickFormatter={(v) =>
                                                      `#${v}`
                                                    }
                                                  />{" "}
                                                  <Tooltip
                                                    labelFormatter={(_v, p) =>
                                                      p[0]?.payload?.fullTime ||
                                                      _v
                                                    }
                                                    contentStyle={{
                                                      backgroundColor:
                                                        "#0f172a",
                                                      borderRadius: "8px",
                                                      border:
                                                        "1px solid rgba(148,163,184,0.15)",
                                                      color: "#f8fafc",
                                                      fontSize: "10px",
                                                    }}
                                                    formatter={(
                                                      value: number,
                                                      _n: string,
                                                      props: {
                                                        payload?: ChartRankHistoryEntry;
                                                      },
                                                    ) => [
                                                      props.payload?.rawRank ===
                                                      -1
                                                        ? `Not in top ${props.payload?.rankDepth ?? 100}`
                                                        : `#${value}`,
                                                      "Rank",
                                                    ]}
                                                  />{" "}
                                                  <Line
                                                    type="monotone"
                                                    dataKey="rank"
                                                    stroke={lineColor}
                                                    strokeWidth={2}
                                                    dot={false}
                                                    activeDot={{
                                                      r: 3,
                                                      fill: lineColor,
                                                      stroke: "#0f172a",
                                                      strokeWidth: 1.5,
                                                    }}
                                                  />{" "}
                                                </LineChart>{" "}
                                              </ResponsiveContainer>{" "}
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
                                                        : "—",
                                                    color: "text-emerald-400",
                                                  },
                                                  {
                                                    label: "Avg",
                                                    value:
                                                      avgRank !== null
                                                        ? `#${avgRank}`
                                                        : "—",
                                                    color: "text-cyan-400",
                                                  },
                                                  {
                                                    label: "Worst",
                                                    value:
                                                      worstRank !== null
                                                        ? `#${worstRank}`
                                                        : "—",
                                                    color: "text-rose-400",
                                                  },
                                                ].map(
                                                  ({ label, value, color }) => (
                                                    <div
                                                      key={label}
                                                      className="text-center bg-app-surface-strong/50 rounded-lg py-1"
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
                      })}{" "}
                  </div>
                );
              })()}{" "}
            </div>
          )}{" "}
          {/* Selected App Dashboard */}{" "}
          {viewMode === "single" && selectedApp && (
            <div className="space-y-6" ref={exportRef}>
              {" "}
              {/* App Hero Card */}{" "}
              <div className="card-glow p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6">
                {" "}
                {/* Icon with ring */}{" "}
                <div className="relative flex-shrink-0">
                  {" "}
                  <div
                    className="p-1 rounded-[28px]"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(34,211,238,0.3), rgba(129,140,248,0.3))",
                    }}
                  >
                    {" "}
                    <img
                      src={selectedApp.icon}
                      alt={selectedApp.title}
                      className="w-28 h-28 md:w-32 md:h-32 rounded-[24px] object-cover"
                    />{" "}
                  </div>{" "}
                </div>{" "}
                <div className="flex-1 w-full text-center md:text-left">
                  {" "}
                  <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-4">
                    {" "}
                    <div className="flex-1">
                      {" "}
                      <div className="flex flex-wrap justify-center md:justify-start items-center gap-2.5 mb-1.5">
                        {" "}
                        <h2
                          className="font-display font-bold text-app-text"
                          style={{
                            fontSize: "1.75rem",
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
                            className="flex-shrink-0 p-2 rounded-xl transition-all"
                            style={{
                              background: "rgba(34,211,238,0.08)",
                              border: "1px solid rgba(34,211,238,0.2)",
                              color: "#22d3ee",
                            }}
                            title="Open in Store"
                          >
                            {" "}
                            <ExternalLink className="w-4 h-4" />{" "}
                          </a>
                        )}{" "}
                      </div>{" "}
                      <p className="text-app-text-muted font-medium">
                        {selectedApp.developer}
                      </p>{" "}
                    </div>{" "}
                    <div className="flex items-center gap-2">
                      {" "}
                      <div className="relative">
                        {" "}
                        <button
                          type="button"
                          onClick={() => setIsExportMenuOpen((prev) => !prev)}
                          disabled={isExporting}
                          className="p-2.5 rounded-xl transition-all btn-ghost flex items-center justify-center gap-2 disabled:opacity-40"
                          title="Export data"
                        >
                          {" "}
                          {isExporting ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Download className="w-5 h-5" />
                          )}{" "}
                          <span className="hidden md:inline text-sm font-medium">
                            Export Data
                          </span>{" "}
                        </button>{" "}
                        {isExportMenuOpen && (
                          <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-2xl border border-app-border/70 bg-app-surface/95 p-2 shadow-2xl backdrop-blur-xl">
                            {" "}
                            <button
                              type="button"
                              onClick={() => void handleExportAction("pdf")}
                              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-app-text transition-colors hover:bg-app-surface-strong/80"
                            >
                              {" "}
                              <span>Download PDF</span>{" "}
                              <span className="text-xs text-app-text-muted">
                                Report
                              </span>{" "}
                            </button>{" "}
                            <button
                              type="button"
                              onClick={() => void handleExportAction("csv")}
                              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-app-text transition-colors hover:bg-app-surface-strong/80"
                            >
                              {" "}
                              <span>Download CSV</span>{" "}
                              <span className="text-xs text-app-text-muted">
                                Data
                              </span>{" "}
                            </button>{" "}
                            <button
                              type="button"
                              onClick={() => void handleExportAction("json")}
                              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-app-text transition-colors hover:bg-app-surface-strong/80"
                            >
                              {" "}
                              <span>Download JSON</span>{" "}
                              <span className="text-xs text-app-text-muted">
                                Raw
                              </span>{" "}
                            </button>{" "}
                          </div>
                        )}{" "}
                      </div>{" "}
                      <button
                        onClick={() =>
                          toggleBookmark(selectedApp, storeType, country)
                        }
                        className="p-2.5 rounded-xl transition-all flex items-center justify-center"
                        style={
                          isSelectedAppBookmarked
                            ? {
                                background: "rgba(34,211,238,0.15)",
                                border: "1px solid rgba(34,211,238,0.3)",
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
                          className={`w-5 h-5 ${isSelectedAppBookmarked ? "fill-current" : ""}`}
                        />{" "}
                      </button>{" "}
                    </div>{" "}
                  </div>{" "}
                  {/* Stats row */}{" "}
                  <div className="mt-5 flex flex-wrap justify-center md:justify-start gap-2">
                    {" "}
                    <div className="stat-card">
                      {" "}
                      <span style={{ color: "#fbbf24", fontSize: "1.125rem" }}>
                        â˜…
                      </span>{" "}
                      <span className="text-sm font-semibold text-app-text font-mono">
                        {selectedApp.score
                          ? Number(selectedApp.score).toFixed(1)
                          : "N/A"}
                      </span>{" "}
                    </div>{" "}
                    {selectedApp.installs && (
                      <div className="stat-card">
                        {" "}
                        <Download
                          className="w-4 h-4"
                          style={{ color: "#64748b" }}
                        />{" "}
                        <span className="text-sm font-medium text-app-text-muted">
                          {selectedApp.installs}
                        </span>{" "}
                      </div>
                    )}{" "}
                    {selectedApp.category && (
                      <div className="stat-card">
                        {" "}
                        <span
                          className="badge badge-cyan"
                          style={{ fontSize: "0.625rem" }}
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
                {/* Keyword Ranking Checker */}{" "}
                <div className="card-glow p-7">
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
                      <TrendingUp
                        className="w-4 h-4"
                        style={{ color: "#10b981" }}
                      />{" "}
                    </span>{" "}
                    Live Keyword Ranking{" "}
                  </h3>{" "}
                  {/* Auto Discovered Rankings */}{" "}
                  <div className="mb-7">
                    {" "}
                    <h4 className="text-xs font-bold text-app-text-muted uppercase tracking-widest mb-4">
                      Currently Ranking For - Auto-Discovered
                    </h4>{" "}
                    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {" "}
                      <p className="text-xs text-app-text-muted">
                        {" "}
                        Fast mode checks fewer candidates in the top 100. Deep
                        mode scans a wider keyword set and checks deeper
                        rankings.{" "}
                      </p>{" "}
                      <div className="flex flex-wrap items-center gap-2">
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
                              className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 ${discoveryMode === mode ? "bg-emerald-500/20 text-emerald-300" : "text-app-text-muted hover:text-app-text"}`}
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
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/15 disabled:opacity-50"
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
                    {isDiscoveringKeywords ? (
                      <div className="flex items-center gap-2 text-sm text-app-text-muted">
                        {" "}
                        <Loader2 className="w-4 h-4 animate-spin" />{" "}
                        {discoveryMode === "deep"
                          ? "Running deep keyword discovery. This can take a little longer..."
                          : "Discovering keywords. This can take a little longer..."}{" "}
                      </div>
                    ) : null}
                    {autoRankings.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                        {" "}
                        {autoRankings.map((r, i) => (
                          <div
                            key={i}
                            className="min-w-0 bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 px-4 py-2.5 rounded-xl text-sm flex flex-col gap-1.5 relative group transition-all hover:shadow-lg hover:shadow-emerald-500/10 hover:border-emerald-500/40 hover:-translate-y-0.5"
                          >
                            {" "}
                            <div className="flex items-center gap-2">
                              {" "}
                              {selectedApp?.icon && (
                                <img
                                  src={selectedApp.icon}
                                  alt=""
                                  className="w-5 h-5 rounded-md shadow-sm border border-emerald-500/30"
                                  referrerPolicy="no-referrer"
                                />
                              )}{" "}
                              <span className="font-semibold">{r.keyword}</span>{" "}
                              <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-md font-bold">
                                #{r.rank}
                              </span>{" "}
                            </div>{" "}
                            <div className="flex items-center gap-2.5 text-xs text-emerald-400/80 font-medium">
                              {" "}
                              {getEstimatedDemand(r) !== undefined && (
                                <span title="Estimated Volume">
                                  Est. Vol: {getEstimatedDemand(r)}
                                </span>
                              )}{" "}
                              {r.difficulty !== undefined && (
                                <span title="Estimated Ranking Difficulty">
                                  Est. Diff: {r.difficulty}
                                </span>
                              )}{" "}
                              {r.relevance !== undefined && (
                                <span title="Estimated App Relevance">
                                  Est. Rel: {r.relevance}
                                </span>
                              )}{" "}
                            </div>{" "}
                            <div className="absolute -top-3 -right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              {" "}
                              <button
                                onClick={() =>
                                  selectedApp &&
                                  openTrackCountryPicker(
                                    r.keyword,
                                    selectedApp,
                                    storeType,
                                    country,
                                    r.rank,
                                    true,
                                  )
                                }
                                className={`bg-app-surface-muted/90 border rounded-full p-1.5 shadow-sm transition-all hover:scale-110 ${trackedKeywordGroupKeys.has(getTrackedKeywordGroupKey({ keyword: r.keyword, appId: selectedAppTrackedId || "", store: storeType })) ? "border-amber-500/50 hover:bg-amber-500/20 text-amber-400" : "border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400"}`}
                                title={
                                  trackedKeywordGroupKeys.has(
                                    getTrackedKeywordGroupKey({
                                      keyword: r.keyword,
                                      appId: selectedAppTrackedId || "",
                                      store: storeType,
                                    }),
                                  )
                                    ? "Track More Countries"
                                    : "Track Keyword"
                                }
                              >
                                {" "}
                                {trackedKeywordGroupKeys.has(
                                  getTrackedKeywordGroupKey({
                                    keyword: r.keyword,
                                    appId: selectedAppTrackedId || "",
                                    store: storeType,
                                  }),
                                ) ? (
                                  <BellRing className="w-3.5 h-3.5" />
                                ) : (
                                  <Bell className="w-3.5 h-3.5" />
                                )}{" "}
                              </button>{" "}
                            </div>{" "}
                          </div>
                        ))}{" "}
                      </div>
                    ) : keywordSuggestions.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                        {" "}
                        {keywordSuggestions.map((r, i) => (
                          <div
                            key={i}
                            className="min-w-0 bg-app-surface-muted/70 border border-cyan-500/20 text-cyan-200 px-4 py-2.5 rounded-xl text-sm flex flex-col gap-1.5 relative group transition-all hover:shadow-lg hover:shadow-cyan-500/10 hover:border-cyan-500/40 hover:-translate-y-0.5"
                          >
                            {" "}
                            <div className="flex items-center gap-2">
                              {" "}
                              <span className="font-semibold">
                                {r.keyword}
                              </span>{" "}
                              <span className="bg-cyan-500/15 text-cyan-300 text-xs px-2 py-0.5 rounded-md font-bold">
                                Suggestion
                              </span>{" "}
                            </div>{" "}
                            <div className="flex items-center gap-2.5 text-xs text-cyan-300/80 font-medium">
                              {" "}
                              {getEstimatedDemand(r) !== undefined && (
                                <span title="Estimated Volume">
                                  Est. Vol: {getEstimatedDemand(r)}
                                </span>
                              )}{" "}
                              {r.difficulty !== undefined && (
                                <span title="Estimated Ranking Difficulty">
                                  Est. Diff: {r.difficulty}
                                </span>
                              )}{" "}
                              {r.relevance !== undefined && (
                                <span title="Estimated App Relevance">
                                  Est. Rel: {r.relevance}
                                </span>
                              )}{" "}
                            </div>{" "}
                            <div className="absolute -top-3 -right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                              {" "}
                              <button
                                onClick={() =>
                                  selectedApp &&
                                  openTrackCountryPicker(
                                    r.keyword,
                                    selectedApp,
                                    storeType,
                                    country,
                                    -1,
                                    false,
                                  )
                                }
                                className={`bg-app-surface-muted/90 border rounded-full p-1.5 shadow-sm transition-all hover:scale-110 ${trackedKeywordGroupKeys.has(getTrackedKeywordGroupKey({ keyword: r.keyword, appId: selectedAppTrackedId || "", store: storeType })) ? "border-amber-500/50 hover:bg-amber-500/20 text-amber-400" : "border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-400"}`}
                                title={
                                  trackedKeywordGroupKeys.has(
                                    getTrackedKeywordGroupKey({
                                      keyword: r.keyword,
                                      appId: selectedAppTrackedId || "",
                                      store: storeType,
                                    }),
                                  )
                                    ? "Track More Countries"
                                    : "Track Keyword"
                                }
                              >
                                {" "}
                                {trackedKeywordGroupKeys.has(
                                  getTrackedKeywordGroupKey({
                                    keyword: r.keyword,
                                    appId: selectedAppTrackedId || "",
                                    store: storeType,
                                  }),
                                ) ? (
                                  <BellRing className="w-3.5 h-3.5" />
                                ) : (
                                  <Bell className="w-3.5 h-3.5" />
                                )}{" "}
                              </button>{" "}
                            </div>{" "}
                          </div>
                        ))}{" "}
                      </div>
                    ) : (
                      <p className="text-sm text-app-text-muted">
                        No ranked keywords or suggestions discovered yet.
                      </p>
                    )}{" "}
                  </div>{" "}
                  <div className="divider my-6" />{" "}
                  <h4 className="text-xs font-bold text-app-text-muted uppercase tracking-widest mb-4">
                    Check Specific Keyword
                  </h4>{" "}
                  <form
                    onSubmit={checkRanking}
                    className="flex flex-col sm:flex-row gap-3 mb-6"
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
                        className="input-field pl-4 pr-4"
                      />{" "}
                    </div>{" "}
                    <button
                      type="submit"
                      disabled={isCheckingRank || !keyword.trim()}
                      className="btn-primary btn-cyan sm:w-auto w-full"
                      style={{ padding: "0.875rem 2rem" }}
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
                      style={{
                        background: "rgba(10,15,35,0.7)",
                        borderColor: "rgba(51,65,85,0.5)",
                      }}
                    >
                      {" "}
                      <p className="text-app-text-muted text-sm mb-4">
                        Ranking for{" "}
                        <span className="font-semibold text-app-text">
                          "{ranking.keyword}"
                        </span>
                      </p>{" "}
                      {/* Metrics chips */}{" "}
                      <div className="absolute top-4 right-4 flex flex-col gap-1.5">
                        {" "}
                        {getEstimatedDemand(ranking) !== undefined && (
                          <span
                            className="metric-chip badge-cyan"
                            title="Estimated Volume"
                          >
                            Est. Vol {getEstimatedDemand(ranking)}
                          </span>
                        )}{" "}
                        {ranking.difficulty !== undefined && (
                          <span
                            className="metric-chip badge-amber"
                            title="Estimated Difficulty"
                          >
                            Est. Diff {ranking.difficulty}
                          </span>
                        )}{" "}
                        {ranking.relevance !== undefined && (
                          <span
                            className="metric-chip badge-purple"
                            title="Estimated Relevance"
                          >
                            Est. Rel {ranking.relevance}
                          </span>
                        )}{" "}
                      </div>{" "}
                      {ranking.rank !== -1 ? (
                        <div className="flex flex-col items-center gap-2">
                          {" "}
                          {selectedApp?.icon && (
                            <img
                              src={selectedApp.icon}
                              alt=""
                              className="w-12 h-12 rounded-2xl shadow-xl border border-app-border/50"
                              referrerPolicy="no-referrer"
                            />
                          )}{" "}
                          <div
                            className="rank-number"
                            style={{ fontSize: "4rem" }}
                          >
                            #{ranking.rank}
                          </div>{" "}
                          <p className="text-xs text-app-text-muted">
                            in{" "}
                            {COUNTRIES.find((c) => c.code === country)?.name ||
                              country}
                          </p>{" "}
                        </div>
                      ) : (
                        <div
                          className="text-lg font-semibold py-6"
                          style={{ color: "#f87171" }}
                        >
                          Not in top 100
                        </div>
                      )}{" "}
                      <div
                        className="mt-5 flex items-center justify-center gap-5 pt-4"
                        style={{ borderTop: "1px solid rgba(30,41,59,0.8)" }}
                      >
                        {" "}
                        <button
                          onClick={() => checkRanking(undefined, true)}
                          disabled={isCheckingRank}
                          className="text-sm flex items-center gap-1.5 transition-colors font-medium disabled:opacity-40"
                          style={{ color: "#10b981" }}
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
                            )
                          }
                          className={`text-sm flex items-center gap-1.5 transition-colors font-medium ${trackedKeywordGroupKeys.has(getTrackedKeywordGroupKey({ keyword: ranking.keyword, appId: selectedAppTrackedId || "", store: storeType })) ? "text-amber-400" : "text-app-text-muted hover:text-app-text-muted"}`}
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
                <div className="grid md:grid-cols-2 gap-5">
                  {" "}
                  {/* Keyword Density Chart */}{" "}
                  <div className="card p-6">
                    {" "}
                    <h3 className="section-header mb-6">
                      {" "}
                      <span
                        className="section-header-icon"
                        style={{
                          background: "rgba(34,211,238,0.1)",
                          border: "1px solid rgba(34,211,238,0.2)",
                        }}
                      >
                        {" "}
                        <BarChart3
                          className="w-4 h-4"
                          style={{ color: "#22d3ee" }}
                        />{" "}
                      </span>{" "}
                      Keyword Metrics Density{" "}
                    </h3>{" "}
                    <div
                      className="h-72 w-full rounded-xl p-2"
                      style={{ background: "rgba(5,10,25,0.5)" }}
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
                            stroke="#1e293b"
                          />{" "}
                          <XAxis
                            dataKey="keyword"
                            angle={-45}
                            textAnchor="end"
                            interval={0}
                            height={80}
                            fontSize={12}
                            tick={{ fill: "#64748b" }}
                          />{" "}
                          <YAxis
                            domain={[0, 100]}
                            fontSize={12}
                            tick={{ fill: "#94a3b8" }}
                          />{" "}
                          <Tooltip
                            cursor={{ fill: "#1e293b" }}
                            contentStyle={{
                              backgroundColor: "#0f172a",
                              borderRadius: "12px",
                              border: "1px solid #1e293b",
                              color: "#f8fafc",
                            }}
                          />{" "}
                          <Legend
                            verticalAlign="top"
                            height={36}
                            wrapperStyle={{ fontSize: "12px" }}
                          />{" "}
                          <Bar
                            dataKey="demand"
                            name="Estimated Volume"
                            fill="#7c3aed"
                            radius={[6, 6, 0, 0]}
                          />{" "}
                          <Bar
                            dataKey="difficulty"
                            name="Estimated Difficulty"
                            fill="#f59e0b"
                            radius={[6, 6, 0, 0]}
                          />{" "}
                          <Bar
                            dataKey="relevance"
                            name="Estimated Relevance"
                            fill="#8b5cf6"
                            radius={[6, 6, 0, 0]}
                          />{" "}
                        </BarChart>{" "}
                      </ResponsiveContainer>{" "}
                    </div>{" "}
                    <p className="text-sm text-app-text-muted mt-6 text-center">
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
                          background: "rgba(168,85,247,0.1)",
                          border: "1px solid rgba(168,85,247,0.2)",
                        }}
                      >
                        {" "}
                        <TrendingUp
                          className="w-4 h-4"
                          style={{ color: "#c084fc" }}
                        />{" "}
                      </span>{" "}
                      Estimated Keyword Profile{" "}
                    </h3>{" "}
                    <div
                      className="h-72 w-full rounded-xl p-2 flex items-center justify-center"
                      style={{ background: "rgba(5,10,25,0.5)" }}
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
                          <PolarGrid stroke="#334155" />{" "}
                          <PolarAngleAxis
                            dataKey="metric"
                            tick={{ fill: "#94a3b8", fontSize: 12 }}
                          />{" "}
                          <PolarRadiusAxis
                            angle={30}
                            domain={[0, 100]}
                            tick={{ fill: "#64748b" }}
                          />{" "}
                          <Radar
                            name={autoRankings[0]?.keyword || "Keyword"}
                            dataKey="value"
                            stroke="#ec4899"
                            fill="#ec4899"
                            fillOpacity={0.5}
                          />{" "}
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#0f172a",
                              borderRadius: "12px",
                              border: "1px solid #1e293b",
                              color: "#f8fafc",
                            }}
                          />{" "}
                        </RadarChart>{" "}
                      </ResponsiveContainer>{" "}
                    </div>{" "}
                    <p className="text-xs text-slate-600 mt-4 text-center">
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
                          background: "rgba(16,185,129,0.1)",
                          border: "1px solid rgba(16,185,129,0.2)",
                        }}
                      >
                        {" "}
                        <Search
                          className="w-4 h-4"
                          style={{ color: "#10b981" }}
                        />{" "}
                      </span>{" "}
                      Opportunity Matrix{" "}
                    </h3>{" "}
                    <div
                      className="h-72 w-full rounded-xl p-2"
                      style={{ background: "rgba(5,10,25,0.5)" }}
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
                            stroke="#1e293b"
                          />{" "}
                          <XAxis
                            type="number"
                            dataKey="difficulty"
                            name="Estimated Difficulty"
                            domain={[0, 100]}
                            fontSize={12}
                            tick={{ fill: "#64748b" }}
                          >
                            {" "}
                            <Label
                              value="Estimated Difficulty"
                              position="insideBottom"
                              offset={-15}
                              style={{ fill: "#94a3b8", fontSize: 12 }}
                            />{" "}
                          </XAxis>{" "}
                          <YAxis
                            type="number"
                            dataKey="demand"
                            name="Estimated Volume"
                            domain={[0, 100]}
                            fontSize={12}
                            tick={{ fill: "#64748b" }}
                          >
                            {" "}
                            <Label
                              value="Estimated Volume"
                              angle={-90}
                              position="insideLeft"
                              style={{ fill: "#94a3b8", fontSize: 12 }}
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
                            contentStyle={{
                              backgroundColor: "#0f172a",
                              borderRadius: "12px",
                              border: "1px solid #1e293b",
                              color: "#f8fafc",
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
                                  ? "#10b981"
                                  : r.rank <= 50
                                    ? "#f59e0b"
                                    : "#334155",
                            }))}
                          >
                            {" "}
                            {autoRankings.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={
                                  entry.rank <= 10
                                    ? "#10b981"
                                    : entry.rank <= 50
                                      ? "#f59e0b"
                                      : "#64748b"
                                }
                              />
                            ))}{" "}
                          </Scatter>{" "}
                        </ScatterChart>{" "}
                      </ResponsiveContainer>{" "}
                    </div>{" "}
                    <p className="text-xs text-slate-600 mt-4 text-center">
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
                          background: "rgba(99,102,241,0.1)",
                          border: "1px solid rgba(99,102,241,0.2)",
                        }}
                      >
                        {" "}
                        <Layers
                          className="w-4 h-4"
                          style={{ color: "#818cf8" }}
                        />{" "}
                      </span>{" "}
                      Rank Distribution{" "}
                    </h3>{" "}
                    <div
                      className="h-72 w-full rounded-xl p-2 flex items-center justify-center"
                      style={{ background: "rgba(5,10,25,0.5)" }}
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
                                color: "#10b981",
                              },
                              {
                                name: "Top 11-30",
                                value: autoRankings.filter(
                                  (r) => r.rank > 10 && r.rank <= 30,
                                ).length,
                                color: "#f59e0b",
                              },
                              {
                                name: "Top 31-100",
                                value: autoRankings.filter((r) => r.rank > 30)
                                  .length,
                                color: "#ef4444",
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
                            contentStyle={{
                              backgroundColor: "#0f172a",
                              borderRadius: "12px",
                              border: "1px solid #1e293b",
                              color: "#f8fafc",
                            }}
                          />{" "}
                          <Legend
                            verticalAlign="bottom"
                            height={36}
                            wrapperStyle={{ fontSize: "12px" }}
                          />{" "}
                        </PieChart>{" "}
                      </ResponsiveContainer>{" "}
                    </div>{" "}
                    <p className="text-xs text-slate-600 mt-4 text-center">
                      Distribution of discovered keyword rankings across
                      position ranges.
                    </p>{" "}
                  </div>{" "}
                </div>
              )}{" "}
            </div>
          )}{" "}
          {/* Compare Dashboard */}{" "}
          {viewMode === "compare" && comparedApps.length > 0 && (
            <div className="space-y-6" ref={exportRef}>
              {" "}
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                {" "}
                <div>
                  {" "}
                  <h2
                    className="font-display font-bold text-app-text flex items-center gap-3"
                    style={{ fontSize: "1.375rem", letterSpacing: "-0.02em" }}
                  >
                    {" "}
                    <span
                      className="section-header-icon"
                      style={{
                        background: "rgba(99,102,241,0.1)",
                        border: "1px solid rgba(99,102,241,0.2)",
                      }}
                    >
                      {" "}
                      <Layers
                        className="w-4 h-4"
                        style={{ color: "#818cf8" }}
                      />{" "}
                    </span>{" "}
                    Compare Apps{" "}
                  </h2>{" "}
                  <p className="mt-2 text-sm text-app-text-muted">
                    {" "}
                    Compare now shows keyword footprint, contested search terms,
                    and whitespace opportunities across the whole set.{" "}
                  </p>{" "}
                </div>{" "}
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
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors disabled:opacity-50 ${compareDiscoveryMode === mode ? "bg-violet-500/20 text-violet-200" : "text-app-text-muted hover:text-app-text"}`}
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
                    className="btn-primary sm:w-auto w-full"
                  >
                    {" "}
                    {isAnalyzingCompare ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}{" "}
                    Refresh Compare{" "}
                  </button>{" "}
                  <div className="relative">
                    {" "}
                    <button
                      type="button"
                      onClick={() => setIsExportMenuOpen((prev) => !prev)}
                      disabled={isExporting}
                      className="btn-ghost flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-40"
                      title="Export data"
                    >
                      {" "}
                      {isExporting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}{" "}
                      Export Data{" "}
                    </button>{" "}
                    {isExportMenuOpen && (
                      <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-2xl border border-app-border/70 bg-app-surface/95 p-2 shadow-2xl backdrop-blur-xl">
                        {" "}
                        <button
                          type="button"
                          onClick={() => void handleExportAction("pdf")}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-app-text transition-colors hover:bg-app-surface-strong/80"
                        >
                          {" "}
                          <span>Download PDF</span>{" "}
                          <span className="text-xs text-app-text-muted">
                            Report
                          </span>{" "}
                        </button>{" "}
                        <button
                          type="button"
                          onClick={() => void handleExportAction("csv")}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-app-text transition-colors hover:bg-app-surface-strong/80"
                        >
                          {" "}
                          <span>Download CSV</span>{" "}
                          <span className="text-xs text-app-text-muted">
                            Data
                          </span>{" "}
                        </button>{" "}
                        <button
                          type="button"
                          onClick={() => void handleExportAction("json")}
                          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-app-text transition-colors hover:bg-app-surface-strong/80"
                        >
                          {" "}
                          <span>Download JSON</span>{" "}
                          <span className="text-xs text-app-text-muted">
                            Raw
                          </span>{" "}
                        </button>{" "}
                      </div>
                    )}{" "}
                  </div>{" "}
                </div>{" "}
              </div>{" "}
              <div className="rounded-2xl border border-app-border/60 bg-app-surface/40 px-4 py-3 text-sm text-app-text-muted flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
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
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {" "}
                {compareAppInsights.map((insight) => (
                  <div
                    key={insight.compareKey}
                    className="bg-app-surface-muted/60 p-5 rounded-2xl shadow-lg border border-app-border/50 relative transition-all hover:shadow-cyan-500/10 hover:border-app-border backdrop-blur-sm"
                  >
                    {" "}
                    <button
                      onClick={() => removeCompareApp(insight.app)}
                      className="absolute top-3 right-3 p-1.5 bg-app-surface-strong/80 hover:bg-red-500 hover:text-white text-app-text-muted rounded-full transition-colors shadow-sm"
                    >
                      {" "}
                      <X className="w-3.5 h-3.5" />{" "}
                    </button>{" "}
                    <img
                      src={insight.app.icon}
                      alt={insight.app.title}
                      className="w-16 h-16 rounded-2xl shadow-md mb-4 border border-app-border/50"
                    />{" "}
                    <div className="flex items-center gap-1.5 justify-center mb-1">
                      {" "}
                      <h3 className="font-semibold text-app-text text-sm line-clamp-1">
                        {insight.app.title}
                      </h3>{" "}
                      {insight.app.url && (
                        <a
                          href={insight.app.url}
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
                      {insight.app.developer}
                    </p>{" "}
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
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-left text-xs">
                        {" "}
                        <div className="uppercase tracking-wide text-emerald-300/70">
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
                      <span className="text-amber-400 text-sm">â˜…</span>{" "}
                      {insight.app.score
                        ? Number(insight.app.score).toFixed(1)
                        : "N/A"}{" "}
                    </div>{" "}
                  </div>
                ))}{" "}
              </div>{" "}
              {compareAnalyzedCount > 0 ? (
                <div className="space-y-6">
                  {" "}
                  <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                    {" "}
                    <div className="card p-6">
                      {" "}
                      <h3 className="section-header mb-6">
                        {" "}
                        <span
                          className="section-header-icon"
                          style={{
                            background: "rgba(34,211,238,0.1)",
                            border: "1px solid rgba(34,211,238,0.2)",
                          }}
                        >
                          {" "}
                          <BarChart3
                            className="w-4 h-4"
                            style={{ color: "#22d3ee" }}
                          />{" "}
                        </span>{" "}
                        Search Footprint Snapshot{" "}
                      </h3>{" "}
                      <div
                        className="h-72 w-full rounded-xl p-2"
                        style={{ background: "rgba(5,10,25,0.5)" }}
                      >
                        {" "}
                        <ResponsiveContainer width="100%" height="100%">
                          {" "}
                          <BarChart
                            data={compareCoverageChartData}
                            margin={{ top: 20, right: 20, left: 0, bottom: 50 }}
                          >
                            {" "}
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                              stroke="#1e293b"
                            />{" "}
                            <XAxis
                              dataKey="appTitle"
                              angle={-20}
                              textAnchor="end"
                              interval={0}
                              height={60}
                              fontSize={12}
                              tick={{ fill: "#94a3b8" }}
                            />{" "}
                            <YAxis fontSize={12} tick={{ fill: "#94a3b8" }} />{" "}
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "#0f172a",
                                borderRadius: "12px",
                                border: "1px solid #1e293b",
                                color: "#f8fafc",
                              }}
                            />{" "}
                            <Legend
                              verticalAlign="top"
                              height={36}
                              wrapperStyle={{ fontSize: "12px" }}
                            />{" "}
                            <Bar
                              dataKey="top10"
                              name="Top 10"
                              fill="#10b981"
                              radius={[6, 6, 0, 0]}
                            />{" "}
                            <Bar
                              dataKey="top30"
                              name="Top 30"
                              fill="#f59e0b"
                              radius={[6, 6, 0, 0]}
                            />{" "}
                            <Bar
                              dataKey="top100"
                              name="Top 100"
                              fill="#6366f1"
                              radius={[6, 6, 0, 0]}
                            />{" "}
                          </BarChart>{" "}
                        </ResponsiveContainer>{" "}
                      </div>{" "}
                      <p className="text-sm text-app-text-muted mt-5">
                        {" "}
                        This gives a fast read on how much ranked keyword
                        coverage each app has, not just who wins on a single
                        term.{" "}
                      </p>{" "}
                    </div>{" "}
                    <div className="card p-6">
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
                          <Globe className="w-4 h-4 text-emerald-400" />{" "}
                        </span>{" "}
                        Highest-Value Gaps{" "}
                      </h3>{" "}
                      <div className="space-y-3">
                        {" "}
                        {compareGapRows.length > 0 ? (
                          compareGapRows.slice(0, 5).map((gapRow, index) => (
                            <div
                              key={`${gapRow.keyword}-${index}`}
                              className="rounded-xl border border-app-border/60 bg-app-surface/50 p-4"
                            >
                              {" "}
                              <div className="flex items-start justify-between gap-3">
                                {" "}
                                <div>
                                  {" "}
                                  <div className="font-semibold text-app-text">
                                    {gapRow.keyword}
                                  </div>{" "}
                                  <div className="mt-1 text-xs text-app-text-muted">
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
                              <div className="mt-3 flex flex-wrap gap-2 text-xs">
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
                  <div className="grid gap-6 xl:grid-cols-2">
                    {" "}
                    <div className="card p-6">
                      {" "}
                      <h3 className="section-header mb-6">
                        {" "}
                        <span
                          className="section-header-icon"
                          style={{
                            background: "rgba(99,102,241,0.1)",
                            border: "1px solid rgba(99,102,241,0.2)",
                          }}
                        >
                          {" "}
                          <Layers
                            className="w-4 h-4"
                            style={{ color: "#818cf8" }}
                          />{" "}
                        </span>{" "}
                        Contested Keywords{" "}
                      </h3>{" "}
                      <div className="space-y-3">
                        {" "}
                        {compareSharedBattles.length > 0 ? (
                          compareSharedBattles.map((battle) => (
                            <div
                              key={battle.keyword}
                              className="rounded-xl border border-app-border/60 bg-app-surface/50 p-4"
                            >
                              {" "}
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                {" "}
                                <div>
                                  {" "}
                                  <div className="font-semibold text-app-text">
                                    {battle.keyword}
                                  </div>{" "}
                                  <div className="mt-1 text-xs text-app-text-muted">
                                    {" "}
                                    {battle.leader.appTitle} leads this battle;
                                    gap to the next ranked app is {battle.gap}{" "}
                                    positions.{" "}
                                  </div>{" "}
                                </div>{" "}
                                <div className="flex flex-wrap gap-2 text-xs">
                                  {" "}
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
                              <div className="mt-3 flex flex-wrap gap-2">
                                {" "}
                                {battle.rankedApps.map((rankedApp) => (
                                  <span
                                    key={`${battle.keyword}-${rankedApp.appKey}`}
                                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold border ${rankedApp.appKey === battle.leader.appKey ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "bg-app-surface-muted/80 border-app-border/80 text-app-text-muted"}`}
                                  >
                                    {" "}
                                    {rankedApp.appTitle} #{rankedApp.rank}{" "}
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
                    <div className="card p-6">
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
                            style={{ color: "#10b981" }}
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
                              className="rounded-xl border border-app-border/60 bg-app-surface/50 p-4"
                            >
                              {" "}
                              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                {" "}
                                <div>
                                  {" "}
                                  <div className="font-semibold text-app-text">
                                    {gapRow.keyword}
                                  </div>{" "}
                                  <div className="mt-1 text-xs text-app-text-muted">
                                    {" "}
                                    {gapRow.isWhitespace
                                      ? `Suggested by multiple apps, but none currently rank.`
                                      : `${gapRow.leader?.appTitle} owns the visibility here while ${gapRow.missingApps.join(", ")} are absent.`}{" "}
                                  </div>{" "}
                                </div>{" "}
                                <span className="badge badge-amber">
                                  Priority {gapRow.score}
                                </span>{" "}
                              </div>{" "}
                              <div className="mt-3 flex flex-wrap gap-2 text-xs">
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
                  <div className="card p-6 md:p-8">
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
                        <TrendingUp className="w-4 h-4 text-emerald-400" />{" "}
                      </span>{" "}
                      Keyword Battle{" "}
                    </h3>{" "}
                    <form
                      onSubmit={checkCompareRanking}
                      className="flex flex-col sm:flex-row gap-3 mb-4"
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
                          className="input-field"
                        />{" "}
                      </div>{" "}
                      <button
                        type="submit"
                        disabled={
                          isCheckingCompareRank || !compareKeyword.trim()
                        }
                        className="btn-primary btn-cyan sm:w-auto w-full"
                        style={{ padding: "0.875rem 2rem" }}
                      >
                        {" "}
                        {isCheckingCompareRank ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          "Check All"
                        )}{" "}
                      </button>{" "}
                    </form>{" "}
                    <p className="text-xs text-app-text-muted mb-6">
                      {" "}
                      Relevance is estimated per app, so this section is useful
                      for side-by-side fit as well as rank.{" "}
                    </p>{" "}
                    {compareRankings.length > 0 && (
                      <div className="space-y-3">
                        {" "}
                        <p className="text-sm text-app-text-muted">
                          Rankings for "{compareKeyword}"
                        </p>{" "}
                        {compareRankings.map((result, index) => (
                          <div
                            key={`${result.appTitle}-${index}`}
                            className="flex flex-col gap-3 rounded-xl border border-app-border/60 bg-app-surface-muted/40 p-4 md:flex-row md:items-center md:justify-between"
                          >
                            {" "}
                            <div>
                              {" "}
                              <div className="font-medium text-app-text">
                                {result.appTitle}
                              </div>{" "}
                              <div className="mt-2 flex flex-wrap gap-2 text-xs">
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
                              <span className="bg-emerald-500/20 text-emerald-300 font-bold px-3 py-1.5 rounded-lg whitespace-nowrap shadow-sm">
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
          )}{" "}
        </main>{" "}
        <CountryMultiSelectModal
          disabledCountries={
            trackCountryPickerState?.existingTrackedCountries || []
          }
          isOpen={Boolean(trackCountryPickerState)}
          keyword={trackCountryPickerState?.keyword || ""}
          selectedCountries={trackCountryPickerState?.selectedCountries || []}
          onToggleCountry={toggleTrackCountrySelection}
          onClose={closeTrackCountryPicker}
          onSubmit={() => void submitTrackCountrySelection()}
          options={COUNTRIES}
          isSubmitting={isSubmittingTrackCountries}
        />{" "}
      </div>{" "}
    </ErrorBoundary>
  );
}
export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getInitialTheme());
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authView, setAuthView] = useState<"landing" | "login" | "privacy" | "terms">(
    "landing",
  );
  const [preAuthLegalAccepted, setPreAuthLegalAccepted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const redirectToastShownRef = useRef(false);
  useEffect(() => {
    applyTheme(themeMode);
    safeStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);
  const handleToggleTheme = React.useCallback(() => {
    setThemeMode((current) => (current === "light" ? "dark" : "light"));
  }, []);
  const buildAuthEventPayload = React.useCallback(
    (
      attemptId: string,
      flow: GoogleSignInFlow,
      phase: AuthEventPayload["phase"],
      error?: unknown,
    ): AuthEventPayload => ({
      attemptId,
      provider: "google",
      flow,
      phase,
      host:
        typeof window !== "undefined"
          ? window.location.hostname
          : "unknown",
      path:
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}${window.location.hash}`
          : "/",
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent || "unknown" : "unknown",
      errorCode: phase === "error" ? getAuthErrorCode(error) : undefined,
      errorMessage:
        phase === "error" ? getShortAuthErrorMessage(error) : undefined,
      occurredAt: new Date().toISOString(),
    }),
    [],
  );
  useEffect(() => {
    let isMounted = true;
    let authStateObserved = false;
    let redirectResultResolved = false;

    const markAuthReady = () => {
      if (isMounted && authStateObserved && redirectResultResolved) {
        setAuthReady(true);
      }
    };

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!isMounted) {
        return;
      }
      setCurrentUser(user);
      authStateObserved = true;
      markAuthReady();
    });

    (async () => {
      try {
        const result = await getRedirectResult(auth);
        if (!isMounted) {
          return;
        }

        const pendingAttempt = readPendingGoogleRedirectAttempt();
        if (result?.user) {
          const attemptId = pendingAttempt?.attemptId || createAuthAttemptId();
          setCurrentUser(result.user);
          setAuthError(null);
          void sendAuthEvent(
            buildAuthEventPayload(attemptId, "redirect", "success"),
          );
          if (!redirectToastShownRef.current) {
            redirectToastShownRef.current = true;
            toast.success("Signed in with Google.");
          }
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const pendingAttempt = readPendingGoogleRedirectAttempt();
        const attemptId = pendingAttempt?.attemptId || createAuthAttemptId();
        logError(error, {
          context: "getRedirectResult",
          flow: "redirect",
          attemptId,
        });
        setAuthError(getAuthErrorMessage(error));
        void sendAuthEvent(
          buildAuthEventPayload(attemptId, "redirect", "error", error),
        );
      } finally {
        clearPendingGoogleRedirectAttempt();
        redirectResultResolved = true;
        markAuthReady();
      }
    })();

    return unsubscribe;
  }, [buildAuthEventPayload]);
  const handleGoogleSignIn = async () => {
    setIsAuthSubmitting(true);
    setAuthError(null);
    const attemptId = createAuthAttemptId();
    const preferredFlow = detectGoogleSignInFlow();
    const provider = createGoogleProvider();
    let shouldResetSubmitting = true;

    void sendAuthEvent(buildAuthEventPayload(attemptId, "popup", "start"));

    try {
      await signInWithPopup(auth, provider);
      toast.success("Signed in with Google.");
      void sendAuthEvent(buildAuthEventPayload(attemptId, "popup", "success"));
    } catch (error) {
      const errorCode = getAuthErrorCode(error);
      const shouldFallbackToRedirect =
        preferredFlow === "redirect" && errorCode === "auth/popup-blocked";

      if (shouldFallbackToRedirect) {
        persistPendingGoogleRedirectAttempt(attemptId);
        void sendAuthEvent(buildAuthEventPayload(attemptId, "popup", "error", error));
        void sendAuthEvent(buildAuthEventPayload(attemptId, "redirect", "start"), {
          preferBeacon: true,
        });
        await signInWithRedirect(auth, provider);
        shouldResetSubmitting = false;
        return;
      }

      clearPendingGoogleRedirectAttempt();
      logError(error, {
        context: "handleGoogleSignIn",
        flow: shouldFallbackToRedirect ? "redirect" : "popup",
        preferredFlow,
        attemptId,
      });
      setAuthError(getAuthErrorMessage(error));
      void sendAuthEvent(
        buildAuthEventPayload(attemptId, "popup", "error", error),
      );
    } finally {
      if (shouldResetSubmitting) {
        setIsAuthSubmitting(false);
      }
    }
  };
  const handleEmailSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsAuthSubmitting(true);
    setAuthError(null);
    try {
      if (authMode === "signin") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        toast.success("Signed in.");
      } else {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
        toast.success("Account created.");
      }
    } catch (error) {
      logError(error, { context: "handleEmailSubmit", authMode });
      setAuthError(getAuthErrorMessage(error));
    } finally {
      setIsAuthSubmitting(false);
    }
  };
  const handleSignOut = async () => {
    const confirmed = window.confirm("Are you sure you want to sign out?");
    if (!confirmed) {
      return;
    }

    try {
      await signOut(auth);
      setPassword("");
      setAuthError(null);
      setPreAuthLegalAccepted(false);
      setAuthView("login");
      toast.success("Signed out.");
    } catch (error) {
      logError(error, { context: "handleSignOut" });
      toast.error("Failed to sign out.");
    }
  };
  const handleDeleteAccount = async () => {
    const user = auth.currentUser;
    if (!user) {
      toast.error("No authenticated account found.");
      return;
    }
    try {
      const token = await user.getIdToken();
      await fetchJson<{ success: boolean }>(
        "/api/account/delete",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
        { timeoutMs: 60000 },
      );
      try {
        await signOut(auth);
      } catch (signOutError) {
        console.warn("Failed to sign out after account deletion", signOutError);
      }
      setEmail("");
      setPassword("");
      setAuthError(null);
      setPreAuthLegalAccepted(false);
      setAuthView("login");
      safeStorage.removeItem("aso-bookmarks");
      safeStorage.removeItem("aso-tracked-keywords");
      safeStorage.removeItem("aso-rank-history");
      toast.success("Account deleted.");
    } catch (error) {
      logError(error, { context: "handleDeleteAccount", uid: user.uid });
      toast.error("Failed to delete account.");
    }
  };
  if (!authReady) {
    return (
      <div className="auth-shell">
        <div className="auth-orb auth-orb-cyan" />
        <div className="auth-orb auth-orb-indigo" />
        <div className="auth-panel flex items-center justify-center min-h-[320px]">
          <div className="flex flex-col items-center gap-4 text-app-text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-300" />
            <p className="text-sm tracking-[0.18em] uppercase text-app-text-muted">
              Checking session
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (!currentUser) {
    if (authView === "landing") {
      return (
        <LandingPage
          onGetStarted={() => setAuthView("login")}
          onOpenPrivacy={() => setAuthView("privacy")}
          onOpenTerms={() => setAuthView("terms")}
          themeMode={themeMode}
          onToggleTheme={handleToggleTheme}
        />
      );
    }
    if (authView === "privacy") {
      return (
        <PrivacyPolicyPage
          onBack={() => setAuthView("login")}
          themeMode={themeMode}
          onToggleTheme={handleToggleTheme}
        />
      );
    }
    if (authView === "terms") {
      return (
        <TermsPage
          onBack={() => setAuthView("login")}
          themeMode={themeMode}
          onToggleTheme={handleToggleTheme}
        />
      );
    }
    return (
      <LoginScreen
        authMode={authMode}
        authError={authError}
        email={email}
        password={password}
        isSubmitting={isAuthSubmitting}
        legalAccepted={preAuthLegalAccepted}
        onAuthModeChange={(mode) => {
          setAuthMode(mode);
          setAuthError(null);
        }}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onLegalAcceptedChange={setPreAuthLegalAccepted}
        onEmailSubmit={handleEmailSubmit}
        onGoogleSignIn={handleGoogleSignIn}
        onOpenPrivacy={() => setAuthView("privacy")}
        onOpenTerms={() => setAuthView("terms")}
        themeMode={themeMode}
        onToggleTheme={handleToggleTheme}
      />
    );
  }
  return (
    <WorkspaceAuthenticatedApp
      currentUser={currentUser}
      onSignOut={handleSignOut}
      onDeleteAccount={handleDeleteAccount}
      initialLegalAccepted={preAuthLegalAccepted}
      onLegalAcceptedPersisted={() => setPreAuthLegalAccepted(false)}
      themeMode={themeMode}
      onToggleTheme={handleToggleTheme}
    />
  );
}
