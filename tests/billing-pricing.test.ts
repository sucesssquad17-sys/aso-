import assert from "node:assert/strict";
import test from "node:test";

import {
  BILLING_PLANS,
  PUBLIC_BILLING_PLANS,
  getYearlyMonthlyEquivalentLabel,
  getPlanPriceLabel,
  type BillingPricingCatalog,
} from "../src/lib/billing";
import {
  getPlanEntitlements,
  preserveRestrictedState,
} from "../src/lib/planLimits";

const starterPlan = BILLING_PLANS.find((plan) => plan.id === "starter");

test("paid plan prices do not fall back to local hardcoded amounts", () => {
  assert.ok(starterPlan);
  assert.equal(getPlanPriceLabel(null, starterPlan, "monthly"), null);
  assert.equal(getPlanPriceLabel(null, starterPlan, "yearly"), null);
});

test("paid plan prices use Dodo pricing catalog labels", () => {
  assert.ok(starterPlan);

  const pricingCatalog: BillingPricingCatalog = {
    configured: true,
    productConfigured: true,
    availablePlans: ["starter", "agency"],
    availableBillingIntervals: ["monthly"],
    availablePlanIntervals: {
      indie: [],
      starter: ["monthly"],
      pro: [],
    },
    planPricing: {
      indie: {},
      starter: {
        monthly: {
          productId: "pdt_starter_monthly",
          priceLabel: "$42/mo",
          currency: "USD",
          amount: 4200,
          productName: "Starter Monthly",
        },
      },
      pro: {},
    },
    environment: "test",
  };

  assert.equal(getPlanPriceLabel(pricingCatalog, starterPlan, "monthly"), "$42/mo");
  assert.equal(getPlanPriceLabel(pricingCatalog, starterPlan, "yearly"), null);
});

test("yearly pricing displays the monthly equivalent instead of compounding the yearly total", () => {
  const indiePlan = BILLING_PLANS.find((plan) => plan.id === "indie");
  assert.ok(indiePlan);

  const pricingCatalog: BillingPricingCatalog = {
    configured: true,
    productConfigured: true,
    availablePlans: ["indie"],
    availableBillingIntervals: ["yearly"],
    availablePlanIntervals: {
      indie: ["yearly"],
      starter: [],
      pro: [],
    },
    planPricing: {
      indie: {
        yearly: {
          productId: "pdt_indie_yearly",
          priceLabel: "$289/year",
          currency: "USD",
          amount: 28900,
          productName: "Indie Yearly",
        },
      },
      starter: {},
      pro: {},
    },
    environment: "test",
  };

  assert.equal(getYearlyMonthlyEquivalentLabel(pricingCatalog, indiePlan), "$24");
});

test("public pricing includes the free tier", () => {
  assert.equal(PUBLIC_BILLING_PLANS.some((plan) => plan.id === "free"), true);
});

test("free plan entitlements disable reports and alerts", () => {
  const freeEntitlements = getPlanEntitlements("free");
  assert.deepEqual(freeEntitlements, {
    reportsWorkspace: false,
    weeklyEmailReports: false,
    alertRules: false,
    alertDelivery: false,
    competitorTracking: false,
    automatedTracking: false,
    alerts: false,
    browserPush: false,
    dataExport: false,
  });
});

test("paid plan entitlements keep reports and alerts enabled", () => {
  const proEntitlements = getPlanEntitlements("pro");
  assert.deepEqual(proEntitlements, {
    reportsWorkspace: true,
    weeklyEmailReports: true,
    alertRules: true,
    alertDelivery: true,
    competitorTracking: true,
    automatedTracking: true,
    alerts: true,
    browserPush: true,
    dataExport: true,
  });
});

test("paid-only settings cannot veto unrelated free-plan state saves", () => {
  const savedPushSettings = { pushEnabled: false, permission: "default" };
  const requestedPushSettings = { pushEnabled: true, permission: "granted" };

  assert.equal(
    preserveRestrictedState(
      savedPushSettings,
      requestedPushSettings,
      getPlanEntitlements("free").browserPush,
    ),
    savedPushSettings,
  );
  assert.equal(
    preserveRestrictedState(
      savedPushSettings,
      requestedPushSettings,
      getPlanEntitlements("pro").browserPush,
    ),
    requestedPushSettings,
  );
});
