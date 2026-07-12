import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterUnresolvedCompetitorTrackedKeywords,
  filterUnresolvedTrackedKeywords,
  getGlobalTrackingWatchdogDueAtIso,
  isGlobalTrackingWatchdogWindowOpen,
  normalizeTrackingSchedule,
  shouldRunTrackingRefresh,
  shouldRetryCompetitorTrackedAppForRun,
  shouldRetryTrackedKeywordForRun,
  type CompetitorTrackedKeywordRecord,
  type TrackingSchedule,
  type TrackedKeywordRecord,
} from '../src/lib/backendTracking';
import {
  getDefaultTrackingSchedule,
  normalizeWeeklyReportSettingsState,
  normalizeTrackingScheduleState,
  reconcileCompetitorTrackedKeywordCountryEdit,
  type CompetitorTrackedKeywordRecord as FrontendCompetitorTrackedKeywordRecord,
  type CompetitorGroupRecord,
  serializeEditableUserStateForApi,
} from '../src/features/tracking/model';
import {
  shouldSendWeeklyReportForDate,
} from '../src/lib/weeklyReports';
import {
  getCompetitorTrackedKeywordCardState,
  getTrackedAppUsageCountForOverview,
  getTrackedViewAppCountForOverview,
  isTrackedKeywordKeyWithinActiveLimit,
  syncOwnTrackedAppsWithTrackedKeywords,
} from '../src/features/app/AuthenticatedWorkspace';
import {
  countPlanUsage,
} from '../src/lib/planLimits';
import {
  isDiscoveryKeywordCandidate,
  shouldAdmitDiscoveryCandidate,
} from '../src/lib/discoveryKeywordGating';
import {
  getDiscoveryCacheLookupKeys,
  getDiscoveryCacheKey,
  trimDiscoveryPayloadForMode,
} from '../src/lib/discoveryCache';
import {
  buildDiscoveryContextCandidateKeywords,
  buildDiscoveryPromptSections,
  buildDiscoveryRefinementPrompt,
  extractDiscoveryFeatureSummary,
  type DiscoveryPromptLimits,
} from '../src/lib/discoveryPromptContext';
import {
  buildDiscoveryWarnings,
  resolveDiscoveryResponseStatus,
} from '../src/lib/discoveryResponse';
import {
  findAppleSearchResultIndex,
  getNormalizedAppleTargetIds,
} from '../src/lib/appleAppMatching';
import {
  getSortedCandidateTerms,
} from '../src/lib/keywordMetrics';

const discoveryPromptLimits: DiscoveryPromptLimits = {
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
};

const fallback: TrackingSchedule = {
  enabled: true,
  time: '09:00',
  timezone: 'Asia/Kolkata',
};

test('shared schedule normalization preserves explicit disabled state and timing metadata', () => {
  const normalized = normalizeTrackingSchedule(
    {
      enabled: false,
      time: '11:15',
      timezone: 'UTC',
      lastRunAt: '2026-06-21T03:30:00.000Z',
      lastRunKey: '2026-06-21T09:00',
    },
    fallback,
  );

  assert.deepEqual(normalized, {
    enabled: false,
    time: '11:15',
    timezone: 'UTC',
    lastRunAt: '2026-06-21T03:30:00.000Z',
    lastRunKey: '2026-06-21T09:00',
  });
});

test('shared schedule normalization defaults missing enabled to true', () => {
  const normalized = normalizeTrackingSchedule(undefined, fallback);

  assert.equal(normalized.enabled, true);
  assert.equal(normalized.time, '09:00');
  assert.equal(normalized.timezone, 'Asia/Kolkata');
});

test('shared schedule normalization rejects invalid timezone values', () => {
  const normalized = normalizeTrackingSchedule(
    {
      enabled: true,
      time: '09:00',
      timezone: 'Mars/Olympus',
    },
    fallback,
  );

  assert.equal(normalized.timezone, 'Asia/Kolkata');
});

test('global watchdog window stays closed at midnight and opens at the due time', () => {
  const midnightIst = new Date('2026-06-22T18:30:00.000Z');

  assert.equal(getGlobalTrackingWatchdogDueAtIso(midnightIst, 60), '2026-06-23T04:30:00.000Z');
  assert.equal(isGlobalTrackingWatchdogWindowOpen(midnightIst, 60), false);
  assert.equal(
    isGlobalTrackingWatchdogWindowOpen(new Date('2026-06-23T04:30:00.000Z'), 60),
    true,
  );
});

test('tracking refresh eligibility requires tracked data and respects lastRunKey unless forced', () => {
  assert.equal(
    shouldRunTrackingRefresh({ enabled: false, lastRunKey: undefined }, { hasTrackedData: true, runKey: '2026-06-22T09:00' }),
    false,
  );
  assert.equal(
    shouldRunTrackingRefresh({ enabled: true, lastRunKey: undefined }, { hasTrackedData: false, runKey: '2026-06-22T09:00' }),
    false,
  );
  assert.equal(
    shouldRunTrackingRefresh({ enabled: true, lastRunKey: '2026-06-22T09:00' }, { hasTrackedData: true, runKey: '2026-06-22T09:00' }),
    false,
  );
  assert.equal(
    shouldRunTrackingRefresh({ enabled: true, lastRunKey: '2026-06-22T09:00' }, { hasTrackedData: true, runKey: '2026-06-22T09:00', force: true }),
    true,
  );
  assert.equal(
    shouldRunTrackingRefresh({ enabled: true, lastRunKey: '2026-06-21T09:00' }, { hasTrackedData: true, runKey: '2026-06-22T09:00' }),
    true,
  );
});

test('frontend tracking schedule helpers preserve explicit disabled state', () => {
  assert.equal(getDefaultTrackingSchedule().enabled, true);

  const normalized = normalizeTrackingScheduleState({
    enabled: false,
    time: '11:15',
    timezone: 'UTC',
    lastRunAt: '2026-06-21T03:30:00.000Z',
    lastRunKey: '2026-06-21T09:00',
  });

  assert.equal(normalized.enabled, false);
  assert.equal(normalized.time, '11:15');
  assert.equal(normalized.timezone, 'UTC');
  assert.equal(normalized.lastRunAt, '2026-06-21T03:30:00.000Z');
  assert.equal(normalized.lastRunKey, '2026-06-21T09:00');
});

test('frontend weekly report settings default to disabled sunday with caller timezone', () => {
  const normalized = normalizeWeeklyReportSettingsState(undefined, 'America/New_York');

  assert.equal(normalized.enabled, false);
  assert.equal(normalized.weekday, 'sun');
  assert.equal(normalized.timezone, 'America/New_York');
  assert.equal(normalized.lastSentWeekKey, undefined);
});

test('frontend weekly report settings reject invalid timezone values', () => {
  const normalized = normalizeWeeklyReportSettingsState(
    {
      enabled: true,
      weekday: 'mon',
      timezone: 'Mars/Olympus',
    },
    'America/New_York',
  );

  assert.equal(normalized.timezone, 'America/New_York');
});

test('weekly report delivery eligibility matches local weekday and suppresses same-week duplicates', () => {
  const firstCheck = shouldSendWeeklyReportForDate(
    {
      enabled: true,
      weekday: 'sun',
      timezone: 'America/Los_Angeles',
    },
    new Date('2026-06-28T19:00:00.000Z'),
  );

  assert.equal(firstCheck.matchesWeekday, true);
  assert.equal(firstCheck.alreadySent, false);

  const secondCheck = shouldSendWeeklyReportForDate(
    {
      enabled: true,
      weekday: 'sun',
      timezone: 'America/Los_Angeles',
      lastSentWeekKey: firstCheck.deliveryKey,
    },
    new Date('2026-06-28T23:30:00.000Z'),
  );

  assert.equal(secondCheck.matchesWeekday, true);
  assert.equal(secondCheck.alreadySent, true);
});

test('same-day unresolved tracked keywords include old-day, pending, and error rows but skip ok/not_ranked', () => {
  const runKey = '2026-06-22T09:00';
  const trackedKeywords: TrackedKeywordRecord[] = [
    {
      keyword: 'old',
      appId: 'app.old',
      appTitle: 'Old',
      store: 'android',
      country: 'US',
      lastRank: 12,
      lastChecked: '2026-06-21T03:30:00.000Z',
      lastCheckStatus: 'ok',
    },
    {
      keyword: 'pending',
      appId: 'app.pending',
      appTitle: 'Pending',
      store: 'android',
      country: 'US',
      lastRank: -1,
      lastChecked: '2026-06-22T04:00:00.000Z',
      lastCheckStatus: 'pending',
    },
    {
      keyword: 'error',
      appId: 'app.error',
      appTitle: 'Error',
      store: 'android',
      country: 'US',
      lastRank: -1,
      lastChecked: '2026-06-22T04:00:00.000Z',
      lastCheckStatus: 'error',
    },
    {
      keyword: 'ok',
      appId: 'app.ok',
      appTitle: 'Ok',
      store: 'android',
      country: 'US',
      lastRank: 3,
      lastChecked: '2026-06-22T04:00:00.000Z',
      lastCheckStatus: 'ok',
    },
    {
      keyword: 'not-ranked',
      appId: 'app.notranked',
      appTitle: 'Not Ranked',
      store: 'android',
      country: 'US',
      lastRank: -1,
      lastChecked: '2026-06-22T04:00:00.000Z',
      lastCheckStatus: 'not_ranked',
    },
  ];

  assert.equal(shouldRetryTrackedKeywordForRun(trackedKeywords[0], runKey), true);
  assert.equal(shouldRetryTrackedKeywordForRun(trackedKeywords[1], runKey), true);
  assert.equal(shouldRetryTrackedKeywordForRun(trackedKeywords[2], runKey), true);
  assert.equal(shouldRetryTrackedKeywordForRun(trackedKeywords[3], runKey), false);
  assert.equal(shouldRetryTrackedKeywordForRun(trackedKeywords[4], runKey), false);

  assert.deepEqual(
    filterUnresolvedTrackedKeywords(trackedKeywords, runKey).map((entry) => entry.keyword),
    ['old', 'pending', 'error'],
  );
});

test('same-day unresolved competitor tracking preserves only unresolved apps inside each row', () => {
  const runKey = '2026-06-22T09:00';
  const competitorTrackedKeywords: CompetitorTrackedKeywordRecord[] = [{
    trackedKeywordId: 'tk-1',
    groupId: 'group-1',
    keyword: 'dating wingman',
    store: 'android',
    country: 'US',
    createdAt: '2026-06-20T00:00:00.000Z',
    updatedAt: '2026-06-22T04:00:00.000Z',
    apps: [
      {
        appKey: 'own',
        appId: 'app.own',
        store: 'android',
        role: 'own',
        title: 'Own App',
        developer: '',
        icon: '',
        lastRank: 4,
        lastChecked: '2026-06-22T04:00:00.000Z',
        lastCheckStatus: 'ok',
      },
      {
        appKey: 'comp-1',
        appId: 'app.comp1',
        store: 'android',
        role: 'competitor',
        title: 'Comp 1',
        developer: '',
        icon: '',
        lastRank: -1,
        lastChecked: '2026-06-22T04:00:00.000Z',
        lastCheckStatus: 'error',
      },
      {
        appKey: 'comp-2',
        appId: 'app.comp2',
        store: 'android',
        role: 'competitor',
        title: 'Comp 2',
        developer: '',
        icon: '',
        lastRank: 15,
        lastChecked: '2026-06-21T04:00:00.000Z',
        lastCheckStatus: 'ok',
      },
    ],
  }];

  assert.equal(
    shouldRetryCompetitorTrackedAppForRun(competitorTrackedKeywords[0].apps[0], runKey),
    false,
  );
  assert.equal(
    shouldRetryCompetitorTrackedAppForRun(competitorTrackedKeywords[0].apps[1], runKey),
    true,
  );
  assert.equal(
    shouldRetryCompetitorTrackedAppForRun(competitorTrackedKeywords[0].apps[2], runKey),
    true,
  );

  const filtered = filterUnresolvedCompetitorTrackedKeywords(
    competitorTrackedKeywords,
    runKey,
  );
  assert.equal(filtered.length, 1);
  assert.deepEqual(
    filtered[0].apps.map((app) => app.appId),
    ['app.comp1', 'app.comp2'],
  );
});

test('competitor country edit reconciliation only adds pending rows and removes selected countries', () => {
  const group: CompetitorGroupRecord = {
    groupId: 'group-1',
    store: 'android',
    country: 'US',
    mode: 'fast',
    ownApp: {
      appKey: 'android:app.own',
      appId: 'app.own',
      store: 'android',
      role: 'own',
      title: 'Own App',
      description: '',
      developer: '',
      icon: '',
    },
    competitors: [{
      appKey: 'android:app.comp1',
      appId: 'app.comp1',
      store: 'android',
      role: 'competitor',
      title: 'Comp 1',
      description: '',
      developer: '',
      icon: '',
    }],
    trackedKeywordIds: ['tk-us', 'tk-ca'],
    createdAt: '2026-06-20T00:00:00.000Z',
    updatedAt: '2026-06-21T00:00:00.000Z',
  };
  const existingUsRecord: FrontendCompetitorTrackedKeywordRecord = {
    trackedKeywordId: 'tk-us',
    groupId: 'group-1',
    keyword: 'dating wingman',
    store: 'android',
    country: 'US',
    createdAt: '2026-06-20T00:00:00.000Z',
    updatedAt: '2026-06-21T00:00:00.000Z',
    apps: [
      {
        appKey: 'android:app.own',
        appId: 'app.own',
        store: 'android',
        role: 'own' as const,
        title: 'Own App',
        description: '',
        developer: '',
        icon: '',
        lastRank: 3,
        lastChecked: '2026-06-21T09:00:00.000Z',
        lastCheckStatus: 'ok' as const,
      },
      {
        appKey: 'android:app.comp1',
        appId: 'app.comp1',
        store: 'android',
        role: 'competitor' as const,
        title: 'Comp 1',
        description: '',
        developer: '',
        icon: '',
        lastRank: 7,
        lastChecked: '2026-06-21T09:00:00.000Z',
        lastCheckStatus: 'ok' as const,
      },
    ],
    lastCheckedAt: '2026-06-21T09:00:00.000Z',
  };
  const existingCaRecord: FrontendCompetitorTrackedKeywordRecord = {
    trackedKeywordId: 'tk-ca',
    groupId: 'group-1',
    keyword: 'dating wingman',
    store: 'android',
    country: 'CA',
    createdAt: '2026-06-20T00:00:00.000Z',
    updatedAt: '2026-06-21T00:00:00.000Z',
    apps: [
      {
        appKey: 'android:app.own',
        appId: 'app.own',
        store: 'android',
        role: 'own' as const,
        title: 'Own App',
        description: '',
        developer: '',
        icon: '',
        lastRank: 5,
        lastChecked: '2026-06-21T09:00:00.000Z',
        lastCheckStatus: 'ok' as const,
      },
      {
        appKey: 'android:app.comp1',
        appId: 'app.comp1',
        store: 'android',
        role: 'competitor' as const,
        title: 'Comp 1',
        description: '',
        developer: '',
        icon: '',
        lastRank: 9,
        lastChecked: '2026-06-21T09:00:00.000Z',
        lastCheckStatus: 'ok' as const,
      },
    ],
    lastCheckedAt: '2026-06-21T09:00:00.000Z',
  };

  const result = reconcileCompetitorTrackedKeywordCountryEdit({
    existingRecords: [existingUsRecord, existingCaRecord],
    group,
    keyword: 'dating wingman',
    nowIso: '2026-06-22T10:00:00.000Z',
    selectedCountries: ['us', 'gb'],
  });

  assert.deepEqual(result.addedCountries, ['gb']);
  assert.deepEqual(result.removedCountries, ['ca']);
  assert.deepEqual(result.removedTrackedKeywordIds, ['tk-ca']);
  assert.deepEqual(result.nextTrackedKeywordIds, ['tk-us', 'comp-track:group-1:dating-wingman:gb']);
  assert.equal(result.nextRecords.length, 2);
  assert.equal(result.nextRecords[1], existingUsRecord);
  assert.equal(result.addedRecords.length, 1);
  assert.equal(result.addedRecords[0].country, 'gb');
  assert.equal(result.addedRecords[0].apps[0].lastCheckStatus, 'pending');
  assert.equal(result.addedRecords[0].apps[0].lastChecked, new Date(0).toISOString());
  assert.equal(result.addedRecords[0].apps[0].lastRank, -1);
  assert.equal(result.addedRecords[0].apps[1].lastCheckStatus, 'pending');
});

test('editable user-state serialization preserves histories, schedule timing, and alert-rule targeting', () => {
  const serialized = serializeEditableUserStateForApi({
    bookmarks: [],
    trackedApps: [],
    trackedKeywords: [{
      groupId: 'group-1',
      keyword: 'dating wingman',
      appId: 'app.own',
      appTitle: 'Own App',
      store: 'android',
      country: 'us',
      createdAt: '2026-06-20T00:00:00.000Z',
      lastRank: 4,
      lastChecked: '2026-06-22T09:00:00.000Z',
      lastCheckStatus: 'ok',
    }],
    rankHistory: [{
      groupId: 'group-1',
      keyword: 'dating wingman',
      appId: 'app.own',
      store: 'android',
      country: 'us',
      rank: 4,
      timestamp: '2026-06-22T09:00:00.000Z',
    }],
    appAnalysisSnapshots: [],
    competitorGroups: [],
    competitorGroupSnapshots: [],
    competitorTrackedKeywords: [],
    competitorRankHistory: [{
      trackedKeywordId: 'comp-track:group-1:dating-wingman:us',
      groupId: 'group-1',
      keyword: 'dating wingman',
      appId: 'app.comp1',
      appKey: 'android:app.comp1',
      store: 'android',
      country: 'us',
      rank: 7,
      timestamp: '2026-06-22T09:00:00.000Z',
    }],
    trackingSchedule: {
      enabled: true,
      time: '11:15',
      timezone: 'UTC',
      lastRunAt: '2026-06-22T03:45:00.000Z',
      lastRunKey: '2026-06-22T11:15',
    },
    weeklyReportSettings: {
      enabled: true,
      weekday: 'wed',
      timezone: 'America/New_York',
      lastSentWeekKey: '2026-W26',
      lastSentAt: '2026-06-22T03:45:00.000Z',
    },
    alertRules: [{
      id: 'rule-1',
      enabled: true,
      groupId: 'group-1',
      appId: 'app.own',
      keyword: 'dating wingman',
      store: 'android',
      scope: 'competitor_aso',
      countries: ['us'],
      channels: { inApp: true, push: false, email: false },
      conditions: [{ type: 'aso_title_changed' }],
      targetAppIds: ['app.comp1'],
      createdAt: '2026-06-20T00:00:00.000Z',
      updatedAt: '2026-06-22T00:00:00.000Z',
    }],
    notificationSettings: {
      inAppEnabled: true,
      pushEnabled: false,
      permission: 'default',
    },
    legalAcceptedAt: '2026-06-20T00:00:00.000Z',
    legalVersion: '2026-06',
    migratedFromLocalAt: '2026-06-20T00:00:00.000Z',
    updatedAt: '2026-06-22T09:00:00.000Z',
  });

  assert.equal(serialized.rankHistory?.length, 1);
  assert.equal(serialized.competitorRankHistory?.length, 1);
  assert.equal(serialized.trackingSchedule?.time, '11:15');
  assert.equal(serialized.trackingSchedule?.timezone, 'UTC');
  assert.equal(serialized.trackingSchedule?.lastRunAt, '2026-06-22T03:45:00.000Z');
  assert.equal(serialized.trackingSchedule?.lastRunKey, '2026-06-22T11:15');
  assert.equal(serialized.weeklyReportSettings?.enabled, true);
  assert.equal(serialized.weeklyReportSettings?.weekday, 'wed');
  assert.equal(serialized.weeklyReportSettings?.timezone, 'America/New_York');
  assert.equal(serialized.weeklyReportSettings?.lastSentWeekKey, undefined);
  assert.equal(serialized.weeklyReportSettings?.lastSentAt, undefined);
  assert.equal(serialized.alertRules?.[0]?.scope, 'competitor_aso');
  assert.deepEqual(serialized.alertRules?.[0]?.targetAppIds, ['app.comp1']);
});

test('competitor chart card state always shows edit countries and preserves selected country overrides', () => {
  const singleCountryState = getCompetitorTrackedKeywordCardState({
    keywordGroup: {
      groupKey: 'group-1:rizz',
      groupId: 'group-1',
      keyword: 'rizz',
      countries: ['us'],
      countryViews: [{
        trackedKeyword: {
          trackedKeywordId: 'tk-us',
          groupId: 'group-1',
          keyword: 'rizz',
          store: 'android',
          country: 'us',
          createdAt: '2026-06-20T00:00:00.000Z',
          updatedAt: '2026-06-22T09:45:00.000Z',
          lastCheckedAt: '2026-06-22T09:45:00.000Z',
          apps: [],
        },
        appHistoryViews: [],
        chartPoints: [],
        chartMax: 101,
      }],
    },
    workspaceCountry: 'us',
    selectedCountriesByGroup: {},
  });

  assert.equal(singleCountryState.showEditCountries, true);
  assert.equal(singleCountryState.showCountrySwitcher, false);
  assert.equal(singleCountryState.editCountriesInput?.groupId, 'group-1');
  assert.equal(singleCountryState.editCountriesInput?.keyword, 'rizz');
  assert.equal(singleCountryState.selectedCountryView?.trackedKeyword.country, 'us');

  const multiCountryState = getCompetitorTrackedKeywordCardState({
    keywordGroup: {
      groupKey: 'group-1:rizz',
      groupId: 'group-1',
      keyword: 'rizz',
      countries: ['us', 'ca'],
      countryViews: [
        {
          trackedKeyword: {
            trackedKeywordId: 'tk-us',
            groupId: 'group-1',
            keyword: 'rizz',
            store: 'android',
            country: 'us',
            createdAt: '2026-06-20T00:00:00.000Z',
            updatedAt: '2026-06-22T09:45:00.000Z',
            lastCheckedAt: '2026-06-22T09:45:00.000Z',
            apps: [],
          },
          appHistoryViews: [],
          chartPoints: [],
          chartMax: 101,
        },
        {
          trackedKeyword: {
            trackedKeywordId: 'tk-ca',
            groupId: 'group-1',
            keyword: 'rizz',
            store: 'android',
            country: 'ca',
            createdAt: '2026-06-20T00:00:00.000Z',
            updatedAt: '2026-06-22T09:40:00.000Z',
            lastCheckedAt: '2026-06-22T09:40:00.000Z',
            apps: [],
          },
          appHistoryViews: [],
          chartPoints: [],
          chartMax: 101,
        },
      ],
    },
    workspaceCountry: 'us',
    selectedCountriesByGroup: {
      'group-1:rizz': 'ca',
    },
  });

  assert.equal(multiCountryState.showEditCountries, true);
  assert.equal(multiCountryState.showCountrySwitcher, true);
  assert.equal(multiCountryState.selectedCountryView?.trackedKeyword.country, 'ca');
});

test('plan usage and tracked app overview count own apps separately from keyword and group expansion', () => {
  const usage = countPlanUsage({
    trackedApps: [
      {
        appKey: 'android:app.own',
        appId: 'app.own',
        store: 'android',
        kind: 'own',
      },
      {
        appKey: 'android:app.comp',
        appId: 'app.comp',
        store: 'android',
        kind: 'competitor',
      },
    ],
    competitorGroups: [
      { groupId: 'group-1' },
    ],
    trackedKeywords: [
      {
        groupId: 'own-group',
        appId: 'app.own',
        keyword: 'rizz',
        store: 'android',
        country: 'us',
      },
      {
        groupId: 'own-group',
        appId: 'app.own',
        keyword: 'rizz',
        store: 'android',
        country: 'ca',
      },
      {
        groupId: 'own-group',
        appId: 'app.own',
        keyword: 'wingman',
        store: 'android',
        country: 'us',
      },
    ],
    competitorTrackedKeywords: [
      {
        trackedKeywordId: 'comp-track:group-1:rizz:us',
        groupId: 'group-1',
        keyword: 'rizz',
        store: 'android',
        country: 'us',
      },
      {
        trackedKeywordId: 'comp-track:group-1:rizz:ca',
        groupId: 'group-1',
        keyword: 'rizz',
        store: 'android',
        country: 'ca',
      },
      {
        trackedKeywordId: 'comp-track:group-1:wingman:us',
        groupId: 'group-1',
        keyword: 'wingman',
        store: 'android',
        country: 'us',
      },
    ],
  });

  assert.equal(usage.trackedApps, 1);
  assert.equal(usage.competitorGroups, 1);
  assert.equal(usage.trackedKeywords, 6);

  const staleUsage = countPlanUsage({
    trackedApps: [
      {
        appKey: 'android:stale-a',
        appId: 'stale-a',
        store: 'android',
        kind: 'own',
      },
      {
        appKey: 'android:stale-b',
        appId: 'stale-b',
        store: 'android',
        kind: 'own',
      },
    ],
    competitorGroups: [],
    trackedKeywords: [
      {
        groupId: 'own-group',
        appId: 'app.own',
        keyword: 'rizz',
        store: 'android',
        country: 'us',
      },
      {
        groupId: 'own-group',
        appId: 'app.own',
        keyword: 'wingman',
        store: 'android',
        country: 'ca',
      },
    ],
    competitorTrackedKeywords: [],
  });

  assert.equal(staleUsage.trackedApps, 3);

  const discoveryOnlyUsage = countPlanUsage({
    trackedApps: [
      {
        appKey: 'android:app.own',
        appId: 'app.own',
        store: 'android',
        kind: 'own',
        source: 'discovery',
      },
      {
        appKey: 'android:discovery-only',
        appId: 'discovery-only',
        store: 'android',
        kind: 'own',
        source: 'discovery',
      },
    ],
    competitorGroups: [],
    trackedKeywords: [
      {
        groupId: 'own-group',
        appId: 'app.own',
        keyword: 'rizz',
        store: 'android',
        country: 'us',
      },
    ],
    competitorTrackedKeywords: [],
  });

  assert.equal(discoveryOnlyUsage.trackedApps, 1);

  const overviewCount = getTrackedAppUsageCountForOverview([
    {
      appId: 'app.own',
      store: 'android',
    },
    {
      appId: 'app.own',
      store: 'android',
    },
    {
      appId: 'app.second',
      store: 'ios',
    },
  ]);

  assert.equal(overviewCount, 2);
});

test('tracked workspace app count follows visible app cards instead of global tracked-app usage', () => {
  const visibleAppCount = getTrackedViewAppCountForOverview([
    { appKey: 'app.vercel.rizzmaster' },
  ]);

  const visibleExpandedAppCount = getTrackedViewAppCountForOverview([
    { appKey: 'app.vercel.rizzmaster' },
    { appKey: 'app.vercel.rizzmaster' },
    { appKey: 'ios:12345' },
  ]);

  assert.equal(visibleAppCount, 1);
  assert.equal(visibleExpandedAppCount, 2);
});

test('syncOwnTrackedAppsWithTrackedKeywords drops discovery-only tracked app rows', () => {
  const nextTrackedApps = syncOwnTrackedAppsWithTrackedKeywords(
    [
      {
        appKey: 'android:app.vercel.rizzmaster',
        appId: 'app.vercel.rizzmaster',
        store: 'android',
        title: 'Rizz Master',
        developer: '',
        icon: '',
        kind: 'own',
        source: 'manual',
        countries: ['us'],
        createdAt: '2026-07-05T00:00:00.000Z',
        updatedAt: '2026-07-05T00:00:00.000Z',
      },
      {
        appKey: 'android:com.character.ai',
        appId: 'com.character.ai',
        store: 'android',
        title: 'Character AI',
        developer: '',
        icon: '',
        kind: 'own',
        source: 'discovery',
        countries: ['us'],
        createdAt: '2026-07-05T00:00:00.000Z',
        updatedAt: '2026-07-05T00:00:00.000Z',
      },
    ],
    [
      {
        groupId: 'track-rizz-master',
        appId: 'app.vercel.rizzmaster',
        appTitle: 'Rizz Master',
        keyword: 'rizz master',
        store: 'android',
        country: 'us',
        lastRank: 12,
        lastChecked: '2026-07-05T00:00:00.000Z',
      },
      {
        groupId: 'track-rizz-master',
        appId: 'app.vercel.rizzmaster',
        appTitle: 'Rizz Master',
        keyword: 'rizz wingman',
        store: 'android',
        country: 'ca',
        lastRank: 9,
        lastChecked: '2026-07-05T00:00:00.000Z',
      },
    ],
  );

  assert.deepEqual(
    nextTrackedApps.map((trackedApp) => ({
      appKey: trackedApp.appKey,
      source: trackedApp.source,
      countries: trackedApp.countries,
    })),
    [
      {
        appKey: 'android:app.vercel.rizzmaster',
        source: 'manual',
        countries: ['ca', 'us'],
      },
    ],
  );
});

test('discovery sanitizer allows broader exploratory terms while rejecting obvious junk', () => {
  assert.equal(isDiscoveryKeywordCandidate('free dating app'), true);
  assert.equal(isDiscoveryKeywordCandidate('pro wingman support'), true);
  assert.equal(isDiscoveryKeywordCandidate('how to start flirting'), true);
  assert.equal(isDiscoveryKeywordCandidate('message app'), true);
  assert.equal(isDiscoveryKeywordCandidate('budget manager'), true);
  assert.equal(isDiscoveryKeywordCandidate('follower stats'), true);
  assert.equal(isDiscoveryKeywordCandidate('release notes'), false);
  assert.equal(isDiscoveryKeywordCandidate('bug fixes'), false);
  assert.equal(isDiscoveryKeywordCandidate('latest changelog'), false);
  assert.equal(isDiscoveryKeywordCandidate('patch notes'), false);
  assert.equal(isDiscoveryKeywordCandidate('dating advice for'), false);
});

test('candidate sorter keeps mixed exploratory phrases and prefers longer ties over heads', () => {
  const sorted = getSortedCandidateTerms(
    new Map([
      ['chat', 10],
      ['chat app', 10],
      ['social', 12],
      ['social media app', 10],
      ['budget manager', 9],
      ['message app', 9],
      ['support chat', 8],
    ]),
    new Set<string>(),
  ).map(([term]) => term);

  assert.equal(sorted.includes('budget manager'), true);
  assert.equal(sorted.includes('message app'), true);
  assert.equal(sorted.indexOf('chat app') < sorted.indexOf('chat'), true);
  assert.equal(sorted.indexOf('social media app') < sorted.indexOf('social'), true);
});

test('deep discovery admits broader semantic candidates than fast mode', () => {
  const broadSemanticCandidate = {
    exactTitleMatch: 0,
    exactTitleSegment: 0,
    orderedTitleCoverage: 0.2,
    titleCoverage: 0,
    appTitleCoverage: 0,
    descriptionCoverage: 0.45,
    genericCoverage: 0.2,
    semanticCoverage: 0.3,
    categorySemanticCoverage: 0.2,
  };

  assert.equal(
    shouldAdmitDiscoveryCandidate('fast', broadSemanticCandidate, 12),
    true,
  );
  assert.equal(
    shouldAdmitDiscoveryCandidate('deep', broadSemanticCandidate, 12),
    true,
  );
  assert.equal(
    shouldAdmitDiscoveryCandidate(
      'fast',
      {
        exactTitleMatch: 1,
        exactTitleSegment: 0,
        orderedTitleCoverage: 0.1,
        titleCoverage: 0.5,
        appTitleCoverage: 0.5,
        descriptionCoverage: 0.2,
        genericCoverage: 0.1,
        semanticCoverage: 0.1,
        categorySemanticCoverage: 0.1,
      },
      0,
    ),
    true,
  );
});

test('discovery mode cache trimming reflects updated candidate breadth and visible ranking limits', () => {
  const deepPayload = {
    rankings: Array.from({ length: 36 }, (_, index) => ({
      keyword: `keyword ${index + 1}`,
      rank: index + 1,
      demand: 90 - index,
      volume: 90 - index,
      difficulty: 60,
      relevance: 90 - index,
      confidence: 'high' as const,
    })),
    suggestions: Array.from({ length: 36 }, (_, index) => ({
      keyword: `suggestion ${index + 1}`,
      demand: 70 - index,
      volume: 70 - index,
      difficulty: 50,
      relevance: 80 - index,
      confidence: 'medium' as const,
    })),
    checkedKeywords: 44,
    candidateCount: 220,
    searchDepth: 180,
    failedLookups: 0,
    mode: 'deep' as const,
    loadedAt: '2026-06-30T12:00:00.000Z',
  };

  const fastPayload = trimDiscoveryPayloadForMode(deepPayload, 'fast');
  const normalizedDeepPayload = trimDiscoveryPayloadForMode(deepPayload, 'deep');

  assert.equal(fastPayload.rankings.length, 15);
  assert.equal(fastPayload.suggestions.length, 15);
  assert.equal(fastPayload.checkedKeywords, 44);
  assert.equal(fastPayload.candidateCount, 80);
  assert.equal(fastPayload.searchDepth, 100);

  assert.equal(normalizedDeepPayload.rankings.length, 36);
  assert.equal(normalizedDeepPayload.suggestions.length, 36);
  assert.equal(normalizedDeepPayload.checkedKeywords, 44);
  assert.equal(normalizedDeepPayload.candidateCount, 220);
  assert.equal(normalizedDeepPayload.searchDepth, 180);
});

test('fast discovery can reuse a cached deep payload as a trimmed subset', () => {
  const deepPayload = {
    rankings: Array.from({ length: 24 }, (_, index) => ({
      keyword: `keyword ${index + 1}`,
      rank: index + 1,
      demand: 80 - index,
      volume: 80 - index,
      difficulty: 60,
      relevance: 90 - index,
      confidence: 'high' as const,
    })),
    suggestions: Array.from({ length: 24 }, (_, index) => ({
      keyword: `suggestion ${index + 1}`,
      demand: 60 - index,
      volume: 60 - index,
      difficulty: 50,
      relevance: 70 - index,
      confidence: 'medium' as const,
    })),
    checkedKeywords: 20,
    candidateCount: 180,
    searchDepth: 150,
    failedLookups: 0,
    mode: 'deep' as const,
    loadedAt: '2026-06-30T12:00:00.000Z',
  };

  const fastPayload = trimDiscoveryPayloadForMode(deepPayload, 'fast');

  assert.equal(fastPayload.mode, 'fast');
  assert.equal(fastPayload.rankings.length, 15);
  assert.equal(fastPayload.suggestions.length, 15);
  assert.equal(fastPayload.candidateCount, 80);
  assert.equal(fastPayload.searchDepth, 100);
});

test('fast discovery lookup checks deep cache as a fallback', () => {
  const keys = getDiscoveryCacheLookupKeys({
    mode: 'fast',
    store: 'android',
    country: 'us',
    appId: '123',
    title: 'Instagram',
    description: 'Social sharing app',
    category: 'social',
    developer: 'Meta',
  });

  assert.equal(keys.length, 2);
  assert.notEqual(keys[0], keys[1]);
  assert.match(keys[0], /-fast$/);
  assert.match(keys[1], /-deep$/);
});

test('discovery cache keys use compact metadata fingerprints', () => {
  const cacheKey = getDiscoveryCacheKey({
    mode: 'deep',
    store: 'android',
    country: 'us',
    appId: '123',
    title: 'Instagram',
    description: 'social app '.repeat(1000),
    category: 'social',
    developer: 'Meta',
  });

  assert.equal(cacheKey.includes('social app social app'), false);
  assert.ok(cacheKey.length < 120);
});

test('discovery feature summary skips release-note noise and keeps stable high-signal phrases', () => {
  const summary = extractDiscoveryFeatureSummary(
    'Build routines with a simple daily habit streak tracker for busy adults who want consistency. Stay focused with reminders, ADHD-friendly planning, and morning checklist flows. Contact support at help@habitflow.app. Read our privacy policy for details. Bug fixes and performance improvements in this update.',
    6,
  );

  assert.ok(summary.includes('build routines with simple daily habit streak tracker for busy adults who want consistency'));
  assert.ok(summary.includes('stay focused with reminders adhd friendly planning and morning checklist flows'));
  assert.equal(summary.some((line) => line.includes('bug fixes')), false);
  assert.equal(summary.some((line) => line.includes('privacy policy')), false);
  assert.equal(summary.some((line) => line.includes('contact support')), false);
});

test('discovery prompt sections cap repeated competitor terms and strip excluded brands', () => {
  const { sections, counts } = buildDiscoveryPromptSections({
    context: {
      title: 'Habit Flow',
      description: 'Build routines, stay focused, and follow a morning checklist designed for busy adults with ADHD.',
      category: 'productivity',
      developer: 'Flow Labs',
      store: 'android',
      country: 'us',
    },
    limits: {
      ...discoveryPromptLimits,
      competitorRepeatedTermsLimit: 2,
    },
    candidateKeywords: ['habit tracker', 'daily routine planner', 'morning checklist'],
    competitorRepeatedTerms: ['habit tracker', 'fabulous routines', 'habit tracker', 'daily planner'],
    excludedBrandTokens: ['fabulous'],
  });

  assert.deepEqual(sections.competitorRepeatedTerms, ['habit tracker', 'daily planner']);
  assert.equal(counts.competitorRepeatedTermCount, 2);
  assert.equal(sections.rawDescriptionExcerpt.includes('busy adults with adhd'), true);
});

test('discovery local candidate expansion adds contextual mid-tail phrases without network data', () => {
  const candidates = buildDiscoveryContextCandidateKeywords({
    context: {
      title: 'Rizz Master: AI Dating Wingman',
      description:
        'Generate flirty replies, opener ideas, dating bio help, and conversation starters for online dating chats.',
      category: 'Lifestyle',
      developer: 'Vantalum',
      store: 'android',
      country: 'us',
    },
    limits: {
      featureSummaryLimit: 8,
      seedPackLimit: 12,
      phraseWindowLimit: 16,
      totalLimit: 18,
    },
  });

  assert.ok(candidates.includes('dating conversation starter'));
  assert.ok(candidates.includes('flirty text generator'));
  assert.ok(candidates.length >= 8);
  assert.ok(candidates.some((candidate) => candidate.split(' ').length >= 3));
});

test('discovery raw description excerpt removes support and legal noise before truncation', () => {
  const { sections } = buildDiscoveryPromptSections({
    context: {
      title: 'Habit Flow',
      description: 'Build routines with a simple daily habit tracker for busy adults. Follow morning checklist flows, reminder nudges, and focus sessions that reduce overwhelm. Contact support at help@habitflow.app. Visit www.habitflow.app for more help. Read our privacy policy and terms. Version 4.2 includes bug fixes and performance improvements.',
      category: 'productivity',
      developer: 'Flow Labs',
      store: 'android',
      country: 'us',
    },
    limits: {
      ...discoveryPromptLimits,
      rawDescriptionExcerptChars: 120,
    },
    candidateKeywords: ['habit tracker', 'daily routine planner'],
    competitorRepeatedTerms: [],
    excludedBrandTokens: [],
  });

  assert.ok(sections.rawDescriptionExcerpt.includes('build routines with a simple daily habit tracker for busy adults'));
  assert.equal(sections.rawDescriptionExcerpt.includes('support'), false);
  assert.equal(sections.rawDescriptionExcerpt.includes('privacy'), false);
  assert.equal(sections.rawDescriptionExcerpt.includes('version 4 2'), false);
  assert.ok(sections.rawDescriptionExcerpt.length <= 120);
});

test('discovery refinement prompt uses structured sections in order and omits empty sections', () => {
  const { sections } = buildDiscoveryPromptSections({
    context: {
      title: 'Habit Flow',
      description: 'Build routines with reminders and a morning checklist for busy adults who want consistent streaks without overwhelm.',
      category: 'productivity',
      developer: 'Flow Labs',
      store: 'android',
      country: 'us',
    },
    limits: discoveryPromptLimits,
    candidateKeywords: ['habit tracker', 'daily routine planner', 'goal reminder app'],
    competitorRepeatedTerms: ['habit streak', 'routine planner'],
    excludedBrandTokens: ['fabulous'],
  });
  const prompt = buildDiscoveryRefinementPrompt({
    context: {
      title: 'Habit Flow',
      description: 'Build routines with reminders and a morning checklist for busy adults who want consistent streaks without overwhelm.',
      category: 'productivity',
      developer: 'Flow Labs',
      store: 'android',
      country: 'us',
    },
    limits: discoveryPromptLimits,
    mode: 'fast',
    sections: {
      ...sections,
      excludedBrandTokens: [],
    },
  });

  assert.ok(prompt.includes('App purpose:'));
  assert.ok(prompt.includes('Target users:'));
  assert.ok(prompt.includes('Core features:'));
  assert.ok(prompt.includes('Use cases:'));
  assert.ok(prompt.includes('Pain points solved:'));
  assert.ok(prompt.includes('High-signal phrases from description:'));
  assert.ok(prompt.includes('Raw description excerpt:'));
  assert.ok(prompt.includes('Competitor repeated terms:'));
  assert.ok(prompt.includes('Candidate keywords:'));
  assert.equal(prompt.includes('Avoid competitor brands:'), false);
  assert.equal(prompt.indexOf('App purpose:'), prompt.search(/App purpose:/));
  assert.ok(prompt.indexOf('App purpose:') < prompt.indexOf('Target users:'));
  assert.ok(prompt.indexOf('Target users:') < prompt.indexOf('Core features:'));
  assert.ok(prompt.indexOf('Core features:') < prompt.indexOf('Use cases:'));
  assert.ok(prompt.indexOf('Use cases:') < prompt.indexOf('Pain points solved:'));
  assert.ok(prompt.indexOf('Pain points solved:') < prompt.indexOf('High-signal phrases from description:'));
  assert.ok(prompt.indexOf('High-signal phrases from description:') < prompt.indexOf('Raw description excerpt:'));
  assert.ok(prompt.indexOf('Raw description excerpt:') < prompt.indexOf('Competitor repeated terms:'));
  assert.ok(prompt.indexOf('Competitor repeated terms:') < prompt.indexOf('Candidate keywords:'));
  assert.ok(prompt.includes('Return only a JSON array of strings. No markdown. No commentary.'));
  assert.ok(prompt.includes('Allow single-word and multi-word terms when they are strongly grounded'));
  assert.ok(prompt.includes('Do not bias toward or against a keyword because of word count alone.'));
  assert.ok(prompt.includes('Treat the candidate list as guidance, not a closed set, and infer adjacent user-search intent'));
  assert.ok(prompt.includes('Closely related variants are allowed when they reflect meaningfully different search intent.'));
  assert.ok(prompt.includes('Do not stay too literal to title words if the broader app purpose supports better search phrasing.'));
  assert.ok(prompt.includes('Prefer natural, human-searchable keywords with clear user intent grounded in this app context, regardless of phrase length.'));
});

test('discovery prompt limits keep output caps unchanged while expanding input context', () => {
  assert.equal(discoveryPromptLimits.outputKeywordLimit, 28);
  assert.equal(discoveryPromptLimits.outputTokenLimit, 384);
  assert.equal(discoveryPromptLimits.promptCandidateLimit > 40, true);
  assert.equal(discoveryPromptLimits.rawDescriptionExcerptChars > 220, true);
});

test('discovery response metadata marks partial verification and fallback states clearly', () => {
  const partialWarnings = buildDiscoveryWarnings({
    competitorMiningStatus: 'timeout',
    timedOutLookups: 2,
  });
  assert.deepEqual(partialWarnings, [
    'Competitor mining timed out, so discovery used app metadata only.',
    'Rank verification timed out for some keywords, so unverified suggestions are shown.',
  ]);
  assert.equal(
    resolveDiscoveryResponseStatus({ warnings: partialWarnings }),
    'partial',
  );

  const fallbackWarnings = buildDiscoveryWarnings({
    fallback: true,
    competitorMiningStatus: 'skipped',
  });
  assert.deepEqual(fallbackWarnings, [
    'Showing fallback discovery suggestions.',
  ]);
  assert.equal(
    resolveDiscoveryResponseStatus({ fallback: true, warnings: fallbackWarnings }),
    'fallback',
  );
});

test('apple target id normalization resolves numeric, id-prefixed, url, and bundle identifiers', () => {
  assert.deepEqual(
    Array.from(getNormalizedAppleTargetIds('123456789').identifiers).sort(),
    ['123456789', 'id123456789'],
  );
  assert.deepEqual(
    Array.from(getNormalizedAppleTargetIds('id123456789').identifiers).sort(),
    ['123456789', 'id123456789'],
  );
  assert.deepEqual(
    Array.from(
      getNormalizedAppleTargetIds('https://apps.apple.com/us/app/example-app/id123456789').identifiers,
    ).sort(),
    [
      '123456789',
      'https://apps.apple.com/us/app/example-app/id123456789',
      'id123456789',
    ],
  );
  assert.deepEqual(
    Array.from(getNormalizedAppleTargetIds('com.example.app').identifiers).sort(),
    ['com.example.app'],
  );
});

test('apple search result matching accepts numeric ids, id-prefixed ids, urls, and bundle ids', () => {
  const results = [
    { id: 456, title: 'Other App' },
    {
      id: 123456789,
      appId: '123456789',
      bundleId: 'com.example.app',
      url: 'https://apps.apple.com/us/app/example-app/id123456789',
      title: 'Example App',
    },
  ];

  assert.equal(findAppleSearchResultIndex(results, '123456789'), 1);
  assert.equal(findAppleSearchResultIndex(results, 'id123456789'), 1);
  assert.equal(
    findAppleSearchResultIndex(
      results,
      'https://apps.apple.com/us/app/example-app/id123456789',
    ),
    1,
  );
  assert.equal(findAppleSearchResultIndex(results, 'com.example.app'), 1);
  assert.equal(findAppleSearchResultIndex(results, '999999999'), -1);
});

test('active-limit helper always allows tracking when no keywords are paused', () => {
  assert.equal(
    isTrackedKeywordKeyWithinActiveLimit(
      {
        activeKeys: new Set<string>(),
        pausedTrackedKeywords: 0,
      },
      'missing-key',
    ),
    true,
  );

  assert.equal(
    isTrackedKeywordKeyWithinActiveLimit(
      {
        activeKeys: new Set(['active-key']),
        pausedTrackedKeywords: 2,
      },
      'missing-key',
    ),
    false,
  );
});
