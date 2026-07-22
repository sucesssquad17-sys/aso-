import {
  type BillingPlanId,
  type PlanEntitlements,
  type PlanLimits,
  type PlanUsage,
  getPlanEntitlements,
  getPlanLimitFeatureLines,
} from "./planLimits";

export type {
  BillingPlanId,
  PlanEntitlements,
  PlanLimits,
  PlanUsage,
} from "./planLimits";
export type BillingInterval = "monthly" | "yearly";
export type PaidBillingPlanId = Exclude<BillingPlanId, "free" | "agency">;
export type BillingAccessState = "selection_required" | "activating" | "active";
export type BillingEntitlementState =
  | "free_active"
  | "checkout_pending"
  | "paid_active"
  | "paid_canceling"
  | "payment_issue"
  | "billing_review"
  | "expired_to_free"
  | "account_deleted";

export type BillingTransition = {
  type: "checkout_pending" | "cancel_at_period_end";
  fromPlanId: BillingPlanId | null;
  toPlanId: BillingPlanId | null;
  effectiveAt: string | null;
  pending: boolean;
};

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
  effectivePlanId?: BillingPlanId | null;
  subscribedPlanId?: BillingPlanId | null;
  subscriptionInterval?: BillingInterval | null;
  subscriptionStatus?: string | null;
  providerStatus?: string | null;
  entitlementState?: BillingEntitlementState | null;
  pendingPlanId?: BillingPlanId | null;
  pendingInterval?: BillingInterval | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd: boolean;
  planLimits?: PlanLimits | null;
  planEntitlements?: PlanEntitlements | null;
  usage?: PlanUsage | null;
  transition?: BillingTransition | null;
};

export type BillingPricingCatalog = Pick<
  BillingStatus,
  | "configured"
  | "productConfigured"
  | "availablePlans"
  | "availableBillingIntervals"
  | "availablePlanIntervals"
  | "planPricing"
  | "environment"
>;

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

export type PricingComparisonRow = {
  label: string;
  type: "limit" | "feature";
  values: Record<BillingPlanId, string>;
};

export const PRICING_INCLUDED_COPY =
  "Every plan includes core tracking and keyword research. Paid tiers add reports, alerts, and weekly summaries.";

export const FREE_CAPABILITIES: PricingIncludedCapability[] = [
  { label: "App Store & Google Play tracking", sub: "iOS + Android in one workspace" },
  { label: "Keyword rank tracking", sub: "Per country, per store" },
  { label: "AI-Powered Keyword Discovery", sub: "Intelligent keyword recommendations" },
  { label: "Manual rank refresh", sub: "Check current visibility when you need it" },
  { label: "Bookmarks and saved apps", sub: "Keep important listings ready to reopen" },
];

export const PAID_CAPABILITIES: PricingIncludedCapability[] = [
  { label: "Competitor ASO change alerts", sub: "Rival ASO change alerts" },
  { label: "Competitor analysis", sub: "Track rivals side by side" },
  { label: "Daily automated monitoring", sub: "Runs every day, hands-free" },
  { label: "Rank change alerts", sub: "Notified when positions shift" },
  { label: "Trend charts & history", sub: "See rank movement over time" },
  { label: "Weekly Email Reports", sub: "Movement summaries delivered to your inbox" },
  { label: "PDF reports & data export", sub: "Share or archive at any time" },
];

export const ALL_PLATFORM_CAPABILITIES = [...FREE_CAPABILITIES, ...PAID_CAPABILITIES];
export const PRICING_INCLUDED_CAPABILITIES = ALL_PLATFORM_CAPABILITIES;

const PLAN_SHARED_FEATURES = ALL_PLATFORM_CAPABILITIES.map(
  (capability) => capability.label,
);

export const BILLING_PLANS: BillingPlanDefinition[] = [
  {
    id: "free",
    name: "Free",
    priceLabel: "$0",
    description: "Start with core tracking for a small portfolio.",
    cta: "Continue on free",
    features: [...getPlanLimitFeatureLines("free")],
  },
  {
    id: "indie",
    name: "Indie",
    priceLabel: "Live pricing",
    description: "For solo builders managing a growing app portfolio.",
    cta: "Choose Indie",
    features: [...getPlanLimitFeatureLines("indie")],
  },
  {
    id: "starter",
    name: "Starter",
    priceLabel: "Live pricing",
    description: "For growing portfolios that need consistent weekly insight.",
    cta: "Choose Starter",
    badge: "Popular",
    highlight: true,
    features: [...getPlanLimitFeatureLines("starter")],
  },
  {
    id: "pro",
    name: "Pro",
    priceLabel: "Live pricing",
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
  () => true,
);

export const DISPLAY_BILLING_PLANS = PUBLIC_BILLING_PLANS.filter(
  (plan) => plan.id !== "agency",
);

export const DEFAULT_PUBLIC_BILLING_PLAN_IDS: BillingPlanId[] = [
  "free",
  "indie",
  "starter",
  "pro",
  "agency",
];

function formatPlanLimitValue(value: number | null, singular: string, plural: string) {
  if (value === null) {
    return "Custom";
  }
  return `${value.toLocaleString()} ${value === 1 ? singular : plural}`;
}

function formatEntitlementValue(enabled: boolean) {
  return enabled ? "✓" : "✕";
}

export const PRICING_COMPARISON_ROWS: PricingComparisonRow[] = [
  {
    label: "Tracked apps",
    type: "limit",
    values: {
      free: formatPlanLimitValue(1, "app", "apps"),
      indie: formatPlanLimitValue(3, "app", "apps"),
      starter: formatPlanLimitValue(8, "app", "apps"),
      pro: formatPlanLimitValue(20, "app", "apps"),
      agency: formatPlanLimitValue(null, "app", "apps"),
    },
  },
  {
    label: "Competitor groups",
    type: "limit",
    values: {
      free: formatPlanLimitValue(1, "group", "groups"),
      indie: formatPlanLimitValue(2, "group", "groups"),
      starter: formatPlanLimitValue(5, "group", "groups"),
      pro: formatPlanLimitValue(10, "group", "groups"),
      agency: formatPlanLimitValue(null, "group", "groups"),
    },
  },
  {
    label: "Tracked keywords",
    type: "limit",
    values: {
      free: formatPlanLimitValue(10, "keyword", "keywords"),
      indie: formatPlanLimitValue(100, "keyword", "keywords"),
      starter: formatPlanLimitValue(300, "keyword", "keywords"),
      pro: formatPlanLimitValue(1000, "keyword", "keywords"),
      agency: formatPlanLimitValue(null, "keyword", "keywords"),
    },
  },
  {
    label: "Reports workspace",
    type: "feature",
    values: {
      free: formatEntitlementValue(getPlanEntitlements("free").reportsWorkspace),
      indie: formatEntitlementValue(getPlanEntitlements("indie").reportsWorkspace),
      starter: formatEntitlementValue(getPlanEntitlements("starter").reportsWorkspace),
      pro: formatEntitlementValue(getPlanEntitlements("pro").reportsWorkspace),
      agency: formatEntitlementValue(getPlanEntitlements("agency").reportsWorkspace),
    },
  },
  {
    label: "Alert rules",
    type: "feature",
    values: {
      free: formatEntitlementValue(getPlanEntitlements("free").alertRules),
      indie: formatEntitlementValue(getPlanEntitlements("indie").alertRules),
      starter: formatEntitlementValue(getPlanEntitlements("starter").alertRules),
      pro: formatEntitlementValue(getPlanEntitlements("pro").alertRules),
      agency: formatEntitlementValue(getPlanEntitlements("agency").alertRules),
    },
  },
  {
    label: "Alert delivery",
    type: "feature",
    values: {
      free: formatEntitlementValue(getPlanEntitlements("free").alertDelivery),
      indie: formatEntitlementValue(getPlanEntitlements("indie").alertDelivery),
      starter: formatEntitlementValue(getPlanEntitlements("starter").alertDelivery),
      pro: formatEntitlementValue(getPlanEntitlements("pro").alertDelivery),
      agency: formatEntitlementValue(getPlanEntitlements("agency").alertDelivery),
    },
  },
  {
    label: "Weekly email reports",
    type: "feature",
    values: {
      free: formatEntitlementValue(getPlanEntitlements("free").weeklyEmailReports),
      indie: formatEntitlementValue(getPlanEntitlements("indie").weeklyEmailReports),
      starter: formatEntitlementValue(getPlanEntitlements("starter").weeklyEmailReports),
      pro: formatEntitlementValue(getPlanEntitlements("pro").weeklyEmailReports),
      agency: formatEntitlementValue(getPlanEntitlements("agency").weeklyEmailReports),
    },
  },
];

export function getAvailableBillingIntervals(
  billingStatus: BillingStatus | BillingPricingCatalog | null,
): BillingInterval[] {
  const intervals = billingStatus?.availableBillingIntervals?.filter(Boolean);
  return intervals && intervals.length > 0 ? intervals : ["monthly"];
}

export function getPlanBillingIntervals(
  billingStatus: BillingStatus | BillingPricingCatalog | null,
  planId: BillingPlanId,
): BillingInterval[] {
  if (planId === "free" || planId === "agency") {
    return [];
  }

  const intervals = billingStatus?.availablePlanIntervals?.[planId]?.filter(Boolean);
  return intervals && intervals.length > 0 ? intervals : ["monthly"];
}

export function getPlanPriceLabel(
  billingStatus: BillingStatus | BillingPricingCatalog | null,
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

  return null;
}

export function getPlanPrice(
  billingStatus: BillingStatus | BillingPricingCatalog | null,
  plan: BillingPlanDefinition,
  interval: BillingInterval,
): BillingPlanPrice | null {
  if (plan.id === "free" || plan.id === "agency") {
    return null;
  }

  return billingStatus?.planPricing?.[plan.id]?.[interval] || null;
}

export function formatBillingAmountFromMinorUnits(
  amount: number | null | undefined,
  currency: string | null | undefined,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  },
) {
  if (typeof amount !== "number" || !currency) {
    return null;
  }

  try {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.trim().toUpperCase(),
      minimumFractionDigits: options?.minimumFractionDigits,
      maximumFractionDigits: options?.maximumFractionDigits,
    });
    const fractionDigits =
      formatter.resolvedOptions().maximumFractionDigits ?? 2;
    return formatter.format(amount / 10 ** fractionDigits);
  } catch {
    return null;
  }
}

export function getYearlyMonthlyEquivalentLabel(
  billingStatus: BillingStatus | BillingPricingCatalog | null,
  plan: BillingPlanDefinition,
) {
  const yearlyPrice = getPlanPrice(billingStatus, plan, "yearly");
  if (
    !yearlyPrice ||
    typeof yearlyPrice.amount !== "number" ||
    !yearlyPrice.currency
  ) {
    return null;
  }

  const normalizedCurrency = yearlyPrice.currency.trim().toUpperCase();

  try {
    const currencyFormatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency,
    });
    const roundingFormatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    const fractionDigits =
      currencyFormatter.resolvedOptions().maximumFractionDigits ?? 2;
    const yearlyMajorUnits = yearlyPrice.amount / 10 ** fractionDigits;
    return roundingFormatter.format(Math.round(yearlyMajorUnits / 12));
  } catch {
    return formatBillingAmountFromMinorUnits(yearlyPrice.amount / 12, yearlyPrice.currency, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
}
