import { useEffect, useRef } from "react";
import { ArrowUpRight, Lock, X } from "lucide-react";

export type LockedFeature = {
  title: string;
  description: string;
  benefits: string[];
};

type LockedFeatureModalProps = {
  feature: LockedFeature | null;
  onClose: () => void;
  onViewPlans: () => void;
};

export function LockedFeatureModal({
  feature,
  onClose,
  onViewPlans,
}: LockedFeatureModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!feature) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [feature, onClose]);

  if (!feature) return null;

  return (
    <div className="workspace-mobile-overlay fixed inset-0 z-[70] flex items-center justify-center bg-[color:var(--color-canvas)]/80 p-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="locked-feature-title"
        className="workspace-mobile-dialog w-full max-w-lg rounded-3xl border workspace-border-strong bg-[color:var(--color-surface-elevated)] p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="inline-flex rounded-2xl border border-cyan-400/25 bg-cyan-500/10 p-3 text-cyan-300">
            <Lock className="h-5 w-5" />
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="workspace-icon-button"
            aria-label="Close upgrade preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-400">
          Paid feature
        </p>
        <h2 id="locked-feature-title" className="mt-1 text-xl font-bold text-app-text">
          {feature.title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-app-text-muted">
          {feature.description}
        </p>
        <div className="mt-5 space-y-2 rounded-2xl border workspace-border-default bg-[color:var(--color-surface-muted)] p-4">
          {feature.benefits.map((benefit) => (
            <div key={benefit} className="flex items-start gap-2 text-sm text-app-text-muted">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="workspace-secondary-button px-4 py-2.5 text-sm">
            Keep exploring
          </button>
          <button
            type="button"
            onClick={onViewPlans}
            className="workspace-primary-button inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm"
          >
            View paid plans
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
