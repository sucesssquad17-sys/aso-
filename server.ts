import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import OpenAI from 'openai';
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
import {
  ProxyAgent as UndiciProxyAgent,
  type Dispatcher as UndiciDispatcher,
} from 'undici';
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
  filterUnresolvedCompetitorTrackedKeywords,
  filterUnresolvedTrackedKeywords,
  getGlobalTrackingRunKey as getSharedGlobalTrackingRunKey,
  getGlobalTrackingScheduledMinutes,
  getGlobalTrackingWatchdogDueAtIso as getSharedGlobalTrackingWatchdogDueAtIso,
  getZonedDateParts as getSharedZonedDateParts,
  initializeFirebaseAdminAppFromEnv,
  isGlobalTrackingRunTime as isSharedGlobalTrackingRunTime,
  isGlobalTrackingWatchdogWindowOpen as isSharedGlobalTrackingWatchdogWindowOpen,
  mergeRankHistory as mergeSharedRankHistory,
  normalizeTrackingSchedule as normalizeSharedTrackingSchedule,
  refreshAllTrackingState as refreshSharedAllTrackingState,
  refreshTrackedKeywordRecord as refreshSharedTrackedKeywordRecord,
  shouldRunTrackingRefresh,
  type TrackingRefreshMode,
  TRACKING_HISTORY_LIMIT as SHARED_TRACKING_HISTORY_LIMIT,
} from './src/lib/backendTracking';
import {
  DEFAULT_GLOBAL_TRACKING_TIME,
  GLOBAL_TRACKING_TIMEZONE,
} from './src/lib/trackingTime';
import {
  buildWeeklyReportEmailHtml,
  buildWeeklyReportEmailText,
  buildWeeklyReportEmailSummary,
  buildWeeklyReportWorkspaceUrl,
  getSafeAppUrl,
  getResendEmailId,
  sendAlertEmailEvents as sendSharedAlertEmailEvents,
} from './src/lib/backendEmail';
import { resolveCategoryEmailRecipient } from './src/lib/backendEmailRecipients';
import {
  DISCOVERY_CANDIDATE_CACHE_TTL,
  DISCOVERY_CACHE_VERSION,
  getDiscoveryCandidateCacheKey,
  getDiscoveryRankedResultCacheKey,
} from './src/lib/discoveryCache';
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
  getTrackedAppIdentityKeysForPlanUsage,
  getTrackedKeywordActivity,
  getTrackedKeywordIdentityKey,
  resolveBillingPlanId,
  type PlanEntitlements,
  type PlanLimits,
} from './src/lib/planLimits';
import {
  getBillingFeatureEntitlements,
  hasPlanFeature,
  resolveBillingAccess,
  type BillingAccessState,
  type BillingEntitlementState,
  type BillingFeature,
} from './src/lib/billingAccess';
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
import { flattenCompetitorTrackedKeywordsForAlerts } from './src/lib/alertTracking';
import {
  getWeeklyReportRangeStartIso,
  normalizeWeeklyReportSettings,
  shouldSendWeeklyReportForDate,
  type WeeklyReportSettings,
} from './src/lib/weeklyReports';
import {
  claimWeeklyReportDelivery,
  finalizeWeeklyReportDelivery,
} from './src/lib/weeklyReportDelivery';
import {
  buildAlertEventId as buildSharedAlertEventId,
  buildCompetitorAsoAlertEventId,
} from './src/lib/alertEventIdentity';
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
import {
  isDiscoveryKeywordCandidate,
  shouldAdmitDiscoveryCandidate,
} from './src/lib/discoveryKeywordGating';
import {
  buildDiscoveryContextCandidateKeywords,
  buildDiscoveryPromptSections as buildSharedDiscoveryPromptSections,
  buildDiscoveryRefinementPrompt as buildSharedDiscoveryRefinementPrompt,
  compactDiscoveryPromptCandidates as compactSharedDiscoveryPromptCandidates,
  type DiscoveryPromptLimits,
} from './src/lib/discoveryPromptContext';
import {
  buildDiscoveryWarnings,
  resolveDiscoveryResponseStatus,
  type DiscoveryCompetitorMiningStatus,
} from './src/lib/discoveryResponse';
import {
  findAppleSearchResultIndex,
  getNormalizedAppleResultIds,
  getNormalizedAppleTargetIds,
} from './src/lib/appleAppMatching';
import {
  buildPlayStoreFetchInit,
  resolveGooglePlayRankWithFallback,
  type GooglePlayRankLogEvent,
} from './src/lib/googlePlayProxyRouting';

if (process.env.NODE_ENV !== 'production') {
  process.env.DISABLE_HMR = 'true';
}

// Discovery rank results and candidate/refinement caches stay fresh for 30 minutes.
const rankingCache = new NodeCache({ stdTTL: 14400 });
const discoveryCandidateCache = new NodeCache({ stdTTL: DISCOVERY_CANDIDATE_CACHE_TTL / 1000, useClones: false });
const keywordSourceCache = new NodeCache({ stdTTL: DISCOVERY_CANDIDATE_CACHE_TTL / 1000 });
const keywordRefinementCache = new NodeCache({ stdTTL: DISCOVERY_CANDIDATE_CACHE_TTL / 1000, useClones: false });
const keywordMarketCache = new NodeCache({ stdTTL: 14400, useClones: false });
const searchCache = new NodeCache({ stdTTL: 3600, useClones: false });
const appDetailsCache = new NodeCache({ stdTTL: 86400, useClones: false });
const discoveryCache = new NodeCache({ stdTTL: 30 * 60, useClones: false });
const chartCache = new NodeCache({ stdTTL: 900, useClones: false });
const upstreamFailureCache = new NodeCache({ useClones: false });
const dodoWebhookEventCache = new NodeCache({ stdTTL: 60 * 60 * 24, useClones: false });
const billingPricingCache = new NodeCache({ stdTTL: 15 * 60, useClones: false });
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL?.trim() || '';
const CRON_FAILURE_EMAIL_RECIPIENTS = (process.env.CRON_FAILURE_EMAIL || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const ADMIN_EMAIL_ALLOWLIST = (process.env.ADMIN_EMAIL_ALLOWLIST || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const EMAIL_UNSUBSCRIBE_SECRET = process.env.EMAIL_UNSUBSCRIBE_SECRET?.trim() || '';
const ANNOUNCEMENT_EMAIL_CAMPAIGNS_COLLECTION = 'admin_email_campaigns';
const ALERT_EMAIL_APP_URL = getSafeAppUrl(process.env.APP_URL);
const ANNOUNCEMENT_SEND_STALE_AFTER_MS = 30 * 60 * 1000;
const PLAY_STORE_FETCH_TIMEOUT_MS = 60000;
const UPSTREAM_REQUEST_TIMEOUT_MS = 60000;
const UPSTREAM_FAILURE_CACHE_TTL_SECONDS = 15;
const RANKING_FETCH_TIMEOUT_MS = 60000;
const GLOBAL_TRACKING_WATCHDOG_DELAY_MINUTES = 60;
const DAILY_TRACKING_LEASE_OWNER = `service:${process.pid}:${crypto.randomUUID()}`;
const DODO_WEBHOOK_LEASE_TTL_MINUTES = 15;
const DODO_WEBHOOK_PROCESS_OWNER = `dodo:${process.pid}:${crypto.randomUUID()}`;

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
type PaidBillingPlanId = Exclude<BillingPlanId, 'free' | 'agency'>;
type BillingPlanPrice = {
  productId: string;
  priceLabel: string | null;
  currency: string | null;
  amount: number | null;
  productName: string | null;
};
type BillingPlanPricing = Record<
  PaidBillingPlanId,
  Partial<Record<BillingInterval, BillingPlanPrice>>
>;
type BillingPricingCatalog = {
  configured: boolean;
  productConfigured: boolean;
  availablePlans: BillingPlanId[];
  availableBillingIntervals: BillingInterval[];
  availablePlanIntervals: Record<PaidBillingPlanId, BillingInterval[]>;
  planPricing: BillingPlanPricing;
  environment: 'test' | 'live';
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
  weeklyReportSettings?: WeeklyReportSettings;
  alertRules?: AlertRule[];
  notificationSettings?: NotificationSettings;
  alertEmailsEnabled?: boolean;
  alertEmailsUpdatedAt?: string;
  announcementEmailsEnabled?: boolean;
  announcementEmailsUpdatedAt?: string;
  lastAnnouncementEmailSentAt?: string;
  lastAnnouncementEmailCampaignId?: string;
  billingProvider?: BillingProvider;
  billingEmail?: string;
  dodoCustomerId?: string;
  dodoSubscriptionId?: string;
  dodoProductId?: string;
  subscriptionTier?: string;
  subscribedPlanId?: string;
  subscriptionInterval?: BillingInterval;
  isPremium?: boolean;
  paypalSubscriptionId?: string;
  paypalPlanId?: string;
  subscriptionStatus?: BillingSubscriptionStatus;
  providerSubscriptionStatus?: BillingSubscriptionStatus;
  pendingPlanId?: BillingPlanId;
  pendingInterval?: BillingInterval;
  subscriptionCurrentPeriodEnd?: string;
  subscriptionCancelAtPeriodEnd?: boolean;
  subscriptionUpdatedAt?: string;
  lastBillingEventType?: string;
  lastBillingWebhookId?: string;
  billingReviewRequired?: boolean;
  billingReviewReason?: string;
  accountStatus?: 'active' | 'deleting' | 'deleted';
  deletedAt?: string;
  authDeletedAt?: string;
  authDeleteFailedAt?: string;
  authDeleteError?: string;
  legalAcceptedAt?: string;
  legalVersion?: string;
  stateVersion?: number;
  serverUpdatedAt?: string;
  migratedFromLocalAt?: string;
  updatedAt?: string;
};
type AnnouncementAudience = 'all' | 'paid' | 'free';
type AnnouncementCampaignStatus = 'draft' | 'sending' | 'sent' | 'failed';
type AnnouncementEmailCampaignDocument = {
  campaignId: string;
  subject: string;
  message: string;
  audience: AnnouncementAudience;
  buttonLabel?: string;
  buttonUrl?: string;
  status: AnnouncementCampaignStatus;
  sendingStartedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  sentAt?: string;
  recipientCount?: number;
  deliveredCount?: number;
  failedCount?: number;
  lastError?: string;
};
type NormalizedUserTrackingDocument = TrackingState & {
  bookmarks: AppBookmark[];
  trackedApps: TrackedAppRecord[];
  appAnalysisSnapshots: AppAnalysisSnapshot[];
  weeklyReportSettings: WeeklyReportSettings;
  alertRules: AlertRule[];
  notificationSettings: NotificationSettings;
  legalAcceptedAt?: string;
  legalVersion?: string;
  stateVersion: number;
  serverUpdatedAt?: string;
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
  lastTrigger?: 'automatic' | 'manual' | 'watchdog' | 'recovery';
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
type DodoWebhookDeliveryRecord = {
  status?: 'processing' | 'success' | 'error';
  eventType?: string;
  claimedAt?: string;
  processedAt?: string;
  updatedAt?: string;
  error?: string;
  leaseOwner?: string;
  leaseExpiresAt?: string;
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
  vapidKey?: string;
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
  searchDepth: number;
  initialSearchDepth: number;
  rankingCheckLimit: number;
  proxyVerificationLimit: number;
  extendedDepthCandidateLimit: number;
  competitorSeedLimit: number;
  competitorResultsPerSeed: number;
  competitorMiningTimeoutMs: number;
  competitorProxyFallbackOnEmpty: boolean;
  verificationTimeoutMs: number;
  competitorTermLimit: number;
  finalRankingLimit: number;
};

const DISCOVERY_PROFILES: Record<DiscoveryMode, DiscoveryProfile> = {
  fast: {
    keywordLimit: 100,
    batchSize: 2,
    searchDepth: 100,
    initialSearchDepth: 100,
    rankingCheckLimit: 25,
    proxyVerificationLimit: 3,
    extendedDepthCandidateLimit: 0,
    competitorSeedLimit: 3,
    competitorResultsPerSeed: 4,
    competitorMiningTimeoutMs: 2000,
    competitorProxyFallbackOnEmpty: false,
    verificationTimeoutMs: 3500,
    competitorTermLimit: 50,
    finalRankingLimit: 18,
  },
  deep: {
    keywordLimit: 240,
    batchSize: 3,
    searchDepth: 150,
    initialSearchDepth: 100,
    rankingCheckLimit: 60,
    proxyVerificationLimit: 10,
    extendedDepthCandidateLimit: 4,
    competitorSeedLimit: 6,
    competitorResultsPerSeed: 6,
    competitorMiningTimeoutMs: 5000,
    competitorProxyFallbackOnEmpty: false,
    verificationTimeoutMs: 4500,
    competitorTermLimit: 100,
    finalRankingLimit: 40,
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
  enabled: true,
  time: DEFAULT_GLOBAL_TRACKING_TIME,
  timezone: GLOBAL_TRACKING_TIMEZONE,
};
const LEGACY_FILE_TRACKING_SCHEDULER_ENABLED =
  process.env.ENABLE_LEGACY_FILE_TRACKING_SCHEDULER?.trim() === 'true';
const GLOBAL_TRACKING_WATCHDOG_RETRY_INTERVAL_MINUTES = 60;
const GLOBAL_TRACKING_WATCHDOG_RUNNING_GRACE_MINUTES = 120;
const GLOBAL_TRACKING_WATCHDOG_MAX_RETRIES = 3;

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
  | 'FEATURE_NOT_AVAILABLE'
  | 'BILLING_TRANSITION'
  | 'RATE_LIMITED'
  | 'STALE_USER_STATE'
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
  meta?: Record<string, unknown>;

  constructor(
    message: string,
    options: {
      status: number;
      code: ApiErrorCode;
      retryable: boolean;
      meta?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.retryable = options.retryable;
    this.meta = options.meta;
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

const googlePlayDirectRequestOptions: StoreRequestOptions = {
  timeout: PLAY_STORE_FETCH_TIMEOUT_MS,
};
const googlePlayProxyRequestOptions: StoreRequestOptions = {
  timeout: PLAY_STORE_FETCH_TIMEOUT_MS,
};
const appStoreDirectRequestOptions: StoreRequestOptions = {
  timeout: PLAY_STORE_FETCH_TIMEOUT_MS,
};
const appStoreProxyRequestOptions: StoreRequestOptions = {
  timeout: PLAY_STORE_FETCH_TIMEOUT_MS,
};

if (proxyAgent && proxyUrlString) {
  googlePlayProxyRequestOptions.agent = {
    http: proxyAgent,
    https: proxyAgent
  };
  appStoreProxyRequestOptions.proxy = proxyUrlString;
}

const appStoreRequestOptions = appStoreProxyRequestOptions.proxy
  ? appStoreProxyRequestOptions
  : appStoreDirectRequestOptions;

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
    vapidKey: process.env.VITE_FIREBASE_VAPID_KEY?.trim() || undefined,
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
    'free',
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
  const interval =
    typeof price.payment_frequency_interval === 'string'
      ? price.payment_frequency_interval.toLowerCase()
      : price.payment_frequency_interval;
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

function createEmptyBillingPlanPricing(): BillingPlanPricing {
  return {
    indie: {},
    starter: {},
    pro: {},
  };
}

async function loadConfiguredBillingPlanPricing(
  client: NonNullable<ReturnType<typeof getDodoClient>>,
): Promise<BillingPlanPricing> {
  const productIds = getConfiguredDodoProductIdsByPlan();
  const planPricing = createEmptyBillingPlanPricing();

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

async function loadBillingPricingCatalog(): Promise<BillingPricingCatalog> {
  const cachedCatalog = billingPricingCache.get<BillingPricingCatalog>('catalog');
  if (cachedCatalog) {
    return cachedCatalog;
  }

  const client = getDodoClient();
  const environment = normalizeDodoEnvironment(
    process.env.DODO_ENVIRONMENT || process.env.DODO_PAYMENTS_ENVIRONMENT,
  );
  const availablePlans = getConfiguredBillingPlans();
  const planPricing = client
    ? await loadConfiguredBillingPlanPricing(client)
    : createEmptyBillingPlanPricing();
  const catalog: BillingPricingCatalog = {
    configured: Boolean(getDodoApiKey()),
    productConfigured: availablePlans.some(
      (planId) => planId === 'indie' || planId === 'starter' || planId === 'pro',
    ),
    availablePlans,
    availableBillingIntervals: getConfiguredBillingIntervals(),
    availablePlanIntervals: getConfiguredBillingPlanIntervals(),
    planPricing,
    environment: environment === 'live_mode' ? 'live' : 'test',
  };

  billingPricingCache.set('catalog', catalog);
  return catalog;
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

function getDodoWebhookEventRef(adminDb: Firestore, eventKey: string) {
  return adminDb.collection('_dodoWebhookEvents').doc(eventKey);
}

function hasActiveDodoWebhookLease(
  record: DodoWebhookDeliveryRecord | undefined,
  now: Date,
  ownerId?: string,
) {
  if (!record?.leaseOwner || !record.leaseExpiresAt) {
    return false;
  }
  if (ownerId && record.leaseOwner === ownerId) {
    return false;
  }

  const leaseExpiresAt = Date.parse(record.leaseExpiresAt);
  if (Number.isNaN(leaseExpiresAt)) {
    return false;
  }

  return leaseExpiresAt > now.getTime();
}

async function claimDodoWebhookEvent(adminDb: Firestore, eventKey: string) {
  const eventRef = getDodoWebhookEventRef(adminDb, eventKey);
  const now = new Date();
  const leaseExpiresAt = new Date(
    now.getTime() + DODO_WEBHOOK_LEASE_TTL_MINUTES * 60 * 1000,
  ).toISOString();

  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(eventRef);
    const record = snapshot.data() as DodoWebhookDeliveryRecord | undefined;

    if (record?.status === 'success') {
      return {
        status: 'duplicate' as const,
      };
    }

    if (record?.status === 'processing' && hasActiveDodoWebhookLease(record, now, DODO_WEBHOOK_PROCESS_OWNER)) {
      return {
        status: 'processing' as const,
      };
    }

    transaction.set(
      eventRef,
      {
        status: 'processing',
        claimedAt: now.toISOString(),
        updatedAt: now.toISOString(),
        error: FieldValue.delete(),
        leaseOwner: DODO_WEBHOOK_PROCESS_OWNER,
        leaseExpiresAt,
      },
      { merge: true },
    );

    return {
      status: 'claimed' as const,
      eventRef,
    };
  });
}

async function finalizeDodoWebhookEvent(
  eventRef: DocumentReference<DocumentData>,
  eventType: string,
) {
  await eventRef.set(
    {
      status: 'success',
      eventType,
      processedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      error: FieldValue.delete(),
      leaseOwner: FieldValue.delete(),
      leaseExpiresAt: FieldValue.delete(),
    },
    { merge: true },
  );
}

async function markDodoWebhookEventError(
  eventRef: DocumentReference<DocumentData>,
  error: unknown,
) {
  await eventRef.set(
    {
      status: 'error',
      updatedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      leaseOwner: FieldValue.delete(),
      leaseExpiresAt: FieldValue.delete(),
    },
    { merge: true },
  );
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
      return { userDocRef, matchedBy: 'firebase_uid' as const };
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
      return { userDocRef: customerMatch.docs[0].ref, matchedBy: 'dodo_customer_id' as const };
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
      return { userDocRef: emailMatch.docs[0].ref, matchedBy: 'billing_email' as const };
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

function getDodoWebhookOccurredAt(
  webhookTimestamp?: string,
): string {
  if (!webhookTimestamp) {
    return new Date().toISOString();
  }

  const numericTimestamp = Number(webhookTimestamp);
  if (Number.isFinite(numericTimestamp)) {
    const millis = numericTimestamp > 1_000_000_000_000
      ? numericTimestamp
      : numericTimestamp * 1000;
    return new Date(millis).toISOString();
  }

  const parsed = Date.parse(webhookTimestamp);
  return Number.isFinite(parsed)
    ? new Date(parsed).toISOString()
    : new Date().toISOString();
}

async function applyDodoSubscriptionEvent(
  event: DodoSubscriptionWebhookEvent,
  options?: {
    webhookId?: string;
    webhookTimestamp?: string;
  },
) {
  const adminDb = getFirebaseAdminDb();
  if (!adminDb) {
    throw createConfigurationError('Firebase Admin is not configured on the server.');
  }

  const resolvedUser = await resolveBillingUserDocument(adminDb, event);
  if (!resolvedUser) {
    console.warn(`[dodo] No matching user found for webhook ${event.type}.`);
    return;
  }
  const { userDocRef, matchedBy } = resolvedUser;
  const existingSnapshot = await userDocRef.get();
  const existingUserData = existingSnapshot.data() as UserTrackingDocument | undefined;
  const deletedAccount = isDeletedUserTrackingDocument(existingUserData);
  const eventOccurredAt = getDodoWebhookOccurredAt(options?.webhookTimestamp);
  const eventOccurredAtMs = Date.parse(eventOccurredAt);
  const existingUpdatedAtMs =
    typeof existingUserData?.subscriptionUpdatedAt === 'string'
      ? Date.parse(existingUserData.subscriptionUpdatedAt)
      : Number.NaN;

  if (
    Number.isFinite(existingUpdatedAtMs) &&
    Number.isFinite(eventOccurredAtMs) &&
    existingUpdatedAtMs > eventOccurredAtMs
  ) {
    console.warn(
      `[dodo] Skipping stale webhook ${event.type} for user ${userDocRef.id}. existing=${existingUserData?.subscriptionUpdatedAt} incoming=${eventOccurredAt}`,
    );
    return;
  }

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
    (subscriptionStatus === 'active' || subscriptionStatus === 'cancelled') &&
    Boolean(resolvedProductSelection) &&
    metadataMatchesProductSelection &&
    matchedBy !== 'billing_email' &&
    !deletedAccount;
  const billingEmail = event.data.customer?.email?.trim().toLowerCase();
  const subscribedPlanId =
    canGrantPaidPlan && resolvedProductSelection
      ? resolvedProductSelection.planId
      : resolveBillingPlanId(
          existingUserData?.subscribedPlanId ||
            existingUserData?.subscriptionTier ||
            'free',
        );
  const billingReviewReason =
    deletedAccount
      ? 'account_deleted'
      : (subscriptionStatus === 'active' || subscriptionStatus === 'cancelled') && !resolvedProductSelection
        ? 'unmatched_product_id'
        : (subscriptionStatus === 'active' || subscriptionStatus === 'cancelled') &&
            resolvedProductSelection &&
            !metadataMatchesProductSelection
          ? 'metadata_mismatch'
          : (subscriptionStatus === 'active' || subscriptionStatus === 'cancelled') && matchedBy === 'billing_email'
            ? 'email_only_webhook_match'
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
  if (matchedBy === 'billing_email' && subscriptionStatus === 'active') {
    console.warn(
      `[dodo] Active subscription webhook for user ${userDocRef.id} matched only by billing email. Premium access was not granted pending manual review.`,
    );
  }
  if (deletedAccount && subscriptionStatus === 'active') {
    console.warn(
      `[dodo] Active subscription webhook received for deleted account ${userDocRef.id}. Premium access remains disabled and billing review is required.`,
    );
  }

  const resolvedBillingAccess = resolveBillingAccess(
    {
      accountStatus: existingUserData?.accountStatus,
      subscribedPlanId,
      subscriptionTier: subscribedPlanId,
      providerSubscriptionStatus: subscriptionStatus,
      pendingPlanId: existingUserData?.pendingPlanId,
      pendingInterval: existingUserData?.pendingInterval,
      subscriptionCurrentPeriodEnd: event.data.next_billing_date || null,
      subscriptionCancelAtPeriodEnd: Boolean(event.data.cancel_at_next_billing_date),
      subscriptionUpdatedAt: eventOccurredAt,
      billingReviewRequired,
      billingReviewReason,
    },
    {
      now: new Date(eventOccurredAt),
    },
  );

  const billingUpdate: Record<string, unknown> = {
    billingProvider: 'dodo',
    ...(billingEmail ? { billingEmail } : {}),
    dodoCustomerId: event.data.customer?.customer_id?.trim() || FieldValue.delete(),
    dodoSubscriptionId: event.data.subscription_id?.trim() || FieldValue.delete(),
    dodoProductId: productId || FieldValue.delete(),
    subscriptionTier: resolvedBillingAccess.subscribedPlanId,
    subscribedPlanId: resolvedBillingAccess.subscribedPlanId,
    subscriptionInterval:
      resolvedProductSelection
        ? resolvedProductSelection.interval
        : existingUserData?.subscriptionInterval || FieldValue.delete(),
    isPremium: resolvedBillingAccess.hasPaidAccess,
    subscriptionStatus,
    providerSubscriptionStatus: subscriptionStatus,
    pendingPlanId: FieldValue.delete(),
    pendingInterval: FieldValue.delete(),
    subscriptionCurrentPeriodEnd:
      event.data.next_billing_date || FieldValue.delete(),
    subscriptionCancelAtPeriodEnd: Boolean(event.data.cancel_at_next_billing_date),
    billingReviewRequired,
    billingReviewReason: billingReviewReason || FieldValue.delete(),
    lastBillingEventType: event.type,
    lastBillingWebhookId: options?.webhookId || FieldValue.delete(),
    subscriptionUpdatedAt: eventOccurredAt,
    updatedAt: eventOccurredAt,
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

function normalizeEmailAddress(value: unknown) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getConfiguredResendSender() {
  const sender = normalizeEmailAddress(RESEND_FROM_EMAIL);
  return sender && isValidEmailAddress(sender) ? sender : null;
}

type EmailPreferenceKind = 'announcement' | 'alert' | 'weekly';

function buildEmailPreferenceToken(
  kind: EmailPreferenceKind,
  userId: string,
  email: string,
) {
  if (!EMAIL_UNSUBSCRIBE_SECRET) {
    throw createConfigurationError('EMAIL_UNSUBSCRIBE_SECRET is not configured on the server.');
  }
  return crypto
    .createHmac('sha256', EMAIL_UNSUBSCRIBE_SECRET)
    .update(`${kind}:${userId}:${email}`)
    .digest('hex');
}

function verifyEmailPreferenceToken(
  kind: EmailPreferenceKind,
  userId: string,
  email: string,
  token: string,
) {
  const expectedToken = buildEmailPreferenceToken(kind, userId, email);
  const providedBuffer = Buffer.from(token, 'hex');
  const expectedBuffer = Buffer.from(expectedToken, 'hex');
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

function assertAdminEmailAccess(email: string | null | undefined) {
  const normalizedEmail = normalizeEmailAddress(email);
  if (!ADMIN_EMAIL_ALLOWLIST.length) {
    throw createConfigurationError('ADMIN_EMAIL_ALLOWLIST is not configured on the server.');
  }
  if (!normalizedEmail || !ADMIN_EMAIL_ALLOWLIST.includes(normalizedEmail)) {
    throw createForbiddenError('This endpoint is restricted to configured admin email addresses.');
  }
  return normalizedEmail;
}

function readAnnouncementAudience(value: unknown): AnnouncementAudience {
  if (value === 'paid' || value === 'free') {
    return value;
  }
  if (value === undefined || value === null || value === '' || value === 'all') {
    return 'all';
  }
  throw createBadRequestError('A valid announcement audience is required.');
}

function readOptionalUrlString(value: unknown, field: string, maxLength: number) {
  const trimmed = readOptionalString(value, field, maxLength).trim();
  if (!trimmed) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Invalid protocol.');
    }
  } catch (_error) {
    throw createBadRequestError(`${field} must be a valid URL.`);
  }

  return trimmed;
}

function readOptionalBoolean(value: unknown) {
  return value === true;
}

function readRequiredObjectRecord(value: unknown, field: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw createBadRequestError(`${field} must be an object.`);
  }

  return value as Record<string, unknown>;
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
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again shortly.',
        code: 'RATE_LIMITED',
        retryable: true,
      });
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
            )
                .map((entry) => canonicalizeAsoScreenshotUrl(entry))
                .filter((entry) => entry.length > 0)
                .slice(0, 40)
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
  record: Pick<CompetitorTrackedKeywordRecord, 'groupId' | 'keyword' | 'country' | 'store'>,
) {
  return `${record.groupId}:${record.store}:${normalizeCountryCode(record.country, 'us')}:${record.keyword.toLowerCase()}`;
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
  return `${entry.groupId}:${entry.store}:${normalizeCountryCode(entry.country, 'us')}:${entry.appKey}:${entry.keyword.toLowerCase()}:${lookup.year}-${lookup.month}-${lookup.day}`;
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
  const schedule = normalizeTrackingSchedule(data?.trackingSchedule);
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
    schedule,
    weeklyReportSettings: normalizeWeeklyReportSettings(
      data?.weeklyReportSettings,
      schedule.timezone || GLOBAL_TRACKING_TIMEZONE,
    ),
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
    stateVersion:
      typeof data?.stateVersion === 'number' && Number.isFinite(data.stateVersion)
        ? Math.max(0, Math.trunc(data.stateVersion))
        : 0,
    serverUpdatedAt:
      typeof data?.serverUpdatedAt === 'string' && data.serverUpdatedAt
        ? data.serverUpdatedAt
        : undefined,
    migratedFromLocalAt:
      typeof data?.migratedFromLocalAt === 'string' && data.migratedFromLocalAt
        ? data.migratedFromLocalAt
        : undefined,
  };
}

function getResolvedPlanLimits(
  data:
    | Pick<
        UserTrackingDocument,
        | 'accountStatus'
        | 'billingReviewReason'
        | 'billingReviewRequired'
        | 'dodoProductId'
        | 'pendingInterval'
        | 'pendingPlanId'
        | 'providerSubscriptionStatus'
        | 'subscribedPlanId'
        | 'subscriptionCancelAtPeriodEnd'
        | 'subscriptionCurrentPeriodEnd'
        | 'subscriptionStatus'
        | 'subscriptionTier'
        | 'subscriptionUpdatedAt'
      >
    | null
    | undefined,
) {
  const resolved = resolveBillingAccess(data, {
    fallbackProductPlanId: resolvePlanIdFromProductId(data?.dodoProductId),
  });
  return getPlanLimits(resolved.effectivePlanId);
}

function getResolvedPlanEntitlements(
  data:
    | Pick<
        UserTrackingDocument,
        | 'accountStatus'
        | 'billingReviewReason'
        | 'billingReviewRequired'
        | 'dodoProductId'
        | 'pendingInterval'
        | 'pendingPlanId'
        | 'providerSubscriptionStatus'
        | 'subscribedPlanId'
        | 'subscriptionCancelAtPeriodEnd'
        | 'subscriptionCurrentPeriodEnd'
        | 'subscriptionStatus'
        | 'subscriptionTier'
        | 'subscriptionUpdatedAt'
      >
    | null
    | undefined,
) {
  const resolved = resolveBillingAccess(data, {
    fallbackProductPlanId: resolvePlanIdFromProductId(data?.dodoProductId),
  });
  return getBillingFeatureEntitlements(resolved.effectivePlanId);
}

function readPendingPlanId(planId?: string | null): BillingPlanId | null {
  return planId === 'indie' ||
    planId === 'starter' ||
    planId === 'pro' ||
    planId === 'agency'
    ? planId
    : null;
}

function deriveBillingAccessState(
  data:
    | Pick<
        UserTrackingDocument,
        | 'accountStatus'
        | 'billingReviewReason'
        | 'billingReviewRequired'
        | 'dodoProductId'
        | 'pendingInterval'
        | 'pendingPlanId'
        | 'providerSubscriptionStatus'
        | 'subscribedPlanId'
        | 'subscriptionCancelAtPeriodEnd'
        | 'subscriptionCurrentPeriodEnd'
        | 'subscriptionStatus'
        | 'subscriptionTier'
        | 'subscriptionUpdatedAt'
      >
    | null
    | undefined,
): BillingAccessState {
  return resolveBillingAccess(data, {
    fallbackProductPlanId: resolvePlanIdFromProductId(data?.dodoProductId),
  }).accessState;
}

function hasActiveBillingEntitlement(
  data:
    | Pick<
        UserTrackingDocument,
        | 'accountStatus'
        | 'billingReviewReason'
        | 'billingReviewRequired'
        | 'dodoProductId'
        | 'pendingInterval'
        | 'pendingPlanId'
        | 'providerSubscriptionStatus'
        | 'subscribedPlanId'
        | 'subscriptionCancelAtPeriodEnd'
        | 'subscriptionCurrentPeriodEnd'
        | 'subscriptionStatus'
        | 'subscriptionTier'
        | 'subscriptionUpdatedAt'
      >
    | null
    | undefined,
): boolean {
  return resolveBillingAccess(data, {
    fallbackProductPlanId: resolvePlanIdFromProductId(data?.dodoProductId),
  }).hasPaidAccess;
}

function hasBillingFeature(
  data:
    | Pick<
        UserTrackingDocument,
        | 'accountStatus'
        | 'billingReviewReason'
        | 'billingReviewRequired'
        | 'dodoProductId'
        | 'pendingInterval'
        | 'pendingPlanId'
        | 'providerSubscriptionStatus'
        | 'subscribedPlanId'
        | 'subscriptionCancelAtPeriodEnd'
        | 'subscriptionCurrentPeriodEnd'
        | 'subscriptionStatus'
        | 'subscriptionTier'
        | 'subscriptionUpdatedAt'
      >
    | null
    | undefined,
  feature: BillingFeature,
) {
  const resolved = resolveBillingAccess(data, {
    fallbackProductPlanId: resolvePlanIdFromProductId(data?.dodoProductId),
  });
  return hasPlanFeature(getBillingFeatureEntitlements(resolved.effectivePlanId), feature);
}

function createFeatureUnavailableError(
  feature: BillingFeature,
  effectivePlanId: BillingPlanId,
) {
  return new ApiError('Upgrade to use this feature.', {
    status: 403,
    code: 'FEATURE_NOT_AVAILABLE',
    retryable: false,
    meta: {
      feature,
      effectivePlanId,
    },
  });
}

function requireBillingFeature(
  data:
    | Pick<
        UserTrackingDocument,
        | 'accountStatus'
        | 'billingReviewReason'
        | 'billingReviewRequired'
        | 'dodoProductId'
        | 'pendingInterval'
        | 'pendingPlanId'
        | 'providerSubscriptionStatus'
        | 'subscribedPlanId'
        | 'subscriptionCancelAtPeriodEnd'
        | 'subscriptionCurrentPeriodEnd'
        | 'subscriptionStatus'
        | 'subscriptionTier'
        | 'subscriptionUpdatedAt'
      >
    | null
    | undefined,
  feature: BillingFeature,
) {
  const resolved = resolveBillingAccess(data, {
    fallbackProductPlanId: resolvePlanIdFromProductId(data?.dodoProductId),
  });
  if (!hasPlanFeature(getBillingFeatureEntitlements(resolved.effectivePlanId), feature)) {
    throw createFeatureUnavailableError(feature, resolved.effectivePlanId);
  }
  return resolved;
}

async function requireAuthenticatedBillingAccess(req: express.Request) {
  const decodedToken = await verifyFirebaseRequest(req);
  const adminDb = getFirebaseAdminDb();
  if (!adminDb) {
    throw createConfigurationError('Firebase Admin is not configured on the server.');
  }

  const userDocRef = adminDb.collection('users').doc(decodedToken.uid);
  const userSnapshot = await userDocRef.get();
  const userData = userSnapshot.data() as UserTrackingDocument | undefined;
  const resolvedBilling = resolveBillingAccess(userData, {
    fallbackProductPlanId: resolvePlanIdFromProductId(userData?.dodoProductId),
  });
  if (resolvedBilling.entitlementState === 'account_deleted') {
    throw createForbiddenError('This account is no longer available.');
  }

  return {
    decodedToken,
    adminDb,
    userDocRef,
    userData,
    resolvedBilling,
  };
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
    trackedApps: getTrackedAppIdentityKeysForPlanUsage({
      trackedApps: state.trackedApps,
      trackedKeywords: state.trackedKeywords,
    }),
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

function getGlobalRunDayKey(runKey: string) {
  const [dayKey] = runKey.split('T');
  return dayKey;
}

function getGlobalDayKeyForTimestamp(timestamp: string) {
  const parts = getZonedDateParts(new Date(timestamp), GLOBAL_TRACKING_TIMEZONE);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function getUnresolvedCompetitorAsoTargetCount(
  state: Pick<
    NormalizedUserTrackingDocument,
    'competitorGroups' | 'competitorTrackedKeywords' | 'competitorAsoLatestSnapshots'
  >,
  runKey: string,
) {
  if (!state.competitorGroups.length) {
    return 0;
  }

  const runDayKey = getGlobalRunDayKey(runKey);
  const latestByKey = new Map(
    state.competitorAsoLatestSnapshots.map((snapshot) => [
      getComparableCompetitorAsoSnapshotKey(snapshot),
      snapshot,
    ]),
  );

  let unresolvedTargets = 0;
  state.competitorGroups.forEach((group) => {
    const trackedCountries = getCompetitorTrackedCountriesForGroup(
      group,
      state.competitorTrackedKeywords,
    );
    trackedCountries.forEach((trackedCountry) => {
      group.competitors.forEach((app) => {
        const key = `${group.groupId}:${app.appId}:${trackedCountry}`;
        const latestSnapshot = latestByKey.get(key);
        if (!latestSnapshot || getGlobalDayKeyForTimestamp(latestSnapshot.capturedAt) !== runDayKey) {
          unresolvedTargets += 1;
        }
      });
    });
  });

  return unresolvedTargets;
}

function getTrackingRecoveryScope(
  state: NormalizedUserTrackingDocument,
  runKey: string,
) {
  const trackedKeywords = filterUnresolvedTrackedKeywords(
    state.trackedKeywords,
    runKey,
  ) as TrackedKeywordRecord[];
  const competitorTrackedKeywords = filterUnresolvedCompetitorTrackedKeywords(
    state.competitorTrackedKeywords,
    runKey,
  ) as CompetitorTrackedKeywordRecord[];

  return {
    scopedState: {
      ...state,
      trackedKeywords,
      competitorTrackedKeywords,
    },
    counts: {
      trackedKeywords: trackedKeywords.length,
      competitorTrackedApps: competitorTrackedKeywords.reduce(
        (sum, trackedKeyword) => sum + trackedKeyword.apps.length,
        0,
      ),
      competitorAsoTargets: getUnresolvedCompetitorAsoTargetCount(state, runKey),
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
    const targetAppIds =
      Array.isArray(rule.targetAppIds) && rule.targetAppIds.length > 0
        ? Array.from(new Set(rule.targetAppIds))
        : [rule.appId];
    const allowedBaselineKeys = new Set(
      rule.countries.flatMap((country) =>
        targetAppIds.map((appId) =>
          buildTrackedAlertCountryKey(rule, country, appId),
        ),
      ),
    );
    return {
      ...rule,
      createdAt: existing?.createdAt || rule.createdAt,
      updatedAt: rule.updatedAt || existing?.updatedAt,
      ...(existing?.baselineKeys
        ? {
            baselineKeys: existing.baselineKeys.filter((key) =>
              allowedBaselineKeys.has(key),
            ),
          }
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
    ...(current.lastTokenId ? { lastTokenId: current.lastTokenId } : {}),
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

function mergeEditableWeeklyReportSettings(
  current: WeeklyReportSettings,
  next: WeeklyReportSettings,
): WeeklyReportSettings {
  const normalizedNext = normalizeWeeklyReportSettings(
    next,
    current.timezone || GLOBAL_TRACKING_TIMEZONE,
  );
  return {
    enabled: normalizedNext.enabled,
    weekday: normalizedNext.weekday,
    timezone: normalizedNext.timezone,
    lastSentWeekKey: current.lastSentWeekKey,
    lastSentAt: current.lastSentAt,
    lastAttemptedAt: current.lastAttemptedAt,
    lastDeliveryStatus: current.lastDeliveryStatus,
    lastDeliveryError: current.lastDeliveryError,
  };
}

function mergeCompetitorGroupSnapshots(
  existing: CompetitorGroupSnapshotRecord[],
  incoming: CompetitorGroupSnapshotRecord[],
  activeGroupIds: Set<string>,
) {
  const bySnapshotId = new Map<string, CompetitorGroupSnapshotRecord>();
  [...existing, ...incoming]
    .filter((snapshot) => activeGroupIds.has(snapshot.groupId))
    .sort((a, b) => new Date(a.loadedAt).getTime() - new Date(b.loadedAt).getTime())
    .forEach((snapshot) => {
      bySnapshotId.set(snapshot.snapshotId, snapshot);
    });

  return Array.from(bySnapshotId.values()).sort(
    (a, b) => new Date(b.loadedAt).getTime() - new Date(a.loadedAt).getTime(),
  );
}

function mergeCompetitorAsoLatestSnapshots(
  existing: CompetitorAsoSnapshotRecord[],
  incoming: CompetitorAsoSnapshotRecord[],
  allowedTargetKeys: Set<string>,
) {
  const byTargetKey = new Map<string, CompetitorAsoSnapshotRecord>();
  [...existing, ...incoming]
    .filter((snapshot) =>
      allowedTargetKeys.has(
        `${snapshot.groupId}:${snapshot.appId}:${normalizeCountryCode(snapshot.country, 'us')}`,
      ),
    )
    .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())
    .forEach((snapshot) => {
      byTargetKey.set(
        `${snapshot.groupId}:${snapshot.appId}:${normalizeCountryCode(snapshot.country, 'us')}`,
        snapshot,
      );
    });

  return Array.from(byTargetKey.values()).sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime(),
  );
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
    competitorGroupSnapshots: mergeCompetitorGroupSnapshots(
      currentState.competitorGroupSnapshots,
      nextState.competitorGroupSnapshots,
      competitorGroupIds,
    ),
    competitorAsoLatestSnapshots: mergeCompetitorAsoLatestSnapshots(
      currentState.competitorAsoLatestSnapshots,
      nextState.competitorAsoLatestSnapshots,
      competitorGroupCountryKeys,
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
    weeklyReportSettings: mergeEditableWeeklyReportSettings(
      currentState.weeklyReportSettings,
      nextState.weeklyReportSettings,
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
    stateVersion: currentState.stateVersion,
    serverUpdatedAt: currentState.serverUpdatedAt,
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

function buildTrackedAlertCountryKey(
  rule: AlertRule,
  country: string,
  appId = rule.appId,
) {
  return `${rule.id}:${rule.groupId}:${appId}:${rule.store}:${rule.keyword.toLowerCase()}:${normalizeCountryCode(country, 'us')}`;
}

function buildAlertEventId(
  runKey: string,
  groupId: string,
  ruleId: string,
  keyword: string,
  store: string,
  country: string,
  eventType: AlertConditionType,
  threshold: number | null,
  appId = '',
) {
  return buildSharedAlertEventId({
    runKey,
    ruleId,
    groupId,
    appId,
    keyword,
    store,
    country,
    eventType,
    threshold,
  });
}

function createAlertRunKey(prefix: 'schedule' | 'manual' | 'test') {
  return `${prefix}:${new Date().toISOString()}:${Math.random().toString(36).slice(2, 8)}`
}

function getComparableTrackedKey({
  groupId,
  appId,
  keyword,
  store,
  country,
}: Pick<TrackedKeywordRecord, 'groupId' | 'appId' | 'keyword' | 'store' | 'country'>) {
  return `${String(groupId)}:${store}:${String(appId)}:${keyword.toLowerCase()}:${normalizeCountryCode(country, 'us')}`;
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

function canonicalizeAsoScreenshotUrl(input: unknown) {
  if (typeof input !== 'string') {
    return '';
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return '';
  }

  try {
    const url = new URL(trimmed);
    url.search = '';
    url.hash = '';
    let normalized = url.toString();

    if (
      url.hostname.includes('googleusercontent.com') ||
      url.hostname.includes('mzstatic.com')
    ) {
      normalized = normalized.replace(/=([a-z0-9_-]+(?:-[a-z0-9_-]+)*)$/i, '');
    }

    return normalized;
  } catch {
    return trimmed
      .replace(/[?#].*$/, '')
      .replace(/=([a-z0-9_-]+(?:-[a-z0-9_-]+)*)$/i, '');
  }
}

function normalizeAsoScreenshotList(input: unknown, iconUrl?: string) {
  if (!Array.isArray(input)) {
    return [];
  }
  const seen = new Set<string>();
  const normalizedIcon = canonicalizeAsoScreenshotUrl(iconUrl);
  return input.flatMap((entry) => {
    const normalized = canonicalizeAsoScreenshotUrl(entry);
    if (!normalized) {
      return [];
    }
    if (normalized === normalizedIcon || seen.has(normalized)) {
      return [];
    }
    seen.add(normalized);
    return [normalized];
  }).slice(0, 40);
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
      if (previousRank === -1 || previousRank === null) {
        return `"${keyword}" started ranking in ${region} at #${currentRank}.`;
      }
      return `"${keyword}" improved by ${Math.abs((previousRank ?? 0) - (currentRank ?? 0))} spots in ${region} to #${currentRank}.`;
    case 'drop_by':
      if (currentRank === -1 || currentRank === null) {
        return `"${keyword}" dropped out of range in ${region}${previousRank && previousRank !== -1 ? ` from #${previousRank}` : ''}.`;
      }
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
      return currentRanked &&
        (
          !previousRanked ||
          (previousRank ?? 0) - currentRank >= (condition.value ?? 0)
        );
    case 'drop_by':
      return previousRanked &&
        (
          !currentRanked ||
          currentRank - (previousRank ?? 0) >= (condition.value ?? 0)
        );
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
  const browserPushEvents: AlertEvent[] = [];
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
        const eventId = buildCompetitorAsoAlertEventId({
          runKey,
          ruleId: rule.id,
          groupId: diff.groupId,
          appId: diff.appId,
          keyword: diff.appTitle,
          store: diff.store,
          country: diff.country,
          eventType: condition.type,
          asoDiffId: diff.diffId,
        });
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
        if (rule.channels.inApp) {
          createdEvents.push(event);
        }
        if (rule.channels.push) {
          browserPushEvents.push(event);
        }
        if (rule.channels.email) {
          emailEvents.push(event);
        }
      }
    }
  }

  if (browserPushEvents.length) {
    await sendPushAlertEvents(userDocRef, notificationSettings, browserPushEvents);
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

async function resolveAccountAuthEmail(
  userDocRef: DocumentReference<DocumentData>,
) {
  const authClient = getFirebaseAdminAuthClient();
  if (!authClient) {
    throw new Error('firebase-admin-auth-not-configured');
  }

  const userRecord = await authClient.getUser(userDocRef.id);
  return userRecord.email?.trim().toLowerCase() || null;
}

async function resolveAlertEmailRecipient(
  userDocRef: DocumentReference<DocumentData>,
) {
  return resolveCategoryEmailRecipient(userDocRef, {
    category: 'alert',
    resolveAuthEmail: async () => resolveAccountAuthEmail(userDocRef),
  });
}

async function resolveWeeklyReportEmailRecipient(
  userDocRef: DocumentReference<DocumentData>,
) {
  return resolveCategoryEmailRecipient(userDocRef, {
    category: 'weekly',
    resolveAuthEmail: async () => resolveAccountAuthEmail(userDocRef),
  });
}

async function sendEmailAlertEvents(
  userDocRef: DocumentReference<DocumentData>,
  events: AlertEvent[],
) {
  const recipientResolution = await resolveAlertEmailRecipient(userDocRef);
  await sendSharedAlertEmailEvents(userDocRef, events, {
    resend,
    fromEmail: RESEND_FROM_EMAIL,
    dashboardUrl: ALERT_EMAIL_APP_URL,
    preferencesUrl: recipientResolution.status === 'ready' && recipientResolution.email
      ? getEmailPreferenceUrl({
          kind: 'alert',
          userId: userDocRef.id,
          email: recipientResolution.email,
        })
      : ALERT_EMAIL_APP_URL,
    resolveRecipient: async () => recipientResolution,
  });
}

function buildWeeklyReportSummaryFromState(
  state: Pick<
    NormalizedUserTrackingDocument,
    | 'trackedKeywords'
    | 'rankHistory'
    | 'competitorGroups'
    | 'competitorTrackedKeywords'
    | 'competitorRankHistory'
  >,
  timeZone: string,
) {
  return buildWeeklyReportEmailSummary({
    trackedKeywords: state.trackedKeywords.map((entry) => ({
      keyword: entry.keyword,
      appId: entry.appId,
      appTitle: entry.appTitle,
      store: entry.store,
      country: entry.country,
      lastRank: entry.lastRank,
      lastCheckStatus: entry.lastCheckStatus,
      lastChecked: entry.lastChecked,
    })),
    rankHistory: state.rankHistory.map((entry) => ({
      appId: entry.appId,
      keyword: entry.keyword,
      store: entry.store,
      country: entry.country,
      rank: entry.rank,
      timestamp: entry.timestamp,
      rankDepth: entry.rankDepth,
    })),
    competitorGroups: state.competitorGroups.map((group) => ({
      groupId: group.groupId,
      ownApp: { title: group.ownApp.title },
      competitors: group.competitors.map((app) => ({ title: app.title })),
    })),
    competitorTrackedKeywords: state.competitorTrackedKeywords.map((entry) => ({
      trackedKeywordId: entry.trackedKeywordId,
      groupId: entry.groupId,
      keyword: entry.keyword,
      store: entry.store,
      country: entry.country,
      apps: entry.apps.map((app) => ({
        appKey: app.appKey,
        title: app.title,
        lastRank: app.lastRank,
        lastCheckStatus: app.lastCheckStatus,
      })),
    })),
    competitorRankHistory: state.competitorRankHistory.map((entry) => ({
      trackedKeywordId: entry.trackedKeywordId,
      appKey: entry.appKey,
      rank: entry.rank,
      timestamp: entry.timestamp,
      rankDepth: entry.rankDepth,
    })),
    timeZone,
  });
}

async function hydrateWeeklyReportStateWithArchive(
  userDocRef: DocumentReference<DocumentData>,
  state: Pick<
    NormalizedUserTrackingDocument,
    | 'trackedKeywords'
    | 'rankHistory'
    | 'competitorGroups'
    | 'competitorTrackedKeywords'
    | 'competitorRankHistory'
  >,
  date: Date,
  timeZone: string,
) {
  const rangeStartIso = getWeeklyReportRangeStartIso(date, timeZone);
  const [archivedRankHistorySnapshot, archivedCompetitorRankHistorySnapshot] =
    await Promise.all([
      userDocRef
        .collection(USER_RANK_HISTORY_ARCHIVE_COLLECTION)
        .where('timestamp', '>=', rangeStartIso)
        .get(),
      userDocRef
        .collection(USER_COMPETITOR_RANK_HISTORY_ARCHIVE_COLLECTION)
        .where('timestamp', '>=', rangeStartIso)
        .get(),
    ]);

  const archivedRankHistory = sanitizeRankHistory(
    archivedRankHistorySnapshot.docs.map((doc) => doc.data()),
  );
  const archivedCompetitorRankHistory = sanitizeCompetitorRankHistory(
    archivedCompetitorRankHistorySnapshot.docs.map((doc) => doc.data()),
  );

  return {
    ...state,
    rankHistory: mergeRankHistory(state.rankHistory, archivedRankHistory),
    competitorRankHistory: mergeCompetitorRankHistory(
      state.competitorRankHistory,
      archivedCompetitorRankHistory,
    ),
  };
}

async function maybeSendWeeklyReportEmail(
  userDocRef: DocumentReference<DocumentData>,
  state: Pick<
    NormalizedUserTrackingDocument,
    | 'trackedKeywords'
    | 'rankHistory'
    | 'competitorGroups'
    | 'competitorTrackedKeywords'
    | 'competitorRankHistory'
    | 'weeklyReportSettings'
  >,
  date: Date,
) {
  const settings = state.weeklyReportSettings;
  if (!settings.enabled) {
    return null;
  }
  const hasTrackedData =
    state.trackedKeywords.length > 0 ||
    state.competitorTrackedKeywords.length > 0 ||
    state.competitorGroups.length > 0;
  if (!hasTrackedData) {
    return null;
  }

  const eligibility = shouldSendWeeklyReportForDate(settings, date);
  if (!eligibility.matchesWeekday || eligibility.alreadySent) {
    return null;
  }
  const deliveryClaim = await claimWeeklyReportDelivery(userDocRef, {
    deliveryKey: eligibility.deliveryKey,
    claimOwner: `server:${process.pid}`,
    now: date,
  });
  if (!deliveryClaim.acquired) {
    return null;
  }
  const attemptedAt = new Date().toISOString();
  const buildDeliveryUpdate = (
    status: 'accepted' | 'failed' | 'skipped',
    error?: string,
    sentAt?: string,
  ): WeeklyReportSettings => {
    const update: WeeklyReportSettings = {
      ...settings,
      lastAttemptedAt: sentAt || attemptedAt,
      lastDeliveryStatus: status,
    };
    if (sentAt) {
      update.lastSentWeekKey = eligibility.deliveryKey;
      update.lastSentAt = sentAt;
    }
    if (error) {
      update.lastDeliveryError = error;
    } else {
      delete update.lastDeliveryError;
    }
    return update;
  };
  if (!resend) {
    console.info('[email] Skipping weekly report email because Resend is not configured.');
    await finalizeWeeklyReportDelivery(deliveryClaim.ref, {
      status: 'failed',
      now: new Date(),
      error: 'resend-not-configured',
    });
    return buildDeliveryUpdate('failed', 'resend-not-configured');
  }

  const sender = getConfiguredResendSender();
  if (!sender) {
    console.info('[email] Skipping weekly report email because sender email is not configured.');
    await finalizeWeeklyReportDelivery(deliveryClaim.ref, {
      status: 'failed',
      now: new Date(),
      error: 'sender-not-configured',
    });
    return buildDeliveryUpdate('failed', 'sender-not-configured');
  }

  const recipientResolution = await resolveWeeklyReportEmailRecipient(userDocRef);
  if (recipientResolution.status !== 'ready' || !recipientResolution.email) {
    console.info(`[email] Skipping weekly report email for user ${userDocRef.id} because ${recipientResolution.reason}.`);
    const isSkipped =
      recipientResolution.status === 'opted_out' ||
      recipientResolution.status === 'account_deleted';
    await finalizeWeeklyReportDelivery(deliveryClaim.ref, {
      status: isSkipped ? 'skipped' : 'failed',
      now: new Date(),
      error: recipientResolution.reason,
    });
    return buildDeliveryUpdate(isSkipped ? 'skipped' : 'failed', recipientResolution.reason);
  }
  const recipient = recipientResolution.email;

  const hydratedState = await hydrateWeeklyReportStateWithArchive(
    userDocRef,
    state,
    date,
    settings.timezone,
  );
  const summary = buildWeeklyReportSummaryFromState(
    hydratedState,
    settings.timezone,
  );
  const reportMode =
    summary.competitorGroupCount > 0 && summary.trackedKeywordCount === 0
      ? 'competitors'
      : 'my';
  const reportUrl = buildWeeklyReportWorkspaceUrl(ALERT_EMAIL_APP_URL, reportMode);

  try {
    const result = await resend.emails.send({
      from: `Rank Analyzer Pro <${sender}>`,
      to: recipient,
      subject: `Your weekly ASO report - ${summary.rangeLabel}`,
      text: buildWeeklyReportEmailText({
        summary,
        reportUrl,
        weekday: settings.weekday,
        preferencesUrl: getEmailPreferenceUrl({
          kind: 'weekly',
          userId: userDocRef.id,
          email: recipient,
        }),
      }),
      html: buildWeeklyReportEmailHtml({
        summary,
        reportUrl,
        weekday: settings.weekday,
        preferencesUrl: getEmailPreferenceUrl({
          kind: 'weekly',
          userId: userDocRef.id,
          email: recipient,
        }),
      }),
    });
    if (result.error) {
      console.warn(`[email] Failed to deliver weekly report email for user ${userDocRef.id}`, result.error);
      await finalizeWeeklyReportDelivery(deliveryClaim.ref, {
        status: 'failed',
        now: new Date(),
        error:
          typeof result.error.message === 'string' && result.error.message.trim()
            ? result.error.message.trim()
            : 'provider-error',
      });
      return buildDeliveryUpdate(
        'failed',
        typeof result.error.message === 'string' && result.error.message.trim()
          ? result.error.message.trim()
          : 'provider-error',
      );
    }
    if (!getResendEmailId(result)) {
      console.warn(`[email] Weekly report email for user ${userDocRef.id} returned no message id.`);
    }

    const sentAt = new Date().toISOString();
    const providerMessageId = getResendEmailId(result);
    await finalizeWeeklyReportDelivery(deliveryClaim.ref, {
      status: 'accepted',
      now: new Date(sentAt),
      providerMessageId,
    });
    console.info(`[email] Accepted weekly report email for ${recipient}.`);
    return buildDeliveryUpdate('accepted', undefined, sentAt);
  } catch (error) {
    console.warn(`[email] Failed to deliver weekly report email for user ${userDocRef.id}`, error);
    await finalizeWeeklyReportDelivery(deliveryClaim.ref, {
      status: 'failed',
      now: new Date(),
      error:
        error instanceof Error && error.message.trim()
          ? error.message.trim().slice(0, 500)
          : 'unknown-delivery-failure',
    });
    return buildDeliveryUpdate(
      'failed',
      error instanceof Error && error.message.trim()
        ? error.message.trim().slice(0, 500)
        : 'unknown-delivery-failure',
    );
  }
}

function buildCronFailureEmailHtml(input: {
  runKey: string;
  trigger: 'automatic' | 'manual' | 'watchdog' | 'recovery';
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

function buildCronFailureEmailText(input: {
  runKey: string;
  trigger: 'automatic' | 'manual' | 'watchdog' | 'recovery';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  errorMessage: string;
}) {
  return [
    `Cron job failed: ${input.runKey}`,
    '',
    'The daily tracking cron job failed before completing.',
    `Trigger: ${input.trigger}`,
    `Started: ${formatAlertEmailTimestamp(input.startedAt)}`,
    `Finished: ${formatAlertEmailTimestamp(input.finishedAt)}`,
    `Duration: ${Math.max(0, Math.round(input.durationMs / 1000))}s`,
    `Error: ${input.errorMessage}`,
    '',
    `Open workspace: ${ALERT_EMAIL_APP_URL}`,
  ].join('\n');
}

function buildTestEmailHtml(input: {
  requestedBy: string;
  message: string;
  sentAt: string;
}) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #0f172a;">
      <h2 style="margin: 0 0 12px; font-size: 22px;">Test email delivered</h2>
      <p style="margin: 0 0 18px; color: #334155;">${escapeAlertEmailHtml(input.message)}</p>
      <div style="border: 1px solid #cbd5e1; border-radius: 12px; background: #f8fafc; padding: 18px;">
        <p style="margin: 0 0 8px;"><strong>Environment:</strong> ${escapeAlertEmailHtml(process.env.NODE_ENV || 'development')}</p>
        <p style="margin: 0 0 8px;"><strong>Requested by:</strong> ${escapeAlertEmailHtml(input.requestedBy)}</p>
        <p style="margin: 0;"><strong>Sent:</strong> ${escapeAlertEmailHtml(formatAlertEmailTimestamp(input.sentAt))}</p>
      </div>
      <a href="${escapeAlertEmailHtml(ALERT_EMAIL_APP_URL)}" style="display: inline-block; margin-top: 20px; padding: 12px 20px; border-radius: 10px; background: #06b6d4; color: #082f49; text-decoration: none; font-weight: 700;">
        Open Workspace
      </a>
    </div>
  `;
}

function buildTestEmailText(input: {
  requestedBy: string;
  message: string;
  sentAt: string;
}) {
  return [
    'Test email delivered',
    '',
    input.message,
    `Environment: ${process.env.NODE_ENV || 'development'}`,
    `Requested by: ${input.requestedBy}`,
    `Sent: ${formatAlertEmailTimestamp(input.sentAt)}`,
    '',
    `Open workspace: ${ALERT_EMAIL_APP_URL}`,
  ].join('\n');
}

function getAnnouncementEmailCampaignsCollection(adminDb: Firestore) {
  return adminDb.collection(ANNOUNCEMENT_EMAIL_CAMPAIGNS_COLLECTION);
}

function buildAnnouncementEmailHtml(
  campaign: AnnouncementEmailCampaignDocument,
  unsubscribeUrl: string,
) {
  const bodyHtml = escapeAlertEmailHtml(campaign.message).replace(/\r?\n/g, '<br />');
  const hasButton = Boolean(campaign.buttonLabel && campaign.buttonUrl);

  return `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #0f172a;">
      <h2 style="margin: 0 0 12px; font-size: 22px;">${escapeAlertEmailHtml(campaign.subject)}</h2>
      <div style="margin: 0 0 18px; color: #334155; font-size: 15px; line-height: 1.7;">${bodyHtml}</div>
      ${hasButton
        ? `<a href="${escapeAlertEmailHtml(campaign.buttonUrl as string)}" style="display: inline-block; margin-top: 4px; padding: 12px 20px; border-radius: 10px; background: #06b6d4; color: #082f49; text-decoration: none; font-weight: 700;">${escapeAlertEmailHtml(campaign.buttonLabel as string)}</a>`
        : ''}
      <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 13px; line-height: 1.6;">
        <p style="margin: 0 0 8px;">You are receiving this announcement because your account has product email updates enabled.</p>
        <p style="margin: 0;"><a href="${escapeAlertEmailHtml(unsubscribeUrl)}" style="color: #0f766e; text-decoration: underline;">Unsubscribe from announcement emails</a></p>
      </div>
    </div>
  `;
}

function buildAnnouncementEmailText(
  campaign: AnnouncementEmailCampaignDocument,
  unsubscribeUrl: string,
) {
  const lines = [
    campaign.subject,
    '',
    campaign.message.trim(),
  ];

  if (campaign.buttonLabel && campaign.buttonUrl) {
    lines.push('', `${campaign.buttonLabel}: ${campaign.buttonUrl}`);
  }

  lines.push(
    '',
    'You are receiving this announcement because your account has product email updates enabled.',
    `Unsubscribe from announcement emails: ${unsubscribeUrl}`,
  );

  return lines.join('\n');
}

function getEmailPreferenceUrl(input: {
  kind: EmailPreferenceKind;
  userId: string;
  email: string;
  campaignId?: string;
}) {
  const preferencesUrl = new URL('/api/email/preferences', ALERT_EMAIL_APP_URL);
  preferencesUrl.searchParams.set('kind', input.kind);
  preferencesUrl.searchParams.set('uid', input.userId);
  preferencesUrl.searchParams.set('email', input.email);
  if (input.campaignId) {
    preferencesUrl.searchParams.set('campaignId', input.campaignId);
  }
  preferencesUrl.searchParams.set('token', buildEmailPreferenceToken(input.kind, input.userId, input.email));
  return preferencesUrl.toString();
}

async function resolveAnnouncementRecipientEmail(
  authClient: FirebaseAdminAuth,
  userDocRef: DocumentReference<DocumentData>,
  userData: UserTrackingDocument | undefined,
) {
  const billingEmail = normalizeEmailAddress(userData?.billingEmail);
  if (billingEmail && isValidEmailAddress(billingEmail)) {
    return billingEmail;
  }

  try {
    const userRecord = await authClient.getUser(userDocRef.id);
    const authEmail = normalizeEmailAddress(userRecord.email);
    return authEmail && isValidEmailAddress(authEmail) ? authEmail : null;
  } catch (error) {
    console.warn(`[email] Failed to resolve announcement recipient for user ${userDocRef.id}`, error);
    return null;
  }
}

async function loadAnnouncementCampaignRecipients(
  adminDb: Firestore,
  audience: AnnouncementAudience,
) {
  const authClient = getFirebaseAdminAuthClient();
  if (!authClient) {
    throw createConfigurationError('Firebase Admin auth is not configured on the server.');
  }

  const snapshot = await adminDb.collection('users').get();
  const recipients = await mapWithConcurrency(snapshot.docs, 10, async (userDoc) => {
    const userData = userDoc.data() as UserTrackingDocument | undefined;
    if (
      userData?.accountStatus === 'deleted' ||
      userData?.accountStatus === 'deleting' ||
      userData?.announcementEmailsEnabled === false
    ) {
      return null;
    }

    const isPaid = hasActiveBillingEntitlement(userData);
    if (audience === 'paid' && !isPaid) {
      return null;
    }
    if (audience === 'free' && isPaid) {
      return null;
    }

    const email = await resolveAnnouncementRecipientEmail(authClient, userDoc.ref, userData);
    if (!email) {
      return null;
    }

    return {
      userDocRef: userDoc.ref,
      email,
    };
  });

  const validRecipients = recipients.filter(
    (
      entry,
    ): entry is {
      userDocRef: DocumentReference<DocumentData>;
      email: string;
    } => Boolean(entry),
  );
  const recipientsByEmail = new Map<string, {
    userDocRef: DocumentReference<DocumentData>;
    email: string;
  }>();
  for (const recipient of validRecipients) {
    if (!recipientsByEmail.has(recipient.email)) {
      recipientsByEmail.set(recipient.email, recipient);
    }
  }
  return Array.from(recipientsByEmail.values());
}

async function sendAnnouncementCampaign(
  adminDb: Firestore,
  campaignDocRef: DocumentReference<DocumentData>,
) {
  if (!resend) {
    throw createConfigurationError('Resend is not configured on the server.');
  }
  const sender = getConfiguredResendSender();
  if (!sender) {
    throw createConfigurationError('RESEND_FROM_EMAIL is not configured as a valid email address.');
  }
  if (!EMAIL_UNSUBSCRIBE_SECRET) {
    throw createConfigurationError('EMAIL_UNSUBSCRIBE_SECRET is not configured on the server.');
  }

  const sendingAt = new Date().toISOString();
  const claimedCampaign = await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(campaignDocRef);
    if (!snapshot.exists) {
      throw createBadRequestError('Announcement campaign was not found.');
    }
    const latestCampaign = snapshot.data() as AnnouncementEmailCampaignDocument;
    if (latestCampaign.status === 'sending') {
      const sendingStartedAtMs =
        typeof latestCampaign.sendingStartedAt === 'string'
          ? Date.parse(latestCampaign.sendingStartedAt)
          : Number.NaN;
      if (
        !Number.isFinite(sendingStartedAtMs) ||
        sendingStartedAtMs > Date.now() - ANNOUNCEMENT_SEND_STALE_AFTER_MS
      ) {
        throw createBadRequestError('Announcement campaign is already sending.');
      }
    }
    if (latestCampaign.status === 'sent') {
      throw createBadRequestError('Announcement campaign has already been sent.');
    }

    transaction.set(campaignDocRef, {
      status: 'sending',
      sendingStartedAt: sendingAt,
      updatedAt: sendingAt,
      lastError: FieldValue.delete(),
    } satisfies DocumentData, { merge: true });

    return latestCampaign;
  });

  try {
    const recipients = await loadAnnouncementCampaignRecipients(adminDb, claimedCampaign.audience);
    let deliveredCount = 0;
    let failedCount = 0;
    const failureMessages: string[] = [];

    await mapWithConcurrency(recipients, 5, async (recipient) => {
      try {
        const result = await resend.emails.send({
          from: `Rank Analyzer Pro <${sender}>`,
          to: recipient.email,
          subject: claimedCampaign.subject,
          text: buildAnnouncementEmailText(
            claimedCampaign,
            getEmailPreferenceUrl({
              kind: 'announcement',
              campaignId: claimedCampaign.campaignId,
              userId: recipient.userDocRef.id,
              email: recipient.email,
            }),
          ),
          html: buildAnnouncementEmailHtml(
            claimedCampaign,
            getEmailPreferenceUrl({
              kind: 'announcement',
              campaignId: claimedCampaign.campaignId,
              userId: recipient.userDocRef.id,
              email: recipient.email,
            }),
          ),
        });
        if (result.error) {
          throw new Error(result.error.message || 'Resend rejected the message.');
        }
        if (!getResendEmailId(result)) {
          console.warn(`[email] Announcement email for campaign ${claimedCampaign.campaignId} to ${recipient.email} returned no message id.`);
        }

        deliveredCount += 1;
        await recipient.userDocRef.set({
          lastAnnouncementEmailSentAt: sendingAt,
          lastAnnouncementEmailCampaignId: claimedCampaign.campaignId,
          updatedAt: new Date().toISOString(),
        } satisfies Partial<UserTrackingDocument>, { merge: true });
      } catch (error) {
        failedCount += 1;
        if (failureMessages.length < 10) {
          failureMessages.push(
            `${recipient.email}: ${error instanceof Error ? error.message : 'Unknown delivery failure.'}`,
          );
        }
      }
    });

    const completedAt = new Date().toISOString();
    const nextStatus: AnnouncementCampaignStatus =
      failedCount > 0 && deliveredCount === 0 ? 'failed' : 'sent';
    const completionPayload: DocumentData = {
      status: nextStatus,
      sentAt: completedAt,
      sendingStartedAt: FieldValue.delete(),
      recipientCount: recipients.length,
      deliveredCount,
      failedCount,
      updatedAt: completedAt,
      ...(failureMessages.length
        ? { lastError: failureMessages.join(' | ').slice(0, 1800) }
        : { lastError: FieldValue.delete() }),
    };
    await campaignDocRef.set(completionPayload, { merge: true });

    return {
      campaignId: claimedCampaign.campaignId,
      status: nextStatus,
      recipientCount: recipients.length,
      deliveredCount,
      failedCount,
      sentAt: completedAt,
    };
  } catch (error) {
    const failedAt = new Date().toISOString();
    await campaignDocRef.set({
      status: 'failed',
      sendingStartedAt: FieldValue.delete(),
      updatedAt: failedAt,
      lastError: error instanceof Error && error.message.trim()
        ? error.message.trim().slice(0, 1800)
        : 'Announcement campaign failed before completion.',
    } satisfies DocumentData, { merge: true });
    throw error;
  }
}

async function sendCronFailureEmail(input: {
  runKey: string;
  trigger: 'automatic' | 'manual' | 'watchdog' | 'recovery';
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  errorMessage: string;
}) {
  if (!resend) {
    console.info('[email] Skipping cron failure email because Resend is not configured.');
    return;
  }
  const sender = getConfiguredResendSender();
  if (!sender) {
    console.info('[email] Skipping cron failure email because sender email is not configured.');
    return;
  }
  if (!CRON_FAILURE_EMAIL_RECIPIENTS.length) {
    console.info('[email] Skipping cron failure email because CRON_FAILURE_EMAIL is not configured.');
    return;
  }

  try {
    const result = await resend.emails.send({
      from: `Rank Analyzer Pro <${sender}>`,
      to: CRON_FAILURE_EMAIL_RECIPIENTS,
      subject: `Cron job failed: ${input.runKey}`,
      text: buildCronFailureEmailText(input),
      html: buildCronFailureEmailHtml(input),
    });
    if (result.error) {
      console.warn('[email] Failed to deliver cron failure email.', result.error);
      return;
    }
    if (!getResendEmailId(result)) {
      console.warn(`[email] Cron failure email for ${input.runKey} returned no message id.`);
    }
    console.info(`[email] Accepted cron failure email for ${input.runKey}.`);
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
  const browserPushEvents: AlertEvent[] = [];
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

    const targetAppIds =
      Array.isArray(rule.targetAppIds) && rule.targetAppIds.length > 0
        ? Array.from(new Set(rule.targetAppIds))
        : [rule.appId];
    for (const country of rule.countries) {
      for (const targetAppId of targetAppIds) {
        const trackedKey = getComparableTrackedKey({
          groupId: rule.groupId,
          appId: targetAppId,
          keyword: rule.keyword,
          store: rule.store,
          country,
        });
        const previous = previousByKey.get(trackedKey);
        const next = nextByKey.get(trackedKey);
        if (!next) {
          continue;
        }

        const baselineKey = buildTrackedAlertCountryKey(
          rule,
          country,
          targetAppId,
        );
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
            rule.groupId,
            rule.id,
            rule.keyword,
            rule.store,
            country,
            condition.type,
            condition.value ?? null,
            targetAppId,
          );
          const event: AlertEvent = {
            id: eventId,
            ruleId: rule.id,
            groupId: rule.groupId,
            appId: targetAppId,
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
          if (rule.channels.inApp) {
            createdEvents.push(event);
          }
          if (rule.channels.push) {
            browserPushEvents.push(event);
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
  }

  if (browserPushEvents.length) {
    await sendPushAlertEvents(userDocRef, notificationSettings, browserPushEvents);
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
      getKeywordRank: (
        keyword,
        appId,
        storeType,
        country,
        refresh,
        depth,
      ) =>
        getKeywordRank(
          keyword,
          appId,
          storeType,
          country,
          refresh,
          depth,
          getUpstreamDeadline(),
          {
            proxyFallbackOnNotRanked: true,
            proxyFirst: true,
          },
        ),
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

function isGlobalTrackingWatchdogWindowOpen(date: Date) {
  return isSharedGlobalTrackingWatchdogWindowOpen(
    date,
    GLOBAL_TRACKING_WATCHDOG_DELAY_MINUTES,
    DEFAULT_TRACKING_SCHEDULE.time,
    GLOBAL_TRACKING_TIMEZONE,
  );
}

function getGlobalTrackingWatchdogDueAtIso(date: Date) {
  return getSharedGlobalTrackingWatchdogDueAtIso(
    date,
    GLOBAL_TRACKING_WATCHDOG_DELAY_MINUTES,
    DEFAULT_TRACKING_SCHEDULE.time,
    GLOBAL_TRACKING_TIMEZONE,
  );
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
    trigger?: 'automatic' | 'manual' | 'watchdog' | 'recovery';
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

async function fetchPlayStoreHtml(
  path: string,
  country: string,
  retries = 2,
  timeoutMs = PLAY_STORE_FETCH_TIMEOUT_MS,
  options?: {
    useProxy?: boolean;
  },
) {
  const gl = country.toUpperCase();
  const url = new URL(`https://play.google.com${path}`);
  if (!url.searchParams.has('hl')) url.searchParams.set('hl', 'en_US');
  if (!url.searchParams.has('gl')) url.searchParams.set('gl', gl);

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        ...buildPlayStoreFetchInit({
          timeoutMs,
          useProxy: options?.useProxy === true,
          dispatcher: playStoreFetchDispatcher,
        }),
      } as RequestInit & { dispatcher?: UndiciDispatcher });

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
  const descriptionMatch =
    html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)
    || html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"/i);
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

async function getGooglePlayRankWeb(
  keyword: string,
  appId: string,
  country: string,
  depth: number,
  useProxy = false,
) {
  const { html } = await fetchPlayStoreHtml(
    `/store/search?c=apps&q=${encodeURIComponent(keyword)}`,
    country,
    1,
    RANKING_FETCH_TIMEOUT_MS,
    { useProxy },
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
  options?: {
    proxyFallbackOnNotRanked?: boolean;
    proxyFirst?: boolean;
  },
) {
  const logGooglePlayRankAttempt = ({
    keyword,
    country,
    contextLabel,
    transport,
    method,
    rank,
  }: GooglePlayRankLogEvent) => {
    console.info(
      `[${contextLabel}] Google Play rank keyword="${keyword}" country="${country}" transport=${transport} method=${method} rank=${rank}`,
    );
  };

  return await resolveGooglePlayRankWithFallback({
    keyword,
    country,
    contextLabel,
    proxyAvailable: Boolean(googlePlayProxyRequestOptions.agent),
    proxyFallbackOnNotRanked: options?.proxyFallbackOnNotRanked,
    proxyFirst: options?.proxyFirst,
    directWebLookup: () =>
      getGooglePlayRankWeb(keyword, appId, country, depth, false),
    proxyScraperLookup: googlePlayProxyRequestOptions.agent
      ? () =>
          getGooglePlayRankViaSearch(
            keyword,
            appId,
            country,
            depth,
            googlePlayProxyRequestOptions,
            deadlineAt,
            failureMessage,
          )
      : undefined,
    log: logGooglePlayRankAttempt,
  });
}

async function searchAppleAppStore(
  keyword: string,
  country: string,
  depth: number,
  requestOptions: StoreRequestOptions,
  deadlineAt: number,
  failureMessage: string,
) {
  return await runWithDeadline<any[]>(
    () => store.search({
      term: keyword,
      num: depth,
      country,
      requestOptions,
    }),
    deadlineAt,
    failureMessage,
  );
}

function logAppleDiscoveryVerification(input: {
  keyword: string;
  targetAppId: string;
  normalizedTargetIds: Set<string>;
  results: any[];
  matchedIndex: number;
  contextLabel: 'discovery' | 'ranking';
}) {
  const preview = input.results.slice(0, 5).map((app, index) => ({
    index: index + 1,
    title: String(app?.title || app?.trackName || app?.name || ''),
    ids: Array.from(getNormalizedAppleResultIds(app)).slice(0, 6),
  }));
  console.log(
    `[${input.contextLabel}] iOS rank verify keyword="${input.keyword}" target="${input.targetAppId}" normalizedTargetIds=${Array.from(input.normalizedTargetIds).join(',') || 'none'} results=${input.results.length} matchedIndex=${input.matchedIndex} preview=${JSON.stringify(preview)}`,
  );
}

async function getAppleAppStoreRankWithFallback(
  keyword: string,
  appId: string,
  country: string,
  depth: number,
  deadlineAt: number,
  failureMessage: string,
  contextLabel: 'discovery' | 'ranking',
  options?: {
    proxyFallbackOnNotRanked?: boolean;
    proxyFirst?: boolean;
  },
) {
  const normalizedTargetIds = getNormalizedAppleTargetIds(appId).identifiers;
  const canUseProxy = Boolean(appStoreProxyRequestOptions.proxy);
  const runSearch = async (requestOptions: StoreRequestOptions) => {
    const results = await searchAppleAppStore(
      keyword,
      country,
      depth,
      requestOptions,
      deadlineAt,
      failureMessage,
    );
    const matchedIndex = findAppleSearchResultIndex(results, appId);
    logAppleDiscoveryVerification({
      keyword,
      targetAppId: appId,
      normalizedTargetIds,
      results,
      matchedIndex,
      contextLabel,
    });
    return {
      rank: matchedIndex === -1 ? -1 : matchedIndex + 1,
      results,
    };
  };

  if (options?.proxyFirst === true && canUseProxy) {
    try {
      const proxyResult = await runSearch(appStoreProxyRequestOptions);
      if (proxyResult.rank !== -1) {
        return proxyResult.rank;
      }
    } catch (error) {
      console.warn(`[${contextLabel}] Proxy-first iOS rank lookup failed for "${keyword}", retrying direct search.`, error);
    }

    const directResult = await runSearch(appStoreDirectRequestOptions);
    return directResult.rank;
  }

  try {
    const directResult = await runSearch(appStoreDirectRequestOptions);
    if (
      directResult.rank !== -1 ||
      options?.proxyFallbackOnNotRanked !== true ||
      !canUseProxy
    ) {
      return directResult.rank;
    }

    console.warn(`[${contextLabel}] Direct iOS rank lookup returned not ranked for "${keyword}", retrying via proxy.`);
    const proxyResult = await runSearch(appStoreProxyRequestOptions);
    return proxyResult.rank;
  } catch (error) {
    if (!canUseProxy) {
      throw error;
    }

    console.warn(`[${contextLabel}] Direct iOS rank lookup failed for "${keyword}", retrying via proxy.`, error);
    const proxyResult = await runSearch(appStoreProxyRequestOptions);
    return proxyResult.rank;
  }
}

function shouldUseDiscoveryProxyVerification(
  candidate: DiscoveryMetricCandidate,
  candidateIndex: number,
  profile: DiscoveryProfile,
) {
  if (candidateIndex >= profile.proxyVerificationLimit) {
    return false;
  }

  const { baseline, displayQuality, features } = candidate;
  const relevance = Number(baseline.relevance || 0);
  const confidence = Number(baseline.confidence || 0);
  return (
    relevance >= 55 ||
    confidence >= 55 ||
    displayQuality >= 50 ||
    features.exactTitleMatch > 0 ||
    features.exactTitleSegment > 0 ||
    features.orderedTitleCoverage >= 2
  );
}

function shouldExtendDiscoveryDepth(
  candidate: DiscoveryMetricCandidate,
  candidateIndex: number,
  profile: DiscoveryProfile,
) {
  if (
    profile.searchDepth <= profile.initialSearchDepth ||
    candidateIndex >= profile.extendedDepthCandidateLimit
  ) {
    return false;
  }

  const { baseline, displayQuality, features } = candidate;
  const relevance = Number(baseline.relevance || 0);
  const confidence = Number(baseline.confidence || 0);
  return (
    relevance >= 58 ||
    confidence >= 58 ||
    displayQuality >= 55 ||
    features.exactTitleMatch > 0 ||
    features.exactTitleSegment > 0
  );
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function getDiscoveryKeywordTokenCount(keyword: string) {
  return keyword
    .trim()
    .split(/\s+/)
    .filter(Boolean).length || 1;
}

function getDiscoverySpecificityBonus(keyword: string) {
  const tokenCount = getDiscoveryKeywordTokenCount(keyword);
  if (tokenCount === 1) return 0.12;
  if (tokenCount === 2) return 0.32;
  if (tokenCount === 3) return 0.52;
  if (tokenCount <= 5) return 0.64;
  if (tokenCount <= 8) return 0.24;
  return 0;
}

function getDiscoverySingleWordGroundingBonus(input: {
  keyword: string;
  exactTitleMatch: number;
  exactTitleSegment: number;
  orderedTitleCoverage: number;
  semanticCoverage: number;
  categorySemanticCoverage: number;
}) {
  if (getDiscoveryKeywordTokenCount(input.keyword) !== 1) {
    return 0;
  }

  const titleStrength = Math.max(
    input.exactTitleMatch || 0,
    input.exactTitleSegment || 0,
    input.orderedTitleCoverage || 0,
  );
  const semanticStrength = Math.max(
    input.semanticCoverage || 0,
    input.categorySemanticCoverage || 0,
  );

  if (titleStrength >= 1 || semanticStrength >= 0.85) return 0.3;
  if (titleStrength >= 0.8 || semanticStrength >= 0.7) return 0.18;
  if (titleStrength >= 0.6 || semanticStrength >= 0.55) return 0.08;
  return 0;
}

function isDiscoveryGenericHeadLike(input: {
  keyword: string;
  displayQuality: number;
  genericCoverage: number;
  exactTitleMatch: number;
  exactTitleSegment: number;
  orderedTitleCoverage: number;
  semanticCoverage: number;
  categorySemanticCoverage: number;
  descriptionCoverage?: number;
  sourceStrength?: number;
}) {
  const tokenCount = getDiscoveryKeywordTokenCount(input.keyword);
  if (tokenCount > 2) {
    return false;
  }

  if (tokenCount === 1) {
    const titleStrength = Math.max(
      input.exactTitleMatch || 0,
      input.exactTitleSegment || 0,
      input.orderedTitleCoverage || 0,
    );
    const semanticStrength = Math.max(
      input.semanticCoverage || 0,
      input.categorySemanticCoverage || 0,
    );
    if (titleStrength >= 0.8 || semanticStrength >= 0.65) {
      return false;
    }
  }

  const contextualStrength = Math.max(
    input.exactTitleMatch || 0,
    input.exactTitleSegment || 0,
    input.orderedTitleCoverage || 0,
    input.semanticCoverage || 0,
    input.descriptionCoverage || 0,
    input.sourceStrength || 0,
  );

  return (
    input.genericCoverage >= 0.65 &&
    input.exactTitleMatch <= 0 &&
    input.exactTitleSegment <= 0 &&
    input.orderedTitleCoverage < 0.75 &&
    contextualStrength < 0.58 &&
    input.displayQuality < 72
  );
}

function scoreDiscoveryRankingOutcome(
  outcome: DiscoveryCheckedCandidateOutcome,
  searchDepth: number,
) {
  const rankStrength = clamp01(
    1 - ((Math.max(1, outcome.rank) - 1) / Math.max(1, searchDepth - 1)),
  );
  const relevance = clamp01(Number(outcome.relevance || 0) / 100);
  const displayQuality = clamp01(Number(outcome.displayQuality || 0) / 100);
  const semanticStrength = clamp01(
    Math.max(
      outcome.featureQuality.semanticCoverage || 0,
      outcome.featureQuality.categorySemanticCoverage || 0,
    ),
  );
  const titleStrength = clamp01(
    Math.max(
      outcome.featureQuality.exactTitleMatch || 0,
      outcome.featureQuality.exactTitleSegment || 0,
      outcome.featureQuality.orderedTitleCoverage || 0,
    ),
  );
  const specificityBonus = getDiscoverySpecificityBonus(outcome.keyword);
  const singleWordGroundingBonus = getDiscoverySingleWordGroundingBonus({
    keyword: outcome.keyword,
    exactTitleMatch: outcome.featureQuality.exactTitleMatch,
    exactTitleSegment: outcome.featureQuality.exactTitleSegment,
    orderedTitleCoverage: outcome.featureQuality.orderedTitleCoverage,
    semanticCoverage: outcome.featureQuality.semanticCoverage,
    categorySemanticCoverage: outcome.featureQuality.categorySemanticCoverage,
  });
  const genericPenalty = clamp01(outcome.featureQuality.genericCoverage || 0) *
    (singleWordGroundingBonus > 0 || specificityBonus >= 0.52 ? 0.45 : 1);
  const contextualStrength = Math.max(
    titleStrength,
    semanticStrength,
    clamp01(outcome.featureQuality.descriptionCoverage || 0),
  );
  const categoryOnlyGenericPenalty =
    clamp01(outcome.featureQuality.genericCoverage || 0) *
    clamp01(outcome.featureQuality.categorySemanticCoverage || 0) *
    Math.max(0, 1 - contextualStrength) *
    0.18;

  return (
    rankStrength * 0.34 +
    relevance * 0.28 +
    displayQuality * 0.14 +
    semanticStrength * 0.1 +
    titleStrength * 0.08 +
    specificityBonus * 0.1 +
    singleWordGroundingBonus * 0.1 -
    genericPenalty * 0.18 -
    categoryOnlyGenericPenalty * 0.1
  );
}

function scoreDiscoverySuggestionCandidate(candidate: DiscoveryMetricCandidate) {
  const relevance = clamp01(Number(candidate.baseline.relevance || 0) / 100);
  const displayQuality = clamp01(Number(candidate.displayQuality || 0) / 100);
  const semanticStrength = clamp01(
    Math.max(
      candidate.features.semanticCoverage || 0,
      candidate.features.categorySemanticCoverage || 0,
    ),
  );
  const titleStrength = clamp01(
    Math.max(
      candidate.features.exactTitleMatch || 0,
      candidate.features.exactTitleSegment || 0,
      candidate.features.orderedTitleCoverage || 0,
    ),
  );
  const demand = clamp01(Number(candidate.baseline.demand || 0) / 100);
  const specificityBonus = getDiscoverySpecificityBonus(candidate.keyword);
  const singleWordGroundingBonus = getDiscoverySingleWordGroundingBonus({
    keyword: candidate.keyword,
    exactTitleMatch: candidate.features.exactTitleMatch,
    exactTitleSegment: candidate.features.exactTitleSegment,
    orderedTitleCoverage: candidate.features.orderedTitleCoverage,
    semanticCoverage: candidate.features.semanticCoverage,
    categorySemanticCoverage: candidate.features.categorySemanticCoverage,
  });
  const genericPenalty = clamp01(candidate.features.genericCoverage || 0) *
    (singleWordGroundingBonus > 0 || specificityBonus >= 0.52 ? 0.45 : 1);
  const descriptionStrength = clamp01(candidate.features.descriptionCoverage || 0);
  const sourceStrength = clamp01(candidate.features.sourceStrength || 0);
  const contextualStrength = Math.max(
    titleStrength,
    semanticStrength,
    descriptionStrength,
    sourceStrength,
  );
  const categoryOnlyGenericPenalty =
    clamp01(candidate.features.genericCoverage || 0) *
    clamp01(candidate.features.categorySemanticCoverage || 0) *
    Math.max(0, 1 - contextualStrength) *
    0.28;
  const lowIntentPenalty = [
    "NEAR_BRAND_JUNK",
    "LOW_INTENT_JUNK",
    "BRAND_MODIFIER_WEAK",
    "COMPETITOR_BRAND",
  ].includes(candidate.features.intentType)
    ? 0.12
    : 0;

  return (
    relevance * 0.3 +
    displayQuality * 0.14 +
    semanticStrength * 0.14 +
    descriptionStrength * 0.14 +
    sourceStrength * 0.1 +
    titleStrength * 0.1 +
    clamp01(candidate.features.categorySemanticCoverage || 0) * 0.05 +
    demand * 0.05 +
    specificityBonus * 0.06 +
    singleWordGroundingBonus * 0.08 -
    genericPenalty * 0.18 -
    categoryOnlyGenericPenalty * 0.22 -
    lowIntentPenalty
  );
}

function selectDiscoveryDiverseRankings(
  candidates: DiscoveryCheckedCandidateOutcome[],
  mode: DiscoveryMode,
  searchDepth: number,
  limit: number,
) {
  const sorted = [...candidates].sort((a, b) => {
    const scoreDelta =
      scoreDiscoveryRankingOutcome(b, searchDepth) -
      scoreDiscoveryRankingOutcome(a, searchDepth);
    if (Math.abs(scoreDelta) > 0.0001) return scoreDelta;
    if (a.rank !== b.rank) return a.rank - b.rank;
    return b.relevance - a.relevance;
  });

  const genericHeadLimit = DISCOVERY_GENERIC_HEAD_LIMIT[mode];
  const selected: DiscoveryCheckedCandidateOutcome[] = [];
  const deferredGeneric: DiscoveryCheckedCandidateOutcome[] = [];
  let genericHeadCount = 0;

  for (const candidate of sorted) {
    const isGenericHead = isDiscoveryGenericHeadLike({
      keyword: candidate.keyword,
      displayQuality: candidate.displayQuality,
      genericCoverage: candidate.featureQuality.genericCoverage,
      exactTitleMatch: candidate.featureQuality.exactTitleMatch,
      exactTitleSegment: candidate.featureQuality.exactTitleSegment,
      orderedTitleCoverage: candidate.featureQuality.orderedTitleCoverage,
      semanticCoverage: candidate.featureQuality.semanticCoverage,
      categorySemanticCoverage: candidate.featureQuality.categorySemanticCoverage,
      descriptionCoverage: candidate.featureQuality.descriptionCoverage,
      sourceStrength: candidate.featureQuality.sourceStrength,
    });

    if (isGenericHead && genericHeadCount >= genericHeadLimit) {
      deferredGeneric.push(candidate);
      continue;
    }

    selected.push(candidate);
    if (isGenericHead) {
      genericHeadCount += 1;
    }

    if (selected.length >= limit) {
      return selected;
    }
  }

  for (const candidate of deferredGeneric) {
    selected.push(candidate);
    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

function selectDiscoveryDiverseSuggestions(
  candidates: DiscoveryMetricCandidate[],
  mode: DiscoveryMode,
  limit: number,
) {
  const sorted = [...candidates].sort((a, b) => {
    const scoreDelta =
      scoreDiscoverySuggestionCandidate(b) -
      scoreDiscoverySuggestionCandidate(a);
    if (Math.abs(scoreDelta) > 0.0001) return scoreDelta;
    if (b.baseline.relevance !== a.baseline.relevance) {
      return b.baseline.relevance - a.baseline.relevance;
    }
    return a.keyword.length - b.keyword.length;
  });

  const genericHeadLimit = DISCOVERY_GENERIC_HEAD_LIMIT[mode];
  const selected: DiscoveryMetricCandidate[] = [];
  const deferredGeneric: DiscoveryMetricCandidate[] = [];
  let genericHeadCount = 0;

  for (const candidate of sorted) {
    const isGenericHead = isDiscoveryGenericHeadLike({
      keyword: candidate.keyword,
      displayQuality: candidate.displayQuality,
      genericCoverage: candidate.features.genericCoverage,
      exactTitleMatch: candidate.features.exactTitleMatch,
      exactTitleSegment: candidate.features.exactTitleSegment,
      orderedTitleCoverage: candidate.features.orderedTitleCoverage,
      semanticCoverage: candidate.features.semanticCoverage,
      categorySemanticCoverage: candidate.features.categorySemanticCoverage,
      descriptionCoverage: candidate.features.descriptionCoverage,
      sourceStrength: candidate.features.sourceStrength,
    });

    if (isGenericHead && genericHeadCount >= genericHeadLimit) {
      deferredGeneric.push(candidate);
      continue;
    }

    selected.push(candidate);
    if (isGenericHead) {
      genericHeadCount += 1;
    }

    if (selected.length >= limit) {
      return selected;
    }
  }

  for (const candidate of deferredGeneric) {
    selected.push(candidate);
    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
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
  options?: {
    proxyFallbackOnNotRanked?: boolean;
    proxyFirst?: boolean;
  },
) {
  const rankingDepth = normalizeRankingDepth(depth);
  const proxyVerificationKey = options?.proxyFirst
    ? 'proxy-first'
    : options?.proxyFallbackOnNotRanked
      ? 'verify-proxy'
      : 'standard';
  const cacheKey = `${storeType}-${country}-${appId}-${keyword}-${rankingDepth}-${proxyVerificationKey}`;
  const cachedRank = rankingCache.get<number>(cacheKey);
  if (cachedRank !== undefined && !refresh) {
    return cachedRank;
  }

  const failureCacheKey = `ranking-failure:${storeType}:${country}:${appId}:${normalizeKeyword(keyword)}:${rankingDepth}:${proxyVerificationKey}`;
  const useFailureCache = !refresh;
  const cachedFailure = useFailureCache ? getCachedFailure(failureCacheKey) : null;
  if (cachedFailure) {
    throw cachedFailure;
  }

  let rank = -1;
  const failureMessage = 'The keyword ranking request is taking too long. Please try again.';

  try {
    if (storeType === 'ios') {
      rank = await getAppleAppStoreRankWithFallback(
        keyword,
        appId,
        country,
        rankingDepth,
        deadlineAt,
        failureMessage,
        'ranking',
        {
          proxyFallbackOnNotRanked: options?.proxyFallbackOnNotRanked,
          proxyFirst: options?.proxyFirst,
        },
      );
    } else {
      rank = await getGooglePlayRankWithFallback(
        keyword,
        appId,
        country,
        rankingDepth,
        deadlineAt,
        failureMessage,
        'ranking',
        options,
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

async function refreshAllTrackingState(
  state: TrackingState,
  options?: {
    updateScheduleMetadata?: boolean;
    runKey?: string;
    mode?: TrackingRefreshMode;
  },
) {
  return refreshSharedAllTrackingState(
    state,
    {
      rankingDepth: TRACKED_KEYWORD_RANKING_DEPTH,
      getKeywordRank: (
        keyword,
        appId,
        storeType,
        country,
        refresh,
        depth,
      ) =>
        getKeywordRank(
          keyword,
          appId,
          storeType,
          country,
          refresh,
          depth,
          getUpstreamDeadline(),
          {
            proxyFallbackOnNotRanked: true,
            proxyFirst: true,
          },
        ),
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
  options?: {
    mode?: TrackingRefreshMode;
    alertsEnabled?: boolean;
  },
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
  const runDayKey = getGlobalRunDayKey(runKey);

  await mapWithConcurrency(state.competitorGroups, 1, async (group) => {
    const trackedCountries = getCompetitorTrackedCountriesForGroup(
      group,
      state.competitorTrackedKeywords,
    );
    await mapWithConcurrency(trackedCountries, 1, async (trackedCountry) => {
      await mapWithConcurrency(group.competitors, 2, async (app) => {
        const comparableKey = `${group.groupId}:${app.appId}:${trackedCountry}`;
        const latestSnapshot = latestByKey.get(comparableKey);
        if (
          options?.mode === 'unresolved_only' &&
          latestSnapshot &&
          getGlobalDayKeyForTimestamp(latestSnapshot.capturedAt) === runDayKey
        ) {
          return;
        }

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

  const { createdEvents } =
    options?.alertsEnabled === false
      ? { createdEvents: [] as AlertEvent[] }
      : await evaluateAndDispatchCompetitorAsoAlertRules(
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
    changedFields: (() => {
      const fields = Array.isArray(candidate.changedFields)
        ? candidate.changedFields.filter(
            (field): field is CompetitorAsoFieldName =>
              field === 'title' ||
              field === 'description' ||
              field === 'icon' ||
              field === 'category' ||
              field === 'screenshots',
          )
        : [];
      return fields.length ? fields : changes.map((change) => change.field);
    })(),
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
  const appCounts = new Map<string, { label: string; count: number }>();
  const countryCounts = new Map<string, number>();

  diffs.forEach((diff) => {
    const currentAppCount = appCounts.get(diff.appId);
    appCounts.set(diff.appId, {
      label: diff.appTitle,
      count: (currentAppCount?.count || 0) + 1,
    });
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
  const appBuckets = Array.from(appCounts.values())
    .map(({ label, count }) => ({ key: label, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, 8);

  return {
    totalDiffs: diffs.length,
    changedApps: appCounts.size,
    changedCountries: countryCounts.size,
    latestDetectedAt: diffs[0]?.detectedAt,
    fieldCounts,
    topApps: appBuckets,
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
  if (!LEGACY_FILE_TRACKING_SCHEDULER_ENABLED) {
    return;
  }
  const state = await loadTrackingState();
  const schedule = normalizeTrackingSchedule(state.schedule);
  const hasTrackedData =
    state.trackedKeywords.length > 0 ||
    state.competitorTrackedKeywords.length > 0 ||
    state.competitorGroups.length > 0;
  if (!hasTrackedData) {
    return;
  }

  const scheduledMinutes = getGlobalTrackingScheduledMinutes(schedule.time);
  const scheduledHour = Math.floor(scheduledMinutes / 60);
  const scheduledMinute = scheduledMinutes % 60;
  const now = new Date();
  const currentTime = getZonedDateParts(now, schedule.timezone);
  if (currentTime.hour !== scheduledHour || currentTime.minute !== scheduledMinute) {
    return;
  }

  const runKey = getScheduleRunKey(now, schedule);
  if (!shouldRunTrackingRefresh(schedule, { hasTrackedData, runKey })) {
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
    mode?: TrackingRefreshMode;
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
      if (
        userData?.accountStatus === 'deleted' ||
        userData?.accountStatus === 'deleting'
      ) {
        return;
      }
      const state = normalizeUserTrackingDocument(userData);
      const planEntitlements = getResolvedPlanEntitlements(userData);
      const competitorTrackingEnabled = planEntitlements.competitorTracking;
      const executionState = competitorTrackingEnabled
        ? state
        : {
            ...state,
            competitorGroups: [],
            competitorTrackedKeywords: [],
            competitorRankHistory: [],
            competitorAsoLatestSnapshots: [],
          };
      const hasTrackedData =
        state.trackedKeywords.length > 0 ||
        state.competitorTrackedKeywords.length > 0 ||
        state.competitorGroups.length > 0;
      const updatePayload: Partial<UserTrackingDocument> = {};
      let weeklyEmailState: Pick<
        NormalizedUserTrackingDocument,
        | 'trackedKeywords'
        | 'rankHistory'
        | 'competitorGroups'
        | 'competitorTrackedKeywords'
        | 'competitorRankHistory'
        | 'weeklyReportSettings'
      > = state;

      if (hasTrackedData) {
        const schedule = normalizeTrackingSchedule(state.schedule);
        if (shouldRunTrackingRefresh(schedule, {
          hasTrackedData: true,
          runKey,
          force: options?.force,
        })) {
          const planLimits = getResolvedPlanLimits(userData);
          const { scopedState } = getTrackedKeywordScopedState(executionState, planLimits);
          const recoveryScope =
            options?.mode === 'unresolved_only'
              ? getTrackingRecoveryScope(scopedState, runKey)
              : {
                  scopedState,
                  counts: {
                    trackedKeywords: scopedState.trackedKeywords.length,
                    competitorTrackedApps: scopedState.competitorTrackedKeywords.reduce(
                      (sum, trackedKeyword) => sum + trackedKeyword.apps.length,
                      0,
                    ),
                    competitorAsoTargets: getUnresolvedCompetitorAsoTargetCount(
                      scopedState,
                      runKey,
                    ),
                  },
                };
          const hasTrackedRefreshWork =
            recoveryScope.counts.trackedKeywords > 0 ||
            recoveryScope.counts.competitorTrackedApps > 0;
          const hasCompetitorAsoWork = recoveryScope.counts.competitorAsoTargets > 0;
          if (hasTrackedRefreshWork || hasCompetitorAsoWork) {
            const refreshed = await refreshAllTrackingState(recoveryScope.scopedState, {
              updateScheduleMetadata: true,
              runKey,
              mode: options?.mode,
            });
            const nextTrackedKeywords = mergeTrackedKeywords(
              state.trackedKeywords,
              refreshed.nextState.trackedKeywords,
            );
            const nextCompetitorTrackedKeywords = mergeCompetitorTrackedKeywords(
              state.competitorTrackedKeywords,
              refreshed.nextState.competitorTrackedKeywords,
            );
            const { updatedRules: updatedAlertRules } =
              planEntitlements.alertRules || planEntitlements.alertDelivery
                ? await evaluateAndDispatchAlertRules(
                    userDoc.ref,
                    [
                      ...state.trackedKeywords,
                      ...flattenCompetitorTrackedKeywordsForAlerts(
                        state.competitorTrackedKeywords,
                      ),
                    ],
                    [
                      ...nextTrackedKeywords,
                      ...flattenCompetitorTrackedKeywordsForAlerts(
                        nextCompetitorTrackedKeywords,
                      ),
                    ],
                    state.alertRules,
                    state.notificationSettings,
                    runKey,
                  )
                : {
                    updatedRules: state.alertRules,
                  };
            const asoResult = competitorTrackingEnabled
              ? await captureCompetitorAsoState(
                  userDoc.ref,
                  {
                    competitorGroups: state.competitorGroups,
                    competitorTrackedKeywords: nextCompetitorTrackedKeywords,
                    competitorAsoLatestSnapshots: state.competitorAsoLatestSnapshots,
                    alertRules: updatedAlertRules,
                    notificationSettings: state.notificationSettings,
                  },
                  runKey,
                  {
                    mode: options?.mode,
                    alertsEnabled:
                      planEntitlements.alertRules || planEntitlements.alertDelivery,
                  },
                )
              : {
                  nextLatestSnapshots: state.competitorAsoLatestSnapshots,
                  checked: 0,
                  changed: 0,
                  failed: 0,
                };
            const retainedRankHistory = await archiveAndTrimTrackedRankHistory(
              userDoc.ref,
              refreshed.nextState.rankHistory,
            );
            const retainedCompetitorRankHistory = competitorTrackingEnabled
              ? await archiveAndTrimCompetitorRankHistory(
                  userDoc.ref,
                  refreshed.nextState.competitorRankHistory,
                )
              : state.competitorRankHistory;

            updatePayload.trackedKeywords = nextTrackedKeywords;
            updatePayload.rankHistory = retainedRankHistory;
            updatePayload.trackingSchedule = refreshed.nextState.schedule;
            updatePayload.alertRules = updatedAlertRules;
            if (competitorTrackingEnabled) {
              updatePayload.competitorTrackedKeywords = nextCompetitorTrackedKeywords;
              updatePayload.competitorRankHistory = retainedCompetitorRankHistory;
              updatePayload.competitorAsoLatestSnapshots = asoResult.nextLatestSnapshots;
            }

            weeklyEmailState = {
              trackedKeywords: nextTrackedKeywords,
              rankHistory: retainedRankHistory,
              competitorGroups: state.competitorGroups,
              competitorTrackedKeywords: nextCompetitorTrackedKeywords,
              competitorRankHistory: retainedCompetitorRankHistory,
              weeklyReportSettings: state.weeklyReportSettings,
            };

            ran += 1;
            checked += refreshed.checked;
            changed += refreshed.changed;
            failed += refreshed.failed;
            asoChecked += asoResult.checked;
            asoChanged += asoResult.changed;
            asoFailed += asoResult.failed;
          }
        }
      }

      const nextWeeklyReportSettings = planEntitlements.weeklyEmailReports
        ? await maybeSendWeeklyReportEmail(
            userDoc.ref,
            weeklyEmailState,
            now,
          )
        : null;
      if (nextWeeklyReportSettings) {
        updatePayload.weeklyReportSettings = nextWeeklyReportSettings;
      }

      if (Object.keys(updatePayload).length > 0) {
        await userDoc.ref.set({
          ...updatePayload,
          updatedAt: new Date().toISOString(),
        } satisfies UserTrackingDocument, { merge: true });
      }
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
    mode?: TrackingRefreshMode;
    trigger?: 'automatic' | 'manual' | 'watchdog' | 'recovery';
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
      mode: options?.mode,
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
    ...(apiError.meta || {}),
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

async function patchDocumentRefsInBatches(
  adminDb: Firestore,
  docRefs: DocumentReference<DocumentData>[],
  patch: DocumentData,
  batchSize = 400,
) {
  for (let index = 0; index < docRefs.length; index += batchSize) {
    const batch = adminDb.batch();
    docRefs.slice(index, index + batchSize).forEach((docRef) => {
      batch.set(docRef, patch, { merge: true });
    });
    await batch.commit();
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
  options?: {
    force?: boolean;
    skipCompetitorMining?: boolean;
    deadlineAt?: number;
  },
): Promise<{
  terms: { term: string; weight: number }[];
  repeatedTerms: { term: string; weight: number; appHits: number }[];
  competitorBrandTokens: string[];
  status: DiscoveryCompetitorMiningStatus;
}> {
  const storeType = context.store;
  const country = context.country || 'us';
  if (!storeType || options?.skipCompetitorMining) {
    return {
      terms: [],
      repeatedTerms: [],
      competitorBrandTokens: [],
      status: options?.skipCompetitorMining ? 'skipped' : 'ok',
    };
  }

  const cacheKey = JSON.stringify({
    cacheVersion: DISCOVERY_CACHE_VERSION,
    title: normalizeKeyword(context.title),
    category: normalizeKeyword(context.category || ''),
    mode,
    store: storeType,
    country,
  });
  const cached = keywordSourceCache.get<{
    terms: { term: string; weight: number }[];
    repeatedTerms: { term: string; weight: number; appHits: number }[];
    competitorBrandTokens: string[];
    status?: DiscoveryCompetitorMiningStatus;
  }>(cacheKey);
  if (!options?.force && cached) {
    return {
      ...cached,
      status: cached.status || 'ok',
    };
  }

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
  const seedList = Array.from(seeds).slice(0, profile.competitorSeedLimit);

  const competitorDeadlineAt = options?.deadlineAt || getUpstreamDeadline(profile.competitorMiningTimeoutMs);
  let seedResults: any[][];
  try {
    seedResults = await runWithDeadline(
      () => Promise.all(
        seedList.map(async (seed) => {
          try {
            return await searchStore(
              seed,
              storeType,
              country,
              profile.competitorResultsPerSeed,
              {
                useFailureCache: false,
                preferDirectFirst: true,
                proxyFallbackOnError: mode === 'deep',
                proxyFallbackOnEmpty: profile.competitorProxyFallbackOnEmpty,
              },
              competitorDeadlineAt,
            );
          } catch (error) {
            console.warn(`Competitor keyword mining failed for "${seed}"`, error);
            return [];
          }
        }),
      ),
      competitorDeadlineAt,
      'Competitor keyword discovery is taking too long.',
    );
  } catch (error) {
    console.warn('[discovery] Competitor mining skipped after failure.', error);
    return {
      terms: [],
      repeatedTerms: [],
      competitorBrandTokens: [],
      status: isTimeoutLikeError(error) ? 'timeout' : 'failed',
    };
  }

  const competitorBrandTokens = new Set<string>();
  seedResults.forEach((results) => {
    results.forEach((app: any, index: number) => {
      const rankWeight = Math.max(2, 10 - index);
      const category = app.primaryGenre || app.genre || '';
      const appKey = String(app.appId || app.id || `${app.title || 'app'}-${index}`);
      const title = String(app.title || '');
      const seenTermsForApp = new Set<string>();
      const titleSegmentsForApp = collectTitleSegments(title);
      const titleTokensForApp = tokenize(title);
      const leadToken = titleTokensForApp[0];
      const suppressBrandLead = Boolean(
        leadToken &&
          !ownTokens.has(leadToken) &&
          !categoryHintTokens.has(leadToken) &&
          !HIGH_VOLUME_TERMS.has(leadToken) &&
          leadToken.length > 2,
      );
      const weightedTitle =
        suppressBrandLead && titleTokensForApp.length > 1
          ? titleTokensForApp.slice(1).join(' ')
          : title;

      if (suppressBrandLead && leadToken) {
        competitorBrandTokens.add(leadToken);
      }

      titleSegmentsForApp.forEach((segment, segmentIndex) => {
        if (suppressBrandLead && leadToken && segment.startsWith(`${leadToken} `)) {
          return;
        }
        const segmentWeight = segmentIndex === 0 ? rankWeight * 3 : rankWeight * 2;
        addWeightedTerm(competitorTerms, segment, segmentWeight);
        seenTermsForApp.add(normalizeKeyword(segment));
      });

      if (!suppressBrandLead && titleTokensForApp[0]) {
        addWeightedTerm(competitorTerms, titleTokensForApp[0], rankWeight + 3);
        seenTermsForApp.add(titleTokensForApp[0]);
      }
      if (!suppressBrandLead && titleTokensForApp[0] && titleTokensForApp[1]) {
        const leadBigram = `${titleTokensForApp[0]} ${titleTokensForApp[1]}`;
        addWeightedTerm(competitorTerms, leadBigram, rankWeight + 4);
        seenTermsForApp.add(leadBigram);
      }

      addTokenWeights(competitorTerms, weightedTitle, rankWeight + 1, rankWeight + 3);
      addTokenWeights(competitorTerms, category, rankWeight + 2, 0);

      tokenize(weightedTitle).forEach((token) => {
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
      return [term, weight + categoryBoost] as const;
    })
    .sort((a, b) => b[1] - a[1])
    .filter(([, weight]) => weight > 0)
    .slice(0, profile.competitorTermLimit)
    .map(([term, weight]) => ({ term, weight }));

  const repeatedTerms = Array.from(termAppHits.entries())
    .map(([term, appHits]) => ({
      term,
      appHits: appHits.size,
      weight: competitorTerms.get(term) || 0,
    }))
    .filter(({ appHits, term, weight }) => {
      if (appHits < 2 || weight <= 0) {
        return false;
      }
      const normalized = normalizeKeyword(term);
      if (!normalized) {
        return false;
      }
      const parts = normalized.split(' ');
      return !parts.every((part) => ownTokens.has(part));
    })
    .sort((left, right) => {
      if (right.appHits !== left.appHits) return right.appHits - left.appHits;
      return right.weight - left.weight;
    })
    .map(({ term, weight, appHits }) => ({ term: normalizeKeyword(term), weight, appHits }));

  const payload = {
    terms: mined,
    repeatedTerms,
    competitorBrandTokens: Array.from(competitorBrandTokens).sort((a, b) => a.localeCompare(b)),
    status: 'ok' as const,
  };

  keywordSourceCache.set(cacheKey, payload);
  return payload;
}

async function buildKeywordSignals(
  context: KeywordContext,
  mode: DiscoveryMode,
  profile: DiscoveryProfile,
  options?: {
    force?: boolean;
    skipCompetitorMining?: boolean;
    competitorDeadlineAt?: number;
  },
): Promise<{
  candidateWeights: Map<string, number>;
  competitorWeights: Map<string, number>;
  competitorRepeatedTerms: string[];
  competitorBrandTokens: Set<string>;
  ownTitleTokens: Set<string>;
  competitorMiningStatus: DiscoveryCompetitorMiningStatus;
}> {
  const candidates = new Map<string, number>();
  const titleSegments = collectTitleSegments(context.title);
  const ownTitleTokens = new Set(tokenize(context.title));
  const categoryHintTokens = new Set(deriveCategoryHints(context.category).flatMap((hint) => tokenize(hint)));

  titleSegments.forEach((segment, index) => addWeightedTerm(candidates, segment, 40 - (index * 4)));
  addTokenWeights(candidates, context.title, 16, 20);
  addTokenWeights(candidates, context.description, 2, 5);
  addDescriptionIntentTerms(candidates, context.description, ownTitleTokens, categoryHintTokens);
  buildDiscoveryContextCandidateKeywords({
    context: {
      title: context.title,
      description: context.description,
      category: context.category,
      developer: context.developer,
      store: context.store || 'android',
      country: context.country || 'us',
    },
    limits: {
      featureSummaryLimit: mode === 'deep' ? 18 : 12,
      seedPackLimit: mode === 'deep' ? 28 : 18,
      phraseWindowLimit: mode === 'deep' ? 56 : 32,
      totalLimit: mode === 'deep' ? 56 : 32,
    },
  }).forEach((phrase, index) => {
    addWeightedDiscoveryPhrase(
      candidates,
      phrase,
      Math.max(mode === 'deep' ? 10 : 8, (mode === 'deep' ? 28 : 22) - index),
    );
  });

  deriveCategoryHints(context.category).forEach((hint) => addWeightedTerm(candidates, hint, 8));
  tokenize(context.developer).forEach((token) => addWeightedTerm(candidates, token, 2));

  const competitorSource = await mineCompetitorTerms(context, mode, profile, {
    force: options?.force,
    skipCompetitorMining: options?.skipCompetitorMining,
    deadlineAt: options?.competitorDeadlineAt,
  });
  const competitorWeights = new Map<string, number>();
  competitorSource.terms.forEach(({ term, weight }) => {
    competitorWeights.set(term, weight);
    addWeightedTerm(candidates, term, Math.max(4, Math.round(weight / 2)));
  });

  return {
    candidateWeights: candidates,
    competitorWeights,
    competitorRepeatedTerms: (competitorSource.repeatedTerms || []).map(({ term }) => term),
    competitorBrandTokens: new Set(competitorSource.competitorBrandTokens),
    ownTitleTokens,
    competitorMiningStatus: competitorSource.status,
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

function addDescriptionIntentTerms(
  target: Map<string, number>,
  description: string | undefined,
  ownTitleTokens: Set<string>,
  categoryHintTokens: Set<string>,
) {
  const tokens = tokenize(description);
  if (tokens.length === 0) {
    return;
  }

  const unigramCounts = new Map<string, number>();
  const bigramCounts = new Map<string, number>();

  tokens.forEach((token) => {
    unigramCounts.set(token, (unigramCounts.get(token) || 0) + 1);
  });

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const left = tokens[index];
    const right = tokens[index + 1];
    if (left === right) {
      continue;
    }
    const bigram = `${left} ${right}`;
    bigramCounts.set(bigram, (bigramCounts.get(bigram) || 0) + 1);
  }

  unigramCounts.forEach((count, token) => {
    if (count < 2) {
      return;
    }
    if (ownTitleTokens.has(token) || categoryHintTokens.has(token) || HIGH_VOLUME_TERMS.has(token)) {
      return;
    }
    addWeightedTerm(target, token, 4 + (count * 2));
  });

  bigramCounts.forEach((count, bigram) => {
    const parts = bigram.split(' ');
    const genericPartCount = parts.filter((part) =>
      categoryHintTokens.has(part) || HIGH_VOLUME_TERMS.has(part)
    ).length;

    if (genericPartCount === parts.length) {
      return;
    }

    const nonBrandSpecificCount = parts.filter((part) =>
      !ownTitleTokens.has(part) &&
      !categoryHintTokens.has(part) &&
      !HIGH_VOLUME_TERMS.has(part)
    ).length;

    if (count < 2 && nonBrandSpecificCount === 0) {
      return;
    }

    let weight = 6 + (count * 3);
    if (genericPartCount === 0) {
      weight += 4;
    }
    if (nonBrandSpecificCount > 0) {
      weight += nonBrandSpecificCount * 2;
    }

    addWeightedTerm(target, bigram, weight);
  });
}

function addWeightedDiscoveryPhrase(
  target: Map<string, number>,
  rawPhrase: string,
  weight: number,
) {
  if (weight <= 0) {
    return;
  }

  const phrase = normalizeKeyword(rawPhrase);
  if (!phrase || !isDiscoveryKeywordCandidate(phrase)) {
    return;
  }

  const parts = phrase.split(' ');
  if (parts.length < 1 || parts.length > 7) {
    return;
  }

  target.set(phrase, (target.get(phrase) || 0) + weight);
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
  options?: { force?: boolean },
): Promise<{
  keywords: string[];
  competitorRepeatedTerms: string[];
  competitorBrandTokens: string[];
}> {
  const { candidateWeights, competitorRepeatedTerms, competitorBrandTokens, ownTitleTokens } = await buildKeywordSignals(
    context,
    mode,
    profile,
    options,
  );

  return {
    keywords: getSortedCandidateTerms(candidateWeights, ownTitleTokens)
      .map(([term]) => term),
    competitorRepeatedTerms,
    competitorBrandTokens: Array.from(competitorBrandTokens).sort((a, b) => a.localeCompare(b)),
  };
}
const genai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const GEMINI_DISCOVERY_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'] as const;
const GEMINI_DISCOVERY_RETRY_DELAYS_MS = [600, 1500] as const;
const groqClient = process.env.GROQ_API_KEY
  ? new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: 'https://api.groq.com/openai/v1',
    })
  : null;
const DISCOVERY_PRIMARY_MODEL_FAST =
  process.env.DISCOVERY_PRIMARY_MODEL_FAST ||
  process.env.DISCOVERY_PRIMARY_MODEL ||
  'openai/gpt-oss-120b';
const DISCOVERY_PRIMARY_MODEL_DEEP =
  process.env.DISCOVERY_PRIMARY_MODEL_DEEP ||
  process.env.DISCOVERY_PRIMARY_MODEL ||
  'openai/gpt-oss-120b';
const DISCOVERY_FALLBACK_MODEL =
  process.env.DISCOVERY_FALLBACK_MODEL || 'openai/gpt-oss-20b';
const DISCOVERY_GEMINI_REPAIR_MODEL =
  process.env.DISCOVERY_GEMINI_REPAIR_MODEL || 'gemini-2.5-flash-lite';
const DISCOVERY_REFINEMENT_RETRY_DELAYS_MS = [600, 1500] as const;
const DISCOVERY_REFINEMENT_LIMITS = {
  fast: {
    promptCandidateLimit: 80,
    featureSummaryLimit: 20,
    outputKeywordLimit: 28,
    outputTokenLimit: 384,
    minimumUsableCount: 10,
    appPurposeLimit: 4,
    targetUsersLimit: 4,
    coreFeaturesLimit: 8,
    useCasesLimit: 7,
    painPointsLimit: 5,
    competitorRepeatedTermsLimit: 8,
    rawDescriptionExcerptChars: 1800,
  },
  deep: {
    promptCandidateLimit: 260,
    featureSummaryLimit: 44,
    outputKeywordLimit: 75,
    outputTokenLimit: 1200,
    minimumUsableCount: 18,
    appPurposeLimit: 6,
    targetUsersLimit: 6,
    coreFeaturesLimit: 12,
    useCasesLimit: 10,
    painPointsLimit: 8,
    competitorRepeatedTermsLimit: 14,
    rawDescriptionExcerptChars: 3600,
  },
} as const;
const DISCOVERY_PROMPT_SOFT_TARGET_TOKENS: Record<DiscoveryMode, number> = {
  fast: 2000,
  deep: 4000,
};
const DISCOVERY_PROMPT_FLOOR_LIMITS = {
  fast: {
    promptCandidateLimit: 112,
    featureSummaryLimit: 24,
    appPurposeLimit: 5,
    targetUsersLimit: 5,
    coreFeaturesLimit: 10,
    useCasesLimit: 9,
    painPointsLimit: 7,
    competitorRepeatedTermsLimit: 10,
    rawDescriptionExcerptChars: 2400,
  },
  deep: {
    promptCandidateLimit: 260,
    featureSummaryLimit: 44,
    appPurposeLimit: 8,
    targetUsersLimit: 8,
    coreFeaturesLimit: 16,
    useCasesLimit: 14,
    painPointsLimit: 12,
    competitorRepeatedTermsLimit: 18,
    rawDescriptionExcerptChars: 4200,
  },
} as const;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type DiscoveryMetricCandidate = {
  id: number;
  keyword: string;
  features: ReturnType<typeof extractKeywordFeatures>;
  baseline: ReturnType<typeof scoreKeywordMetrics>;
  displayQuality: number;
};

type DiscoveryFeatureQuality = {
  exactTitleMatch: number;
  exactTitleSegment: number;
  orderedTitleCoverage: number;
  titleCoverage: number;
  appTitleCoverage: number;
  descriptionCoverage: number;
  genericCoverage: number;
  semanticCoverage: number;
  categorySemanticCoverage: number;
  sourceStrength: number;
};

type DiscoveryCheckedCandidateOutcome = {
  keyword: string;
  rank: number;
  demand: number;
  volume: number;
  difficulty: number;
  relevance: number;
  confidence: 'low' | 'medium' | 'high';
  displayQuality: number;
  featureQuality: DiscoveryFeatureQuality;
};

const DISCOVERY_GENERIC_HEAD_LIMIT: Record<DiscoveryMode, number> = {
  fast: 4,
  deep: 6,
};

type DiscoveryCandidateCacheEntry = {
  completeness: DiscoveryMode;
  rankedCandidates: DiscoveryMetricCandidate[];
  rawCount: number;
  modelCount: number;
  sanitizedModelCount: number;
  candidateCount: number;
  providerUsed?: 'groq' | 'gemini' | null;
  modelUsed?: string | null;
  promptCandidateCount?: number;
  featureLineCount?: number;
  fallbackReason?: string | null;
  competitorMiningStatus?: DiscoveryCompetitorMiningStatus;
  candidateBuildMs?: number;
};

type DiscoveryResultCacheEntry = {
  completeness: DiscoveryMode;
  rankedCandidates: DiscoveryMetricCandidate[];
  checkedOutcomes: DiscoveryCheckedCandidateOutcome[];
  checkedKeywords: number;
  candidateCount: number;
  searchDepth: number;
  failedLookups: number;
  timedOutLookups?: number;
  loadedAt: string;
  competitorMiningStatus?: DiscoveryCompetitorMiningStatus;
};

type DiscoveryRefinementContext = {
  title: string;
  description?: string;
  category?: string;
  developer?: string;
  store: StoreType;
  country: string;
};

type DiscoveryProviderName = 'groq' | 'gemini';

type DiscoveryKeywordProviderResult = {
  keywords: string[];
  model: string;
  provider: DiscoveryProviderName;
};

type DiscoveryProviderAttemptFailureReason =
  | 'provider_error'
  | 'timeout'
  | 'invalid_json'
  | 'empty_output'
  | 'insufficient_output'
  | 'unconfigured';

type DiscoveryProviderAttempt = {
  error?: unknown;
  failureReason: DiscoveryProviderAttemptFailureReason | null;
  result: DiscoveryKeywordProviderResult | null;
};

type DiscoveryRefinementCacheEntry = {
  keywords: string[];
  rawCount: number;
  modelCount: number;
  sanitizedModelCount: number;
  fallbackAddedCount: number;
  providerUsed: DiscoveryProviderName | null;
  modelUsed: string | null;
  promptCandidateCount: number;
  featureLineCount: number;
  appPurposeCount: number;
  targetUsersCount: number;
  coreFeatureCount: number;
  useCaseCount: number;
  painPointCount: number;
  competitorRepeatedTermCount: number;
  promptSectionCount: number;
  rawDescriptionExcerptLength: number;
  promptCharCount: number;
  promptApproxTokenCount: number;
  fallbackReason: DiscoveryProviderAttemptFailureReason | null;
};

function dedupeKeywords(keywords: string[]) {
  const seen = new Set<string>();
  return keywords.filter((keyword) => {
    const normalized = normalizeKeyword(keyword);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function keywordContainsExcludedBrandToken(keyword: string, excludedBrandTokens: Set<string>) {
  if (excludedBrandTokens.size === 0) {
    return false;
  }

  return tokenize(keyword).some((token) => excludedBrandTokens.has(token));
}

function getApproxPromptTokenCount(prompt: string) {
  return Math.ceil(prompt.length / 4);
}

function getDiscoveryRefinementTemperature(mode: DiscoveryMode) {
  return 0.65;
}

function parseKeywordArrayResponse(text: string) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter((keyword): keyword is string => typeof keyword === 'string');
    }
  } catch {}

  const arrayStart = trimmed.indexOf('[');
  const arrayEnd = trimmed.lastIndexOf(']');
  if (arrayStart === -1 || arrayEnd <= arrayStart) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1));
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed.filter((keyword): keyword is string => typeof keyword === 'string');
  } catch {
    return null;
  }
}

function sanitizeRefinedKeywords(
  keywords: string[],
  excludedBrandTokens: Set<string>,
  mode: DiscoveryMode,
) {
  return dedupeKeywords(
    keywords
      .filter(isDiscoveryKeywordCandidate)
      .filter((keyword) => !keywordContainsExcludedBrandToken(keyword, excludedBrandTokens)),
  ).slice(0, DISCOVERY_REFINEMENT_LIMITS[mode].outputKeywordLimit);
}

function getDiscoveryPrimaryModel(mode: DiscoveryMode) {
  return mode === 'deep'
    ? DISCOVERY_PRIMARY_MODEL_DEEP
    : DISCOVERY_PRIMARY_MODEL_FAST;
}

function getDiscoveryGroqModel(mode: DiscoveryMode, provider: 'primary' | 'fallback') {
  if (provider === 'fallback') {
    return DISCOVERY_FALLBACK_MODEL;
  }
  return getDiscoveryPrimaryModel(mode);
}

async function generateGroqKeywordList(
  prompt: string,
  mode: DiscoveryMode,
  provider: 'primary' | 'fallback' = 'primary',
) {
  if (!groqClient) {
    return null;
  }

  let lastError: unknown = null;
  const model = getDiscoveryGroqModel(mode, provider);
  for (let attempt = 0; attempt <= DISCOVERY_REFINEMENT_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await groqClient.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'Return only a valid JSON array of keyword strings.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: getDiscoveryRefinementTemperature(mode),
        max_tokens: DISCOVERY_REFINEMENT_LIMITS[mode].outputTokenLimit,
      });
      return parseKeywordArrayResponse(response.choices[0]?.message?.content || '');
    } catch (error) {
      lastError = error;
      const retryable = isUnavailableLikeError(error) || isTimeoutLikeError(error);
      const delayMs = DISCOVERY_REFINEMENT_RETRY_DELAYS_MS[attempt];
      if (retryable && typeof delayMs === 'number') {
        await sleep(delayMs);
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Groq keyword refinement failed.');
}

async function generateGeminiDiscoveryKeywordList(prompt: string, mode: DiscoveryMode) {
  if (!genai) {
    return null;
  }

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= DISCOVERY_REFINEMENT_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await genai.models.generateContent({
        model: DISCOVERY_GEMINI_REPAIR_MODEL,
        contents: prompt,
        config: {
          temperature: getDiscoveryRefinementTemperature(mode),
          maxOutputTokens: DISCOVERY_REFINEMENT_LIMITS[mode].outputTokenLimit,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
      });
      return parseKeywordArrayResponse(response.text || '');
    } catch (error) {
      lastError = error;
      const retryable = isUnavailableLikeError(error) || isTimeoutLikeError(error);
      const delayMs = DISCOVERY_REFINEMENT_RETRY_DELAYS_MS[attempt];
      if (retryable && typeof delayMs === 'number') {
        await sleep(delayMs);
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Gemini keyword refinement failed.');
}

async function runDiscoveryProviderAttempt(input: {
  mode: DiscoveryMode;
  prompt: string;
  provider: DiscoveryProviderName;
  groqTier?: 'primary' | 'fallback';
}): Promise<DiscoveryProviderAttempt> {
  if (input.provider === 'groq') {
    if (!groqClient) {
      return { result: null, failureReason: 'unconfigured' };
    }
    try {
      const groqTier = input.groqTier || 'primary';
      const keywords = await generateGroqKeywordList(input.prompt, input.mode, groqTier);
      if (!keywords) {
        return { result: null, failureReason: 'invalid_json' };
      }
      if (keywords.length === 0) {
        return { result: null, failureReason: 'empty_output' };
      }
      return {
        result: {
          keywords,
          provider: 'groq',
          model: getDiscoveryGroqModel(input.mode, groqTier),
        },
        failureReason: null,
      };
    } catch (error) {
      return {
        result: null,
        error,
        failureReason: isTimeoutLikeError(error) ? 'timeout' : 'provider_error',
      };
    }
  }

  if (!genai) {
    return { result: null, failureReason: 'unconfigured' };
  }
  try {
    const keywords = await generateGeminiDiscoveryKeywordList(input.prompt, input.mode);
    if (!keywords) {
      return { result: null, failureReason: 'invalid_json' };
    }
    if (keywords.length === 0) {
      return { result: null, failureReason: 'empty_output' };
    }
    return {
      result: {
        keywords,
        provider: 'gemini',
        model: DISCOVERY_GEMINI_REPAIR_MODEL,
      },
      failureReason: null,
    };
  } catch (error) {
    return {
      result: null,
      error,
      failureReason: isTimeoutLikeError(error) ? 'timeout' : 'provider_error',
    };
  }
}

async function refineKeywordsWithModel(
  context: DiscoveryRefinementContext,
  rawKeywords: string[],
  mode: DiscoveryMode,
  competitorRepeatedTerms: string[],
  excludedBrandTokens?: string[],
  options?: { force?: boolean },
): Promise<DiscoveryRefinementCacheEntry> {
  const refinementPoolLimit = DISCOVERY_PROFILES[mode].keywordLimit;
  const normalizedExcludedBrandTokens = (excludedBrandTokens || []).slice().sort((a, b) => a.localeCompare(b));
  let activeLimits: DiscoveryPromptLimits = { ...DISCOVERY_REFINEMENT_LIMITS[mode] };
  let promptKeywords = compactSharedDiscoveryPromptCandidates(
    rawKeywords,
    activeLimits.promptCandidateLimit,
  );
  let { sections, counts } = buildSharedDiscoveryPromptSections({
    context,
    limits: activeLimits,
    candidateKeywords: promptKeywords,
    competitorRepeatedTerms,
    excludedBrandTokens: normalizedExcludedBrandTokens,
  });
  let prompt = buildSharedDiscoveryRefinementPrompt({
    context,
    mode,
    limits: activeLimits,
    sections,
  });
  let promptCharCount = prompt.length;
  let promptApproxTokenCount = getApproxPromptTokenCount(prompt);
  const promptSoftTargetTokens = DISCOVERY_PROMPT_SOFT_TARGET_TOKENS[mode];

  if (promptApproxTokenCount < promptSoftTargetTokens) {
    activeLimits = {
      ...activeLimits,
      ...DISCOVERY_PROMPT_FLOOR_LIMITS[mode],
    };
    promptKeywords = compactSharedDiscoveryPromptCandidates(
      rawKeywords,
      activeLimits.promptCandidateLimit,
    );
    ({ sections, counts } = buildSharedDiscoveryPromptSections({
      context,
      limits: activeLimits,
      candidateKeywords: promptKeywords,
      competitorRepeatedTerms,
      excludedBrandTokens: normalizedExcludedBrandTokens,
    }));
    prompt = buildSharedDiscoveryRefinementPrompt({
      context,
      mode,
      limits: activeLimits,
      sections,
    });
    promptCharCount = prompt.length;
    promptApproxTokenCount = getApproxPromptTokenCount(prompt);
  }

  const normalizedContext = {
    title: normalizeKeyword(context.title),
    category: normalizeKeyword(context.category || ''),
    developer: normalizeKeyword(context.developer || ''),
    store: context.store,
    country: normalizeCountryCode(context.country, 'us'),
    sections,
    mode,
  };
  const cacheKey = JSON.stringify({
    cacheVersion: DISCOVERY_CACHE_VERSION,
    type: 'keyword-refinement-v2',
    ...normalizedContext,
  });
  const cached = keywordRefinementCache.get<DiscoveryRefinementCacheEntry>(cacheKey);
  if (!options?.force && cached) {
    console.log(
      `[keyword-refine] cache=hit mode=${mode} provider=${cached.providerUsed || 'local'} model=${cached.modelUsed || 'none'} raw=${cached.rawCount} prompt=${cached.promptCandidateCount} sections=${cached.promptSectionCount} purpose=${cached.appPurposeCount} users=${cached.targetUsersCount} features=${cached.featureLineCount} core=${cached.coreFeatureCount} useCases=${cached.useCaseCount} pain=${cached.painPointCount} competitorTerms=${cached.competitorRepeatedTermCount} rawExcerpt=${cached.rawDescriptionExcerptLength} promptChars=${cached.promptCharCount} promptTokens=${cached.promptApproxTokenCount} modelOut=${cached.modelCount} sanitized=${cached.sanitizedModelCount} fallbackReason=${cached.fallbackReason || 'none'} fallbackAdded=${cached.fallbackAddedCount}`,
    );
    return cached;
  }

  const excludedBrandTokenSet = new Set(sections.excludedBrandTokens);

  let providerUsed: DiscoveryProviderName | null = null;
  let modelUsed: string | null = null;
  let fallbackReason: DiscoveryProviderAttemptFailureReason | null = null;
  let modelKeywords: string[] = [];

  if (promptKeywords.length > 0) {
    const primaryAttempt = await runDiscoveryProviderAttempt({
      prompt,
      mode,
      provider: 'groq',
      groqTier: 'primary',
    });
    if (primaryAttempt.result) {
      const sanitizedPrimary = sanitizeRefinedKeywords(
        primaryAttempt.result.keywords,
        excludedBrandTokenSet,
        mode,
      );
      // A valid 120B response is authoritative even when it is shorter than
      // the preferred pool size. Use 20B only when the primary truly fails.
      if (sanitizedPrimary.length > 0) {
        providerUsed = primaryAttempt.result.provider;
        modelUsed = primaryAttempt.result.model;
        modelKeywords = sanitizedPrimary;
      } else {
        fallbackReason =
          sanitizedPrimary.length === 0 ? 'empty_output' : 'insufficient_output';
      }
    } else {
      fallbackReason = primaryAttempt.failureReason;
    }

    if (!modelKeywords.length) {
      const fallbackAttempt = await runDiscoveryProviderAttempt({
        prompt,
        mode,
        provider: 'groq',
        groqTier: 'fallback',
      });
      if (fallbackAttempt.result) {
        const sanitizedFallback = sanitizeRefinedKeywords(
          fallbackAttempt.result.keywords,
          excludedBrandTokenSet,
          mode,
        );
        if (sanitizedFallback.length >= DISCOVERY_REFINEMENT_LIMITS[mode].minimumUsableCount) {
          providerUsed = fallbackAttempt.result.provider;
          modelUsed = fallbackAttempt.result.model;
          modelKeywords = sanitizedFallback;
        } else if (!fallbackReason) {
          fallbackReason =
            sanitizedFallback.length === 0 ? 'empty_output' : 'insufficient_output';
        }
      } else if (!fallbackReason) {
        fallbackReason = fallbackAttempt.failureReason;
      }

      if (!modelKeywords.length) {
        const repairAttempt = await runDiscoveryProviderAttempt({
          prompt,
          mode,
          provider: 'gemini',
        });
        if (repairAttempt.result) {
          const sanitizedRepair = sanitizeRefinedKeywords(
            repairAttempt.result.keywords,
            excludedBrandTokenSet,
            mode,
          );
          if (sanitizedRepair.length >= DISCOVERY_REFINEMENT_LIMITS[mode].minimumUsableCount) {
            providerUsed = repairAttempt.result.provider;
            modelUsed = repairAttempt.result.model;
            modelKeywords = sanitizedRepair;
          } else if (!fallbackReason) {
            fallbackReason =
              sanitizedRepair.length === 0 ? 'empty_output' : 'insufficient_output';
          }
        } else if (!fallbackReason) {
          fallbackReason = repairAttempt.failureReason;
        }
      }
    }
  }

  const primaryKeywords = modelKeywords.slice(0, refinementPoolLimit);
  const seen = new Set(primaryKeywords.map((keyword) => normalizeKeyword(keyword)));
  const fallbackKeywords: string[] = [];

  for (const keyword of dedupeKeywords(rawKeywords.filter(isDiscoveryKeywordCandidate))) {
    if (keywordContainsExcludedBrandToken(keyword, excludedBrandTokenSet)) {
      continue;
    }
    const normalized = normalizeKeyword(keyword);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    fallbackKeywords.push(keyword);
    if (primaryKeywords.length + fallbackKeywords.length >= refinementPoolLimit) {
      break;
    }
  }

  const payload: DiscoveryRefinementCacheEntry = {
    keywords: [...primaryKeywords, ...fallbackKeywords],
    rawCount: rawKeywords.length,
    modelCount: modelKeywords.length,
    sanitizedModelCount: modelKeywords.length,
    fallbackAddedCount: fallbackKeywords.length,
    providerUsed,
    modelUsed,
    promptCandidateCount: promptKeywords.length,
    featureLineCount: counts.featureLineCount,
    appPurposeCount: counts.appPurposeCount,
    targetUsersCount: counts.targetUsersCount,
    coreFeatureCount: counts.coreFeatureCount,
    useCaseCount: counts.useCaseCount,
    painPointCount: counts.painPointCount,
    competitorRepeatedTermCount: counts.competitorRepeatedTermCount,
    promptSectionCount: counts.promptSectionCount,
    rawDescriptionExcerptLength: counts.rawDescriptionExcerptLength,
    promptCharCount,
    promptApproxTokenCount,
    fallbackReason,
  };

  console.log(
    `[keyword-refine] cache=miss mode=${mode} provider=${providerUsed || 'local'} model=${modelUsed || 'none'} raw=${rawKeywords.length} prompt=${promptKeywords.length} sections=${counts.promptSectionCount} purpose=${counts.appPurposeCount} users=${counts.targetUsersCount} features=${counts.featureLineCount} core=${counts.coreFeatureCount} useCases=${counts.useCaseCount} pain=${counts.painPointCount} competitorTerms=${counts.competitorRepeatedTermCount} rawExcerpt=${counts.rawDescriptionExcerptLength} promptChars=${promptCharCount} promptTokens=${promptApproxTokenCount} modelOut=${modelKeywords.length} sanitized=${modelKeywords.length} fallbackReason=${fallbackReason || 'none'} fallbackAdded=${fallbackKeywords.length}`,
  );

  keywordRefinementCache.set(cacheKey, payload);
  return payload;
}

function getDiscoveryCacheIdentity(input: {
  appId: string;
  title: string;
  description?: string;
  category?: string;
  developer?: string;
  store: StoreType;
  country: string;
}) {
  return {
    appId: String(input.appId),
    title: input.title,
    description: input.description || '',
    category: input.category || '',
    developer: input.developer || '',
    store: input.store,
    country: input.country,
  };
}

function trimDiscoveryCandidateCacheEntry(
  entry: DiscoveryCandidateCacheEntry,
  mode: DiscoveryMode,
): DiscoveryCandidateCacheEntry {
  if (mode === 'deep') {
    return entry;
  }

  const fastProfile = DISCOVERY_PROFILES.fast;

  return {
    ...entry,
    completeness: 'fast',
    rankedCandidates: entry.rankedCandidates.slice(0, fastProfile.keywordLimit),
    candidateCount: Math.min(entry.candidateCount, fastProfile.keywordLimit),
  };
}

function toDiscoveryFeatureQuality(
  features: ReturnType<typeof extractKeywordFeatures>,
): DiscoveryFeatureQuality {
  return {
    exactTitleMatch: features?.exactTitleMatch || 0,
    exactTitleSegment: features?.exactTitleSegment || 0,
    orderedTitleCoverage: features?.orderedTitleCoverage || 0,
    titleCoverage: features?.titleCoverage || 0,
    appTitleCoverage: features?.appTitleCoverage || 0,
    descriptionCoverage: features?.descriptionCoverage || 0,
    genericCoverage: features?.genericCoverage || 0,
    semanticCoverage: features?.semanticCoverage || 0,
    categorySemanticCoverage: features?.categorySemanticCoverage || 0,
    sourceStrength: features?.sourceStrength || 0,
  };
}

function rankDiscoveryMetricCandidates(
  input: {
    title: string;
    description?: string;
    category?: string;
    developer?: string;
    store: StoreType;
    country: string;
    mode: DiscoveryMode;
  },
  profile: DiscoveryProfile,
  signalContext: Awaited<ReturnType<typeof buildKeywordSignals>>,
  refinedKeywords: string[],
) {
  const seen = new Set<string>();
  const uniqueKeywords = [input.title, ...refinedKeywords].filter((keyword) => {
    const normalized = normalizeKeyword(keyword);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  const metricCandidates: DiscoveryMetricCandidate[] = uniqueKeywords.map((keyword, index) => {
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

  return metricCandidates
    .sort((a, b) => {
      if (b.baseline.relevance !== a.baseline.relevance) return b.baseline.relevance - a.baseline.relevance;
      if (a.baseline.difficulty !== b.baseline.difficulty) return a.baseline.difficulty - b.baseline.difficulty;
      if (b.baseline.demand !== a.baseline.demand) return b.baseline.demand - a.baseline.demand;
      return a.keyword.length - b.keyword.length;
    })
    .slice(0, profile.keywordLimit);
}

function buildDiscoveryPayloadFromCacheEntry(
  entry: DiscoveryResultCacheEntry,
  mode: DiscoveryMode,
) {
  const profile = DISCOVERY_PROFILES[mode];
  const candidatePool = entry.rankedCandidates.slice(0, profile.keywordLimit);
  const outcomeByKeyword = new Map(
    entry.checkedOutcomes.map((outcome) => [normalizeKeyword(outcome.keyword), outcome]),
  );
  const validRankings = candidatePool
    .map((candidate) => outcomeByKeyword.get(normalizeKeyword(candidate.keyword)))
    .filter(
      (outcome): outcome is DiscoveryCheckedCandidateOutcome =>
        Boolean(outcome) && outcome.rank > 0 && outcome.rank <= profile.searchDepth,
    );

  const rankings = selectDiscoveryDiverseRankings(
    validRankings,
    mode,
    profile.searchDepth,
    profile.finalRankingLimit,
  )
    .map(({ keyword, rank, demand, volume, difficulty, relevance, confidence }) => ({
      keyword,
      rank,
      demand,
      volume,
      difficulty,
      relevance,
      confidence,
      verificationStatus: 'verified' as const,
    }))

  const rankedKeywordSet = new Set(rankings.map((ranking) => normalizeKeyword(ranking.keyword)));
  const suggestionCandidates = candidatePool
    .filter((candidate) => !rankedKeywordSet.has(normalizeKeyword(candidate.keyword)));
  const suggestions = selectDiscoveryDiverseSuggestions(
    suggestionCandidates,
    mode,
    profile.finalRankingLimit,
  )
    .map(({ keyword, baseline }) => ({
      keyword,
      demand: baseline.demand,
      volume: baseline.volume,
      difficulty: baseline.difficulty,
      relevance: baseline.relevance,
      confidence: baseline.confidence,
      verificationStatus: 'unverified' as const,
    }));

  return {
    mode,
    checkedKeywords: Math.min(entry.checkedKeywords, candidatePool.length),
    candidateCount: candidatePool.length,
    searchDepth: profile.searchDepth,
    failedLookups: entry.failedLookups,
    timedOutLookups: entry.timedOutLookups || 0,
    rankings,
    suggestions,
    status: resolveDiscoveryResponseStatus({
      warnings: buildDiscoveryWarnings({
        competitorMiningStatus: entry.competitorMiningStatus,
        failedLookups: entry.failedLookups,
        timedOutLookups: entry.timedOutLookups || 0,
      }),
    }),
    warnings: buildDiscoveryWarnings({
      competitorMiningStatus: entry.competitorMiningStatus,
      failedLookups: entry.failedLookups,
      timedOutLookups: entry.timedOutLookups || 0,
    }),
    verification: {
      attempted: Math.min(entry.checkedKeywords, candidatePool.length),
      succeeded: Math.max(0, Math.min(entry.checkedKeywords, candidatePool.length) - (entry.failedLookups || 0)),
      failed: Math.max(0, (entry.failedLookups || 0) - (entry.timedOutLookups || 0)),
      timedOut: entry.timedOutLookups || 0,
    },
  };
}

function getReusableDiscoveryOutcome(
  cachedEntry: DiscoveryResultCacheEntry | undefined,
  keyword: string,
  requestedSearchDepth: number,
) {
  if (!cachedEntry) {
    return null;
  }

  const existing = cachedEntry.checkedOutcomes.find(
    (outcome) => normalizeKeyword(outcome.keyword) === normalizeKeyword(keyword),
  );
  if (!existing) {
    return null;
  }

  if (cachedEntry.searchDepth >= requestedSearchDepth) {
    return existing;
  }

  if (existing.rank > 0 && existing.rank <= cachedEntry.searchDepth) {
    return existing;
  }

  return null;
}

async function buildRankedDiscoveryCandidates(
  input: {
    appId: string;
    title: string;
    description?: string;
    category?: string;
    developer?: string;
    store: StoreType;
    country: string;
    mode: DiscoveryMode;
  },
  profile: DiscoveryProfile,
  options?: { force?: boolean },
) {
  const candidateBuildStartedAt = Date.now();
  const cacheIdentity = getDiscoveryCacheIdentity(input);
  const cacheKey = getDiscoveryCandidateCacheKey(cacheIdentity);
  const cached = discoveryCandidateCache.get<DiscoveryCandidateCacheEntry>(cacheKey);
  if (!options?.force && cached && (cached.completeness === 'deep' || input.mode === 'fast')) {
    return trimDiscoveryCandidateCacheEntry(cached, input.mode);
  }

  const signalContext = await buildKeywordSignals({
    title: input.title,
    description: input.description,
    category: input.category,
    developer: input.developer,
    store: input.store,
    country: input.country,
  }, input.mode, profile, {
    force: options?.force,
    competitorDeadlineAt: getUpstreamDeadline(profile.competitorMiningTimeoutMs),
  });
  const rawKeywords = getSortedCandidateTerms(
    signalContext.candidateWeights,
    signalContext.ownTitleTokens,
  ).map(([term]) => term);

  const refined = await refineKeywordsWithModel(
    {
      title: input.title,
      description: input.description,
      category: input.category,
      developer: input.developer,
      store: input.store,
      country: input.country,
    },
    rawKeywords,
    input.mode,
    signalContext.competitorRepeatedTerms,
    Array.from(signalContext.competitorBrandTokens).sort((a, b) => a.localeCompare(b)),
    options,
  );
  const rankedCandidates = rankDiscoveryMetricCandidates(
    input,
    profile,
    signalContext,
    refined.keywords,
  );

  const payload: DiscoveryCandidateCacheEntry = {
    completeness: input.mode,
    rankedCandidates,
    rawCount: refined.rawCount,
    modelCount: refined.modelCount,
    sanitizedModelCount: refined.sanitizedModelCount,
    candidateCount: rankedCandidates.length,
    providerUsed: refined.providerUsed,
    modelUsed: refined.modelUsed,
    promptCandidateCount: refined.promptCandidateCount,
    featureLineCount: refined.featureLineCount,
    fallbackReason: refined.fallbackReason,
    competitorMiningStatus: signalContext.competitorMiningStatus,
    candidateBuildMs: Date.now() - candidateBuildStartedAt,
  };

  console.log(
    `[discovery-candidates] mode=${input.mode} provider=${refined.providerUsed || 'local'} model=${refined.modelUsed || 'none'} raw=${refined.rawCount} prompt=${refined.promptCandidateCount} features=${refined.featureLineCount} modelOut=${refined.modelCount} sanitized=${refined.sanitizedModelCount} admitted=${rankedCandidates.length} competitorMining=${signalContext.competitorMiningStatus} buildMs=${payload.candidateBuildMs} fallbackReason=${refined.fallbackReason || 'none'}`,
  );

  discoveryCandidateCache.set(cacheKey, payload);
  return trimDiscoveryCandidateCacheEntry(payload, input.mode);
}

async function buildLocalDiscoveryFallbackPayload(input: {
  appId: string;
  title: string;
  description?: string;
  category?: string;
  developer?: string;
  store: StoreType;
  country: string;
  mode: DiscoveryMode;
  force?: boolean;
}) {
  const profile = DISCOVERY_PROFILES[input.mode];
  const signalContext = await buildKeywordSignals(input, input.mode, profile, {
    force: input.force,
    skipCompetitorMining: true,
  });
  const rawKeywords = getSortedCandidateTerms(
    signalContext.candidateWeights,
    signalContext.ownTitleTokens,
  ).map(([term]) => term);
  const rankedCandidates = rankDiscoveryMetricCandidates(
    input,
    profile,
    signalContext,
    rawKeywords,
  );
  const suggestions = selectDiscoveryDiverseSuggestions(
    rankedCandidates,
    input.mode,
    profile.finalRankingLimit,
  ).map(({ keyword, baseline }) => ({
    keyword,
    demand: baseline.demand,
    volume: baseline.volume,
    difficulty: baseline.difficulty,
    relevance: baseline.relevance,
    confidence: baseline.confidence,
    verificationStatus: 'unverified' as const,
  }));
  const warnings = buildDiscoveryWarnings({
    fallback: true,
    competitorMiningStatus: 'skipped',
  });

  return {
    mode: input.mode,
    checkedKeywords: 0,
    candidateCount: rankedCandidates.length,
    searchDepth: profile.searchDepth,
    failedLookups: 0,
    timedOutLookups: 0,
    rankings: [],
    suggestions,
    status: resolveDiscoveryResponseStatus({
      fallback: true,
      warnings,
    }),
    warnings,
    verification: {
      attempted: 0,
      succeeded: 0,
      failed: 0,
      timedOut: 0,
    },
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
  force?: boolean;
}) {
  const startedAt = Date.now();
  const profile = DISCOVERY_PROFILES[input.mode];
  const cacheIdentity = getDiscoveryCacheIdentity(input);
  const cacheKey = getDiscoveryRankedResultCacheKey(cacheIdentity);
  const cached = discoveryCache.get<DiscoveryResultCacheEntry>(cacheKey);
  if (!input.force && cached && (cached.completeness === 'deep' || cached.completeness === input.mode)) {
    return buildDiscoveryPayloadFromCacheEntry(cached, input.mode);
  }

  const candidateSet = await buildRankedDiscoveryCandidates(input, profile, { force: input.force });
  const rankedCandidates = candidateSet.rankedCandidates;
  const candidatesToCheck = rankedCandidates.slice(0, profile.rankingCheckLimit);
  const validRankings: DiscoveryCheckedCandidateOutcome[] = [];
  const checkedOutcomes: DiscoveryCheckedCandidateOutcome[] = [];
  const reusableOutcomeByKeyword = new Map<string, DiscoveryCheckedCandidateOutcome>();

  if (!input.force && cached) {
    cached.checkedOutcomes.forEach((outcome) => {
      const reusableOutcome = getReusableDiscoveryOutcome(
        cached,
        outcome.keyword,
        profile.searchDepth,
      );
      if (!reusableOutcome) {
        return;
      }

      reusableOutcomeByKeyword.set(
        normalizeKeyword(reusableOutcome.keyword),
        reusableOutcome,
      );
    });
  }

  let checkedKeywords = 0;
  let failedLookups = 0;
  let timedOutLookups = 0;
  const verificationStartedAt = Date.now();

  for (let i = 0; i < candidatesToCheck.length; i += profile.batchSize) {
    const batch = candidatesToCheck.slice(i, i + profile.batchSize);
    const batchResults = await Promise.all(
      batch.map(async (candidate, batchIndex) => {
        try {
          const reusableOutcome = reusableOutcomeByKeyword.get(
            normalizeKeyword(candidate.keyword),
          );
          if (reusableOutcome) {
            return reusableOutcome;
          }

          let rank: number;
          const candidateIndex = i + batchIndex;
          const verificationDeadlineAt = getUpstreamDeadline(profile.verificationTimeoutMs);

          if (input.store === 'android') {
            const allowProxyVerification = shouldUseDiscoveryProxyVerification(
              candidate,
              candidateIndex,
              profile,
            );
            rank = await runWithDeadline(
              () => getGooglePlayRankWithFallback(
                candidate.keyword,
                input.appId,
                input.country,
                profile.initialSearchDepth,
                verificationDeadlineAt,
                'The app store search is taking too long. Please try again.',
                'discovery',
                {
                  proxyFallbackOnNotRanked: allowProxyVerification,
                },
              ),
              verificationDeadlineAt,
              'The app store search is taking too long. Please try again.',
            );

            if (
              rank === -1 &&
              shouldExtendDiscoveryDepth(candidate, candidateIndex, profile)
            ) {
              rank = await runWithDeadline(
                () => getGooglePlayRankWithFallback(
                  candidate.keyword,
                  input.appId,
                  input.country,
                  profile.searchDepth,
                  verificationDeadlineAt,
                  'The app store search is taking too long. Please try again.',
                  'discovery',
                  {
                    proxyFallbackOnNotRanked: allowProxyVerification,
                  },
                ),
                verificationDeadlineAt,
                'The app store search is taking too long. Please try again.',
              );
            }
          } else {
            const allowProxyVerification = shouldUseDiscoveryProxyVerification(
              candidate,
              candidateIndex,
              profile,
            );
            rank = await getAppleAppStoreRankWithFallback(
              candidate.keyword,
              input.appId,
              input.country,
              profile.initialSearchDepth,
              verificationDeadlineAt,
              'The app store search is taking too long. Please try again.',
              'discovery',
              {
                proxyFallbackOnNotRanked: allowProxyVerification,
              },
            );

            if (
              rank === -1 &&
              shouldExtendDiscoveryDepth(candidate, candidateIndex, profile)
            ) {
              rank = await getAppleAppStoreRankWithFallback(
                candidate.keyword,
                input.appId,
                input.country,
                profile.searchDepth,
                verificationDeadlineAt,
                'The app store search is taking too long. Please try again.',
                'discovery',
                {
                  proxyFallbackOnNotRanked: allowProxyVerification,
                },
              );
            }
          }

          if (rank !== -1) {
            console.log(`[discovery] Found rank ${rank} for "${candidate.keyword}" (${input.store}/${input.country})`);
          }

          return {
            keyword: candidate.keyword,
            rank,
            demand: candidate.baseline.demand,
            volume: candidate.baseline.volume,
            difficulty: candidate.baseline.difficulty,
            relevance: candidate.baseline.relevance,
            confidence: candidate.baseline.confidence,
            displayQuality: candidate.displayQuality,
            featureQuality: toDiscoveryFeatureQuality(candidate.features),
          };
        } catch (error) {
          console.warn(`Discovery ranking lookup failed for "${candidate.keyword}"`, error);
          if (isTimeoutLikeError(error)) {
            timedOutLookups += 1;
          }
          failedLookups += 1;
          return null;
        }
      }),
    );

    checkedKeywords += batch.length;
    checkedOutcomes.push(
      ...batchResults.filter((result): result is DiscoveryCheckedCandidateOutcome => Boolean(result)),
    );
    validRankings.push(
      ...batchResults.filter(
        (result): result is DiscoveryCheckedCandidateOutcome =>
          Boolean(result) && result.rank > 0 && result.rank <= profile.searchDepth,
      ),
    );

    const displayedRankingCount = selectDiscoveryDiverseRankings(
      validRankings,
      input.mode,
      profile.searchDepth,
      profile.finalRankingLimit,
    ).length;

    if (displayedRankingCount >= profile.finalRankingLimit) {
      break;
    }
  }

  const rankings = selectDiscoveryDiverseRankings(
    validRankings,
    input.mode,
    profile.searchDepth,
    profile.finalRankingLimit,
  )
    .map(({ keyword, rank, demand, volume, difficulty, relevance, confidence }) => ({
      keyword,
      rank,
      demand,
      volume,
      difficulty,
      relevance,
      confidence,
      verificationStatus: 'verified' as const,
    }));

  // Always show unranked candidates as suggestions (not just when rankings=0)
  const rankedKeywordSet = new Set(rankings.map((ranking) => normalizeKeyword(ranking.keyword)));
  const suggestionCandidates = rankedCandidates
    .filter((candidate) => !rankedKeywordSet.has(normalizeKeyword(candidate.keyword)))
  const suggestions = selectDiscoveryDiverseSuggestions(
    suggestionCandidates,
    input.mode,
    profile.finalRankingLimit,
  )
    .map(({ keyword, baseline }) => ({
      keyword,
      demand: baseline.demand,
      volume: baseline.volume,
      difficulty: baseline.difficulty,
      relevance: baseline.relevance,
      confidence: baseline.confidence,
      verificationStatus: 'unverified' as const,
    }));

  const warnings = buildDiscoveryWarnings({
    competitorMiningStatus: candidateSet.competitorMiningStatus,
    failedLookups,
    timedOutLookups,
  });
  const verification = {
    attempted: checkedKeywords,
    succeeded: checkedOutcomes.length,
    failed: Math.max(0, failedLookups - timedOutLookups),
    timedOut: timedOutLookups,
  };

  const payload = {
    mode: input.mode,
    checkedKeywords,
    candidateCount: candidateSet.candidateCount,
    searchDepth: profile.searchDepth,
    failedLookups,
    timedOutLookups,
    rankings,
    suggestions,
    status: resolveDiscoveryResponseStatus({ warnings }),
    warnings,
    verification,
    timings: {
      candidateMs: candidateSet.candidateBuildMs || 0,
      verificationMs: Date.now() - verificationStartedAt,
      totalMs: Date.now() - startedAt,
    },
  };

  console.log(
    `[discovery-result] mode=${input.mode} checked=${checkedKeywords} checkedLimit=${candidatesToCheck.length} candidates=${rankedCandidates.length} rankings=${rankings.length} suggestions=${suggestions.length} verificationSucceeded=${verification.succeeded} failed=${verification.failed} timedOut=${verification.timedOut} competitorMining=${candidateSet.competitorMiningStatus || 'ok'} status=${payload.status} totalMs=${payload.timings.totalMs}`,
  );

  discoveryCache.set(cacheKey, {
    completeness: input.mode,
    rankedCandidates,
    checkedOutcomes,
    checkedKeywords,
    candidateCount: candidateSet.candidateCount,
    searchDepth: profile.searchDepth,
    failedLookups,
    timedOutLookups,
    loadedAt: new Date().toISOString(),
    competitorMiningStatus: candidateSet.competitorMiningStatus,
  } satisfies DiscoveryResultCacheEntry);
  return payload;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
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
      const event = client.webhooks.unwrap(rawBody, {
        headers,
        key: webhookKey,
      });
      if (dodoWebhookEventCache.has(eventKey)) {
        return res.json({ received: true, duplicate: true });
      }

      const adminDb = getFirebaseAdminDb();
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }
      const claim = await claimDodoWebhookEvent(adminDb, eventKey);
      if (claim.status === 'duplicate') {
        dodoWebhookEventCache.set(eventKey, true);
        return res.json({ received: true, duplicate: true });
      }
      if (claim.status === 'processing') {
        return res.status(409).json({
          received: true,
          processing: true,
          retryable: true,
          error: 'Webhook event is already being processed.',
        });
      }

      try {
        if (isDodoSubscriptionWebhookEvent(event)) {
          await applyDodoSubscriptionEvent(event, {
            webhookId: headers['webhook-id'],
            webhookTimestamp: headers['webhook-timestamp'],
          });
        }

        await finalizeDodoWebhookEvent(
          claim.eventRef,
          typeof event?.type === 'string' ? event.type : 'unknown',
        );
        dodoWebhookEventCache.set(eventKey, true);
        return res.json({ received: true });
      } catch (error) {
        await markDodoWebhookEventError(claim.eventRef, error).catch(() => undefined);
        throw error;
      }
    } catch (error) {
      console.error('[dodo] Webhook processing failed:', error);
      return sendApiError(res, error, 'Failed to process Dodo webhook.');
    }
  });

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: false }));
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
  const publicBillingRateLimit = createRateLimiter('public-billing', 120, 60 * 1000);
  const authedLightRateLimit = createRateLimiter('authed-light', 120, 60 * 1000);
  const authedRefreshRateLimit = createRateLimiter('authed-refresh', 20, 60 * 1000);
  const authedCheckoutRateLimit = createRateLimiter('authed-checkout', 6, 15 * 60 * 1000);
  const authedPortalRateLimit = createRateLimiter('authed-portal', 12, 15 * 60 * 1000);
  const authedNotificationTestRateLimit = createRateLimiter('authed-push-test', 5, 10 * 60 * 1000);
  const authedEmailTestRateLimit = createRateLimiter('authed-email-test', 5, 10 * 60 * 1000);
  const authedAnnouncementEmailRateLimit = createRateLimiter('authed-announcement-email', 6, 10 * 60 * 1000);

  app.get('/api/billing/pricing', publicBillingRateLimit, async (_req, res) => {
    try {
      res.json(await loadBillingPricingCatalog());
    } catch (error) {
      return sendApiError(res, error, 'Failed to load billing pricing.');
    }
  });

  app.get('/api/billing/status', authedLightRateLimit, async (req, res) => {
    try {
      const decodedToken = await verifyFirebaseRequest(req);
      const adminDb = getFirebaseAdminDb();
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }

      const snapshot = await adminDb.collection('users').doc(decodedToken.uid).get();
      let userData = snapshot.data() as UserTrackingDocument | undefined;
      const pricingCatalog = await loadBillingPricingCatalog();
      const normalizedUserState = normalizeUserTrackingDocument(userData);
      let resolvedBilling = resolveBillingAccess(userData, {
        fallbackProductPlanId: resolvePlanIdFromProductId(userData?.dodoProductId),
      });
      let pendingPlanId = resolvedBilling.pendingPlanId;
      let pendingInterval = resolvedBilling.pendingInterval;
      if (
        pendingPlanId &&
        resolvedBilling.entitlementState !== 'checkout_pending'
      ) {
        const clearedAt = new Date().toISOString();
        const stalePendingCleanup: DocumentData = {
          pendingPlanId: FieldValue.delete(),
          pendingInterval: FieldValue.delete(),
          updatedAt: clearedAt,
        };
        await adminDb.collection('users').doc(decodedToken.uid).set(
          stalePendingCleanup,
          { merge: true },
        );

        userData = userData
          ? {
              ...userData,
              pendingPlanId: undefined,
              pendingInterval: undefined,
              updatedAt: clearedAt,
            }
          : userData;
        resolvedBilling = resolveBillingAccess(userData, {
          fallbackProductPlanId: resolvePlanIdFromProductId(userData?.dodoProductId),
        });
        pendingPlanId = resolvedBilling.pendingPlanId;
        pendingInterval = resolvedBilling.pendingInterval;
      }
      const planLimits = getResolvedPlanLimits(userData);
      const planEntitlements = getResolvedPlanEntitlements(userData);
      const usage = getNormalizedPlanUsage(normalizedUserState, planLimits);

      res.json({
        ...pricingCatalog,
        customerPortalAvailable: Boolean(pricingCatalog.configured && userData?.dodoCustomerId),
        accessState: resolvedBilling.accessState,
        isPremium: resolvedBilling.hasPaidAccess,
        effectivePlanId: resolvedBilling.effectivePlanId,
        entitlementState: resolvedBilling.entitlementState,
        providerStatus: resolvedBilling.providerStatus,
        billingReviewRequired: Boolean(userData?.billingReviewRequired),
        billingReviewReason: userData?.billingReviewReason || null,
        accountStatus: userData?.accountStatus || 'active',
        subscriptionTier: resolvedBilling.subscribedPlanId,
        subscribedPlanId: resolvedBilling.subscribedPlanId,
        subscriptionInterval: userData?.subscriptionInterval || null,
        subscriptionStatus: resolvedBilling.providerStatus,
        pendingPlanId,
        pendingInterval,
        currentPeriodEnd: resolvedBilling.currentPeriodEnd,
        cancelAtPeriodEnd: resolvedBilling.cancelAtPeriodEnd,
        planLimits,
        planEntitlements,
        usage,
        transition:
          resolvedBilling.entitlementState === 'checkout_pending' && pendingPlanId
            ? {
                type: 'checkout_pending',
                fromPlanId: resolvedBilling.effectivePlanId,
                toPlanId: pendingPlanId,
                effectiveAt: null,
                pending: true,
              }
            : resolvedBilling.entitlementState === 'paid_canceling'
              ? {
                  type: 'cancel_at_period_end',
                  fromPlanId: resolvedBilling.subscribedPlanId,
                  toPlanId: 'free',
                  effectiveAt: resolvedBilling.currentPeriodEnd,
                  pending: true,
                }
              : null,
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
      const resolvedBilling = resolveBillingAccess(userData, {
        fallbackProductPlanId: resolvePlanIdFromProductId(userData?.dodoProductId),
      });
      const isDowngradeAttempt =
        resolvedBilling.hasPaidAccess &&
        getBillingPlanRank(planId) < getBillingPlanRank(resolvedBilling.subscribedPlanId);
      if (isDowngradeAttempt) {
        throw createBadRequestError(
          'Downgrades are not available from checkout. Use the billing portal or contact vantalumstudio@gmail.com.',
        );
      }
      if (resolvedBilling.entitlementState === 'checkout_pending') {
        throw new ApiError(
          'Billing activation is already pending for this account.',
          {
            status: 409,
            code: 'BILLING_TRANSITION',
            retryable: false,
            meta: {
              pendingPlanId: resolvedBilling.pendingPlanId,
              pendingInterval: resolvedBilling.pendingInterval,
            },
          },
        );
      }
      if (resolvedBilling.hasPaidAccess) {
        if (!client) {
          throw createConfigurationError('Dodo customer portal is not configured on the server.');
        }
        const customerId = userData?.dodoCustomerId?.trim();
        if (!customerId) {
          throw new ApiError(
            'Manage plan changes from the billing portal for this account.',
            {
              status: 409,
              code: 'BILLING_TRANSITION',
              retryable: false,
            },
          );
        }
        const portalSession = await client.customers.customerPortal.create(customerId, {
          return_url: getBillingReturnUrl(req),
        });
        res.json({
          action: 'open_portal',
          portalUrl: portalSession.link,
        });
        return;
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
        providerSubscriptionStatus: 'pending' as const,
        subscriptionStatus: 'pending' as const,
        subscriptionUpdatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } satisfies UserTrackingDocument, { merge: true });

      res.json({
        action: 'checkout',
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
      const deleteRequestedAt = new Date().toISOString();

      if (snapshot.exists) {
        await userDocRef.set({
          accountStatus: 'deleting',
          updatedAt: deleteRequestedAt,
        } satisfies Partial<UserTrackingDocument>, { merge: true });
      }

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
          weeklyReportSettings: FieldValue.delete(),
          alertRules: FieldValue.delete(),
          notificationSettings: FieldValue.delete(),
          migratedFromLocalAt: FieldValue.delete(),
          accountStatus: 'deleting',
          deletedAt: deleteRequestedAt,
          authDeletedAt: FieldValue.delete(),
          authDeleteFailedAt: FieldValue.delete(),
          authDeleteError: FieldValue.delete(),
          isPremium: false,
          pendingPlanId: FieldValue.delete(),
          pendingInterval: FieldValue.delete(),
          billingReviewRequired: true,
          billingReviewReason: 'account_deleted',
          updatedAt: deleteRequestedAt,
        };
        await userDocRef.set(
          deleteWorkspaceDataPayload,
          { merge: true },
        );
      } else if (snapshot.exists) {
        await userDocRef.delete();
      }

      try {
        await adminAuth.deleteUser(decodedToken.uid);
      } catch (error) {
        if (snapshot.exists) {
          await userDocRef.set(
            {
              accountStatus: 'deleting',
              authDeleteFailedAt: new Date().toISOString(),
              authDeleteError:
                error instanceof Error ? error.message.slice(0, 500) : 'Unknown auth deletion failure.',
              updatedAt: new Date().toISOString(),
            } satisfies Partial<UserTrackingDocument>,
            { merge: true },
          );
        }
        throw error;
      }
      if (hasRetainedAccountState(userData)) {
        await userDocRef.set(
          {
            accountStatus: 'deleted',
            authDeletedAt: new Date().toISOString(),
            authDeleteFailedAt: FieldValue.delete(),
            authDeleteError: FieldValue.delete(),
            updatedAt: new Date().toISOString(),
          } satisfies DocumentData,
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

  app.put('/api/account/email-preferences', authedLightRateLimit, async (req, res) => {
    try {
      const decodedToken = await verifyFirebaseRequest(req);
      const adminDb = getFirebaseAdminDb();
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }

      const announcementEmailsEnabled = req.body?.announcementEmailsEnabled;
      const alertEmailsEnabled = req.body?.alertEmailsEnabled;
      const weeklyReportEnabled = req.body?.weeklyReportEnabled;
      const hasAnnouncementPreference =
        typeof announcementEmailsEnabled === 'boolean';
      const hasAlertPreference = typeof alertEmailsEnabled === 'boolean';
      const hasWeeklyPreference = typeof weeklyReportEnabled === 'boolean';

      if (
        !hasAnnouncementPreference &&
        !hasAlertPreference &&
        !hasWeeklyPreference
      ) {
        throw createBadRequestError(
          'At least one of announcementEmailsEnabled, alertEmailsEnabled, or weeklyReportEnabled must be a boolean.',
        );
      }

      const updatedAt = new Date().toISOString();
      const userSnapshot = await adminDb.collection('users').doc(decodedToken.uid).get();
      const userData = userSnapshot.data() as UserTrackingDocument | undefined;
      const updates: DocumentData = {
        updatedAt,
      };

      if (hasAnnouncementPreference) {
        updates.announcementEmailsEnabled = announcementEmailsEnabled;
        updates.announcementEmailsUpdatedAt = updatedAt;
      }
      if (hasAlertPreference) {
        if (alertEmailsEnabled && !hasBillingFeature(userData, 'alerts')) {
          requireBillingFeature(userData, 'alerts');
        }
        updates.alertEmailsEnabled = alertEmailsEnabled;
        updates.alertEmailsUpdatedAt = updatedAt;
      }
      if (hasWeeklyPreference) {
        if (weeklyReportEnabled && !hasBillingFeature(userData, 'weeklyReports')) {
          requireBillingFeature(userData, 'weeklyReports');
        }
        updates['weeklyReportSettings.enabled'] = weeklyReportEnabled;
        updates['weeklyReportSettings.lastAttemptedAt'] = updatedAt;
      }

      await adminDb.collection('users').doc(decodedToken.uid).set(
        updates,
        { merge: true },
      );

      res.json({
        ...(hasAnnouncementPreference
          ? { announcementEmailsEnabled }
          : {}),
        ...(hasAlertPreference ? { alertEmailsEnabled } : {}),
        ...(hasWeeklyPreference ? { weeklyReportEnabled } : {}),
        updatedAt,
      });
    } catch (error) {
      return sendApiError(res, error, 'Failed to save email preferences.');
    }
  });

  app.put('/api/user-state', authedLightRateLimit, async (req, res) => {
    try {
      const decodedToken = await verifyFirebaseRequest(req);
      const adminDb = getFirebaseAdminDb();
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }

      const requestBody = readRequiredObjectRecord(req.body, 'body');
      const nextStateInput =
        'state' in requestBody
          ? readRequiredObjectRecord(requestBody.state, 'state')
          : requestBody;
      const requestedBaseStateVersion =
        typeof requestBody.baseStateVersion === 'number' &&
        Number.isFinite(requestBody.baseStateVersion)
          ? Math.max(0, Math.trunc(requestBody.baseStateVersion))
          : 0;
      const userDocRef = adminDb.collection('users').doc(decodedToken.uid);
      const snapshot = await userDocRef.get();
      const currentUserData = snapshot.data() as UserTrackingDocument | undefined;
      const currentState = normalizeUserTrackingDocument(currentUserData);
      if (requestedBaseStateVersion !== currentState.stateVersion) {
        throw new ApiError(
          'Your account data changed in another session. Refresh and try again.',
          {
            status: 409,
            code: 'STALE_USER_STATE',
            retryable: false,
          },
        );
      }
      const nextState = normalizeUserTrackingDocument(nextStateInput);
      const mergedState = mergeEditableUserTrackingState(currentState, nextState);
      const planLimits = getResolvedPlanLimits(currentUserData);
      const serverUpdatedAt = new Date().toISOString();
      const nextStateVersion = currentState.stateVersion + 1;

      const competitorStateChanged =
        JSON.stringify(currentState.competitorGroups) !== JSON.stringify(mergedState.competitorGroups) ||
        JSON.stringify(currentState.competitorTrackedKeywords) !== JSON.stringify(mergedState.competitorTrackedKeywords) ||
        JSON.stringify(currentState.competitorGroupSnapshots) !== JSON.stringify(mergedState.competitorGroupSnapshots) ||
        JSON.stringify(currentState.competitorAsoLatestSnapshots) !== JSON.stringify(mergedState.competitorAsoLatestSnapshots);
      const alertRulesChanged =
        JSON.stringify(currentState.alertRules) !== JSON.stringify(mergedState.alertRules);
      const pushNotificationSettingEnabled =
        mergedState.notificationSettings.pushEnabled &&
        !currentState.notificationSettings.pushEnabled;
      const weeklyReportsEnabled =
        mergedState.weeklyReportSettings.enabled &&
        !currentState.weeklyReportSettings.enabled;

      if (competitorStateChanged) {
        requireBillingFeature(currentUserData, 'competitorTracking');
      }
      if (alertRulesChanged) {
        requireBillingFeature(currentUserData, 'alerts');
      }
      if (pushNotificationSettingEnabled) {
        requireBillingFeature(currentUserData, 'browserPush');
      }
      if (weeklyReportsEnabled) {
        requireBillingFeature(currentUserData, 'weeklyReports');
      }

      assertPlanLimitTransition(currentState, mergedState, planLimits);
      const retainedRankHistory = await archiveAndTrimTrackedRankHistory(
        userDocRef,
        mergedState.rankHistory,
      );
      const retainedCompetitorRankHistory = await archiveAndTrimCompetitorRankHistory(
        userDocRef,
        mergedState.competitorRankHistory,
      );
      const planEntitlements = getResolvedPlanEntitlements(currentUserData);
      const shouldRestoreAlertEmails =
        planEntitlements.alertDelivery &&
        currentUserData?.alertEmailsEnabled === false &&
        alertRulesChanged &&
        mergedState.alertRules.some((rule) => rule.enabled && rule.channels.email);

      await userDocRef.set({
        bookmarks: mergedState.bookmarks,
        trackedApps: mergedState.trackedApps,
        trackedKeywords: mergedState.trackedKeywords,
        rankHistory: retainedRankHistory,
        appAnalysisSnapshots: mergedState.appAnalysisSnapshots,
        competitorGroups: mergedState.competitorGroups,
        competitorGroupSnapshots: mergedState.competitorGroupSnapshots,
        competitorAsoLatestSnapshots: mergedState.competitorAsoLatestSnapshots,
        competitorTrackedKeywords: mergedState.competitorTrackedKeywords,
        competitorRankHistory: retainedCompetitorRankHistory,
        trackingSchedule: mergedState.schedule,
        weeklyReportSettings: mergedState.weeklyReportSettings,
        alertRules: mergedState.alertRules,
        notificationSettings: mergedState.notificationSettings,
        ...(shouldRestoreAlertEmails
          ? {
            alertEmailsEnabled: true,
            alertEmailsUpdatedAt: serverUpdatedAt,
          }
          : {}),
        ...(mergedState.migratedFromLocalAt
          ? { migratedFromLocalAt: mergedState.migratedFromLocalAt }
          : {}),
        stateVersion: nextStateVersion,
        serverUpdatedAt,
        updatedAt: serverUpdatedAt,
      } satisfies UserTrackingDocument, { merge: true });

      res.json({
        success: true,
        planLimits,
        usage: getNormalizedPlanUsage(mergedState, planLimits),
        stateVersion: nextStateVersion,
        serverUpdatedAt,
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
      const userDocRef = adminDb.collection('users').doc(decodedToken.uid);
      const token = readRequiredString(req.body?.token, 'token', 4096);
      const platform = readOptionalString(req.body?.platform, 'platform', 80) || 'web';
      const userAgent = readOptionalString(req.body?.userAgent, 'userAgent', 500) || 'unknown';
      const registeredAt = new Date().toISOString();
      // Tokens are typically very long base64url strings.
      // Firebase document IDs can be up to 1500 bytes and allow most characters except forward slash.
      // We will hash the token to ensure a safe, fixed-length document ID.
      const tokenId = crypto.createHash('sha256').update(token).digest('hex');

      const currentUserSnapshot = await userDocRef.get();
      const currentUserData = currentUserSnapshot.data() as UserTrackingDocument | undefined;
      requireBillingFeature(currentUserData, 'browserPush');
      const currentNotificationSettings = normalizeNotificationSettings(
        currentUserData?.notificationSettings,
      );
      const { lastToken: _legacyLastToken, ...currentNotificationSettingsSafe } =
        currentNotificationSettings;

      await userDocRef
        .collection(USER_PUSH_TOKENS_COLLECTION)
        .doc(tokenId)
        .set({
          token,
          platform,
          userAgent,
          lastSeenAt: registeredAt,
        }, { merge: true });

      await userDocRef.set({
        notificationSettings: {
          ...currentNotificationSettingsSafe,
          pushEnabled: true,
          permission: 'granted',
          lastTokenId: tokenId,
          tokenUpdatedAt: registeredAt,
        },
        updatedAt: registeredAt,
      } satisfies Pick<UserTrackingDocument, 'notificationSettings' | 'updatedAt'>, {
        merge: true,
      });

      res.json({ ok: true, success: true, tokenId });
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
      const userSnapshot = await userDocRef.get();
      const userData = userSnapshot.data() as UserTrackingDocument | undefined;
      requireBillingFeature(userData, 'browserPush');
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
      const userSnapshot = await userDocRef.get();
      const userData = userSnapshot.data() as UserTrackingDocument | undefined;
      requireBillingFeature(userData, 'browserPush');
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

  app.post('/api/admin/email/test', authedEmailTestRateLimit, async (req, res) => {
    try {
      const decodedToken = await verifyFirebaseRequest(req);
      const requestedBy = assertAdminEmailAccess(decodedToken.email);
      if (!resend) {
        throw createConfigurationError('Resend is not configured on the server.');
      }

      const requestedRecipient = normalizeEmailAddress(readOptionalString(req.body?.to, 'to', 320));
      const recipient = requestedRecipient || requestedBy;
      if (!isValidEmailAddress(recipient)) {
        throw createBadRequestError('A valid recipient email address is required.');
      }
      const sender = getConfiguredResendSender();
      if (!sender) {
        throw createConfigurationError('RESEND_FROM_EMAIL is not configured as a valid email address.');
      }

      const subjectInput = readOptionalString(req.body?.subject, 'subject', 200).trim();
      const messageInput = readOptionalString(req.body?.message, 'message', 2000).trim();
      const subject = subjectInput || 'Rank Analyzer Pro test email';
      const message = messageInput || 'Email delivery is working for this environment.';
      const sentAt = new Date().toISOString();

      const result = await resend.emails.send({
        from: `Rank Analyzer Pro <${sender}>`,
        to: recipient,
        subject,
        text: buildTestEmailText({
          requestedBy,
          message,
          sentAt,
        }),
        html: buildTestEmailHtml({
          requestedBy,
          message,
          sentAt,
        }),
      });
      if (result.error) {
        const resendMessage = typeof result.error.message === 'string' && result.error.message.trim()
          ? result.error.message.trim()
          : 'Resend rejected the message.';
        throw new ApiError(`Failed to deliver test email: ${resendMessage}`, {
          status: 502,
          code: 'UPSTREAM_UNAVAILABLE',
          retryable: true,
        });
      }
      const emailId = getResendEmailId(result);
      if (!emailId) {
        console.warn(`[email] Test email to ${recipient} returned no message id.`);
      }

      res.json({
        ok: true,
        to: recipient,
        subject,
        sentAt,
        ...(emailId ? { id: emailId } : {}),
      });
    } catch (error) {
      return sendApiError(res, error, 'Failed to send test email.');
    }
  });

  app.get('/api/admin/email/campaigns', authedAnnouncementEmailRateLimit, async (req, res) => {
    try {
      const decodedToken = await verifyFirebaseRequest(req);
      assertAdminEmailAccess(decodedToken.email);
      const adminDb = getFirebaseAdminDb();
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }

      const snapshot = await getAnnouncementEmailCampaignsCollection(adminDb)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      const campaigns = snapshot.docs.map(
        (docSnapshot) => docSnapshot.data() as AnnouncementEmailCampaignDocument,
      );
      res.json({ campaigns });
    } catch (error) {
      return sendApiError(res, error, 'Failed to load announcement campaigns.');
    }
  });

  app.post('/api/admin/email/campaigns', authedAnnouncementEmailRateLimit, async (req, res) => {
    try {
      const decodedToken = await verifyFirebaseRequest(req);
      const createdBy = assertAdminEmailAccess(decodedToken.email);
      const adminDb = getFirebaseAdminDb();
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }

      const subject = readRequiredString(req.body?.subject, 'subject', 200);
      const message = readRequiredString(req.body?.message, 'message', 6000);
      const audience = readAnnouncementAudience(req.body?.audience);
      const buttonLabel = readOptionalString(req.body?.buttonLabel, 'buttonLabel', 120).trim();
      const buttonUrl = readOptionalUrlString(req.body?.buttonUrl, 'buttonUrl', 1000);
      if ((buttonLabel && !buttonUrl) || (!buttonLabel && buttonUrl)) {
        throw createBadRequestError('buttonLabel and buttonUrl must be provided together.');
      }

      const campaignId = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const campaign: AnnouncementEmailCampaignDocument = {
        campaignId,
        subject,
        message,
        audience,
        ...(buttonLabel && buttonUrl ? { buttonLabel, buttonUrl } : {}),
        status: 'draft',
        createdAt,
        updatedAt: createdAt,
        createdBy,
      };

      await getAnnouncementEmailCampaignsCollection(adminDb).doc(campaignId).set(campaign);
      res.status(201).json(campaign);
    } catch (error) {
      return sendApiError(res, error, 'Failed to create announcement campaign.');
    }
  });

  app.post('/api/admin/email/campaigns/:campaignId/send', authedAnnouncementEmailRateLimit, async (req, res) => {
    try {
      const decodedToken = await verifyFirebaseRequest(req);
      assertAdminEmailAccess(decodedToken.email);
      const adminDb = getFirebaseAdminDb();
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }

      const campaignId = readRequiredString(req.params.campaignId, 'campaignId', 120);
      const campaignDocRef = getAnnouncementEmailCampaignsCollection(adminDb).doc(campaignId);
      const snapshot = await campaignDocRef.get();
      if (!snapshot.exists) {
        throw createBadRequestError('Announcement campaign was not found.');
      }

      const campaign = snapshot.data() as AnnouncementEmailCampaignDocument;
      if (campaign.status === 'sent') {
        throw createBadRequestError('Announcement campaign has already been sent.');
      }

      const result = await sendAnnouncementCampaign(adminDb, campaignDocRef);
      res.json(result);
    } catch (error) {
      return sendApiError(res, error, 'Failed to send announcement campaign.');
    }
  });

  type EmailPreferenceAction =
    | {
      href: string;
      label: string;
      primary?: boolean;
    }
    | {
      label: string;
      primary?: boolean;
      method: 'post';
      fields: Record<string, string>;
    };

  const sendEmailPreferenceHtml = (
    res: express.Response,
    status: number,
    title: string,
    message: string,
    actions: EmailPreferenceAction[] = [],
  ) => {
    const actionsHtml = actions.length
      ? `<div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px;">
          ${actions
            .map(
              (action) => {
                const baseStyle = `display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 18px; border-radius: 999px; border: 1px solid ${action.primary ? '#2563eb' : '#cbd5e1'}; background: ${action.primary ? '#2563eb' : '#ffffff'}; color: ${action.primary ? '#ffffff' : '#0f172a'}; font-size: 15px; font-weight: 600; text-decoration: none;`;
                if ('href' in action) {
                  return `<a href="${escapeAlertEmailHtml(action.href)}" style="${baseStyle}">${escapeAlertEmailHtml(action.label)}</a>`;
                }
                const fieldsHtml = Object.entries(action.fields)
                  .map(
                    ([key, value]) =>
                      `<input type="hidden" name="${escapeAlertEmailHtml(key)}" value="${escapeAlertEmailHtml(value)}" />`,
                  )
                  .join('');
                return `<form method="post" style="margin: 0;">${fieldsHtml}<button type="submit" style="${baseStyle}; cursor: pointer;">${escapeAlertEmailHtml(action.label)}</button></form>`;
              },
            )
            .join('')}
        </div>`
      : '';
    res.status(status).type('html').send(`
      <html>
        <body style="font-family: Arial, sans-serif; max-width: 640px; margin: 48px auto; padding: 0 16px; color: #0f172a; background: #f8fafc;">
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 28px; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08);">
            <p style="margin: 0 0 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.28em; color: #2563eb; text-transform: uppercase;">Email preferences</p>
            <h1 style="font-size: 28px; margin: 0 0 12px;">${escapeAlertEmailHtml(title)}</h1>
            <p style="margin: 0; font-size: 16px; line-height: 1.7; color: #334155;">${escapeAlertEmailHtml(message)}</p>
            ${actionsHtml}
          </div>
        </body>
      </html>
    `);
  };

  const buildEmailPreferenceQuery = (input: {
    kind: EmailPreferenceKind;
    uid: string;
    email: string;
    token: string;
    campaignId?: string;
    set?: 'on' | 'off';
  }) => {
    const query = new URLSearchParams();
    query.set('kind', input.kind);
    query.set('uid', input.uid);
    query.set('email', input.email);
    query.set('token', input.token);
    if (input.campaignId) {
      query.set('campaignId', input.campaignId);
    }
    if (input.set) {
      query.set('set', input.set);
    }
    return query.toString();
  };

  const getEmailPreferenceMeta = (kind: EmailPreferenceKind) => {
    switch (kind) {
      case 'alert':
        return {
          title: 'Alert emails',
          enabledMessage: 'Keyword and competitor alert emails are currently enabled for this account.',
          disabledMessage: 'Keyword and competitor alert emails are currently turned off for this account.',
          turnedOn: 'Alert emails have been turned on for this account.',
          turnedOff: 'Alert emails have been turned off for this account.',
          enableLabel: 'Turn on alert emails',
          disableLabel: 'Turn off alert emails',
        };
      case 'weekly':
        return {
          title: 'Weekly report emails',
          enabledMessage: 'Weekly report summary emails are currently enabled for this account.',
          disabledMessage: 'Weekly report summary emails are currently turned off for this account.',
          turnedOn: 'Weekly report emails have been turned on for this account.',
          turnedOff: 'Weekly report emails have been turned off for this account.',
          enableLabel: 'Turn on weekly emails',
          disableLabel: 'Turn off weekly emails',
        };
      default:
        return {
          title: 'Announcement emails',
          enabledMessage: 'Announcement emails are currently enabled for this account.',
          disabledMessage: 'Announcement emails are currently turned off for this account.',
          turnedOn: 'Announcement emails have been turned on for this account.',
          turnedOff: 'Announcement emails have been turned off for this account.',
          enableLabel: 'Turn on announcement emails',
          disableLabel: 'Turn off announcement emails',
        };
    }
  };

  const updateEmailPreferenceSetting = async (input: {
    userDocRef: DocumentReference<DocumentData>;
    kind: EmailPreferenceKind;
    enabled: boolean;
    campaignId?: string;
  }) => {
    const updatedAt = new Date().toISOString();
    if (input.kind === 'alert') {
      await input.userDocRef.set({
        alertEmailsEnabled: input.enabled,
        alertEmailsUpdatedAt: updatedAt,
        updatedAt,
      } satisfies Partial<UserTrackingDocument>, { merge: true });
      return;
    }
    if (input.kind === 'weekly') {
      await input.userDocRef.set(
        {
          weeklyReportSettings: {
            enabled: input.enabled,
            lastAttemptedAt: updatedAt,
          },
          updatedAt,
        } as DocumentData,
        { merge: true },
      );
      return;
    }
    await input.userDocRef.set({
      announcementEmailsEnabled: input.enabled,
      announcementEmailsUpdatedAt: updatedAt,
      ...(input.campaignId ? { lastAnnouncementEmailCampaignId: input.campaignId } : {}),
      updatedAt,
    } satisfies Partial<UserTrackingDocument>, { merge: true });
  };

  app.get('/api/email/preferences', strictRateLimit, async (req, res) => {
    try {
      const adminDb = getFirebaseAdminDb();
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }

      const uid = readRequiredString(req.query.uid, 'uid', 200);
      const email = normalizeEmailAddress(readRequiredString(req.query.email, 'email', 320));
      const token = readRequiredString(req.query.token, 'token', 300);
      const kind: EmailPreferenceKind =
        req.query.kind === 'alert' || req.query.kind === 'weekly'
          ? req.query.kind
          : 'announcement';
      const campaignId = readOptionalString(req.query.campaignId, 'campaignId', 120).trim();
      const setValue = readOptionalString(req.query.set, 'set', 12).trim().toLowerCase();
      if (!email || !isValidEmailAddress(email)) {
        throw createBadRequestError('A valid email address is required.');
      }
      if (!verifyEmailPreferenceToken(kind, uid, email, token)) {
        throw createForbiddenError('This preferences link is invalid or has expired.');
      }
      if (setValue && setValue !== 'on' && setValue !== 'off') {
        throw createBadRequestError('The requested preference update is invalid.');
      }

      const userDocRef = adminDb.collection('users').doc(uid);
      const userSnapshot = await userDocRef.get();
      const userData = userSnapshot.data() as UserTrackingDocument | undefined;
      let enabled =
        kind === 'alert'
          ? userData?.alertEmailsEnabled !== false
          : kind === 'weekly'
            ? userData?.weeklyReportSettings?.enabled !== false
            : userData?.announcementEmailsEnabled !== false;

      const meta = getEmailPreferenceMeta(kind);
      if (setValue === 'on' || setValue === 'off') {
        const confirmationQuery = buildEmailPreferenceQuery({
          kind,
          uid,
          email,
          token,
          ...(campaignId ? { campaignId } : {}),
        });
        return sendEmailPreferenceHtml(
          res,
          200,
          meta.title,
          setValue === 'on'
            ? `Confirm turning on ${meta.title.toLowerCase()} for this account.`
            : `Confirm turning off ${meta.title.toLowerCase()} for this account.`,
          [
            {
              href: `${ALERT_EMAIL_APP_URL}/?viewMode=reports&period=7d`,
              label: 'Open dashboard',
              primary: true,
            },
            {
              href: `${ALERT_EMAIL_APP_URL}/api/email/preferences?${confirmationQuery}`,
              label: 'Cancel',
            },
            {
              method: 'post',
              label: setValue === 'on' ? meta.enableLabel : meta.disableLabel,
              fields: {
                kind,
                uid,
                email,
                token,
                ...(campaignId ? { campaignId } : {}),
                set: setValue,
              },
            },
          ],
        );
      }

      const nextQuery = buildEmailPreferenceQuery({
        kind,
        uid,
        email,
        token,
        ...(campaignId ? { campaignId } : {}),
        set: enabled ? 'off' : 'on',
      });
      return sendEmailPreferenceHtml(
        res,
        200,
        meta.title,
        enabled ? meta.enabledMessage : meta.disabledMessage,
        [
          {
            href: `${ALERT_EMAIL_APP_URL}/?viewMode=reports&period=7d`,
            label: 'Open dashboard',
            primary: true,
          },
          {
            href: `${ALERT_EMAIL_APP_URL}/api/email/preferences?${nextQuery}`,
            label: enabled ? meta.disableLabel : meta.enableLabel,
          },
        ],
      );
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'The email preferences request could not be completed.';
      return sendEmailPreferenceHtml(res, 400, 'Unable to manage preferences', message);
    }
  });

  app.post('/api/email/preferences', strictRateLimit, async (req, res) => {
    try {
      const adminDb = getFirebaseAdminDb();
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }

      const uid = readRequiredString(req.body?.uid, 'uid', 200);
      const email = normalizeEmailAddress(readRequiredString(req.body?.email, 'email', 320));
      const token = readRequiredString(req.body?.token, 'token', 300);
      const kind: EmailPreferenceKind =
        req.body?.kind === 'alert' || req.body?.kind === 'weekly'
          ? req.body.kind
          : 'announcement';
      const campaignId = readOptionalString(req.body?.campaignId, 'campaignId', 120).trim();
      const setValue = readRequiredString(req.body?.set, 'set', 12).trim().toLowerCase();
      if (!email || !isValidEmailAddress(email)) {
        throw createBadRequestError('A valid email address is required.');
      }
      if (!verifyEmailPreferenceToken(kind, uid, email, token)) {
        throw createForbiddenError('This preferences link is invalid or has expired.');
      }
      if (setValue !== 'on' && setValue !== 'off') {
        throw createBadRequestError('The requested preference update is invalid.');
      }

      const enabled = setValue === 'on';
      const userDocRef = adminDb.collection('users').doc(uid);
      await updateEmailPreferenceSetting({
        userDocRef,
        kind,
        enabled,
        ...(campaignId ? { campaignId } : {}),
      });

      const meta = getEmailPreferenceMeta(kind);
      const nextQuery = buildEmailPreferenceQuery({
        kind,
        uid,
        email,
        token,
        ...(campaignId ? { campaignId } : {}),
        set: enabled ? 'off' : 'on',
      });
      return sendEmailPreferenceHtml(
        res,
        200,
        meta.title,
        enabled ? meta.turnedOn : meta.turnedOff,
        [
          {
            href: `${ALERT_EMAIL_APP_URL}/?viewMode=reports&period=7d`,
            label: 'Open dashboard',
            primary: true,
          },
          {
            href: `${ALERT_EMAIL_APP_URL}/api/email/preferences?${nextQuery}`,
            label: enabled ? meta.disableLabel : meta.enableLabel,
          },
        ],
      );
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'The email preferences request could not be completed.';
      return sendEmailPreferenceHtml(res, 400, 'Unable to manage preferences', message);
    }
  });

  app.get('/api/email/unsubscribe', strictRateLimit, async (req, res) => {
    const sendHtml = (status: number, title: string, message: string) =>
      sendEmailPreferenceHtml(res, status, title, message);

    try {
      const adminDb = getFirebaseAdminDb();
      if (!adminDb) {
        throw createConfigurationError('Firebase Admin is not configured on the server.');
      }

      const uid = readRequiredString(req.query.uid, 'uid', 200);
      const email = normalizeEmailAddress(readRequiredString(req.query.email, 'email', 320));
      const token = readRequiredString(req.query.token, 'token', 300);
      const kind: EmailPreferenceKind =
        req.query.kind === 'alert' || req.query.kind === 'weekly'
          ? req.query.kind
          : 'announcement';
      const campaignId = readOptionalString(req.query.campaignId, 'campaignId', 120).trim();
      if (!email || !isValidEmailAddress(email)) {
        throw createBadRequestError('A valid email address is required.');
      }
      if (!verifyEmailPreferenceToken(kind, uid, email, token)) {
        throw createForbiddenError('This unsubscribe link is invalid or has expired.');
      }

      if (kind === 'alert' || kind === 'weekly') {
        const preferencesQuery = buildEmailPreferenceQuery({
          kind,
          uid,
          email,
          token,
          ...(campaignId ? { campaignId } : {}),
        });
        return res.redirect(
          302,
          `${ALERT_EMAIL_APP_URL}/api/email/preferences?${preferencesQuery}`,
        );
      }

      const updatedAt = new Date().toISOString();
      await adminDb.collection('users').doc(uid).set({
        announcementEmailsEnabled: false,
        announcementEmailsUpdatedAt: updatedAt,
        ...(campaignId ? { lastAnnouncementEmailCampaignId: campaignId } : {}),
        updatedAt,
      } satisfies Partial<UserTrackingDocument>, { merge: true });

      return sendHtml(200, 'You are unsubscribed', 'Announcement emails have been turned off for this account.');
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'The unsubscribe request could not be completed.';
      return sendHtml(400, 'Unable to unsubscribe', message);
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
      const planEntitlements = getResolvedPlanEntitlements(userData);
      const requestedTrackedKeywordIdentityKey = getTrackedKeywordIdentityKey({
        appId,
        keyword,
        store,
        country,
      });
      const existingTrackedKeyword =
        state.trackedKeywords.find(
          (entry) =>
            getTrackedKeywordIdentityKey(entry) === requestedTrackedKeywordIdentityKey,
        ) ||
        state.trackedKeywords.find((entry) =>
          getTrackedKeywordKey(entry) ===
            getTrackedKeywordKey({
              groupId,
              appId,
              keyword,
              store,
              country,
            }),
        );
      const trackedKeywordKey = getTrackedKeywordKey({
        groupId: existingTrackedKeyword?.groupId || groupId,
        appId,
        keyword,
        store,
        country,
      });
      const refreshTrackedKeywordRecordInput =
        existingTrackedKeyword ||
        ({
          groupId,
          keyword,
          appId,
          appTitle:
            state.trackedApps.find(
              (entry) => entry.appId === appId && entry.store === store,
            )?.title || appId,
          store,
          country,
          createdAt: new Date().toISOString(),
          lastRank: -1,
          lastChecked: new Date(0).toISOString(),
          lastCheckStatus: 'pending' as const,
        } satisfies TrackedKeywordRecord);
      const refreshableTrackedKeywords = existingTrackedKeyword
        ? state.trackedKeywords
        : state.trackedKeywords.concat(refreshTrackedKeywordRecordInput);
      const { activity } = getTrackedKeywordScopedState(
        {
          ...state,
          trackedKeywords: refreshableTrackedKeywords,
        },
        getResolvedPlanLimits(userData),
      );
      if (!activity.activeTrackedKeywordKeys.has(trackedKeywordKey)) {
        throw createBadRequestError(
          'This tracked keyword is paused because your current plan keyword limit has been reached.',
        );
      }

      const refreshResult = await refreshTrackedKeywordRecord(
        refreshTrackedKeywordRecordInput,
        rankingDepth,
      );
      const nextTrackedKeywords = refreshableTrackedKeywords.map((entry) =>
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
      const { updatedRules, createdEvents } =
        planEntitlements.alertRules || planEntitlements.alertDelivery
          ? await evaluateAndDispatchAlertRules(
              userDocRef,
              state.trackedKeywords,
              nextTrackedKeywords,
              state.alertRules,
              state.notificationSettings,
              createAlertRunKey('manual'),
            )
          : {
              updatedRules: state.alertRules,
              createdEvents: [] as AlertEvent[],
            };

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
      const userSnapshot = await adminDb.collection('users').doc(decodedToken.uid).get();
      const userData = userSnapshot.data() as UserTrackingDocument | undefined;
      requireBillingFeature(userData, 'alerts');
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
      requireBillingFeature(userData, 'competitorTracking');
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
      const userSnapshot = await adminDb.collection('users').doc(decodedToken.uid).get();
      const userData = userSnapshot.data() as UserTrackingDocument | undefined;
      requireBillingFeature(userData, 'alerts');
      const markAll = readOptionalBoolean(req.body?.markAll);
      const nowIso = new Date().toISOString();
      const userEventsRef = adminDb.collection('users').doc(decodedToken.uid).collection('alert_events');

      if (markAll) {
        const snapshot = await userEventsRef.where('readAt', '==', null).get();
        await patchDocumentRefsInBatches(
          adminDb,
          snapshot.docs.map((doc) => doc.ref),
          { readAt: nowIso },
        );
        res.json({ ok: true, success: true, updated: snapshot.size });
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
      const eventRefs = eventIds.map((eventId) => userEventsRef.doc(eventId));
      const snapshots = await adminDb.getAll(...eventRefs);
      const existingRefs = snapshots.filter((snapshot) => snapshot.exists).map((snapshot) => snapshot.ref);
      await patchDocumentRefsInBatches(
        adminDb,
        existingRefs,
        { readAt: nowIso },
      );
      res.json({
        ok: true,
        success: true,
        updated: existingRefs.length,
        missing: eventIds.length - existingRefs.length,
      });
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

      const force =
        req.query.force === 'true' ||
        req.query.force === '1';
      console.log(
        `[cron] Manual fallback trigger received. Starting keyword synchronization (force=${force}).`,
      );
      const now = new Date();
      const runKey = getGlobalTrackingRunKey(now);

      const userSummary = await runAndPersistAllUserTrackingSchedules(runKey, {
        force,
        trigger: 'manual',
      });

      res.json({
        status: 'success',
        timestamp: now.toISOString(),
        runKey,
        force,
        userSummary,
      });
    } catch (error: any) {
      console.error('[cron] Trigger failed:', error);
      return sendApiError(res, error, 'Cron task failed to execute.');
    }
  });

  app.post('/api/cron/recover', async (req, res) => {
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
      const runKey = getGlobalTrackingRunKey(now);
      const statusRef = adminDb.doc('system/dailyTracking');
      const statusSnapshot = await statusRef.get();
      const statusData = statusSnapshot.data() as DailyTrackingStatusRecord | undefined;
      if (hasActiveDailyTrackingLease(statusData, now)) {
        return res.status(409).json({
          status: 'running',
          timestamp: now.toISOString(),
          runKey,
          reason: 'run-still-in-flight',
          startedAt: statusData?.lastStartedAt,
          retryCount: statusData?.retryCount || 0,
          nextRetryAt: statusData?.leaseExpiresAt,
        });
      }

      console.log(`[cron] Recovery trigger received for ${runKey}. Running unresolved-only catch-up.`);
      const userSummary = await runAndPersistAllUserTrackingSchedules(runKey, {
        force: true,
        mode: 'unresolved_only',
        trigger: 'recovery',
      });

      return res.json({
        status: 'success',
        timestamp: now.toISOString(),
        runKey,
        mode: 'unresolved_only',
        userSummary,
      });
    } catch (error: any) {
      console.error('[cron] Recovery failed:', error);
      return sendApiError(res, error, 'Cron recovery failed to execute.');
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

      if (
        isCurrentRun &&
        (statusData?.retryCount || 0) >= GLOBAL_TRACKING_WATCHDOG_MAX_RETRIES
      ) {
        return res.json({
          status: statusData?.lastStatus || 'error',
          timestamp: now.toISOString(),
          expectedRunKey,
          dueAt,
          action: 'none',
          reason: 'max-retries-reached',
          retryCount: statusData?.retryCount || 0,
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
          mode: force ? 'unresolved_only' : 'full',
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
      await requireAuthenticatedBillingAccess(req);
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
      await requireAuthenticatedBillingAccess(req);
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
      await requireAuthenticatedBillingAccess(req);
      const title = readRequiredString(req.body?.title, 'title', 200);
      const description = readOptionalString(req.body?.description, 'description', 10000);
      const category = readOptionalString(req.body?.category, 'category', 200);
      const developer = readOptionalString(req.body?.developer, 'developer', 200);
      const storeType = readStoreType(req.body?.store);
      const country = readOptionalString(req.body?.country, 'country', 12) || 'us';
      const candidateSource = await buildKeywordCandidates({
        title,
        description,
        category,
        developer,
        store: storeType as StoreType,
        country: normalizeCountryCode(country, 'us'),
      }, 'deep', DISCOVERY_PROFILES.deep);
      const rawKeywords = candidateSource.keywords;
      const refined = await refineKeywordsWithModel(
        {
          title,
          description,
          category,
          developer,
          store: storeType as StoreType,
          country: normalizeCountryCode(country, 'us'),
        },
        rawKeywords,
        'deep',
        candidateSource.competitorRepeatedTerms,
        candidateSource.competitorBrandTokens,
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
    let discoveryInput: {
      appId: string;
      title: string;
      description?: string;
      category?: string;
      developer?: string;
      store: StoreType;
      country: string;
      mode: DiscoveryMode;
      force?: boolean;
    } | null = null;
    try {
      await requireAuthenticatedBillingAccess(req);
      appId = readRequiredString(req.body?.appId, 'appId', 160);
      const title = readRequiredString(req.body?.title, 'title', 200);
      const description = readOptionalString(req.body?.description, 'description', 10000);
      const category = readOptionalString(req.body?.category, 'category', 200);
      const developer = readOptionalString(req.body?.developer, 'developer', 200);
      storeType = readStoreType(req.body?.store);
      const country = readOptionalString(req.body?.country, 'country', 12) || 'us';
      const discoveryMode: DiscoveryMode = req.body?.mode === 'fast' ? 'fast' : 'deep';
      const force = req.body?.force === true;
      discoveryInput = {
        appId,
        title,
        description,
        category,
        developer,
        store: storeType as StoreType,
        country: normalizeCountryCode(country, 'us'),
        mode: discoveryMode,
        force,
      };
      let data;
      try {
        data = await discoverRankedKeywords(discoveryInput);
      } catch (error) {
        console.error(`Discovery error [appId=${appId}, store=${storeType}]:`, error);
        if (
          discoveryInput &&
          discoveryInput.title &&
          !(
            isApiError(error) &&
            (error.status === 400 || error.status === 401 || error.status === 403)
          )
        ) {
          const fallback = await buildLocalDiscoveryFallbackPayload(discoveryInput);
          return res.json(fallback);
        }
        throw error;
      }

      res.json(data);
    } catch (error) {
      console.error(`Discovery error [appId=${appId}, store=${storeType}]:`, error);
      return sendApiError(res, error, 'Keyword discovery is taking too long. Please try again.');
    }
  });

  // Vite middleware for development
  if (isDevelopment) {
    // Blog pages are static HTML and must be served before the custom Vite app fallback.
    app.use('/blog', express.static(path.join(process.cwd(), 'public', 'blog')));
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
    app.use(express.static(distPath, { extensions: ['html'] }));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const listenHost = '0.0.0.0';
  const { port } = await listenOnAvailablePort(app, PORT, listenHost);
  console.log(`Server running on http://localhost:${port}`);
}

startServer();
