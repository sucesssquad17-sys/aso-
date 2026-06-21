import 'dotenv/config';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import DodoPayments from 'dodopayments';
import express from 'express';
import type { Server } from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import * as gplayModule from 'google-play-scraper';
import store from 'app-store-scraper';
import NodeCache from 'node-cache';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { Resend } from 'resend';
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp as initializeAdminApp,
  type App as FirebaseAdminApp,
} from 'firebase-admin/app';
import {
  getAuth as getFirebaseAdminAuth,
  type Auth as FirebaseAdminAuth,
  type DecodedIdToken,
} from 'firebase-admin/auth';
import {
  getMessaging as getFirebaseAdminMessaging,
  type Messaging as FirebaseAdminMessaging,
} from 'firebase-admin/messaging';
import {
  type CollectionReference,
  FieldValue,
  getFirestore as getAdminFirestore,
  type DocumentData,
  type DocumentReference,
  type Firestore,
} from 'firebase-admin/firestore';
import {
  getGlobalTrackingRunKey as getSharedGlobalTrackingRunKey,
  getZonedDateParts as getSharedZonedDateParts,
  initializeFirebaseAdminAppFromEnv,
  isGlobalTrackingRunTime as isSharedGlobalTrackingRunTime,
  mergeRankHistory as mergeSharedRankHistory,
  normalizeTrackingSchedule as normalizeSharedTrackingSchedule,
  refreshAllTrackingState as refreshSharedAllTrackingState,
  refreshTrackedKeywordRecord as refreshSharedTrackedKeywordRecord,
  TRACKING_HISTORY_LIMIT as SHARED_TRACKING_HISTORY_LIMIT,
} from './src/lib/backendTracking';
import {
  DEFAULT_GLOBAL_TRACKING_TIME,
  GLOBAL_TRACKING_TIMEZONE,
} from './src/lib/trackingTime';
import {
  DAILY_TRACKING_LEASE_TTL_MINUTES,
  getDailyTrackingFinalStatus,
  getEmptyDailyTrackingSummary,
  shouldRetryPartialDailyTracking,
  type DailyTrackingSummary,
} from './src/lib/dailyTracking';
import {
  BILLING_PLAN_LIMITS,
  TRACKED_KEYWORD_LEGACY_CREATED_AT,
  countPlanUsage,
  getBillingPlanRank,
  getCompetitorTrackedKeywordIdentityKey,
  getPlanLimits,
  getTrackedAppIdentityKey,
  getTrackedKeywordActivity,
  getTrackedKeywordIdentityKey,
  resolveBillingPlanId,
  type PlanLimits,
} from './src/lib/planLimits';
import { COUNTRY_CODE_SET, normalizeCountryCode } from './src/lib/countries';
import {
  ALERT_CONDITION_LABELS,
  type AlertCondition,
  type AlertConditionType,
  type AlertEvent,
  type AlertRule,
  type NotificationSettings,
  normalizeAlertCondition,
  normalizeAlertRules,
  normalizeNotificationSettings,
} from './src/lib/alerts';
import {
  findChartCategory,
  getChartCategoryOptions,
  type ChartCategoryOption,
  type ChartEntry,
  type ChartType,
} from './src/lib/categoryCharts';
import {
  clamp,
  HIGH_VOLUME_TERMS,
  addTokenWeights,
  addWeightedTerm,
  collectTitleSegments,
  deriveCategoryHints,
  extractKeywordFeatures,
  getSortedCandidateTerms,
  normalizeKeyword,
  scoreKeywordMetrics,
  tokenize,
  type KeywordContext,
  type KeywordMarketSample,
} from './src/lib/keywordMetrics';

if (process.env.NODE_ENV !== 'production') {
  process.env.DISABLE_HMR = 'true';
}

// Discovery cache reuses analyzed app results for up to 12 hours.
const rankingCache = new NodeCache({ stdTTL: 14400 });
const keywordSourceCache = new NodeCache({ stdTTL: 14400 });
const keywordMarketCache = new NodeCache({ stdTTL: 14400, useClones: false });
const searchCache = new NodeCache({ stdTTL: 3600, useClones: false });
const appDetailsCache = new NodeCache({ stdTTL: 86400, useClones: false });
const discoveryCache = new NodeCache({ stdTTL: 43200, useClones: false });
const chartCache = new NodeCache({ stdTTL: 900, useClones: false });
const upstreamFailureCache = new NodeCache({ useClones: false });
const dodoWebhookEventCache = new NodeCache({ stdTTL: 60 * 60 * 24, useClones: false });
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'updates@rankanalyzerpro.com';
const CRON_FAILURE_EMAIL_RECIPIENTS = (process.env.CRON_FAILURE_EMAIL || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const ALERT_EMAIL_APP_URL = process.env.APP_URL?.trim() || 'https://rankanalyzerpro.com';
const PLAY_STORE_FETCH_TIMEOUT_MS = 30000;
const UPSTREAM_REQUEST_TIMEOUT_MS = 30000;
const UPSTREAM_FAILURE_CACHE_TTL_SECONDS = 15;
const RANKING_FETCH_TIMEOUT_MS = 20000;
const DISCOVERY_CACHE_VERSION = 'v16';
const GLOBAL_TRACKING_WATCHDOG_DELAY_MINUTES = 60;
const GLOBAL_TRACKING_UTC_OFFSET_MINUTES = 330;
const DAILY_TRACKING_LEASE_OWNER = `service:${process.pid}:${crypto.randomUUID()}`;

type StoreType = 'android' | 'ios';
type DiscoveryMode = 'fast' | 'deep';
type AppPopularitySample = {
  popularity: number;
  hasDetail: boolean;
  publisher: string;
  category: string;
  title: string;
};
type TrackedKeywordStatus = 'pending' | 'ok' | 'not_ranked' | 'error';
type CompetitorGroupAppRole = 'own' | 'competitor';
type TrackedKeywordRecord = {
  groupId: string;
  keyword: string;
  appId: string;
  appTitle: string;
  store: StoreType;
  country: string;
  createdAt?: string;
  lastRank: number;
  lastChecked: string;
  lastCheckStatus?: TrackedKeywordStatus;
  lastError?: string;
};
type AppBookmark = {
  appId: string;
  id?: number;
  title: string;
  icon: string;
  developer: string;
  store: StoreType;
  country: string;
  url?: string;
};
type CompetitorGroupAppRecord = {
  appKey: string;
  appId: string;
  store: StoreType;
  role: CompetitorGroupAppRole;
  title: string;
  developer: string;
  icon: string;
  url?: string;
  category?: string;
};
type CompetitorTrackedKeywordAppRecord = CompetitorGroupAppRecord & {
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
type RankHistoryRecord = {
  groupId?: string;
  appId: string;
  keyword: string;
  store: StoreType;
  country: string;
  rank: number;
  timestamp: string;
  rankDepth?: number;
  isSimulated?: boolean;
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
type TrackingSchedule = {
  enabled: boolean;
  time: string;
  timezone: string;
  lastRunAt?: string;
  lastRunKey?: string;
};
type AuthEventProvider = 'google';
type AuthEventFlow = 'popup' | 'redirect';
type AuthEventPhase = 'start' | 'success' | 'error';
type BillingProvider = 'dodo';
type BillingPlanId = 'free' | 'indie' | 'starter' | 'pro' | 'agency';
type BillingInterval = 'monthly' | 'yearly';
type BillingSubscriptionStatus = 'pending' | 'active' | 'on_hold' | 'cancelled' | 'failed' | 'expired';
type BillingAccessState = 'selection_required' | 'activating' | 'active';
type PaidBillingPlanId = Exclude<BillingPlanId, 'free' | 'agency'>;
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
type CompetitorGroupSnapshotRecord = {
  snapshotId: string;
  groupId: string;
  store: StoreType;
  country: string;
  mode: DiscoveryMode;
  loadedAt: string;
  appInsights?: unknown[];
  sharedBattles?: unknown[];
  gapOpportunities?: unknown[];
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
type TrackingState = {
  trackedKeywords: TrackedKeywordRecord[];
  rankHistory: RankHistoryRecord[];
  competitorTrackedKeywords: CompetitorTrackedKeywordRecord[];
  competitorRankHistory: CompetitorRankHistoryRecord[];
  competitorGroups: CompetitorGroupRecord[];
  competitorGroupSnapshots: CompetitorGroupSnapshotRecord[];
  competitorAsoLatestSnapshots: CompetitorAsoSnapshotRecord[];
  schedule: TrackingSchedule;
};
type TrackedAppKind = 'own' | 'competitor';
type TrackedAppSource = 'manual' | 'compare' | 'discovery';
type TrackedAppRecord = {
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
};
type AppAnalysisSnapshot = {
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
  strongestKeyword?: {
    keyword: string;
    rank: number;
  };
  bestSuggestion?: {
    keyword: string;
    volume?: number;
    difficulty?: number;
    relevance?: number;
  };
  rankedKeywords: string[];
  suggestedKeywords: string[];
};
type UserTrackingDocument = {
  bookmarks?: AppBookmark[];
  trackedApps?: TrackedAppRecord[];
  trackedKeywords?: TrackedKeywordRecord[];
  rankHistory?: RankHistoryRecord[];
  appAnalysisSnapshots?: AppAnalysisSnapshot[];
  competitorGroups?: CompetitorGroupRecord[];
  competitorGroupSnapshots?: CompetitorGroupSnapshotRecord[];
  competitorAsoLatestSnapshots?: CompetitorAsoSnapshotRecord[];
  competitorTrackedKeywords?: CompetitorTrackedKeywordRecord[];
  competitorRankHistory?: CompetitorRankHistoryRecord[];
  trackingSchedule?: TrackingSchedule;
  alertRules?: AlertRule[];
  notificationSettings?: NotificationSettings;
  billingProvider?: BillingProvider;
  billingEmail?: string;
  dodoCustomerId?: string;
  dodoSubscriptionId?: string;
  dodoProductId?: string;
  subscriptionTier?: string;
  subscriptionInterval?: BillingInterval;
  isPremium?: boolean;
  paypalSubscriptionId?: string;
  paypalPlanId?: string;
  subscriptionStatus?: BillingSubscriptionStatus;
  pendingPlanId?: BillingPlanId;
  pendingInterval?: BillingInterval;
  subscriptionCurrentPeriodEnd?: string;
  subscriptionCancelAtPeriodEnd?: boolean;
  subscriptionUpdatedAt?: string;
  billingReviewRequired?: boolean;
  billingReviewReason?: string;
  accountStatus?: 'active' | 'deleted';
  deletedAt?: string;
  authDeletedAt?: string;
  legalAcceptedAt?: string;
  legalVersion?: string;
  migratedFromLocalAt?: string;
  updatedAt?: string;
};
type NormalizedUserTrackingDocument = TrackingState & {
  bookmarks: AppBookmark[];
  trackedApps: TrackedAppRecord[];
  appAnalysisSnapshots: AppAnalysisSnapshot[];
  alertRules: AlertRule[];
  notificationSettings: NotificationSettings;
  legalAcceptedAt?: string;
  legalVersion?: string;
  migratedFromLocalAt?: string;
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
type DodoEnvironment = 'test_mode' | 'live_mode';
type DodoSubscriptionEventType =
  | 'subscription.active'
  | 'subscription.updated'
  | 'subscription.on_hold'
  | 'subscription.renewed'
  | 'subscription.plan_changed'
  | 'subscription.cancelled'
  | 'subscription.failed'
  | 'subscription.expired';
type BillingProductSelection = {
  planId: Exclude<BillingPlanId, 'free' | 'agency'>;
  interval: BillingInterval;
  productId: string;
};
type DodoWebhookHeaders = {
  'webhook-id': string;
  'webhook-signature': string;
  'webhook-timestamp': string;
};
type PublicFirebaseClientConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
};
type DodoSubscriptionPayload = {
  cancel_at_next_billing_date?: boolean;
  customer?: {
    customer_id?: string;
    email?: string | null;
  };
  metadata?: Record<string, string>;
  next_billing_date?: string | null;
  product_id?: string;
  status?: BillingSubscriptionStatus;
  subscription_id?: string;
};
type DodoSubscriptionWebhookEvent = {
  type: DodoSubscriptionEventType;
  data: DodoSubscriptionPayload;
};

type DiscoveryProfile = {
  keywordLimit: number;
  batchSize: number;
  earlyExitRankings: number | null;
  minCheckedKeywords: number;
  searchDepth: number;
  competitorSeedLimit: number;
  competitorResultsPerSeed: number;
  competitorTermLimit: number;
  finalRankingLimit: number;
};

const DISCOVERY_PROFILES: Record<DiscoveryMode, DiscoveryProfile> = {
  fast: {
    keywordLimit: 40,
    batchSize: 12,
    earlyExitRankings: 10,
    minCheckedKeywords: 0,
    searchDepth: 100,
    competitorSeedLimit: 3,
    competitorResultsPerSeed: 12,
    competitorTermLimit: 40,
    finalRankingLimit: 10,
  },
  deep: {
    keywordLimit: 80,
    batchSize: 10,
    earlyExitRankings: 20,
    minCheckedKeywords: 0,
    searchDepth: 150,
    competitorSeedLimit: 5,
    competitorResultsPerSeed: 16,
    competitorTermLimit: 72,
    finalRankingLimit: 20,
  },
};
const TRACKING_STATE_FILE = path.join(process.cwd(), 'data', 'tracking-state.json');
const TRACKING_HISTORY_LIMIT = 5000;
const EMBEDDED_TRACKING_HISTORY_LIMIT = 1200;
const USER_RANK_HISTORY_ARCHIVE_COLLECTION = 'rank_history';
const USER_COMPETITOR_RANK_HISTORY_ARCHIVE_COLLECTION = 'competitor_rank_history';
const USER_ALERT_EVENTS_COLLECTION = 'alert_events';
const USER_COMPETITOR_ASO_DIFFS_COLLECTION = 'competitor_aso_diffs';
const USER_PUSH_TOKENS_COLLECTION = 'push_tokens';
const TRACKING_REFRESH_CONCURRENCY = 1;
const DEFAULT_RANKING_DEPTH = 100;
const TRACKED_KEYWORD_RANKING_DEPTH = 100;
const MAX_RANKING_DEPTH = 100;
const GLOBAL_TRACKING_HOURS = [9] as const;
const DEFAULT_TRACKING_SCHEDULE: TrackingSchedule = {
  enabled: false,
  time: DEFAULT_GLOBAL_TRACKING_TIME,
  timezone: GLOBAL_TRACKING_TIMEZONE,
};
const GLOBAL_TRACKING_WATCHDOG_RETRY_INTERVAL_MINUTES = 60;
const GLOBAL_TRACKING_WATCHDOG_RUNNING_GRACE_MINUTES = 120;

let trackingStateCache: TrackingState | null = null;
let trackingStateWriteQueue = Promise.resolve();
let scheduledTrackingRunPromise: Promise<{ checked: number; changed: number; failed?: number }> | null = null;
let userTrackingSchedulerPromise: Promise<DailyTrackingSummary> | null = null;
let firebaseAdminApp: FirebaseAdminApp | null = null;
let firebaseAdminDb: Firestore | null = null;
let firebaseAdminAuth: FirebaseAdminAuth | null = null;
let firebaseAdminMessaging: FirebaseAdminMessaging | null = null;
let firebaseAdminInitAttempted = false;
let dodoClient: DodoPayments | null = null;

type GooglePlayScraper = {
  search: (options: { term: string; country: string; num: number; requestOptions?: { timeout?: number } }) => Promise<any[]>;
  app: (options: { appId: string; country: string; requestOptions?: { timeout?: number } }) => Promise<any>;
  list: (options: {
    collection?: string;
    category?: string;
    num?: number;
    lang?: string;
    country?: string;
    fullDetail?: boolean;
    requestOptions?: { timeout?: number };
  }) => Promise<any[]>;
  category?: Record<string, string>;
  collection?: Record<string, string>;
};
type StoreRequestOptions = {
  timeout?: number;
  agent?: {
    http?: HttpsProxyAgent<string>;
    https?: HttpsProxyAgent<string>;
  };
  proxy?: string;
};
type StoreSearchResult = {
  appId?: string | number;
  id?: string | number;
  trackId?: string | number;
  title?: string;
  trackName?: string;
  name?: string;
  developer?: string;
  developerName?: string;
  artistName?: string;
  sellerName?: string;
  developerId?: string;
  summary?: string;
  description?: string;
  primaryGenre?: string;
  primaryGenreName?: string;
  genre?: string;
  genreId?: string;
  category?: string;
  score?: number;
  icon?: string;
  iconURL?: string;
  artworkUrl100?: string;
  artworkUrl512?: string;
  url?: string;
  trackViewUrl?: string;
  installs?: string;
  minInstalls?: number;
  maxInstalls?: string | number;
  ratings?: number;
  reviews?: number;
  histogram?: number[];
};
type DodoWebhookBillingMetadata = {
  planId: PaidBillingPlanId | null;
  interval: BillingInterval | null;
  hasPlanIdMetadata: boolean;
  hasIntervalMetadata: boolean;
};

type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'CONFIGURATION_ERROR'
  | 'UPSTREAM_TIMEOUT'
  | 'UPSTREAM_UNAVAILABLE'
  | 'INTERNAL_ERROR';
type CachedApiFailure = {
  message: string;
  status: number;
  code: ApiErrorCode;
  retryable: boolean;
};

class ApiError extends Error {
  status: number;
  code: ApiErrorCode;
  retryable: boolean;

  constructor(
    message: string,
    options: {
      status: number;
      code: ApiErrorCode;
      retryable: boolean;
    },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.retryable = options.retryable;
  }
}

function resolveGooglePlayScraper(mod: any): GooglePlayScraper {
  if (mod?.search && mod?.app) {
    return mod as GooglePlayScraper;
  }

  if (mod?.default) {
    return resolveGooglePlayScraper(mod.default);
  }

  throw new Error('Unable to resolve google-play-scraper module shape');
}

const gplay = resolveGooglePlayScraper(gplayModule);

let proxyAgent: HttpsProxyAgent<string> | undefined = undefined;
let proxyUrlString: string | undefined = undefined;
if (process.env.PROXY_HOST && process.env.PROXY_PORT) {
  const auth = process.env.PROXY_USERNAME && process.env.PROXY_PASSWORD 
    ? `${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}@` 
    : '';
  proxyUrlString = `http://${auth}${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`;
  proxyAgent = new HttpsProxyAgent(proxyUrlString);
  console.log(`[Proxy] Configured HttpsProxyAgent with host: ${process.env.PROXY_HOST}`);
}

const googlePlayDirectRequestOptions: StoreRequestOptions = {
  timeout: PLAY_STORE_FETCH_TIMEOUT_MS,
};
const googlePlayProxyRequestOptions: StoreRequestOptions = {
  timeout: PLAY_STORE_FETCH_TIMEOUT_MS,
};
const appStoreRequestOptions: StoreRequestOptions = {
  timeout: PLAY_STORE_FETCH_TIMEOUT_MS,
};

if (proxyAgent && proxyUrlString) {
  googlePlayProxyRequestOptions.agent = {
    http: proxyAgent,
    https: proxyAgent
  };
  appStoreRequestOptions.proxy = proxyUrlString;
}

const googlePlayDefaultRequestOptions = googlePlayProxyRequestOptions.agent
  ? googlePlayProxyRequestOptions
  : googlePlayDirectRequestOptions;

function getFirebaseAdminApp() {
  if (firebaseAdminApp) {
    return firebaseAdminApp;
  }
  if (firebaseAdminInitAttempted) {
    return null;
  }

  firebaseAdminInitAttempted = true;

  try {
    firebaseAdminApp = initializeFirebaseAdminAppFromEnv();
    return firebaseAdminApp;
  } catch (error) {
    console.warn(
      'Firebase Admin initialization failed. Automatic per-user tracking is disabled until server credentials are configured.',
      error,
    );
    return null;
  }
}

function getFirebaseAdminDb() {
  if (firebaseAdminDb) {
    return firebaseAdminDb;
  }

  const adminApp = getFirebaseAdminApp();
  if (!adminApp) {
    return null;
  }

  firebaseAdminDb = getAdminFirestore(adminApp);
  firebaseAdminDb.settings({ ignoreUndefinedProperties: true });
  return firebaseAdminDb;
}

function getFirebaseAdminAuthClient() {
  if (firebaseAdminAuth) {
    return firebaseAdminAuth;
  }

  const adminApp = getFirebaseAdminApp();
  if (!adminApp) {
    return null;
  }

  firebaseAdminAuth = getFirebaseAdminAuth(adminApp);
  return firebaseAdminAuth;
}

function getFirebaseAdminMessagingClient() {
  if (firebaseAdminMessaging) {
    return firebaseAdminMessaging;
  }

  const adminApp = getFirebaseAdminApp();
  if (!adminApp) {
    return null;
  }

  firebaseAdminMessaging = getFirebaseAdminMessaging(adminApp);
  return firebaseAdminMessaging;
}

function normalizeDodoEnvironment(rawValue?: string): DodoEnvironment {
  const normalized = rawValue?.trim().toLowerCase();
  return normalized === 'live' || normalized === 'live_mode' ? 'live_mode' : 'test_mode';
}

function getDodoApiKey() {
  return process.env.DODO_API_KEY?.trim() || process.env.DODO_PAYMENTS_API_KEY?.trim() || '';
}

function getDodoWebhookKey() {
  return process.env.DODO_WEBHOOK_SECRET?.trim() || process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim() || '';
}

const REQUIRED_FIREBASE_RUNTIME_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

function readPublicFirebaseClientConfig(): PublicFirebaseClientConfig {
  return {
    apiKey: process.env.VITE_FIREBASE_API_KEY?.trim() || undefined,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || undefined,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID?.trim() || undefined,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() || undefined,
    messagingSenderId:
      process.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() || undefined,
    appId: process.env.VITE_FIREBASE_APP_ID?.trim() || undefined,
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID?.trim() || undefined,
    firestoreDatabaseId:
      process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID?.trim() || undefined,
  };
}

function getMissingPublicFirebaseConfigKeys(
  config: PublicFirebaseClientConfig,
) {
  return REQUIRED_FIREBASE_RUNTIME_ENV_KEYS.filter((key) => {
    switch (key) {
      case 'VITE_FIREBASE_API_KEY':
        return !config.apiKey;
      case 'VITE_FIREBASE_AUTH_DOMAIN':
        return !config.authDomain;
      case 'VITE_FIREBASE_PROJECT_ID':
        return !config.projectId;
      case 'VITE_FIREBASE_STORAGE_BUCKET':
        return !config.storageBucket;
      case 'VITE_FIREBASE_MESSAGING_SENDER_ID':
        return !config.messagingSenderId;
      case 'VITE_FIREBASE_APP_ID':
        return !config.appId;
      default:
        return true;
    }
  });
}

function isDeletedUserTrackingDocument(
  data:
    | Pick<UserTrackingDocument, 'accountStatus'>
    | null
    | undefined,
) {
  return data?.accountStatus === 'deleted';
}

function getConfiguredDodoProductIdsByPlan() {
  return {
    indie: {
      monthly: process.env.DODO_PRODUCT_ID_INDIE?.trim() || '',
      yearly: process.env.DODO_PRODUCT_ID_INDIE_YEARLY?.trim() || '',
    },
    starter: {
      monthly:
        process.env.DODO_PRODUCT_ID_STARTER?.trim() || process.env.DODO_PRODUCT_ID?.trim() || '',
      yearly: process.env.DODO_PRODUCT_ID_STARTER_YEARLY?.trim() || '',
    },
    pro: {
      monthly: process.env.DODO_PRODUCT_ID_PRO?.trim() || '',
      yearly: process.env.DODO_PRODUCT_ID_PRO_YEARLY?.trim() || '',
    },
  } satisfies Record<PaidBillingPlanId, Record<BillingInterval, string>>;
}

function getConfiguredBillingPlans(): BillingPlanId[] {
  const productIds = getConfiguredDodoProductIdsByPlan();
  return [
    ...(productIds.indie.monthly || productIds.indie.yearly ? (['indie'] as const) : []),
    ...(productIds.starter.monthly || productIds.starter.yearly ? (['starter'] as const) : []),
    ...(productIds.pro.monthly || productIds.pro.yearly ? (['pro'] as const) : []),
    'agency',
  ];
}

function getConfiguredBillingIntervals() {
  const productIds = getConfiguredDodoProductIdsByPlan();
  const intervals = new Set<BillingInterval>();

  for (const planProducts of Object.values(productIds)) {
    if (planProducts.monthly) {
      intervals.add('monthly');
    }
    if (planProducts.yearly) {
      intervals.add('yearly');
    }
  }

  return Array.from(intervals);
}

function getConfiguredBillingPlanIntervals() {
  const productIds = getConfiguredDodoProductIdsByPlan();
  return {
    indie: [
      ...(productIds.indie.monthly ? (['monthly'] as const) : []),
      ...(productIds.indie.yearly ? (['yearly'] as const) : []),
    ],
    starter: [
      ...(productIds.starter.monthly ? (['monthly'] as const) : []),
      ...(productIds.starter.yearly ? (['yearly'] as const) : []),
    ],
    pro: [
      ...(productIds.pro.monthly ? (['monthly'] as const) : []),
      ...(productIds.pro.yearly ? (['yearly'] as const) : []),
    ],
  } satisfies Record<PaidBillingPlanId, BillingInterval[]>;
}

function resolveBillingProductSelection(
  productId?: string | null,
): BillingProductSelection | null {
  if (!productId) {
    return null;
  }

  const productIds = getConfiguredDodoProductIdsByPlan();

  for (const planId of Object.keys(productIds) as Array<keyof typeof productIds>) {
    const planProducts = productIds[planId];
    for (const interval of ['monthly', 'yearly'] as const) {
      if (productId === planProducts[interval]) {
        return { planId, interval, productId };
      }
    }
  }

  return null;
}

function resolvePlanIdFromProductId(productId?: string | null): BillingPlanId | null {
  return resolveBillingProductSelection(productId)?.planId || null;
}

function readBillingPlanId(value: unknown): BillingPlanId {
  if (
    value === 'free' ||
    value === 'indie' ||
    value === 'starter' ||
    value === 'pro' ||
    value === 'agency'
  ) {
    return value;
  }

  throw createBadRequestError('A valid billing plan is required.');
}

function readBillingInterval(value: unknown): BillingInterval {
  if (value === 'yearly') {
    return 'yearly';
  }

  if (value === 'monthly' || value == null || value === '') {
    return 'monthly';
  }

  throw createBadRequestError('A valid billing interval is required.');
}

function getDodoProductIdForPlan(planId: BillingPlanId, interval: BillingInterval) {
  const productIds = getConfiguredDodoProductIdsByPlan();
  if (planId === 'indie') {
    return productIds.indie[interval];
  }
  if (planId === 'starter') {
    return productIds.starter[interval];
  }
  if (planId === 'pro') {
    return productIds.pro[interval];
  }

  return '';
}

function getDodoClient() {
  if (dodoClient) {
    return dodoClient;
  }

  const bearerToken = getDodoApiKey();
  if (!bearerToken) {
    return null;
  }

  dodoClient = new DodoPayments({
    bearerToken,
    webhookKey: getDodoWebhookKey() || null,
    environment: normalizeDodoEnvironment(
      process.env.DODO_ENVIRONMENT || process.env.DODO_PAYMENTS_ENVIRONMENT,
    ),
  });
  return dodoClient;
}

function readProductPriceAmount(product: { price?: unknown }) {
  if (!product.price || typeof product.price !== 'object') {
    return null;
  }

  const price = product.price as {
    type?: string;
    price?: number;
    fixed_price?: number;
  };

  if (
    price.type === 'recurring_price' ||
    price.type === 'one_time_price'
  ) {
    // Dodo's SDK types document price values in the smallest currency unit
    // (for example cents for USD), so the formatter converts from minor units.
    return typeof price.price === 'number' ? price.price : null;
  }

  if (price.type === 'usage_based_price') {
    return typeof price.fixed_price === 'number' ? price.fixed_price : null;
  }

  return null;
}

function readProductCurrency(product: { price?: unknown }) {
  if (!product.price || typeof product.price !== 'object') {
    return null;
  }

  const currency = (product.price as { currency?: unknown }).currency;
  return typeof currency === 'string' && currency.trim()
    ? currency.trim().toUpperCase()
    : null;
}

function formatCurrencyAmount(amount: number, currency: string | null) {
  if (!currency) {
    return null;
  }

  try {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    });
    const fractionDigits = formatter.resolvedOptions().maximumFractionDigits;
    return formatter.format(amount / 10 ** fractionDigits);
  } catch {
    return `${amount} ${currency}`;
  }
}

function formatBillingCadence(product: { price?: unknown }) {
  if (!product.price || typeof product.price !== 'object') {
    return null;
  }

  const price = product.price as {
    payment_frequency_count?: number;
    payment_frequency_interval?: string;
  };
  const count = price.payment_frequency_count;
  const interval = price.payment_frequency_interval;
  if (!count || !interval) {
    return null;
  }

  if (count === 1 && interval === 'month') {
    return '/mo';
  }
  if ((count === 1 && interval === 'year') || (count === 12 && interval === 'month')) {
    return '/yr';
  }

  return ` every ${count} ${interval}${count === 1 ? '' : 's'}`;
}

async function loadConfiguredBillingPlanPricing(client: NonNullable<ReturnType<typeof getDodoClient>>) {
  const productIds = getConfiguredDodoProductIdsByPlan();
  const planPricing = {
    indie: {} as Partial<Record<BillingInterval, {
      productId: string;
      priceLabel: string | null;
      currency: string | null;
      amount: number | null;
      productName: string | null;
    }>>,
    starter: {} as Partial<Record<BillingInterval, {
      productId: string;
      priceLabel: string | null;
      currency: string | null;
      amount: number | null;
      productName: string | null;
    }>>,
    pro: {} as Partial<Record<BillingInterval, {
      productId: string;
      priceLabel: string | null;
      currency: string | null;
      amount: number | null;
      productName: string | null;
    }>>,
  };

  await Promise.all(
    (Object.entries(productIds) as Array<[keyof typeof productIds, (typeof productIds)[keyof typeof productIds]]>).flatMap(
      ([planId, intervals]) =>
        (Object.entries(intervals) as Array<[BillingInterval, string]>)
          .filter(([, productId]) => Boolean(productId))
          .map(async ([interval, productId]) => {
            try {
              const product = await client.products.retrieve(productId);
              const amount = readProductPriceAmount(product);
              const currency = readProductCurrency(product);
              const cadence = formatBillingCadence(product);
              const formattedAmount =
                amount != null ? formatCurrencyAmount(amount, currency) : null;

              planPricing[planId][interval] = {
                productId,
                amount,
                currency,
                productName: product.name?.trim() || null,
                priceLabel:
                  formattedAmount
                    ? `${formattedAmount}${cadence || ''}`
                    : null,
              };
            } catch (error) {
              console.warn(`[dodo] Failed to load product ${productId} for ${planId}/${interval}.`, error);
              planPricing[planId][interval] = {
                productId,
                amount: null,
                currency: null,
                productName: null,
                priceLabel: null,
              };
            }
          }),
    ),
  );

  return planPricing;
}

function readDodoWebhookHeaders(req: express.Request): DodoWebhookHeaders {
  const webhookId = req.header('webhook-id')?.trim();
  const webhookSignature = req.header('webhook-signature')?.trim();
  const webhookTimestamp = req.header('webhook-timestamp')?.trim();

  if (!webhookId || !webhookSignature || !webhookTimestamp) {
    throw createUnauthorizedError('Missing Dodo webhook signature headers.');
  }

  return {
    'webhook-id': webhookId,
    'webhook-signature': webhookSignature,
    'webhook-timestamp': webhookTimestamp,
  };
}

function isDodoSubscriptionWebhookEvent(event: unknown): event is DodoSubscriptionWebhookEvent {
  if (!event || typeof event !== 'object') {
    return false;
  }

  const candidate = event as Partial<DodoSubscriptionWebhookEvent>;
  if (
    candidate.type !== 'subscription.active' &&
    candidate.type !== 'subscription.updated' &&
    candidate.type !== 'subscription.on_hold' &&
    candidate.type !== 'subscription.renewed' &&
    candidate.type !== 'subscription.plan_changed' &&
    candidate.type !== 'subscription.cancelled' &&
    candidate.type !== 'subscription.failed' &&
    candidate.type !== 'subscription.expired'
  ) {
    return false;
  }

  return Boolean(candidate.data && typeof candidate.data === 'object');
}

function getBillingReturnUrl(req: express.Request) {
  const configuredAppUrl = process.env.APP_URL?.trim();
  const baseUrl = configuredAppUrl || `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
  return new URL('/?billing_return=1', baseUrl).toString();
}

async function resolveBillingUserDocument(
  adminDb: Firestore,
  event: DodoSubscriptionWebhookEvent,
) {
  const firebaseUid = event.data.metadata?.firebase_uid?.trim();
  if (firebaseUid) {
    const userDocRef = adminDb.collection('users').doc(firebaseUid);
    const userDoc = await userDocRef.get();
    if (userDoc.exists) {
      return userDocRef;
    }
  }

  const dodoCustomerId = event.data.customer?.customer_id?.trim();
  if (dodoCustomerId) {
    const customerMatch = await adminDb
      .collection('users')
      .where('dodoCustomerId', '==', dodoCustomerId)
      .limit(1)
      .get();
    if (!customerMatch.empty) {
      return customerMatch.docs[0].ref;
    }
  }

  const billingEmail = event.data.customer?.email?.trim().toLowerCase();
  if (billingEmail) {
    const emailMatch = await adminDb
      .collection('users')
      .where('billingEmail', '==', billingEmail)
      .limit(1)
      .get();
    if (!emailMatch.empty) {
      return emailMatch.docs[0].ref;
    }
  }

  return null;
}

function readWebhookBillingMetadata(
  event: DodoSubscriptionWebhookEvent,
): DodoWebhookBillingMetadata {
  const rawPlanId = event.data.metadata?.plan_id?.trim();
  const planId: PaidBillingPlanId | null =
    rawPlanId === 'indie' || rawPlanId === 'starter' || rawPlanId === 'pro'
      ? rawPlanId
      : null;
  const rawInterval = event.data.metadata?.billing_interval?.trim();
  const interval: BillingInterval | null =
    rawInterval === 'yearly'
      ? 'yearly'
      : rawInterval === 'monthly'
        ? 'monthly'
        : null;
  return {
    planId,
    interval,
    hasPlanIdMetadata: Boolean(rawPlanId),
    hasIntervalMetadata: Boolean(rawInterval),
  };
}

function resolveSubscriptionStatusFromWebhook(
  event: DodoSubscriptionWebhookEvent,
): BillingSubscriptionStatus {
  if (event.data.status) {
    return event.data.status;
  }

  switch (event.type) {
    case 'subscription.active':
    case 'subscription.renewed':
    case 'subscription.updated':
    case 'subscription.plan_changed':
      return 'active';
    case 'subscription.cancelled':
      return 'cancelled';
    case 'subscription.failed':
      return 'failed';
    case 'subscription.expired':
      return 'expired';
    case 'subscription.on_hold':
      return 'on_hold';
    default:
      return 'pending';
  }
}

async function applyDodoSubscriptionEvent(event: DodoSubscriptionWebhookEvent) {
  const adminDb = getFirebaseAdminDb();
  if (!adminDb) {
    throw createConfigurationError('Firebase Admin is not configured on the server.');
  }

  const userDocRef = await resolveBillingUserDocument(adminDb, event);
  if (!userDocRef) {
    console.warn(`[dodo] No matching user found for webhook ${event.type}.`);
    return;
  }
  const existingSnapshot = await userDocRef.get();
  const existingUserData = existingSnapshot.data() as UserTrackingDocument | undefined;
  const deletedAccount = isDeletedUserTrackingDocument(existingUserData);

  const productId = event.data.product_id?.trim() || '';
  const resolvedProductSelection = resolveBillingProductSelection(productId);
  const subscriptionStatus = resolveSubscriptionStatusFromWebhook(event);
  const metadata = readWebhookBillingMetadata(event);
  const metadataMatchesProductSelection =
    (!metadata.hasPlanIdMetadata ||
      resolvedProductSelection?.planId === metadata.planId) &&
    (!metadata.hasIntervalMetadata ||
      resolvedProductSelection?.interval === metadata.interval);
  const canGrantPaidPlan =
    subscriptionStatus === 'active' &&
    Boolean(resolvedProductSelection) &&
    metadataMatchesProductSelection &&
    !deletedAccount;
  const billingEmail = event.data.customer?.email?.trim().toLowerCase();
  const resolvedPlanId = canGrantPaidPlan
    ? resolvedProductSelection!.planId
    : 'free';
  const billingReviewReason =
    deletedAccount
      ? 'account_deleted'
      : subscriptionStatus === 'active' && !resolvedProductSelection
        ? 'unmatched_product_id'
        : subscriptionStatus === 'active' &&
            resolvedProductSelection &&
            !metadataMatchesProductSelection
          ? 'metadata_mismatch'
          : null;
  const billingReviewRequired = Boolean(billingReviewReason);

  if (subscriptionStatus === 'active' && !resolvedProductSelection) {
    console.warn(
      `[dodo] Active subscription for user ${userDocRef.id} has unmatched product ID "${productId || 'missing'}". Premium access was not granted.`,
    );
  }

  if (
    subscriptionStatus === 'active' &&
    resolvedProductSelection &&
    !metadataMatchesProductSelection
  ) {
    console.warn(
      `[dodo] Active subscription metadata mismatch for user ${userDocRef.id}. product=${resolvedProductSelection.productId} mappedPlan=${resolvedProductSelection.planId}/${resolvedProductSelection.interval} metadataPlan=${metadata.planId || 'missing'}/${metadata.interval || 'missing'}. Premium access was not granted.`,
    );
  }
  if (deletedAccount && subscriptionStatus === 'active') {
    console.warn(
      `[dodo] Active subscription webhook received for deleted account ${userDocRef.id}. Premium access remains disabled and billing review is required.`,
    );
  }

  const billingUpdate: Record<string, unknown> = {
    billingProvider: 'dodo',
    ...(billingEmail ? { billingEmail } : {}),
    dodoCustomerId: event.data.customer?.customer_id?.trim() || FieldValue.delete(),
    dodoSubscriptionId: event.data.subscription_id?.trim() || FieldValue.delete(),
    dodoProductId: productId || FieldValue.delete(),
    subscriptionTier: resolvedPlanId,
    subscriptionInterval:
      canGrantPaidPlan && resolvedProductSelection
        ? resolvedProductSelection.interval
        : FieldValue.delete(),
    isPremium: canGrantPaidPlan,
    subscriptionStatus,
    pendingPlanId: FieldValue.delete(),
    pendingInterval: FieldValue.delete(),
    subscriptionCurrentPeriodEnd:
      event.data.next_billing_date || FieldValue.delete(),
    subscriptionCancelAtPeriodEnd: Boolean(event.data.cancel_at_next_billing_date),
    billingReviewRequired,
    billingReviewReason: billingReviewReason || FieldValue.delete(),
    subscriptionUpdatedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await userDocRef.set(billingUpdate, { merge: true });
}

function getUpstreamDeadline(timeoutMs = UPSTREAM_REQUEST_TIMEOUT_MS) {
  return Date.now() + timeoutMs;
}

function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function isTimeoutLikeError(error: unknown) {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /timeout|timed out|aborted/i.test(message);
}

function isUnavailableLikeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /ECONNABORTED|ECONNRESET|ENOTFOUND|fetch failed|network|socket hang up|EAI_AGAIN|503|429/i.test(message);
}

function normalizeApiError(error: unknown, fallbackMessage: string) {
  if (isApiError(error)) {
    return error;
  }

  if (isTimeoutLikeError(error)) {
    return new ApiError(fallbackMessage, {
      status: 504,
      code: 'UPSTREAM_TIMEOUT',
      retryable: true,
    });
  }

  if (isUnavailableLikeError(error)) {
    return new ApiError(fallbackMessage, {
      status: 503,
      code: 'UPSTREAM_UNAVAILABLE',
      retryable: true,
    });
  }

  return new ApiError('Something went wrong while contacting the app store.', {
    status: 500,
    code: 'INTERNAL_ERROR',
    retryable: false,
  });
}

function createBadRequestError(message: string) {
  return new ApiError(message, {
    status: 400,
    code: 'BAD_REQUEST',
    retryable: false,
  });
}

function createUnauthorizedError(message: string) {
  return new ApiError(message, {
    status: 401,
    code: 'UNAUTHORIZED',
    retryable: false,
  });
}

function createForbiddenError(message: string) {
  return new ApiError(message, {
    status: 403,
    code: 'FORBIDDEN',
    retryable: false,
  });
}

function createRateLimitedError(message: string) {
  return new ApiError(message, {
    status: 429,
    code: 'RATE_LIMITED',
    retryable: true,
  });
}

function createConfigurationError(message: string) {
  return new ApiError(message, {
    status: 503,
    code: 'CONFIGURATION_ERROR',
    retryable: false,
  });
}

function readRequiredString(value: unknown, field: string, maxLength: number) {
  if (typeof value !== 'string') {
    throw createBadRequestError(`${field} is required.`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw createBadRequestError(`${field} is required.`);
  }

  if (trimmed.length > maxLength) {
    throw createBadRequestError(`${field} is too long.`);
  }

  return trimmed;
}

function readOptionalString(value: unknown, field: string, maxLength: number) {
  if (value === undefined || value === null || value === '') {
    return '';
  }

  if (typeof value !== 'string') {
    throw createBadRequestError(`${field} must be a string.`);
  }

  if (value.length > maxLength) {
    throw createBadRequestError(`${field} is too long.`);
  }

  return value;
}

function readOptionalBoolean(value: unknown) {
  return value === true;
}

function readStoreType(value: unknown) {
  if (value === 'ios' || value === 'android') {
    return value;
  }

  throw createBadRequestError('A valid store is required.');
}

function readAuthEventProvider(value: unknown): AuthEventProvider {
  if (value === 'google') {
    return value;
  }

  throw createBadRequestError('A valid auth provider is required.');
}

function readAuthEventFlow(value: unknown): AuthEventFlow {
  if (value === 'popup' || value === 'redirect') {
    return value;
  }

  throw createBadRequestError('A valid auth flow is required.');
}

function readAuthEventPhase(value: unknown): AuthEventPhase {
  if (value === 'start' || value === 'success' || value === 'error') {
    return value;
  }

  throw createBadRequestError('A valid auth phase is required.');
}

function readStoreTypeOrDefault(value: unknown, fallback: StoreType) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return readStoreType(value);
}

function readKeywordArray(value: unknown, field: string, maxItems: number, maxLength: number) {
  if (!Array.isArray(value) || value.length === 0) {
    throw createBadRequestError(`${field} array is required.`);
  }

  if (value.length > maxItems) {
    throw createBadRequestError(`${field} array is too large.`);
  }

  return value.map((entry) => readRequiredString(entry, field, maxLength));
}

function readAuthBearerToken(req: express.Request) {
  const header = req.header('authorization');
  if (!header || !header.startsWith('Bearer ')) {
    throw createUnauthorizedError('A valid bearer token is required.');
  }

  return header.slice('Bearer '.length).trim();
}

function createRateLimiter(name: string, limit: number, windowMs: number): express.RequestHandler {
  const state = new Map<string, { count: number; resetAt: number }>();
  let cleanupCounter = 0;

  // This limiter is per-process only. Cloud Run instances do not share memory, so
  // thresholds stay intentionally conservative on high-cost routes.
  const resolveKey = (req: express.Request) => {
    const bearer = req.header('authorization');
    if (bearer && bearer.startsWith('Bearer ')) {
      return `${name}:auth:${crypto.createHash('sha256').update(bearer.slice('Bearer '.length).trim()).digest('hex')}`;
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return `${name}:ip:${ip}`;
  };

  return (req, res, next) => {
    const now = Date.now();
    cleanupCounter += 1;
    if (cleanupCounter % 200 === 0) {
      for (const [entryKey, entry] of state.entries()) {
        if (entry.resetAt <= now) {
          state.delete(entryKey);
        }
      }
    }

    const key = resolveKey(req);
    const current = state.get(key);

    if (!current || current.resetAt <= now) {
      state.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return next(createRateLimitedError('Rate limit exceeded. Please try again shortly.'));
    }

    current.count += 1;
    state.set(key, current);
    return next();
  };
}

function getCachedFailure(cacheKey: string) {
  const cached = upstreamFailureCache.get<CachedApiFailure>(cacheKey);
  if (!cached) {
    return null;
  }

  return new ApiError(cached.message, {
    status: cached.status,
    code: cached.code,
    retryable: cached.retryable,
  });
}

function cacheFailure(cacheKey: string, error: ApiError) {
  if (error.code !== 'UPSTREAM_TIMEOUT' && error.code !== 'UPSTREAM_UNAVAILABLE') {
    return;
  }

  upstreamFailureCache.set(cacheKey, {
    message: error.message,
    status: error.status,
    code: error.code,
    retryable: error.retryable,
  }, UPSTREAM_FAILURE_CACHE_TTL_SECONDS);
}

function normalizeRankingDepth(input: unknown, fallback = DEFAULT_RANKING_DEPTH) {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(MAX_RANKING_DEPTH, Math.max(1, Math.floor(parsed)));
}

async function runWithDeadline<T>(
  task: () => Promise<T>,
  deadlineAt: number,
  fallbackMessage: string,
) {
  const remainingMs = deadlineAt - Date.now();
  if (remainingMs <= 0) {
    throw new ApiError(fallbackMessage, {
      status: 504,
      code: 'UPSTREAM_TIMEOUT',
      retryable: true,
    });
  }

  let timeoutHandle: NodeJS.Timeout | null = null;
  try {
    return await new Promise<T>((resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new ApiError(fallbackMessage, {
          status: 504,
          code: 'UPSTREAM_TIMEOUT',
          retryable: true,
        }));
      }, remainingMs);

      task().then(resolve, reject);
    });
  } catch (error) {
    throw normalizeApiError(error, fallbackMessage);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function getTrackedKeywordKey({
  groupId,
  appId,
  keyword,
  store,
  country,
}: Pick<TrackedKeywordRecord, 'groupId' | 'appId' | 'keyword' | 'store' | 'country'>) {
  return `${groupId}:${store}:${country}:${String(appId)}:${keyword.toLowerCase()}`;
}

function getRankHistoryKey(entry: RankHistoryRecord) {
  return `${entry.groupId || 'ungrouped'}:${entry.store}:${entry.country}:${entry.appId}:${entry.keyword.toLowerCase()}:${entry.rank}:${entry.timestamp}`;
}

function getLegacyTrackingGroupId({
  appId,
  keyword,
  store,
}: Pick<TrackedKeywordRecord, 'appId' | 'keyword' | 'store'>) {
  return `legacy:${store}:${String(appId)}:${keyword.toLowerCase()}`;
}

function resolveTrackingGroupId(candidate: Partial<TrackedKeywordRecord> | Pick<RankHistoryRecord, 'appId' | 'keyword' | 'store' | 'groupId'>) {
  return typeof candidate.groupId === 'string' && candidate.groupId.trim()
    ? candidate.groupId.trim()
    : getLegacyTrackingGroupId({
        appId: String(candidate.appId),
        keyword: String(candidate.keyword),
        store: candidate.store as StoreType,
      });
}

function getTrackingHistoryDayKey(entry: RankHistoryRecord) {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: GLOBAL_TRACKING_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(entry.timestamp));
  const lookup = Object.fromEntries(formatted.map((part) => [part.type, part.value]));
  return `${resolveTrackingGroupId(entry)}:${entry.store}:${entry.country}:${entry.appId}:${entry.keyword.toLowerCase()}:${lookup.year}-${lookup.month}-${lookup.day}`;
}

function normalizeTrackingSchedule(input?: Partial<TrackingSchedule>): TrackingSchedule {
  return normalizeSharedTrackingSchedule(input, DEFAULT_TRACKING_SCHEDULE);
}

function getDefaultTrackingState(): TrackingState {
  return {
    trackedKeywords: [],
    rankHistory: [],
    competitorTrackedKeywords: [],
    competitorRankHistory: [],
    competitorGroups: [],
    competitorGroupSnapshots: [],
    competitorAsoLatestSnapshots: [],
    schedule: { ...DEFAULT_TRACKING_SCHEDULE },
  };
}

function normalizeTrackedKeywordStatus(input: unknown, lastRank: number): TrackedKeywordStatus {
  if (input === 'pending' || input === 'ok' || input === 'not_ranked' || input === 'error') {
    return input;
  }

  return lastRank === -1 ? 'pending' : 'ok';
}

function sanitizeBookmarks(input: unknown): AppBookmark[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Partial<AppBookmark>;
    if (
      typeof candidate.appId !== 'string' ||
      !candidate.appId.trim() ||
      typeof candidate.title !== 'string' ||
      !candidate.title.trim() ||
      typeof candidate.country !== 'string'
    ) {
      return [];
    }

    const country = normalizeCountryCode(candidate.country, '');
    if (!country || !COUNTRY_CODE_SET.has(country)) {
      return [];
    }

    return [{
      appId: candidate.appId,
      id: Number.isFinite(candidate.id) ? Number(candidate.id) : undefined,
      title: candidate.title.trim(),
      icon: typeof candidate.icon === 'string' ? candidate.icon : '',
      developer: typeof candidate.developer === 'string' ? candidate.developer : '',
      store: candidate.store === 'ios' ? 'ios' : 'android',
      country,
      url: typeof candidate.url === 'string' ? candidate.url : undefined,
    }];
  });
}

function normalizeTrackedAppKind(input: unknown): TrackedAppKind {
  return input === 'competitor' ? 'competitor' : 'own';
}

function normalizeTrackedAppSource(input: unknown): TrackedAppSource {
  return input === 'compare' || input === 'discovery' ? input : 'manual';
}

function getTrackedAppKeyFromValues(appId: string, store: StoreType) {
  return `${store}:${String(appId)}`;
}

function sanitizeTrackedApps(input: unknown): TrackedAppRecord[] {
  if (!Array.isArray(input)) return [];
  const byKey = new Map<string, TrackedAppRecord>();

  input.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const candidate = item as Partial<TrackedAppRecord>;
    if (
      typeof candidate.appId !== 'string' ||
      !candidate.appId.trim() ||
      (candidate.store !== 'ios' && candidate.store !== 'android')
    ) {
      return;
    }

    const appKey = getTrackedAppKeyFromValues(candidate.appId, candidate.store);
    const existing = byKey.get(appKey);
    const countries = Array.from(
      new Set(
        (Array.isArray(candidate.countries) ? candidate.countries : [])
          .filter((countryCode): countryCode is string => typeof countryCode === 'string')
          .map((countryCode) => normalizeCountryCode(countryCode, 'us'))
          .concat(existing?.countries || []),
      ),
    )
      .filter((countryCode) => COUNTRY_CODE_SET.has(countryCode))
      .sort();

    byKey.set(appKey, {
      appKey,
      appId: candidate.appId,
      store: candidate.store,
      title: typeof candidate.title === 'string' && candidate.title.trim()
        ? candidate.title.trim()
        : existing?.title || candidate.appId,
      developer: typeof candidate.developer === 'string' ? candidate.developer : '',
      icon: typeof candidate.icon === 'string' ? candidate.icon : '',
      url: typeof candidate.url === 'string' ? candidate.url : undefined,
      category: typeof candidate.category === 'string' ? candidate.category : undefined,
      kind: existing?.kind === 'own' || normalizeTrackedAppKind(candidate.kind) === 'own'
        ? 'own'
        : 'competitor',
      source: normalizeTrackedAppSource(candidate.source),
      countries,
      createdAt:
        typeof candidate.createdAt === 'string' && candidate.createdAt
          ? candidate.createdAt
          : existing?.createdAt || new Date(0).toISOString(),
      updatedAt:
        typeof candidate.updatedAt === 'string' && candidate.updatedAt
          ? candidate.updatedAt
          : existing?.updatedAt || new Date(0).toISOString(),
      lastAnalyzedAt:
        typeof candidate.lastAnalyzedAt === 'string' && candidate.lastAnalyzedAt
          ? candidate.lastAnalyzedAt
          : existing?.lastAnalyzedAt,
    });
  });

  return Array.from(byKey.values()).sort((a, b) => a.title.localeCompare(b.title));
}

function sanitizeAppAnalysisSnapshots(input: unknown): AppAnalysisSnapshot[] {
  if (!Array.isArray(input)) return [];
  const byKey = new Map<string, AppAnalysisSnapshot>();

  input.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const candidate = item as Partial<AppAnalysisSnapshot>;
    if (
      typeof candidate.snapshotKey !== 'string' ||
      !candidate.snapshotKey.trim() ||
      typeof candidate.appKey !== 'string' ||
      !candidate.appKey.trim() ||
      typeof candidate.appId !== 'string' ||
      !candidate.appId.trim() ||
      typeof candidate.appTitle !== 'string' ||
      !candidate.appTitle.trim()
    ) {
      return;
    }

    const snapshot: AppAnalysisSnapshot = {
      snapshotKey: candidate.snapshotKey,
      appKey: candidate.appKey,
      appId: candidate.appId,
      appTitle: candidate.appTitle.trim(),
      store: candidate.store === 'ios' ? 'ios' : 'android',
      country: normalizeCountryCode(candidate.country, 'us'),
      mode: candidate.mode === 'fast' ? 'fast' : 'deep',
      loadedAt:
        typeof candidate.loadedAt === 'string' && candidate.loadedAt
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
        typeof candidate.strongestKeyword === 'object' &&
        typeof candidate.strongestKeyword.keyword === 'string' &&
        Number.isFinite(candidate.strongestKeyword.rank)
          ? {
              keyword: candidate.strongestKeyword.keyword,
              rank: Number(candidate.strongestKeyword.rank),
            }
          : undefined,
      bestSuggestion:
        candidate.bestSuggestion &&
        typeof candidate.bestSuggestion === 'object' &&
        typeof candidate.bestSuggestion.keyword === 'string'
          ? {
              keyword: candidate.bestSuggestion.keyword,
              volume: Number.isFinite(candidate.bestSuggestion.volume)
                ? Number(candidate.bestSuggestion.volume)
                : undefined,
              difficulty: Number.isFinite(candidate.bestSuggestion.difficulty)
                ? Number(candidate.bestSuggestion.difficulty)
                : undefined,
              relevance: Number.isFinite(candidate.bestSuggestion.relevance)
                ? Number(candidate.bestSuggestion.relevance)
                : undefined,
            }
          : undefined,
      rankedKeywords: Array.isArray(candidate.rankedKeywords)
        ? candidate.rankedKeywords.filter(
            (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
          )
        : [],
      suggestedKeywords: Array.isArray(candidate.suggestedKeywords)
        ? candidate.suggestedKeywords.filter(
            (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
          )
        : [],
    };

    const current = byKey.get(snapshot.snapshotKey);
    const currentTime = current ? new Date(current.loadedAt).getTime() : -1;
    const candidateTime = new Date(snapshot.loadedAt).getTime();
    if (!current || candidateTime >= currentTime) {
      byKey.set(snapshot.snapshotKey, snapshot);
    }
  });

  return Array.from(byKey.values()).sort(
    (a, b) => new Date(b.loadedAt).getTime() - new Date(a.loadedAt).getTime(),
  );
}

function sanitizeTrackedKeywords(input: unknown): TrackedKeywordRecord[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Partial<TrackedKeywordRecord>;
    if (
      typeof candidate.keyword !== 'string' ||
      typeof candidate.appId !== 'string' ||
      typeof candidate.appTitle !== 'string' ||
      (candidate.store !== 'ios' && candidate.store !== 'android') ||
      typeof candidate.country !== 'string'
    ) {
      return [];
    }

    const country = normalizeCountryCode(candidate.country, '');
    if (!country || !COUNTRY_CODE_SET.has(country)) {
      return [];
    }

    const lastRank = Number.isFinite(candidate.lastRank) ? Number(candidate.lastRank) : -1;
    const lastChecked = typeof candidate.lastChecked === 'string' ? candidate.lastChecked : new Date(0).toISOString();
    const lastCheckStatus = normalizeTrackedKeywordStatus(candidate.lastCheckStatus, lastRank);
    const lastError = typeof candidate.lastError === 'string' && candidate.lastError.trim()
      ? candidate.lastError.trim().slice(0, 240)
      : undefined;

    return [{
      groupId: resolveTrackingGroupId(candidate),
      keyword: candidate.keyword,
      appId: candidate.appId,
      appTitle: candidate.appTitle,
      store: candidate.store,
      country,
      createdAt:
        typeof candidate.createdAt === 'string' && candidate.createdAt
          ? candidate.createdAt
          : TRACKED_KEYWORD_LEGACY_CREATED_AT,
      lastRank,
      lastChecked,
      lastCheckStatus,
      ...(lastError ? { lastError } : {}),
    }];
  });
}

function sanitizeRankHistory(input: unknown): RankHistoryRecord[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Partial<RankHistoryRecord>;
    if (
      typeof candidate.appId !== 'string' ||
      typeof candidate.keyword !== 'string' ||
      (candidate.store !== 'ios' && candidate.store !== 'android') ||
      typeof candidate.country !== 'string' ||
      !Number.isFinite(candidate.rank) ||
      typeof candidate.timestamp !== 'string'
    ) {
      return [];
    }

    const country = normalizeCountryCode(candidate.country, '');
    if (!country || !COUNTRY_CODE_SET.has(country)) {
      return [];
    }

    return [{
      groupId: typeof candidate.groupId === 'string' && candidate.groupId.trim()
        ? candidate.groupId.trim()
        : undefined,
      appId: candidate.appId,
      keyword: candidate.keyword,
      store: candidate.store,
      country,
      rank: Number(candidate.rank),
      timestamp: candidate.timestamp,
      rankDepth: Number.isFinite(candidate.rankDepth) ? Number(candidate.rankDepth) : undefined,
      isSimulated: Boolean(candidate.isSimulated),
    }];
  });
}

function sanitizeCompetitorGroupAppRecord(
  input: unknown,
): CompetitorGroupAppRecord | null {
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
          .slice(0, 2)
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
      groupId: candidate.groupId,
      store: candidate.store === 'ios' ? 'ios' : 'android',
      country: normalizeCountryCode(candidate.country, 'us'),
      mode: candidate.mode === 'fast' ? 'fast' : 'deep',
      ownApp,
      competitors,
      trackedKeywordIds: Array.isArray(candidate.trackedKeywordIds)
        ? candidate.trackedKeywordIds.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
        : [],
      createdAt: typeof candidate.createdAt === 'string' && candidate.createdAt ? candidate.createdAt : new Date(0).toISOString(),
      updatedAt: typeof candidate.updatedAt === 'string' && candidate.updatedAt ? candidate.updatedAt : new Date(0).toISOString(),
      lastAnalyzedAt: typeof candidate.lastAnalyzedAt === 'string' ? candidate.lastAnalyzedAt : undefined,
      latestSnapshotId: typeof candidate.latestSnapshotId === 'string' ? candidate.latestSnapshotId : undefined,
    }];
  });
}

function sanitizeCompetitorGroupSnapshots(
  input: unknown,
): CompetitorGroupSnapshotRecord[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Partial<CompetitorGroupSnapshotRecord>;
    if (
      typeof candidate.snapshotId !== 'string' ||
      !candidate.snapshotId.trim() ||
      typeof candidate.groupId !== 'string' ||
      !candidate.groupId.trim()
    ) {
      return [];
    }
    return [{
      snapshotId: candidate.snapshotId,
      groupId: candidate.groupId,
      store: candidate.store === 'ios' ? 'ios' : 'android',
      country: normalizeCountryCode(candidate.country, 'us'),
      mode: candidate.mode === 'fast' ? 'fast' : 'deep',
      loadedAt: typeof candidate.loadedAt === 'string' && candidate.loadedAt ? candidate.loadedAt : new Date(0).toISOString(),
      appInsights: Array.isArray(candidate.appInsights) ? candidate.appInsights : [],
      sharedBattles: Array.isArray(candidate.sharedBattles) ? candidate.sharedBattles : [],
      gapOpportunities: Array.isArray(candidate.gapOpportunities) ? candidate.gapOpportunities : [],
    }];
  });
}

function sanitizeCompetitorAsoLatestSnapshots(
  input: unknown,
): CompetitorAsoSnapshotRecord[] {
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
        title:
          normalizeAsoTextValue(payloadCandidate?.title, 300),
        description:
          normalizeAsoTextValue(payloadCandidate?.description, 4000),
        icon: normalizeAsoTextValue(payloadCandidate?.icon, 2000),
        category:
          normalizeAsoTextValue(payloadCandidate?.category, 200),
        screenshots: Array.isArray(payloadCandidate?.screenshots)
          ? Array.from(
              new Set(
                payloadCandidate.screenshots.filter(
                  (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
                ),
              ),
            ).slice(0, 10)
          : [],
      },
    }];
  });
}

function sanitizeCompetitorTrackedKeywords(
  input: unknown,
): CompetitorTrackedKeywordRecord[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Partial<CompetitorTrackedKeywordRecord>;
    if (
      typeof candidate.trackedKeywordId !== 'string' ||
      !candidate.trackedKeywordId.trim() ||
      typeof candidate.groupId !== 'string' ||
      !candidate.groupId.trim() ||
      typeof candidate.keyword !== 'string' ||
      !candidate.keyword.trim()
    ) {
      return [];
    }

    const apps = Array.isArray(candidate.apps)
      ? candidate.apps.flatMap((entry) => {
          const app = sanitizeCompetitorGroupAppRecord(entry);
          if (!app) return [];
          const candidateApp = entry as Partial<CompetitorTrackedKeywordAppRecord>;
          const lastRank = Number.isFinite(candidateApp.lastRank) ? Number(candidateApp.lastRank) : -1;
          return [{
            ...app,
            lastRank,
            lastChecked: typeof candidateApp.lastChecked === 'string' && candidateApp.lastChecked ? candidateApp.lastChecked : new Date(0).toISOString(),
            lastCheckStatus: normalizeTrackedKeywordStatus(candidateApp.lastCheckStatus, lastRank),
            lastError: typeof candidateApp.lastError === 'string' && candidateApp.lastError.trim()
              ? candidateApp.lastError.trim().slice(0, 240)
              : undefined,
          }];
        })
      : [];
    if (apps.length < 2) {
      return [];
    }

    const country = normalizeCountryCode(candidate.country, '');
    if (!country || !COUNTRY_CODE_SET.has(country)) {
      return [];
    }

    return [{
      trackedKeywordId: candidate.trackedKeywordId,
      groupId: candidate.groupId,
      keyword: candidate.keyword.trim(),
      store: candidate.store === 'ios' ? 'ios' : 'android',
      country,
      apps,
      createdAt: typeof candidate.createdAt === 'string' && candidate.createdAt ? candidate.createdAt : new Date(0).toISOString(),
      updatedAt: typeof candidate.updatedAt === 'string' && candidate.updatedAt ? candidate.updatedAt : new Date(0).toISOString(),
      lastCheckedAt: typeof candidate.lastCheckedAt === 'string' ? candidate.lastCheckedAt : undefined,
    }];
  });
}

function sanitizeCompetitorRankHistory(
  input: unknown,
): CompetitorRankHistoryRecord[] {
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

    const country = normalizeCountryCode(candidate.country, '');
    if (!country || !COUNTRY_CODE_SET.has(country)) {
      return [];
    }

    return [{
      trackedKeywordId: candidate.trackedKeywordId,
      groupId: candidate.groupId,
      keyword: candidate.keyword.trim(),
      appId: candidate.appId,
      appKey: candidate.appKey,
      store: candidate.store,
      country,
      rank: Number(candidate.rank),
      timestamp: candidate.timestamp,
      rankDepth: Number.isFinite(candidate.rankDepth) ? Number(candidate.rankDepth) : undefined,
    }];
  });
}

function mergeRankHistory(existing: RankHistoryRecord[], incoming: RankHistoryRecord[]) {
  return mergeSharedRankHistory(existing, incoming, {
    historyLimit: SHARED_TRACKING_HISTORY_LIMIT,
    timeZone: GLOBAL_TRACKING_TIMEZONE,
  });
}

function mergeTrackedKeywords(
  existing: TrackedKeywordRecord[],
  incoming: TrackedKeywordRecord[],
) {
  const incomingByKey = new Map(
    incoming.map((trackedKeyword) => [
      getTrackedKeywordKey(trackedKeyword),
      trackedKeyword,
    ]),
  );
  return existing.map((trackedKeyword) =>
    incomingByKey.get(getTrackedKeywordKey(trackedKeyword)) || trackedKeyword,
  );
}

function getCompetitorTrackedKeywordKey(
  record: Pick<CompetitorTrackedKeywordRecord, 'groupId' | 'keyword' | 'country'>,
) {
  return `${record.groupId}:${normalizeCountryCode(record.country, 'us')}:${record.keyword.toLowerCase()}`;
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
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: GLOBAL_TRACKING_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(entry.timestamp));
  const lookup = Object.fromEntries(formatted.map((part) => [part.type, part.value]));
  return `${entry.trackedKeywordId}:${entry.appKey}:${lookup.year}-${lookup.month}-${lookup.day}`;
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
  return `rh:${crypto.createHash('sha1').update(getTrackingHistoryDayKey(entry)).digest('hex').slice(0, 24)}`;
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

async function archiveTrackedRankHistoryEntries(
  userDocRef: DocumentReference<DocumentData>,
  entries: RankHistoryRecord[],
) {
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

async function archiveCompetitorRankHistoryEntries(
  userDocRef: DocumentReference<DocumentData>,
  entries: CompetitorRankHistoryRecord[],
) {
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

async function archiveAndTrimTrackedRankHistory(
  userDocRef: DocumentReference<DocumentData>,
  entries: RankHistoryRecord[],
) {
  const { archived, retained } = splitEmbeddedHistoryWindow(entries);
  await archiveTrackedRankHistoryEntries(userDocRef, archived);
  return retained;
}

async function archiveAndTrimCompetitorRankHistory(
  userDocRef: DocumentReference<DocumentData>,
  entries: CompetitorRankHistoryRecord[],
) {
  const { archived, retained } = splitEmbeddedHistoryWindow(entries);
  await archiveCompetitorRankHistoryEntries(userDocRef, archived);
  return retained;
}

function normalizeUserTrackingDocument(data: any): NormalizedUserTrackingDocument {
  return {
    bookmarks: sanitizeBookmarks(data?.bookmarks),
    trackedApps: sanitizeTrackedApps(data?.trackedApps),
    trackedKeywords: sanitizeTrackedKeywords(data?.trackedKeywords),
    rankHistory: sanitizeRankHistory(data?.rankHistory),
    appAnalysisSnapshots: sanitizeAppAnalysisSnapshots(data?.appAnalysisSnapshots),
    competitorTrackedKeywords: sanitizeCompetitorTrackedKeywords(data?.competitorTrackedKeywords),
    competitorRankHistory: sanitizeCompetitorRankHistory(data?.competitorRankHistory),
    competitorGroups: sanitizeCompetitorGroups(data?.competitorGroups),
    competitorGroupSnapshots: sanitizeCompetitorGroupSnapshots(data?.competitorGroupSnapshots),
    competitorAsoLatestSnapshots: sanitizeCompetitorAsoLatestSnapshots(
      data?.competitorAsoLatestSnapshots,
    ),
    schedule: normalizeTrackingSchedule(data?.trackingSchedule),
    alertRules: normalizeAlertRules(data?.alertRules),
    notificationSettings: normalizeNotificationSettings(data?.notificationSettings),
    legalAcceptedAt:
      typeof data?.legalAcceptedAt === 'string' && data.legalAcceptedAt
        ? data.legalAcceptedAt
        : undefined,
    legalVersion:
      typeof data?.legalVersion === 'string' && data.legalVersion
        ? data.legalVersion
        : undefined,
    migratedFromLocalAt:
      typeof data?.migratedFromLocalAt === 'string' && data.migratedFromLocalAt
        ? data.migratedFromLocalAt
        : undefined,
  };
}

function getResolvedPlanLimits(
  data: Pick<UserTrackingDocument, 'dodoProductId' | 'subscriptionTier'> | null | undefined,
) {
  return getPlanLimits(getEffectiveBillingPlanId(data));
}

function readPendingPlanId(planId?: string | null): BillingPlanId | null {
  return planId === 'indie' ||
    planId === 'starter' ||
    planId === 'pro' ||
    planId === 'agency'
    ? planId
    : null;
}

function getEffectiveBillingPlanId(
  data:
    | Pick<UserTrackingDocument, 'subscriptionTier' | 'dodoProductId'>
    | null
    | undefined,
): BillingPlanId {
  const storedPlanId = resolveBillingPlanId(data?.subscriptionTier);
  if (storedPlanId !== 'free') {
    return storedPlanId;
  }

  // Legacy billing rows may have an active paid Dodo product ID even if the
  // older webhook write failed to persist the paid tier. Only trust configured
  // product-ID mappings here; never fall back to a default paid plan.
  return resolvePlanIdFromProductId(data?.dodoProductId) || 'free';
}

function deriveBillingAccessState(
  data: Pick<
    UserTrackingDocument,
    'accountStatus' | 'dodoProductId' | 'isPremium' | 'pendingPlanId' | 'subscriptionStatus' | 'subscriptionTier'
  > | null | undefined,
): BillingAccessState {
  if (hasActiveBillingEntitlement(data)) {
    return 'active';
  }
  if (readPendingPlanId(data?.pendingPlanId)) {
    return 'activating';
  }
  return 'selection_required';
}

function hasActiveBillingEntitlement(
  data: Pick<
    UserTrackingDocument,
    'accountStatus' | 'dodoProductId' | 'isPremium' | 'subscriptionStatus' | 'subscriptionTier'
  > | null | undefined,
): boolean {
  if (isDeletedUserTrackingDocument(data)) {
    return false;
  }
  if (data?.isPremium) {
    return true;
  }
  const effectivePlanId = getEffectiveBillingPlanId(data);
  if (
    data?.subscriptionStatus === 'active' &&
    effectivePlanId !== 'free'
  ) {
    return true;
  }
  if (data?.subscriptionStatus) {
    return false;
  }
  return effectivePlanId !== 'free';
}

function getNormalizedPlanUsage(
  state: Pick<
    NormalizedUserTrackingDocument,
    'trackedApps' | 'competitorGroups' | 'trackedKeywords' | 'competitorTrackedKeywords'
  >,
  limits: PlanLimits,
) {
  return countPlanUsage(
    {
      trackedApps: state.trackedApps,
      competitorGroups: state.competitorGroups,
      trackedKeywords: state.trackedKeywords,
      competitorTrackedKeywords: state.competitorTrackedKeywords,
    },
    limits,
  );
}

function getGovernedIdentitySets(
  state: Pick<
    NormalizedUserTrackingDocument,
    'trackedApps' | 'competitorGroups' | 'trackedKeywords' | 'competitorTrackedKeywords'
  >,
) {
  return {
    trackedApps: new Set(
      state.trackedApps
        .filter((trackedApp) => trackedApp.kind === 'own')
        .map((trackedApp) => getTrackedAppIdentityKey(trackedApp)),
    ),
    competitorGroups: new Set(
      state.competitorGroups.map((group) => group.groupId),
    ),
    trackedKeywords: new Set(
      state.trackedKeywords
        .map((trackedKeyword) => getTrackedKeywordIdentityKey(trackedKeyword))
        .concat(
          state.competitorTrackedKeywords.map((trackedKeyword) =>
            getCompetitorTrackedKeywordIdentityKey(trackedKeyword),
          ),
        ),
    ),
  };
}

function getTrackedKeywordScopedState(
  state: NormalizedUserTrackingDocument,
  limits: PlanLimits,
) {
  const activity = getTrackedKeywordActivity(
    {
      trackedApps: state.trackedApps,
      competitorGroups: state.competitorGroups,
      trackedKeywords: state.trackedKeywords,
      competitorTrackedKeywords: state.competitorTrackedKeywords,
    },
    limits,
  );

  return {
    activity,
    scopedState: {
      ...state,
      trackedKeywords: state.trackedKeywords.filter((trackedKeyword) =>
        activity.activeTrackedKeywordKeys.has(
          getTrackedKeywordIdentityKey(trackedKeyword),
        ),
      ),
      competitorTrackedKeywords: state.competitorTrackedKeywords.filter(
        (trackedKeyword) =>
          activity.activeCompetitorTrackedKeywordKeys.has(
            getCompetitorTrackedKeywordIdentityKey(trackedKeyword),
          ),
      ),
    },
  };
}

function mergeEditableTrackedKeywords(
  current: TrackedKeywordRecord[],
  next: TrackedKeywordRecord[],
) {
  const currentByKey = new Map(
    current.map((trackedKeyword) => [
      getTrackedKeywordKey(trackedKeyword),
      trackedKeyword,
    ]),
  );

  return next.map((trackedKeyword) => {
    const existing = currentByKey.get(getTrackedKeywordKey(trackedKeyword));
    if (!existing) {
      return trackedKeyword;
    }

    const currentCreatedAt = existing.createdAt || TRACKED_KEYWORD_LEGACY_CREATED_AT;
    const nextCreatedAt = trackedKeyword.createdAt || TRACKED_KEYWORD_LEGACY_CREATED_AT;

    return {
      ...trackedKeyword,
      createdAt:
        new Date(currentCreatedAt).getTime() <= new Date(nextCreatedAt).getTime()
          ? currentCreatedAt
          : nextCreatedAt,
      lastRank: existing.lastRank,
      lastChecked: existing.lastChecked,
      lastCheckStatus: existing.lastCheckStatus,
      ...(existing.lastError ? { lastError: existing.lastError } : {}),
    };
  });
}

function mergeEditableCompetitorTrackedKeywords(
  current: CompetitorTrackedKeywordRecord[],
  next: CompetitorTrackedKeywordRecord[],
) {
  const currentByKey = new Map(
    current.map((trackedKeyword) => [
      getCompetitorTrackedKeywordKey(trackedKeyword),
      trackedKeyword,
    ]),
  );

  return next.map((trackedKeyword) => {
    const existing = currentByKey.get(
      getCompetitorTrackedKeywordKey(trackedKeyword),
    );
    if (!existing) {
      return trackedKeyword;
    }

    const currentCreatedAt = existing.createdAt || TRACKED_KEYWORD_LEGACY_CREATED_AT;
    const nextCreatedAt = trackedKeyword.createdAt || TRACKED_KEYWORD_LEGACY_CREATED_AT;
    const existingAppsByKey = new Map(
      existing.apps.map((app) => [app.appKey, app]),
    );

    return {
      ...trackedKeyword,
      createdAt:
        new Date(currentCreatedAt).getTime() <= new Date(nextCreatedAt).getTime()
          ? currentCreatedAt
          : nextCreatedAt,
      updatedAt: existing.updatedAt,
      lastCheckedAt: existing.lastCheckedAt,
      apps: trackedKeyword.apps.map((app) => {
        const existingApp = existingAppsByKey.get(app.appKey);
        if (!existingApp) {
          return app;
        }

        return {
          ...app,
          lastRank: existingApp.lastRank,
          lastChecked: existingApp.lastChecked,
          lastCheckStatus: existingApp.lastCheckStatus,
          ...(existingApp.lastError
            ? { lastError: existingApp.lastError }
            : {}),
        };
      }),
    };
  });
}

function mergeEditableAlertRules(current: AlertRule[], next: AlertRule[]) {
  const currentById = new Map(current.map((rule) => [rule.id, rule]));
  return next.map((rule) => {
    const existing = currentById.get(rule.id);
    return {
      ...rule,
      createdAt: existing?.createdAt || rule.createdAt,
      updatedAt: rule.updatedAt || existing?.updatedAt,
      ...(existing?.baselineKeys
        ? { baselineKeys: [...existing.baselineKeys] }
        : {}),
    };
  });
}

function mergeEditableNotificationSettings(
  current: NotificationSettings,
  next: NotificationSettings,
): NotificationSettings {
  return {
    ...next,
    lastToken: current.lastToken,
    tokenUpdatedAt: current.tokenUpdatedAt,
  };
}

function mergeEditableTrackingSchedule(
  current: TrackingSchedule,
  next: TrackingSchedule,
): TrackingSchedule {
  const normalizedNext = normalizeTrackingSchedule(next);
  return {
    enabled: normalizedNext.enabled,
    time: normalizedNext.time,
    timezone: normalizedNext.timezone,
    lastRunAt: current.lastRunAt,
    lastRunKey: current.lastRunKey,
  };
}

function mergeEditableUserTrackingState(
  currentState: NormalizedUserTrackingDocument,
  nextState: NormalizedUserTrackingDocument,
): NormalizedUserTrackingDocument {
  const competitorGroupIds = new Set(nextState.competitorGroups.map((group) => group.groupId));
  const competitorGroupCountryKeys = new Set(
    nextState.competitorGroups.flatMap((group) => {
      const trackedCountries = new Set(
        nextState.competitorTrackedKeywords
          .filter((record) => record.groupId === group.groupId)
          .map((record) => normalizeCountryCode(record.country, group.country)),
      );
      trackedCountries.add(normalizeCountryCode(group.country, 'us'));
      return [group.ownApp, ...group.competitors].flatMap((app) =>
        Array.from(trackedCountries).map(
          (country) => `${group.groupId}:${app.appId}:${country}`,
        ),
      );
    }),
  );

  return {
    ...currentState,
    bookmarks: nextState.bookmarks,
    trackedApps: nextState.trackedApps,
    trackedKeywords: mergeEditableTrackedKeywords(
      currentState.trackedKeywords,
      nextState.trackedKeywords,
    ),
    rankHistory: mergeSharedRankHistory(
      currentState.rankHistory,
      nextState.rankHistory,
    ),
    appAnalysisSnapshots: nextState.appAnalysisSnapshots,
    competitorGroups: nextState.competitorGroups,
    competitorGroupSnapshots: nextState.competitorGroupSnapshots,
    competitorAsoLatestSnapshots: currentState.competitorAsoLatestSnapshots.filter(
      (snapshot) =>
        competitorGroupIds.has(snapshot.groupId) &&
        competitorGroupCountryKeys.has(
          `${snapshot.groupId}:${snapshot.appId}:${snapshot.country}`,
        ),
    ),
    competitorTrackedKeywords: mergeEditableCompetitorTrackedKeywords(
      currentState.competitorTrackedKeywords,
      nextState.competitorTrackedKeywords,
    ),
    competitorRankHistory: mergeCompetitorRankHistory(
      currentState.competitorRankHistory,
      nextState.competitorRankHistory,
    ),
    schedule: mergeEditableTrackingSchedule(
      currentState.schedule,
      nextState.schedule,
    ),
    alertRules: mergeEditableAlertRules(
      currentState.alertRules,
      nextState.alertRules,
    ),
    notificationSettings: mergeEditableNotificationSettings(
      currentState.notificationSettings,
      nextState.notificationSettings,
    ),
    legalAcceptedAt: nextState.legalAcceptedAt ?? currentState.legalAcceptedAt,
    legalVersion: nextState.legalVersion ?? currentState.legalVersion,
    migratedFromLocalAt:
      nextState.migratedFromLocalAt ?? currentState.migratedFromLocalAt,
  };
}

function assertPlanLimitTransition(
  currentState: Pick<
    NormalizedUserTrackingDocument,
    'trackedApps' | 'competitorGroups' | 'trackedKeywords' | 'competitorTrackedKeywords'
  >,
  nextState: Pick<
    NormalizedUserTrackingDocument,
    'trackedApps' | 'competitorGroups' | 'trackedKeywords' | 'competitorTrackedKeywords'
  >,
  limits: PlanLimits,
) {
  const currentIds = getGovernedIdentitySets(currentState);
  const nextIds = getGovernedIdentitySets(nextState);

  const assertScopedLimit = (
    label: string,
    currentSet: Set<string>,
    nextSet: Set<string>,
    limit: number | null,
  ) => {
    if (limit === null) {
      return;
    }
    const currentCount = currentSet.size;
    const nextCount = nextSet.size;
    const hasNewIdentity = Array.from(nextSet).some((entry) => !currentSet.has(entry));
    if (currentCount > limit && hasNewIdentity) {
      throw createBadRequestError(
        `${label} limit reached for this plan. Remove existing items before adding new ones.`,
      );
    }
    if (currentCount <= limit && nextCount > limit) {
      throw createBadRequestError(
        `${label} limit reached for this plan. Upgrade to add more.`,
      );
    }
  };

  assertScopedLimit(
    'Tracked app',
    currentIds.trackedApps,
    nextIds.trackedApps,
    limits.trackedApps,
  );
  assertScopedLimit(
    'Competitor group',
    currentIds.competitorGroups,
    nextIds.competitorGroups,
    limits.competitorGroups,
  );
  assertScopedLimit(
    'Tracked keyword',
    currentIds.trackedKeywords,
    nextIds.trackedKeywords,
    limits.trackedKeywords,
  );
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

function createAlertRunKey(prefix: 'schedule' | 'manual' | 'test') {
  return sanitizeAlertEventId(
    `${prefix}:${new Date().toISOString()}:${Math.random().toString(36).slice(2, 8)}`,
  );
}

function getComparableTrackedKey({
  appId,
  keyword,
  store,
  country,
}: Pick<TrackedKeywordRecord, 'appId' | 'keyword' | 'store' | 'country'>) {
  return `${store}:${String(appId)}:${keyword.toLowerCase()}:${country}`;
}

function getComparableCompetitorAsoSnapshotKey({
  groupId,
  appId,
  country,
}: Pick<CompetitorAsoSnapshotRecord, 'groupId' | 'appId' | 'country'>) {
  return `${groupId}:${appId}:${normalizeCountryCode(country, 'us')}`;
}

function normalizeAsoTextValue(input: unknown, maxLength = 4000) {
  return typeof input === 'string'
    ? input.replace(/\s+/g, ' ').trim().slice(0, maxLength)
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
  }).slice(0, 10);
}

function extractPlayFallbackScreenshots(html: string, iconUrl?: string) {
  const matches = Array.from(
    html.matchAll(/https:\/\/play-lh\.googleusercontent\.com\/[^"'\\\s)]+/gi),
  ).map((match) => match[0]);
  return normalizeAsoScreenshotList(matches, iconUrl);
}

function normalizeCompetitorAsoSnapshotPayload(
  details: any,
  storeType: StoreType,
): CompetitorAsoSnapshotPayload {
  const icon = normalizeAsoTextValue(
    details?.icon || details?.artworkUrl512 || details?.artworkUrl100,
    2000,
  );
  return {
    title: normalizeAsoTextValue(details?.title || details?.trackName || details?.name, 300),
    description: normalizeAsoTextValue(details?.description || details?.summary, 4000),
    icon,
    category: normalizeAsoTextValue(
      storeType === 'ios'
        ? details?.primaryGenre || details?.genre || details?.category
        : details?.genre || details?.category,
      200,
    ),
    screenshots: normalizeAsoScreenshotList(
      details?.screenshots || details?.screenshotUrls || details?.ipadScreenshotUrls,
      icon,
    ),
  };
}

function buildCompetitorAsoSnapshotId(
  groupId: string,
  appId: string,
  country: string,
  capturedAt: string,
) {
  const input = `${groupId}:${appId}:${country}:${capturedAt}`;
  return `aso-snapshot:${crypto.createHash('sha1').update(input).digest('hex').slice(0, 24)}`;
}

function buildCompetitorAsoDiffId(
  runKey: string,
  groupId: string,
  appId: string,
  country: string,
) {
  const input = `${runKey}:${groupId}:${appId}:${country}`;
  return `aso-diff:${crypto.createHash('sha1').update(input).digest('hex').slice(0, 24)}`;
}

function summarizeAsoFieldValue(
  field: CompetitorAsoFieldName,
  value: string | string[] | null,
) {
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
  const changes: CompetitorAsoFieldChange[] = [];
  const fields: CompetitorAsoFieldName[] = [
    'title',
    'description',
    'icon',
    'category',
    'screenshots',
  ];

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
      summary: buildCompetitorAsoFieldSummary(
        field,
        previousValue ?? null,
        currentValue ?? null,
      ),
    });
  });

  if (!changes.length) {
    return null;
  }

  return {
    diffId: buildCompetitorAsoDiffId(
      runKey,
      currentSnapshot.groupId,
      currentSnapshot.appId,
      currentSnapshot.country,
    ),
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

async function persistAlertEvent(
  userDocRef: DocumentReference<DocumentData>,
  event: AlertEvent,
) {
  try {
    await userDocRef.collection('alert_events').doc(event.id).create(event);
    return true;
  } catch (error: any) {
    if (error?.code === 6 || error?.code === 'already-exists') {
      return false;
    }
    throw error;
  }
}

async function persistCompetitorAsoDiff(
  userDocRef: DocumentReference<DocumentData>,
  diff: CompetitorAsoDiffRecord,
) {
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
        const eventId = sanitizeAlertEventId(
          `${runKey}:${rule.id}:${diff.diffId}:${condition.type}`,
        );
        const event: AlertEvent = {
          id: eventId,
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

type PushTokenRecord = {
  id: string;
  token: string;
  lastSeenAt?: string;
  ref: DocumentReference<DocumentData>;
};

type PushDispatchResult = {
  delivered: number;
  failed: number;
  reasons: string[];
};

async function loadUserPushTokens(
  userDocRef: DocumentReference<DocumentData>,
): Promise<PushTokenRecord[]> {
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
      lastSeenAt: typeof tokenDoc.data()?.lastSeenAt === 'string' ? tokenDoc.data().lastSeenAt : undefined,
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
  userDocRef: DocumentReference<DocumentData>,
  notification: { title: string; body: string },
  data?: Record<string, string>,
): Promise<PushDispatchResult> {
  const messagingClient = getFirebaseAdminMessagingClient();
  if (!messagingClient) {
    console.info('[push] Skipping send because Firebase Admin Messaging is not configured.');
    return { delivered: 0, failed: 0, reasons: ['admin-not-configured'] };
  }

  const tokens = await loadUserPushTokens(userDocRef);
  if (!tokens.length) {
    console.info('[push] Skipping send because no push tokens are registered for the user.');
    return { delivered: 0, failed: 0, reasons: ['no-tokens'] };
  }

  const response = await messagingClient.sendEachForMulticast({
    tokens: tokens.map((entry) => entry.token),
    notification,
    ...(data ? { data } : {}),
  });

  const invalidTokenRefs = new Set<DocumentReference<DocumentData>>();
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
      console.info('[push] Skipping alert push because push notifications are disabled for the user.');
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
          console.info(`[push] Alert ${event.id} delivery notes: ${result.reasons.join(', ')}`);
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
  const dashboardUrl = ALERT_EMAIL_APP_URL;

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
      <a href="${escapeAlertEmailHtml(dashboardUrl)}" style="display: inline-block; margin-top: 20px; padding: 12px 20px; border-radius: 10px; background: #06b6d4; color: #082f49; text-decoration: none; font-weight: 700;">
        Open Workspace
      </a>
    </div>
  `;
}

async function resolveAlertEmailRecipient(
  userDocRef: DocumentReference<DocumentData>,
) {
  const authClient = getFirebaseAdminAuthClient();
  if (!authClient) {
    console.info('[email] Skipping alert email because Firebase Admin Auth is not configured.');
    return null;
  }

  try {
    const userRecord = await authClient.getUser(userDocRef.id);
    return userRecord.email?.trim().toLowerCase() || null;
  } catch (error) {
    console.warn(`[email] Failed to resolve alert email for user ${userDocRef.id}`, error);
    return null;
  }
}

async function sendEmailAlertEvents(
  userDocRef: DocumentReference<DocumentData>,
  events: AlertEvent[],
) {
  if (!events.length) {
    return;
  }
  if (!resend) {
    console.info('[email] Skipping alert email because Resend is not configured.');
    return;
  }

  const recipient = await resolveAlertEmailRecipient(userDocRef);
  if (!recipient) {
    console.info(`[email] Skipping alert email for user ${userDocRef.id} because no account email is available.`);
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
    console.info('[email] Skipping cron failure email because Resend is not configured.');
    return;
  }
  if (!CRON_FAILURE_EMAIL_RECIPIENTS.length) {
    console.info('[email] Skipping cron failure email because CRON_FAILURE_EMAIL is not configured.');
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
    console.warn('[email] Failed to deliver cron failure email.', error);
  }
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

        const eventId = buildAlertEventId(
          runKey,
          rule.id,
          country,
          condition.type,
          condition.value ?? null,
        );
        const event: AlertEvent = {
          id: eventId,
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
        rule.baselineKeys = Array.from(
          new Set([...(rule.baselineKeys || []), baselineKey]),
        );
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

async function refreshTrackedKeywordRecord(
  trackedKeyword: TrackedKeywordRecord,
  rankingDepth = TRACKED_KEYWORD_RANKING_DEPTH,
) {
  const result = await refreshSharedTrackedKeywordRecord(
    trackedKeyword,
    {
      rankingDepth,
      getKeywordRank,
      normalizeTrackedKeywordError: (error) =>
        normalizeApiError(error, 'Tracked keyword check failed.').message,
      normalizeCompetitorTrackedKeywordError: (error) =>
        normalizeApiError(error, 'Competitor keyword check failed.').message,
    },
    rankingDepth,
  );

  if (result.hadError) {
    console.warn(
      `Tracked keyword refresh failed for "${trackedKeyword.keyword}" [${trackedKeyword.country}]`,
      result.trackedKeyword.lastError,
    );
  }

  return {
    ...result,
    trackedKeyword: {
      ...result.trackedKeyword,
      groupId: trackedKeyword.groupId,
    },
    historyEntry: result.historyEntry
      ? {
          ...result.historyEntry,
          groupId: trackedKeyword.groupId,
        }
      : null,
  };
}

function resolveAndroidChartCollection(chartType: ChartType) {
  if (!gplay.collection) {
    throw new Error('Android chart collections are unavailable.');
  }
  switch (chartType) {
    case 'free':
      return gplay.collection.TOP_FREE;
    case 'paid':
      return gplay.collection.TOP_PAID;
    case 'grossing':
      return gplay.collection.GROSSING;
  }
}

function resolveIosChartCollection(chartType: ChartType) {
  switch (chartType) {
    case 'free':
      return store.collection.TOP_FREE_IOS;
    case 'paid':
      return store.collection.TOP_PAID_IOS;
    case 'grossing':
      return store.collection.TOP_GROSSING_IOS;
  }
}

async function fetchCategoryChartEntries(
  storeType: StoreType,
  country: string,
  categoryOption: ChartCategoryOption,
  chartType: ChartType,
  num: number,
) {
  const cacheKey = `chart:${storeType}:${country}:${categoryOption.code}:${chartType}:${num}`;
  const cached = chartCache.get<ChartEntry[]>(cacheKey);
  if (cached) {
    return cached;
  }

  let entries: ChartEntry[];

  if (storeType === 'android') {
    const rawEntries = await gplay.list({
      collection: resolveAndroidChartCollection(chartType),
      category: String(categoryOption.rawCode || 'APPLICATION'),
      country,
      lang: 'en',
      num,
      requestOptions: googlePlayDefaultRequestOptions,
    });
    entries = rawEntries.map((entry, index) => ({
      appId: String(entry.appId),
      title: entry.title,
      developer: entry.developer || '',
      icon: entry.icon || '',
      store: storeType,
      country,
      category: categoryOption.code,
      chartType,
      position: index + 1,
      ...(typeof entry.url === 'string' ? { url: entry.url } : {}),
    }));
  } else {
    const rawEntries = await store.list({
      collection: resolveIosChartCollection(chartType),
      ...(categoryOption.rawCode ? { category: categoryOption.rawCode } : {}),
      country,
      num,
      requestOptions: appStoreRequestOptions,
    });
    entries = rawEntries.map((entry: any, index: number) => ({
      appId: String(entry.id || entry.appId),
      title: entry.title,
      developer: entry.developer || '',
      icon: entry.icon || '',
      store: storeType,
      country,
      category: categoryOption.code,
      chartType,
      position: index + 1,
      ...(typeof entry.url === 'string' ? { url: entry.url } : {}),
    }));
  }

  chartCache.set(cacheKey, entries);
  return entries;
}

async function loadTrackingState() {
  if (trackingStateCache) {
    return trackingStateCache;
  }

  try {
    if (!existsSync(TRACKING_STATE_FILE)) {
      trackingStateCache = getDefaultTrackingState();
      return trackingStateCache;
    }

    const raw = await readFile(TRACKING_STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    trackingStateCache = {
      trackedKeywords: sanitizeTrackedKeywords(parsed?.trackedKeywords),
      rankHistory: sanitizeRankHistory(parsed?.rankHistory),
      competitorTrackedKeywords: sanitizeCompetitorTrackedKeywords(parsed?.competitorTrackedKeywords),
      competitorRankHistory: sanitizeCompetitorRankHistory(parsed?.competitorRankHistory),
      competitorGroups: sanitizeCompetitorGroups(parsed?.competitorGroups),
      competitorGroupSnapshots: sanitizeCompetitorGroupSnapshots(parsed?.competitorGroupSnapshots),
      competitorAsoLatestSnapshots: sanitizeCompetitorAsoLatestSnapshots(
        parsed?.competitorAsoLatestSnapshots,
      ),
      schedule: normalizeTrackingSchedule(parsed?.schedule),
    };
    return trackingStateCache;
  } catch (error) {
    console.warn('Failed to load tracking state, falling back to defaults.', error);
    trackingStateCache = getDefaultTrackingState();
    return trackingStateCache;
  }
}

async function saveTrackingState(nextState: TrackingState) {
  trackingStateCache = nextState;
  trackingStateWriteQueue = trackingStateWriteQueue.then(async () => {
    if (!existsSync(path.dirname(TRACKING_STATE_FILE))) {
      mkdirSync(path.dirname(TRACKING_STATE_FILE), { recursive: true });
    }

    await writeFile(
      TRACKING_STATE_FILE,
      JSON.stringify(nextState, null, 2),
      'utf8',
    );
  });

  await trackingStateWriteQueue;
  return trackingStateCache;
}

async function updateTrackingState(mutator: (state: TrackingState) => TrackingState) {
  const state = await loadTrackingState();
  const nextState = mutator(structuredClone(state));
  return saveTrackingState({
    trackedKeywords: sanitizeTrackedKeywords(nextState.trackedKeywords),
    rankHistory: sanitizeRankHistory(nextState.rankHistory),
    competitorTrackedKeywords: sanitizeCompetitorTrackedKeywords(nextState.competitorTrackedKeywords),
    competitorRankHistory: sanitizeCompetitorRankHistory(nextState.competitorRankHistory),
    competitorGroups: sanitizeCompetitorGroups(nextState.competitorGroups),
    competitorGroupSnapshots: sanitizeCompetitorGroupSnapshots(nextState.competitorGroupSnapshots),
    competitorAsoLatestSnapshots: sanitizeCompetitorAsoLatestSnapshots(
      nextState.competitorAsoLatestSnapshots,
    ),
    schedule: normalizeTrackingSchedule(nextState.schedule),
  });
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
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()),
  );

  return results;
}

function getZonedDateParts(date: Date, timeZone: string) {
  return getSharedZonedDateParts(date, timeZone);
}

function getScheduleRunKey(date: Date, schedule: TrackingSchedule) {
  const parts = getZonedDateParts(date, schedule.timezone);
  return `${parts.year}-${parts.month}-${parts.day}T${schedule.time}`;
}

function isGlobalTrackingRunTime(date: Date) {
  return isSharedGlobalTrackingRunTime(date, GLOBAL_TRACKING_HOURS, GLOBAL_TRACKING_TIMEZONE);
}

function getGlobalTrackingRunKey(date: Date) {
  return getSharedGlobalTrackingRunKey(date, DEFAULT_TRACKING_SCHEDULE.time, GLOBAL_TRACKING_TIMEZONE);
}

function getGlobalTrackingScheduledMinutes() {
  const [hour, minute] = DEFAULT_TRACKING_SCHEDULE.time.split(':').map(Number);
  return hour * 60 + minute;
}

function isGlobalTrackingWatchdogWindowOpen(date: Date) {
  const parts = getZonedDateParts(date, GLOBAL_TRACKING_TIMEZONE);
  const currentMinutes = parts.hour * 60 + parts.minute;
  return currentMinutes >= getGlobalTrackingScheduledMinutes() + GLOBAL_TRACKING_WATCHDOG_DELAY_MINUTES;
}

function getGlobalTrackingWatchdogDueAtIso(date: Date) {
  const parts = getZonedDateParts(date, GLOBAL_TRACKING_TIMEZONE);
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const scheduledMinutes =
    getGlobalTrackingScheduledMinutes() + GLOBAL_TRACKING_WATCHDOG_DELAY_MINUTES;
  const dueHour = Math.floor(scheduledMinutes / 60);
  const dueMinute = scheduledMinutes % 60;
  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      dueHour,
      dueMinute - GLOBAL_TRACKING_UTC_OFFSET_MINUTES,
    ),
  ).toISOString();
}

function getMinutesSinceIsoTimestamp(timestamp: string | undefined, now: Date) {
  if (!timestamp) {
    return null;
  }

  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return Math.max(0, Math.floor((now.getTime() - parsed) / 60000));
}

function addMinutesToIsoTimestamp(timestamp: string | undefined, minutes: number) {
  if (!timestamp) {
    return undefined;
  }

  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return new Date(parsed + minutes * 60000).toISOString();
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
        lastTrigger: options.trigger || 'manual',
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

async function fetchPlayStoreHtml(path: string, country: string, retries = 2, timeoutMs = PLAY_STORE_FETCH_TIMEOUT_MS) {
  const gl = country.toUpperCase();
  const url = new URL(`https://play.google.com${path}`);
  if (!url.searchParams.has('hl')) url.searchParams.set('hl', 'en_US');
  if (!url.searchParams.has('gl')) url.searchParams.set('gl', gl);

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`Google Play returned HTTP ${response.status}`);
      }

      const html = await response.text();
      return { status: response.status, html, url: url.toString() };
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        // Wait a bit before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  
  throw lastError;
}

function parsePlayStoreSearchResults(html: string) {
  const results: any[] = [];
  const seen = new Set<string>();
  const pushResult = (appId: string, title: string, developer: string, score: number, icon: string) => {
    if (!appId || !title || seen.has(appId)) return;

    seen.add(appId);
    results.push({
      appId,
      title,
      developer,
      score,
      icon,
      url: `https://play.google.com/store/apps/details?id=${encodeURIComponent(appId)}`,
      genre: '',
    });
  };

  const anchorPattern = /<a href="\/store\/apps\/details\?id=([^"&]+)"[^>]*aria-label="([^"]*)"[^>]*class="([^"]*)"/g;
  const matches = Array.from(html.matchAll(anchorPattern));

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const appId = decodeURIComponent(match[1]);

    const blockStart = match.index ?? 0;
    const nextMatch = matches[i + 1];
    const blockEnd = nextMatch?.index ?? Math.min(html.length, blockStart + 6000);
    const block = html.slice(blockStart, blockEnd);

    const iconMatch = block.match(/<img src="([^"]+)"[^>]*class="T75of[^"]*"/i);
    const titleMatch =
      block.match(/<div class="vWM94c">([\s\S]*?)<\/div>/i) ||
      block.match(/<span class="DdYX5">([\s\S]*?)<\/span>/i);
    const developerMatch =
      block.match(/<div class="LbQbAe">([\s\S]*?)<\/div>/i) ||
      block.match(/<span class="wMUdtb">([\s\S]*?)<\/span>/i);
    const scoreMatch =
      block.match(/aria-label="Rated ([\d.]+) stars out of five stars"/i) ||
      block.match(/<span class="w2kbF">([\d.]+)<\/span>/i);

    const title = decodeHtmlEntities((titleMatch?.[1] || match[2] || '').trim());
    const developer = decodeHtmlEntities((developerMatch?.[1] || '').trim());
    const icon = iconMatch?.[1] || '';
    const score = scoreMatch ? Number(scoreMatch[1]) : 0;

    pushResult(appId, title, developer, score, icon);
  }

  const legacyPattern = /<a class="Si6A0c Gy4nib" href="\/store\/apps\/details\?id=([^"&]+)[^"]*"[\s\S]*?<img src="([^"]+)"[^>]*class="T75of stzEZd"[\s\S]*?<span class="DdYX5">([\s\S]*?)<\/span>[\s\S]*?<span class="wMUdtb">([\s\S]*?)<\/span>[\s\S]*?<span class="w2kbF">([\d.]+)<\/span>/g;
  for (const match of html.matchAll(legacyPattern)) {
    pushResult(
      decodeURIComponent(match[1]),
      decodeHtmlEntities(match[3].trim()),
      decodeHtmlEntities(match[4].trim()),
      Number(match[5]),
      match[2],
    );
  }

  return results;
}

function parsePlayStoreAppDetails(html: string, appId: string) {
  const titleMatch = html.match(/<span class="AfwdI" itemprop="name">([^<]+)<\/span>/i) || html.match(/<meta property="og:title" content="([^"]+?) - Apps on Google Play"/i);
  const developerMatch = html.match(/<a href="\/store\/apps\/dev\?id=[^"]+">\s*<span>([^<]+)<\/span><\/a>/i);
  const scoreMatch = html.match(/aria-label="Rated ([\d.]+) stars out of five stars"/i);
  const descriptionMatch = html.match(/<meta name="description" property="og:description" content="([^"]*)"/i);
  const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
  const installsMatch = html.match(/"(\d[\d,+]*)",null,""/i);
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
    installs: installsMatch?.[1] || undefined,
    genre: genreMatch ? decodeHtmlEntities(genreMatch[1]) : undefined,
    url: `https://play.google.com/store/apps/details?id=${encodeURIComponent(appId)}`,
  };
}

async function searchGooglePlayWeb(term: string, country: string, num: number, retries = 2, timeoutMs = PLAY_STORE_FETCH_TIMEOUT_MS) {
  const { html } = await fetchPlayStoreHtml(`/store/search?c=apps&q=${encodeURIComponent(term)}`, country, retries, timeoutMs);
  return parsePlayStoreSearchResults(html).slice(0, num);
}

async function searchGooglePlayScraper(
  term: string,
  country: string,
  num: number,
  requestOptions: any,
  deadlineAt: number,
  failureMessage: string,
) {
  return runWithDeadline<any[]>(
    () => gplay.search({ term, country, num, requestOptions }),
    deadlineAt,
    failureMessage,
  );
}

function parsePlayStoreRankFromHtml(html: string, targetAppId: string, depth: number) {
  const seen = new Set<string>();
  const appLinkPattern = /\/store\/apps\/details\?id=([^"&\\]+)/g;
  let match: RegExpExecArray | null;

  while ((match = appLinkPattern.exec(html)) !== null) {
    const appId = decodeURIComponent(match[1]);
    if (!appId || seen.has(appId)) continue;

    seen.add(appId);
    if (String(appId) === String(targetAppId)) {
      return seen.size;
    }

    if (seen.size >= depth) {
      return -1;
    }
  }

  if (seen.size === 0) {
    throw new Error('Play Store web search returned 0 results. Possible HTML structure change or captcha.');
  }

  return -1;
}

async function getGooglePlayRankWeb(keyword: string, appId: string, country: string, depth: number) {
  const { html } = await fetchPlayStoreHtml(
    `/store/search?c=apps&q=${encodeURIComponent(keyword)}`,
    country,
    1,
    RANKING_FETCH_TIMEOUT_MS,
  );
  return parsePlayStoreRankFromHtml(html, appId, depth);
}

async function getGooglePlayRankViaSearch(
  keyword: string,
  appId: string,
  country: string,
  depth: number,
  requestOptions: any,
  deadlineAt: number,
  failureMessage: string,
) {
  const results = await searchGooglePlayScraper(
    keyword,
    country,
    depth,
    requestOptions,
    deadlineAt,
    failureMessage,
  );
  const index = results.findIndex(
    (app) => String(app.appId) === String(appId) || String(app.id) === String(appId),
  );
  return index === -1 ? -1 : index + 1;
}

async function getGooglePlayRankWithFallback(
  keyword: string,
  appId: string,
  country: string,
  depth: number,
  deadlineAt: number,
  failureMessage: string,
  contextLabel: 'discovery' | 'ranking',
) {
  try {
    return await getGooglePlayRankWeb(keyword, appId, country, depth);
  } catch (error) {
    if (!googlePlayProxyRequestOptions.agent) {
      throw error;
    }

    console.warn(
      `[${contextLabel}] Direct rank lookup failed for "${keyword}", retrying via proxy.`,
    );
    return await getGooglePlayRankViaSearch(
      keyword,
      appId,
      country,
      depth,
      googlePlayProxyRequestOptions,
      deadlineAt,
      failureMessage,
    );
  }
}

async function getGooglePlayAppWeb(appId: string, country: string) {
  const { html, status } = await fetchPlayStoreHtml(`/store/apps/details?id=${encodeURIComponent(appId)}`, country);
  if (status >= 400) {
    throw new Error(`Play Store app page returned ${status}`);
  }

  return parsePlayStoreAppDetails(html, appId);
}

async function searchStore(
  term: string,
  storeType: StoreType,
  country: string,
  num: number,
  options?: {
    webFallbackOnEmpty?: boolean;
    webFallbackOnError?: boolean;
    useFailureCache?: boolean;
    preferDirectFirst?: boolean;
    proxyFallbackOnError?: boolean;
    proxyFallbackOnEmpty?: boolean;
  },
  deadlineAt = getUpstreamDeadline(),
): Promise<any[]> {
  const cacheKey = `search:${storeType}:${country}:${num}:${normalizeKeyword(term)}`;
  const cachedResults = searchCache.get<any[]>(cacheKey);
  if (cachedResults) {
    return cachedResults;
  }

  const failureCacheKey = `search-failure:${storeType}:${country}:${num}:${normalizeKeyword(term)}`;
  const useFailureCache = options?.useFailureCache !== false;
  const cachedFailure = useFailureCache ? getCachedFailure(failureCacheKey) : null;
  if (cachedFailure) {
    throw cachedFailure;
  }

  const failureMessage = 'The app store search is taking too long. Please try again.';

  try {
    if (storeType === 'ios') {
      const results = await runWithDeadline<any[]>(
        () => store.search({ term, country, num, requestOptions: appStoreRequestOptions }),
        deadlineAt,
        failureMessage,
      );
      searchCache.set(cacheKey, results);
      upstreamFailureCache.del(failureCacheKey);
      return results;
    }

    const preferDirectFirst = options?.preferDirectFirst === true;
    const canUseProxyFallback =
      Boolean(googlePlayProxyRequestOptions.agent) &&
      (options?.proxyFallbackOnError !== false || options?.proxyFallbackOnEmpty !== false);

    let results: any[];
    if (preferDirectFirst) {
      try {
        results = await searchGooglePlayScraper(
          term,
          country,
          num,
          googlePlayDirectRequestOptions,
          deadlineAt,
          failureMessage,
        );
      } catch (error) {
        if (!canUseProxyFallback || options?.proxyFallbackOnError === false) {
          throw error;
        }

        console.warn(`Direct Google Play discovery search failed for "${term}", retrying via proxy.`);
        results = await searchGooglePlayScraper(
          term,
          country,
          num,
          googlePlayProxyRequestOptions,
          deadlineAt,
          failureMessage,
        );
      }

      if (
        Array.isArray(results) &&
        results.length === 0 &&
        canUseProxyFallback &&
        options?.proxyFallbackOnEmpty !== false
      ) {
        console.warn(`Direct Google Play discovery search returned 0 results for "${term}", retrying via proxy.`);
        results = await searchGooglePlayScraper(
          term,
          country,
          num,
          googlePlayProxyRequestOptions,
          deadlineAt,
          failureMessage,
        );
      }
    } else {
      results = await searchGooglePlayScraper(
        term,
        country,
        num,
        googlePlayProxyRequestOptions.agent ? googlePlayProxyRequestOptions : googlePlayDirectRequestOptions,
        deadlineAt,
        failureMessage,
      );
    }

    if (Array.isArray(results) && results.length > 0) {
      searchCache.set(cacheKey, results);
      upstreamFailureCache.del(failureCacheKey);
      return results;
    }

    if (Array.isArray(results) && options?.webFallbackOnEmpty === false) {
      searchCache.set(cacheKey, results);
      upstreamFailureCache.del(failureCacheKey);
      return results;
    }

    if (options?.webFallbackOnEmpty !== false) {
      const fallbackResults = await runWithDeadline<any[]>(
        () => searchGooglePlayWeb(term, country, num),
        deadlineAt,
        failureMessage,
      );
      searchCache.set(cacheKey, fallbackResults);
      upstreamFailureCache.del(failureCacheKey);
      return fallbackResults;
    }

    upstreamFailureCache.del(failureCacheKey);
    return [];
  } catch (error) {
    if (storeType === 'ios' || options?.webFallbackOnError === false) {
      const apiError = normalizeApiError(error, failureMessage);
      if (useFailureCache) {
        cacheFailure(failureCacheKey, apiError);
      }
      throw apiError;
    }

    console.warn(`google-play-scraper search failed for "${term}", falling back to web parsing.`);
    try {
      const results = await runWithDeadline<any[]>(
        () => searchGooglePlayWeb(term, country, num),
        deadlineAt,
        failureMessage,
      );
      searchCache.set(cacheKey, results);
      upstreamFailureCache.del(failureCacheKey);
      return results;
    } catch (fallbackError) {
      const apiError = normalizeApiError(fallbackError, failureMessage);
      console.warn(`Web fallback search failed for "${term}":`, apiError.message);
      if (useFailureCache) {
        cacheFailure(failureCacheKey, apiError);
      }
      throw apiError;
    }
  }
}

function parseApproximateCount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/,/g, '');
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^(\d+(?:\.\d+)?)([kmb])?\+?$/i);
  if (!match) {
    return null;
  }

  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const suffix = match[2]?.toLowerCase();
  if (suffix === 'k') return numeric * 1_000;
  if (suffix === 'm') return numeric * 1_000_000;
  if (suffix === 'b') return numeric * 1_000_000_000;
  return numeric;
}

function readAppTitle(app: any) {
  return String(app?.title || app?.trackName || '').trim();
}

function readAppPublisher(app: any) {
  return String(
    app?.developer
      || app?.developerName
      || app?.artistName
      || app?.sellerName
      || '',
  ).trim();
}

function readAppCategory(app: any) {
  return String(
    app?.primaryGenre
      || app?.primaryGenreName
      || app?.genre
      || app?.genreId
      || app?.category
      || '',
  ).trim();
}

function readAppIdentifier(app: any, storeType: StoreType) {
  if (storeType === 'ios') {
    const value = app?.appId ?? app?.id ?? app?.trackId;
    return value !== undefined && value !== null ? String(value) : '';
  }

  const value = app?.appId ?? app?.id;
  return value !== undefined && value !== null ? String(value) : '';
}

function computePopularityProxy(app: any) {
  const installs = parseApproximateCount(app?.maxInstalls)
    ?? parseApproximateCount(app?.minInstalls)
    ?? parseApproximateCount(app?.installs);
  const reviews = parseApproximateCount(app?.reviews);
  const ratings = parseApproximateCount(app?.ratings);
  const score = typeof app?.score === 'number' && Number.isFinite(app.score)
    ? app.score
    : typeof app?.scoreText === 'number' && Number.isFinite(app.scoreText)
      ? app.scoreText
      : null;

  const installComponent = installs ? clamp(Math.log10(installs + 1) / 7, 0, 1) : 0;
  const reviewComponent = reviews ? clamp(Math.log10(reviews + 1) / 6, 0, 1) : 0;
  const ratingComponent = ratings ? clamp(Math.log10(ratings + 1) / 6.5, 0, 1) : 0;
  const scoreComponent = score ? clamp(score / 5, 0, 1) : 0;

  const popularity = clamp(
    (installComponent * 0.42)
      + (reviewComponent * 0.24)
      + (ratingComponent * 0.14)
      + (scoreComponent * 0.2),
    0,
    1,
  );

  const evidenceCount = [installs, reviews, ratings, score].filter((value) => value !== null).length;
  return {
    popularity,
    evidenceCount,
  };
}

async function buildPopularitySamplesForResults(
  results: any[],
  storeType: StoreType,
  country: string,
  enrichTopResults = false,
): Promise<Map<string, AppPopularitySample>> {
  const samples = new Map<string, AppPopularitySample>();
  const resultsWithIds = results
    .map((app) => ({
      app,
      id: readAppIdentifier(app, storeType),
    }))
    .filter((entry) => entry.id);

  const detailIds = enrichTopResults
    ? resultsWithIds.slice(0, 3).map((entry) => entry.id)
    : [];
  const detailById = new Map<string, any>();

  if (detailIds.length > 0) {
    const detailResponses = await Promise.allSettled(
      detailIds.map(async (id) => ({
        id,
        details: await getStoreAppDetails(id, storeType, country),
      })),
    );
    detailResponses.forEach((response) => {
      if (response.status === 'fulfilled') {
        detailById.set(response.value.id, response.value.details);
      }
    });
  }

  resultsWithIds.forEach(({ app, id }) => {
    const details = detailById.get(id);
    const source = details || app;
    const { popularity } = computePopularityProxy(source);
    samples.set(id, {
      popularity,
      hasDetail: Boolean(details),
      publisher: normalizeKeyword(readAppPublisher(source) || readAppPublisher(app)),
      category: normalizeKeyword(readAppCategory(source) || readAppCategory(app)),
      title: normalizeKeyword(readAppTitle(source) || readAppTitle(app)),
    });
  });

  return samples;
}

function computeKeywordMarketSampleFromResults(
  keyword: string,
  results: any[],
  context: Pick<KeywordContext, 'title' | 'category'>,
  popularitySamples?: Map<string, AppPopularitySample>,
  storeType?: StoreType,
): KeywordMarketSample | null {
  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  const keywordTokens = tokenize(keyword);
  const titleTokens = tokenize(context.title);
  const categoryTokens = new Set([
    ...tokenize(context.category),
    ...deriveCategoryHints(context.category).flatMap((hint) => tokenize(hint)),
  ]);
  const firstTokenCounts = new Map<string, number>();
  let exactPhraseMatches = 0;
  let prefixPhraseMatches = 0;
  let titleCoverageTotal = 0;
  let categoryAlignedResults = 0;
  let repeatedPhraseResults = 0;
  let genericResults = 0;
  let noisyResults = 0;
  let popularityTotal = 0;
  let strongestPopularity = 0;
  let detailBackedResults = 0;
  const publishers = new Set<string>();
  const normalizedTitles = new Set<string>();
  const normalizedCategories = new Set<string>();

  results.forEach((app: any) => {
    const title = readAppTitle(app);
    const normalizedTitle = normalizeKeyword(title);
    const resultTitleTokens = tokenize(title);
    const resultCategory = readAppCategory(app);
    const resultCategoryTokens = new Set(tokenize(resultCategory));
    const keywordTokenHits = keywordTokens.filter((token) => resultTitleTokens.includes(token)).length;
    titleCoverageTotal += keywordTokens.length > 0 ? keywordTokenHits / keywordTokens.length : 0;

    if (normalizedTitle === normalizeKeyword(keyword)) {
      exactPhraseMatches += 1;
    }
    if (normalizedTitle.startsWith(normalizeKeyword(keyword))) {
      prefixPhraseMatches += 1;
    }
    if (normalizedTitle.includes(normalizeKeyword(keyword))) {
      repeatedPhraseResults += 1;
    }
    if (resultTitleTokens.some((token) => HIGH_VOLUME_TERMS.has(token))) {
      genericResults += 1;
    }
    if (resultCategoryTokens.size > 0 && Array.from(resultCategoryTokens).some((token) => categoryTokens.has(token))) {
      categoryAlignedResults += 1;
    }
    if (keywordTokenHits === 0 && normalizedTitle !== normalizeKeyword(keyword)) {
      noisyResults += 1;
    }

    const firstToken = resultTitleTokens[0];
    if (firstToken) {
      firstTokenCounts.set(firstToken, (firstTokenCounts.get(firstToken) || 0) + 1);
    }

    if (normalizedTitle) {
      normalizedTitles.add(normalizedTitle);
    }
    const publisher = normalizeKeyword(readAppPublisher(app));
    if (publisher) {
      publishers.add(publisher);
    }
    const normalizedCategory = normalizeKeyword(resultCategory);
    if (normalizedCategory) {
      normalizedCategories.add(normalizedCategory);
    }

    if (popularitySamples && storeType) {
      const appId = readAppIdentifier(app, storeType);
      const popularitySample = appId ? popularitySamples.get(appId) : undefined;
      if (popularitySample) {
        popularityTotal += popularitySample.popularity;
        strongestPopularity = Math.max(strongestPopularity, popularitySample.popularity);
        if (popularitySample.hasDetail) {
          detailBackedResults += 1;
        }
        if (popularitySample.publisher) {
          publishers.add(popularitySample.publisher);
        }
        if (popularitySample.category) {
          normalizedCategories.add(popularitySample.category);
        }
        if (popularitySample.title) {
          normalizedTitles.add(popularitySample.title);
        }
      }
    }
  });

  const maxFirstTokenCount = Math.max(0, ...firstTokenCounts.values());
  const firstTokenDominance = results.length > 0 ? maxFirstTokenCount / results.length : 0;
  const genericTitleSpread = results.length > 0 ? genericResults / results.length : 0;
  const titleBrandOverlap = keywordTokens.length > 0
    ? keywordTokens.filter((token) => titleTokens.includes(token)).length / keywordTokens.length
    : 0;

  return {
    keyword: normalizeKeyword(keyword),
    resultCount: results.length,
    resultDensity: Math.min(1, results.length / 10),
    exactPhraseRate: exactPhraseMatches / results.length,
    prefixPhraseRate: prefixPhraseMatches / results.length,
    titleTokenSaturation: titleCoverageTotal / results.length,
    categoryConsistency: categoryAlignedResults / results.length,
    firstTokenDominance,
    genericSpread: Math.max(0, genericTitleSpread - (titleBrandOverlap * 0.25)),
    repeatedPhraseRate: repeatedPhraseResults / results.length,
    popularityScore: results.length > 0 ? popularityTotal / results.length : 0,
    publisherDiversity: results.length > 0 ? publishers.size / results.length : 0,
    titleDiversity: results.length > 0 ? normalizedTitles.size / results.length : 0,
    categoryDiversity: results.length > 0 ? normalizedCategories.size / results.length : 0,
    topResultDominance: popularityTotal > 0 ? strongestPopularity / popularityTotal : 0,
    detailCoverage: Math.min(1, detailBackedResults / Math.min(results.length, 3)),
    resultNoise: results.length > 0 ? noisyResults / results.length : 0,
  };
}

async function getStoreAppDetails(
  appId: string,
  storeType: StoreType,
  country: string,
  deadlineAt = getUpstreamDeadline(),
) {
  const cacheKey = `app:${storeType}:${country}:${appId}`;
  const cachedDetails = appDetailsCache.get<any>(cacheKey);
  if (cachedDetails) {
    return cachedDetails;
  }

  const failureCacheKey = `app-failure:${storeType}:${country}:${appId}`;
  const cachedFailure = getCachedFailure(failureCacheKey);
  if (cachedFailure) {
    throw cachedFailure;
  }

  let details: any;
  const failureMessage = 'The app store details request is taking too long. Please try again.';
  try {
    if (storeType === 'ios') {
      details = await runWithDeadline(
        () => store.app({ id: appId, country, requestOptions: appStoreRequestOptions }),
        deadlineAt,
        failureMessage,
      );
    } else {
      try {
        details = await runWithDeadline(
          () => gplay.app({ appId, country, requestOptions: googlePlayDefaultRequestOptions }),
          deadlineAt,
          failureMessage,
        );
      } catch (error) {
        console.warn(`google-play-scraper app lookup failed for "${appId}", falling back to web parsing.`, error);
      }

      if (!details) {
        details = await runWithDeadline(
          () => getGooglePlayAppWeb(appId, country),
          deadlineAt,
          failureMessage,
        );
      }
    }

    appDetailsCache.set(cacheKey, details);
    upstreamFailureCache.del(failureCacheKey);
    return details;
  } catch (error) {
    const apiError = normalizeApiError(error, failureMessage);
    cacheFailure(failureCacheKey, apiError);
    throw apiError;
  }
}

async function getKeywordRank(
  keyword: string,
  appId: string,
  storeType: StoreType,
  country: string,
  refresh = false,
  depth = DEFAULT_RANKING_DEPTH,
  deadlineAt = getUpstreamDeadline(),
) {
  const rankingDepth = normalizeRankingDepth(depth);
  const cacheKey = `${storeType}-${country}-${appId}-${keyword}-${rankingDepth}`;
  const cachedRank = rankingCache.get<number>(cacheKey);
  if (cachedRank !== undefined && !refresh) {
    return cachedRank;
  }

  const failureCacheKey = `ranking-failure:${storeType}:${country}:${appId}:${normalizeKeyword(keyword)}:${rankingDepth}`;
  const useFailureCache = !refresh;
  const cachedFailure = useFailureCache ? getCachedFailure(failureCacheKey) : null;
  if (cachedFailure) {
    throw cachedFailure;
  }

  let rank = -1;
  const failureMessage = 'The keyword ranking request is taking too long. Please try again.';

  try {
    if (storeType === 'ios') {
      const results = await runWithDeadline<any[]>(
        () => store.search({
          term: keyword,
          num: rankingDepth,
          country,
          requestOptions: appStoreRequestOptions,
        }),
        deadlineAt,
        failureMessage,
      );
      const index = results.findIndex((app) => String(app.appId) === String(appId) || String(app.id) === String(appId));
      rank = index !== -1 ? index + 1 : -1;
    } else {
      rank = await getGooglePlayRankWithFallback(
        keyword,
        appId,
        country,
        rankingDepth,
        deadlineAt,
        failureMessage,
        'ranking',
      );
    }
  } catch (error) {
    const apiError = normalizeApiError(error, failureMessage);
    if (useFailureCache) {
      cacheFailure(failureCacheKey, apiError);
    }
    throw apiError;
  }

  rankingCache.set(cacheKey, rank);
  upstreamFailureCache.del(failureCacheKey);
  return rank;
}

async function listenOnAvailablePort(
  app: express.Express,
  preferredPort: number,
  host: string,
  maxAttempts = 10,
) {
  let port = preferredPort;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const server = await new Promise<Server>((resolve, reject) => {
        const nextServer = app.listen(port, host);
        nextServer.setTimeout(10 * 60 * 1000);
        const handleListening = () => {
          nextServer.off('error', handleError);
          resolve(nextServer);
        };
        const handleError = (error: unknown) => {
          nextServer.off('listening', handleListening);
          reject(error);
        };

        nextServer.once('listening', handleListening);
        nextServer.once('error', handleError);
      });

      return { server, port };
    } catch (error: any) {
      if (error?.code !== 'EADDRINUSE') {
        throw error;
      }

      lastError = error;
      console.warn(`Port ${port} is already in use. Retrying on ${port + 1}.`);
      port += 1;
    }
  }

  throw lastError ?? new Error(`Unable to bind a server port starting from ${preferredPort}`);
}

async function refreshTrackedKeywordState(
  state: TrackingState,
  options?: {
    updateScheduleMetadata?: boolean;
    runKey?: string;
  },
) {
  if (!state.trackedKeywords.length) {
    return {
      nextState: {
        trackedKeywords: [],
        rankHistory: state.rankHistory,
        schedule: options?.updateScheduleMetadata
          ? {
              ...state.schedule,
              lastRunAt: new Date().toISOString(),
              lastRunKey: options.runKey ?? state.schedule.lastRunKey,
            }
          : state.schedule,
      },
      checked: 0,
      changed: 0,
      failed: 0,
    };
  }

  const refreshResults = await mapWithConcurrency(
    state.trackedKeywords,
    TRACKING_REFRESH_CONCURRENCY,
    (trackedKeyword) => refreshTrackedKeywordRecord(trackedKeyword),
  );

  const changed = refreshResults.filter((result) => result.previousRank !== result.trackedKeyword.lastRank).length;
  const failed = refreshResults.filter((result) => result.hadError).length;

  return {
    nextState: {
      trackedKeywords: refreshResults.map((result) => result.trackedKeyword),
      rankHistory: mergeRankHistory(
        state.rankHistory,
        refreshResults.flatMap((result) => (result.historyEntry ? [result.historyEntry] : [])),
      ),
      schedule: options?.updateScheduleMetadata
        ? {
            ...state.schedule,
            lastRunAt: new Date().toISOString(),
            lastRunKey: options.runKey ?? state.schedule.lastRunKey,
          }
        : state.schedule,
    },
    checked: refreshResults.length,
    changed,
    failed,
  };
}

async function refreshCompetitorTrackedKeywordState(
  state: TrackingState,
  options?: {
    updateScheduleMetadata?: boolean;
    runKey?: string;
  },
) {
  if (!state.competitorTrackedKeywords.length) {
    return {
      nextState: {
        competitorTrackedKeywords: [],
        competitorRankHistory: state.competitorRankHistory,
        schedule: options?.updateScheduleMetadata
          ? {
              ...state.schedule,
              lastRunAt: new Date().toISOString(),
              lastRunKey: options.runKey ?? state.schedule.lastRunKey,
            }
          : state.schedule,
      },
      checked: 0,
      changed: 0,
      failed: 0,
    };
  }

  const refreshResults = await mapWithConcurrency(
    state.competitorTrackedKeywords,
    TRACKING_REFRESH_CONCURRENCY,
    async (trackedKeyword) => {
      const refreshedAt = new Date().toISOString();
      const appResults = await Promise.all(
        trackedKeyword.apps.map(async (app) => {
          try {
            const rank = await getKeywordRank(
              trackedKeyword.keyword,
              app.appId,
              trackedKeyword.store,
              trackedKeyword.country,
              true,
              TRACKED_KEYWORD_RANKING_DEPTH,
            );

            return {
              previousRank: app.lastRank,
              app: {
                ...app,
                lastRank: rank,
                lastChecked: refreshedAt,
                lastCheckStatus: rank === -1 ? ('not_ranked' as const) : ('ok' as const),
                lastError: undefined,
              },
              historyEntry: {
                trackedKeywordId: trackedKeyword.trackedKeywordId,
                groupId: trackedKeyword.groupId,
                keyword: trackedKeyword.keyword,
                appId: app.appId,
                appKey: app.appKey,
                store: trackedKeyword.store,
                country: trackedKeyword.country,
                rank,
                rankDepth: TRACKED_KEYWORD_RANKING_DEPTH,
                timestamp: refreshedAt,
              } satisfies CompetitorRankHistoryRecord,
              hadError: false,
            };
          } catch (error) {
            console.warn(
              `Competitor tracked keyword refresh failed for "${trackedKeyword.keyword}" [${trackedKeyword.country}] / ${app.title}`,
              error,
            );
            return {
              previousRank: app.lastRank,
              app: {
                ...app,
                lastChecked: refreshedAt,
                lastCheckStatus: 'error' as const,
                lastError: normalizeApiError(error, 'Competitor keyword check failed.').message,
              },
              historyEntry: null,
              hadError: true,
            };
          }
        }),
      );

      return {
        trackedKeyword: {
          ...trackedKeyword,
          apps: appResults.map((result) => result.app),
          updatedAt: refreshedAt,
          lastCheckedAt: refreshedAt,
        },
        historyEntries: appResults.flatMap((result) => (result.historyEntry ? [result.historyEntry] : [])),
        changed: appResults.filter((result) => result.previousRank !== result.app.lastRank).length,
        failed: appResults.filter((result) => result.hadError).length,
      };
    },
  );

  return {
    nextState: {
      competitorTrackedKeywords: mergeCompetitorTrackedKeywords(
        state.competitorTrackedKeywords,
        refreshResults.map((result) => result.trackedKeyword),
      ),
      competitorRankHistory: mergeCompetitorRankHistory(
        state.competitorRankHistory,
        refreshResults.flatMap((result) => result.historyEntries),
      ),
      schedule: options?.updateScheduleMetadata
        ? {
            ...state.schedule,
            lastRunAt: new Date().toISOString(),
            lastRunKey: options.runKey ?? state.schedule.lastRunKey,
          }
        : state.schedule,
    },
    checked: refreshResults.reduce((sum, result) => sum + result.trackedKeyword.apps.length, 0),
    changed: refreshResults.reduce((sum, result) => sum + result.changed, 0),
    failed: refreshResults.reduce((sum, result) => sum + result.failed, 0),
  };
}

async function refreshAllTrackingState(
  state: TrackingState,
  options?: {
    updateScheduleMetadata?: boolean;
    runKey?: string;
  },
) {
  return refreshSharedAllTrackingState(
    state,
    {
      rankingDepth: TRACKED_KEYWORD_RANKING_DEPTH,
      getKeywordRank,
      normalizeTrackedKeywordError: (error) =>
        normalizeApiError(error, 'Tracked keyword check failed.').message,
      normalizeCompetitorTrackedKeywordError: (error) =>
        normalizeApiError(error, 'Competitor keyword check failed.').message,
    },
    options,
  );
}

async function captureCompetitorAsoState(
  userDocRef: DocumentReference<DocumentData>,
  state: Pick<
    NormalizedUserTrackingDocument,
    'competitorGroups' | 'competitorTrackedKeywords' | 'competitorAsoLatestSnapshots' | 'alertRules' | 'notificationSettings'
  >,
  runKey: string,
) {
  if (!state.competitorGroups.length) {
    return {
      nextLatestSnapshots: [] as CompetitorAsoSnapshotRecord[],
      diffs: [] as CompetitorAsoDiffRecord[],
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
      .filter((snapshot) =>
        allowedKeys.has(
          getComparableCompetitorAsoSnapshotKey(snapshot),
        ),
      )
      .map((snapshot) => [getComparableCompetitorAsoSnapshotKey(snapshot), snapshot]),
  );

  let checked = 0;
  let failed = 0;
  const createdDiffs: CompetitorAsoDiffRecord[] = [];

  await mapWithConcurrency(state.competitorGroups, 1, async (group) => {
    const trackedCountries = getCompetitorTrackedCountriesForGroup(
      group,
      state.competitorTrackedKeywords,
    );
    await mapWithConcurrency(trackedCountries, 1, async (trackedCountry) => {
      await mapWithConcurrency(group.competitors, 2, async (app) => {
        const capturedAt = new Date().toISOString();
        try {
          const details = await getStoreAppDetails(
            app.appId,
            group.store,
            trackedCountry,
            getUpstreamDeadline(45000),
          );
          const payload = normalizeCompetitorAsoSnapshotPayload(details, group.store);
          if (!payload.title) {
            payload.title = app.title;
          }
          const snapshot: CompetitorAsoSnapshotRecord = {
            snapshotId: buildCompetitorAsoSnapshotId(
              group.groupId,
              app.appId,
              trackedCountry,
              capturedAt,
            ),
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
            `Competitor ASO snapshot failed for "${app.title}" [${trackedCountry}]`,
            normalizeApiError(error, 'Competitor ASO fetch failed.').message,
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
    nextLatestSnapshots: Array.from(latestByKey.values()).sort((a, b) =>
      new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
    ),
    diffs: createdDiffs,
    createdEvents,
    checked,
    changed: createdDiffs.length,
    failed,
  };
}

function sanitizeCompetitorAsoDiffRecord(
  input: unknown,
): CompetitorAsoDiffRecord | null {
  if (!input || typeof input !== 'object') {
    return null;
  }
  const candidate = input as Partial<CompetitorAsoDiffRecord>;
  if (
    typeof candidate.diffId !== 'string' ||
    !candidate.diffId.trim() ||
    typeof candidate.groupId !== 'string' ||
    !candidate.groupId.trim() ||
    typeof candidate.appId !== 'string' ||
    !candidate.appId.trim() ||
    typeof candidate.appKey !== 'string' ||
    !candidate.appKey.trim() ||
    typeof candidate.appTitle !== 'string' ||
    !candidate.appTitle.trim()
  ) {
    return null;
  }
  const changes = Array.isArray(candidate.changes)
    ? candidate.changes.flatMap((change) => {
        if (!change || typeof change !== 'object') {
          return [];
        }
        const candidateChange = change as Partial<CompetitorAsoFieldChange>;
        if (
          candidateChange.field !== 'title' &&
          candidateChange.field !== 'description' &&
          candidateChange.field !== 'icon' &&
          candidateChange.field !== 'category' &&
          candidateChange.field !== 'screenshots'
        ) {
          return [];
        }
        const normalizeValue = (value: unknown) => {
          if (Array.isArray(value)) {
            return value.filter((entry): entry is string => typeof entry === 'string');
          }
          return typeof value === 'string' ? value : null;
        };
        return [{
          field: candidateChange.field,
          previousValue: normalizeValue(candidateChange.previousValue),
          currentValue: normalizeValue(candidateChange.currentValue),
          summary:
            typeof candidateChange.summary === 'string'
              ? candidateChange.summary
              : buildCompetitorAsoFieldSummary(
                  candidateChange.field,
                  normalizeValue(candidateChange.previousValue),
                  normalizeValue(candidateChange.currentValue),
                ),
        }];
      })
    : [];

  return {
    diffId: candidate.diffId,
    groupId: candidate.groupId,
    appId: candidate.appId,
    appKey: candidate.appKey,
    appTitle: candidate.appTitle.trim(),
    store: candidate.store === 'ios' ? 'ios' : 'android',
    country: normalizeCountryCode(candidate.country, 'us'),
    detectedAt:
      typeof candidate.detectedAt === 'string' && candidate.detectedAt
        ? candidate.detectedAt
        : new Date(0).toISOString(),
    previousSnapshotId:
      typeof candidate.previousSnapshotId === 'string'
        ? candidate.previousSnapshotId
        : '',
    currentSnapshotId:
      typeof candidate.currentSnapshotId === 'string'
        ? candidate.currentSnapshotId
        : '',
    changedFields: Array.isArray(candidate.changedFields)
      ? candidate.changedFields.filter(
          (field): field is CompetitorAsoFieldName =>
            field === 'title' ||
            field === 'description' ||
            field === 'icon' ||
            field === 'category' ||
            field === 'screenshots',
        )
      : changes.map((change) => change.field),
    changes,
  };
}

function buildCompetitorAsoSummary(diffs: CompetitorAsoDiffRecord[]) {
  const fieldCounts: Record<CompetitorAsoFieldName, number> = {
    title: 0,
    description: 0,
    icon: 0,
    category: 0,
    screenshots: 0,
  };
  const appCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();

  diffs.forEach((diff) => {
    appCounts.set(
      diff.appTitle,
      (appCounts.get(diff.appTitle) || 0) + 1,
    );
    countryCounts.set(
      diff.country,
      (countryCounts.get(diff.country) || 0) + 1,
    );
    diff.changedFields.forEach((field) => {
      fieldCounts[field] += 1;
    });
  });

  const toBuckets = (entries: Map<string, number>) =>
    Array.from(entries.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
      .slice(0, 8);

  return {
    totalDiffs: diffs.length,
    changedApps: appCounts.size,
    changedCountries: countryCounts.size,
    latestDetectedAt: diffs[0]?.detectedAt,
    fieldCounts,
    topApps: toBuckets(appCounts),
    topCountries: toBuckets(countryCounts),
  };
}

async function runTrackedKeywordRefreshJob(options?: {
  updateScheduleMetadata?: boolean;
  runKey?: string;
}) {
  if (scheduledTrackingRunPromise) {
    return scheduledTrackingRunPromise;
  }

  scheduledTrackingRunPromise = (async () => {
    const state = await loadTrackingState();
    const refreshed = await refreshAllTrackingState(state, options);
    const updatedState = await updateTrackingState((currentState) => ({
      trackedKeywords: refreshed.nextState.trackedKeywords,
      rankHistory: refreshed.nextState.rankHistory,
      competitorTrackedKeywords: refreshed.nextState.competitorTrackedKeywords,
      competitorRankHistory: refreshed.nextState.competitorRankHistory,
      competitorGroups: currentState.competitorGroups,
      competitorGroupSnapshots: currentState.competitorGroupSnapshots,
      competitorAsoLatestSnapshots: currentState.competitorAsoLatestSnapshots,
      schedule: refreshed.nextState.schedule,
    }));

    return {
      checked: refreshed.checked,
      changed: refreshed.changed,
      failed: refreshed.failed,
    };
  })();

  try {
    return await scheduledTrackingRunPromise;
  } finally {
    scheduledTrackingRunPromise = null;
  }
}

async function maybeRunScheduledTrackingCheck() {
  const state = await loadTrackingState();
  const schedule = normalizeTrackingSchedule(state.schedule);
  if (
    !schedule.enabled ||
    (!state.trackedKeywords.length && !state.competitorTrackedKeywords.length)
  ) {
    return;
  }

  const [scheduledHour, scheduledMinute] = schedule.time.split(':').map(Number);
  const now = new Date();
  const currentTime = getZonedDateParts(now, schedule.timezone);
  if (currentTime.hour !== scheduledHour || currentTime.minute !== scheduledMinute) {
    return;
  }

  const runKey = getScheduleRunKey(now, schedule);
  if (schedule.lastRunKey === runKey) {
    return;
  }

  try {
    await runTrackedKeywordRefreshJob({
      updateScheduleMetadata: true,
      runKey,
    });
  } catch (error) {
    console.error('Scheduled tracked keyword refresh failed:', error);
  }
}

async function runAllUserTrackingSchedules(
  runKey: string,
  options?: {
    force?: boolean;
  },
): Promise<DailyTrackingSummary> {
  if (userTrackingSchedulerPromise) {
    return userTrackingSchedulerPromise;
  }

  userTrackingSchedulerPromise = (async () => {
    const adminDb = getFirebaseAdminDb();
    if (!adminDb) {
      return getEmptyDailyTrackingSummary();
    }

    const statusRef = adminDb.doc('system/dailyTracking');
    const snapshot = await adminDb.collection('users').get();
    const now = new Date();
    let ran = 0;
    let checked = 0;
    let changed = 0;
    let failed = 0;
    let asoChecked = 0;
    let asoChanged = 0;
    let asoFailed = 0;

    await mapWithConcurrency(snapshot.docs, 1, async (userDoc) => {
      await refreshDailyTrackingLease(statusRef, DAILY_TRACKING_LEASE_OWNER);
      const userData = userDoc.data() as UserTrackingDocument | undefined;
      const state = normalizeUserTrackingDocument(userData);
      if (
        !state.trackedKeywords.length &&
        !state.competitorTrackedKeywords.length &&
        !state.competitorGroups.length
      ) {
        return;
      }

      const schedule = normalizeTrackingSchedule(state.schedule);
      if (!schedule.enabled) {
        return;
      }
      if (!options?.force && schedule.lastRunKey === runKey) {
        return;
      }

      const planLimits = getResolvedPlanLimits(userData);
      const { scopedState, activity } = getTrackedKeywordScopedState(state, planLimits);
      const refreshed = await refreshAllTrackingState(scopedState, {
        updateScheduleMetadata: true,
        runKey,
      });
      const nextTrackedKeywords = mergeTrackedKeywords(
        state.trackedKeywords,
        refreshed.nextState.trackedKeywords,
      );
      const nextCompetitorTrackedKeywords = mergeCompetitorTrackedKeywords(
        state.competitorTrackedKeywords,
        refreshed.nextState.competitorTrackedKeywords,
      );
      const { updatedRules: updatedAlertRules } = await evaluateAndDispatchAlertRules(
        userDoc.ref,
        state.trackedKeywords,
        nextTrackedKeywords,
        state.alertRules,
        state.notificationSettings,
        runKey,
      );
      const asoResult = await captureCompetitorAsoState(
        userDoc.ref,
        {
          competitorGroups: state.competitorGroups,
          competitorTrackedKeywords: nextCompetitorTrackedKeywords,
          competitorAsoLatestSnapshots: state.competitorAsoLatestSnapshots,
          alertRules: updatedAlertRules,
          notificationSettings: state.notificationSettings,
        },
        runKey,
      );
      const retainedRankHistory = await archiveAndTrimTrackedRankHistory(
        userDoc.ref,
        refreshed.nextState.rankHistory,
      );
      const retainedCompetitorRankHistory = await archiveAndTrimCompetitorRankHistory(
        userDoc.ref,
        refreshed.nextState.competitorRankHistory,
      );

      await userDoc.ref.set({
        trackedKeywords: nextTrackedKeywords,
        rankHistory: retainedRankHistory,
        competitorTrackedKeywords: nextCompetitorTrackedKeywords,
        competitorRankHistory: retainedCompetitorRankHistory,
        competitorAsoLatestSnapshots: asoResult.nextLatestSnapshots,
        trackingSchedule: refreshed.nextState.schedule,
        alertRules: updatedAlertRules,
        updatedAt: new Date().toISOString(),
      } satisfies UserTrackingDocument, { merge: true });

      ran += 1;
      checked += activity.activeTrackedKeywords;
      changed += refreshed.changed;
      failed += refreshed.failed;
      asoChecked += asoResult.checked;
      asoChanged += asoResult.changed;
      asoFailed += asoResult.failed;
    });

    return {
      scanned: snapshot.size,
      ran,
      checked,
      changed,
      failed,
      asoChecked,
      asoChanged,
      asoFailed,
    };
  })();

  try {
    return await userTrackingSchedulerPromise;
  } finally {
    userTrackingSchedulerPromise = null;
  }
}

async function runAndPersistAllUserTrackingSchedules(
  runKey: string,
  options?: {
    force?: boolean;
    trigger?: 'automatic' | 'manual' | 'watchdog';
  },
) {
  const adminDb = getFirebaseAdminDb();
  if (!adminDb) {
    throw createConfigurationError('Firebase Admin is not configured on the server.');
  }

  const statusRef = adminDb.doc('system/dailyTracking');
  const lease = await acquireDailyTrackingLease(
    statusRef,
    {
      runKey,
      ownerId: DAILY_TRACKING_LEASE_OWNER,
      force: options?.force,
      trigger: options?.trigger,
    },
  );
  if (!lease.acquired) {
    console.log(
      `[tracking] Skipping run ${runKey}; ${lease.reason}.`,
    );
    return readDailyTrackingSummaryFromStatus(lease.statusData);
  }

  const startedAt = new Date().toISOString();

  const startMs = Date.now();
  try {
    const summary = await runAllUserTrackingSchedules(runKey, {
      force: options?.force,
    });
    const finalStatus = getDailyTrackingFinalStatus(summary);
    const finishedAt = new Date().toISOString();
    await statusRef.set(
      {
        runKey,
        lastStartedAt: startedAt,
        lastFinishedAt: finishedAt,
        lastStatus: finalStatus,
        lastTrigger: options?.trigger || 'manual',
        scanned: summary.scanned,
        ran: summary.ran,
        checked: summary.checked,
        changed: summary.changed,
        failed: summary.failed,
        asoChecked: summary.asoChecked,
        asoChanged: summary.asoChanged,
        asoFailed: summary.asoFailed,
        durationMs: Date.now() - startMs,
        error: FieldValue.delete(),
        watchdogRetryEligible:
          finalStatus === 'partial'
            ? shouldRetryPartialDailyTracking(summary)
            : false,
        leaseOwner: FieldValue.delete(),
        leaseExpiresAt: FieldValue.delete(),
      },
      { merge: true },
    );
    return summary;
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const durationMs = Date.now() - startMs;
    const errorMessage = error instanceof Error ? error.message : String(error);
    await statusRef
      .set(
        {
          runKey,
          lastStartedAt: startedAt,
          lastFinishedAt: finishedAt,
          lastStatus: 'error',
          lastTrigger: options?.trigger || 'manual',
          durationMs,
          error: errorMessage,
          watchdogRetryEligible: true,
          leaseOwner: FieldValue.delete(),
          leaseExpiresAt: FieldValue.delete(),
        },
        { merge: true },
      )
      .catch(() => undefined);
    await sendCronFailureEmail({
      runKey,
      trigger: options?.trigger || 'manual',
      startedAt,
      finishedAt,
      durationMs,
      errorMessage,
    });
    throw error;
  }
}

async function maybeRunAllUserTrackingSchedules() {
  try {
    const now = new Date();
    if (!isGlobalTrackingRunTime(now)) {
      return;
    }

    const runKey = getGlobalTrackingRunKey(now);
    const summary = await runAndPersistAllUserTrackingSchedules(runKey, {
      trigger: 'automatic',
    });
    if (summary.ran > 0) {
      console.log(
        `[tracking] Ran ${summary.ran} user schedule(s) for ${runKey} IST, checked ${summary.checked}, changed ${summary.changed}, failed ${summary.failed}, aso checked ${summary.asoChecked}, aso changed ${summary.asoChanged}, aso failed ${summary.asoFailed}.`,
      );
    }
  } catch (error) {
    console.error('Automatic per-user tracking scheduler failed:', error);
  }
}

function sendApiError(
  res: express.Response,
  error: unknown,
  fallbackMessage: string,
) {
  console.error('[API ERROR]', fallbackMessage, error);
  const apiError = normalizeApiError(error, fallbackMessage);
  return res.status(apiError.status).json({
    error: apiError.message,
    code: apiError.code,
    retryable: apiError.retryable,
  });
}

async function verifyFirebaseRequest(req: express.Request) {
  const adminAuth = getFirebaseAdminAuthClient();
  if (!adminAuth) {
    throw createConfigurationError('Firebase Admin auth is not configured on the server.');
  }

  const bearerToken = readAuthBearerToken(req);
  try {
    return await adminAuth.verifyIdToken(bearerToken);
  } catch (error) {
    throw createUnauthorizedError('Failed to verify authentication token.');
  }
}

async function deleteCollectionDocuments(
  collectionRef: CollectionReference<DocumentData>,
  batchSize = 200,
) {
  while (true) {
    const snapshot = await collectionRef.limit(batchSize).get();
    if (snapshot.empty) {
      return;
    }

    const batch = collectionRef.firestore.batch();
    snapshot.docs.forEach((docSnapshot) => {
      batch.delete(docSnapshot.ref);
    });
    await batch.commit();

    if (snapshot.size < batchSize) {
      return;
    }
  }
}

function hasRetainedAccountState(data: UserTrackingDocument | undefined) {
  if (!data) {
    return false;
  }

  return [
    data.billingProvider,
    data.billingEmail,
    data.dodoCustomerId,
    data.dodoSubscriptionId,
    data.dodoProductId,
    data.subscriptionTier,
    data.subscriptionInterval,
    data.isPremium,
    data.paypalSubscriptionId,
    data.paypalPlanId,
    data.subscriptionStatus,
    data.pendingPlanId,
    data.pendingInterval,
    data.subscriptionCurrentPeriodEnd,
    data.subscriptionCancelAtPeriodEnd,
    data.subscriptionUpdatedAt,
    data.billingReviewRequired,
    data.billingReviewReason,
    data.accountStatus,
    data.deletedAt,
    data.authDeletedAt,
    data.legalAcceptedAt,
    data.legalVersion,
  ].some((value) => value !== undefined && value !== null && value !== '');
}

async function mineCompetitorTerms(
  context: KeywordContext,
  mode: DiscoveryMode,
  profile: DiscoveryProfile,
) {
  const storeType = context.store;
  const country = context.country || 'us';
  if (!storeType) return [];

  const cacheKey = JSON.stringify({
    cacheVersion: DISCOVERY_CACHE_VERSION,
    title: normalizeKeyword(context.title),
    category: normalizeKeyword(context.category || ''),
    mode,
    store: storeType,
    country,
  });
  const cached = keywordSourceCache.get<{ term: string; weight: number }[]>(cacheKey);
  if (cached) return cached;

  const seeds = new Set<string>();
  const titleSegments = collectTitleSegments(context.title);
  titleSegments.slice(0, 2).forEach((segment) => seeds.add(segment));

  const titleTokens = tokenize(context.title);
  if (titleTokens.length >= 2) {
    seeds.add(`${titleTokens[0]} ${titleTokens[1]}`);
  }
  if (titleTokens.length >= 1) {
    seeds.add(titleTokens[0]);
  }

  deriveCategoryHints(context.category).slice(0, 2).forEach((hint) => seeds.add(hint));

  const competitorTerms = new Map<string, number>();
  const ownTokens = new Set(titleTokens);
  const categoryHintTokens = new Set(deriveCategoryHints(context.category).flatMap((hint) => tokenize(hint)));
  const termAppHits = new Map<string, Set<string>>();

  const seedResults: any[][] = await Promise.all(
    Array.from(seeds)
      .slice(0, profile.competitorSeedLimit)
      .map(async (seed) => {
        try {
          return await searchStore(
            seed,
            storeType,
            country,
            profile.competitorResultsPerSeed,
            {
              useFailureCache: false,
              preferDirectFirst: true,
              proxyFallbackOnError: true,
              proxyFallbackOnEmpty: true,
            },
          );
        } catch (error) {
          console.warn(`Competitor keyword mining failed for "${seed}"`, error);
          return [];
        }
      }),
  );

  seedResults.forEach((results) => {
    results.forEach((app: any, index: number) => {
      const rankWeight = Math.max(2, 10 - index);
      const category = app.primaryGenre || app.genre || '';
      const appKey = String(app.appId || app.id || `${app.title || 'app'}-${index}`);
      const title = String(app.title || '');
      const seenTermsForApp = new Set<string>();
      const titleSegmentsForApp = collectTitleSegments(title);
      titleSegmentsForApp.forEach((segment, segmentIndex) => {
        const segmentWeight = segmentIndex === 0 ? rankWeight * 3 : rankWeight * 2;
        addWeightedTerm(competitorTerms, segment, segmentWeight);
        seenTermsForApp.add(normalizeKeyword(segment));
      });

      const titleTokensForApp = tokenize(title);
      if (titleTokensForApp[0]) {
        addWeightedTerm(competitorTerms, titleTokensForApp[0], rankWeight + 3);
        seenTermsForApp.add(titleTokensForApp[0]);
      }
      if (titleTokensForApp[0] && titleTokensForApp[1]) {
        const leadBigram = `${titleTokensForApp[0]} ${titleTokensForApp[1]}`;
        addWeightedTerm(competitorTerms, leadBigram, rankWeight + 4);
        seenTermsForApp.add(leadBigram);
      }

      addTokenWeights(competitorTerms, title, rankWeight + 1, rankWeight + 3);
      addTokenWeights(competitorTerms, category, rankWeight + 2, 0);

      tokenize(title).forEach((token) => {
        if (categoryHintTokens.has(token)) {
          addWeightedTerm(competitorTerms, token, rankWeight + 3);
        }
        seenTermsForApp.add(token);
      });

      for (const term of seenTermsForApp) {
        if (!term) continue;
        const appHits = termAppHits.get(term) || new Set<string>();
        appHits.add(appKey);
        termAppHits.set(term, appHits);
      }
    });
  });

  termAppHits.forEach((appHits, term) => {
    const repeatedAcrossApps = appHits.size;
    if (repeatedAcrossApps >= 2) {
      competitorTerms.set(term, (competitorTerms.get(term) || 0) + ((repeatedAcrossApps - 1) * 5));
    }
  });

  const mined = Array.from(competitorTerms.entries())
    .filter(([term]) => {
      const parts = term.split(' ');
      return !parts.every((part) => ownTokens.has(part));
    })
    .map(([term, weight]) => {
      const parts = term.split(' ');
      const categoryBoost = parts.some((part) => categoryHintTokens.has(part)) ? 6 : 0;
      const genericPenalty =
        parts.length === 1 && HIGH_VOLUME_TERMS.has(parts[0]) && !categoryHintTokens.has(parts[0]) ? 3 : 0;
      return [term, weight + categoryBoost - genericPenalty] as const;
    })
    .sort((a, b) => b[1] - a[1])
    .filter(([, weight]) => weight > 0)
    .slice(0, profile.competitorTermLimit)
    .map(([term, weight]) => ({ term, weight }));

  keywordSourceCache.set(cacheKey, mined);
  return mined;
}

async function buildKeywordSignals(
  context: KeywordContext,
  mode: DiscoveryMode,
  profile: DiscoveryProfile,
) {
  const candidates = new Map<string, number>();
  const titleSegments = collectTitleSegments(context.title);

  titleSegments.forEach((segment, index) => addWeightedTerm(candidates, segment, 40 - (index * 4)));
  addTokenWeights(candidates, context.title, 16, 20);
  addTokenWeights(candidates, context.description, 2, 5);

  deriveCategoryHints(context.category).forEach((hint) => addWeightedTerm(candidates, hint, 12));
  tokenize(context.developer).forEach((token) => addWeightedTerm(candidates, token, 2));

  const competitorTerms = await mineCompetitorTerms(context, mode, profile);
  const competitorWeights = new Map<string, number>();
  competitorTerms.forEach(({ term, weight }) => {
    competitorWeights.set(term, weight);
    addWeightedTerm(candidates, term, Math.max(4, Math.round(weight / 2)));
  });

  return {
    candidateWeights: candidates,
    competitorWeights,
    ownTitleTokens: new Set(tokenize(context.title)),
  };
}

async function sampleKeywordMarket(
  keyword: string,
  context: Pick<KeywordContext, 'title' | 'category' | 'store' | 'country'>,
  enrichDetails = false,
): Promise<KeywordMarketSample | null> {
  const storeType = context.store;
  if (!storeType) return null;

  const country = context.country || 'us';
  const normalizedKeyword = normalizeKeyword(keyword);
  if (!normalizedKeyword) return null;

  const cacheKey = JSON.stringify({
    cacheVersion: DISCOVERY_CACHE_VERSION,
    keyword: normalizedKeyword,
    category: normalizeKeyword(context.category || ''),
    store: storeType,
    country,
    enriched: enrichDetails,
  });
  const cached = keywordMarketCache.get<KeywordMarketSample>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const results = await searchStore(
      keyword,
      storeType,
      country,
      10,
      { useFailureCache: false, webFallbackOnEmpty: true, webFallbackOnError: true },
    );
    const popularitySamples = await buildPopularitySamplesForResults(
      results,
      storeType,
      country,
      enrichDetails,
    );
    const sample = computeKeywordMarketSampleFromResults(
      keyword,
      results,
      context,
      popularitySamples,
      storeType,
    );
    if (!sample) {
      return null;
    }

    keywordMarketCache.set(cacheKey, sample);
    return sample;
  } catch (error) {
    console.warn(`Keyword market sampling failed for "${keyword}"`, error);
    return null;
  }
}

async function buildKeywordMarketSamples(
  keywords: string[],
  context: Pick<KeywordContext, 'title' | 'category' | 'store' | 'country'>,
  options?: {
    enrichKeywords?: string[];
  },
) {
  if (!context.store) {
    return new Map<string, KeywordMarketSample>();
  }

  const uniqueKeywords = Array.from(
    new Set(
      keywords
        .map((keyword) => normalizeKeyword(String(keyword || '')))
        .filter(Boolean),
    ),
  );
  const samples = new Map<string, KeywordMarketSample>();
  const enrichedKeywords = new Set(
    (options?.enrichKeywords || [])
      .map((keyword) => normalizeKeyword(String(keyword || '')))
      .filter(Boolean),
  );

  for (let index = 0; index < uniqueKeywords.length; index += 4) {
    const batch = uniqueKeywords.slice(index, index + 4);
    const batchResults = await Promise.all(
      batch.map((keyword) =>
        sampleKeywordMarket(keyword, context, enrichedKeywords.has(keyword))),
    );
    batchResults.forEach((sample) => {
      if (sample) {
        samples.set(sample.keyword, sample);
      }
    });
  }

  return samples;
}

function selectMetricEnrichmentKeywords(
  candidates: Array<{
    keyword: string;
    baseline: {
      keyword: string;
      demand: number;
      difficulty: number;
      relevance: number;
    };
  }>,
  limit: number,
) {
  return candidates
    .slice()
    .sort((a, b) => {
      if (b.baseline.relevance !== a.baseline.relevance) return b.baseline.relevance - a.baseline.relevance;
      if (b.baseline.demand !== a.baseline.demand) return b.baseline.demand - a.baseline.demand;
      if (a.baseline.difficulty !== b.baseline.difficulty) return a.baseline.difficulty - b.baseline.difficulty;
      return a.keyword.length - b.keyword.length;
    })
    .slice(0, limit)
    .map((candidate) => candidate.keyword);
}

async function buildKeywordCandidates(
  context: KeywordContext,
  mode: DiscoveryMode,
  profile: DiscoveryProfile,
) {
  const { candidateWeights, ownTitleTokens } = await buildKeywordSignals(
    context,
    mode,
    profile,
  );

  return getSortedCandidateTerms(candidateWeights, ownTitleTokens)
    .map(([term]) => term);
}
const genai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

function isValidASOKeyword(k: unknown): k is string {
  if (typeof k !== 'string') return false;
  const trimmed = k.trim().toLowerCase();

  if (trimmed.length < 2 || trimmed.length > 40) return false;

  // Basic allowed chars: letters, numbers, spaces, hyphen, ampersand, dot
  if (/[^a-z0-9\s\-\.&]/i.test(trimmed)) return false;

  const words = trimmed.split(/\s+/);
  if (words.length > 4) return false;

  // Reject stemmed or broken tokens
  const badStems = new Set(['articl', 'featur', 'gam', 'improv', 'introduc', 'manag', 'optim', 'perform', 'provid', 'resolv', 'stat', 'updat', 'experienc', 'enhanc', 'bugfix']);
  if (words.some((word) => badStems.has(word))) return false;

  // Reject pure trash words with no search intent
  const pureTrashWords = new Set(['version', 'release', 'notes', 'bug', 'bugs', 'fix', 'fixes', 'fixed', 'improvement', 'improvements', 'performance', 'experience']);
  if (words.some((word) => pureTrashWords.has(word))) return false;

  const lowIntentWords = new Set(['download', 'install', 'update', 'updates', 'support', 'user', 'users', 'app', 'apps', 'free', 'premium', 'pro']);
  const fillers = new Set(['and', 'the', 'for', 'with', 'to', 'in', 'of', 'a', 'an', 'is', 'by', 'on', 'at', 'it', 'my', 'your', 'this', 'that', 'how', 'what', 'why', 'get', 'let']);

  // Reject if the ENTIRE phrase is just low-intent words and fillers (e.g., "free app for you")
  if (words.every((word) => fillers.has(word) || lowIntentWords.has(word))) return false;

  // Reject trailing fillers like "fitness for"
  if (words.length > 1 && fillers.has(words[words.length - 1])) return false;

  return true;
}

function dedupeKeywords(keywords: string[]) {
  const seen = new Set<string>();
  return keywords.filter((keyword) => {
    const normalized = normalizeKeyword(keyword);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

async function refineKeywordsWithGemini(
  context: { title: string; description?: string; category?: string },
  rawKeywords: string[],
  mode: DiscoveryMode
): Promise<{
  keywords: string[];
  rawCount: number;
  geminiCount: number;
  strictValidCount: number;
  fallbackAddedCount: number;
}> {
  const limit = DISCOVERY_PROFILES[mode].keywordLimit;
  let geminiKeywords: string[] = [];

  if (genai && rawKeywords.length > 0) {
    const prompt = `You are a strict App Store Optimization (ASO) keyword expert.
I am optimizing an app with the following metadata:
Title: "${context.title}"
Description: "${context.description ? context.description.slice(0, 800) : 'N/A'}"
Category: "${context.category || 'N/A'}"

I have scraped the following potential keywords from competitors:
${rawKeywords.join(', ')}

Your task is to refine this list based on strict ASO principles:
1. Return ONLY real, human-searchable App Store / Google Play keywords with clear search intent.
2. DO NOT return random app-description fragments, broken phrases, or stemmed/partial tokens (e.g., "featur", "manag").
3. Output ONLY clean 1-4 word ASO keywords.
4. NEVER output filler/helper-word combinations or "brand + random word" phrases.
5. Return EXACTLY a JSON array of up to ${limit} strings. NEVER use markdown formatting.`;

    try {
      const response = await genai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      });

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          geminiKeywords = parsed.filter(
            (keyword): keyword is string => typeof keyword === 'string',
          );
        }
      }
    } catch (err) {
      console.error('Gemini keyword refinement failed:', err);
    }
  }

  const strictValid = dedupeKeywords(geminiKeywords.filter(isValidASOKeyword));
  const strictKeywords = strictValid.slice(0, limit);
  const seen = new Set(strictKeywords.map((keyword) => normalizeKeyword(keyword)));
  const fallbackKeywords: string[] = [];

  for (const keyword of dedupeKeywords(rawKeywords.filter(isValidASOKeyword))) {
    const normalized = normalizeKeyword(keyword);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    fallbackKeywords.push(keyword);
    if (strictKeywords.length + fallbackKeywords.length >= limit) {
      break;
    }
  }

  console.log(
    `[keyword-refine] raw=${rawKeywords.length} gemini=${geminiKeywords.length} strictValid=${strictValid.length} fallbackAdded=${fallbackKeywords.length}`,
  );

  return {
    keywords: [...strictKeywords, ...fallbackKeywords],
    rawCount: rawKeywords.length,
    geminiCount: geminiKeywords.length,
    strictValidCount: strictValid.length,
    fallbackAddedCount: fallbackKeywords.length,
  };
}

async function discoverRankedKeywords(input: {
  appId: string;
  title: string;
  description?: string;
  category?: string;
  developer?: string;
  store: StoreType;
  country: string;
  mode: DiscoveryMode;
}) {
  const profile = DISCOVERY_PROFILES[input.mode];
  const cacheKey = JSON.stringify({
    cacheVersion: DISCOVERY_CACHE_VERSION,
    appId: input.appId,
    title: normalizeKeyword(input.title),
    description: normalizeKeyword(input.description || ''),
    category: normalizeKeyword(input.category || ''),
    developer: normalizeKeyword(input.developer || ''),
    mode: input.mode,
    store: input.store,
    country: input.country,
  });
  const cached = discoveryCache.get<{
    rankings: Array<{
      keyword: string;
      rank: number;
      demand: number;
      volume: number;
      difficulty: number;
      relevance: number;
      confidence: 'low' | 'medium' | 'high';
    }>;
    suggestions?: Array<{
      keyword: string;
      demand: number;
      volume: number;
      difficulty: number;
      relevance: number;
      confidence: 'low' | 'medium' | 'high';
    }>;
    mode: DiscoveryMode;
    checkedKeywords: number;
    candidateCount: number;
    searchDepth: number;
    failedLookups: number;
  }>(cacheKey);
  if (cached) {
    return cached;
  }

  const rawKeywords = await buildKeywordCandidates({
    title: input.title,
    description: input.description,
    category: input.category,
    developer: input.developer,
    store: input.store,
    country: input.country,
  }, input.mode, profile);

  const refined = await refineKeywordsWithGemini(
    { title: input.title, description: input.description, category: input.category },
    rawKeywords,
    input.mode
  );
  const refinedKeywords = refined.keywords;

  const seen = new Set<string>();
  const uniqueKeywords = [input.title, ...refinedKeywords].filter((keyword) => {
    const normalized = normalizeKeyword(keyword);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  const signalContext = await buildKeywordSignals(input, input.mode, profile);
  const metricCandidates = uniqueKeywords.map((keyword, index) => {
    const features = extractKeywordFeatures(
      input,
      keyword,
      signalContext,
    );
    const baseline = scoreKeywordMetrics(features);
    
    let displayQuality = 0;
    displayQuality += features.exactTitleMatch * 50;
    displayQuality += features.exactTitleSegment * 30;
    displayQuality += features.orderedTitleCoverage * 20;
    displayQuality += features.titleCoverage * 10;
    displayQuality += features.categorySemanticCoverage * 20;
    displayQuality += features.semanticCoverage * 15;
    displayQuality += features.categoryCoverage * 10;
    displayQuality += features.genericCoverage * 10;
    displayQuality -= features.weakModifierCoverage * 30;
    if (features.mostlyGeneric) displayQuality -= 15;
    displayQuality = Math.max(0, Math.min(100, displayQuality));

    return {
      id: index,
      keyword,
      features,
      baseline,
      displayQuality,
    };
  });

  const rankedCandidates = metricCandidates
    .filter((candidate) => {
      const hasStrongSignal = candidate.features.exactTitleMatch > 0 ||
        candidate.features.exactTitleSegment > 0 ||
        candidate.features.orderedTitleCoverage >= 0.75 ||
        candidate.features.semanticCoverage >= 0.5 ||
        candidate.features.categorySemanticCoverage >= 0.5;
      return hasStrongSignal || candidate.displayQuality >= 35;
    })
    .sort((a, b) => {
      if (b.baseline.relevance !== a.baseline.relevance) return b.baseline.relevance - a.baseline.relevance;
      if (a.baseline.difficulty !== b.baseline.difficulty) return a.baseline.difficulty - b.baseline.difficulty;
      if (b.baseline.demand !== a.baseline.demand) return b.baseline.demand - a.baseline.demand;
      return a.keyword.length - b.keyword.length;
    })
    .slice(0, profile.keywordLimit);

  const featuresByKeyword = new Map(
    metricCandidates.map((candidate) => [normalizeKeyword(candidate.keyword), candidate.features]),
  );
  const validRankings: Array<{
    keyword: string;
    rank: number;
    demand: number;
    volume: number;
    difficulty: number;
    relevance: number;
    confidence: 'low' | 'medium' | 'high';
    displayQuality: number;
    featureQuality: {
      exactTitleMatch: number;
      exactTitleSegment: number;
      orderedTitleCoverage: number;
      semanticCoverage: number;
      categorySemanticCoverage: number;
    };
  }> = [];
  let checkedKeywords = 0;
  let failedLookups = 0;

  for (let i = 0; i < rankedCandidates.length; i += profile.batchSize) {
    const batch = rankedCandidates.slice(i, i + profile.batchSize);
    const batchResults = await Promise.all(
      batch.map(async (candidate) => {
        try {
          let rank: number;

          if (input.store === 'android') {
            rank = await getGooglePlayRankWithFallback(
              candidate.keyword,
              input.appId,
              input.country,
              profile.searchDepth,
              getUpstreamDeadline(RANKING_FETCH_TIMEOUT_MS),
              'The app store search is taking too long. Please try again.',
              'discovery',
            );
          } else {
            // iOS: use store.search which supports deep pagination
            const results: any[] = await searchStore(
              candidate.keyword,
              input.store,
              input.country,
              profile.searchDepth,
              { useFailureCache: false, webFallbackOnEmpty: true, webFallbackOnError: true },
            );
            const index = results.findIndex((app) =>
              String(app.appId) === String(input.appId) || String(app.id) === String(input.appId),
            );
            rank = index === -1 ? -1 : index + 1;
          }

          if (rank === -1) {
            return null;
          }

          console.log(`[discovery] Found rank ${rank} for "${candidate.keyword}" (${input.store}/${input.country})`);
          const features = candidate.features;
          return {
            keyword: candidate.keyword,
            rank,
            demand: candidate.baseline.demand,
            volume: candidate.baseline.volume,
            difficulty: candidate.baseline.difficulty,
            relevance: candidate.baseline.relevance,
            confidence: candidate.baseline.confidence,
            displayQuality: candidate.displayQuality,
            featureQuality: {
              exactTitleMatch: features?.exactTitleMatch || 0,
              exactTitleSegment: features?.exactTitleSegment || 0,
              orderedTitleCoverage: features?.orderedTitleCoverage || 0,
              semanticCoverage: features?.semanticCoverage || 0,
              categorySemanticCoverage: features?.categorySemanticCoverage || 0,
            },
          };
        } catch (error) {
          console.warn(`Discovery ranking lookup failed for "${candidate.keyword}"`, error);
          failedLookups += 1;
          return null;
        }
      }),
    );

    checkedKeywords += batch.length;
    validRankings.push(
      ...batchResults.filter((result): result is NonNullable<typeof result> => Boolean(result) && result.rank <= profile.searchDepth),
    );

    if (
      profile.earlyExitRankings !== null &&
      validRankings.length >= profile.earlyExitRankings &&
      checkedKeywords >= profile.minCheckedKeywords
    ) {
      break;
    }
  }

  const rankings = validRankings
    .filter((candidate) => {
      const hasStrongSignal = candidate.featureQuality.exactTitleMatch > 0 ||
        candidate.featureQuality.exactTitleSegment > 0 ||
        candidate.featureQuality.orderedTitleCoverage >= 0.75 ||
        candidate.featureQuality.semanticCoverage >= 0.5 ||
        candidate.featureQuality.categorySemanticCoverage >= 0.5;
      return hasStrongSignal || candidate.displayQuality >= 35;
    })
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return b.relevance - a.relevance;
    })
    .map(({ keyword, rank, demand, volume, difficulty, relevance, confidence }) => ({
      keyword,
      rank,
      demand,
      volume,
      difficulty,
      relevance,
      confidence,
    }))
    .slice(0, profile.finalRankingLimit);

  // Always show unranked candidates as suggestions (not just when rankings=0)
  const rankedKeywordSet = new Set(rankings.map((ranking) => normalizeKeyword(ranking.keyword)));
  const suggestions = rankedCandidates
    .filter((candidate) => !rankedKeywordSet.has(normalizeKeyword(candidate.keyword)))
    .slice(0, profile.finalRankingLimit)
    .map(({ keyword, baseline }) => ({
      keyword,
      demand: baseline.demand,
      volume: baseline.volume,
      difficulty: baseline.difficulty,
      relevance: baseline.relevance,
      confidence: baseline.confidence,
    }));

  const payload = {
    mode: input.mode,
    checkedKeywords,
    candidateCount: rankedCandidates.length,
    searchDepth: profile.searchDepth,
    failedLookups,
    rankings,
    suggestions,
  };

  discoveryCache.set(cacheKey, payload);
  return payload;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  const PORT = Number(process.env.PORT || 3000);
  const isBundledServer = (process.argv[1] || '').includes(`${path.sep}dist${path.sep}server.cjs`);
  const isDevelopment = process.env.NODE_ENV !== 'production' && !isBundledServer;
  const enableInProcessUserTrackingScheduler =
    process.env.ENABLE_IN_PROCESS_USER_TRACKING_SCHEDULER === 'true' ||
    (process.env.ENABLE_IN_PROCESS_USER_TRACKING_SCHEDULER !== 'false' && isDevelopment);

  await loadTrackingState();
  void maybeRunScheduledTrackingCheck();
  if (enableInProcessUserTrackingScheduler) {
    void maybeRunAllUserTrackingSchedules();
  }
  setInterval(() => {
    void maybeRunScheduledTrackingCheck();
    if (enableInProcessUserTrackingScheduler) {
      void maybeRunAllUserTrackingSchedules();
    }
  }, 60 * 1000);

  app.post('/api/dodo/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const client = getDodoClient();
    const webhookKey = getDodoWebhookKey();
    if (!client || !webhookKey) {
      return res.status(503).json({
        error: 'Dodo webhook handling is not configured on the server.',
        code: 'CONFIGURATION_ERROR',
        retryable: false,
      });
    }

    try {
      const headers = readDodoWebhookHeaders(req);
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body.toString('utf8')
        : typeof req.body === 'string'
          ? req.body
          : '';
      if (!rawBody) {
        throw createBadRequestError('Dodo webhook payload is required.');
      }

      const eventKey = headers['webhook-id'];
      if (dodoWebhookEventCache.has(eventKey)) {
        return res.json({ received: true, duplicate: true });
      }

      const event = client.webhooks.unwrap(rawBody, {
        headers,
        key: webhookKey,
      });

      if (isDodoSubscriptionWebhookEvent(event)) {
        await applyDodoSubscriptionEvent(event);
      }

      dodoWebhookEventCache.set(eventKey, true);
      return res.json({ received: true });
    } catch (error) {
      console.error('[dodo] Webhook processing failed:', error);
      return sendApiError(res, error, 'Failed to process Dodo webhook.');
    }
  });

  app.use(express.json({ limit: '5mb' }));
  app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (error instanceof SyntaxError) {
      res.status(400).json({
        error: 'Malformed JSON request body.',
        code: 'BAD_REQUEST',
        retryable: false,
      });
      return;
    }

    next(error);
  });

  const moderateRateLimit = createRateLimiter('public-moderate', 60, 60 * 1000);
  const strictRateLimit = createRateLimiter('public-strict', 30, 60 * 1000);
  const discoverRateLimit = createRateLimiter('public-discover', 20, 60 * 1000);
  const authEventRateLimit = createRateLimiter('public-auth-events', 120, 60 * 1000);
  const authedLightRateLimit = createRateLimiter('authed-light', 120, 60 * 1000);
  const authedRefreshRateLimit = createRateLimiter('authed-refresh', 20, 60 * 1000);
  const authedCheckoutRateLimit = createRateLimiter('authed-checkout', 6, 15 * 60 * 1000);
  const authedPortalRateLimit = createRateLimiter('authed-portal', 12, 15 * 60 * 1000);
  const authedNotificationTestRateLimit = createRateLimiter('authed-push-test', 5, 10 * 60 * 1000);

  app.get('/api/billing/status', authedLightRateLimit, async (req, res) => {
    try {
      const decodedToken = await verifyFirebaseRequest(req);
      const adminDb = getFirebaseAdminDb();
      const client = getDodoClient();
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }

      const snapshot = await adminDb.collection('users').doc(decodedToken.uid).get();
      const userData = snapshot.data() as UserTrackingDocument | undefined;
      const environment = normalizeDodoEnvironment(
        process.env.DODO_ENVIRONMENT || process.env.DODO_PAYMENTS_ENVIRONMENT,
      );
      const configuredPlans = getConfiguredBillingPlans();
      const availableBillingIntervals = getConfiguredBillingIntervals();
      const availablePlanIntervals = getConfiguredBillingPlanIntervals();
      const normalizedUserState = normalizeUserTrackingDocument(userData);
      const effectiveSubscriptionTier = getEffectiveBillingPlanId(userData);
      const accessState = deriveBillingAccessState(userData);
      const isPremium = hasActiveBillingEntitlement(userData);
      const pendingPlanId = readPendingPlanId(userData?.pendingPlanId);
      const pendingInterval =
        userData?.pendingInterval === 'yearly' ? 'yearly' : userData?.pendingInterval === 'monthly' ? 'monthly' : null;
      const planLimits =
        accessState === 'active' ? getResolvedPlanLimits(userData) : null;
      const usage =
        accessState === 'active' && planLimits
          ? getNormalizedPlanUsage(normalizedUserState, planLimits)
          : null;
      const planPricing = client
        ? await loadConfiguredBillingPlanPricing(client)
        : {
            indie: {},
            starter: {},
            pro: {},
          };
      const productConfigured = configuredPlans.some(
        (planId) => planId === 'indie' || planId === 'starter' || planId === 'pro',
      );

      res.json({
        configured: Boolean(getDodoApiKey()),
        productConfigured,
        customerPortalAvailable: Boolean(getDodoApiKey() && userData?.dodoCustomerId),
        accessState,
        availablePlans: configuredPlans,
        availableBillingIntervals,
        availablePlanIntervals,
        planPricing,
        environment: environment === 'live_mode' ? 'live' : 'test',
        isPremium,
        billingReviewRequired: Boolean(userData?.billingReviewRequired),
        billingReviewReason: userData?.billingReviewReason || null,
        accountStatus: userData?.accountStatus || 'active',
        subscriptionTier: effectiveSubscriptionTier,
        subscriptionInterval: userData?.subscriptionInterval || null,
        subscriptionStatus: userData?.subscriptionStatus || null,
        pendingPlanId,
        pendingInterval,
        currentPeriodEnd: userData?.subscriptionCurrentPeriodEnd || null,
        cancelAtPeriodEnd: Boolean(userData?.subscriptionCancelAtPeriodEnd),
        planLimits,
        usage,
      });
    } catch (error) {
      return sendApiError(res, error, 'Failed to load billing status.');
    }
  });

  app.post('/api/billing/checkout', authedCheckoutRateLimit, async (req, res) => {
    try {
      const decodedToken = await verifyFirebaseRequest(req);
      const adminDb = getFirebaseAdminDb();
      const client = getDodoClient();
      const planId = readBillingPlanId(req.body?.plan || 'starter');
      const interval = readBillingInterval(req.body?.interval);
      if (planId === 'free' || planId === 'agency') {
        throw createBadRequestError('This plan does not use hosted Dodo checkout.');
      }
      const productId = getDodoProductIdForPlan(planId, interval);
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }
      if (!client || !productId) {
        throw createConfigurationError(
          `Dodo checkout is not configured on the server for the ${planId} ${interval} plan.`,
        );
      }

      const userDocRef = adminDb.collection('users').doc(decodedToken.uid);
      const userSnapshot = await userDocRef.get();
      const userData = userSnapshot.data() as UserTrackingDocument | undefined;
      const isDowngradeAttempt =
        hasActiveBillingEntitlement(userData) &&
        getBillingPlanRank(planId) < getBillingPlanRank(getEffectiveBillingPlanId(userData));
      if (isDowngradeAttempt) {
        throw createBadRequestError(
          'Downgrades are not available from checkout. Use the billing portal or contact support.',
        );
      }
      const email = decodedToken.email?.trim().toLowerCase();
      if (!email && !userData?.dodoCustomerId) {
        throw createBadRequestError('A verified email address is required to start checkout.');
      }

      const checkoutSession = await client.checkoutSessions.create({
        product_cart: [{ product_id: productId, quantity: 1 }],
        customer: userData?.dodoCustomerId
          ? { customer_id: userData.dodoCustomerId }
          : {
              email: email as string,
              name: decodedToken.name?.trim() || decodedToken.email?.trim() || 'Rank Analyzer Pro user',
            },
        feature_flags: {
          redirect_immediately: true,
        },
        metadata: {
          firebase_uid: decodedToken.uid,
          plan_id: planId,
          billing_interval: interval,
        },
        return_url: getBillingReturnUrl(req),
      });

      await userDocRef.set({
        billingProvider: 'dodo',
        ...(email ? { billingEmail: email } : {}),
        pendingPlanId: planId,
        pendingInterval: interval,
        ...(hasActiveBillingEntitlement(userData)
          ? {}
          : { subscriptionStatus: 'pending' as const }),
        subscriptionUpdatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } satisfies UserTrackingDocument, { merge: true });

      res.json({
        checkoutUrl: checkoutSession.checkout_url,
        sessionId: checkoutSession.session_id,
      });
    } catch (error) {
      return sendApiError(res, error, 'Failed to create Dodo checkout session.');
    }
  });

  app.post('/api/billing/portal', authedPortalRateLimit, async (req, res) => {
    try {
      const decodedToken = await verifyFirebaseRequest(req);
      const adminDb = getFirebaseAdminDb();
      const client = getDodoClient();
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }
      if (!client) {
        throw createConfigurationError('Dodo customer portal is not configured on the server.');
      }

      const snapshot = await adminDb.collection('users').doc(decodedToken.uid).get();
      const userData = snapshot.data() as UserTrackingDocument | undefined;
      const customerId = userData?.dodoCustomerId?.trim();
      if (!customerId) {
        throw createBadRequestError('No Dodo customer is linked to this account yet.');
      }

      const portalSession = await client.customers.customerPortal.create(customerId, {
        return_url: getBillingReturnUrl(req),
      });

      res.json({ portalUrl: portalSession.link });
    } catch (error) {
      return sendApiError(res, error, 'Failed to create Dodo customer portal session.');
    }
  });

  app.post('/api/account/delete', authedPortalRateLimit, async (req, res) => {
    try {
      const decodedToken = await verifyFirebaseRequest(req);
      const adminDb = getFirebaseAdminDb();
      const adminAuth = getFirebaseAdminAuthClient();
      if (!adminDb || !adminAuth) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }

      const userDocRef = adminDb.collection('users').doc(decodedToken.uid);
      const snapshot = await userDocRef.get();
      const userData = snapshot.data() as UserTrackingDocument | undefined;

      await Promise.all([
        deleteCollectionDocuments(userDocRef.collection(USER_ALERT_EVENTS_COLLECTION)),
        deleteCollectionDocuments(
          userDocRef.collection(USER_COMPETITOR_ASO_DIFFS_COLLECTION),
        ),
        deleteCollectionDocuments(
          userDocRef.collection(USER_RANK_HISTORY_ARCHIVE_COLLECTION),
        ),
        deleteCollectionDocuments(
          userDocRef.collection(USER_COMPETITOR_RANK_HISTORY_ARCHIVE_COLLECTION),
        ),
        deleteCollectionDocuments(userDocRef.collection(USER_PUSH_TOKENS_COLLECTION)),
      ]);

      if (hasRetainedAccountState(userData)) {
        const deletedAt = new Date().toISOString();
        const deleteWorkspaceDataPayload: DocumentData = {
          bookmarks: FieldValue.delete(),
          trackedApps: FieldValue.delete(),
          trackedKeywords: FieldValue.delete(),
          rankHistory: FieldValue.delete(),
          appAnalysisSnapshots: FieldValue.delete(),
          competitorGroups: FieldValue.delete(),
          competitorGroupSnapshots: FieldValue.delete(),
          competitorTrackedKeywords: FieldValue.delete(),
          competitorRankHistory: FieldValue.delete(),
          competitorAsoLatestSnapshots: FieldValue.delete(),
          trackingSchedule: FieldValue.delete(),
          alertRules: FieldValue.delete(),
          notificationSettings: FieldValue.delete(),
          migratedFromLocalAt: FieldValue.delete(),
          accountStatus: 'deleted',
          deletedAt,
          authDeletedAt: FieldValue.delete(),
          isPremium: false,
          pendingPlanId: FieldValue.delete(),
          pendingInterval: FieldValue.delete(),
          billingReviewRequired: true,
          billingReviewReason: 'account_deleted',
          updatedAt: deletedAt,
        };
        await userDocRef.set(
          deleteWorkspaceDataPayload,
          { merge: true },
        );
      } else if (snapshot.exists) {
        await userDocRef.delete();
      }

      await adminAuth.deleteUser(decodedToken.uid);
      if (hasRetainedAccountState(userData)) {
        await userDocRef.set(
          {
            authDeletedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } satisfies UserTrackingDocument,
          { merge: true },
        );
      }
      res.json({ success: true });
    } catch (error) {
      return sendApiError(res, error, 'Failed to delete account.');
    }
  });

  app.post('/api/account/legal-acceptance', authedLightRateLimit, async (req, res) => {
    try {
      const decodedToken = await verifyFirebaseRequest(req);
      const adminDb = getFirebaseAdminDb();
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }

      const requestedVersion =
        typeof req.body?.legalVersion === 'string' ? req.body.legalVersion.trim() : '';
      if (!requestedVersion) {
        throw createBadRequestError('A legal version is required.');
      }

      await adminDb.collection('users').doc(decodedToken.uid).set({
        legalAcceptedAt: new Date().toISOString(),
        legalVersion: requestedVersion,
        updatedAt: new Date().toISOString(),
      } satisfies UserTrackingDocument, { merge: true });

      res.json({ success: true });
    } catch (error) {
      return sendApiError(res, error, 'Failed to save legal acceptance.');
    }
  });

  app.put('/api/user-state', authedLightRateLimit, async (req, res) => {
    try {
      const decodedToken = await verifyFirebaseRequest(req);
      const adminDb = getFirebaseAdminDb();
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }

      const userDocRef = adminDb.collection('users').doc(decodedToken.uid);
      const snapshot = await userDocRef.get();
      const currentUserData = snapshot.data() as UserTrackingDocument | undefined;
      const currentState = normalizeUserTrackingDocument(currentUserData);
      const nextState = normalizeUserTrackingDocument(req.body?.state ?? req.body);
      const mergedState = mergeEditableUserTrackingState(currentState, nextState);
      const planLimits = getResolvedPlanLimits(currentUserData);

      assertPlanLimitTransition(currentState, mergedState, planLimits);
      const retainedRankHistory = await archiveAndTrimTrackedRankHistory(
        userDocRef,
        mergedState.rankHistory,
      );
      const retainedCompetitorRankHistory = await archiveAndTrimCompetitorRankHistory(
        userDocRef,
        mergedState.competitorRankHistory,
      );

      await userDocRef.set({
        bookmarks: mergedState.bookmarks,
        trackedApps: mergedState.trackedApps,
        trackedKeywords: mergedState.trackedKeywords,
        rankHistory: retainedRankHistory,
        appAnalysisSnapshots: mergedState.appAnalysisSnapshots,
        competitorGroups: mergedState.competitorGroups,
        competitorGroupSnapshots: mergedState.competitorGroupSnapshots,
        competitorTrackedKeywords: mergedState.competitorTrackedKeywords,
        competitorRankHistory: retainedCompetitorRankHistory,
        trackingSchedule: mergedState.schedule,
        alertRules: mergedState.alertRules,
        notificationSettings: mergedState.notificationSettings,
        ...(mergedState.legalAcceptedAt
          ? { legalAcceptedAt: mergedState.legalAcceptedAt }
          : {}),
        ...(mergedState.legalVersion
          ? { legalVersion: mergedState.legalVersion }
          : {}),
        ...(mergedState.migratedFromLocalAt
          ? { migratedFromLocalAt: mergedState.migratedFromLocalAt }
          : {}),
        updatedAt: new Date().toISOString(),
      } satisfies UserTrackingDocument, { merge: true });

      res.json({
        success: true,
        planLimits,
        usage: getNormalizedPlanUsage(mergedState, planLimits),
      });
    } catch (error) {
      return sendApiError(res, error, 'Failed to save user state.');
    }
  });

  app.post('/api/notifications/token', authedLightRateLimit, async (req, res) => {
    try {
      const decodedToken = await verifyFirebaseRequest(req);
      const adminDb = getFirebaseAdminDb();
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }
      const token = readRequiredString(req.body?.token, 'token', 4096);
      const platform = readOptionalString(req.body?.platform, 'platform', 80) || 'web';
      const userAgent = readOptionalString(req.body?.userAgent, 'userAgent', 500) || 'unknown';
      // Tokens are typically very long base64url strings.
      // Firebase document IDs can be up to 1500 bytes and allow most characters except forward slash.
      // We will hash the token to ensure a safe, fixed-length document ID.
      const tokenId = crypto.createHash('sha256').update(token).digest('hex');

      await adminDb
        .collection('users')
        .doc(decodedToken.uid)
        .collection(USER_PUSH_TOKENS_COLLECTION)
        .doc(tokenId)
        .set({
          token,
          platform,
          userAgent,
          lastSeenAt: new Date().toISOString(),
        }, { merge: true });
      res.json({ success: true });
    } catch (error) {
      return sendApiError(res, error, 'Failed to register notification token.');
    }
  });

  app.get('/api/notifications/status', authedLightRateLimit, async (req, res) => {
    try {
      const decodedToken = await verifyFirebaseRequest(req);
      const adminDb = getFirebaseAdminDb();
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }
      const userDocRef = adminDb.collection('users').doc(decodedToken.uid);
      const tokens = await loadUserPushTokens(userDocRef);
      const lastTokenUpdatedAt = tokens.reduce<string | null>((latest, entry) => {
        if (!entry.lastSeenAt) {
          return latest;
        }
        if (!latest) {
          return entry.lastSeenAt;
        }
        return new Date(entry.lastSeenAt).getTime() > new Date(latest).getTime()
          ? entry.lastSeenAt
          : latest;
      }, null);

      res.json({
        adminConfigured: Boolean(getFirebaseAdminMessagingClient()),
        tokenCount: tokens.length,
        lastTokenUpdatedAt,
      });
    } catch (error) {
      return sendApiError(res, error, 'Failed to load notification status.');
    }
  });

  app.post('/api/notifications/test', authedNotificationTestRateLimit, async (req, res) => {
    try {
      const decodedToken = await verifyFirebaseRequest(req);
      const adminDb = getFirebaseAdminDb();
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }
      const userDocRef = adminDb.collection('users').doc(decodedToken.uid);
      const tokens = await loadUserPushTokens(userDocRef);
      if (!Boolean(getFirebaseAdminMessagingClient())) {
        throw createConfigurationError('Firebase Cloud Messaging is not configured on the server.');
      }
      if (!tokens.length) {
        throw createBadRequestError('No push token is registered for this account yet.');
      }

      const result = await sendPushNotificationToUser(
        userDocRef,
        {
          title: 'ASO Analyzer Pro test notification',
          body: 'Push delivery is working for this browser.',
        },
        {
          kind: 'test',
          runKey: createAlertRunKey('test'),
        },
      );

      res.json(result);
    } catch (error) {
      return sendApiError(res, error, 'Failed to send test notification.');
    }
  });

  app.post('/api/tracked-keywords/refresh', authedRefreshRateLimit, async (req, res) => {
    try {
      const decodedToken = await verifyFirebaseRequest(req);
      const adminDb = getFirebaseAdminDb();
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }

      const groupId = readRequiredString(req.body?.groupId, 'groupId', 160);
      const keyword = readRequiredString(req.body?.keyword, 'keyword', 120);
      const appId = readRequiredString(req.body?.appId, 'appId', 160);
      const store = readStoreType(req.body?.store);
      const country = normalizeCountryCode(
        readOptionalString(req.body?.country, 'country', 12) || 'us',
        'us',
      );
      const rankingDepth = normalizeRankingDepth(req.body?.depth);
      const userDocRef = adminDb.collection('users').doc(decodedToken.uid);
      const userSnapshot = await userDocRef.get();
      const userData = userSnapshot.data() as UserTrackingDocument | undefined;
      const state = normalizeUserTrackingDocument(userData);
      const trackedKeywordKey = getTrackedKeywordKey({
        groupId,
        appId,
        keyword,
        store,
        country,
      });
      const existingTrackedKeyword = state.trackedKeywords.find(
        (entry) => getTrackedKeywordKey(entry) === trackedKeywordKey,
      );

      if (!existingTrackedKeyword) {
        throw createBadRequestError('Tracked keyword record was not found for this account.');
      }
      const { activity } = getTrackedKeywordScopedState(
        state,
        getResolvedPlanLimits(userData),
      );
      if (!activity.activeTrackedKeywordKeys.has(trackedKeywordKey)) {
        throw createBadRequestError(
          'This tracked keyword is paused because your current plan keyword limit has been reached.',
        );
      }

      const refreshResult = await refreshTrackedKeywordRecord(
        existingTrackedKeyword,
        rankingDepth,
      );
      const nextTrackedKeywords = state.trackedKeywords.map((entry) =>
        getTrackedKeywordKey(entry) === trackedKeywordKey
          ? refreshResult.trackedKeyword
          : entry,
      );
      const nextRankHistory = refreshResult.historyEntry
        ? mergeRankHistory(state.rankHistory, [refreshResult.historyEntry])
        : state.rankHistory;
      const retainedRankHistory = await archiveAndTrimTrackedRankHistory(
        userDocRef,
        nextRankHistory,
      );
      const { updatedRules, createdEvents } = await evaluateAndDispatchAlertRules(
        userDocRef,
        state.trackedKeywords,
        nextTrackedKeywords,
        state.alertRules,
        state.notificationSettings,
        createAlertRunKey('manual'),
      );

      await userDocRef.set({
        trackedKeywords: nextTrackedKeywords,
        rankHistory: retainedRankHistory,
        alertRules: updatedRules,
        updatedAt: new Date().toISOString(),
      } satisfies UserTrackingDocument, { merge: true });

      res.json({
        trackedKeyword: refreshResult.trackedKeyword,
        alertEvents: createdEvents,
      });
    } catch (error) {
      return sendApiError(res, error, 'Failed to refresh tracked keyword.');
    }
  });

  app.get('/api/alerts/events', authedLightRateLimit, async (req, res) => {
    try {
      const decodedToken = await verifyFirebaseRequest(req);
      const adminDb = getFirebaseAdminDb();
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }
      const rawLimit = Number(req.query.limit);
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.round(rawLimit), 1), 100) : 30;
      const snapshot = await adminDb
        .collection('users')
        .doc(decodedToken.uid)
        .collection('alert_events')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();
      const events = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<AlertEvent, 'id'>),
      }));
      res.json({ events });
    } catch (error) {
      return sendApiError(res, error, 'Failed to load alert history.');
    }
  });

  app.get('/api/competitors/aso/history', authedLightRateLimit, async (req, res) => {
    try {
      const decodedToken = await verifyFirebaseRequest(req);
      const adminDb = getFirebaseAdminDb();
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }
      const rawLimit = Number(req.query.limit);
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.round(rawLimit), 1), 500) : 250;
      const userDocRef = adminDb.collection('users').doc(decodedToken.uid);
      const userSnapshot = await userDocRef.get();
      const userData = userSnapshot.data() as UserTrackingDocument | undefined;
      const activeGroupIds = new Set(
        normalizeUserTrackingDocument(userData).competitorGroups.map((group) => group.groupId),
      );
      const snapshot = await userDocRef
        .collection('competitor_aso_diffs')
        .orderBy('detectedAt', 'desc')
        .limit(limit)
        .get();
      const diffs = snapshot.docs
        .map((doc) => sanitizeCompetitorAsoDiffRecord({
          diffId: doc.id,
          ...doc.data(),
        }))
        .filter((diff): diff is CompetitorAsoDiffRecord => Boolean(diff))
        .filter((diff) => activeGroupIds.has(diff.groupId));
      res.json({
        diffs,
        summary: buildCompetitorAsoSummary(diffs),
      });
    } catch (error) {
      return sendApiError(res, error, 'Failed to load competitor ASO history.');
    }
  });

  app.post('/api/alerts/events/mark-read', authedLightRateLimit, async (req, res) => {
    try {
      const decodedToken = await verifyFirebaseRequest(req);
      const adminDb = getFirebaseAdminDb();
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }
      const markAll = readOptionalBoolean(req.body?.markAll);
      const nowIso = new Date().toISOString();
      const userEventsRef = adminDb.collection('users').doc(decodedToken.uid).collection('alert_events');

      if (markAll) {
        const snapshot = await userEventsRef.where('readAt', '==', null).get();
        await Promise.all(snapshot.docs.map((doc) => doc.ref.set({ readAt: nowIso }, { merge: true })));
        res.json({ success: true, updated: snapshot.size });
        return;
      }

      const eventIds: string[] = Array.isArray(req.body?.eventIds)
        ? Array.from(
            new Set(
              req.body.eventIds
                .map((entry: unknown) => readRequiredString(entry, 'eventIds[]', 200))
                .slice(0, 100),
            ),
          )
        : [];
      if (!eventIds.length) {
        throw createBadRequestError('Provide one or more alert event IDs to mark as read.');
      }
      await Promise.all(
        eventIds.map((eventId) => userEventsRef.doc(eventId).set({ readAt: nowIso }, { merge: true })),
      );
      res.json({ success: true, updated: eventIds.length });
    } catch (error) {
      return sendApiError(res, error, 'Failed to update alert history.');
    }
  });

  // API Routes
  app.get('/api/public-config', (req, res) => {
    const config = readPublicFirebaseClientConfig();
    const missingKeys = getMissingPublicFirebaseConfigKeys(config);
    res.set('Cache-Control', 'no-store');
    res.json({
      configured: missingKeys.length === 0,
      config: missingKeys.length === 0 ? config : null,
      missingKeys,
    });
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/auth/events', authEventRateLimit, async (req, res) => {
    try {
      const attemptId = readRequiredString(req.body?.attemptId, 'attemptId', 120);
      const provider = readAuthEventProvider(req.body?.provider);
      const flow = readAuthEventFlow(req.body?.flow);
      const phase = readAuthEventPhase(req.body?.phase);
      const host = readRequiredString(req.body?.host, 'host', 200).toLowerCase();
      const requestPath = readRequiredString(req.body?.path, 'path', 500);
      const userAgent = readOptionalString(req.body?.userAgent, 'userAgent', 500) || 'unknown';
      const occurredAt = readRequiredString(req.body?.occurredAt, 'occurredAt', 64);
      const errorCode = readOptionalString(req.body?.errorCode, 'errorCode', 120) || undefined;
      const errorMessage = readOptionalString(req.body?.errorMessage, 'errorMessage', 240) || undefined;

      if (Number.isNaN(Date.parse(occurredAt))) {
        throw createBadRequestError('occurredAt must be a valid ISO timestamp.');
      }

      console.info(
        JSON.stringify({
          type: 'auth_event',
          provider,
          flow,
          phase,
          attemptId,
          host,
          path: requestPath,
          userAgent,
          occurredAt,
          errorCode,
          errorMessage,
          receivedAt: new Date().toISOString(),
          ip: req.ip || req.socket.remoteAddress || 'unknown',
        }),
      );

      res.status(202).json({ accepted: true });
    } catch (error) {
      return sendApiError(res, error, 'Failed to record auth telemetry.');
    }
  });

  app.get('/api/chart-categories', moderateRateLimit, async (req, res) => {
    try {
      const storeType = readStoreType(req.query.store);
      const country = normalizeCountryCode(
        readOptionalString(req.query.country, 'country', 12) || 'us',
        'us',
      );
      res.json({
        store: storeType,
        country,
        categories: getChartCategoryOptions(storeType),
      });
    } catch (error) {
      return sendApiError(res, error, 'Failed to load chart categories.');
    }
  });

  app.get('/api/charts', strictRateLimit, async (req, res) => {
    try {
      const storeType = readStoreType(req.query.store);
      const country = normalizeCountryCode(
        readOptionalString(req.query.country, 'country', 12) || 'us',
        'us',
      );
      const categoryCode = readRequiredString(req.query.category, 'category', 80);
      const chartTypeRaw = readRequiredString(req.query.chartType, 'chartType', 20);
      const chartType: ChartType =
        chartTypeRaw === 'free' || chartTypeRaw === 'paid' || chartTypeRaw === 'grossing'
          ? chartTypeRaw
          : (() => {
              throw createBadRequestError('chartType must be one of: free, paid, grossing.');
            })();
      const rawNum = Number(req.query.num);
      const num = Number.isFinite(rawNum) ? Math.min(Math.max(Math.round(rawNum), 10), 200) : 100;
      const categoryOption = findChartCategory(storeType, categoryCode);
      if (!categoryOption) {
        throw createBadRequestError(`Unsupported chart category "${categoryCode}" for ${storeType}.`);
      }

      const entries = await fetchCategoryChartEntries(
        storeType,
        country,
        categoryOption,
        chartType,
        num,
      );

      res.json({
        store: storeType,
        country,
        category: categoryOption,
        chartType,
        loadedAt: new Date().toISOString(),
        entries,
      });
    } catch (error) {
      return sendApiError(res, error, 'Failed to load category charts.');
    }
  });

  app.get('/api/tracking/state', async (_req, res) => {
    return res.status(410).json({
      error: 'Legacy tracking state endpoint has been retired.',
    });
  });

  app.post('/api/tracking/state', async (_req, res) => {
    return res.status(410).json({
      error: 'Legacy tracking state endpoint has been retired.',
    });
  });

  app.post('/api/tracking/run', async (req, res) => {
    return res.status(410).json({
      error: 'Tracked keyword refresh is schedule-driven only. Manual refresh is no longer available.',
    });
  });

  // Manual or emergency fallback trigger only.
  // Production daily tracking should be driven by the Cloud Run Job scheduler.
  app.get('/api/cron/run', async (req, res) => {
    try {
      const cronSecret = process.env.CRON_SECRET?.trim();
      if (!cronSecret) {
        throw createConfigurationError('CRON_SECRET is not configured on the server.');
      }

      if (req.header('x-cron-secret') !== cronSecret) {
        throw createForbiddenError('Missing or invalid cron secret.');
      }

      console.log('[cron] Manual fallback trigger received. Starting keyword synchronization...');
      const now = new Date();
      const runKey = getGlobalTrackingRunKey(now);

      const userSummary = await runAndPersistAllUserTrackingSchedules(runKey, {
        trigger: 'manual',
      });

      res.json({
        status: 'success',
        timestamp: now.toISOString(),
        runKey,
        userSummary,
      });
    } catch (error: any) {
      console.error('[cron] Trigger failed:', error);
      return sendApiError(res, error, 'Cron task failed to execute.');
    }
  });

  app.get('/api/cron/watchdog', async (req, res) => {
    try {
      const cronSecret = process.env.CRON_SECRET?.trim();
      if (!cronSecret) {
        throw createConfigurationError('CRON_SECRET is not configured on the server.');
      }

      if (req.header('x-cron-secret') !== cronSecret) {
        throw createForbiddenError('Missing or invalid cron secret.');
      }

      const adminDb = getFirebaseAdminDb();
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }

      const now = new Date();
      const expectedRunKey = getGlobalTrackingRunKey(now);
      const dueAt = getGlobalTrackingWatchdogDueAtIso(now);

      if (!isGlobalTrackingWatchdogWindowOpen(now)) {
        return res.json({
          status: 'waiting',
          timestamp: now.toISOString(),
          expectedRunKey,
          dueAt,
          reason: 'watchdog-window-not-reached',
        });
      }

      const statusRef = adminDb.doc('system/dailyTracking');
      const statusSnapshot = await statusRef.get();
      const statusData = statusSnapshot.data() as DailyTrackingStatusRecord | undefined;
      const isCurrentRun = statusData?.runKey === expectedRunKey;
      const startedAgoMinutes = getMinutesSinceIsoTimestamp(statusData?.lastStartedAt, now);
      const lastRetryAgoMinutes = getMinutesSinceIsoTimestamp(statusData?.lastRetryAt, now);

      if (
        isCurrentRun &&
        statusData?.lastStatus === 'success'
      ) {
        return res.json({
          status: 'success',
          timestamp: now.toISOString(),
          expectedRunKey,
          dueAt,
          action: 'none',
          reason: 'run-already-succeeded',
        });
      }

      if (
        isCurrentRun &&
        hasActiveDailyTrackingLease(statusData, now)
      ) {
        return res.json({
          status: 'running',
          timestamp: now.toISOString(),
          expectedRunKey,
          dueAt,
          action: 'none',
          reason: 'run-still-in-flight',
          startedAt: statusData.lastStartedAt,
          retryCount: statusData.retryCount || 0,
          nextRetryAt: statusData.leaseExpiresAt,
        });
      }

      if (
        isCurrentRun &&
        statusData?.lastStatus === 'running' &&
        startedAgoMinutes !== null &&
        startedAgoMinutes < GLOBAL_TRACKING_WATCHDOG_RUNNING_GRACE_MINUTES
      ) {
        return res.json({
          status: 'running',
          timestamp: now.toISOString(),
          expectedRunKey,
          dueAt,
          action: 'none',
          reason: 'run-still-in-flight',
          startedAt: statusData.lastStartedAt,
          retryCount: statusData.retryCount || 0,
          nextRetryAt: addMinutesToIsoTimestamp(
            statusData.lastStartedAt,
            GLOBAL_TRACKING_WATCHDOG_RUNNING_GRACE_MINUTES,
          ),
        });
      }

      if (
        isCurrentRun &&
        statusData?.lastStatus === 'partial' &&
        !statusData.watchdogRetryEligible
      ) {
        return res.json({
          status: 'partial',
          timestamp: now.toISOString(),
          expectedRunKey,
          dueAt,
          action: 'none',
          reason: 'partial-not-retryable',
          retryCount: statusData.retryCount || 0,
        });
      }

      if (
        isCurrentRun &&
        statusData?.lastStatus !== 'success' &&
        statusData?.lastStatus !== 'running' &&
        lastRetryAgoMinutes !== null &&
        lastRetryAgoMinutes < GLOBAL_TRACKING_WATCHDOG_RETRY_INTERVAL_MINUTES
      ) {
        return res.json({
          status: statusData.lastStatus,
          timestamp: now.toISOString(),
          expectedRunKey,
          dueAt,
          action: 'none',
          reason: 'retry-cooldown-active',
          retryCount: statusData.retryCount || 0,
          nextRetryAt: addMinutesToIsoTimestamp(
            statusData.lastRetryAt,
            GLOBAL_TRACKING_WATCHDOG_RETRY_INTERVAL_MINUTES,
          ),
        });
      }

      const force = isCurrentRun;
      console.log(
        `[cron] Watchdog check for ${expectedRunKey}. Current status=${statusData?.lastStatus || 'missing'} force=${force}.`,
      );

      const userSummary = await runAndPersistAllUserTrackingSchedules(
        expectedRunKey,
        {
          force,
          trigger: 'watchdog',
        },
      );

      const refreshedStatus = await statusRef.get();
      const refreshedData = refreshedStatus.data() as
        | {
            lastStatus?: string;
            retryCount?: number;
          }
        | undefined;

      return res.json({
        status: refreshedData?.lastStatus || 'success',
        timestamp: now.toISOString(),
        expectedRunKey,
        dueAt,
        action: 'rerun',
        forced: force,
        retryCount: refreshedData?.retryCount || 0,
        userSummary,
      });
    } catch (error: any) {
      console.error('[cron] Watchdog failed:', error);
      return sendApiError(res, error, 'Cron watchdog failed to execute.');
    }
  });

  // Search for an app
  app.get('/api/search', moderateRateLimit, async (req, res) => {
    try {
      const term = readRequiredString(req.query.term, 'term', 120);
      const country = readOptionalString(req.query.country, 'country', 12) || 'us';
      const storeType = readStoreTypeOrDefault(req.query.store, 'android');
      const deadlineAt = getUpstreamDeadline();
      const normalizedCountry = normalizeCountryCode(country, 'us');
      const results = await searchStore(
        term,
        storeType,
        normalizedCountry,
        30,
        { webFallbackOnEmpty: true },
        deadlineAt,
      );
      res.json(results);
    } catch (error) {
      console.error(`Search error [term=${String(req.query.term || '')}, store=${String(req.query.store || '')}]:`, error);
      return sendApiError(res, error, 'The app store search is taking too long. Please try again.');
    }
  });

  // Get app details
  app.get('/api/app', moderateRateLimit, async (req, res) => {
    try {
      const id = readRequiredString(req.query.id, 'id', 160);
      const country = readOptionalString(req.query.country, 'country', 12) || 'us';
      const storeType = readStoreTypeOrDefault(req.query.store, 'android');
      const normalizedCountry = normalizeCountryCode(country, 'us');
      const details = await getStoreAppDetails(
        id,
        storeType,
        normalizedCountry,
        getUpstreamDeadline(),
      );
      res.json(details);
    } catch (error) {
      console.error(`App details error [id=${String(req.query.id || '')}, store=${String(req.query.store || '')}]:`, error);
      return sendApiError(res, error, 'The app store details request is taking too long. Please try again.');
    }
  });

  // Keyword ranking
  app.get('/api/ranking', strictRateLimit, async (req, res) => {
    try {
      const keyword = readRequiredString(req.query.keyword, 'keyword', 120);
      const appId = readRequiredString(req.query.appId, 'appId', 160);
      const country = readOptionalString(req.query.country, 'country', 12) || 'us';
      const storeType = readStoreTypeOrDefault(req.query.store, 'android');
      const deadlineAt = getUpstreamDeadline(45000);
      const rankingDepth = normalizeRankingDepth(req.query.depth);
      const normalizedCountry = normalizeCountryCode(country, 'us');
      const rank = await getKeywordRank(
        keyword,
        appId,
        storeType,
        normalizedCountry,
        req.query.refresh === 'true',
        rankingDepth,
        deadlineAt,
      );
      res.json({ keyword, rank, depth: rankingDepth });
    } catch (error) {
      console.error(`Ranking error [keyword=${String(req.query.keyword || '')}, appId=${String(req.query.appId || '')}]:`, error);
      return sendApiError(res, error, 'The keyword ranking request is taking too long. Please try again.');
    }
  });

  // Deterministic keyword metrics estimation
  app.post('/api/metrics', moderateRateLimit, async (req, res) => {
    try {
      const keywords = readKeywordArray(req.body?.keywords, 'keywords', 100, 120);
      const title = readOptionalString(req.body?.title, 'title', 200);
      const description = readOptionalString(req.body?.description, 'description', 10000);
      const category = readOptionalString(req.body?.category, 'category', 200);
      const developer = readOptionalString(req.body?.developer, 'developer', 200);
      const store = readOptionalString(req.body?.store, 'store', 20);
      const country = readOptionalString(req.body?.country, 'country', 12) || 'us';
      const normalizedCountry = normalizeCountryCode(country, 'us');
      const normalizedStore =
        store === 'android' || store === 'ios' ? store : undefined;
      const metricContext: KeywordContext = {
        title,
        description,
        category,
        developer,
        store: normalizedStore,
        country: normalizedCountry,
      };
      const signalContext = normalizedStore
        ? await buildKeywordSignals(
            metricContext,
            'fast',
            DISCOVERY_PROFILES.fast,
          )
        : undefined;
      const baseMarketSamples = normalizedStore
        ? await buildKeywordMarketSamples(
            keywords,
            {
              title,
              category,
              store: normalizedStore,
              country: normalizedCountry,
            },
          )
        : undefined;
      const candidates = keywords.map((rawKeyword, index) => {
        const keyword = String(rawKeyword);
        const features = extractKeywordFeatures(
          metricContext,
          keyword,
          signalContext,
          baseMarketSamples?.get(normalizeKeyword(keyword)),
        );
        return {
          id: index,
          keyword,
          features,
          baseline: scoreKeywordMetrics(features),
        };
      });
      const enrichedMarketSamples = normalizedStore
        ? await buildKeywordMarketSamples(
            keywords,
            {
              title,
              category,
              store: normalizedStore,
              country: normalizedCountry,
            },
            {
              enrichKeywords: selectMetricEnrichmentKeywords(
                candidates,
                Math.min(candidates.length, 12),
              ),
            },
          )
        : undefined;
      const metrics = candidates.map((candidate) => {
        const features = extractKeywordFeatures(
          metricContext,
          candidate.keyword,
          signalContext,
          enrichedMarketSamples?.get(normalizeKeyword(candidate.keyword))
            ?? baseMarketSamples?.get(normalizeKeyword(candidate.keyword)),
        );
        return scoreKeywordMetrics(features);
      });

      res.json({ metrics });
    } catch (error) {
      return sendApiError(res, error, 'Failed to estimate keyword metrics.');
    }
  });

  // Deterministic keyword generation
  app.post('/api/keywords', strictRateLimit, async (req, res) => {
    try {
      const title = readRequiredString(req.body?.title, 'title', 200);
      const description = readOptionalString(req.body?.description, 'description', 10000);
      const category = readOptionalString(req.body?.category, 'category', 200);
      const developer = readOptionalString(req.body?.developer, 'developer', 200);
      const storeType = readStoreType(req.body?.store);
      const country = readOptionalString(req.body?.country, 'country', 12) || 'us';
      const rawKeywords = await buildKeywordCandidates({
        title,
        description,
        category,
        developer,
        store: storeType as StoreType,
        country: normalizeCountryCode(country, 'us'),
      }, 'deep', DISCOVERY_PROFILES.deep);
      const refined = await refineKeywordsWithGemini(
        { title, description, category },
        rawKeywords,
        'deep',
      );

      res.json({ keywords: refined.keywords });
      
    } catch (error) {
      console.error(`Keyword generation error:`, error);
      return sendApiError(res, error, 'Keyword generation is taking too long. Please try again.');
    }
  });

  app.post('/api/discover', discoverRateLimit, async (req, res) => {
    let appId = 'unknown';
    let storeType: StoreType | 'unknown' = 'unknown';
    try {
      appId = readRequiredString(req.body?.appId, 'appId', 160);
      const title = readRequiredString(req.body?.title, 'title', 200);
      const description = readOptionalString(req.body?.description, 'description', 10000);
      const category = readOptionalString(req.body?.category, 'category', 200);
      const developer = readOptionalString(req.body?.developer, 'developer', 200);
      storeType = readStoreType(req.body?.store);
      const country = readOptionalString(req.body?.country, 'country', 12) || 'us';
      const discoveryMode: DiscoveryMode = req.body?.mode === 'fast' ? 'fast' : 'deep';
      const data = await discoverRankedKeywords({
        appId,
        title,
        description,
        category,
        developer,
        store: storeType as StoreType,
        country: normalizeCountryCode(country, 'us'),
        mode: discoveryMode,
      });

      res.json(data);
    } catch (error) {
      console.error(`Discovery error [appId=${appId}, store=${storeType}]:`, error);
      return sendApiError(res, error, 'Keyword discovery is taking too long. Please try again.');
    }
  });

  // Vite middleware for development
  if (isDevelopment) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          port: 0,
        },
        watch: {
          ignored: ['**/data/tracking-state.json'],
        },
      },
      // Serve the HTML ourselves so Vite doesn't inject /@vite/client.
      appType: 'custom',
    });
    const sendDevIndex = async (res: express.Response, next: express.NextFunction) => {
      try {
        const html = await readFile(path.join(process.cwd(), 'index.html'), 'utf-8');
        const transformedHtml = await vite.transformIndexHtml('/', html);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(transformedHtml);
      } catch (error) {
        next(error);
      }
    };

    app.get('/', async (_req, res, next) => {
      await sendDevIndex(res, next);
    });
    app.get('/index.html', async (_req, res, next) => {
      await sendDevIndex(res, next);
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const listenHost = '0.0.0.0';
  const { port } = await listenOnAvailablePort(app, PORT, listenHost);
  console.log(`Server running on http://localhost:${port}`);
}

startServer();
