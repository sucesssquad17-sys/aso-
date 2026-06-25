import assert from "node:assert/strict";
import test from "node:test";

import {
  BILLING_PLANS,
  getPlanPriceLabel,
  type BillingPricingCatalog,
} from "../src/lib/billing";

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
