import React from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bell,
  Briefcase,
  Check,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  ExternalLink,
  FileText,
  Gift,
  Globe,
  Headphones,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Star,
  Swords,
  TrendingUp,
  Users,
  Zap,
  Target,
} from "lucide-react";
import {
  type BillingAccessState,
  PUBLIC_BILLING_PLANS,
  DEFAULT_PUBLIC_BILLING_PLAN_IDS,
  getAvailableBillingIntervals,
  getPlanBillingIntervals,
  getPlanPriceLabel,
  PRICING_INCLUDED_CAPABILITIES,
  type BillingInterval,
  type BillingPlanDefinition,
  type BillingPlanId,
  type BillingStatus,
} from "../../lib/billing";
import {
  getBillingPlanRank,
  getPlanLimitFeatureLines,
  getPlanLimits,
} from "../../lib/planLimits";

interface UpgradePageProps {
  billingStatus: BillingStatus | null;
  accessState: BillingAccessState;
  billingError: string | null;
  isLoading: boolean;
  isStartingCheckout: boolean;
  isOpeningPortal: boolean;
  currentUserLabel: string;
  currentUserEmail?: string | null;
  isPollingActivation?: boolean;
  activationTimedOut?: boolean;
  onStartCheckout: (planId: BillingPlanId, interval: BillingInterval) => void;
  onOpenPortal: () => void;
  onRetryBillingStatus: () => void;
  onSignOut: () => void;
  onReturn?: () => void;
}

function formatDate(value?: string | null) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function getCurrentPlanId(billingStatus: BillingStatus | null): BillingPlanId {
  if (!billingStatus?.isPremium) return "free";
  const id = billingStatus.subscriptionTier;
  if (id === "indie" || id === "starter" || id === "pro" || id === "agency") return id;
  return "free";
}

function formatIntervalLabel(interval?: BillingInterval | null) {
  return interval === "yearly" ? "Yearly" : "Monthly";
}

function stripBillingCadence(priceLabel: string) {
  return priceLabel.replace(/\/(?:mo|yr)$/i, "");
}

function getBillingCadence(priceLabel: string | null) {
  return priceLabel?.match(/\/(?:mo|yr)$/i)?.[0] || "";
}

const FEATURE_ICONS: Record<string, React.ElementType> = {
  "App Store & Google Play tracking": Globe,
  "Keyword rank tracking": TrendingUp,
  "AI-Powered Keyword Discovery": Sparkles,
  "ASO Comparison": Target,
  "Competitor analysis": Swords,
  "Daily automated monitoring": Zap,
  "Rank change alerts": Bell,
  "Trend charts & history": BarChart3,
  "Weekly Email Reports": Mail,
  "PDF reports & data export": FileText,
};

const PLAN_ICONS: Record<string, React.ElementType> = {
  "free": Gift,
  "indie": Users,
  "starter": Star,
  "pro": Zap,
  "agency": Briefcase,
};

function UsageBar({
  used,
  total,
  label,
}: {
  used: number;
  total: number | null;
  label: string;
}) {
  const pct =
    total === null
      ? 0
      : Math.min(100, Math.round((used / Math.max(total, 1)) * 100));
  const isNear = pct >= 80;
  const isAt = pct >= 100;

  const textColor = isAt
    ? "text-red-600 dark:text-red-400"
    : isNear
      ? "text-amber-600 dark:text-amber-400"
      : "text-blue-600 dark:text-blue-400";
      
  const barColor = isAt
    ? "bg-red-500"
    : isNear
      ? "bg-amber-400"
      : "bg-blue-600";

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 sm:mb-2">
        <span className="text-xs font-medium text-slate-600 dark:text-app-text-muted sm:text-[13px]">{label}</span>
        <span className={`text-xs font-bold tabular-nums tracking-wide sm:text-[13px] ${textColor}`}>
          {used} / {total === null ? "∞" : total}
        </span>
      </div>
      {total !== null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-app-surface-strong">
          <div
            className={`h-1.5 rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function formatCapacityLimit(value: number | null, label: string) {
  if (value === null) {
    return `Custom ${label}`;
  }

  return value.toLocaleString();
}

export function UpgradePage({
  billingStatus,
  accessState,
  billingError,
  isLoading,
  isStartingCheckout,
  isOpeningPortal,
  currentUserLabel,
  currentUserEmail,
  isPollingActivation = false,
  activationTimedOut = false,
  onStartCheckout,
  onOpenPortal,
  onRetryBillingStatus,
  onSignOut,
  onReturn,
}: UpgradePageProps) {
  const availableIntervals = getAvailableBillingIntervals(billingStatus);
  const allIntervals: BillingInterval[] = ["monthly", "yearly"];
  const [selectedInterval, setSelectedInterval] = React.useState<BillingInterval>(
    availableIntervals[0] || "monthly",
  );

  // No longer needed — we always show both intervals regardless of what's configured

  const currentPeriodEnd = formatDate(billingStatus?.currentPeriodEnd);
  const availablePlans = new Set(
    billingStatus?.availablePlans || DEFAULT_PUBLIC_BILLING_PLAN_IDS,
  );
  const billingConnected = Boolean(
    billingStatus?.configured && billingStatus?.productConfigured,
  );
  const currentPlanId = getCurrentPlanId(billingStatus);
  const currentPlanRank = getBillingPlanRank(currentPlanId);
  const isPremium = billingStatus?.isPremium;
  const pendingPlan =
    PUBLIC_BILLING_PLANS.find((plan) => plan.id === billingStatus?.pendingPlanId) ||
    null;
  const isSelectionRequired = accessState === "selection_required";
  const isActivating = accessState === "activating";
  const isPendingActivation =
    isActivating && Boolean(pendingPlan) && isPollingActivation && !activationTimedOut;
  const canReturnToWorkspace = Boolean(onReturn) && accessState === "active";
  const signedInAccount = currentUserEmail || currentUserLabel;
  const capacityPreviewPlans = PUBLIC_BILLING_PLANS;
  const [selectedCapacityPlanId, setSelectedCapacityPlanId] =
    React.useState<BillingPlanId>(() => {
      const defaultPlan =
        capacityPreviewPlans.find((plan) => plan.id === "starter") ||
        capacityPreviewPlans[0] ||
        PUBLIC_BILLING_PLANS[0];

      return defaultPlan?.id || "starter";
    });

  React.useEffect(() => {
    if (!capacityPreviewPlans.some((plan) => plan.id === selectedCapacityPlanId)) {
      const fallbackPlan =
        capacityPreviewPlans.find((plan) => plan.id === "starter") ||
        capacityPreviewPlans[0];
      if (fallbackPlan) {
        setSelectedCapacityPlanId(fallbackPlan.id);
      }
    }
  }, [capacityPreviewPlans, selectedCapacityPlanId]);

  const selectedCapacityPlan =
    capacityPreviewPlans.find((plan) => plan.id === selectedCapacityPlanId) ||
    capacityPreviewPlans[0] ||
    null;
  const selectedCapacityLimits = selectedCapacityPlan
    ? getPlanLimits(selectedCapacityPlan.id)
    : null;
  const selectedCapacityPriceLabel = selectedCapacityPlan
    ? getPlanPriceLabel(billingStatus, selectedCapacityPlan, selectedInterval)
    : null;

  const renderCta = (plan: BillingPlanDefinition) => {
    const isCurrentPlan = currentPlanId === plan.id;
    const isPendingPlan = billingStatus?.pendingPlanId === plan.id;
    const isDowngrade =
      Boolean(isPremium) && getBillingPlanRank(plan.id) < currentPlanRank;
    const supportsInterval =
      plan.id === "free" ||
      plan.contactOnly ||
      getPlanBillingIntervals(billingStatus, plan.id).includes(selectedInterval);
    const canChoose =
      plan.id !== "free" &&
      !plan.contactOnly &&
      availablePlans.has(plan.id) &&
      billingConnected &&
      supportsInterval &&
      !isDowngrade;

    const highlightCta =
      "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 sm:py-3 text-sm font-bold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
    
    const normalCta =
      "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 dark:border-blue-900 bg-transparent px-4 py-3.5 sm:py-3 text-sm font-bold text-blue-600 dark:text-blue-400 transition-all hover:border-blue-300 hover:bg-blue-50 dark:hover:border-blue-800 dark:hover:bg-blue-950/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
    
    const currentCta =
      "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-600 bg-transparent px-4 py-3.5 sm:py-3 text-sm font-bold text-blue-600 dark:text-blue-400 cursor-default";

    if (isPendingPlan && isPendingActivation) {
      return (
        <button
          type="button"
          disabled
          className={plan.highlight ? highlightCta : normalCta}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Activating trial
        </button>
      );
    }

    if (isCurrentPlan) {
      return (
        <div className={currentCta}>
          Current plan
        </div>
      );
    }

    if (plan.contactOnly) {
      return (
        <a href="mailto:vantalumstudio@gmail.com" className={normalCta}>
          <Mail className="h-4 w-4" />
          {plan.cta}
        </a>
      );
    }

    if (plan.id === "free") {
      if (isDowngrade) {
        return (
          <button type="button" disabled className={normalCta}>
            Unavailable
          </button>
        );
      }

      return (
        <button type="button" onClick={onReturn} className={normalCta}>
          <ArrowLeft className="h-4 w-4" />
          {plan.cta}
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => onStartCheckout(plan.id, selectedInterval)}
        disabled={isStartingCheckout || !canChoose}
        className={plan.highlight ? highlightCta : normalCta}
      >
        {isStartingCheckout ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : null}
        {isDowngrade
          ? "Unavailable"
          : isPendingPlan && activationTimedOut
            ? "Try again"
            : plan.cta}
      </button>
    );
  };

  return (
    <div className="relative min-h-screen w-full bg-[#fafcff] dark:bg-app-surface">
      {/* ── Decorative Background ────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-[10%] top-0 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-blue-100/50 to-transparent opacity-60 blur-3xl dark:from-blue-900/20" />
        <div className="absolute -right-[5%] top-[5%] h-[700px] w-[700px] rounded-full bg-gradient-to-bl from-blue-50/60 to-transparent opacity-80 blur-3xl dark:from-blue-900/10" />
        <div className="absolute left-0 top-0 h-[500px] w-full" style={{ backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.15) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      </div>

      {/* ── Sticky nav bar ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/50 dark:border-app-border/50 bg-white/80 dark:bg-app-surface/80 px-3 py-2 backdrop-blur-md sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-2">
          {canReturnToWorkspace ? (
            <button
              onClick={onReturn}
              className="group inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 dark:border-app-border dark:bg-app-surface-muted dark:text-app-text-muted dark:hover:bg-app-surface-strong/80 dark:hover:text-white sm:px-3 sm:text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              Back to workspace
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
              <Lock className="h-3.5 w-3.5" />
              {isActivating ? "Trial activation pending" : "Plan selection required"}
            </div>
          )}
          {signedInAccount ? (
            <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm dark:border-app-border dark:bg-app-surface-muted dark:text-app-text-muted lg:inline-flex">
              <Mail className="h-3.5 w-3.5" />
              {signedInAccount}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {billingStatus?.environment === "test" && (
            <span className="rounded-md bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 shadow-sm border border-amber-200/50 dark:bg-amber-900/20 dark:border-amber-800/50 dark:text-amber-500">
              Test mode
            </span>
          )}
          {accessState !== "active" ? (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-app-border dark:bg-app-surface-muted dark:text-app-text-muted dark:hover:bg-app-surface-strong/80 dark:hover:text-white"
            >
              Use different account
            </button>
          ) : null}
          {accessState === "active" && billingStatus?.customerPortalAvailable && (
            <button
              onClick={onOpenPortal}
              disabled={isOpeningPortal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-app-border dark:bg-app-surface-muted dark:text-app-text-muted dark:hover:bg-app-surface-strong/80 dark:hover:text-white disabled:opacity-50"
            >
              {isOpeningPortal ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ExternalLink className="h-3.5 w-3.5" />
              )}
              Billing portal
            </button>
          )}
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-[1280px] px-4 pb-20 pt-8 sm:px-6 sm:pb-24 sm:pt-16 md:px-10">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="mb-8 text-center sm:mb-14">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-200/60 bg-white px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-blue-600 shadow-sm dark:border-blue-900/60 dark:bg-app-surface-muted dark:text-blue-400 sm:gap-2 sm:px-4 sm:py-1.5 sm:text-[10px]">
            <Sparkles className="h-3 w-3" />
            Upgrade your workspace
          </div>
          <h1 className="mt-4 text-[2.1rem] font-black leading-[1.05] tracking-tight text-slate-900 dark:text-app-text sm:mt-8 sm:text-[3.5rem]">
            Pick the depth that fits
            <br />
            <span className="mt-2 inline-block text-blue-600 dark:text-blue-500">
              your portfolio.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-app-text-muted dark:text-app-text-muted sm:mt-8 sm:text-base">
            Every plan includes all features. Only tracked apps, competitor groups, and keyword capacity scale per tier.
          </p>
        </div>

        {/* ── Current plan + usage ───────────────────────────────────────── */}

        <div className="mb-8 flex flex-col gap-4 sm:mb-12 sm:grid sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {/* Plan card */}
          <div className="workspace-panel order-2 sm:order-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted dark:text-app-text-muted">
              Your membership
            </p>
              <p className="mt-3 text-[1.45rem] font-black tracking-tight text-slate-900 dark:text-app-text sm:mt-4 sm:text-[1.75rem]">
              {isActivating
                ? "Activating trial"
                : isSelectionRequired
                ? "Choose a plan"
                : !billingStatus?.isPremium
                ? "7-day trial"
                : PUBLIC_BILLING_PLANS.find((p) => p.id === currentPlanId)?.name ||
                  "Premium"}
            </p>
            {isSelectionRequired ? (
              <p className="mt-2 text-xs font-medium text-app-text-muted dark:text-app-text-muted">
                Select a subscription to start your 7-day trial and unlock the workspace.
              </p>
            ) : null}
            {isActivating ? (
              <div className="mt-3 space-y-3">
                <p className="text-xs font-medium text-app-text-muted dark:text-app-text-muted">
                  We&apos;re waiting for billing to activate your workspace access.
                </p>
                {pendingPlan ? (
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:bg-app-surface-strong dark:text-app-text-muted">
                    <CreditCard className="h-3.5 w-3.5" />
                    {pendingPlan.name}
                    {billingStatus?.pendingInterval
                      ? ` · ${formatIntervalLabel(billingStatus.pendingInterval)}`
                      : ""}
                  </div>
                ) : null}
                {activationTimedOut ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                    Activation is taking longer than expected. Retry the status check or choose a plan again.
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={onRetryBillingStatus}
                        className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-app-surface-muted dark:text-amber-300 dark:hover:bg-amber-950/40"
                      >
                        Refresh billing status
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {currentPeriodEnd && (
              <p className="mt-1 text-xs font-medium text-app-text-muted dark:text-app-text-muted">Renews {currentPeriodEnd}</p>
            )}
            <div className="mt-4 self-start sm:mt-5">
              <div
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold ${
                  isPremium
                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                    : isActivating
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                    : "bg-[#e0f2fe] text-[#0284c7] dark:bg-blue-900/30 dark:text-blue-400"
                }`}
              >
                <Check className="h-3 w-3" />
                {isSelectionRequired
                  ? "Selection required"
                  : isActivating
                    ? isPollingActivation
                      ? "Activating"
                      : activationTimedOut
                        ? "Retry available"
                        : "Pending"
                  : isPremium
                  ? billingStatus?.subscriptionStatus?.replace(/_/g, " ") || "Active"
                  : "Trial"}
              </div>
            </div>

            <div className="flex-1" />

            {(billingError || !billingConnected) && (
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-app-border dark:bg-app-surface-muted/50 sm:mt-6 sm:p-4">
                <Headphones className="h-5 w-5 shrink-0 text-blue-500" />
                <p className="text-xs font-medium leading-relaxed text-slate-600 dark:text-app-text-muted">
                  {isLoading
                    ? "Refreshing billing…"
                    : billingError || "Contact support to activate billing access."}
                </p>
              </div>
            )}
          </div>

          {/* Usage bars */}
          {accessState === "active" && billingStatus?.usage && billingStatus?.planLimits ? (
            <div className="workspace-panel order-1 sm:order-2 sm:col-span-1 lg:col-span-2">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-app-text-muted dark:text-app-text-muted sm:mb-6">
                Capacity usage
              </p>
              <div className="flex flex-1 flex-col justify-center space-y-5 sm:space-y-7">
                <UsageBar
                  used={billingStatus.usage.trackedApps}
                  total={billingStatus.planLimits.trackedApps}
                  label="Tracked apps"
                />
                <UsageBar
                  used={billingStatus.usage.competitorGroups}
                  total={billingStatus.planLimits.competitorGroups}
                  label="Competitor groups"
                />
                <UsageBar
                  used={billingStatus.usage.activeTrackedKeywords}
                  total={billingStatus.planLimits.trackedKeywords}
                  label="Active tracked keywords"
                />
              </div>
            </div>
          ) : (
            <div className="workspace-panel order-1 sm:order-2 sm:col-span-1 lg:col-span-2">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted dark:text-app-text-muted">
                    Premium capacities
                  </p>
                  <h3 className="mt-2 text-lg font-black tracking-tight text-slate-900 dark:text-app-text sm:mt-3 sm:text-xl">
                    Compare plan limits before you start
                  </h3>
                  <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-app-text-muted dark:text-app-text-muted sm:mt-2 sm:text-sm">
                    Switch between plans to see how tracked app, competitor group, and keyword capacity scales.
                  </p>
                </div>
                {selectedCapacityPlan ? (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-left shadow-sm dark:border-blue-900/50 dark:bg-blue-950/30 sm:px-4 sm:py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
                      Selected plan
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900 dark:text-app-text">
                      {selectedCapacityPlan.name}
                    </p>
                    <p className="mt-1 text-xs text-app-text-muted dark:text-app-text-muted">
                      {selectedCapacityPlan.contactOnly
                        ? "Custom terms"
                        : `${selectedCapacityPriceLabel || "Price loading"} · ${formatIntervalLabel(selectedInterval).toLowerCase()} billing`}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="mt-4 sm:mt-6">
                <div className="mb-3 flex items-center gap-2">
                  <div className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-app-text-muted dark:text-app-text-muted">
                    Preview limits for
                  </p>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
                  {capacityPreviewPlans.map((plan) => {
                    const isActive = plan.id === selectedCapacityPlanId;
                    const planPriceLabel = getPlanPriceLabel(
                      billingStatus,
                      plan,
                      selectedInterval,
                    );
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedCapacityPlanId(plan.id)}
                          className={`rounded-2xl border px-3 py-2.5 text-left transition-all sm:px-4 sm:py-3 ${
                          isActive
                            ? "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-500/15"
                            : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/60 dark:border-app-border dark:bg-app-surface-muted dark:text-app-text dark:hover:border-blue-700 dark:hover:bg-app-surface-strong"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold">{plan.name}</p>
                            <p
                              className={`mt-1 text-xs ${
                                isActive
                                  ? "text-blue-100"
                                  : "text-app-text-muted dark:text-app-text-muted"
                              }`}
                            >
                              {plan.contactOnly
                                ? "Custom terms"
                                : `${planPriceLabel || "Price loading"} · ${formatIntervalLabel(selectedInterval).toLowerCase()}`}
                            </p>
                          </div>
                          <div
                            className={`mt-0.5 h-4 w-4 rounded-full border ${
                              isActive
                                ? "border-white bg-white"
                                : "border-slate-300 dark:border-app-border"
                            }`}
                          >
                            {isActive ? (
                              <div className="mx-auto mt-[3px] h-2 w-2 rounded-full bg-blue-600" />
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedCapacityPlan && selectedCapacityLimits ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 dark:border-app-border dark:bg-app-surface/50 sm:mt-6 sm:p-5">
                  {selectedCapacityPlan.contactOnly ? (
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-app-border dark:bg-app-surface-muted/70">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted dark:text-app-text-muted">
                          Tracked apps
                        </p>
                        <p className="mt-3 text-xl font-black tracking-tight text-slate-900 dark:text-app-text">
                          {formatCapacityLimit(selectedCapacityLimits.trackedApps, "tracked apps")}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-app-border dark:bg-app-surface-muted/70">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted dark:text-app-text-muted">
                          Competitor groups
                        </p>
                        <p className="mt-3 text-xl font-black tracking-tight text-slate-900 dark:text-app-text">
                          {formatCapacityLimit(selectedCapacityLimits.competitorGroups, "competitor groups")}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-app-border dark:bg-app-surface-muted/70">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted dark:text-app-text-muted">
                          Tracked keywords
                        </p>
                        <p className="mt-3 text-xl font-black tracking-tight text-slate-900 dark:text-app-text">
                          {formatCapacityLimit(selectedCapacityLimits.trackedKeywords, "tracked keywords")}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col space-y-7">
                      <UsageBar
                        used={billingStatus?.usage?.trackedApps ?? 0}
                        total={selectedCapacityLimits.trackedApps}
                        label="Tracked apps"
                      />
                      <UsageBar
                        used={billingStatus?.usage?.competitorGroups ?? 0}
                        total={selectedCapacityLimits.competitorGroups}
                        label="Competitor groups"
                      />
                      <UsageBar
                        used={billingStatus?.usage?.activeTrackedKeywords ?? 0}
                        total={selectedCapacityLimits.trackedKeywords}
                        label="Tracked keywords"
                      />
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* ── Everything included ───────────────────────────────────────── */}
        <div className="workspace-panel relative mb-8 overflow-hidden !border-slate-200/60 bg-slate-50/50 dark:bg-app-surface-muted/50 sm:mb-12">
          {/* Subtle gradient background inside */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#f0f7ff] to-transparent dark:from-blue-950/20" />
          
          <div className="relative z-10">
            <div className="mb-6 flex flex-col items-center text-center sm:mb-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/60 bg-white px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-blue-600 shadow-sm dark:border-blue-900/60 dark:bg-app-surface-muted dark:text-blue-400 sm:px-4 sm:py-1.5 sm:text-[10px]">
                Every plan includes
              </div>
              <h2 className="mt-3 text-[1.6rem] font-black tracking-tight text-slate-900 dark:text-app-text sm:mt-5 md:text-[2rem]">
                All features. Every tier.
              </h2>
              <p className="mt-2 max-w-md text-xs leading-relaxed text-app-text-muted dark:text-app-text-muted sm:mt-3 sm:text-sm">
                Features are never gated. Only tracked apps, competitor groups, and keyword slots scale.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 sm:gap-y-8 lg:grid-cols-4">
              {PRICING_INCLUDED_CAPABILITIES.map((cap) => {
                const Icon = FEATURE_ICONS[cap.label] || CheckCircle2;
                return (
                  <div key={cap.label} className="flex items-start gap-3 sm:gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/60 bg-white text-blue-600 shadow-sm dark:border-app-border dark:bg-app-surface-muted dark:text-blue-400 sm:h-10 sm:w-10 sm:rounded-[14px]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[13px] font-bold text-slate-900 dark:text-app-text">{cap.label}</div>
                      <div className="mt-1 hidden text-xs leading-relaxed text-app-text-muted dark:text-app-text-muted sm:block">{cap.sub}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Pricing Cards ────────────────────────────────────────────────── */}
        <div className="mb-6 flex justify-center sm:mb-8">
          <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm dark:border-app-border dark:bg-app-surface-muted">
            {allIntervals.map((interval) => {
              const isActive = selectedInterval === interval;
              return (
                <button
                  key={interval}
                  type="button"
                  onClick={() => setSelectedInterval(interval)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors sm:px-5 sm:py-2.5 sm:text-sm ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 hover:text-slate-900 dark:text-app-text-muted dark:hover:text-white"
                  }`}
                >
                  {formatIntervalLabel(interval)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6">
          {PUBLIC_BILLING_PLANS.map((plan) => {
            const isHighlight = plan.highlight;
            const priceLabel = getPlanPriceLabel(billingStatus, plan, selectedInterval);
            const priceCadence = getBillingCadence(priceLabel);
            const featureLines = getPlanLimitFeatureLines(plan.id as BillingPlanId);
            const PlanIcon = PLAN_ICONS[plan.id] || CheckCircle2;

            return (
              <div
                key={plan.id}
                className={`workspace-panel relative h-full transition-all ${
                  isHighlight
                    ? "border-2 border-blue-600 px-4 pb-4 pt-8 shadow-xl shadow-blue-500/10 z-10 sm:px-6 sm:pb-6 sm:pt-10 xl:-mx-2 xl:-my-3 xl:pb-8 xl:pt-12"
                    : "!border !border-slate-200 dark:!border-app-border hover:shadow-md"
                }`}
              >
                {/* Popular banner */}
                {isHighlight && (
                    <div className="absolute inset-x-0 top-0 flex h-[22px] items-center justify-center rounded-t-[18px] bg-blue-600 sm:h-[26px]">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-app-text">Popular</span>
                  </div>
                )}

                {/* Icon + Name */}
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl border ${
                      isHighlight
                        ? "border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-400"
                        : "border-slate-100 bg-slate-50 text-blue-600 dark:border-app-border/80 dark:bg-app-surface-strong/50 dark:text-blue-400"
                    }`}
                  >
                    <PlanIcon className="h-4 w-4" />
                  </div>
                  <div className={`text-base font-bold ${isHighlight ? "text-slate-900 dark:text-white" : "text-slate-900 dark:text-white"}`}>
                    {plan.name}
                  </div>
                </div>

                {/* Price */}
                <div className="mt-4 sm:mt-5">
                  <div className="text-[1.8rem] font-black leading-none tracking-tight text-slate-900 dark:text-app-text sm:text-[2.25rem]">
                    {priceLabel
                      ? stripBillingCadence(priceLabel)
                      : plan.contactOnly
                        ? "Custom"
                        : "Loading"}
                  </div>
                  <div className="mt-1 min-h-[1rem] text-[10px] font-medium text-app-text-muted dark:text-app-text-muted sm:mt-2 sm:min-h-[1.25rem] sm:text-[11px]">
                    {!plan.contactOnly &&
                      `${priceCadence ? `${priceCadence} · ` : ""}${formatIntervalLabel(selectedInterval).toLowerCase()} billing`}
                    {plan.contactOnly && "custom terms"}
                  </div>
                </div>

                {/* Description */}
                <p className="mt-3 min-h-[2rem] text-[11px] leading-relaxed text-app-text-muted dark:text-app-text-muted sm:mt-5 sm:min-h-[3rem] sm:text-xs">
                  {plan.description}
                </p>

                {/* Divider */}
                <div className="my-4 h-px w-full bg-slate-100 dark:bg-app-surface-strong sm:my-5" />

                {/* Features */}
                <div className="flex-1 space-y-2.5 sm:space-y-3.5">
                  {featureLines.map((line) => (
                    <div
                      key={line}
                      className="flex items-start gap-2.5 text-[11px] font-medium text-slate-700 dark:text-app-text-muted sm:gap-3 sm:text-[12px]"
                    >
                      <Check
                        className="mt-0.5 h-[14px] w-[14px] shrink-0 text-blue-600 dark:text-blue-400"
                        strokeWidth={2.5}
                      />
                      <span className="leading-snug">{line}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="mt-8">{renderCta(plan)}</div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-xs font-medium text-app-text-muted dark:text-app-text-muted">
          <span className="flex items-center gap-2">
            <Headphones className="h-3.5 w-3.5 text-app-text-muted" />
            <span>Questions? </span>
            <a
              href="mailto:vantalumstudio@gmail.com"
              className="text-slate-700 underline-offset-2 transition-colors hover:text-slate-900 hover:underline dark:text-app-text-muted dark:hover:text-app-text"
            >
              Contact support
            </a>
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="flex items-center gap-2">
            <CircleDollarSign className="h-3.5 w-3.5 text-app-text-muted" />
            Prices in USD. Cancel anytime.
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-app-text-muted" />
            Secure checkout via Stripe.
          </span>
        </div>
      </div>
    </div>
  );
}
