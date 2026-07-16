import assert from "node:assert/strict";
import test from "node:test";

import {
  getBillingFeatureEntitlements,
  hasPlanFeature,
  resolveBillingAccess,
} from "../src/lib/billingAccess";

test("no subscription resolves to free_active", () => {
  const resolved = resolveBillingAccess({});

  assert.equal(resolved.entitlementState, "free_active");
  assert.equal(resolved.effectivePlanId, "free");
  assert.equal(resolved.hasPaidAccess, false);
});

test("active paid subscription resolves to paid_active", () => {
  const resolved = resolveBillingAccess({
    subscribedPlanId: "starter",
    providerSubscriptionStatus: "active",
  });

  assert.equal(resolved.entitlementState, "paid_active");
  assert.equal(resolved.effectivePlanId, "starter");
  assert.equal(resolved.hasPaidAccess, true);
});

test("cancel at period end keeps paid access before currentPeriodEnd", () => {
  const resolved = resolveBillingAccess(
    {
      subscribedPlanId: "pro",
      providerSubscriptionStatus: "cancelled",
      subscriptionCancelAtPeriodEnd: true,
      subscriptionCurrentPeriodEnd: "2026-07-20T00:00:00.000Z",
    },
    {
      now: new Date("2026-07-16T00:00:00.000Z"),
    },
  );

  assert.equal(resolved.entitlementState, "paid_canceling");
  assert.equal(resolved.effectivePlanId, "pro");
  assert.equal(resolved.hasPaidAccess, true);
});

test("cancelled subscription after period end resolves to expired_to_free", () => {
  const resolved = resolveBillingAccess(
    {
      subscribedPlanId: "pro",
      providerSubscriptionStatus: "cancelled",
      subscriptionCancelAtPeriodEnd: true,
      subscriptionCurrentPeriodEnd: "2026-07-10T00:00:00.000Z",
    },
    {
      now: new Date("2026-07-16T00:00:00.000Z"),
    },
  );

  assert.equal(resolved.entitlementState, "expired_to_free");
  assert.equal(resolved.effectivePlanId, "free");
  assert.equal(resolved.hasPaidAccess, false);
});

test("failed subscriptions resolve to payment_issue without becoming active free", () => {
  const resolved = resolveBillingAccess({
    subscribedPlanId: "indie",
    providerSubscriptionStatus: "failed",
  });

  assert.equal(resolved.entitlementState, "payment_issue");
  assert.equal(resolved.subscribedPlanId, "indie");
  assert.equal(resolved.effectivePlanId, "free");
});

test("billing review blocks paid access without losing the subscribed plan identity", () => {
  const resolved = resolveBillingAccess({
    subscribedPlanId: "starter",
    providerSubscriptionStatus: "active",
    billingReviewRequired: true,
    billingReviewReason: "metadata_mismatch",
  });

  assert.equal(resolved.entitlementState, "billing_review");
  assert.equal(resolved.subscribedPlanId, "starter");
  assert.equal(resolved.effectivePlanId, "free");
  assert.equal(resolved.hasPaidAccess, false);
});

test("fresh pending checkout resolves to checkout_pending", () => {
  const resolved = resolveBillingAccess(
    {
      pendingPlanId: "starter",
      pendingInterval: "monthly",
      subscriptionUpdatedAt: "2026-07-16T00:05:00.000Z",
    },
    {
      now: new Date("2026-07-16T00:10:00.000Z"),
    },
  );

  assert.equal(resolved.entitlementState, "checkout_pending");
  assert.equal(resolved.pendingPlanId, "starter");
  assert.equal(resolved.accessState, "activating");
});

test("feature entitlements keep export and alerts paid-only on free", () => {
  const freeEntitlements = getBillingFeatureEntitlements("free");
  const paidEntitlements = getBillingFeatureEntitlements("pro");

  assert.equal(hasPlanFeature(freeEntitlements, "alerts"), false);
  assert.equal(hasPlanFeature(freeEntitlements, "dataExport"), false);
  assert.equal(hasPlanFeature(paidEntitlements, "alerts"), true);
  assert.equal(hasPlanFeature(paidEntitlements, "dataExport"), true);
});

test("legacy paid records keep paid access when isPremium is true and provider status is missing", () => {
  const resolved = resolveBillingAccess({
    isPremium: true,
    subscriptionTier: "indie",
  });

  assert.equal(resolved.entitlementState, "paid_active");
  assert.equal(resolved.effectivePlanId, "indie");
  assert.equal(resolved.hasPaidAccess, true);
});

test("legacy paid records can recover the plan from dodoProductId fallback", () => {
  const resolved = resolveBillingAccess(
    {
      isPremium: true,
    },
    {
      fallbackProductPlanId: "starter",
    },
  );

  assert.equal(resolved.entitlementState, "paid_active");
  assert.equal(resolved.effectivePlanId, "starter");
  assert.equal(resolved.hasPaidAccess, true);
});

test("legacy free records do not gain paid access from a paid tier string alone", () => {
  const resolved = resolveBillingAccess({
    isPremium: false,
    subscriptionTier: "pro",
  });

  assert.equal(resolved.entitlementState, "free_active");
  assert.equal(resolved.effectivePlanId, "free");
  assert.equal(resolved.hasPaidAccess, false);
});
