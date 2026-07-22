import React from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  Globe,
  Layers,
  Menu,
  ShieldCheck,
  TrendingUp,
  X,
} from "lucide-react";
import {
  DISPLAY_BILLING_PLANS,
  PUBLIC_BILLING_PLANS,
  PRICING_COMPARISON_ROWS,
  FREE_CAPABILITIES,
  PAID_CAPABILITIES,
  formatBillingAmountFromMinorUnits,
  getAvailableBillingIntervals,
  getPlanPrice,
  getPlanPriceLabel,
  getYearlyMonthlyEquivalentLabel,
  type BillingInterval,
  type BillingPricingCatalog,
} from "../lib/billing";
import type { ThemeMode } from "../lib/theme";
import BrandMark from "./BrandMark";
import SupportEmailLink from "./SupportEmailLink";
import ThemeToggle from "./ThemeToggle";

interface LandingPageProps {
  onGetStarted: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}

const primaryNavLinks = [
  { label: "Features", sectionId: "features" },
  { label: "Pricing", sectionId: "pricing" },
  { label: "FAQ", sectionId: "faq" },
];

const heroHighlights = [
  {
    title: "Keyword tracking",
    copy: "Track terms by country and keep daily ranking history building automatically.",
    icon: Bell,
  },
  {
    title: "Competitor groups",
    copy: "Create battle groups and see where rivals overlap with your best search terms.",
    icon: Layers,
  },
  {
    title: "Movement reporting",
    copy: "Review winners, losses, and pressure points without rebuilding the same context.",
    icon: TrendingUp,
  },
];


const featureCards = [
  {
    title: "Track keywords by country",
    copy:
      "Keep ranking history tied to the storefront that matters instead of flattening everything into one generic view.",
    icon: Globe,
  },
  {
    title: "Compare direct competitors",
    copy:
      "Save rival groups, track shared terms, and understand where you are gaining or losing ground.",
    icon: Layers,
  },
  {
    title: "See movement fast",
    copy:
      "Surface top movers, declines, and high-pressure terms quickly from one focused reporting workflow.",
    icon: BarChart3,
  },
];

const faqItems = [
  {
    question: "Do I need separate accounts for iOS and Android tracking?",
    answer:
      "No. Rank Analyzer Pro keeps both the App Store and Google Play in one unified workspace. You can easily switch between platforms and track cross-platform app performance without having to rebuild your workflow, manage separate billing, or log into different systems. Your tracked keywords and competitor groups are neatly organized per app, regardless of the store.",
  },
  {
    question: "How does localized keyword tracking work?",
    answer:
      "Keyword discovery, tracking, and reporting stay completely tied to a chosen storefront country. Instead of blending global averages which can be misleading, the workflow is built around precise local search context. This means you can track how your app ranks for a term in the US App Store independently from how it ranks in the UK, giving you accurate, actionable localization data.",
  },
  {
    question: "Can I monitor my competitors' keyword strategies?",
    answer:
      "Yes, on paid plans. You can build dedicated competitor battle groups around your app and direct rivals. Rank Analyzer Pro allows you to review overlapping search terms, see exactly where competitors are outranking you, and track their daily movement. This helps you identify high-pressure keywords where you are losing ground and discover new terms driving traffic to competitors.",
  },
  {
    question: "Do I have to manually build reports from my tracking data?",
    answer:
      "On paid plans, movement reporting is automatically built from your daily tracked history. The platform surfaces top winners, sudden ranking drops, and high-pressure terms immediately. You can review your app's movement and competitor shifts directly in the workspace without needing to rebuild the same analysis each week.",
  },
];

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex rounded-full border border-cyan-500/18 bg-cyan-500/8 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300">
      {children}
    </div>
  );
}

function splitPriceLabel(priceLabel: string | null, fallback: string) {
  const normalized = priceLabel?.trim();
  if (!normalized) {
    return { amount: fallback, cadence: "" };
  }

  const cadence = normalized.match(/\/[a-z]+$/i)?.[0] || "";
  return {
    amount: cadence ? normalized.slice(0, -cadence.length) : normalized,
    cadence,
  };
}

export default function LandingPage({
  onGetStarted,
  onOpenPrivacy,
  onOpenTerms,
  themeMode,
  onToggleTheme,
}: LandingPageProps) {
  const [openFaqIndices, setOpenFaqIndices] = React.useState<number[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [pricingCatalog, setPricingCatalog] =
    React.useState<BillingPricingCatalog | null>(null);
  const availableIntervals = getAvailableBillingIntervals(pricingCatalog);
  const [selectedInterval, setSelectedInterval] =
    React.useState<BillingInterval>("yearly");

  const pricingCards = DISPLAY_BILLING_PLANS.map((plan) => ({
    ...plan,
    badge: plan.badge === "Popular" ? "Most Popular" : plan.badge,
  }));

  React.useEffect(() => {
    if (!pricingCatalog) {
      return;
    }
    const nextDefault = availableIntervals.includes("yearly")
      ? "yearly"
      : availableIntervals[0] || "monthly";
    if (!availableIntervals.includes(selectedInterval)) {
      setSelectedInterval(nextDefault);
    }
  }, [availableIntervals, pricingCatalog, selectedInterval]);

  React.useEffect(() => {
    let cancelled = false;

    fetch("/api/billing/pricing")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: BillingPricingCatalog | null) => {
        if (!cancelled && data) {
          setPricingCatalog(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPricingCatalog(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const scrollToSection = React.useCallback((sectionId: string) => {
    if (typeof document === "undefined") return;
    const target = document.getElementById(sectionId);
    if (!target) return;
    target.scrollIntoView({
      behavior: window.matchMedia("(max-width: 768px)").matches ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  const handleNavClick = React.useCallback(
    (sectionId: string) => {
      setIsMobileMenuOpen(false);
      scrollToSection(sectionId);
    },
    [scrollToSection],
  );

  return (
    <div className="landing-shell relative min-h-screen overflow-x-hidden bg-app-surface text-app-text selection:bg-cyan-500/30">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute left-[-8%] top-[-10%] hidden h-[26rem] w-[26rem] rounded-full opacity-20 blur-[130px] md:block"
          style={{
            background:
              "radial-gradient(circle, rgba(34,211,238,0.18) 0%, transparent 72%)",
          }}
        />
        <div className="landing-shell-overlay absolute inset-0 bg-[linear-gradient(180deg,#081427_0%,#04101f_40%,#030b18_100%)]" />
      </div>

      <nav className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 md:px-10 md:py-5">
        <BrandMark size="md" subtitle="Keyword Research" />

        <div className="hidden items-center gap-8 text-sm text-app-text-muted lg:flex">
          {primaryNavLinks.map((link) => (
            <button
              key={link.sectionId}
              type="button"
              onClick={() => scrollToSection(link.sectionId)}
              className="transition-colors hover:text-app-text"
            >
              {link.label}
            </button>
          ))}
          <a
            href="/blog/"
            className="transition-colors hover:text-app-text"
          >
            Blog
          </a>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle
            themeMode={themeMode}
            onToggle={onToggleTheme}
            className="landing-theme-toggle"
          />

          <button
            onClick={onGetStarted}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-gradient-to-r from-cyan-400 to-teal-400 px-4 py-2 text-sm font-bold text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.16)] transition-all hover:shadow-[0_0_30px_rgba(34,211,238,0.24)] sm:px-5 sm:py-2.5"
          >
            <span className="hidden sm:inline">Start Free</span>
            <span className="sm:hidden">Start</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-app-border/80 bg-app-surface-muted/70 text-app-text transition-colors hover:border-cyan-500/25 hover:text-app-text lg:hidden"
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="landing-mobile-menu"
          >
            {isMobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </nav>

      {isMobileMenuOpen ? (
        <div
          id="landing-mobile-menu"
          className="relative z-20 mx-4 -mt-1 rounded-[1.5rem] border border-app-border/80 bg-app-surface/96 p-4 shadow-[0_24px_70px_rgba(2,6,23,0.38)] lg:hidden sm:mx-6 md:mx-10"
        >
          <div className="flex flex-col gap-2 text-sm text-app-text-muted">
            {primaryNavLinks.map((link) => (
              <button
                key={link.sectionId}
                type="button"
                onClick={() => handleNavClick(link.sectionId)}
                className="rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/[0.04] hover:text-app-text"
              >
                {link.label}
              </button>
            ))}
            <a
              href="/blog/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/[0.04] hover:text-app-text"
            >
              Blog
            </a>
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                onGetStarted();
              }}
              className="mt-2 inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 px-4 py-3 font-bold text-slate-950"
            >
              Start Free
            </button>
          </div>
        </div>
      ) : null}

      <main className="relative z-10 overflow-x-hidden">
        <section className="mx-auto w-full max-w-7xl px-4 pt-12 sm:px-6 md:pt-20 lg:px-8">
          <div className="flex flex-col gap-12 lg:flex-row lg:items-center">
            {/* Left text column */}
            <div className="flex flex-col items-start text-left lg:w-[40%] lg:pr-8 xl:pr-12">
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 px-3 py-1.5 text-sm font-semibold text-cyan-400">
                <TrendingUp className="h-4 w-4" />
                <span>Rank Analyzer Pro</span>
              </div>
              
              <h1 className="mt-6 text-4xl font-black leading-[1.08] tracking-tight text-app-text sm:text-5xl md:text-6xl lg:text-[4rem]">
                App keyword rank tracking without <span className="text-cyan-400">the clutter.</span>
              </h1>
              
              <p className="mt-6 max-w-xl text-[16px] leading-7 text-app-text-muted md:text-lg md:leading-8">
                Rank Analyzer Pro helps app teams discover keywords, check App Store and Google Play ranks by country, compare competitors, and review what changed from one workspace.
              </p>
              
              <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-center md:mt-10">
                <button
                  onClick={onGetStarted}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-8 py-4 text-base font-bold text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all hover:bg-cyan-400 hover:shadow-[0_0_25px_rgba(6,182,212,0.4)] sm:w-auto"
                >
                  Start Free
                  <ArrowRight className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <div className="text-sm text-app-text-muted max-w-[200px] leading-snug">
                    Free start, fast setup, and core tracking from day one.
                  </div>
                </div>
              </div>
            </div>

            {/* Right image column - macOS Window */}
            <div className="w-full lg:w-[60%]">
              <div className="w-full lg:w-[110%] xl:w-[115%]">
                <div className="relative overflow-hidden rounded-[1.5rem] border border-app-border/80 bg-app-surface shadow-[0_24px_80px_rgba(2,6,23,0.5)]">
                  {/* macOS Header */}
                  <div className="flex h-11 w-full items-center gap-2 border-b border-app-border/80 bg-app-surface-muted/50 px-5">
                    <div className="h-3 w-3 rounded-full bg-[#ff5f56]"></div>
                    <div className="h-3 w-3 rounded-full bg-[#ffbd2e]"></div>
                    <div className="h-3 w-3 rounded-full bg-[#27c93f]"></div>
                  </div>
                  {/* Screenshot */}
                  <img 
                    src="/hero-app-screenshot.png" 
                    alt="Rank Analyzer Pro Workspace" 
                    width="1024"
                    height="486"
                    fetchPriority="high"
                    className="w-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>

        </section>

        <section
          className="mx-auto mt-10 max-w-7xl scroll-mt-24 px-4 sm:px-6 md:mt-16 md:scroll-mt-32 md:px-10"
          id="features"
        >
          <div className="max-w-3xl">
            <SectionEyebrow>Core Features</SectionEyebrow>
            <h2 className="mt-5 text-3xl font-black tracking-tight text-app-text md:text-5xl">
              What the tool actually helps you do
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-8 text-app-text-muted">
              Stay focused on the three jobs that matter most: track keywords, compare competitors, and review movement clearly.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {featureCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="rounded-[1.25rem] border border-app-border/80 bg-app-surface-muted/58 p-4 md:p-5"
                >
                  <div className="inline-flex rounded-xl border border-cyan-500/18 bg-cyan-500/8 p-2.5 text-cyan-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-app-text">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-app-text-muted">{card.copy}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-10 rounded-[1.5rem] border border-cyan-500/10 bg-cyan-950/10 p-6 sm:p-8 md:mt-12 md:p-10">
            <div className="flex flex-col items-center text-center">
              <h3 className="mb-2 text-xl font-bold text-app-text">
                Core workflow across the product
              </h3>
              <p className="max-w-2xl text-sm text-app-text-muted">
                Free covers core tracking. Higher tiers add reports, alerts, and deeper monitoring workflows.
              </p>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {[
                { title: "Included on Free", capabilities: FREE_CAPABILITIES },
                { title: "Unlocked on paid plans", capabilities: PAID_CAPABILITIES },
              ].map((group) => (
                <div key={group.title} className="rounded-2xl border border-app-border/70 bg-app-surface/45 p-5">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-400">{group.title}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {group.capabilities.map((cap) => (
                      <div key={cap.label} className="flex min-w-0 flex-col">
                        <div className="flex items-center gap-2">
                          <Check className="h-4 w-4 shrink-0 text-cyan-400" />
                          <span className="text-sm font-semibold text-app-text">{cap.label}</span>
                        </div>
                        <span className="ml-6 mt-0.5 text-xs text-app-text-muted">{cap.sub}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          className="mx-auto mt-10 max-w-7xl scroll-mt-24 px-4 sm:px-6 md:mt-16 md:scroll-mt-32 md:px-10"
          id="pricing"
        >
          <div className="max-w-3xl text-center md:mx-auto">
            <SectionEyebrow>Straightforward Pricing</SectionEyebrow>
            <h2 className="mt-5 text-3xl font-black tracking-tight text-app-text md:text-5xl">
              Pick the workflow depth that fits your portfolio
            </h2>
            <p className="mt-3 text-base leading-8 text-app-text-muted">
              Start free for core tracking, then unlock reports, alerts, and larger monitoring capacity as the portfolio grows.
            </p>
          </div>

          <div className="mt-6 flex justify-center">
            <div className="inline-flex rounded-full border border-app-border/80 bg-app-surface-muted/70 p-1">
              {(["monthly", "yearly"] as BillingInterval[])
                .filter((interval) => availableIntervals.includes(interval))
                .map((interval) => {
                  const isActive = selectedInterval === interval;
                  return (
                    <button
                      key={interval}
                      type="button"
                      onClick={() => setSelectedInterval(interval)}
                      className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors sm:px-5 sm:py-2.5 sm:text-sm ${
                        isActive
                          ? "bg-cyan-500 text-slate-950"
                          : "text-app-text-muted hover:text-app-text"
                      }`}
                    >
                      {interval === "yearly" ? "Yearly" : "Monthly"}
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="mx-auto mt-8 grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pricingCards.map((plan) => {
              const priceLabel = getPlanPriceLabel(
                pricingCatalog,
                plan,
                selectedInterval,
              );
              const selectedPrice = getPlanPrice(
                pricingCatalog,
                plan,
                selectedInterval,
              );
              const yearlyDisplayAmount =
                selectedInterval === "yearly"
                  ? getYearlyMonthlyEquivalentLabel(pricingCatalog, plan)
                  : null;
              const yearlyTotalLabel =
                selectedInterval === "yearly"
                  ? formatBillingAmountFromMinorUnits(
                      selectedPrice?.amount,
                      selectedPrice?.currency,
                    )
                  : null;
              const displayPrice =
                selectedInterval === "yearly" && yearlyDisplayAmount
                  ? { amount: yearlyDisplayAmount, cadence: "/mo" }
                  : splitPriceLabel(
                      priceLabel,
                      plan.contactOnly ? "Custom" : "Loading",
                    );
              const billingSubtext =
                plan.contactOnly
                  ? null
                  : selectedInterval === "yearly"
                    ? yearlyTotalLabel
                      ? `billed annually at ${yearlyTotalLabel}/year`
                      : "billed annually"
                    : "billed monthly";

              return (
                <div
                  key={plan.name}
                  className={`flex h-full flex-col rounded-[1.5rem] border p-5 ${
                    plan.highlight
                      ? "border-cyan-400/30 bg-app-surface-muted/82 shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_22px_60px_rgba(2,6,23,0.42)]"
                      : "border-app-border/80 bg-app-surface-muted/58"
                  }`}
                >
                  <div className="flex min-h-[3rem] items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-app-text">{plan.name}</div>
                      <div className="mt-2 text-2xl font-black tracking-tight text-app-text">
                        {displayPrice.amount}
                      </div>
                      {displayPrice.cadence && !plan.contactOnly ? (
                        <div className="mt-0.5 text-xs text-app-text-muted">
                          {displayPrice.cadence}
                        </div>
                      ) : null}
                    </div>
                    {plan.badge ? (
                      <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                        {plan.badge}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 min-h-[1.25rem] text-[11px] leading-5 text-app-text-muted">
                    {billingSubtext || "custom terms"}
                  </p>
                  <p className="mt-2 text-xs leading-6 text-app-text-muted">{plan.description}</p>

                  <div className="mt-5 flex-1 space-y-2.5">
                    {plan.features.map((point) => (
                      <div
                        key={point}
                        className="flex items-start gap-2.5 text-[13px] text-app-text-muted"
                      >
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex flex-col justify-end">
                    <button
                      onClick={onGetStarted}
                      className={`inline-flex w-full items-center justify-center rounded-xl px-3 py-2.5 text-[13px] font-bold transition-colors ${
                        plan.highlight
                          ? "bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950"
                          : "border border-app-border/70 bg-app-surface/78 text-app-text hover:bg-app-surface-muted/90"
                      }`}
                    >
                      {plan.cta}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 text-center">
            <SupportEmailLink
              subject="Rank Analyzer Pro Custom Terms"
              className="text-sm font-semibold text-cyan-300 underline-offset-4 transition-colors hover:text-cyan-200 hover:underline"
            >
              Contact us for custom terms
            </SupportEmailLink>
          </div>

          <div className="mx-auto mt-8 hidden max-w-7xl overflow-hidden rounded-[1.5rem] border border-app-border/80 bg-app-surface-muted/58 md:block">
            <div className="border-b border-app-border/70 px-5 py-4 sm:px-6">
              <h3 className="text-lg font-bold text-app-text">Plan comparison</h3>
              <p className="mt-1 text-sm text-app-text-muted">
                Capacity scales by tier. Reports and alert automation start on paid plans.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[42rem] w-full text-left">
                <thead>
                  <tr className="border-b border-app-border/70">
                    <th className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-app-text-muted sm:px-6">
                      Capability
                    </th>
                    {pricingCards.map((plan) => (
                      <th
                        key={`compare-head-${plan.id}`}
                        className="px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-app-text-muted sm:px-6"
                      >
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PRICING_COMPARISON_ROWS.map((row) => (
                    <tr key={row.label} className="border-b border-app-border/60 last:border-b-0">
                      <td className="px-5 py-3 text-sm font-semibold text-app-text sm:px-6">
                        {row.label}
                      </td>
                      {pricingCards.map((plan) => (
                        <td
                          key={`${row.label}-${plan.id}`}
                          className="px-5 py-3 text-sm text-app-text-muted sm:px-6"
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
        </section>

        <section
          className="mx-auto mt-10 max-w-5xl scroll-mt-24 px-4 pb-16 sm:px-6 md:mt-16 md:scroll-mt-32 md:px-10 md:pb-20"
          id="faq"
        >
          <div className="text-center">
            <SectionEyebrow>FAQ</SectionEyebrow>
            <h2 className="mt-5 text-3xl font-black tracking-tight text-app-text md:text-5xl">
              Questions teams ask before they start tracking
            </h2>
          </div>

          <div className="mt-8 space-y-2.5">
            {faqItems.map((item, index) => {
              const isOpen = openFaqIndices.includes(index);
              return (
                <div key={item.question} className="w-full">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenFaqIndices((current) =>
                        current.includes(index)
                          ? current.filter((i) => i !== index)
                          : [...current, index],
                      )
                    }
                    className="flex w-full items-center justify-between rounded-[1rem] border border-app-border/80 bg-app-surface-muted/58 px-4 py-3.5 text-left text-sm font-medium text-app-text transition-colors hover:border-cyan-500/25 sm:px-5 md:text-[15px]"
                  >
                    <div className="pr-4">
                      <div>{item.question}</div>
                      {isOpen ? (
                        <div className="mt-2 text-[14px] leading-relaxed text-app-text-muted">
                          {item.answer}
                        </div>
                      ) : null}
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-app-text-muted transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-12 rounded-[1.25rem] border border-app-border/80 bg-app-surface px-5 py-6 text-center shadow-[0_24px_60px_rgba(2,6,23,0.34)] sm:px-6 md:mt-14 md:rounded-[1.5rem] md:px-8 md:py-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/18 bg-cyan-500/8 text-cyan-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="mx-auto mt-4 max-w-2xl text-2xl font-black tracking-tight text-app-text md:text-3xl">
              Ready to turn app search into a tracked growth workflow?
            </h3>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-app-text-muted">
              Use Rank Analyzer Pro to validate ranked terms, monitor real movement, and review competitors with much less operational noise.
            </p>
            <button
              onClick={onGetStarted}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-cyan-400 to-teal-400 px-5 py-3 text-[13px] font-bold text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.22)] transition-all hover:shadow-[0_0_40px_rgba(34,211,238,0.3)] sm:w-auto md:text-sm"
            >
              Start Free
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </main>

      <footer className="relative z-10 bg-app-surface py-16 md:py-24">
        {/* Top subtle border/gradient */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-slate-500/20 to-transparent"></div>
        
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 px-4 sm:px-6 md:px-10">
          <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-sm">
              <BrandMark size="sm" subtitle="Keyword Research" />
              <p className="mt-6 text-sm leading-7 text-app-text-muted">
                A focused ASO workspace for keyword tracking, competitor groups, and movement reporting. Validate ranked terms and monitor real movement with much less operational noise.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3 sm:gap-12 lg:gap-16">
              <div>
                <h3 className="mb-4 font-semibold uppercase tracking-[0.16em] text-app-text-muted">
                  Product
                </h3>
                <ul className="flex flex-col space-y-3 text-app-text-muted">
                  {primaryNavLinks.map((link) => (
                    <li key={link.sectionId}>
                      <button
                        type="button"
                        onClick={() => scrollToSection(link.sectionId)}
                        className="transition-colors hover:text-app-text"
                      >
                        {link.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-4 font-semibold uppercase tracking-[0.16em] text-app-text-muted">
                  SEO Pages
                </h3>
                <ul className="flex flex-col space-y-3 text-app-text-muted">
                  <li>
                    <a href="/aso-rank-tracker/" className="transition-colors hover:text-app-text">
                      ASO Rank Tracker
                    </a>
                  </li>
                  <li>
                    <a href="/app-keyword-tracking-tool/" className="transition-colors hover:text-app-text">
                      App Keyword Tracker
                    </a>
                  </li>
                  <li>
                    <a href="/google-play-keyword-rank-tracker/" className="transition-colors hover:text-app-text">
                      Google Play Tracker
                    </a>
                  </li>
                  <li>
                    <a href="/app-store-keyword-rank-tracker/" className="transition-colors hover:text-app-text">
                      App Store Tracker
                    </a>
                  </li>
                  <li>
                    <a href="/competitor-app-keyword-tracker/" className="transition-colors hover:text-app-text">
                      Competitor Tracking
                    </a>
                  </li>
                  <li>
                    <a href="/blog/" className="transition-colors hover:text-app-text">
                      Blog
                    </a>
                  </li>
                </ul>
              </div>
              
              <div>
                <h3 className="mb-4 font-semibold uppercase tracking-[0.16em] text-app-text-muted">
                  Legal
                </h3>
                <ul className="flex flex-col space-y-3 text-app-text-muted">
                  <li>
                    <button
                      onClick={onOpenPrivacy}
                      className="transition-colors hover:text-app-text"
                    >
                      Privacy Policy
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={onOpenTerms}
                      className="transition-colors hover:text-app-text"
                    >
                      Terms of Service
                    </button>
                  </li>
                </ul>
              </div>
              
              <div className="col-span-2 sm:col-span-3 lg:col-span-1">
                <h3 className="mb-4 font-semibold uppercase tracking-[0.16em] text-app-text-muted">
                  Focus
                </h3>
                <ul className="flex flex-col space-y-3 text-app-text-muted">
                  <li className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-cyan-500" />
                    Search before tracking
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-cyan-500" />
                    Track before reporting
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-cyan-500" />
                    Compete with context
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Bottom Copyright */}
          <div className="flex flex-col items-center justify-between gap-6 border-t border-slate-500/10 pt-8 text-xs text-app-text-muted sm:flex-row">
            <p>© {new Date().getFullYear()} Rank Analyzer Pro. All rights reserved.</p>
            <a
              href="https://launchbuff.com"
              target="_blank"
              rel="noopener noreferrer"
              title="Featured on LaunchBuff"
              className="flex max-w-full items-center rounded-lg opacity-90 transition-opacity hover:opacity-100"
            >
              <img
                src="https://launchbuff.com/badge-featured-dark.svg"
                alt="Featured on LaunchBuff"
                width="256"
                height="80"
                className="h-auto max-w-full"
              />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
