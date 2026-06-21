import { safeStorage } from "./storage";

export const COOKIE_CONSENT_STORAGE_KEY = "aso-cookie-consent-v1";

export type CookieConsentPreferences = {
  version: 1;
  essential: true;
  performanceCache: boolean;
  preferenceStorage: boolean;
  decidedAt: string;
};

function isCookieConsentPreferences(value: unknown): value is CookieConsentPreferences {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<CookieConsentPreferences>;
  return (
    candidate.version === 1 &&
    candidate.essential === true &&
    typeof candidate.performanceCache === "boolean" &&
    typeof candidate.preferenceStorage === "boolean" &&
    typeof candidate.decidedAt === "string"
  );
}

export function createCookieConsentPreferences(options: {
  performanceCache: boolean;
  preferenceStorage: boolean;
}): CookieConsentPreferences {
  return {
    version: 1,
    essential: true,
    performanceCache: options.performanceCache,
    preferenceStorage: options.preferenceStorage,
    decidedAt: new Date().toISOString(),
  };
}

export function getCookieConsentPreferences(): CookieConsentPreferences | null {
  try {
    const raw = safeStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    return isCookieConsentPreferences(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCookieConsentPreferences(
  preferences: CookieConsentPreferences,
): void {
  safeStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(preferences));
}

export function isPerformanceCacheAllowed(): boolean {
  return getCookieConsentPreferences()?.performanceCache ?? false;
}

export function isPreferenceStorageAllowed(): boolean {
  return getCookieConsentPreferences()?.preferenceStorage ?? false;
}
