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
  action,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="workspace-empty-block px-6 py-10 md:p-12">
      <div className="workspace-empty-icon mb-4">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="workspace-empty-title mb-2 text-lg">{title}</h3>
      <p className="workspace-empty-description mb-6 max-w-sm mx-auto">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function MobileBottomNav({
  tabs,
  activeId,
  onTabChange,
}: {
  tabs: WorkspacePageConfig[];
  activeId: WorkspaceViewMode;
  onTabChange: (id: WorkspaceViewMode) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-md dark:border-app-border dark:bg-app-surface/95 md:hidden">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeId === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "relative flex min-h-[48px] min-w-[64px] flex-col items-center justify-center gap-1 rounded-lg px-2 py-1 transition-colors active:scale-95",
              isActive
                ? "text-cyan-600 dark:text-cyan-400"
                : "text-app-text-muted hover:text-slate-900 dark:text-app-text-muted dark:hover:text-app-text",
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">
              {tab.shortLabel || tab.label}
            </span>
            {typeof tab.badge === "number" && tab.badge > 0 && (
              <span className="absolute right-2 top-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-cyan-500 px-1 text-[9px] font-bold text-white shadow-sm">
                {tab.badge > 99 ? "99+" : tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

export function MobileDataCard({
  title,
  subtitle,
  badges,
  metrics,
  actions,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode[];
  metrics?: { label: string; value: React.ReactNode }[];
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-app-border/60 dark:bg-app-surface-muted/40 md:hidden",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-900 dark:text-app-text">
              {title}
            </span>
            {badges?.map((badge, i) => (
              <span key={i} className="shrink-0">
                {badge}
              </span>
            ))}
          </div>
          {subtitle && (
            <div className="text-xs text-app-text-muted dark:text-app-text-muted">
              {subtitle}
            </div>
          )}
        </div>
      </div>
      
      {metrics && metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 dark:bg-app-surface/50">
          {metrics.map((metric, i) => (
            <div key={i} className="flex flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-app-text-muted">
                {metric.label}
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-app-text">
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      )}
      
      {actions && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}
