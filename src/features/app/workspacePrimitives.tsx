import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export type WorkspaceViewMode =
  | "single"
  | "compare"
  | "reports"
  | "competitors"
  | "bookmarks"
  | "tracked"
  | "upgrade";

export interface WorkspacePageConfig {
  id: WorkspaceViewMode;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  badge?: number;
  eyebrow: string;
  title: string;
  description: string;
}

export function WorkspacePanel({
  children,
  className,
  tone = "default",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "muted" | "strong";
}) {
  return (
    <section
      className={cn(
        "workspace-panel",
        tone === "muted" && "workspace-panel-muted",
        tone === "strong" && "workspace-panel-strong",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function WorkspacePageIntro({
  eyebrow,
  title,
  description,
  icon: Icon,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  aside?: React.ReactNode;
}) {
  return (
    <div className="workspace-page-intro relative overflow-visible">
      <div className="workspace-page-intro-main relative z-10">
        <div className="workspace-page-intro-icon hidden sm:inline-flex">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="workspace-page-eyebrow">{eyebrow}</div>
          <h1 className="workspace-page-title">{title}</h1>
          <p className="workspace-page-description">{description}</p>
        </div>
      </div>
      {aside ? <div className="workspace-page-intro-aside relative z-10">{aside}</div> : null}
    </div>
  );
}

export function WorkspaceMetricCard({
  label,
  value,
  hint,
  trend,
  accent = "cyan",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  trend?: React.ReactNode;
  accent?: "cyan" | "emerald" | "amber" | "violet" | "slate";
}) {
  return (
    <div className={cn("workspace-metric-card", `workspace-metric-${accent}`)}>
      <div className="workspace-metric-label">{label}</div>
      <div className="workspace-metric-value">{value}</div>
      {hint ? <div className="workspace-metric-hint">{hint}</div> : null}
      {trend ? <div className="workspace-metric-trend">{trend}</div> : null}
    </div>
  );
}

export function WorkspaceMetricGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("workspace-metric-grid", className)}>{children}</div>;
}

export function WorkspaceNavButton({
  active,
  item,
  onClick,
  compact = false,
}: {
  active: boolean;
  item: WorkspacePageConfig;
  onClick: () => void;
  compact?: boolean;
}) {
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "workspace-nav-button",
        active && "workspace-nav-button-active",
        compact && "workspace-nav-button-compact",
      )}
    >
      <span className="workspace-nav-icon">
        <Icon className="h-4 w-4" />
      </span>
      <span className="workspace-nav-copy">
        <span className="workspace-nav-label">
          {compact && item.shortLabel ? item.shortLabel : item.label}
        </span>
        {!compact ? (
          <span className="workspace-nav-eyebrow">{item.eyebrow}</span>
        ) : null}
      </span>
      {typeof item.badge === "number" ? (
        <span className="workspace-nav-badge">{item.badge}</span>
      ) : null}
    </button>
  );
}

export function WorkspaceEmptyBlock({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <div className="workspace-empty-block">
      <div className="workspace-empty-icon">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="workspace-empty-title">{title}</h3>
      <p className="workspace-empty-description">{description}</p>
    </div>
  );
}
