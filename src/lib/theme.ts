import { safeStorage } from "./storage";

export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "aso-theme-mode";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark";
}

export function getStoredTheme(): ThemeMode | null {
  const value = safeStorage.getItem(THEME_STORAGE_KEY);
  return isThemeMode(value) ? value : null;
}

export function getInitialTheme(): ThemeMode {
  return getStoredTheme() ?? "light";
}

export function applyTheme(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}
