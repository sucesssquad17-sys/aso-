import React from "react";
import {
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  Mail,
  Radar,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import {
  PUBLIC_BILLING_PLANS,
  DEFAULT_PUBLIC_BILLING_PLAN_IDS,
  getAvailableBillingIntervals,
  getPlanBillingIntervals,
  getPlanPriceLabel,
  PRICING_INCLUDED_CAPABILITIES,
  PRICING_INCLUDED_COPY,
  type BillingInterval,
  type BillingPlanId,
  type BillingStatus,
} from "../lib/billing";
import { cn } from "../lib/utils";

interface BillingPaywallProps {
  billingStatus: BillingStatus | null;
  billingError: string | null;
  currentUserLabel: string;
  isLoading: boolean;
  isOpeningPortal: boolean;
  isStartingCheckout: boolean;
  onContinueFree: () => void;
  onOpenPortal: () => void;
  onStartCheckout: (planId: BillingPlanId, interval: BillingInterval) => void;
}

function formatStatusLabel(status?: string | null) {
  if (!status) return "Trial access";
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value?: string | null) {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

const PLAN_STYLES: Record<
  BillingPlanId,
  {
    accent: string;
    icon: React.ComponentType<{ className?: string }>;
    border: string;
    tint: string;
    glow: string;
  }
> = {
  free: {
    accent: "text-app-text-muted",
    icon: ShieldCheck,
    border: "border-white/[0.07]",
    tint: "bg-white/[0.04]",
    glow: "from-white/[0.03] via-transparent to-transparent",
  },
  indie: {
    accent: "text-app-text-muted",
    icon: Sparkles,
    border: "border-white/[0.07]",
    tint: "bg-white/[0.03]",
    glow: "from-white/[0.03] via-transparent to-transparent",
  },
  starter: {
    accent: "text-cyan-400",
    icon: Star,
    border: "border-cyan-500/25",
    tint: "bg-cyan-500/[0.08]",
    glow: "from-cyan-500/12 via-transparent to-transparent",
  },
  pro: {
    accent: "text-app-text-muted",
    icon: Radar,
    border: "border-white/[0.07]",
    tint: "bg-white/[0.03]",
    glow: "from-white/[0.03] via-transparent to-transparent",
  },
  agency: {
    accent: "text-amber-300",
    icon: Zap,
    border: "border-amber-500/20",
    tint: "bg-amber-500/[0.06]",
    glow: "from-amber-500/[0.06] via-transparent to-transparent",
  },
};

function formatBillingIntervalLabel(interval?: BillingInterval | null) {
  if (interval === "yearly") {
    return "Yearly";
  }
  return "Monthly";
}

export function BillingPaywall({
  billingStatus,
  billingError,
  currentUserLabel,
  isLoading,
  isOpeningPortal,
  isStartingCheckout,
  onContinueFree,
  onOpenPortal,
  onStartCheckout,
}: BillingPaywallProps) {
  const availableIntervals = getAvailableBillingIntervals(billingStatus);
  const [selectedInterval, setSelectedInterval] =
    React.useState<BillingInterval>(availableIntervals[0] || "monthly");

  React.useEffect(() => {
    if (!availableIntervals.includes(selectedInterval)) {
      setSelectedInterval(availableIntervals[0] || "monthly");
    }
  }, [availableIntervals, selectedInterval]);

  const availablePlans = new Set(
    billingStatus?.availablePlans || DEFAULT_PUBLIC_BILLING_PLAN_IDS,
  );
  const currentPeriodEnd = formatDate(billingStatus?.currentPeriodEnd);
  const billingConnected = Boolean(
    billingStatus?.configured && billingStatus?.productConfigured,
  );
  const bannerTone = billingError
    ? "border-amber-500/20 bg-amber-500/10 text-amber-100"
    : billingConnected
      ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-100"
      : "border-app-border/70 bg-app-surface-muted/70 text-app-text-muted";
  const bannerText = billingError
    ? billingError
    : billingConnected
      ? "Secure checkout is ready. Pick a plan to unlock higher tracking limits, deeper competitor coverage, and daily monitoring."
      : "Plan selection is available. Contact support at vantalumstudio@gmail.com for billing access.";

  return (
    <div className="workspace-shell relative min-h-screen overflow-hidden font-sans text-app-text">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />
      <div className="bg-orb bg-orb-3" />

      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
          <section className="workspace-panel workspace-panel-strong relative overflow-hidden p-5 sm:p-6 md:p-8">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/25 to-transparent" />

            <div className="relative">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  Member access
                </span>
              </div>

              <h1 className="max-w-3xl text-3xl font-black tracking-tight text-app-text sm:text-4xl md:text-5xl">
                Upgrade when you need more coverage, not more complexity.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-app-text-muted md:text-base">
                You're signed in as{" "}
                <span className="font-semibold text-app-text">
                  {currentUserLabel}
                </span>
                . Start with the 7-day trial, then choose a plan that matches
                the size of your ASO workflow.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "Tracking scale",
                    value: billingStatus?.isPremium ? "Premium" : "Trial",
                    hint: billingStatus?.isPremium
                      ? "Higher limits unlocked"
                      : "Full access during your first 7 days",
                  },
                  {
                    label: "Renewal",
                    value: currentPeriodEnd || "Not scheduled",
                    hint: billingStatus?.cancelAtPeriodEnd
                      ? "Ends at period close"
                      : "Auto-renews while active",
                  },
                  {
                    label: "Billing state",
                    value: billingConnected ? "Ready" : "Unavailable",
                    hint: billingConnected
                      ? "Checkout and portal available"
                      : "Contact vantalumstudio@gmail.com for paid access",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4"
                  >
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-app-text-muted">
                      {item.label}
                    </p>
                    <p className="mt-2 text-base font-semibold text-app-text">
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs text-app-text-muted">{item.hint}</p>
                  </div>
                ))}
              </div>
              {billingStatus?.usage && billingStatus?.planLimits ? (
                <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-app-text-muted">
                    Current usage
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    {[
                      {
                        label: "Tracked apps",
                        value: `${billingStatus.usage.trackedApps}/${billingStatus.planLimits.trackedApps ?? "Custom"}`,
                      },
                      {
                        label: "Competitor groups",
                        value: `${billingStatus.usage.competitorGroups}/${billingStatus.planLimits.competitorGroups ?? "Custom"}`,
                      },
                      {
                        label: "Tracked keywords",
                        value:
                          billingStatus.planLimits.trackedKeywords === null
                            ? `${billingStatus.usage.trackedKeywords} active`
                            : `${billingStatus.usage.activeTrackedKeywords}/${billingStatus.planLimits.trackedKeywords} active`,
                        hint: billingStatus.usage.pausedTrackedKeywords
                          ? `${billingStatus.usage.pausedTrackedKeywords} paused`
                          : "No paused records",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-app-border/60 bg-app-surface/40 px-4 py-3"
                      >
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-app-text-muted">
                          {item.label}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-app-text">
                          {item.value}
                        </p>
                        {"hint" in item && item.hint ? (
                          <p className="mt-1 text-[11px] text-app-text-muted">{item.hint}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <aside className="workspace-panel flex flex-col gap-5 p-5 sm:p-6">
            <div>
              <div className="workspace-chip-label">Current Access</div>
              <h2 className="mt-2 text-2xl font-semibold text-app-text">
                {billingStatus?.isPremium ? "Premium active" : "7-day trial"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-app-text-muted">
                {formatStatusLabel(billingStatus?.subscriptionStatus)}
              </p>
            </div>

            <div className="space-y-3">
              {[
                {
                  label: "Workspace profile",
                  value: currentUserLabel,
                },
                {
                  label: "Plan renewal",
                  value: currentPeriodEnd || "Not scheduled yet",
                },
                {
                  label: "Billing access",
                  value: billingConnected ? "Available" : "Email support",
                },
                {
                  label: "Billing Cycle",
                  value: billingStatus?.subscriptionInterval
                    ? formatBillingIntervalLabel(billingStatus.subscriptionInterval)
                    : "None",
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-app-border/60 bg-app-surface/40 px-4 py-3"
                >
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-app-text-muted">
                    {row.label}
                  </span>
                  <span className="text-sm font-medium text-app-text">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            <div className={cn("rounded-2xl border px-4 py-4 text-sm", bannerTone)}>
              {isLoading ? "Refreshing billing state..." : bannerText}
            </div>

            {availableIntervals.length > 1 ? (
              <div className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.04] p-1">
                {availableIntervals.map((interval) => (
                  <button
                    key={interval}
                    type="button"
                    onClick={() => setSelectedInterval(interval)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                      selectedInterval === interval
                        ? "bg-cyan-400 text-black"
                        : "text-app-text-muted hover:text-white",
                    )}
                  >
                    {formatBillingIntervalLabel(interval)}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="rounded-2xl border border-app-border/60 bg-app-surface/40 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-app-text-muted">
                Everything included in every plan
              </p>
              <p className="mt-1.5 text-xs leading-5 text-app-text-muted">
                {PRICING_INCLUDED_COPY}
              </p>
              <ul className="mt-3 space-y-2">
                {PRICING_INCLUDED_CAPABILITIES.map((item) => (
                  <li key={item.label} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
                    <div>
                      <p className="text-xs font-medium text-app-text">{item.label}</p>
                      <p className="text-[11px] text-app-text-muted">{item.sub}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden">
              <p className="mt-1.5 text-xs leading-5 text-app-text-muted">
                All features on all plans — only slots & keywords scale.
              </p>
              <ul className="mt-3 space-y-2">
                {[
                  { label: "App Store & Google Play tracking", sub: "iOS + Android" },
                  { label: "Keyword rank tracking", sub: "Per country, per store" },
                  { label: "Competitor analysis", sub: "Track rivals side by side" },
                  { label: "Daily automated monitoring", sub: "Hands-free, every day" },
                  { label: "Rank change alerts", sub: "Instant position shift alerts" },
                  { label: "Trend charts & history", sub: "Rank movement over time" },
                  { label: "Competitor battle mode", sub: "Head-to-head keyword overlap" },
                  { label: "PDF reports & data export", sub: "Share or archive anytime" },
                ].map((item) => (
                  <li key={item.label} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-400" />
                    <div>
                      <p className="text-xs font-medium text-app-text">{item.label}</p>
                      <p className="text-[11px] text-app-text-muted">{item.sub}</p>
                    </div>
                  </li>
                ))}
              </ul>
              </div>
            </div>

            <div className="mt-auto flex flex-col gap-3">
              <button
                type="button"
                onClick={onContinueFree}
                className="btn-ghost w-full justify-center rounded-2xl px-4 py-3 text-sm font-semibold"
              >
                Back to workspace
              </button>
              {billingStatus?.customerPortalAvailable ? (
                <button
                  type="button"
                  onClick={onOpenPortal}
                  disabled={isOpeningPortal}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm font-semibold text-app-text transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isOpeningPortal ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                  Open billing portal
                </button>
              ) : null}
            </div>
          </aside>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PUBLIC_BILLING_PLANS.map((plan) => {
            const planStyle = PLAN_STYLES[plan.id];
            const Icon = planStyle.icon;
            const isCurrentPlan =
              Boolean(billingStatus?.isPremium) &&
              billingStatus?.subscriptionTier === plan.id;
            const isPlanAvailable =
              plan.contactOnly || availablePlans.has(plan.id);
            const supportsSelectedInterval =
              plan.contactOnly ||
              getPlanBillingIntervals(billingStatus, plan.id).includes(selectedInterval);
            const isPaidCta =
              !plan.contactOnly &&
              isPlanAvailable &&
              supportsSelectedInterval;

            let actionLabel = plan.cta;
            if (isCurrentPlan) {
              actionLabel = "Current plan";
            }

            return (
              <section
                key={plan.id}
                className={cn(
                  "relative flex h-full flex-col overflow-hidden rounded-[24px] border p-5 shadow-[0_24px_80px_rgba(0,0,0,0.6)] sm:rounded-[28px] sm:p-6",
                  plan.highlight
                    ? "border-cyan-500/25 bg-app-surface-muted"
                    : "border-white/[0.07] bg-app-surface",
                  planStyle.border,
                )}
              >
                <div
                  className={cn(
                    "pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b opacity-100",
                    planStyle.glow,
                  )}
                />

                <div className="relative flex flex-1 flex-col">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div
                      className={cn(
                        "inline-flex h-11 w-11 items-center justify-center rounded-2xl border",
                        planStyle.border,
                        planStyle.tint,
                      )}
                    >
                      <Icon className={cn("h-5 w-5", planStyle.accent)} />
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {plan.badge ? (
                        <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                          {plan.badge}
                        </span>
                      ) : null}
                      {isCurrentPlan ? (
                        <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                           Active
                          </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mb-5">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-app-text-muted">
                      {plan.name}
                    </p>
                    <div className="mt-3 flex items-end gap-2">
                      <span className="text-4xl font-black text-app-text">
                        {getPlanPriceLabel(billingStatus, plan, selectedInterval) ||
                          (plan.contactOnly ? "Contact us" : "Loading")}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.16em] text-app-text-muted">
                      {plan.contactOnly
                        ? "Custom terms"
                        : `${formatBillingIntervalLabel(selectedInterval)} billing`}
                    </p>
                    <p className="mt-3 min-h-[66px] text-sm leading-6 text-app-text-muted">
                      {plan.description}
                    </p>
                  </div>

                  <div className="mb-6 flex-1 rounded-2xl border border-white/[0.06] bg-app-surface p-4">
                    <ul className="space-y-3">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2.5 text-sm leading-6 text-app-text-muted"
                        >
                          <CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", planStyle.accent)} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                  <div className="mt-auto min-h-[84px] space-y-3">
                    {plan.contactOnly ? (
                      <a
                        href="mailto:vantalumstudio@gmail.com"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm font-bold text-app-text transition-colors hover:bg-white/[0.08]"
                      >
                        <Mail className="h-4 w-4" />
                        {actionLabel}
                      </a>
                    ) : (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => onStartCheckout(plan.id, selectedInterval)}
                          disabled={isCurrentPlan || isStartingCheckout || !billingConnected || !isPaidCta}
                          className={cn(
                            "inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                             plan.highlight
                               ? "bg-gradient-to-r from-cyan-400 to-cyan-300 text-black font-bold hover:from-cyan-300 hover:to-cyan-200"
                               : "border border-white/[0.08] bg-white/[0.04] text-white hover:bg-white/[0.08]",
                          )}
                        >
                          {isStartingCheckout ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CreditCard className="h-4 w-4" />
                          )}
                          {actionLabel}
                        </button>
                        <div className="min-h-[32px]">
                          {!supportsSelectedInterval && !isCurrentPlan ? (
                            <p className="text-center text-xs text-app-text-muted">
                              {formatBillingIntervalLabel(selectedInterval)} billing is not available right now
                            </p>
                          ) : null}
                          {!billingConnected && !isCurrentPlan && supportsSelectedInterval ? (
                            <p className="text-center text-xs text-app-text-muted">
                              Contact vantalumstudio@gmail.com to activate this plan
                            </p>
                          ) : null}
                        </div>
                      </div>
                    )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
