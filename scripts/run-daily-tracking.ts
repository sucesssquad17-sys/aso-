/**
 * run-daily-tracking.ts
 *
 * Standalone Cloud Run Job script for daily keyword rank tracking.
 * Runs once, refreshes all tracked users, writes results back to Firestore, then exits.
 *
 * Usage:
 *   npm run tracking:daily          (local, tsx)
 *   node dist/tracking-job.cjs     (production, compiled)
 */

import 'dotenv/config';
import crypto from 'crypto';
import * as gplayModule from 'google-play-scraper';
import store from 'app-store-scraper';
import { HttpsProxyAgent } from 'https-proxy-agent';
import {
  ProxyAgent as UndiciProxyAgent,
  type Dispatcher as UndiciDispatcher,
} from 'undici';
import NodeCache from 'node-cache';
import { Resend } from 'resend';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, type DocumentData, type DocumentReference } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { normalizeCountryCode } from '../src/lib/countries';
import {
  DEFAULT_GLOBAL_TRACKING_TIME,
  GLOBAL_TRACKING_TIMEZONE,
} from '../src/lib/trackingTime';
import {
  DAILY_TRACKING_LEASE_TTL_MINUTES,
  getDailyTrackingFinalStatus,
  getEmptyDailyTrackingSummary,
  shouldRetryPartialDailyTracking,
  type DailyTrackingSummary,
} from '../src/lib/dailyTracking';
import {
  ALERT_CONDITION_LABELS,
  type AlertCondition,
  type AlertConditionType,
  type AlertEvent,
  type AlertRule,
  type NotificationSettings,
  normalizeAlertRules,
  normalizeNotificationSettings,
} from '../src/lib/alerts';
import {
  getGlobalTrackingRunKey as getSharedGlobalTrackingRunKey,
  getZonedDateParts as getSharedZonedDateParts,
  initializeFirebaseAdminFirestoreFromEnv,
  mergeRankHistory as mergeSharedRankHistory,
  normalizeTrackingSchedule as normalizeSharedTrackingSchedule,
  refreshAllTrackingState as refreshSharedAllTrackingState,
  resolveTrackingGroupId as resolveSharedTrackingGroupId,
  shouldRunTrackingRefresh,
  TRACKED_KEYWORD_RANKING_DEPTH,
  TRACKING_HISTORY_LIMIT as SHARED_TRACKING_HISTORY_LIMIT,
  TRACKING_REFRESH_CONCURRENCY,
} from '../src/lib/backendTracking';

// ─── Types ───────────────────────────────────────────────────────────────────

type StoreType = 'android' | 'ios';
type DiscoveryMode = 'fast' | 'deep';
type TrackedKeywordStatus = 'pending' | 'ok' | 'not_ranked' | 'error';

type CompetitorGroupAppRecord = {
  appKey: string;
  appId: string;
  store: StoreType;
  role: 'own' | 'competitor';
  title: string;
  developer: string;
  icon: string;
  url?: string;
  category?: string;
};

type CompetitorGroupRecord = {
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
};

type CompetitorAsoFieldName =
  | 'title'
  | 'description'
  | 'icon'
  | 'category'
  | 'screenshots';

type CompetitorAsoSnapshotPayload = {
  title: string;
  description: string;
  icon: string;
  category: string;
  screenshots: string[];
};

type CompetitorAsoSnapshotRecord = {
  snapshotId: string;
  groupId: string;
  appId: string;
  appKey: string;
  appTitle: string;
  store: StoreType;
  country: string;
  capturedAt: string;
  payload: CompetitorAsoSnapshotPayload;
};

type CompetitorAsoFieldChange = {
  field: CompetitorAsoFieldName;
  previousValue: string | string[] | null;
  currentValue: string | string[] | null;
  summary: string;
};

type CompetitorAsoDiffRecord = {
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
};

type CompetitorTrackedKeywordAppRecord = {
  appKey: string;
  appId: string;
  store: StoreType;
  role: 'own' | 'competitor';
  title: string;
  developer: string;
  icon: string;
  url?: string;
  category?: string;
  lastRank: number;
  lastChecked: string;
  lastCheckStatus?: TrackedKeywordStatus;
  lastError?: string;
};

type CompetitorTrackedKeywordRecord = {
  trackedKeywordId: string;
  groupId: string;
  keyword: string;
  store: StoreType;
  country: string;
  apps: CompetitorTrackedKeywordAppRecord[];
  createdAt: string;
  updatedAt: string;
  lastCheckedAt?: string;
};

type CompetitorRankHistoryRecord = {
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
};

type TrackedKeywordRecord = {
  groupId?: string;
  keyword: string;
  appId: string;
  appTitle: string;
  store: StoreType;
  country: string;
  lastRank: number;
  lastChecked: string;
  lastCheckStatus?: TrackedKeywordStatus;
  lastError?: string;
};

type RankHistoryRecord = {
  groupId?: string;
  appId: string;
  keyword: string;
  store: StoreType;
  country: string;
  rank: number;
  timestamp: string;
  rankDepth?: number;
};

type TrackingSchedule = {
  enabled: boolean;
  time: string;
  timezone: string;
  lastRunAt?: string;
  lastRunKey?: string;
};

type TrackingState = {
  trackedKeywords: TrackedKeywordRecord[];
  rankHistory: RankHistoryRecord[];
  competitorTrackedKeywords: CompetitorTrackedKeywordRecord[];
  competitorRankHistory: CompetitorRankHistoryRecord[];
  competitorGroups: CompetitorGroupRecord[];
  competitorAsoLatestSnapshots: CompetitorAsoSnapshotRecord[];
  alertRules: AlertRule[];
  notificationSettings: NotificationSettings;
  schedule: TrackingSchedule;
};

type UserTrackingDocument = {
  trackedKeywords?: TrackedKeywordRecord[];
  rankHistory?: RankHistoryRecord[];
  competitorTrackedKeywords?: CompetitorTrackedKeywordRecord[];
  competitorRankHistory?: CompetitorRankHistoryRecord[];
  competitorGroups?: CompetitorGroupRecord[];
  competitorAsoLatestSnapshots?: CompetitorAsoSnapshotRecord[];
  alertRules?: AlertRule[];
  notificationSettings?: NotificationSettings;
  trackingSchedule?: TrackingSchedule;
  updatedAt?: string;
};
type DailyTrackingStatusRecord = Partial<DailyTrackingSummary> & {
  runKey?: string;
  lastStatus?: 'running' | 'success' | 'partial' | 'error';
  lastStartedAt?: string;
  lastFinishedAt?: string;
  lastRetryAt?: string;
  retryCount?: number;
  durationMs?: number;
  error?: string;
  watchdogRetryEligible?: boolean;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  lastTrigger?: 'automatic' | 'manual' | 'watchdog';
};

// ─── Constants ───────────────────────────────────────────────────────────────

const PLAY_STORE_FETCH_TIMEOUT_MS = 30000;
const RANKING_FETCH_TIMEOUT_MS = 20000;

// ─── Email Provider (Resend) ──────────────────────────────────────────────────

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'updates@rankanalyzerpro.com';
const CRON_FAILURE_EMAIL_RECIPIENTS = (process.env.CRON_FAILURE_EMAIL || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const ALERT_EMAIL_APP_URL = process.env.APP_URL?.trim() || 'https://rankanalyzerpro.com';
const EMBEDDED_TRACKING_HISTORY_LIMIT = 1200;
const USER_RANK_HISTORY_ARCHIVE_COLLECTION = 'rank_history';
const USER_COMPETITOR_RANK_HISTORY_ARCHIVE_COLLECTION = 'competitor_rank_history';
const DAILY_TRACKING_LEASE_OWNER = `job:${process.pid}:${crypto.randomUUID()}`;


// ─── Caches ──────────────────────────────────────────────────────────────────

const rankingCache = new NodeCache({ stdTTL: 0 }); // no TTL for job — fresh data only
const appDetailsCache = new NodeCache({ stdTTL: 86400 });

// ─── Google Play Scraper ──────────────────────────────────────────────────────

type GooglePlayScraper = {
  search: (options: { term: string; country: string; num: number; requestOptions?: { timeout?: number } }) => Promise<any[]>;
  app: (options: { appId: string; country: string; requestOptions?: { timeout?: number } }) => Promise<any>;
};

function resolveGooglePlayScraper(mod: any): GooglePlayScraper {
  if (mod?.search && mod?.app) return mod as GooglePlayScraper;
  if (mod?.default) return resolveGooglePlayScraper(mod.default);
  throw new Error('Unable to resolve google-play-scraper module shape');
}

const gplay = resolveGooglePlayScraper(gplayModule);

let proxyAgent: HttpsProxyAgent<string> | undefined = undefined;
let proxyUrlString: string | undefined = undefined;
let playStoreFetchDispatcher: UndiciDispatcher | undefined = undefined;
if (process.env.PROXY_HOST && process.env.PROXY_PORT) {
  const auth = process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD 
    ? `${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}@` 
    : '';
  proxyUrlString = `http://${auth}${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`;
  proxyAgent = new HttpsProxyAgent(proxyUrlString);
  playStoreFetchDispatcher = new UndiciProxyAgent(proxyUrlString);
  console.log(`[Proxy] Configured HttpsProxyAgent with host: ${process.env.PROXY_HOST}`);
}

const googlePlayRequestOptions: any = { timeout: RANKING_FETCH_TIMEOUT_MS };
const appStoreRequestOptions: any = { timeout: RANKING_FETCH_TIMEOUT_MS };

if (proxyAgent && proxyUrlString) {
  googlePlayRequestOptions.agent = {
    http: proxyAgent,
    https: proxyAgent
  };
  appStoreRequestOptions.proxy = proxyUrlString;
}

// ─── Firebase Admin ───────────────────────────────────────────────────────────

function initFirebaseAdmin() {
  return initializeFirebaseAdminFirestoreFromEnv();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
  return results;
}

function normalizeTrackedKeywordStatus(input: unknown, lastRank: number): TrackedKeywordStatus {
  if (input === 'pending' || input === 'ok' || input === 'not_ranked' || input === 'error') {
    return input;
  }

  return lastRank === -1 ? 'pending' : 'ok';
}

function sanitizeTrackedKeywords(input: unknown): TrackedKeywordRecord[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const c = item as Partial<TrackedKeywordRecord>;
    if (
      typeof c.keyword !== 'string' ||
      typeof c.appId !== 'string' ||
      typeof c.appTitle !== 'string' ||
      (c.store !== 'ios' && c.store !== 'android') ||
      typeof c.country !== 'string'
    ) return [];
    const lastRank = Number.isFinite(c.lastRank) ? Number(c.lastRank) : -1;
    return [{
      groupId: resolveSharedTrackingGroupId(c),
      keyword: c.keyword,
      appId: c.appId,
      appTitle: c.appTitle,
      store: c.store,
      country: c.country,
      lastRank,
      lastChecked: typeof c.lastChecked === 'string' ? c.lastChecked : new Date(0).toISOString(),
      lastCheckStatus: normalizeTrackedKeywordStatus(c.lastCheckStatus, lastRank),
      ...(typeof c.lastError === 'string' && c.lastError ? { lastError: c.lastError.slice(0, 240) } : {}),
    }];
  });
}

function sanitizeRankHistory(input: unknown): RankHistoryRecord[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const c = item as Partial<RankHistoryRecord>;
    if (typeof c.appId !== 'string' || typeof c.keyword !== 'string' || (c.store !== 'ios' && c.store !== 'android') || typeof c.country !== 'string' || !Number.isFinite(c.rank) || typeof c.timestamp !== 'string') return [];
    return [{
      groupId: resolveSharedTrackingGroupId(c),
      appId: c.appId,
      keyword: c.keyword,
      store: c.store,
      country: c.country,
      rank: Number(c.rank),
      timestamp: c.timestamp,
      rankDepth: Number.isFinite(c.rankDepth) ? Number(c.rankDepth) : undefined,
    }];
  });
}

function getRankHistoryKey(e: RankHistoryRecord) {
  return `${e.store}:${e.country}:${e.appId}:${e.keyword.toLowerCase()}:${e.rank}:${e.timestamp}`;
}

function mergeRankHistory(existing: RankHistoryRecord[], incoming: RankHistoryRecord[]) {
  return mergeSharedRankHistory(existing, incoming, {
    historyLimit: SHARED_TRACKING_HISTORY_LIMIT,
    timeZone: GLOBAL_TRACKING_TIMEZONE,
  });
}

function sanitizeCompetitorTrackedKeywordAppRecord(input: unknown): CompetitorTrackedKeywordAppRecord | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<CompetitorTrackedKeywordAppRecord>;
  if (
    typeof candidate.appKey !== 'string' ||
    !candidate.appKey.trim() ||
    typeof candidate.appId !== 'string' ||
    !candidate.appId.trim() ||
    typeof candidate.title !== 'string' ||
    !candidate.title.trim()
  ) {
    return null;
  }

  const lastRank = Number.isFinite(candidate.lastRank) ? Number(candidate.lastRank) : -1;
  return {
    appKey: candidate.appKey,
    appId: candidate.appId,
    store: candidate.store === 'ios' ? 'ios' : 'android',
    role: candidate.role === 'own' ? 'own' : 'competitor',
    title: candidate.title.trim(),
    developer: typeof candidate.developer === 'string' ? candidate.developer : '',
    icon: typeof candidate.icon === 'string' ? candidate.icon : '',
    url: typeof candidate.url === 'string' ? candidate.url : undefined,
    category: typeof candidate.category === 'string' ? candidate.category : undefined,
    lastRank,
    lastChecked: typeof candidate.lastChecked === 'string' && candidate.lastChecked ? candidate.lastChecked : new Date(0).toISOString(),
    lastCheckStatus: normalizeTrackedKeywordStatus(candidate.lastCheckStatus, lastRank),
    lastError: typeof candidate.lastError === 'string' && candidate.lastError.trim()
      ? candidate.lastError.trim().slice(0, 240)
      : undefined,
  };
}

function sanitizeCompetitorTrackedKeywords(input: unknown): CompetitorTrackedKeywordRecord[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Partial<CompetitorTrackedKeywordRecord>;
    if (
      typeof candidate.trackedKeywordId !== 'string' ||
      !candidate.trackedKeywordId.trim() ||
      typeof candidate.groupId !== 'string' ||
      !candidate.groupId.trim() ||
      typeof candidate.country !== 'string' ||
      typeof candidate.keyword !== 'string' ||
      !candidate.keyword.trim()
    ) {
      return [];
    }

    const apps = Array.isArray(candidate.apps)
      ? candidate.apps
          .map((entry) => sanitizeCompetitorTrackedKeywordAppRecord(entry))
          .filter((entry): entry is CompetitorTrackedKeywordAppRecord => Boolean(entry))
      : [];

    if (apps.length < 2) {
      return [];
    }

    return [{
      trackedKeywordId: candidate.trackedKeywordId,
      groupId: candidate.groupId,
      keyword: candidate.keyword.trim(),
      store: candidate.store === 'ios' ? 'ios' : 'android',
      country: candidate.country,
      apps,
      createdAt: typeof candidate.createdAt === 'string' && candidate.createdAt ? candidate.createdAt : new Date(0).toISOString(),
      updatedAt: typeof candidate.updatedAt === 'string' && candidate.updatedAt ? candidate.updatedAt : new Date(0).toISOString(),
      lastCheckedAt: typeof candidate.lastCheckedAt === 'string' ? candidate.lastCheckedAt : undefined,
    }];
  });
}

function sanitizeCompetitorRankHistory(input: unknown): CompetitorRankHistoryRecord[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Partial<CompetitorRankHistoryRecord>;
    if (
      typeof candidate.trackedKeywordId !== 'string' ||
      !candidate.trackedKeywordId.trim() ||
      typeof candidate.groupId !== 'string' ||
      !candidate.groupId.trim() ||
      typeof candidate.keyword !== 'string' ||
      !candidate.keyword.trim() ||
      typeof candidate.appId !== 'string' ||
      !candidate.appId.trim() ||
      typeof candidate.appKey !== 'string' ||
      !candidate.appKey.trim() ||
      (candidate.store !== 'ios' && candidate.store !== 'android') ||
      typeof candidate.country !== 'string' ||
      !Number.isFinite(candidate.rank) ||
      typeof candidate.timestamp !== 'string'
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
      country: candidate.country,
      rank: Number(candidate.rank),
      timestamp: candidate.timestamp,
      rankDepth: Number.isFinite(candidate.rankDepth) ? Number(candidate.rankDepth) : undefined,
    }];
  });
}

function sanitizeCompetitorGroupAppRecord(input: unknown): CompetitorGroupAppRecord | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Partial<CompetitorGroupAppRecord>;
  if (
    typeof candidate.appKey !== 'string' ||
    !candidate.appKey.trim() ||
    typeof candidate.appId !== 'string' ||
    !candidate.appId.trim() ||
    typeof candidate.title !== 'string' ||
    !candidate.title.trim()
  ) {
    return null;
  }

  return {
    appKey: candidate.appKey,
    appId: candidate.appId,
    store: candidate.store === 'ios' ? 'ios' : 'android',
    role: candidate.role === 'own' ? 'own' : 'competitor',
    title: candidate.title.trim(),
    developer: typeof candidate.developer === 'string' ? candidate.developer : '',
    icon: typeof candidate.icon === 'string' ? candidate.icon : '',
    url: typeof candidate.url === 'string' ? candidate.url : undefined,
    category: typeof candidate.category === 'string' ? candidate.category : undefined,
  };
}

function sanitizeCompetitorGroups(input: unknown): CompetitorGroupRecord[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Partial<CompetitorGroupRecord>;
    const ownApp = sanitizeCompetitorGroupAppRecord(candidate.ownApp);
    const competitors = Array.isArray(candidate.competitors)
      ? candidate.competitors
          .map((entry) => sanitizeCompetitorGroupAppRecord(entry))
          .filter((entry): entry is CompetitorGroupAppRecord => Boolean(entry && entry.role === 'competitor'))
      : [];

    if (
      typeof candidate.groupId !== 'string' ||
      !candidate.groupId.trim() ||
      !ownApp ||
      ownApp.role !== 'own' ||
      competitors.length === 0
    ) {
      return [];
    }

    return [{
      groupId: candidate.groupId.trim(),
      store: candidate.store === 'ios' ? 'ios' : 'android',
      country: normalizeCountryCode(candidate.country, 'us'),
      mode: candidate.mode === 'fast' ? 'fast' : 'deep',
      ownApp,
      competitors,
      trackedKeywordIds: Array.isArray(candidate.trackedKeywordIds)
        ? candidate.trackedKeywordIds.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        : [],
      createdAt:
        typeof candidate.createdAt === 'string' && candidate.createdAt
          ? candidate.createdAt
          : new Date(0).toISOString(),
      updatedAt:
        typeof candidate.updatedAt === 'string' && candidate.updatedAt
          ? candidate.updatedAt
          : new Date(0).toISOString(),
      lastAnalyzedAt: typeof candidate.lastAnalyzedAt === 'string' ? candidate.lastAnalyzedAt : undefined,
      latestSnapshotId: typeof candidate.latestSnapshotId === 'string' ? candidate.latestSnapshotId : undefined,
    }];
  });
}

function sanitizeCompetitorAsoLatestSnapshots(input: unknown): CompetitorAsoSnapshotRecord[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Partial<CompetitorAsoSnapshotRecord>;
    const payloadCandidate = candidate.payload as Partial<CompetitorAsoSnapshotPayload> | undefined;

    if (
      typeof candidate.snapshotId !== 'string' ||
      !candidate.snapshotId.trim() ||
      typeof candidate.groupId !== 'string' ||
      !candidate.groupId.trim() ||
      typeof candidate.appId !== 'string' ||
      !candidate.appId.trim() ||
      typeof candidate.appKey !== 'string' ||
      !candidate.appKey.trim() ||
      typeof candidate.appTitle !== 'string' ||
      !candidate.appTitle.trim()
    ) {
      return [];
    }

    return [{
      snapshotId: candidate.snapshotId,
      groupId: candidate.groupId,
      appId: candidate.appId,
      appKey: candidate.appKey,
      appTitle: candidate.appTitle.trim(),
      store: candidate.store === 'ios' ? 'ios' : 'android',
      country: normalizeCountryCode(candidate.country, 'us'),
      capturedAt:
        typeof candidate.capturedAt === 'string' && candidate.capturedAt
          ? candidate.capturedAt
          : new Date(0).toISOString(),
      payload: {
        title: typeof payloadCandidate?.title === 'string' ? payloadCandidate.title : '',
        description: typeof payloadCandidate?.description === 'string' ? payloadCandidate.description : '',
        icon: typeof payloadCandidate?.icon === 'string' ? payloadCandidate.icon : '',
        category: typeof payloadCandidate?.category === 'string' ? payloadCandidate.category : '',
        screenshots: Array.isArray(payloadCandidate?.screenshots)
          ? Array.from(
              new Set(
                payloadCandidate.screenshots.filter(
                  (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
                ),
              ),
            )
          : [],
      },
    }];
  });
}

function getCompetitorTrackedKeywordKey(record: Pick<CompetitorTrackedKeywordRecord, 'groupId' | 'keyword'>) {
  return `${record.groupId}:${record.keyword.toLowerCase()}`;
}

function mergeCompetitorTrackedKeywords(
  existing: CompetitorTrackedKeywordRecord[],
  incoming: CompetitorTrackedKeywordRecord[],
) {
  const byKey = new Map<string, CompetitorTrackedKeywordRecord>();
  [...existing, ...incoming]
    .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
    .forEach((record) => {
      byKey.set(getCompetitorTrackedKeywordKey(record), record);
    });
  return Array.from(byKey.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

function getCompetitorRankHistoryDayKey(entry: CompetitorRankHistoryRecord) {
  const parts = getZonedDateParts(new Date(entry.timestamp), GLOBAL_TRACKING_TIMEZONE);
  return `${entry.trackedKeywordId}:${entry.appKey}:${parts.year}-${parts.month}-${parts.day}`;
}

function mergeCompetitorRankHistory(
  existing: CompetitorRankHistoryRecord[],
  incoming: CompetitorRankHistoryRecord[],
) {
  const byDayKey = new Map<string, CompetitorRankHistoryRecord>();
  [...existing, ...incoming]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .forEach((entry) => {
      byDayKey.set(getCompetitorRankHistoryDayKey(entry), entry);
    });
  return Array.from(byDayKey.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

function buildTrackedRankHistoryArchiveDocId(entry: RankHistoryRecord) {
  const parts = getZonedDateParts(new Date(entry.timestamp), GLOBAL_TRACKING_TIMEZONE);
  const dayKey = `${entry.groupId || resolveSharedTrackingGroupId(entry)}:${entry.store}:${entry.country}:${entry.appId}:${entry.keyword.toLowerCase()}:${parts.year}-${parts.month}-${parts.day}`;
  return `rh:${crypto.createHash('sha1').update(dayKey).digest('hex').slice(0, 24)}`;
}

function buildCompetitorRankHistoryArchiveDocId(entry: CompetitorRankHistoryRecord) {
  return `crh:${crypto.createHash('sha1').update(getCompetitorRankHistoryDayKey(entry)).digest('hex').slice(0, 24)}`;
}

function splitEmbeddedHistoryWindow<T extends { timestamp: string }>(
  entries: T[],
  limit = EMBEDDED_TRACKING_HISTORY_LIMIT,
) {
  if (entries.length <= limit) {
    return {
      archived: [] as T[],
      retained: entries,
    };
  }

  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  return {
    archived: sorted.slice(0, Math.max(0, sorted.length - limit)),
    retained: sorted.slice(-limit),
  };
}

async function archiveTrackedRankHistoryEntries(userDocRef: any, entries: RankHistoryRecord[]) {
  if (!entries.length) {
    return;
  }

  await mapWithConcurrency(entries, 20, async (entry) => {
    await userDocRef
      .collection(USER_RANK_HISTORY_ARCHIVE_COLLECTION)
      .doc(buildTrackedRankHistoryArchiveDocId(entry))
      .set(entry, { merge: true });
  });
}

async function archiveCompetitorRankHistoryEntries(userDocRef: any, entries: CompetitorRankHistoryRecord[]) {
  if (!entries.length) {
    return;
  }

  await mapWithConcurrency(entries, 20, async (entry) => {
    await userDocRef
      .collection(USER_COMPETITOR_RANK_HISTORY_ARCHIVE_COLLECTION)
      .doc(buildCompetitorRankHistoryArchiveDocId(entry))
      .set(entry, { merge: true });
  });
}

async function archiveAndTrimTrackedRankHistory(userDocRef: any, entries: RankHistoryRecord[]) {
  const { archived, retained } = splitEmbeddedHistoryWindow(entries);
  await archiveTrackedRankHistoryEntries(userDocRef, archived);
  return retained;
}

async function archiveAndTrimCompetitorRankHistory(userDocRef: any, entries: CompetitorRankHistoryRecord[]) {
  const { archived, retained } = splitEmbeddedHistoryWindow(entries);
  await archiveCompetitorRankHistoryEntries(userDocRef, archived);
  return retained;
}

function getZonedDateParts(date: Date, timeZone: string) {
  return getSharedZonedDateParts(date, timeZone);
}

function getGlobalRunKey(date: Date) {
  return getSharedGlobalTrackingRunKey(date, DEFAULT_GLOBAL_TRACKING_TIME, GLOBAL_TRACKING_TIMEZONE);
}

function buildTrackedAlertCountryKey(rule: AlertRule, country: string) {
  return `${rule.id}:${country}`;
}

function sanitizeAlertEventId(input: string) {
  return input.replace(/[^a-zA-Z0-9:_-]/g, '-').slice(0, 200);
}

function buildAlertEventId(
  runKey: string,
  ruleId: string,
  country: string,
  eventType: AlertConditionType,
  threshold: number | null,
) {
  return sanitizeAlertEventId(`${runKey}:${ruleId}:${country}:${eventType}:${threshold ?? 0}`);
}

function getComparableTrackedKey({
  appId,
  keyword,
  store,
  country,
}: Pick<TrackedKeywordRecord, 'appId' | 'keyword' | 'store' | 'country'>) {
  return `${store}:${String(appId)}:${keyword.toLowerCase()}:${country}`;
}

function getCompetitorAsoConditionField(
  conditionType: AlertConditionType,
): CompetitorAsoFieldName | null {
  switch (conditionType) {
    case 'aso_title_changed':
      return 'title';
    case 'aso_description_changed':
      return 'description';
    case 'aso_screenshots_changed':
      return 'screenshots';
    case 'aso_icon_changed':
      return 'icon';
    case 'aso_category_changed':
      return 'category';
    default:
      return null;
  }
}

function buildAlertMessage(
  keyword: string,
  country: string,
  condition: AlertCondition,
  previousRank: number | null,
  currentRank: number | null,
) {
  const region = country.toUpperCase();
  switch (condition.type) {
    case 'enter_top_n':
      return `"${keyword}" entered Top ${condition.value} in ${region} at #${currentRank}.`;
    case 'leave_top_n':
      return `"${keyword}" left Top ${condition.value} in ${region} and is now ${currentRank === -1 || currentRank === null ? 'out of range' : `#${currentRank}`}.`;
    case 'improve_by':
      return `"${keyword}" improved by ${Math.abs((previousRank ?? 0) - (currentRank ?? 0))} spots in ${region} to #${currentRank}.`;
    case 'drop_by':
      return `"${keyword}" dropped by ${Math.abs((currentRank ?? 0) - (previousRank ?? 0))} spots in ${region} to ${currentRank === -1 || currentRank === null ? 'out of range' : `#${currentRank}`}.`;
    case 'starts_ranking':
      return `"${keyword}" started ranking in ${region} at #${currentRank}.`;
    case 'stops_ranking':
      return `"${keyword}" stopped ranking in ${region}${previousRank && previousRank !== -1 ? ` from #${previousRank}` : ''}.`;
    case 'check_error':
      return `"${keyword}" failed to refresh in ${region}.`;
    default:
      return `"${keyword}" changed in ${region}.`;
  }
}

function shouldTriggerAlertCondition(
  condition: AlertCondition,
  previous: TrackedKeywordRecord | undefined,
  next: TrackedKeywordRecord,
) {
  const previousRank = previous?.lastRank ?? null;
  const currentRank = next.lastRank;
  const previousRanked = previousRank !== null && previousRank !== -1;
  const currentRanked = currentRank !== -1;

  switch (condition.type) {
    case 'enter_top_n':
      return (!previousRanked || (previousRank ?? Infinity) > (condition.value ?? 0)) &&
        currentRanked &&
        currentRank <= (condition.value ?? 0);
    case 'leave_top_n':
      return previousRanked &&
        (previousRank ?? Infinity) <= (condition.value ?? 0) &&
        (!currentRanked || currentRank > (condition.value ?? 0));
    case 'improve_by':
      return previousRanked &&
        currentRanked &&
        (previousRank ?? 0) - currentRank >= (condition.value ?? 0);
    case 'drop_by':
      return previousRanked &&
        currentRanked &&
        currentRank - (previousRank ?? 0) >= (condition.value ?? 0);
    case 'starts_ranking':
      return !previousRanked && currentRanked;
    case 'stops_ranking':
      return previousRanked && !currentRanked;
    case 'check_error':
      return next.lastCheckStatus === 'error' && previous?.lastCheckStatus !== 'error';
    default:
      return false;
  }
}

function buildCompetitorAsoAlertMessage(
  diff: CompetitorAsoDiffRecord,
  condition: AlertCondition,
) {
  const region = diff.country.toUpperCase();
  const changedFieldLabels = diff.changes.map((change) => ALERT_CONDITION_LABELS[
    change.field === 'title'
      ? 'aso_title_changed'
      : change.field === 'description'
        ? 'aso_description_changed'
        : change.field === 'screenshots'
          ? 'aso_screenshots_changed'
          : change.field === 'icon'
            ? 'aso_icon_changed'
            : 'aso_category_changed'
  ].toLowerCase());
  if (condition.type === 'aso_any_change') {
    return `${diff.appTitle} changed ${changedFieldLabels.join(', ')} in ${region}.`;
  }
  const matchedChange =
    diff.changes.find((change) => change.field === getCompetitorAsoConditionField(condition.type))
    || diff.changes[0];
  return `${diff.appTitle} changed ${matchedChange.field} in ${region}. ${matchedChange.summary}`;
}

function shouldTriggerCompetitorAsoAlertCondition(
  condition: AlertCondition,
  diff: CompetitorAsoDiffRecord,
) {
  if (condition.type === 'aso_any_change') {
    return diff.changedFields.length > 0;
  }
  const field = getCompetitorAsoConditionField(condition.type);
  return field ? diff.changedFields.includes(field) : false;
}

async function persistAlertEvent(
  userDocRef: DocumentReference<DocumentData>,
  event: AlertEvent,
) {
  try {
    await userDocRef.collection('alert_events').doc(event.id).create(event);
    return true;
  } catch (error: unknown) {
    const code =
      typeof error === 'object' && error && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined;
    if (code === 6 || code === 'already-exists') {
      return false;
    }
    throw error;
  }
}

type PushTokenRecord = {
  id: string;
  token: string;
  lastSeenAt?: string;
  ref: any;
};

type PushDispatchResult = {
  delivered: number;
  failed: number;
  reasons: string[];
};

async function loadUserPushTokens(userDocRef: any): Promise<PushTokenRecord[]> {
  const tokensSnapshot = await userDocRef.collection('push_tokens').get();
  const tokenMap = new Map<string, PushTokenRecord>();

  for (const tokenDoc of tokensSnapshot.docs) {
    const token = tokenDoc.data()?.token;
    if (typeof token !== 'string' || !token.trim()) {
      continue;
    }

    tokenMap.set(token, {
      id: tokenDoc.id,
      token,
      lastSeenAt: typeof tokenDoc.data()?.lastSeenAt === 'string' ? tokenDoc.data()?.lastSeenAt : undefined,
      ref: tokenDoc.ref,
    });
  }

  return Array.from(tokenMap.values());
}

function isInvalidPushTokenCode(code: string | undefined) {
  return (
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-registration-token'
  );
}

async function sendPushNotificationToUser(
  userDocRef: any,
  notification: { title: string; body: string },
  data?: Record<string, string>,
): Promise<PushDispatchResult> {
  let messagingClient;
  try {
    messagingClient = getMessaging();
  } catch {
    log('[push] Skipping send because Firebase Admin Messaging is not configured.');
    return { delivered: 0, failed: 0, reasons: ['admin-not-configured'] };
  }

  const tokens = await loadUserPushTokens(userDocRef);
  if (!tokens.length) {
    log('[push] Skipping send because no push tokens are registered for the user.');
    return { delivered: 0, failed: 0, reasons: ['no-tokens'] };
  }

  const response = await messagingClient.sendEachForMulticast({
    tokens: tokens.map((entry) => entry.token),
    notification,
    ...(data ? { data } : {}),
  });

  const invalidTokenRefs = new Set<any>();
  const reasons = new Set<string>();

  response.responses.forEach((entry, index) => {
    if (entry.success) {
      return;
    }
    const code = entry.error?.code;
    if (code) {
      reasons.add(code);
    }
    if (isInvalidPushTokenCode(code)) {
      invalidTokenRefs.add(tokens[index].ref);
    }
  });

  if (invalidTokenRefs.size) {
    await Promise.all(Array.from(invalidTokenRefs).map((ref) => ref.delete().catch(() => undefined)));
  }

  return {
    delivered: response.successCount,
    failed: response.failureCount,
    reasons: Array.from(reasons),
  };
}

async function sendPushAlertEvents(
  userDocRef: DocumentReference<DocumentData>,
  notificationSettings: NotificationSettings,
  events: AlertEvent[],
) {
  if (!events.length || !notificationSettings.pushEnabled) {
    if (!notificationSettings.pushEnabled) {
      log('[push] Skipping alert push because push notifications are disabled for the user.');
    }
    return;
  }

  await Promise.all(
    events.map(async (event) => {
      try {
        const result = await sendPushNotificationToUser(
          userDocRef,
          {
            title:
              event.scope === 'competitor_aso'
                ? `Competitor ASO alert: ${event.keyword}`
                : `Keyword alert: ${event.keyword}`,
            body: event.message,
          },
          {
            eventId: event.id,
            groupId: event.groupId,
            country: event.country,
            eventType: event.eventType,
          },
        );
        if (result.reasons.length) {
          log(`[push] Alert ${event.id} delivery notes: ${result.reasons.join(', ')}`);
        }
      } catch (error) {
        console.warn(`Failed to deliver push alert ${event.id}`, error);
      }
    }),
  );
}

function escapeAlertEmailHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatAlertEmailTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }
  const istTime = date.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: GLOBAL_TRACKING_TIMEZONE,
  });
  const utcTime = date.toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  });
  return `${istTime} ${GLOBAL_TRACKING_TIMEZONE} (${utcTime} UTC)`;
}

function formatAlertChangedFieldLabel(field: string) {
  switch (field) {
    case 'title':
      return 'Title';
    case 'description':
      return 'Description';
    case 'screenshots':
      return 'Screenshots';
    case 'icon':
      return 'Icon';
    case 'category':
      return 'Category';
    default:
      return field;
  }
}

function getAlertEmailSubject(event: AlertEvent) {
  return event.scope === 'competitor_aso'
    ? `Competitor ASO alert: ${event.changedAppTitle || event.keyword}`
    : `Keyword alert: ${event.keyword}`;
}

function buildAlertEmailHtml(event: AlertEvent) {
  const storeLabel = event.store === 'ios' ? 'iOS' : 'Android';
  const changedFields = Array.isArray(event.changedFields) && event.changedFields.length
    ? event.changedFields.map((field) => formatAlertChangedFieldLabel(field)).join(', ')
    : null;
  const heading = event.scope === 'competitor_aso'
    ? escapeAlertEmailHtml(event.changedAppTitle || event.keyword)
    : escapeAlertEmailHtml(event.keyword);

  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #0f172a;">
      <h2 style="margin: 0 0 12px; font-size: 22px;">${escapeAlertEmailHtml(getAlertEmailSubject(event))}</h2>
      <p style="margin: 0 0 18px; color: #334155;">${escapeAlertEmailHtml(event.message)}</p>
      <div style="border: 1px solid #cbd5e1; border-radius: 12px; background: #f8fafc; padding: 18px;">
        <p style="margin: 0 0 8px;"><strong>Target:</strong> ${heading}</p>
        <p style="margin: 0 0 8px;"><strong>Store:</strong> ${storeLabel}</p>
        <p style="margin: 0 0 8px;"><strong>Country:</strong> ${escapeAlertEmailHtml(event.country.toUpperCase())}</p>
        <p style="margin: 0 0 8px;"><strong>Triggered:</strong> ${escapeAlertEmailHtml(formatAlertEmailTimestamp(event.createdAt))}</p>
        ${changedFields ? `<p style="margin: 0;"><strong>Changed fields:</strong> ${escapeAlertEmailHtml(changedFields)}</p>` : ''}
      </div>
      <a href="${escapeAlertEmailHtml(ALERT_EMAIL_APP_URL)}" style="display: inline-block; margin-top: 20px; padding: 12px 20px; border-radius: 10px; background: #06b6d4; color: #082f49; text-decoration: none; font-weight: 700;">
        Open Workspace
      </a>
    </div>
  `;
}

async function sendEmailAlertEvents(
  userDocRef: DocumentReference<DocumentData>,
  events: AlertEvent[],
) {
  if (!events.length) {
    return;
  }
  if (!resend) {
    log('[email] Skipping alert email because Resend is not configured.');
    return;
  }

  try {
    const authUser = await getAuth().getUser(userDocRef.id);
    const recipient = authUser.email?.trim().toLowerCase();
    if (!recipient) {
      log(`[email] Skipping alert email for user ${userDocRef.id} because no account email is available.`);
      return;
    }

    await Promise.all(
      events.map(async (event) => {
        try {
          await resend.emails.send({
            from: `Rank Analyzer Pro <${RESEND_FROM_EMAIL}>`,
            to: recipient,
            subject: getAlertEmailSubject(event),
            html: buildAlertEmailHtml(event),
          });
        } catch (error) {
          console.warn(`[email] Failed to deliver alert email ${event.id}`, error);
        }
      }),
    );
  } catch (error) {
    console.warn(`[email] Failed to resolve alert email for user ${userDocRef.id}`, error);
  }
}

function buildCronFailureEmailHtml(input: {
  runKey: string;
  trigger: 'automatic' | 'manual' | 'watchdog';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  errorMessage: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #0f172a;">
      <h2 style="margin: 0 0 12px; font-size: 22px;">Cron job failed</h2>
      <p style="margin: 0 0 18px; color: #334155;">The daily tracking cron job failed before completing.</p>
      <div style="border: 1px solid #cbd5e1; border-radius: 12px; background: #f8fafc; padding: 18px;">
        <p style="margin: 0 0 8px;"><strong>Run key:</strong> ${escapeAlertEmailHtml(input.runKey)}</p>
        <p style="margin: 0 0 8px;"><strong>Trigger:</strong> ${escapeAlertEmailHtml(input.trigger)}</p>
        <p style="margin: 0 0 8px;"><strong>Started:</strong> ${escapeAlertEmailHtml(formatAlertEmailTimestamp(input.startedAt))}</p>
        <p style="margin: 0 0 8px;"><strong>Finished:</strong> ${escapeAlertEmailHtml(formatAlertEmailTimestamp(input.finishedAt))}</p>
        <p style="margin: 0 0 8px;"><strong>Duration:</strong> ${escapeAlertEmailHtml(`${Math.max(0, Math.round(input.durationMs / 1000))}s`)}</p>
        <p style="margin: 0;"><strong>Error:</strong> ${escapeAlertEmailHtml(input.errorMessage)}</p>
      </div>
      <a href="${escapeAlertEmailHtml(ALERT_EMAIL_APP_URL)}" style="display: inline-block; margin-top: 20px; padding: 12px 20px; border-radius: 10px; background: #06b6d4; color: #082f49; text-decoration: none; font-weight: 700;">
        Open Workspace
      </a>
    </div>
  `;
}

async function sendCronFailureEmail(input: {
  runKey: string;
  trigger: 'automatic' | 'manual' | 'watchdog';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  errorMessage: string;
}) {
  if (!resend) {
    log('[email] Skipping cron failure email because Resend is not configured.');
    return;
  }
  if (!CRON_FAILURE_EMAIL_RECIPIENTS.length) {
    log('[email] Skipping cron failure email because CRON_FAILURE_EMAIL is not configured.');
    return;
  }

  try {
    await resend.emails.send({
      from: `Rank Analyzer Pro <${RESEND_FROM_EMAIL}>`,
      to: CRON_FAILURE_EMAIL_RECIPIENTS,
      subject: `Cron job failed: ${input.runKey}`,
      html: buildCronFailureEmailHtml(input),
    });
  } catch (error) {
    log(`[email] Failed to deliver cron failure email: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function readDailyTrackingSummaryFromStatus(
  statusData: DailyTrackingStatusRecord | undefined,
): DailyTrackingSummary {
  const empty = getEmptyDailyTrackingSummary();
  return {
    scanned: statusData?.scanned ?? empty.scanned,
    ran: statusData?.ran ?? empty.ran,
    checked: statusData?.checked ?? empty.checked,
    changed: statusData?.changed ?? empty.changed,
    failed: statusData?.failed ?? empty.failed,
    asoChecked: statusData?.asoChecked ?? empty.asoChecked,
    asoChanged: statusData?.asoChanged ?? empty.asoChanged,
    asoFailed: statusData?.asoFailed ?? empty.asoFailed,
  };
}

function hasActiveDailyTrackingLease(
  statusData: DailyTrackingStatusRecord | undefined,
  now: Date,
  ownerId?: string,
) {
  if (!statusData?.leaseOwner || !statusData.leaseExpiresAt) {
    return false;
  }
  if (ownerId && statusData.leaseOwner === ownerId) {
    return false;
  }

  const leaseExpiresAt = Date.parse(statusData.leaseExpiresAt);
  if (Number.isNaN(leaseExpiresAt)) {
    return false;
  }

  return leaseExpiresAt > now.getTime();
}

async function acquireDailyTrackingLease(
  statusRef: DocumentReference<DocumentData>,
  options: {
    runKey: string;
    ownerId: string;
    force?: boolean;
    trigger?: 'automatic' | 'manual' | 'watchdog';
  },
) {
  const now = new Date();
  const nextLeaseExpiresAt = new Date(
    now.getTime() + DAILY_TRACKING_LEASE_TTL_MINUTES * 60 * 1000,
  ).toISOString();

  return statusRef.firestore.runTransaction(async (transaction) => {
    const statusSnapshot = await transaction.get(statusRef);
    const statusData = statusSnapshot.data() as DailyTrackingStatusRecord | undefined;

    if (
      !options.force &&
      statusData?.runKey === options.runKey &&
      statusData?.lastStatus === 'success'
    ) {
      return {
        acquired: false as const,
        reason: 'already-succeeded' as const,
        statusData,
      };
    }

    if (hasActiveDailyTrackingLease(statusData, now, options.ownerId)) {
      return {
        acquired: false as const,
        reason: 'lease-active' as const,
        statusData,
      };
    }

    transaction.set(
      statusRef,
      {
        runKey: options.runKey,
        lastStartedAt: now.toISOString(),
        lastStatus: 'running',
        lastTrigger: options.trigger || 'automatic',
        lastRetryAt: options.force ? now.toISOString() : FieldValue.delete(),
        retryCount: options.force ? FieldValue.increment(1) : 0,
        error: FieldValue.delete(),
        watchdogRetryEligible: false,
        leaseOwner: options.ownerId,
        leaseExpiresAt: nextLeaseExpiresAt,
      },
      { merge: true },
    );

    return {
      acquired: true as const,
      reason: 'acquired' as const,
      statusData,
    };
  });
}

async function refreshDailyTrackingLease(
  statusRef: DocumentReference<DocumentData>,
  ownerId: string,
) {
  await statusRef.set(
    {
      leaseOwner: ownerId,
      leaseExpiresAt: new Date(
        Date.now() + DAILY_TRACKING_LEASE_TTL_MINUTES * 60 * 1000,
      ).toISOString(),
    },
    { merge: true },
  );
}

async function evaluateAndDispatchAlertRules(
  userDocRef: DocumentReference<DocumentData>,
  previousTrackedKeywords: TrackedKeywordRecord[],
  nextTrackedKeywords: TrackedKeywordRecord[],
  alertRules: AlertRule[],
  notificationSettings: NotificationSettings,
  runKey: string,
) {
  if (!alertRules.length) {
    return {
      updatedRules: alertRules,
      createdEvents: [] as AlertEvent[],
    };
  }

  const previousByKey = new Map(
    previousTrackedKeywords.map((entry) => [getComparableTrackedKey(entry), entry]),
  );
  const nextByKey = new Map(
    nextTrackedKeywords.map((entry) => [getComparableTrackedKey(entry), entry]),
  );

  const updatedRules = alertRules.map((rule) => ({
    ...rule,
    baselineKeys: Array.isArray(rule.baselineKeys) ? [...rule.baselineKeys] : [],
  }));
  const pushEvents: AlertEvent[] = [];
  const emailEvents: AlertEvent[] = [];
  const createdEvents: AlertEvent[] = [];

  for (const rule of updatedRules) {
    if (
      rule.scope === 'competitor_aso' ||
      !rule.enabled ||
      (!rule.channels.inApp && !rule.channels.push && !rule.channels.email) ||
      !rule.conditions.length
    ) {
      continue;
    }

    for (const country of rule.countries) {
      const trackedKey = getComparableTrackedKey({
        appId: rule.appId,
        keyword: rule.keyword,
        store: rule.store,
        country,
      });
      const previous = previousByKey.get(trackedKey);
      const next = nextByKey.get(trackedKey);
      if (!next) {
        continue;
      }

      const baselineKey = buildTrackedAlertCountryKey(rule, country);
      const hasBaseline = rule.baselineKeys?.includes(baselineKey) ?? false;
      const canEstablishBaseline = next.lastCheckStatus !== 'error';

      for (const condition of rule.conditions) {
        if (condition.type !== 'check_error' && !hasBaseline) {
          continue;
        }
        if (!shouldTriggerAlertCondition(condition, previous, next)) {
          continue;
        }

        const event: AlertEvent = {
          id: buildAlertEventId(
            runKey,
            rule.id,
            country,
            condition.type,
            condition.value ?? null,
          ),
          ruleId: rule.id,
          groupId: rule.groupId,
          appId: rule.appId,
          keyword: rule.keyword,
          store: rule.store,
          country,
          eventType: condition.type,
          previousRank: previous?.lastRank ?? null,
          currentRank: next.lastRank ?? null,
          threshold: condition.value ?? null,
          message: buildAlertMessage(
            rule.keyword,
            country,
            condition,
            previous?.lastRank ?? null,
            next.lastRank ?? null,
          ),
          createdAt: new Date().toISOString(),
          readAt: null,
        };
        const created = await persistAlertEvent(userDocRef, event);
        if (!created) {
          continue;
        }
        createdEvents.push(event);
        if (rule.channels.push) {
          pushEvents.push(event);
        }
        if (rule.channels.email) {
          emailEvents.push(event);
        }
      }

      if (!hasBaseline && canEstablishBaseline) {
        rule.baselineKeys = Array.from(new Set([...(rule.baselineKeys || []), baselineKey]));
      }
    }
  }

  if (pushEvents.length) {
    await sendPushAlertEvents(userDocRef, notificationSettings, pushEvents);
  }
  if (emailEvents.length) {
    await sendEmailAlertEvents(userDocRef, emailEvents);
  }

  return {
    updatedRules,
    createdEvents,
  };
}

async function evaluateAndDispatchCompetitorAsoAlertRules(
  userDocRef: DocumentReference<DocumentData>,
  alertRules: AlertRule[],
  notificationSettings: NotificationSettings,
  diffs: CompetitorAsoDiffRecord[],
  runKey: string,
) {
  const asoRules = alertRules.filter(
    (rule) =>
      rule.scope === 'competitor_aso' &&
      rule.enabled &&
      (rule.channels.inApp || rule.channels.push || rule.channels.email) &&
      rule.conditions.length > 0,
  );
  if (!asoRules.length || !diffs.length) {
    return { createdEvents: [] as AlertEvent[] };
  }

  const createdEvents: AlertEvent[] = [];
  const pushEvents: AlertEvent[] = [];
  const emailEvents: AlertEvent[] = [];

  for (const rule of asoRules) {
    const countrySet = new Set(rule.countries.map((country) => normalizeCountryCode(country, 'us')));
    const targetAppIds = new Set(
      Array.isArray(rule.targetAppIds)
        ? rule.targetAppIds.filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
        : [],
    );
    const matchingDiffs = diffs.filter((diff) => {
      if (diff.groupId !== rule.groupId) {
        return false;
      }
      if (!countrySet.has(diff.country)) {
        return false;
      }
      if (targetAppIds.size > 0 && !targetAppIds.has(diff.appId)) {
        return false;
      }
      return true;
    });

    for (const diff of matchingDiffs) {
      for (const condition of rule.conditions) {
        if (!shouldTriggerCompetitorAsoAlertCondition(condition, diff)) {
          continue;
        }
        const event: AlertEvent = {
          id: sanitizeAlertEventId(`${runKey}:${rule.id}:${diff.diffId}:${condition.type}`),
          ruleId: rule.id,
          groupId: diff.groupId,
          appId: diff.appId,
          keyword: diff.appTitle,
          store: diff.store,
          country: diff.country,
          eventType: condition.type,
          scope: 'competitor_aso',
          previousRank: null,
          currentRank: null,
          threshold: null,
          message: buildCompetitorAsoAlertMessage(diff, condition),
          changedAppId: diff.appId,
          changedAppTitle: diff.appTitle,
          changedFields: diff.changedFields,
          createdAt: diff.detectedAt,
          readAt: null,
        };
        const created = await persistAlertEvent(userDocRef, event);
        if (!created) {
          continue;
        }
        createdEvents.push(event);
        if (rule.channels.push) {
          pushEvents.push(event);
        }
        if (rule.channels.email) {
          emailEvents.push(event);
        }
      }
    }
  }

  if (pushEvents.length) {
    await sendPushAlertEvents(userDocRef, notificationSettings, pushEvents);
  }
  if (emailEvents.length) {
    await sendEmailAlertEvents(userDocRef, emailEvents);
  }

  return { createdEvents };
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

// ─── Ranking Fetchers ─────────────────────────────────────────────────────────

async function fetchPlayStoreHtml(urlPath: string, country: string, retries = 2) {
  const gl = country.toUpperCase();
  const url = new URL(`https://play.google.com${urlPath}`);
  if (!url.searchParams.has('hl')) url.searchParams.set('hl', 'en_US');
  if (!url.searchParams.has('gl')) url.searchParams.set('gl', gl);

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(PLAY_STORE_FETCH_TIMEOUT_MS),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        ...(playStoreFetchDispatcher
          ? { dispatcher: playStoreFetchDispatcher }
          : {}),
      } as RequestInit & { dispatcher?: UndiciDispatcher });

      if (!response.ok && response.status !== 404) {
        throw new Error(`Google Play returned HTTP ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError;
}

function parsePlayStoreRankFromHtml(html: string, targetAppId: string, depth: number) {
  const seen = new Set<string>();
  const pattern = /\/store\/apps\/details\?id=([^"&\\]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const appId = decodeURIComponent(match[1]);
    if (!appId || seen.has(appId)) continue;
    seen.add(appId);
    if (String(appId) === String(targetAppId)) return seen.size;
    if (seen.size >= depth) return -1;
  }
  
  if (seen.size === 0) {
    throw new Error('Play Store web search returned 0 results. Possible HTML structure change or captcha.');
  }
  
  return -1;
}

async function getGooglePlayRankViaProxySearch(
  keyword: string,
  appId: string,
  country: string,
  depth: number,
) {
  const results = await gplay.search({
    term: keyword,
    country,
    num: depth,
    requestOptions: googlePlayRequestOptions,
  });
  const index = results.findIndex((app: any) => String(app.appId) === String(appId));
  return index !== -1 ? index + 1 : -1;
}

async function getGooglePlayRankWithFallback(
  keyword: string,
  appId: string,
  country: string,
  depth: number,
) {
  if (googlePlayRequestOptions.agent) {
    log(`[tracking] Using proxy-first Google Play rank lookup for "${keyword}".`);
    try {
      const proxyRank = await getGooglePlayRankViaProxySearch(
        keyword,
        appId,
        country,
        depth,
      );
      if (proxyRank !== -1) {
        return proxyRank;
      }

      log(
        `[tracking] Proxy-first rank lookup returned not ranked for "${keyword}", retrying direct web lookup.`,
      );
    } catch (err) {
      log(
        `[tracking] Proxy-first rank lookup failed for "${keyword}", retrying direct web lookup.`,
      );
    }

    const html = await fetchPlayStoreHtml(
      `/store/search?c=apps&q=${encodeURIComponent(keyword)}`,
      country,
    );
    return parsePlayStoreRankFromHtml(html, appId, depth);
  }

  try {
    const html = await fetchPlayStoreHtml(
      `/store/search?c=apps&q=${encodeURIComponent(keyword)}`,
      country,
    );
    const directRank = parsePlayStoreRankFromHtml(html, appId, depth);
    if (directRank !== -1 || !googlePlayRequestOptions.agent) {
      return directRank;
    }

    log(`[tracking] Direct Google Play rank lookup returned not ranked for "${keyword}", verifying via proxy.`);
    return await getGooglePlayRankViaProxySearch(keyword, appId, country, depth);
  } catch (err) {
    if (!googlePlayRequestOptions.agent) {
      throw err;
    }

    log(`[tracking] Direct Google Play rank lookup failed for "${keyword}", retrying via proxy.`);
    return await getGooglePlayRankViaProxySearch(keyword, appId, country, depth);
  }
}

function normalizeAsoTextValue(input: unknown) {
  return typeof input === 'string'
    ? input.replace(/\s+/g, ' ').trim()
    : '';
}

function normalizeAsoScreenshotList(input: unknown, iconUrl?: string) {
  if (!Array.isArray(input)) {
    return [];
  }

  const seen = new Set<string>();
  return input.flatMap((entry) => {
    if (typeof entry !== 'string') {
      return [];
    }

    const normalized = entry.trim();
    if (!normalized || normalized === iconUrl || seen.has(normalized)) {
      return [];
    }

    seen.add(normalized);
    return [normalized];
  });
}

function extractPlayFallbackScreenshots(html: string, iconUrl?: string) {
  const matches = Array.from(
    html.matchAll(/https:\/\/play-lh\.googleusercontent\.com\/[^"'\\\s)]+/gi),
  ).map((match) => match[0]);
  return normalizeAsoScreenshotList(matches, iconUrl);
}

function parsePlayStoreAppDetails(html: string, appId: string) {
  const titleMatch =
    html.match(/<span class="AfwdI" itemprop="name">([^<]+)<\/span>/i)
    || html.match(/<meta property="og:title" content="([^"]+?) - Apps on Google Play"/i);
  const developerMatch = html.match(/<a href="\/store\/apps\/dev\?id=[^"]+">\s*<span>([^<]+)<\/span><\/a>/i);
  const scoreMatch = html.match(/aria-label="Rated ([\d.]+) stars out of five stars"/i);
  const descriptionMatch = html.match(/<meta name="description" property="og:description" content="([^"]*)"/i);
  const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
  const genreMatch = html.match(/\],"([^"]+)",null,null,\[null,\[\[0,"USD"/i);

  if (!titleMatch) {
    throw new Error('Unable to parse Play Store app details');
  }

  const icon = imageMatch?.[1] || '';
  return {
    appId,
    title: decodeHtmlEntities(titleMatch[1].trim()),
    description: decodeHtmlEntities((descriptionMatch?.[1] || '').trim()),
    icon,
    screenshots: extractPlayFallbackScreenshots(html, icon),
    score: scoreMatch ? Number(scoreMatch[1]) : 0,
    developer: decodeHtmlEntities((developerMatch?.[1] || '').trim()),
    genre: genreMatch ? decodeHtmlEntities(genreMatch[1]) : undefined,
    url: `https://play.google.com/store/apps/details?id=${encodeURIComponent(appId)}`,
  };
}

async function getStoreAppDetails(appId: string, storeType: StoreType, country: string) {
  const cacheKey = `app:${storeType}:${country}:${appId}`;
  const cachedDetails = appDetailsCache.get<any>(cacheKey);
  if (cachedDetails) {
    return cachedDetails;
  }

  let details: any;
  if (storeType === 'ios') {
    details = await store.app({ id: appId, country, requestOptions: appStoreRequestOptions });
  } else {
    try {
      details = await gplay.app({ appId, country, requestOptions: googlePlayRequestOptions });
    } catch (error) {
      console.warn(
        `google-play-scraper app lookup failed for "${appId}"${googlePlayRequestOptions.agent ? ' via proxy' : ''}, falling back to web parsing.`,
      );
      const html = await fetchPlayStoreHtml(
        `/store/apps/details?id=${encodeURIComponent(appId)}`,
        country,
      );
      details = parsePlayStoreAppDetails(html, appId);
    }
  }

  appDetailsCache.set(cacheKey, details);
  return details;
}

function getComparableCompetitorAsoSnapshotKey({
  groupId,
  appId,
  country,
}: Pick<CompetitorAsoSnapshotRecord, 'groupId' | 'appId' | 'country'>) {
  return `${groupId}:${appId}:${normalizeCountryCode(country, 'us')}`;
}

function normalizeCompetitorAsoSnapshotPayload(
  details: any,
  storeType: StoreType,
): CompetitorAsoSnapshotPayload {
  const icon = normalizeAsoTextValue(details?.icon || details?.artworkUrl512 || details?.artworkUrl100);
  return {
    title: normalizeAsoTextValue(details?.title || details?.trackName || details?.name),
    description: normalizeAsoTextValue(details?.description || details?.summary),
    icon,
    category: normalizeAsoTextValue(
      storeType === 'ios'
        ? details?.primaryGenre || details?.genre || details?.category
        : details?.genre || details?.category,
    ),
    screenshots: normalizeAsoScreenshotList(
      details?.screenshots || details?.screenshotUrls || details?.ipadScreenshotUrls,
      icon,
    ),
  };
}

function buildCompetitorAsoSnapshotId(groupId: string, appId: string, country: string, capturedAt: string) {
  const input = `${groupId}:${appId}:${country}:${capturedAt}`;
  return `aso-snapshot:${crypto.createHash('sha1').update(input).digest('hex').slice(0, 24)}`;
}

function buildCompetitorAsoDiffId(runKey: string, groupId: string, appId: string, country: string) {
  const input = `${runKey}:${groupId}:${appId}:${country}`;
  return `aso-diff:${crypto.createHash('sha1').update(input).digest('hex').slice(0, 24)}`;
}

function summarizeAsoFieldValue(field: CompetitorAsoFieldName, value: string | string[] | null) {
  if (field === 'screenshots') {
    return Array.isArray(value)
      ? `${value.length} screenshot${value.length === 1 ? '' : 's'}`
      : '0 screenshots';
  }
  if (typeof value !== 'string') {
    return '-';
  }
  if (value.length <= 72) {
    return value || '-';
  }
  return `${value.slice(0, 69)}...`;
}

function buildCompetitorAsoFieldSummary(
  field: CompetitorAsoFieldName,
  previousValue: string | string[] | null,
  currentValue: string | string[] | null,
) {
  if (field === 'screenshots') {
    const previousScreenshots = Array.isArray(previousValue) ? previousValue : [];
    const currentScreenshots = Array.isArray(currentValue) ? currentValue : [];
    if (!previousScreenshots.length && currentScreenshots.length) {
      return `Added ${currentScreenshots.length} screenshots.`;
    }
    if (previousScreenshots.length && !currentScreenshots.length) {
      return 'Removed all screenshots.';
    }
    const added = currentScreenshots.filter((entry) => !previousScreenshots.includes(entry));
    const removed = previousScreenshots.filter((entry) => !currentScreenshots.includes(entry));
    const reordered =
      !added.length &&
      !removed.length &&
      previousScreenshots.join('|') !== currentScreenshots.join('|');
    if (added.length || removed.length) {
      return `${added.length ? `Added ${added.length}` : 'Added 0'}${removed.length ? `, removed ${removed.length}` : ''} screenshots.`;
    }
    if (reordered) {
      return 'Reordered screenshots.';
    }
    return 'Updated screenshots.';
  }

  const previousLabel = summarizeAsoFieldValue(field, previousValue);
  const currentLabel = summarizeAsoFieldValue(field, currentValue);
  return `${field} changed from "${previousLabel}" to "${currentLabel}".`;
}

function diffCompetitorAsoSnapshots(
  previousSnapshot: CompetitorAsoSnapshotRecord,
  currentSnapshot: CompetitorAsoSnapshotRecord,
  runKey: string,
): CompetitorAsoDiffRecord | null {
  const fields: CompetitorAsoFieldName[] = ['title', 'description', 'icon', 'category', 'screenshots'];
  const changes: CompetitorAsoFieldChange[] = [];

  fields.forEach((field) => {
    const previousValue = previousSnapshot.payload[field];
    const currentValue = currentSnapshot.payload[field];
    const didChange = Array.isArray(previousValue) || Array.isArray(currentValue)
      ? JSON.stringify(previousValue || []) !== JSON.stringify(currentValue || [])
      : previousValue !== currentValue;
    if (!didChange) {
      return;
    }

    changes.push({
      field,
      previousValue: previousValue ?? null,
      currentValue: currentValue ?? null,
      summary: buildCompetitorAsoFieldSummary(field, previousValue ?? null, currentValue ?? null),
    });
  });

  if (!changes.length) {
    return null;
  }

  return {
    diffId: buildCompetitorAsoDiffId(runKey, currentSnapshot.groupId, currentSnapshot.appId, currentSnapshot.country),
    groupId: currentSnapshot.groupId,
    appId: currentSnapshot.appId,
    appKey: currentSnapshot.appKey,
    appTitle: currentSnapshot.appTitle,
    store: currentSnapshot.store,
    country: currentSnapshot.country,
    detectedAt: currentSnapshot.capturedAt,
    previousSnapshotId: previousSnapshot.snapshotId,
    currentSnapshotId: currentSnapshot.snapshotId,
    changedFields: changes.map((change) => change.field),
    changes,
  };
}

function getCompetitorTrackedCountriesForGroup(
  group: CompetitorGroupRecord,
  competitorTrackedKeywords: CompetitorTrackedKeywordRecord[],
) {
  const countries = new Set<string>([normalizeCountryCode(group.country, 'us')]);
  competitorTrackedKeywords
    .filter((record) => record.groupId === group.groupId)
    .forEach((record) => {
      countries.add(normalizeCountryCode(record.country, group.country));
    });
  return Array.from(countries).sort((a, b) => a.localeCompare(b));
}

async function persistCompetitorAsoDiff(userDocRef: any, diff: CompetitorAsoDiffRecord) {
  try {
    await userDocRef.collection('competitor_aso_diffs').doc(diff.diffId).create(diff);
    return true;
  } catch (error: any) {
    if (error?.code === 6 || error?.code === 'already-exists') {
      return false;
    }
    throw error;
  }
}

async function captureCompetitorAsoState(
  userDocRef: any,
  state: Pick<
    TrackingState,
    'competitorGroups' | 'competitorTrackedKeywords' | 'competitorAsoLatestSnapshots' | 'alertRules' | 'notificationSettings'
  >,
  runKey: string,
) {
  if (!state.competitorGroups.length) {
    return {
      nextLatestSnapshots: [] as CompetitorAsoSnapshotRecord[],
      createdEvents: [] as AlertEvent[],
      checked: 0,
      changed: 0,
      failed: 0,
    };
  }

  const allowedKeys = new Set(
    state.competitorGroups.flatMap((group) =>
      getCompetitorTrackedCountriesForGroup(group, state.competitorTrackedKeywords).flatMap((country) =>
        group.competitors.map((app) => `${group.groupId}:${app.appId}:${country}`),
      ),
    ),
  );
  const latestByKey = new Map(
    state.competitorAsoLatestSnapshots
      .filter((snapshot) => allowedKeys.has(getComparableCompetitorAsoSnapshotKey(snapshot)))
      .map((snapshot) => [getComparableCompetitorAsoSnapshotKey(snapshot), snapshot] as const),
  );

  let checked = 0;
  let failed = 0;
  const createdDiffs: CompetitorAsoDiffRecord[] = [];

  await mapWithConcurrency(state.competitorGroups, 1, async (group) => {
    const trackedCountries = getCompetitorTrackedCountriesForGroup(group, state.competitorTrackedKeywords);
    await mapWithConcurrency(trackedCountries, 1, async (trackedCountry) => {
      await mapWithConcurrency(group.competitors, 2, async (app) => {
        const capturedAt = new Date().toISOString();
        try {
          const details = await getStoreAppDetails(app.appId, group.store, trackedCountry);
          const payload = normalizeCompetitorAsoSnapshotPayload(details, group.store);
          if (!payload.title) {
            payload.title = app.title;
          }

          const snapshot: CompetitorAsoSnapshotRecord = {
            snapshotId: buildCompetitorAsoSnapshotId(group.groupId, app.appId, trackedCountry, capturedAt),
            groupId: group.groupId,
            appId: app.appId,
            appKey: app.appKey,
            appTitle: payload.title || app.title,
            store: group.store,
            country: trackedCountry,
            capturedAt,
            payload,
          };

          const comparableKey = getComparableCompetitorAsoSnapshotKey(snapshot);
          const previousSnapshot = latestByKey.get(comparableKey);
          latestByKey.set(comparableKey, snapshot);
          checked += 1;

          if (!previousSnapshot) {
            return;
          }

          const diff = diffCompetitorAsoSnapshots(previousSnapshot, snapshot, runKey);
          if (!diff) {
            return;
          }

          const created = await persistCompetitorAsoDiff(userDocRef, diff);
          if (created) {
            createdDiffs.push(diff);
          }
        } catch (error) {
          failed += 1;
          console.warn(
            `  ⚠ Competitor ASO snapshot failed for "${app.title}" [${trackedCountry}] → ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      });
    });
  });

  const { createdEvents } = await evaluateAndDispatchCompetitorAsoAlertRules(
    userDocRef,
    state.alertRules,
    state.notificationSettings,
    createdDiffs,
    runKey,
  );

  return {
    nextLatestSnapshots: Array.from(latestByKey.values()).sort(
      (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
    ),
    createdEvents,
    checked,
    changed: createdDiffs.length,
    failed,
  };
}

async function getKeywordRank(keyword: string, appId: string, storeType: StoreType, country: string): Promise<number> {
  const cacheKey = `${storeType}:${country}:${appId}:${keyword.toLowerCase()}`;
  const cached = rankingCache.get<number>(cacheKey);
  if (cached !== undefined) return cached;

  let rank = -1;
  if (storeType === 'ios') {
    try {
      const results = await store.search({ term: keyword, num: TRACKED_KEYWORD_RANKING_DEPTH, country, requestOptions: appStoreRequestOptions });
      const index = results.findIndex((app: any) => String(app.appId) === String(appId) || String(app.id) === String(appId));
      rank = index !== -1 ? index + 1 : -1;
    } catch (err) {
      throw new Error(`iOS rank fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    try {
      rank = await getGooglePlayRankWithFallback(
        keyword,
        appId,
        country,
        TRACKED_KEYWORD_RANKING_DEPTH,
      );
    } catch (err) {
      throw new Error(`Android rank fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  rankingCache.set(cacheKey, rank);
  return rank;
}

// ─── Core Job ─────────────────────────────────────────────────────────────────

async function refreshUserTracking(state: TrackingState, runKey: string) {
  if (!state.trackedKeywords.length) return { checked: 0, changed: 0, failed: 0, nextState: { ...state, schedule: { ...state.schedule, lastRunAt: new Date().toISOString(), lastRunKey: runKey } } };

  const refreshResults = await mapWithConcurrency(state.trackedKeywords, TRACKING_REFRESH_CONCURRENCY, async (kw) => {
    try {
      const rank = await getKeywordRank(kw.keyword, kw.appId, kw.store, kw.country);
      return {
        previousRank: kw.lastRank,
        trackedKeyword: { ...kw, lastRank: rank, lastChecked: new Date().toISOString(), lastCheckStatus: rank === -1 ? 'not_ranked' as const : 'ok' as const, lastError: undefined },
        historyEntry: { appId: kw.appId, keyword: kw.keyword, store: kw.store, country: kw.country, rank, rankDepth: TRACKED_KEYWORD_RANKING_DEPTH, timestamp: new Date().toISOString() } as RankHistoryRecord,
        hadError: false,
      };
    } catch (err) {
      console.warn(`  ⚠ [${kw.country}] "${kw.keyword}" (${kw.store}) → ${err instanceof Error ? err.message : String(err)}`);
      return {
        previousRank: kw.lastRank,
        trackedKeyword: { ...kw, lastChecked: new Date().toISOString(), lastCheckStatus: 'error' as const, lastError: (err instanceof Error ? err.message : String(err)).slice(0, 240) },
        historyEntry: null,
        hadError: true,
      };
    }
  });

  const changed = refreshResults.filter((r) => r.previousRank !== r.trackedKeyword.lastRank).length;
  const failed = refreshResults.filter((r) => r.hadError).length;

  return {
    checked: refreshResults.length,
    changed,
    failed,
    nextState: {
      trackedKeywords: refreshResults.map((r) => r.trackedKeyword),
      rankHistory: mergeRankHistory(state.rankHistory, refreshResults.flatMap((r) => (r.historyEntry ? [r.historyEntry] : []))),
      schedule: { ...state.schedule, lastRunAt: new Date().toISOString(), lastRunKey: runKey, timezone: GLOBAL_TRACKING_TIMEZONE },
    },
  };
}

async function refreshUserTrackingDaily(state: TrackingState, runKey: string) {
  return refreshSharedAllTrackingState(
    state,
    {
      rankingDepth: TRACKED_KEYWORD_RANKING_DEPTH,
      getKeywordRank: (keyword, appId, storeType, country) =>
        getKeywordRank(keyword, appId, storeType, country),
      normalizeTrackedKeywordError: (error) =>
        (error instanceof Error ? error.message : String(error)).slice(0, 240),
      normalizeCompetitorTrackedKeywordError: (error) =>
        (error instanceof Error ? error.message : String(error)).slice(0, 240),
    },
    {
      updateScheduleMetadata: true,
      runKey,
    },
  );
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

async function main() {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const runKey = getGlobalRunKey(new Date());

  log(`=== Rank Analyzer Pro Daily Tracking Job starting. RunKey: ${runKey} ===`);

  let db: ReturnType<typeof initFirebaseAdmin>;
  try {
    db = initFirebaseAdmin();
    log('✓ Firebase Admin initialized');
  } catch (err) {
    console.error('Firebase Admin init failed:', err);
    await sendCronFailureEmail({
      runKey,
      trigger: 'automatic',
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }

  const statusRef = db.doc('system/dailyTracking');
  const lease = await acquireDailyTrackingLease(
    statusRef,
    {
      runKey,
      ownerId: DAILY_TRACKING_LEASE_OWNER,
      trigger: 'automatic',
    },
  );
  if (!lease.acquired) {
    const summary = readDailyTrackingSummaryFromStatus(lease.statusData);
    log(`=== Daily tracking job skipped: ${lease.reason} for ${runKey}. scanned=${summary.scanned}, ran=${summary.ran}, checked=${summary.checked}, failed=${summary.failed}, asoFailed=${summary.asoFailed} ===`);
    process.exit(0);
  }

  let totalScanned = 0;
  let totalRan = 0;
  let totalChecked = 0;
  let totalChanged = 0;
  let totalFailed = 0;
  let totalAsoChecked = 0;
  let totalAsoChanged = 0;
  let totalAsoFailed = 0;

  try {
    const snapshot = await db.collection('users').get();
    totalScanned = snapshot.size;
    log(`Found ${totalScanned} user(s) in Firestore`);

    for (const userDoc of snapshot.docs) {
      await refreshDailyTrackingLease(statusRef, DAILY_TRACKING_LEASE_OWNER);
      const data = userDoc.data();
      const trackedKeywords = sanitizeTrackedKeywords(data?.trackedKeywords);
      const competitorTrackedKeywords = sanitizeCompetitorTrackedKeywords(data?.competitorTrackedKeywords);
      const competitorGroups = sanitizeCompetitorGroups(data?.competitorGroups);
      const competitorAsoLatestSnapshots = sanitizeCompetitorAsoLatestSnapshots(
        data?.competitorAsoLatestSnapshots,
      );
      const alertRules = normalizeAlertRules(data?.alertRules);
      const notificationSettings = normalizeNotificationSettings(data?.notificationSettings);
      if (!trackedKeywords.length && !competitorTrackedKeywords.length && !competitorGroups.length) continue;

      const state: TrackingState = {
        trackedKeywords,
        rankHistory: sanitizeRankHistory(data?.rankHistory),
        competitorTrackedKeywords,
        competitorRankHistory: sanitizeCompetitorRankHistory(data?.competitorRankHistory),
        competitorGroups,
        competitorAsoLatestSnapshots,
        alertRules,
        notificationSettings,
        schedule: normalizeSharedTrackingSchedule(data?.trackingSchedule, {
          enabled: true,
          time: DEFAULT_GLOBAL_TRACKING_TIME,
          timezone: GLOBAL_TRACKING_TIMEZONE,
        }),
      };
      if (!shouldRunTrackingRefresh(state.schedule, { hasTrackedData: true, runKey })) {
        log(`  → User ${userDoc.id}: already ran for ${runKey}, skipping`);
        continue;
      }

      log(`  → User ${userDoc.id}: refreshing ${trackedKeywords.length} keyword(s)...`);
      const result = await refreshUserTrackingDaily(state, runKey);
      const { updatedRules: updatedAlertRules } = await evaluateAndDispatchAlertRules(
        userDoc.ref,
        state.trackedKeywords,
        result.nextState.trackedKeywords,
        state.alertRules,
        state.notificationSettings,
        runKey,
      );
      const asoResult = await captureCompetitorAsoState(
        userDoc.ref,
        {
          competitorGroups: state.competitorGroups,
          competitorTrackedKeywords: result.nextState.competitorTrackedKeywords,
          competitorAsoLatestSnapshots: state.competitorAsoLatestSnapshots,
          alertRules: updatedAlertRules,
          notificationSettings: state.notificationSettings,
        },
        runKey,
      );
      const retainedRankHistory = await archiveAndTrimTrackedRankHistory(
        userDoc.ref,
        result.nextState.rankHistory,
      );
      const retainedCompetitorRankHistory = await archiveAndTrimCompetitorRankHistory(
        userDoc.ref,
        result.nextState.competitorRankHistory,
      );

      const updatePayload: UserTrackingDocument = {
        trackedKeywords: result.nextState.trackedKeywords,
        rankHistory: retainedRankHistory,
        competitorTrackedKeywords: result.nextState.competitorTrackedKeywords,
        competitorRankHistory: retainedCompetitorRankHistory,
        competitorGroups: state.competitorGroups,
        competitorAsoLatestSnapshots: asoResult.nextLatestSnapshots,
        alertRules: updatedAlertRules,
        trackingSchedule: result.nextState.schedule,
        updatedAt: new Date().toISOString(),
      };

      await userDoc.ref.set(updatePayload, { merge: true });

      totalRan += 1;
      totalChecked += result.checked;
      totalChanged += result.changed;
      totalFailed += result.failed;
      totalAsoChecked += asoResult.checked;
      totalAsoChanged += asoResult.changed;
      totalAsoFailed += asoResult.failed;

      log(`  ✓ User ${userDoc.id}: checked=${result.checked}, changed=${result.changed}, failed=${result.failed}`);

      /* Legacy summary email path retired in favor of rule-based alert emails.
      if (false && result.changed > 0 && resend) {
        try {
          const authUser = await getAuth().getUser(userDoc.id);
          if (authUser.email) {
            log(`  → Sending daily tracking email alert to ${authUser.email}...`);
            await resend.emails.send({
              from: `Rank Analyzer Pro <${RESEND_FROM_EMAIL}>`,
              to: authUser.email,
              subject: 'Your Daily ASO Ranks Have Moved! 📈',
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                  <h2 style="color: #0f172a;">Daily Rank Update</h2>
                  <p>We just finished tracking your keywords! Here is your summary for today:</p>
                  <ul style="background: #f8fafc; padding: 20px; border-radius: 8px;">
                    <li><strong>Total Keywords Checked:</strong> ${result.checked}</li>
                    <li><strong>Ranks Moved:</strong> ${result.changed}</li>
                  </ul>
                  <p>Log into your workspace to see the exact rank movements and update your strategy.</p>
                  <a href="https://rankanalyzerpro.com" style="display: inline-block; padding: 12px 24px; background: #3b82f6; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">View My Dashboard</a>
                  <p style="margin-top: 30px; font-size: 12px; color: #64748b;">You are receiving this email because you have daily tracking enabled for your Rank Analyzer Pro workspace.</p>
                </div>
              `
            });
            log(`  ✓ Email sent to ${authUser.email}`);
          }
        } catch (emailErr) {
          log(`  ✗ Failed to send email to user ${userDoc.id}: ${emailErr instanceof Error ? emailErr.message : String(emailErr)}`);
        }
      }*/
    }

    const durationMs = Date.now() - startMs;
    const finishedAt = new Date().toISOString();
    const summary: DailyTrackingSummary = {
      scanned: totalScanned,
      ran: totalRan,
      checked: totalChecked,
      changed: totalChanged,
      failed: totalFailed,
      asoChecked: totalAsoChecked,
      asoChanged: totalAsoChanged,
      asoFailed: totalAsoFailed,
    };
    const finalStatus = getDailyTrackingFinalStatus(summary);

    await statusRef.set({
      lastStartedAt: startedAt,
      lastFinishedAt: finishedAt,
      lastStatus: finalStatus,
      runKey,
      scanned: totalScanned,
      ran: totalRan,
      checked: totalChecked,
      changed: totalChanged,
      failed: totalFailed,
      asoChecked: totalAsoChecked,
      asoChanged: totalAsoChanged,
      asoFailed: totalAsoFailed,
      durationMs,
      error: FieldValue.delete(),
      watchdogRetryEligible: finalStatus === 'partial'
        ? shouldRetryPartialDailyTracking(summary)
        : false,
      leaseOwner: FieldValue.delete(),
      leaseExpiresAt: FieldValue.delete(),
    }, { merge: true });

    log(`=== Job complete in ${(durationMs / 1000).toFixed(1)}s: scanned=${totalScanned}, ran=${totalRan}, checked=${totalChecked}, changed=${totalChanged}, failed=${totalFailed}, asoChecked=${totalAsoChecked}, asoChanged=${totalAsoChanged}, asoFailed=${totalAsoFailed} ===`);
    process.exit(0);
  } catch (err) {
    const durationMs = Date.now() - startMs;
    console.error('✗ Job failed:', err);
    const finishedAt = new Date().toISOString();
    const errorMessage = err instanceof Error ? err.message : String(err);
    await statusRef.set({
      lastFinishedAt: finishedAt,
      lastStatus: 'error',
      durationMs,
      error: errorMessage,
      watchdogRetryEligible: true,
      leaseOwner: FieldValue.delete(),
      leaseExpiresAt: FieldValue.delete(),
    }, { merge: true }).catch(() => {});
    await sendCronFailureEmail({
      runKey,
      trigger: 'automatic',
      startedAt,
      finishedAt,
      durationMs,
      errorMessage,
    });
    process.exit(1);
  }
}

main();
