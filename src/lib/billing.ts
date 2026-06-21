import {
  type BillingPlanId,
  type PlanLimits,
  type PlanUsage,
  getPlanLimitFeatureLines,
} from "./planLimits";

export type { BillingPlanId, PlanLimits, PlanUsage } from "./planLimits";
export type BillingInterval = "monthly" | "yearly";
export type PaidBillingPlanId = Exclude<BillingPlanId, "free" | "agency">;
export type BillingAccessState = "selection_required" | "activating" | "active";

export type BillingPlanPrice = {
  productId: string;
  priceLabel: string | null;
  currency: string | null;
  amount: number | null;
  productName: string | null;
};

export type BillingStatus = {
  configured: boolean;
  productConfigured: boolean;
  customerPortalAvailable: boolean;
  accessState: BillingAccessState;
  availablePlans: BillingPlanId[];
  availableBillingIntervals?: BillingInterval[];
  availablePlanIntervals?: Partial<Record<PaidBillingPlanId, BillingInterval[]>>;
  planPricing?: Partial<
    Record<PaidBillingPlanId, Partial<Record<BillingInterval, BillingPlanPrice>>>
  >;
  environment: "test" | "live";
  isPremium: boolean;
  billingReviewRequired?: boolean;
  billingReviewReason?: string | null;
  accountStatus?: "active" | "deleted" | null;
  subscriptionTier?: string | null;
  subscriptionInterval?: BillingInterval | null;
  subscriptionStatus?: string | null;
  pendingPlanId?: BillingPlanId | null;
  pendingInterval?: BillingInterval | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd: boolean;
  planLimits?: PlanLimits | null;
  usage?: PlanUsage | null;
};

export type BillingPlanDefinition = {
  id: BillingPlanId;
  name: string;
  priceLabel: string;
  description: string;
  cta: string;
  badge?: string;
  highlight?: boolean;
  contactOnly?: boolean;
  features: string[];
};

export type PricingIncludedCapability = {
  label: string;
  sub: string;
};

export const PRICING_INCLUDED_COPY =
  "All workflow features are available on every plan. Only tracked apps, competitor groups, and tracked keyword capacity scale by tier.";

export const PRICING_INCLUDED_CAPABILITIES: PricingIncludedCapability[] = [
  { label: "App Store & Google Play tracking", sub: "iOS + Android in one workspace" },
  { label: "Keyword rank tracking", sub: "Per country, per store" },
  { label: "Competitor analysis", sub: "Track rivals side by side" },
  { label: "Daily automated monitoring", sub: "Runs every day, hands-free" },
  { label: "Rank change alerts", sub: "Notified when positions shift" },
  { label: "Trend charts & history", sub: "See rank movement over time" },
  { label: "Competitor battle mode", sub: "Head-to-head keyword overlap" },
  { label: "PDF reports & data export", sub: "Share or archive at any time" },
];

const PLAN_SHARED_FEATURES = PRICING_INCLUDED_CAPABILITIES.map(
  (capability) => capability.label,
);

export const BILLING_PLANS: BillingPlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    priceLabel: "$0",
    description: "Try the full workflow with a small portfolio.",
    cta: "Continue on free",
    features: [...getPlanLimitFeatureLines("free")],
  },
  {
    id: "indie",
    name: "Indie",
    priceLabel: "$19/mo",
    description: "For solo builders managing a growing app portfolio.",
    cta: "Choose Indie",
    features: [...getPlanLimitFeatureLines("indie")],
  },
  {
    id: "starter",
    name: "Starter",
    priceLabel: "$49/mo",
    description: "For growing portfolios that need consistent weekly insight.",
    cta: "Choose Starter",
    badge: "Popular",
    highlight: true,
    features: [...getPlanLimitFeatureLines("starter")],
  },
  {
    id: "pro",
    name: "Pro",
    priceLabel: "$99/mo",
    description: "For full-funnel ASO operations across multiple launches.",
    cta: "Choose Pro",
    features: [...getPlanLimitFeatureLines("pro")],
  },
  {
    id: "agency",
    name: "Agency",
    priceLabel: "Custom",
    description: "For client portfolios and teams that need tailored limits.",
    cta: "Contact sales",
    contactOnly: true,
    features: [...getPlanLimitFeatureLines("agency")],
  },
];

export const PUBLIC_BILLING_PLANS = BILLING_PLANS.filter(
  (plan) => plan.id !== "free",
);

export const DEFAULT_PUBLIC_BILLING_PLAN_IDS: BillingPlanId[] = [
  "indie",
  "starter",
  "pro",
  "agency",
];

export function getAvailableBillingIntervals(
  billingStatus: BillingStatus | null,
): BillingInterval[] {
  const intervals = billingStatus?.availableBillingIntervals?.filter(Boolean);
  return intervals && intervals.length > 0 ? intervals : ["monthly"];
}

export function getPlanBillingIntervals(
  billingStatus: BillingStatus | null,
  planId: BillingPlanId,
): BillingInterval[] {
  if (planId === "free" || planId === "agency") {
    return [];
  }

  const intervals = billingStatus?.availablePlanIntervals?.[planId]?.filter(Boolean);
  return intervals && intervals.length > 0 ? intervals : ["monthly"];
}

export function getPlanPriceLabel(
  billingStatus: BillingStatus | null,
  plan: BillingPlanDefinition,
  interval: BillingInterval,
): string | null {
  if (plan.id === "free" || plan.id === "agency") {
    return plan.priceLabel;
  }

  const configuredLabel = billingStatus?.planPricing?.[plan.id]?.[interval]?.priceLabel;
  if (configuredLabel) {
    return configuredLabel;
  }

  return interval === "monthly" ? plan.priceLabel : null;
}
