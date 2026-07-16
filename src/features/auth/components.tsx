import React from "react";
import SupportEmailLink from "../../components/SupportEmailLink";
import {
  ArrowLeft,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import BrandMark from "../../components/BrandMark";
import ThemeToggle from "../../components/ThemeToggle";
import type { ThemeMode } from "../../lib/theme";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="w-5 h-5">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.68-.06-1.34-.19-1.97H12v3.73h5.39a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.98-4.3 2.98-7.28Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.44l-3.23-2.5c-.9.6-2.04.96-3.39.96-2.6 0-4.8-1.76-5.58-4.12H3.08v2.58A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC04"
        d="M6.42 13.9A6 6 0 0 1 6.1 12c0-.66.12-1.3.32-1.9V7.52H3.08A10 10 0 0 0 2 12c0 1.6.38 3.1 1.08 4.48l3.34-2.58Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.98c1.47 0 2.8.5 3.84 1.48l2.88-2.88C16.95 2.94 14.7 2 12 2a10 10 0 0 0-8.92 5.52L6.42 10.1C7.2 7.74 9.4 5.98 12 5.98Z"
      />
    </svg>
  );
}

function LegalDocumentScreen({
  title,
  subtitle,
  onBack,
  themeMode,
  onToggleTheme,
  children,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="auth-shell">
      <div className="auth-orb auth-orb-cyan" />
      <div className="auth-orb auth-orb-indigo" />
      <div className="auth-orb auth-orb-cyan" />
      <div className="auth-panel max-h-[88vh] overflow-y-auto">
        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-app-text-muted transition-colors hover:text-app-text"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <ThemeToggle
            themeMode={themeMode}
            onToggle={onToggleTheme}
            className="auth-theme-toggle"
          />
        </div>
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 badge badge-cyan mb-4">
            <ShieldCheck className="w-3.5 h-3.5" /> Legal
          </div>
          <h1 className="font-display text-3xl font-bold text-app-text tracking-tight">
            {title}
          </h1>
          <p className="text-app-text-muted mt-3 text-sm leading-6">{subtitle}</p>
        </div>
        <div
          className={`prose prose-sm max-w-none ${
            themeMode === "light" ? "prose-slate text-slate-600" : "prose-invert text-app-text-muted"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function PrivacyPolicyPage({
  onBack,
  themeMode,
  onToggleTheme,
}: {
  onBack: () => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}) {
  return (
    <LegalDocumentScreen
      title="Privacy Policy"
      subtitle="How Rank Analyzer Pro stores and uses account data."
      onBack={onBack}
      themeMode={themeMode}
      onToggleTheme={onToggleTheme}
    >
      <p>Effective date: June 30, 2026.</p>
      <h2>Information We Collect</h2>
      <p>
        Rank Analyzer Pro stores account and workspace data needed to run the
        app. This includes your Firebase user ID, email address or sign-in
        provider details, bookmarks, tracked apps, competitor groups, tracked
        keywords, rank history, report snapshots, alert rules, alert events,
        notification settings, legal acceptance metadata, and account-level app
        preferences.
      </p>
      <p>
        If you enable browser notifications, we also store device registration
        tokens so notification delivery can work. If you use a paid plan or
        trial, we also store billing status and related metadata such as plan,
        interval, subscription state, Dodo customer or product identifiers, and
        transaction references required to manage access.
      </p>
      <h2>Local Browser Storage</h2>
      <p>
        The app uses local browser storage for essential sign-in flow state,
        theme, cookie consent, workspace preferences, and optional performance
        cache behavior. Some discovery and app data may also be cached on the
        server for performance and stability.
      </p>
      <h2>How We Use Data</h2>
      <p>
        We use your data to provide Analyze, Compare, Reports, Bookmarks,
        Tracked Keywords, Competitor Group monitoring, export features, billing
        access, account support, and notification delivery by in-app feed,
        browser push, and email.
      </p>
      <p>
        We may also use service logs and operational metadata to debug failures,
        protect the platform from abuse, enforce plan limits, and improve
        performance, discovery quality, and delivery reliability.
      </p>
      <h2>Third-Party Services</h2>
      <p>
        Rank Analyzer Pro uses Firebase Authentication, Firestore, and Firebase
        Cloud Messaging; Dodo Payments for subscriptions, checkout, and billing
        portal access; Resend for transactional or announcement email delivery;
        Groq's GPT OSS 120B for keyword refinement, with Google Gemini as a
        fallback; and cloud-hosted backend infrastructure including Cloud Run
        and Firebase Hosting.
      </p>
      <p>
        App search, ranking, chart, and metadata features depend on third-party
        store data sources and supporting network services, including Google
        Play, iOS App Store data providers, and proxy infrastructure used to
        complete some store lookups.
      </p>
      <h2>Data Retention</h2>
      <p>
        Workspace data remains associated with your account until you delete the
        relevant records or delete the account. Billing, legal acceptance,
        fraud-prevention, notification, operational, and support-related records
        may be retained for legitimate business, accounting, tax, security,
        dispute, or legal compliance reasons.
      </p>
      <h2>Your Choices</h2>
      <p>
        You can manage or remove tracked data inside the app, control whether
        optional storage is allowed, update notification settings, and delete
        your account from the product. Paid subscriptions can be cancelled using
        the billing portal when available. Deleting an account does not
        automatically remove records we must retain for billing, fraud, or legal
        compliance.
      </p>
      <h2>No Sale of Payment Card Data</h2>
      <p>
        We do not store full payment card numbers in the app database. Payment
        processing is handled by the billing provider.
      </p>
      <h2>Contact</h2>
      <p>
        For support, billing, or sales questions, contact
        {" "}
        <SupportEmailLink>vantalumstudio@gmail.com</SupportEmailLink>.
      </p>
    </LegalDocumentScreen>
  );
}

export function TermsPage({
  onBack,
  themeMode,
  onToggleTheme,
}: {
  onBack: () => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}) {
  return (
    <LegalDocumentScreen
      title="Terms & Conditions"
      subtitle="The basic terms for using Rank Analyzer Pro."
      onBack={onBack}
      themeMode={themeMode}
      onToggleTheme={onToggleTheme}
    >
      <p>Effective date: June 30, 2026.</p>
      <h2>Service Scope</h2>
      <p>
        Rank Analyzer Pro provides app keyword research, app-store discovery,
        competitor group analysis, reports, bookmarking, alerting, export, and
        related monitoring tools for iOS and Google Play research workflows.
      </p>
      <h2>Account Responsibility</h2>
      <p>
        You are responsible for activity under your account, the security of
        your sign-in methods, and the accuracy of information you submit through
        the service.
      </p>
      <h2>Subscriptions, Trials, and Billing</h2>
      <p>
        Paid access, trials, and plan limits are governed by the pricing and
        checkout terms shown at purchase. Subscription billing, renewals,
        cancellations, and billing portal access may be handled through Dodo
        Payments or another payment provider used by the service.
      </p>
      <p>
        Plans may include limits on tracked apps, competitor groups, tracked
        keywords, notification volume, or other operational usage. We may
        enforce those limits inside the product.
      </p>
      <h2>Cancellations and Refunds</h2>
      <p>
        You may cancel a subscription through the billing portal when available
        or by contacting{" "}
        <SupportEmailLink>vantalumstudio@gmail.com</SupportEmailLink>. Cancellation generally stops future renewals
        but does not automatically create a refund for charges already incurred.
        Refund decisions, if offered, are handled case by case and may depend on
        payment-provider rules, trial use, abuse review, and applicable law.
      </p>
      <h2>Data and Availability</h2>
      <p>
        Search rankings, keyword suggestions, discovery results, charts, alerts,
        app metadata, and other outputs are provided on a best-effort basis.
        They may be delayed, incomplete, estimated, unavailable, or changed by
        upstream services without notice.
      </p>
      <h2>Acceptable Use</h2>
      <p>
        You must not misuse the service, interfere with its operation, attempt
        unauthorized access, bypass plan or rate limits, reverse engineer
        protected systems, resell unauthorized access, send unlawful or abusive
        content through notifications or email features, or use the service in
        violation of store policies or applicable law.
      </p>
      <h2>Suspension</h2>
      <p>
        Access may be suspended, limited, or terminated for unpaid balances,
        chargebacks, fraud concerns, abuse, excessive automated use, policy
        violations, or behavior that creates operational or legal risk.
      </p>
      <h2>Intellectual Property</h2>
      <p>
        The service, its software, and its product content remain the property
        of their respective owners. You retain rights to data you submit, but
        you grant us the rights needed to host, process, and display it in order
        to operate the service.
      </p>
      <h2>Termination</h2>
      <p>
        You may stop using the service at any time. You may also delete your
        account from within the app. Termination or account deletion does not
        automatically erase outstanding payment obligations or records that must
        be retained for legal, billing, or security reasons.
      </p>
      <h2>Changes</h2>
      <p>
        We may update these terms as the product evolves. Continued use after a
        legal update may require renewed acceptance.
      </p>
      <h2>Contact</h2>
      <p>
        For support, billing, or sales questions, contact
        {" "}
        <SupportEmailLink>vantalumstudio@gmail.com</SupportEmailLink>.
      </p>
    </LegalDocumentScreen>
  );
}

export function LoginScreen({
  authMode,
  authError,
  email,
  password,
  isSubmitting,
  legalAccepted,
  onAuthModeChange,
  onEmailChange,
  onPasswordChange,
  onLegalAcceptedChange,
  onEmailSubmit,
  onGoogleSignIn,
  onOpenPrivacy,
  onOpenTerms,
  themeMode,
  onToggleTheme,
}: {
  authMode: "signin" | "signup";
  authError: string | null;
  email: string;
  password: string;
  isSubmitting: boolean;
  legalAccepted: boolean;
  onAuthModeChange: (mode: "signin" | "signup") => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onLegalAcceptedChange: (value: boolean) => void;
  onEmailSubmit: (event: React.FormEvent) => Promise<void>;
  onGoogleSignIn: () => Promise<void>;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
}) {
  const isSignIn = authMode === "signin";
  return (
    <div className="auth-shell">
      <div className="auth-orb auth-orb-cyan" />
      <div className="auth-orb auth-orb-indigo" />
      <div className="auth-orb auth-orb-cyan" />
      <div className="auth-panel">
        <div className="mb-4 flex justify-end">
          <ThemeToggle
            themeMode={themeMode}
            onToggle={onToggleTheme}
            className="auth-theme-toggle"
          />
        </div>
        <div className="flex items-center justify-center mb-6">
          <BrandMark variant="mark" size="lg" />
        </div>
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 badge badge-cyan mb-4">
            <ShieldCheck className="w-3.5 h-3.5" /> Secure access
          </div>
          <h1 className="font-display text-3xl font-bold text-app-text tracking-tight">
            Sign in to Rank Analyzer Pro
          </h1>
          <p className="text-app-text-muted mt-3 text-sm leading-6">
            Use Google or your email and password to access the analyzer
            workspace.
          </p>
        </div>
        <div
          className="flex gap-2 p-1 rounded-2xl mb-6"
          style={{
            background: "rgba(15,23,42,0.75)",
            border: "1px solid rgba(51,65,85,0.45)",
          }}
        >
          <button
            type="button"
            onClick={() => onAuthModeChange("signin")}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all"
            style={
              isSignIn
                ? {
                    background:
                      "linear-gradient(135deg, rgba(96, 165, 250,0.18), rgba(129,140,248,0.18))",
                    color: "#e0f2fe",
                    border: "1px solid rgba(96, 165, 250,0.25)",
                  }
                : { color: "#94a3b8" }
            }
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => onAuthModeChange("signup")}
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all"
            style={
              !isSignIn
                ? {
                    background:
                      "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(96, 165, 250,0.18))",
                    color: "#d1fae5",
                    border: "1px solid rgba(16,185,129,0.25)",
                  }
                : { color: "#94a3b8" }
            }
          >
            Create account
          </button>
        </div>
        <button
          type="button"
          onClick={onGoogleSignIn}
          disabled={isSubmitting || !legalAccepted}
          className="btn-google w-full mb-6"
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <GoogleMark />
          )}
          Continue with Google
        </button>
        <div className="auth-divider mb-6">
          <span>or use email</span>
        </div>
        <form onSubmit={onEmailSubmit} className="space-y-4">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-muted">
              Email
            </span>
            <div className="relative mt-2">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" />
              <input
                type="email"
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                className="input-field"
                placeholder="you@company.com"
                autoComplete="email"
                style={{ paddingLeft: "2.85rem" }}
              />
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-app-text-muted">
              Password
            </span>
            <div className="relative mt-2">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" />
              <input
                type="password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                className="input-field"
                placeholder={
                  isSignIn ? "Enter your password" : "Create a password"
                }
                autoComplete={isSignIn ? "current-password" : "new-password"}
                style={{ paddingLeft: "2.85rem" }}
              />
            </div>
          </label>
          {authError && (
            <div
              className="rounded-2xl px-4 py-3 text-sm"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.18)",
                color: "#fca5a5",
              }}
            >
              {authError}
            </div>
          )}
          <label
            className="flex items-start gap-3 rounded-2xl px-4 py-3 text-sm"
            style={{
              background: "rgba(15,23,42,0.65)",
              border: "1px solid rgba(51,65,85,0.45)",
            }}
          >
            <input
              type="checkbox"
              checked={legalAccepted}
              onChange={(event) => onLegalAcceptedChange(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-app-border bg-app-surface-muted text-cyan-400 focus:ring-cyan-500"
            />
            <span className="text-app-text-muted leading-6">
              I agree to the{" "}
              <button
                type="button"
                onClick={onOpenTerms}
                className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
              >
                Terms &amp; Conditions
              </button>{" "}
              and{" "}
              <button
                type="button"
                onClick={onOpenPrivacy}
                className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
              >
                Privacy Policy
              </button>
              .
            </span>
          </label>
          <button
            type="submit"
            disabled={
              isSubmitting ||
              !email.trim() ||
              !password.trim() ||
              !legalAccepted
            }
            className="btn-primary w-full"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : null}
            {isSignIn ? "Sign in with email" : "Create account"}
          </button>
        </form>
        <p className="text-xs text-app-text-muted leading-6 mt-6 text-center">
          Review our{" "}
          <button
            type="button"
            onClick={onOpenPrivacy}
            className="text-app-text-muted hover:text-app-text underline underline-offset-4"
          >
            Privacy Policy
          </button>{" "}
          and{" "}
          <button
            type="button"
            onClick={onOpenTerms}
            className="text-app-text-muted hover:text-app-text underline underline-offset-4"
          >
            Terms &amp; Conditions
          </button>{" "}
          before continuing.
        </p>
      </div>
    </div>
  );
}
