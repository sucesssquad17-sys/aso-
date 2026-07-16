import {
  getPlanEntitlements,
  resolveBillingPlanId,
  type BillingPlanId,
  type PlanEntitlements,
} from "./planLimits";

export type BillingInterval = "monthly" | "yearly";
export type BillingSubscriptionStatus =
  | "pending"
  | "active"
  | "on_hold"
  | "cancelled"
  | "failed"
  | "expired";
export type BillingEntitlementState =
  | "free_active"
  | "checkout_pending"
  | "paid_active"
  | "paid_canceling"
  | "payment_issue"
  | "billing_review"
  | "expired_to_free"
  | "account_deleted";
export type BillingFeature =
  | "competitorTracking"
  | "automatedTracking"
  | "alerts"
  | "browserPush"
  | "weeklyReports"
  | "dataExport";
export type BillingAccessState = "selection_required" | "activating" | "active";

export type BillingResolutionInput = {
  accountStatus?: "active" | "deleting" | "deleted" | null;
  subscriptionTier?: string | null;
  subscribedPlanId?: string | null;
  dodoProductId?: string | null;
  subscriptionStatus?: string | null;
  providerSubscriptionStatus?: string | null;
  pendingPlanId?: string | null;
  pendingInterval?: string | null;
  subscriptionCurrentPeriodEnd?: string | null;
  subscriptionCancelAtPeriodEnd?: boolean | null;
  subscriptionUpdatedAt?: string | null;
  billingReviewRequired?: boolean | null;
  billingReviewReason?: string | null;
};

export type ResolvedBillingAccess = {
  effectivePlanId: BillingPlanId;
  subscribedPlanId: BillingPlanId;
  providerStatus: BillingSubscriptionStatus | null;
  entitlementState: BillingEntitlementState;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  pendingPlanId: BillingPlanId | null;
  pendingInterval: BillingInterval | null;
  billingReviewRequired: boolean;
  billingReviewReason: string | null;
  accessState: BillingAccessState;
  hasPaidAccess: boolean;
};

const BILLING_ACTIVATION_STALE_AFTER_MS = 10 * 60 * 1000;

function normalizeSubscriptionStatus(
  status?: string | null,
): BillingSubscriptionStatus | null {
  return status === "pending" ||
    status === "active" ||
    status === "on_hold" ||
    status === "cancelled" ||
    status === "failed" ||
    status === "expired"
    ? status
    : null;
}

function normalizePendingPlanId(planId?: string | null): BillingPlanId | null {
  return planId === "indie" ||
    planId === "starter" ||
    planId === "pro" ||
    planId === "agency"
    ? planId
    : null;
}

function normalizeBillingInterval(
  interval?: string | null,
): BillingInterval | null {
  return interval === "yearly" || interval === "monthly" ? interval : null;
}

function parseIsoMs(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function hasPlanFeature(
  entitlements: PlanEntitlements,
  feature: BillingFeature,
) {
  switch (feature) {
    case "competitorTracking":
      return entitlements.competitorTracking;
    case "automatedTracking":
      return entitlements.automatedTracking;
    case "alerts":
      return entitlements.alerts;
    case "browserPush":
      return entitlements.browserPush;
    case "weeklyReports":
      return entitlements.weeklyEmailReports;
    case "dataExport":
      return entitlements.dataExport;
    default:
      return false;
  }
}

export function getBillingFeatureEntitlements(
  planId?: string | null,
): PlanEntitlements {
  return getPlanEntitlements(resolveBillingPlanId(planId));
}

export function resolveBillingAccess(
  input: BillingResolutionInput | null | undefined,
  options?: {
    now?: Date;
    fallbackProductPlanId?: BillingPlanId | null;
    activationStaleAfterMs?: number;
  },
): ResolvedBillingAccess {
  const now = options?.now || new Date();
  const nowMs = now.getTime();
  const providerStatus = normalizeSubscriptionStatus(
    input?.providerSubscriptionStatus || input?.subscriptionStatus,
  );
  const subscribedPlanId = resolveBillingPlanId(
    input?.subscribedPlanId ||
      input?.subscriptionTier ||
      options?.fallbackProductPlanId ||
      "free",
  );
  const pendingPlanId = normalizePendingPlanId(input?.pendingPlanId);
  const pendingInterval = normalizeBillingInterval(input?.pendingInterval);
  const currentPeriodEnd = input?.subscriptionCurrentPeriodEnd || null;
  const currentPeriodEndMs = parseIsoMs(currentPeriodEnd);
  const cancelAtPeriodEnd = Boolean(input?.subscriptionCancelAtPeriodEnd);
  const billingReviewRequired = Boolean(input?.billingReviewRequired);
  const billingReviewReason = input?.billingReviewReason || null;
  const accountDeleted =
    input?.accountStatus === "deleted" || input?.accountStatus === "deleting";
  const updatedAtMs = parseIsoMs(input?.subscriptionUpdatedAt);
  const pendingCheckoutFresh = Boolean(
    pendingPlanId &&
      updatedAtMs &&
      nowMs - updatedAtMs <
        (options?.activationStaleAfterMs || BILLING_ACTIVATION_STALE_AFTER_MS),
  );
  const paidPeriodStillActive = Boolean(
    subscribedPlanId !== "free" &&
      cancelAtPeriodEnd &&
      currentPeriodEndMs &&
      currentPeriodEndMs > nowMs,
  );

  let entitlementState: BillingEntitlementState;
  let hasPaidAccess = false;

  if (accountDeleted) {
    entitlementState = "account_deleted";
  } else if (billingReviewRequired) {
    entitlementState = "billing_review";
  } else if (providerStatus === "active" && subscribedPlanId !== "free") {
    entitlementState = "paid_active";
    hasPaidAccess = true;
  } else if (providerStatus === "cancelled" && paidPeriodStillActive) {
    entitlementState = "paid_canceling";
    hasPaidAccess = true;
  } else if (
    providerStatus === "failed" ||
    providerStatus === "on_hold"
  ) {
    entitlementState = "payment_issue";
  } else if (
    providerStatus === "expired" ||
    (providerStatus === "cancelled" && !paidPeriodStillActive)
  ) {
    entitlementState = "expired_to_free";
  } else if (pendingCheckoutFresh) {
    entitlementState = "checkout_pending";
  } else {
    entitlementState = "free_active";
  }

  const effectivePlanId = hasPaidAccess ? subscribedPlanId : "free";
  const accessState: BillingAccessState =
    entitlementState === "checkout_pending"
      ? "activating"
      : entitlementState === "account_deleted"
        ? "selection_required"
        : "active";

  return {
    effectivePlanId,
    subscribedPlanId,
    providerStatus,
    entitlementState,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    pendingPlanId,
    pendingInterval,
    billingReviewRequired,
    billingReviewReason,
    accessState,
    hasPaidAccess,
  };
}
