import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterUnresolvedCompetitorTrackedKeywords,
  filterUnresolvedTrackedKeywords,
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
  normalizeTrackingScheduleState,
  reconcileCompetitorTrackedKeywordCountryEdit,
  type CompetitorTrackedKeywordRecord as FrontendCompetitorTrackedKeywordRecord,
  type CompetitorGroupRecord,
  serializeEditableUserStateForApi,
} from '../src/features/tracking/model';
import {
  getCompetitorTrackedKeywordCardState,
  getTrackedAppUsageCountForOverview,
  getTrackedViewAppCountForOverview,
  isTrackedKeywordKeyWithinActiveLimit,
} from '../src/features/app/AuthenticatedWorkspace';
import {
  countPlanUsage,
} from '../src/lib/planLimits';
import {
  isDiscoveryKeywordCandidate,
  shouldAdmitDiscoveryCandidate,
} from '../src/lib/discoveryKeywordGating';

const fallback: TrackingSchedule = {
  enabled: true,
  time: '09:00',
  timezone: 'Asia/Kolkata',
};

test('shared schedule normalization always enables tracking and preserves timing metadata', () => {
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
    enabled: true,
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

test('tracking refresh eligibility requires tracked data and respects lastRunKey unless forced', () => {
  assert.equal(
    shouldRunTrackingRefresh({ lastRunKey: undefined }, { hasTrackedData: false, runKey: '2026-06-22T09:00' }),
    false,
  );
  assert.equal(
    shouldRunTrackingRefresh({ lastRunKey: '2026-06-22T09:00' }, { hasTrackedData: true, runKey: '2026-06-22T09:00' }),
    false,
  );
  assert.equal(
    shouldRunTrackingRefresh({ lastRunKey: '2026-06-22T09:00' }, { hasTrackedData: true, runKey: '2026-06-22T09:00', force: true }),
    true,
  );
  assert.equal(
    shouldRunTrackingRefresh({ lastRunKey: '2026-06-21T09:00' }, { hasTrackedData: true, runKey: '2026-06-22T09:00' }),
    true,
  );
});

test('frontend tracking schedule helpers also normalize to enabled', () => {
  assert.equal(getDefaultTrackingSchedule().enabled, true);

  const normalized = normalizeTrackingScheduleState({
    enabled: false,
    time: '11:15',
    timezone: 'UTC',
    lastRunAt: '2026-06-21T03:30:00.000Z',
    lastRunKey: '2026-06-21T09:00',
  });

  assert.equal(normalized.enabled, true);
  assert.equal(normalized.time, '11:15');
  assert.equal(normalized.timezone, 'UTC');
  assert.equal(normalized.lastRunAt, '2026-06-21T03:30:00.000Z');
  assert.equal(normalized.lastRunKey, '2026-06-21T09:00');
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

  assert.equal(staleUsage.trackedApps, 1);

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

test('discovery sanitizer allows broader exploratory terms while rejecting obvious junk', () => {
  assert.equal(isDiscoveryKeywordCandidate('free dating app'), true);
  assert.equal(isDiscoveryKeywordCandidate('pro wingman support'), true);
  assert.equal(isDiscoveryKeywordCandidate('how to start flirting'), true);
  assert.equal(isDiscoveryKeywordCandidate('release notes'), false);
  assert.equal(isDiscoveryKeywordCandidate('bug fixes'), false);
  assert.equal(isDiscoveryKeywordCandidate('dating advice for'), false);
});

test('deep discovery admits broader semantic candidates than fast mode', () => {
  const broadSemanticCandidate = {
    exactTitleMatch: 0,
    exactTitleSegment: 0,
    orderedTitleCoverage: 0.2,
    semanticCoverage: 0.3,
    categorySemanticCoverage: 0.2,
  };

  assert.equal(
    shouldAdmitDiscoveryCandidate('fast', broadSemanticCandidate, 12),
    false,
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
        semanticCoverage: 0.1,
        categorySemanticCoverage: 0.1,
      },
      0,
    ),
    true,
  );
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
