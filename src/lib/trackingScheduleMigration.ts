import {
  getBillingFeatureEntitlements,
  resolveBillingAccess,
  type BillingResolutionInput,
} from "./billingAccess";

export type TrackingScheduleBackfillReason =
  | "eligible"
  | "deleted"
  | "explicit_preference"
  | "no_tracked_data"
  | "ineligible_plan";

type TrackingScheduleBackfillInput = BillingResolutionInput & {
  competitorGroups?: unknown[];
  competitorTrackedKeywords?: unknown[];
  trackedKeywords?: unknown[];
  trackingSchedule?: { enabled?: unknown };
};

export function getTrackingScheduleBackfillReason(
  data: TrackingScheduleBackfillInput,
): TrackingScheduleBackfillReason {
  if (data.accountStatus === "deleted" || data.accountStatus === "deleting") {
    return "deleted";
  }
  if (typeof data.trackingSchedule?.enabled === "boolean") {
    return "explicit_preference";
  }
  const hasTrackedData =
    (Array.isArray(data.trackedKeywords) && data.trackedKeywords.length > 0) ||
    (Array.isArray(data.competitorTrackedKeywords) && data.competitorTrackedKeywords.length > 0) ||
    (Array.isArray(data.competitorGroups) && data.competitorGroups.length > 0);
  if (!hasTrackedData) {
    return "no_tracked_data";
  }

  const billing = resolveBillingAccess(data, { fallbackProductPlanId: null });
  return getBillingFeatureEntitlements(billing.effectivePlanId).automatedTracking
    ? "eligible"
    : "ineligible_plan";
}
