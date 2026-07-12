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
        "workspace-surface workspace-card workspace-panel",
        tone === "muted" && "workspace-muted workspace-panel-muted",
        tone === "strong" && "workspace-strong workspace-panel-strong",
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
  compact = false,
  dense = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  aside?: React.ReactNode;
  compact?: boolean;
  dense?: boolean;
}) {
  return (
    <div className={cn("workspace-page-intro workspace-surface relative overflow-visible", compact && "workspace-page-intro-compact", dense && "workspace-page-intro-dense")}>
      <div className={cn("workspace-page-intro-main relative z-10", compact && "workspace-page-intro-main-compact", dense && "workspace-page-intro-main-dense")}>
        <div className={cn("workspace-page-intro-icon hidden sm:inline-flex", compact && "workspace-page-intro-icon-compact", dense && "workspace-page-intro-icon-dense")}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="workspace-page-eyebrow">{eyebrow}</div>
          <h1 className={cn("workspace-page-title", compact && "workspace-page-title-compact", dense && "workspace-page-title-dense")}>{title}</h1>
          <p className={cn("workspace-page-description", compact && "workspace-page-description-compact", dense && "workspace-page-description-dense")}>{description}</p>
        </div>
      </div>
      {aside ? <div className={cn("workspace-page-intro-aside relative z-10", compact && "workspace-page-intro-aside-compact", dense && "workspace-page-intro-aside-dense")}>{aside}</div> : null}
    </div>
  );
}

export function WorkspaceMetricCard({
  label,
  value,
  hint,
  trend,
  accent = "cyan",
  compact = false,
  dense = false,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  trend?: React.ReactNode;
  accent?: "cyan" | "emerald" | "amber" | "violet" | "slate";
  compact?: boolean;
  dense?: boolean;
}) {
  return (
    <div className={cn("workspace-card workspace-metric-card flex flex-col", compact && "workspace-metric-card-compact", dense && "workspace-metric-card-dense", `workspace-metric-${accent}`)}>
      <div className={cn("workspace-metric-label mb-0.5 !text-[10px] sm:!text-[10px]", dense && "workspace-metric-label-dense")}>{label}</div>
      <div className={cn("workspace-metric-value !text-[1.25rem] sm:!text-3xl", compact && "workspace-metric-value-compact", dense && "workspace-metric-value-dense")}>{value}</div>
      {hint ? (
        <div className={cn("workspace-metric-hint mt-auto pt-1 !text-[10px] leading-tight sm:pt-1.5 sm:!text-[11px] line-clamp-2", compact && "workspace-metric-hint-compact", dense && "workspace-metric-hint-dense")}>
          {hint}
        </div>
      ) : null}
      {trend ? <div className="workspace-metric-trend mt-1.5 sm:mt-2">{trend}</div> : null}
    </div>
  );
}

export function WorkspaceMetricGrid({
  children,
  className,
  compact = false,
  dense = false,
}: {
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
  dense?: boolean;
}) {
  return <div className={cn("workspace-metric-grid grid-cols-2 gap-1.5 sm:gap-4 md:grid-cols-4", compact && "workspace-metric-grid-compact", dense && "workspace-metric-grid-dense", className)}>{children}</div>;
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
        "workspace-button workspace-nav-button",
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
    <div className="workspace-surface workspace-card workspace-empty-state workspace-empty-block px-5 py-6 sm:px-8 sm:py-8">
      <div className="workspace-empty-icon h-11 w-11 sm:h-14 sm:w-14">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="workspace-empty-title text-sm sm:text-base">{title}</h3>
      <p className="workspace-empty-description max-w-[20rem] text-[11px] sm:text-sm">{description}</p>
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
    <nav className="workspace-surface workspace-nav-surface fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur-md dark:border-app-border dark:bg-app-surface/95 md:hidden">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeId === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "workspace-button relative flex min-h-[48px] min-w-[64px] flex-col items-center justify-center gap-1 rounded-lg px-2 py-1 transition-colors active:scale-95",
              isActive
                ? "text-cyan-600 dark:text-cyan-400"
                : "text-app-text-muted hover:text-slate-900 dark:text-app-text-muted dark:hover:text-app-text",
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[11px] font-medium leading-none">
              {tab.shortLabel || tab.label}
            </span>
            {typeof tab.badge === "number" && tab.badge > 0 && (
              <span className="workspace-badge absolute right-2 top-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-cyan-500 px-1 text-[9px] font-bold text-white shadow-sm">
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
        "workspace-surface workspace-card workspace-mobile-data-card !gap-2 !p-3 sm:!gap-3 sm:!p-4 md:hidden",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
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
            <div className="text-[11px] leading-snug text-app-text-muted dark:text-app-text-muted">
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {metrics && metrics.length > 0 && (
        <div className="workspace-muted grid grid-cols-2 gap-1.5 rounded-lg bg-slate-50 p-2 dark:bg-app-surface/50 sm:gap-3 sm:p-3">
          {metrics.map((metric, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-app-text-muted sm:text-[10px]">
                {metric.label}
              </span>
              <span className="text-sm font-semibold text-slate-900 dark:text-app-text sm:text-sm">
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {actions && (
        <div className="flex flex-wrap items-center gap-1.5">
          {actions}
        </div>
      )}
    </div>
  );
}
