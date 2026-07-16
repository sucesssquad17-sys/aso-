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
import SupportEmailLink from "../../components/SupportEmailLink";
import {
  type BillingAccessState,
  DISPLAY_BILLING_PLANS,
  PUBLIC_BILLING_PLANS,
  DEFAULT_PUBLIC_BILLING_PLAN_IDS,
  getAvailableBillingIntervals,
  getPlanBillingIntervals,
  getPlanPrice,
  getPlanPriceLabel,
  getYearlyMonthlyEquivalentLabel,
  PRICING_COMPARISON_ROWS,
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
  const id = billingStatus?.subscriptionTier;
  if (id === "free" || id === "indie" || id === "starter" || id === "pro" || id === "agency") {
    return id;
  }
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
  "Competitor ASO change alerts": Target,
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
    ? "workspace-usage-danger"
    : isNear
      ? "workspace-usage-warning"
      : "workspace-usage-brand";
      
  const barColor = isAt
    ? "workspace-usage-bar-danger"
    : isNear
      ? "workspace-usage-bar-warning"
      : "workspace-usage-bar-brand";

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 sm:mb-2">
        <span className="text-xs font-medium text-app-text-muted sm:text-[13px]">{label}</span>
        <span className={`text-xs font-bold tabular-nums tracking-wide sm:text-[13px] ${textColor}`}>
          {used} / {total === null ? "∞" : total}
        </span>
      </div>
      {total !== null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-muted)]">
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
  const prioritizePlanAction = isSelectionRequired || isActivating;
  const signedInAccount = currentUserEmail || currentUserLabel;
  const capacityPreviewPlans = DISPLAY_BILLING_PLANS;
  const [selectedCapacityPlanId, setSelectedCapacityPlanId] =
    React.useState<BillingPlanId>(() => {
      const defaultPlan =
        capacityPreviewPlans.find((plan) => plan.id === "starter") ||
        capacityPreviewPlans[0] ||
        DISPLAY_BILLING_PLANS[0];

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
      "workspace-billing-cta-primary inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 sm:py-3 text-sm font-bold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
    
    const normalCta =
      "workspace-billing-cta-secondary inline-flex w-full items-center justify-center gap-2 rounded-xl border bg-transparent px-4 py-3.5 sm:py-3 text-sm font-bold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40";
    
    const currentCta =
      "workspace-billing-cta-current inline-flex w-full items-center justify-center gap-2 rounded-xl border bg-transparent px-4 py-3.5 sm:py-3 text-sm font-bold cursor-default";

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
        <SupportEmailLink subject="Rank Analyzer Pro Sales" className={normalCta}>
          <Mail className="h-4 w-4" />
          {plan.cta}
        </SupportEmailLink>
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
    <div className="workspace-upgrade-shell relative min-h-screen w-full">
      {/* ── Decorative Background ────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="workspace-upgrade-orb absolute -left-[8%] top-0 h-[420px] w-[420px] rounded-full opacity-45 blur-2xl" />
        <div className="workspace-upgrade-orb absolute -right-[4%] top-[5%] h-[500px] w-[500px] rounded-full opacity-55 blur-2xl" />
        <div className="absolute left-0 top-0 h-[500px] w-full" style={{ backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.15) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
      </div>

      {/* ── Sticky nav bar ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b workspace-divider bg-[color:var(--color-surface-elevated)] px-3 py-2 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-2">
          {canReturnToWorkspace ? (
            <button
              onClick={onReturn}
              className="group inline-flex items-center gap-1.5 rounded-lg border workspace-border-default bg-[color:var(--color-surface)] px-2.5 py-1.5 text-[11px] font-semibold text-app-text-muted shadow-sm transition-all hover:border-[color:var(--color-border-strong)] hover:bg-[color:var(--color-surface-hover)] hover:text-app-text sm:px-3 sm:text-xs"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              Back to workspace
            </button>
          ) : (
            <div className="workspace-billing-pending-pill inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm">
              <Lock className="h-3.5 w-3.5" />
              {isActivating ? "Trial activation pending" : "Plan selection required"}
            </div>
          )}
          {signedInAccount ? (
            <div className="hidden items-center gap-2 rounded-lg border workspace-border-default bg-[color:var(--color-surface)] px-3 py-1.5 text-xs font-medium text-app-text-muted shadow-sm lg:inline-flex">
              <Mail className="h-3.5 w-3.5" />
              {signedInAccount}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {billingStatus?.environment === "test" && (
            <span className="workspace-billing-test-mode rounded-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm">
              Test mode
            </span>
          )}
          {accessState !== "active" ? (
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 rounded-lg border workspace-border-default bg-[color:var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-app-text-muted shadow-sm transition-colors hover:border-[color:var(--color-border-strong)] hover:bg-[color:var(--color-surface-hover)] hover:text-app-text"
            >
              Use different account
            </button>
          ) : null}
          {accessState === "active" && billingStatus?.customerPortalAvailable && (
            <button
              onClick={onOpenPortal}
              disabled={isOpeningPortal}
              className="inline-flex items-center gap-1.5 rounded-lg border workspace-border-default bg-[color:var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-app-text-muted shadow-sm transition-colors hover:border-[color:var(--color-border-strong)] hover:bg-[color:var(--color-surface-hover)] hover:text-app-text disabled:opacity-50"
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

      <div className="relative z-10 mx-auto max-w-[1280px] px-4 pb-20 pt-5 sm:px-6 sm:pb-24 sm:pt-8 md:px-10">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="mb-6 text-center sm:mb-10">
          <div className="workspace-billing-brand-pill inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[9px] font-bold uppercase tracking-widest shadow-sm sm:gap-2 sm:px-4 sm:py-1.5 sm:text-[10px]">
            <Sparkles className="h-3 w-3" />
            Upgrade your workspace
          </div>
          <h1 className="mt-4 text-[2.1rem] font-black leading-[1.05] tracking-tight text-slate-900 dark:text-app-text sm:mt-6 sm:text-[3.15rem]">
            Pick the depth that fits
            <br />
            <span className="workspace-billing-brand-text mt-2 inline-block text-[color:var(--color-brand-hover)]">
              your portfolio.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-app-text-muted dark:text-app-text-muted sm:mt-5 sm:text-base">
            Free covers core tracking. Paid plans unlock reports, alerts, weekly email summaries, and more monitoring headroom.
          </p>
        </div>

        {/* ── Current plan + usage ───────────────────────────────────────── */}

        <div className="mb-8 flex flex-col gap-4 sm:mb-12 sm:grid sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {/* Plan card */}
          <div className={`workspace-panel ${prioritizePlanAction ? "order-1" : "order-2"} sm:order-1`}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted dark:text-app-text-muted">
              Your membership
            </p>
              <p className="mt-3 text-[1.45rem] font-black tracking-tight text-slate-900 dark:text-app-text sm:mt-4 sm:text-[1.75rem]">
              {isActivating
                ? "Activating trial"
                : isSelectionRequired
                ? "Choose a plan"
                : currentPlanId === "free"
                ? "Free"
                : PUBLIC_BILLING_PLANS.find((p) => p.id === currentPlanId)?.name ||
                  "Premium"}
            </p>
            {isSelectionRequired ? (
              <p className="mt-2 text-xs font-medium text-app-text-muted dark:text-app-text-muted">
                Start on free, or choose a paid plan to unlock reports, alerts, and larger capacity.
              </p>
            ) : null}
            {isActivating ? (
              <div className="mt-3 space-y-3">
                <p className="text-xs font-medium text-app-text-muted dark:text-app-text-muted">
                  We&apos;re waiting for billing to activate your workspace access.
                </p>
                {pendingPlan ? (
                  <div className="workspace-billing-neutral-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold">
                    <CreditCard className="h-3.5 w-3.5" />
                    {pendingPlan.name}
                    {billingStatus?.pendingInterval
                      ? ` · ${formatIntervalLabel(billingStatus.pendingInterval)}`
                      : ""}
                  </div>
                ) : null}
                {activationTimedOut ? (
                  <div className="workspace-billing-warning-panel rounded-xl border p-3 text-left text-xs">
                    Activation is taking longer than expected. Retry the status check or choose a plan again.
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={onRetryBillingStatus}
                        className="workspace-billing-warning-action inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-semibold transition-colors"
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
                    ? "workspace-billing-status-success"
                    : isActivating
                      ? "workspace-billing-status-warning"
                    : "workspace-billing-status-brand"
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
              <div className="mt-4 flex items-center gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] p-3 sm:mt-6 sm:p-4">
                <Headphones className="h-5 w-5 shrink-0 text-[color:var(--color-brand)]" />
                <p className="text-xs font-medium leading-relaxed text-slate-600 dark:text-app-text-muted">
                  {isLoading
                    ? "Refreshing billing…"
                    : billingError || "Contact support at vantalumstudio@gmail.com to activate billing access."}
                </p>
              </div>
            )}
          </div>

          {/* Usage bars */}
          {accessState === "active" && billingStatus?.usage && billingStatus?.planLimits ? (
            <div className={`workspace-panel ${prioritizePlanAction ? "order-2" : "order-1"} sm:order-2 sm:col-span-1 lg:col-span-2`}>
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
                  <div className="workspace-billing-capacity-preview rounded-2xl border px-3 py-2.5 text-left shadow-sm sm:px-4 sm:py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--color-brand-hover)]">
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
                  <div className="workspace-billing-brand-icon inline-flex h-6 w-6 items-center justify-center rounded-full border">
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
                            ? "workspace-billing-capacity-selected"
                            : "workspace-billing-capacity-option"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold">{plan.name}</p>
                            <p
                              className={`mt-1 text-xs ${
                                isActive
                                  ? "text-[color:var(--color-canvas)]/75"
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
                                ? "border-[color:var(--color-canvas)] bg-[color:var(--color-canvas)]"
                                : "border-[color:var(--color-border)]"
                            }`}
                          >
                            {isActive ? (
                              <div className="mx-auto mt-[3px] h-2 w-2 rounded-full bg-[color:var(--color-brand)]" />
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedCapacityPlan && selectedCapacityLimits ? (
                <div className="mt-4 rounded-2xl border workspace-border-default bg-[color:var(--color-surface-muted)] p-3.5 sm:mt-6 sm:p-5">
                  {selectedCapacityPlan.contactOnly ? (
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border workspace-border-default bg-[color:var(--color-surface)] p-5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted dark:text-app-text-muted">
                          Tracked apps
                        </p>
                        <p className="mt-3 text-xl font-black tracking-tight text-slate-900 dark:text-app-text">
                          {formatCapacityLimit(selectedCapacityLimits.trackedApps, "tracked apps")}
                        </p>
                      </div>
                      <div className="rounded-2xl border workspace-border-default bg-[color:var(--color-surface)] p-5">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-app-text-muted dark:text-app-text-muted">
                          Competitor groups
                        </p>
                        <p className="mt-3 text-xl font-black tracking-tight text-slate-900 dark:text-app-text">
                          {formatCapacityLimit(selectedCapacityLimits.competitorGroups, "competitor groups")}
                        </p>
                      </div>
                      <div className="rounded-2xl border workspace-border-default bg-[color:var(--color-surface)] p-5">
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
        <div className="workspace-panel relative mb-8 overflow-hidden border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] sm:mb-12">
          {/* Subtle gradient background inside */}
          <div className="workspace-billing-section-glow pointer-events-none absolute inset-0" />
          
          <div className="relative z-10">
            <div className="mb-6 flex flex-col items-center text-center sm:mb-10">
              <div className="workspace-billing-brand-pill inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[9px] font-bold uppercase tracking-widest shadow-sm sm:px-4 sm:py-1.5 sm:text-[10px]">
                Compare access
              </div>
              <h2 className="mt-3 text-[1.6rem] font-black tracking-tight text-slate-900 dark:text-app-text sm:mt-5 md:text-[2rem]">
                Core tracking first, automation when you need it
              </h2>
              <p className="mt-2 max-w-md text-xs leading-relaxed text-app-text-muted dark:text-app-text-muted sm:mt-3 sm:text-sm">
                Free keeps the core workflow open. Paid tiers add reports, alerts, and weekly email summaries.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 sm:gap-y-8 lg:grid-cols-4">
              {PRICING_INCLUDED_CAPABILITIES.map((cap) => {
                const Icon = FEATURE_ICONS[cap.label] || CheckCircle2;
                return (
                  <div key={cap.label} className="flex items-start gap-3 sm:gap-4">
                    <div className="workspace-billing-feature-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm sm:h-10 sm:w-10 sm:rounded-[14px]">
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
          <div className="workspace-billing-interval-switcher inline-flex items-center rounded-full border p-1 shadow-sm">
            {allIntervals.map((interval) => {
              const isActive = selectedInterval === interval;
              return (
                <button
                  key={interval}
                  type="button"
                  onClick={() => setSelectedInterval(interval)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors sm:px-5 sm:py-2.5 sm:text-sm ${
                    isActive
                      ? "workspace-billing-interval-active"
                      : "text-app-text-muted hover:text-app-text"
                  }`}
                >
                  {formatIntervalLabel(interval)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid items-stretch gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6">
          {DISPLAY_BILLING_PLANS.map((plan) => {
            const isHighlight = plan.highlight;
            const priceLabel = getPlanPriceLabel(billingStatus, plan, selectedInterval);
            const selectedPrice = getPlanPrice(billingStatus, plan, selectedInterval);
            const yearlyDisplayAmount =
              selectedInterval === "yearly"
                ? getYearlyMonthlyEquivalentLabel(billingStatus, plan)
                : null;
            const yearlyTotalLabel =
              selectedInterval === "yearly" && selectedPrice
                ? stripBillingCadence(
                    getPlanPriceLabel(billingStatus, plan, "yearly") || "",
                  ) || null
                : null;
            const displayPrice =
              selectedInterval === "yearly" && yearlyDisplayAmount
                ? `${yearlyDisplayAmount}/mo`
                : priceLabel;
            const priceCadence = getBillingCadence(displayPrice);
            const featureLines = getPlanLimitFeatureLines(plan.id as BillingPlanId);
            const PlanIcon = PLAN_ICONS[plan.id] || CheckCircle2;

            return (
              <div
                key={plan.id}
                className={`workspace-panel relative flex h-full min-h-[23.5rem] flex-col transition-all ${
                  isHighlight
                    ? "workspace-billing-plan-highlight !border px-4 pb-5 pt-8 z-10 ring-1 ring-[color:var(--color-brand-hover)]/35 shadow-[0_22px_54px_rgba(37,99,235,0.18)] sm:px-6 sm:pb-6 sm:pt-10"
                    : "workspace-billing-plan-normal !border px-4 pb-5 pt-5 hover:shadow-md sm:px-6 sm:pb-6 sm:pt-6"
                }`}
              >
                {/* Popular banner */}
                {isHighlight && (
                  <div className="workspace-billing-plan-banner absolute inset-x-0 top-0 flex h-[22px] items-center justify-center rounded-t-[18px] sm:h-[26px]">
                    <span className="text-[9px] font-bold uppercase tracking-widest">Popular</span>
                  </div>
                )}

                {/* Icon + Name */}
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl border ${
                      isHighlight
                        ? "workspace-billing-plan-icon-highlight"
                        : "workspace-billing-plan-icon"
                    }`}
                  >
                    <PlanIcon className="h-4 w-4" />
                  </div>
                  <div className="text-base font-bold text-app-text">
                    {plan.name}
                  </div>
                </div>

                {/* Price */}
                <div className="mt-4 sm:mt-5">
                  <div className="text-[1.8rem] font-black leading-none tracking-tight text-slate-900 dark:text-app-text sm:text-[2.25rem]">
                    {displayPrice
                      ? stripBillingCadence(displayPrice)
                      : plan.contactOnly
                        ? "Custom"
                        : "Loading"}
                  </div>
                  <div className="mt-1 min-h-[1rem] text-[10px] font-medium text-app-text-muted dark:text-app-text-muted sm:mt-2 sm:min-h-[1.25rem] sm:text-[11px]">
                    {!plan.contactOnly &&
                      (selectedInterval === "yearly"
                        ? yearlyTotalLabel
                          ? `billed annually at ${yearlyTotalLabel}/year`
                          : "billed annually"
                        : `${priceCadence ? `${priceCadence} · ` : ""}${formatIntervalLabel(selectedInterval).toLowerCase()} billing`)}
                    {plan.contactOnly && "custom terms"}
                  </div>
                </div>

                {/* Description */}
                <p className="mt-3 min-h-[2rem] text-[11px] leading-relaxed text-app-text-muted dark:text-app-text-muted sm:mt-5 sm:min-h-[3rem] sm:text-xs">
                  {plan.description}
                </p>

                {/* Divider */}
                <div className="my-4 h-px w-full bg-[color:var(--color-border)] sm:my-5" />

                {/* Features */}
                <div className="flex-1 space-y-2.5 sm:space-y-3.5">
                  {featureLines.map((line) => (
                    <div
                      key={line}
                      className="flex items-start gap-2.5 text-[11px] font-medium text-app-text-muted sm:gap-3 sm:text-[12px]"
                    >
                      <Check
                        className="mt-0.5 h-[14px] w-[14px] shrink-0 text-[color:var(--color-brand-hover)]"
                        strokeWidth={2.5}
                      />
                      <span className="leading-snug">{line}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="mt-6 pt-2">{renderCta(plan)}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <SupportEmailLink
            subject="Rank Analyzer Pro Custom Terms"
            className="text-sm font-semibold text-[color:var(--color-brand-hover)] underline-offset-4 transition-colors hover:text-app-text hover:underline"
          >
            Contact us for custom terms
          </SupportEmailLink>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="workspace-panel mt-8 overflow-hidden p-0">
          <div className="border-b workspace-divider px-4 py-4 sm:px-6">
            <div className="workspace-chip-label">Plan comparison</div>
            <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-app-text">
              Capacity and access at a glance
            </h3>
            <p className="mt-1 text-sm text-app-text-muted">
              Reports and alerts start on paid plans. Capacity expands with the portfolio.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[42rem] w-full text-left">
              <thead>
                <tr className="border-b workspace-divider">
                  <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-app-text-muted sm:px-6">
                    Capability
                  </th>
                  {DISPLAY_BILLING_PLANS.map((plan) => (
                    <th
                      key={`compare-${plan.id}`}
                      className="px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-app-text-muted sm:px-6"
                    >
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PRICING_COMPARISON_ROWS.map((row) => (
                  <tr key={row.label} className="border-b workspace-divider last:border-b-0">
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-app-text sm:px-6">
                      {row.label}
                    </td>
                    {DISPLAY_BILLING_PLANS.map((plan) => (
                      <td
                        key={`${row.label}-${plan.id}`}
                        className="px-4 py-3 text-sm text-app-text-muted sm:px-6"
                      >
                        {row.values[plan.id]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-xs font-medium text-app-text-muted dark:text-app-text-muted">
          <span className="flex items-center gap-2">
            <Headphones className="h-3.5 w-3.5 text-app-text-muted" />
            <span>Questions? </span>
            <SupportEmailLink
              subject="Rank Analyzer Pro Support"
              className="text-slate-700 underline-offset-2 transition-colors hover:text-slate-900 hover:underline dark:text-app-text-muted dark:hover:text-app-text"
            >
              Contact support
            </SupportEmailLink>
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
