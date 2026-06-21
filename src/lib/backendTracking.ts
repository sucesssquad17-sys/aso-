import {
  applicationDefault,
  cert,
  getApps,
  initializeApp as initializeAdminApp,
  type App as FirebaseAdminApp,
} from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  DEFAULT_GLOBAL_TRACKING_TIME,
  GLOBAL_TRACKING_TIMEZONE,
} from './trackingTime';

export type StoreType = 'android' | 'ios';
export type TrackedKeywordStatus = 'pending' | 'ok' | 'not_ranked' | 'error';

export type TrackedKeywordRecord = {
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

export type RankHistoryRecord = {
  groupId?: string;
  appId: string;
  keyword: string;
  store: StoreType;
  country: string;
  rank: number;
  timestamp: string;
  rankDepth?: number;
};

export type CompetitorTrackedKeywordAppRecord = {
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

export type CompetitorTrackedKeywordRecord = {
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

export type CompetitorRankHistoryRecord = {
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

export type TrackingSchedule = {
  enabled: boolean;
  time: string;
  timezone: string;
  lastRunAt?: string;
  lastRunKey?: string;
};

export type TrackingStateBase = {
  trackedKeywords: TrackedKeywordRecord[];
  rankHistory: RankHistoryRecord[];
  competitorTrackedKeywords: CompetitorTrackedKeywordRecord[];
  competitorRankHistory: CompetitorRankHistoryRecord[];
  schedule: TrackingSchedule;
};

export const TRACKING_REFRESH_CONCURRENCY = 1;
export const TRACKED_KEYWORD_RANKING_DEPTH = 100;
export const TRACKING_HISTORY_LIMIT = 5000;

function stripOuterQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function initializeFirebaseAdminAppFromEnv(): FirebaseAdminApp {
  const existingApp = getApps()[0];
  if (existingApp) {
    return existingApp;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    return initializeAdminApp({
      credential: applicationDefault(),
    });
  }

  return initializeAdminApp({
    credential: cert(JSON.parse(stripOuterQuotes(serviceAccountJson))),
  });
}

export function initializeFirebaseAdminFirestoreFromEnv(): Firestore {
  const firestore = getFirestore(initializeFirebaseAdminAppFromEnv());
  firestore.settings({ ignoreUndefinedProperties: true });
  return firestore;
}

export function getZonedDateParts(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return {
    year: String(parts.year),
    month: String(parts.month),
    day: String(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function normalizeTrackingSchedule(
  input: Partial<TrackingSchedule> | undefined,
  fallback: TrackingSchedule,
): TrackingSchedule {
  return {
    enabled:
      typeof input?.enabled === 'boolean' ? input.enabled : fallback.enabled,
    time:
      typeof input?.time === 'string' && /^\d{2}:\d{2}$/.test(input.time.trim())
        ? input.time.trim()
        : fallback.time,
    timezone:
      typeof input?.timezone === 'string' && input.timezone.trim()
        ? input.timezone.trim()
        : fallback.timezone,
    lastRunAt: typeof input?.lastRunAt === 'string' ? input.lastRunAt : undefined,
    lastRunKey: typeof input?.lastRunKey === 'string' ? input.lastRunKey : undefined,
  };
}

export function getScheduleRunKey(date: Date, schedule: TrackingSchedule) {
  const parts = getZonedDateParts(date, schedule.timezone);
  return `${parts.year}-${parts.month}-${parts.day}T${schedule.time}`;
}

export function isGlobalTrackingRunTime(
  date: Date,
  hours: readonly number[] = [9],
  timeZone = GLOBAL_TRACKING_TIMEZONE,
) {
  const parts = getZonedDateParts(date, timeZone);
  return parts.minute === 0 && hours.includes(parts.hour);
}

export function getGlobalTrackingRunKey(
  date: Date,
  time = DEFAULT_GLOBAL_TRACKING_TIME,
  timeZone = GLOBAL_TRACKING_TIMEZONE,
) {
  const parts = getZonedDateParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${time}`;
}

function getLegacyTrackingGroupId({
  appId,
  keyword,
  store,
}: Pick<TrackedKeywordRecord, 'appId' | 'keyword' | 'store'>) {
  return `legacy:${store}:${String(appId)}:${keyword.toLowerCase()}`;
}

export function resolveTrackingGroupId(
  candidate: Partial<TrackedKeywordRecord> | Pick<RankHistoryRecord, 'appId' | 'keyword' | 'store' | 'groupId'>,
) {
  return typeof candidate.groupId === 'string' && candidate.groupId.trim()
    ? candidate.groupId.trim()
    : getLegacyTrackingGroupId({
        appId: String(candidate.appId),
        keyword: String(candidate.keyword),
        store: candidate.store as StoreType,
      });
}

function getTrackingHistoryDayKey(
  entry: RankHistoryRecord,
  timeZone: string,
) {
  const parts = getZonedDateParts(new Date(entry.timestamp), timeZone);
  return `${resolveTrackingGroupId(entry)}:${entry.store}:${entry.country}:${entry.appId}:${entry.keyword.toLowerCase()}:${parts.year}-${parts.month}-${parts.day}`;
}

export function mergeRankHistory(
  existing: RankHistoryRecord[],
  incoming: RankHistoryRecord[],
  options?: {
    historyLimit?: number;
    timeZone?: string;
  },
) {
  const historyLimit = options?.historyLimit ?? TRACKING_HISTORY_LIMIT;
  const timeZone = options?.timeZone ?? GLOBAL_TRACKING_TIMEZONE;
  const byDayKey = new Map<string, RankHistoryRecord>();

  [...existing, ...incoming]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .forEach((entry) => {
      byDayKey.set(getTrackingHistoryDayKey(entry, timeZone), entry);
    });

  return Array.from(byDayKey.values())
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-historyLimit);
}

function getCompetitorTrackedKeywordKey(record: Pick<CompetitorTrackedKeywordRecord, 'groupId' | 'keyword'>) {
  return `${record.groupId}:${record.keyword.toLowerCase()}`;
}

export function mergeCompetitorTrackedKeywords(
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

function getCompetitorRankHistoryDayKey(
  entry: CompetitorRankHistoryRecord,
  timeZone: string,
) {
  const parts = getZonedDateParts(new Date(entry.timestamp), timeZone);
  return `${entry.trackedKeywordId}:${entry.appKey}:${parts.year}-${parts.month}-${parts.day}`;
}

export function mergeCompetitorRankHistory(
  existing: CompetitorRankHistoryRecord[],
  incoming: CompetitorRankHistoryRecord[],
  timeZone = GLOBAL_TRACKING_TIMEZONE,
) {
  const byDayKey = new Map<string, CompetitorRankHistoryRecord>();
  [...existing, ...incoming]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .forEach((entry) => {
      byDayKey.set(getCompetitorRankHistoryDayKey(entry, timeZone), entry);
    });

  return Array.from(byDayKey.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

type RefreshDependencies = {
  concurrency?: number;
  now?: () => string;
  rankingDepth?: number;
  getKeywordRank: (
    keyword: string,
    appId: string,
    storeType: StoreType,
    country: string,
    refresh: boolean,
    depth: number,
  ) => Promise<number>;
  normalizeTrackedKeywordError: (error: unknown) => string;
  normalizeCompetitorTrackedKeywordError: (error: unknown) => string;
};

type RefreshOptions = {
  updateScheduleMetadata?: boolean;
  runKey?: string;
};

type RefreshResult<TState extends TrackingStateBase> = {
  nextState: TState;
  checked: number;
  changed: number;
  failed: number;
};

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

      const currentItem = items[currentIndex];
      if (currentItem === undefined) {
        return;
      }

      results[currentIndex] = await worker(currentItem, currentIndex);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()),
  );

  return results;
}

export async function refreshTrackedKeywordRecord(
  trackedKeyword: TrackedKeywordRecord,
  dependencies: RefreshDependencies,
  rankingDepth = dependencies.rankingDepth ?? TRACKED_KEYWORD_RANKING_DEPTH,
) {
  try {
    const checkedAt = (dependencies.now || (() => new Date().toISOString()))();
    const rank = await dependencies.getKeywordRank(
      trackedKeyword.keyword,
      trackedKeyword.appId,
      trackedKeyword.store,
      trackedKeyword.country,
      true,
      rankingDepth,
    );

    return {
      previousRank: trackedKeyword.lastRank,
      trackedKeyword: {
        ...trackedKeyword,
        lastRank: rank,
        lastChecked: checkedAt,
        lastCheckStatus: rank === -1 ? ('not_ranked' as const) : ('ok' as const),
        lastError: undefined,
      },
      historyEntry: {
        groupId: resolveTrackingGroupId(trackedKeyword),
        appId: trackedKeyword.appId,
        keyword: trackedKeyword.keyword,
        store: trackedKeyword.store,
        country: trackedKeyword.country,
        rank,
        rankDepth: rankingDepth,
        timestamp: checkedAt,
      } satisfies RankHistoryRecord,
      hadError: false,
    };
  } catch (error) {
    return {
      previousRank: trackedKeyword.lastRank,
      trackedKeyword: {
        ...trackedKeyword,
        lastChecked: (dependencies.now || (() => new Date().toISOString()))(),
        lastCheckStatus: 'error' as const,
        lastError: dependencies.normalizeTrackedKeywordError(error),
      },
      historyEntry: null,
      hadError: true,
    };
  }
}

async function refreshTrackedKeywordState<TState extends TrackingStateBase>(
  state: TState,
  dependencies: RefreshDependencies,
  options?: RefreshOptions,
): Promise<RefreshResult<TState>> {
  if (!state.trackedKeywords.length) {
    return {
      nextState: {
        ...state,
        trackedKeywords: [],
        rankHistory: state.rankHistory,
        schedule: options?.updateScheduleMetadata
          ? {
              ...state.schedule,
              lastRunAt: (dependencies.now || (() => new Date().toISOString()))(),
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
    dependencies.concurrency ?? TRACKING_REFRESH_CONCURRENCY,
    (trackedKeyword) => refreshTrackedKeywordRecord(trackedKeyword, dependencies),
  );

  return {
    nextState: {
      ...state,
      trackedKeywords: refreshResults.map((result) => result.trackedKeyword),
      rankHistory: mergeRankHistory(
        state.rankHistory,
        refreshResults.flatMap((result) => (result.historyEntry ? [result.historyEntry] : [])),
      ),
      schedule: options?.updateScheduleMetadata
        ? {
            ...state.schedule,
            lastRunAt: (dependencies.now || (() => new Date().toISOString()))(),
            lastRunKey: options.runKey ?? state.schedule.lastRunKey,
          }
        : state.schedule,
    },
    checked: refreshResults.length,
    changed: refreshResults.filter((result) => result.previousRank !== result.trackedKeyword.lastRank).length,
    failed: refreshResults.filter((result) => result.hadError).length,
  };
}

async function refreshCompetitorTrackedKeywordState<TState extends TrackingStateBase>(
  state: TState,
  dependencies: RefreshDependencies,
  options?: RefreshOptions,
): Promise<RefreshResult<TState>> {
  if (!state.competitorTrackedKeywords.length) {
    return {
      nextState: {
        ...state,
        competitorTrackedKeywords: [],
        competitorRankHistory: state.competitorRankHistory,
        schedule: options?.updateScheduleMetadata
          ? {
              ...state.schedule,
              lastRunAt: (dependencies.now || (() => new Date().toISOString()))(),
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
    dependencies.concurrency ?? TRACKING_REFRESH_CONCURRENCY,
    async (trackedKeyword) => {
      const refreshedAt = (dependencies.now || (() => new Date().toISOString()))();
      const appResults = await Promise.all(
        trackedKeyword.apps.map(async (app) => {
          try {
            const rank = await dependencies.getKeywordRank(
              trackedKeyword.keyword,
              app.appId,
              trackedKeyword.store,
              trackedKeyword.country,
              true,
              dependencies.rankingDepth ?? TRACKED_KEYWORD_RANKING_DEPTH,
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
                rankDepth: dependencies.rankingDepth ?? TRACKED_KEYWORD_RANKING_DEPTH,
                timestamp: refreshedAt,
              } satisfies CompetitorRankHistoryRecord,
              hadError: false,
            };
          } catch (error) {
            return {
              previousRank: app.lastRank,
              app: {
                ...app,
                lastChecked: refreshedAt,
                lastCheckStatus: 'error' as const,
                lastError: dependencies.normalizeCompetitorTrackedKeywordError(error),
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
      ...state,
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
            lastRunAt: (dependencies.now || (() => new Date().toISOString()))(),
            lastRunKey: options.runKey ?? state.schedule.lastRunKey,
          }
        : state.schedule,
    },
    checked: refreshResults.reduce((sum, result) => sum + result.trackedKeyword.apps.length, 0),
    changed: refreshResults.reduce((sum, result) => sum + result.changed, 0),
    failed: refreshResults.reduce((sum, result) => sum + result.failed, 0),
  };
}

export async function refreshAllTrackingState<TState extends TrackingStateBase>(
  state: TState,
  dependencies: RefreshDependencies,
  options?: RefreshOptions,
): Promise<RefreshResult<TState>> {
  const trackedRefresh = await refreshTrackedKeywordState(state, dependencies, {
    ...options,
    updateScheduleMetadata: false,
  });
  const competitorRefresh = await refreshCompetitorTrackedKeywordState(state, dependencies, {
    ...options,
    updateScheduleMetadata: false,
  });

  return {
    nextState: {
      ...state,
      trackedKeywords: trackedRefresh.nextState.trackedKeywords,
      rankHistory: trackedRefresh.nextState.rankHistory,
      competitorTrackedKeywords: competitorRefresh.nextState.competitorTrackedKeywords,
      competitorRankHistory: competitorRefresh.nextState.competitorRankHistory,
      schedule: options?.updateScheduleMetadata
        ? {
            ...state.schedule,
            lastRunAt: (dependencies.now || (() => new Date().toISOString()))(),
            lastRunKey: options.runKey ?? state.schedule.lastRunKey,
          }
        : state.schedule,
    },
    checked: trackedRefresh.checked + competitorRefresh.checked,
    changed: trackedRefresh.changed + competitorRefresh.changed,
    failed: trackedRefresh.failed + competitorRefresh.failed,
  };
}
