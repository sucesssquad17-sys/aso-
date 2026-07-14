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
  const storedTheme = getStoredTheme();
  if (storedTheme) {
    return storedTheme;
  }
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function applyTheme(theme: ThemeMode): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta instanceof HTMLMetaElement) {
    themeColorMeta.content = theme === "dark" ? "#0b1120" : "#f8fafc";
  }
}
