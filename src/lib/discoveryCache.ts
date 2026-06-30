export const DISCOVERY_CACHE_TTL = 1000 * 60 * 60 * 12;
export const DISCOVERY_CACHE_VERSION = "v18";

export function getDiscoveryCacheKey(input: {
  mode: "fast" | "deep";
  store: "android" | "ios";
  country: string;
  appId: string;
}) {
  return `discover-${DISCOVERY_CACHE_VERSION}-${input.mode}-${input.store}-${input.country}-${input.appId}`;
}

export function hasDiscoveryCacheContent(
  payload:
    | {
        rankings?: unknown[];
        suggestions?: unknown[];
      }
    | null
    | undefined,
) {
  return Boolean(
    payload &&
      ((Array.isArray(payload.rankings) && payload.rankings.length > 0) ||
        (Array.isArray(payload.suggestions) && payload.suggestions.length > 0)),
  );
}
