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
  GLOBAL_TRACKING_UTC_OFFSET_MINUTES,
  GLOBAL_TRACKING_TIMEZONE,
} from './trackingTime';

export type StoreType = 'android' | 'ios';
export type TrackedKeywordStatus = 'pending' | 'ok' | 'not_ranked' | 'error';
export type TrackingRefreshMode = 'full' | 'unresolved_only';

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

function getRunDayKey(runKey: string) {
  const [dayKey] = runKey.split('T');
  return dayKey;
}

function getDayKeyForTimestamp(timestamp: string, timeZone: string) {
  const parts = getZonedDateParts(new Date(timestamp), timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

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
      hourCycle: 'h23',
      hour12: false,
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  const rawHour = Number(parts.hour);

  return {
    year: String(parts.year),
    month: String(parts.month),
    day: String(parts.day),
    hour: rawHour === 24 ? 0 : rawHour,
    minute: Number(parts.minute),
  };
}

export function normalizeTrackingSchedule(
  input: Partial<TrackingSchedule> | undefined,
  fallback: TrackingSchedule,
): TrackingSchedule {
  return {
    enabled: true,
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

export function shouldRunTrackingRefresh(
  schedule: Pick<TrackingSchedule, 'lastRunKey'>,
  options: {
    hasTrackedData: boolean;
    runKey?: string;
    force?: boolean;
  },
) {
  if (!options.hasTrackedData) {
    return false;
  }

  if (options.runKey && !options.force && schedule.lastRunKey === options.runKey) {
    return false;
  }

  return true;
}

export function shouldRetryTrackedKeywordForRun(
  trackedKeyword: Pick<TrackedKeywordRecord, 'lastChecked' | 'lastCheckStatus'>,
  runKey: string,
  timeZone = GLOBAL_TRACKING_TIMEZONE,
) {
  if (!trackedKeyword.lastChecked) {
    return true;
  }

  if (getDayKeyForTimestamp(trackedKeyword.lastChecked, timeZone) !== getRunDayKey(runKey)) {
    return true;
  }

  return trackedKeyword.lastCheckStatus === 'pending' || trackedKeyword.lastCheckStatus === 'error';
}

export function shouldRetryCompetitorTrackedAppForRun(
  app: Pick<CompetitorTrackedKeywordAppRecord, 'lastChecked' | 'lastCheckStatus'>,
  runKey: string,
  timeZone = GLOBAL_TRACKING_TIMEZONE,
) {
  if (!app.lastChecked) {
    return true;
  }

  if (getDayKeyForTimestamp(app.lastChecked, timeZone) !== getRunDayKey(runKey)) {
    return true;
  }

  return app.lastCheckStatus === 'pending' || app.lastCheckStatus === 'error';
}

export function filterUnresolvedTrackedKeywords(
  trackedKeywords: TrackedKeywordRecord[],
  runKey: string,
  timeZone = GLOBAL_TRACKING_TIMEZONE,
) {
  return trackedKeywords.filter((trackedKeyword) =>
    shouldRetryTrackedKeywordForRun(trackedKeyword, runKey, timeZone),
  );
}

export function filterUnresolvedCompetitorTrackedKeywords(
  trackedKeywords: CompetitorTrackedKeywordRecord[],
  runKey: string,
  timeZone = GLOBAL_TRACKING_TIMEZONE,
) {
  return trackedKeywords.flatMap((trackedKeyword) => {
    const unresolvedApps = trackedKeyword.apps.filter((app) =>
      shouldRetryCompetitorTrackedAppForRun(app, runKey, timeZone),
    );
    if (!unresolvedApps.length) {
      return [];
    }

    return [{
      ...trackedKeyword,
      apps: unresolvedApps,
    }];
  });
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

export function getGlobalTrackingScheduledMinutes(
  time = DEFAULT_GLOBAL_TRACKING_TIME,
) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

export function getGlobalTrackingWatchdogDueAtIso(
  date: Date,
  delayMinutes: number,
  time = DEFAULT_GLOBAL_TRACKING_TIME,
  timeZone = GLOBAL_TRACKING_TIMEZONE,
) {
  const parts = getZonedDateParts(date, timeZone);
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const scheduledMinutes = getGlobalTrackingScheduledMinutes(time) + delayMinutes;
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

export function isGlobalTrackingWatchdogWindowOpen(
  date: Date,
  delayMinutes: number,
  time = DEFAULT_GLOBAL_TRACKING_TIME,
  timeZone = GLOBAL_TRACKING_TIMEZONE,
) {
  return date.getTime() >= Date.parse(
    getGlobalTrackingWatchdogDueAtIso(date, delayMinutes, time, timeZone),
  );
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

function getTrackedKeywordStateKey(
  record: Pick<TrackedKeywordRecord, 'groupId' | 'appId' | 'keyword' | 'store' | 'country'>,
) {
  return `${resolveTrackingGroupId(record)}:${record.store}:${record.country}:${record.appId}:${record.keyword.toLowerCase()}`;
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

function getCompetitorTrackedKeywordKey(
  record: Pick<CompetitorTrackedKeywordRecord, 'groupId' | 'keyword' | 'country' | 'store'>,
) {
  return `${record.groupId}:${record.store}:${record.keyword.toLowerCase()}:${record.country.toLowerCase()}`;
}

function getCompetitorTrackedKeywordAppKey(
  app: Pick<CompetitorTrackedKeywordAppRecord, 'appKey' | 'appId'>,
) {
  return `${app.appKey}:${app.appId}`;
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
  return `${entry.groupId}:${entry.store}:${entry.country.toLowerCase()}:${entry.appKey}:${entry.keyword.toLowerCase()}:${parts.year}-${parts.month}-${parts.day}`;
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
  mode?: TrackingRefreshMode;
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
  const trackedKeywordsToRefresh =
    options?.mode === 'unresolved_only' && options.runKey
      ? filterUnresolvedTrackedKeywords(state.trackedKeywords, options.runKey)
      : state.trackedKeywords;

  if (!trackedKeywordsToRefresh.length) {
    return {
      nextState: {
        ...state,
        trackedKeywords: state.trackedKeywords,
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
    trackedKeywordsToRefresh,
    dependencies.concurrency ?? TRACKING_REFRESH_CONCURRENCY,
    (trackedKeyword) => refreshTrackedKeywordRecord(trackedKeyword, dependencies),
  );

  const refreshedByKey = new Map(
    refreshResults.map((result) => [
      getTrackedKeywordStateKey(result.trackedKeyword),
      result.trackedKeyword,
    ]),
  );

  return {
    nextState: {
      ...state,
      trackedKeywords: state.trackedKeywords.map((trackedKeyword) =>
        refreshedByKey.get(getTrackedKeywordStateKey(trackedKeyword)) || trackedKeyword,
      ),
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
  const competitorTrackedKeywordsToRefresh =
    options?.mode === 'unresolved_only' && options.runKey
      ? filterUnresolvedCompetitorTrackedKeywords(state.competitorTrackedKeywords, options.runKey)
      : state.competitorTrackedKeywords;

  if (!competitorTrackedKeywordsToRefresh.length) {
    return {
      nextState: {
        ...state,
        competitorTrackedKeywords: state.competitorTrackedKeywords,
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
    competitorTrackedKeywordsToRefresh,
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
          apps: (() => {
            const refreshedAppsByKey = new Map(
              appResults.map((result) => [
                getCompetitorTrackedKeywordAppKey(result.app),
                result.app,
              ]),
            );
            const existingTrackedKeyword = state.competitorTrackedKeywords.find(
              (entry) => getCompetitorTrackedKeywordKey(entry) === getCompetitorTrackedKeywordKey(trackedKeyword),
            );
            const existingApps = existingTrackedKeyword?.apps || trackedKeyword.apps;
            return existingApps.map((app) =>
              refreshedAppsByKey.get(getCompetitorTrackedKeywordAppKey(app)) || app,
            );
          })(),
          updatedAt: refreshedAt,
          lastCheckedAt: refreshedAt,
        },
        historyEntries: appResults.flatMap((result) => (result.historyEntry ? [result.historyEntry] : [])),
        checked: appResults.length,
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
    checked: refreshResults.reduce((sum, result) => sum + result.checked, 0),
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
