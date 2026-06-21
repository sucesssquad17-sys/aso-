import React from "react";
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
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-200"
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
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">
            {title}
          </h1>
          <p className="text-slate-400 mt-3 text-sm leading-6">{subtitle}</p>
        </div>
        <div
          className={`prose prose-sm max-w-none ${
            themeMode === "light" ? "prose-slate text-slate-600" : "prose-invert text-slate-300"
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
      <p>Effective date: May 26, 2026.</p>
      <h2>Information We Store</h2>
      <p>
        We store your Firebase authentication identifier, bookmarks, tracked
        keywords, rank history, tracking schedule, and legal acceptance metadata
        in Firestore.
      </p>
      <p>
        We also use browser local storage for essential app behavior, and you
        can choose whether to allow optional performance cache and preference
        storage the first time you visit.
      </p>
      <h2>How We Use Data</h2>
      <p>
        We use this data only to provide your saved analyzer workspace, sync it
        across sessions, and support keyword tracking features tied to your
        account.
      </p>
      <h2>Premium Features and Billing Data</h2>
      <p>
        If premium plans, subscriptions, or paid features are added later, we
        may also store plan status, subscription identifiers, billing metadata,
        invoices, renewal state, and payment-related events needed to manage
        access. We do not intend to store full card numbers in the app database.
      </p>
      <h2>Third-Party Services</h2>
      <p>
        The application uses Firebase Authentication and Firestore. App search,
        app detail, and ranking requests are also sent to the application server
        to retrieve app-store data. If premium billing is added, payment
        processing may also be handled by a third-party billing provider.
      </p>
      <h2>Data Retention</h2>
      <p>
        Your saved workspace data remains associated with your account until you
        delete it or delete the account. If premium billing is added, some
        billing and transaction records may be retained for accounting, fraud
        prevention, dispute handling, tax, or legal compliance.
      </p>
      <h2>Your Choices</h2>
      <p>
        You can delete bookmarks and tracked keywords individually, clear
        client-side cache, or delete your entire account from inside the app. If
        premium access is added later, cancelling a subscription may stop future
        renewals but may not immediately delete legally required billing
        records.
      </p>
      <p>
        Optional browser storage can also be declined on first visit by choosing
        essential storage only.
      </p>
      <h2>Contact</h2>
      <p>
        For support, billing, or sales questions, contact
        {" "}
        <a href="mailto:vantalumstudio@gmail.com">vantalumstudio@gmail.com</a>.
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
      <p>Effective date: May 26, 2026.</p>
      <h2>Use of the Service</h2>
      <p>
        You may use the service only for lawful business or research purposes
        related to app search optimization and competitive analysis.
      </p>
      <h2>Account Responsibility</h2>
      <p>
        You are responsible for maintaining access to your
        Firebase-authenticated account and for activity that occurs under it.
      </p>
      <h2>Premium Plans and Paid Features</h2>
      <p>
        Rank Analyzer Pro may later offer premium plans, subscriptions, credits,
        or paid features. Access to premium functionality may depend on
        successful payment, an active subscription, and compliance with these
        terms.
      </p>
      <h2>Billing and Renewals</h2>
      <p>
        If recurring billing is introduced, subscriptions may renew
        automatically until cancelled, subject to the billing terms shown at
        purchase. Fees, billing cycles, refunds, trials, and cancellation rules
        may vary by plan and payment provider.
      </p>
      <h2>Data Accuracy</h2>
      <p>
        Ranking, keyword, and app-store data are provided on a best-effort basis
        and may change or become unavailable without notice.
      </p>
      <h2>Prohibited Use</h2>
      <p>
        You must not misuse the service, interfere with its operation, attempt
        unauthorized access, or use it in ways that violate store policies or
        applicable law.
      </p>
      <h2>Suspension and Payment Issues</h2>
      <p>
        Premium access may be suspended, limited, or revoked for failed
        payments, chargebacks, fraud concerns, abuse, policy violations, or
        misuse of the service.
      </p>
      <h2>Termination</h2>
      <p>
        You may stop using the service at any time. You may also delete your
        account from within the app, which removes your saved Firestore account
        data. Deleting an account does not automatically waive or erase valid
        payment obligations, outstanding charges, or records that must be
        retained by law.
      </p>
      <h2>Changes</h2>
      <p>
        These terms may change. When they do, update the legal version and
        require acceptance again if needed.
      </p>
      <h2>Contact</h2>
      <p>
        For support, billing, or sales questions, contact
        {" "}
        <a href="mailto:vantalumstudio@gmail.com">vantalumstudio@gmail.com</a>.
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
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">
            Sign in to Rank Analyzer Pro
          </h1>
          <p className="text-slate-400 mt-3 text-sm leading-6">
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
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Email
            </span>
            <div className="relative mt-2">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
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
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Password
            </span>
            <div className="relative mt-2">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
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
              className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-400 focus:ring-cyan-500"
            />
            <span className="text-slate-400 leading-6">
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
        <p className="text-xs text-slate-500 leading-6 mt-6 text-center">
          Review our{" "}
          <button
            type="button"
            onClick={onOpenPrivacy}
            className="text-slate-300 hover:text-white underline underline-offset-4"
          >
            Privacy Policy
          </button>{" "}
          and{" "}
          <button
            type="button"
            onClick={onOpenTerms}
            className="text-slate-300 hover:text-white underline underline-offset-4"
          >
            Terms &amp; Conditions
          </button>{" "}
          before continuing.
        </p>
      </div>
    </div>
  );
}
