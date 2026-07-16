import React from "react";
import { ChevronDown, MoreHorizontal, Search, X } from "lucide-react";
import { cn } from "../../lib/utils";

export function WorkspaceSearchToolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("workspace-filter-toolbar", className)}>
      {children}
    </div>
  );
}

export function WorkspaceSearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
  disabled = false,
  onClear,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  onClear?: () => void;
}) {
  return (
    <div className={cn("workspace-search-control", className)}>
      <Search className="workspace-control-leading-icon" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        className="workspace-control workspace-search-control-input"
      />
      {value ? (
        <button
          type="button"
          onClick={onClear ?? (() => onChange(""))}
          className="workspace-control-clear"
          aria-label={`Clear ${ariaLabel.toLowerCase()}`}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export function WorkspaceFilterSelect({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn("workspace-control workspace-filter-select", className)}
    >
      {children}
    </select>
  );
}

export function WorkspaceToolbarActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("workspace-toolbar-actions", className)}>
      {children}
    </div>
  );
}

export type WorkspaceMoreAction = {
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

export function WorkspaceMoreActionsMenu({
  actions,
  label = "More",
  className,
}: {
  actions: WorkspaceMoreAction[];
  label?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const menuId = React.useId();

  React.useEffect(() => {
    if (!isOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={cn("workspace-more-menu", className)}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls={menuId}
        className="workspace-control workspace-more-trigger"
      >
        <MoreHorizontal className="h-4 w-4" />
        <span>{label}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")}
        />
      </button>
      {isOpen ? (
        <div id={menuId} role="menu" className="workspace-more-popover">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              disabled={action.disabled}
              onClick={() => {
                action.onSelect();
                setIsOpen(false);
              }}
              className={cn(
                "workspace-more-item",
                action.destructive && "workspace-more-item-danger",
              )}
            >
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceMobileFilterDrawer({
  open,
  onToggle,
  activeCount = 0,
  children,
  className,
}: {
  open: boolean;
  onToggle: () => void;
  activeCount?: number;
  children: React.ReactNode;
  className?: string;
}) {
  const panelId = React.useId();
  return (
    <div className={cn("workspace-mobile-filter-drawer", className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="workspace-control workspace-mobile-filter-toggle"
      >
        <span>Filters{activeCount > 0 ? ` ${activeCount}` : ""}</span>
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
        />
      </button>
      <div
        id={panelId}
        className={cn("workspace-mobile-filter-content", !open && "hidden")}
      >
        {children}
      </div>
    </div>
  );
}

export function WorkspaceActiveFilterSummary({
  count,
  onReset,
}: {
  count: number;
  onReset: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="workspace-active-filter-summary" role="status">
      <span>{count} filter{count === 1 ? "" : "s"} active</span>
      <button type="button" onClick={onReset}>
        Reset
      </button>
    </div>
  );
}
