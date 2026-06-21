import React from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "../lib/utils";
import type { ThemeMode } from "../lib/theme";

export function ThemeToggle({
  themeMode,
  onToggle,
  className,
}: {
  themeMode: ThemeMode;
  onToggle: () => void;
  className?: string;
}) {
  const nextTheme = themeMode === "light" ? "dark" : "light";

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn("theme-toggle", className)}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      <span className="theme-toggle-icon-shell" aria-hidden="true">
        {themeMode === "light" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </span>
      <span className="theme-toggle-copy">
        <span className="theme-toggle-label">{themeMode === "light" ? "Light" : "Dark"}</span>
        <span className="theme-toggle-hint">{nextTheme} mode</span>
      </span>
    </button>
  );
}

export default ThemeToggle;
