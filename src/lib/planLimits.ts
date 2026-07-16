export type BillingPlanId = "free" | "indie" | "starter" | "pro" | "agency";

export const BILLING_PLAN_ORDER: Record<BillingPlanId, number> = {
  free: 0,
  indie: 1,
  starter: 2,
  pro: 3,
  agency: 4,
};

export type PlanLimits = {
  trackedApps: number | null;
  competitorGroups: number | null;
  trackedKeywords: number | null;
};

export type PlanEntitlements = {
  reportsWorkspace: boolean;
  weeklyEmailReports: boolean;
  alertRules: boolean;
  alertDelivery: boolean;
  competitorTracking: boolean;
  automatedTracking: boolean;
  alerts: boolean;
  browserPush: boolean;
  dataExport: boolean;
};

export type PlanUsage = {
  trackedApps: number;
  competitorGroups: number;
  trackedKeywords: number;
  activeTrackedKeywords: number;
  pausedTrackedKeywords: number;
};

type StoreType = "android" | "ios";

type TrackedAppLike = {
  appKey?: string;
  appId: string;
  store: StoreType;
  kind?: string;
  source?: string;
};

type CompetitorGroupLike = {
  groupId: string;
};

type TrackedKeywordLike = {
  groupId?: string;
  appId: string;
  keyword: string;
  store: StoreType;
  country: string;
  createdAt?: string;
};

type CompetitorTrackedKeywordLike = {
  trackedKeywordId?: string;
  groupId: string;
  keyword: string;
  store: StoreType;
  country: string;
  createdAt?: string;
};

type GovernedTrackingState = {
  trackedApps: TrackedAppLike[];
  competitorGroups: CompetitorGroupLike[];
  trackedKeywords: TrackedKeywordLike[];
  competitorTrackedKeywords: CompetitorTrackedKeywordLike[];
};

type OrderedTrackedKeyword =
  | {
      kind: "tracked";
      stableKey: string;
      createdAt: string;
    }
  | {
      kind: "competitor";
      stableKey: string;
      createdAt: string;
    };

export const TRACKED_KEYWORD_LEGACY_CREATED_AT =
  "1970-01-01T00:00:00.000Z";

export const BILLING_PLAN_LIMITS: Record<BillingPlanId, PlanLimits> = {
  free: {
    trackedApps: 1,
    competitorGroups: 1,
    trackedKeywords: 10,
  },
  indie: {
    trackedApps: 3,
    competitorGroups: 2,
    trackedKeywords: 100,
  },
  starter: {
    trackedApps: 8,
    competitorGroups: 5,
    trackedKeywords: 300,
  },
  pro: {
    trackedApps: 20,
    competitorGroups: 10,
    trackedKeywords: 1000,
  },
  agency: {
    trackedApps: null,
    competitorGroups: null,
    trackedKeywords: null,
  },
};

export const BILLING_PLAN_ENTITLEMENTS: Record<
  BillingPlanId,
  PlanEntitlements
> = {
  free: {
    reportsWorkspace: false,
    weeklyEmailReports: false,
    alertRules: false,
    alertDelivery: false,
    competitorTracking: false,
    automatedTracking: false,
    alerts: false,
    browserPush: false,
    dataExport: false,
  },
  indie: {
    reportsWorkspace: true,
    weeklyEmailReports: true,
    alertRules: true,
    alertDelivery: true,
    competitorTracking: true,
    automatedTracking: true,
    alerts: true,
    browserPush: true,
    dataExport: true,
  },
  starter: {
    reportsWorkspace: true,
    weeklyEmailReports: true,
    alertRules: true,
    alertDelivery: true,
    competitorTracking: true,
    automatedTracking: true,
    alerts: true,
    browserPush: true,
    dataExport: true,
  },
  pro: {
    reportsWorkspace: true,
    weeklyEmailReports: true,
    alertRules: true,
    alertDelivery: true,
    competitorTracking: true,
    automatedTracking: true,
    alerts: true,
    browserPush: true,
    dataExport: true,
  },
  agency: {
    reportsWorkspace: true,
    weeklyEmailReports: true,
    alertRules: true,
    alertDelivery: true,
    competitorTracking: true,
    automatedTracking: true,
    alerts: true,
    browserPush: true,
    dataExport: true,
  },
};

export function resolveBillingPlanId(
  planId?: string | null,
): BillingPlanId {
  return planId === "indie" ||
    planId === "starter" ||
    planId === "pro" ||
    planId === "agency"
    ? planId
    : "free";
}

export function getPlanLimits(planId?: string | null): PlanLimits {
  const resolvedPlanId = resolveBillingPlanId(planId);
  const limits = BILLING_PLAN_LIMITS[resolvedPlanId];
  return { ...limits };
}

export function getBillingPlanRank(planId?: string | null): number {
  return BILLING_PLAN_ORDER[resolveBillingPlanId(planId)];
}

export function getPlanEntitlements(
  planId?: string | null,
): PlanEntitlements {
  return {
    ...BILLING_PLAN_ENTITLEMENTS[resolveBillingPlanId(planId)],
  };
}

export function getPlanLimitFeatureLines(planId: BillingPlanId): string[] {
  const limits = getPlanLimits(planId);
  const trackedApps =
    limits.trackedApps === null
      ? "Custom tracked apps"
      : `${limits.trackedApps.toLocaleString()} tracked ${limits.trackedApps === 1 ? "app" : "apps"}`;
  const competitorGroups =
    limits.competitorGroups === null
      ? "Custom competitor groups"
      : `${limits.competitorGroups.toLocaleString()} competitor ${limits.competitorGroups === 1 ? "group" : "groups"}`;
  const trackedKeywords =
    limits.trackedKeywords === null
      ? "Custom tracked keywords"
      : `${limits.trackedKeywords.toLocaleString()} tracked keywords total`;

  return [trackedApps, competitorGroups, trackedKeywords];
}

export function getTrackedAppIdentityKey(app: TrackedAppLike) {
  return app.appKey || `${app.store}:${String(app.appId)}`;
}

export function getTrackedAppIdentityKeysFromTrackedKeywords(
  trackedKeywords: Array<Pick<TrackedKeywordLike, "appId" | "store">>,
) {
  return new Set(
    trackedKeywords.map((trackedKeyword) =>
      getTrackedAppIdentityKey({
        appId: trackedKeyword.appId,
        store: trackedKeyword.store,
      }),
    ),
  );
}

export function getTrackedAppIdentityKeysForPlanUsage(
  state: {
    trackedApps: TrackedAppLike[];
    trackedKeywords: Array<Pick<TrackedKeywordLike, "appId" | "store">>;
  },
) {
  return new Set(
    state.trackedApps
      .filter(
        (trackedApp) =>
          trackedApp.kind !== "competitor" && trackedApp.source !== "discovery",
      )
      .map((trackedApp) => getTrackedAppIdentityKey(trackedApp))
      .concat(
        Array.from(
          getTrackedAppIdentityKeysFromTrackedKeywords(state.trackedKeywords),
        ),
      ),
  );
}

export function getTrackedKeywordIdentityKey(keyword: TrackedKeywordLike) {
  return `${keyword.store}:${String(keyword.appId)}:${keyword.keyword.toLowerCase()}:${keyword.country.toLowerCase()}`;
}

export function getCompetitorTrackedKeywordIdentityKey(
  keyword: CompetitorTrackedKeywordLike,
) {
  return (
    keyword.trackedKeywordId ||
    `${keyword.groupId}:${keyword.store}:${keyword.keyword.toLowerCase()}:${keyword.country.toLowerCase()}`
  );
}

export function getTrackedKeywordCreatedAt(
  keyword: Pick<TrackedKeywordLike, "createdAt">,
) {
  return keyword.createdAt || TRACKED_KEYWORD_LEGACY_CREATED_AT;
}

function getOrderedTrackedKeywordPool(
  state: GovernedTrackingState,
): OrderedTrackedKeyword[] {
  const ordered: OrderedTrackedKeyword[] = [
    ...state.trackedKeywords.map(
      (keyword) =>
        ({
          kind: "tracked" as const,
          stableKey: getTrackedKeywordIdentityKey(keyword),
          createdAt: getTrackedKeywordCreatedAt(keyword),
        }) satisfies OrderedTrackedKeyword,
    )
    ,
    ...state.competitorTrackedKeywords.map(
      (keyword) =>
        ({
          kind: "competitor" as const,
          stableKey: getCompetitorTrackedKeywordIdentityKey(keyword),
          createdAt: getTrackedKeywordCreatedAt(keyword),
        }) satisfies OrderedTrackedKeyword,
    ),
  ];

  return ordered.sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime() ||
      left.stableKey.localeCompare(right.stableKey),
  );
}

export function getTrackedKeywordActivity(state: GovernedTrackingState, limits: PlanLimits) {
  const ordered = getOrderedTrackedKeywordPool(state);
  const activeCount =
    limits.trackedKeywords === null
      ? ordered.length
      : Math.min(limits.trackedKeywords, ordered.length);
  const activeTrackedKeywordKeys = new Set<string>();
  const activeCompetitorTrackedKeywordKeys = new Set<string>();

  ordered.slice(0, activeCount).forEach((entry) => {
    if (entry.kind === "tracked") {
      activeTrackedKeywordKeys.add(entry.stableKey);
      return;
    }
    activeCompetitorTrackedKeywordKeys.add(entry.stableKey);
  });

  return {
    activeTrackedKeywordKeys,
    activeCompetitorTrackedKeywordKeys,
    activeTrackedKeywords: activeCount,
    pausedTrackedKeywords: ordered.length - activeCount,
  };
}

export function countPlanUsage(state: GovernedTrackingState, limits?: PlanLimits): PlanUsage {
  const trackedApps = getTrackedAppIdentityKeysForPlanUsage(state).size;
  const competitorGroups = new Set(
    state.competitorGroups.map((group) => group.groupId),
  ).size;
  const trackedKeywords =
    new Set(state.trackedKeywords.map((keyword) => getTrackedKeywordIdentityKey(keyword))).size +
    new Set(
      state.competitorTrackedKeywords.map((keyword) =>
        getCompetitorTrackedKeywordIdentityKey(keyword),
      ),
    ).size;
  const activity = getTrackedKeywordActivity(
    state,
    limits || {
      trackedApps: null,
      competitorGroups: null,
      trackedKeywords: null,
    },
  );

  return {
    trackedApps,
    competitorGroups,
    trackedKeywords,
    activeTrackedKeywords: activity.activeTrackedKeywords,
    pausedTrackedKeywords: activity.pausedTrackedKeywords,
  };
}
