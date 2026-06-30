export const DISCOVERY_CACHE_TTL = 1000 * 60 * 30;
export const DISCOVERY_CANDIDATE_CACHE_TTL = 1000 * 60 * 60 * 12;
export const DISCOVERY_CACHE_VERSION = "v22";

export type DiscoveryMode = "fast" | "deep";

type DiscoveryCacheIdentity = {
  store: "android" | "ios";
  country: string;
  appId: string;
  title?: string;
  description?: string;
  category?: string;
  developer?: string;
};

type DiscoveryPayloadLike<TRanking = unknown, TSuggestion = unknown> = {
  rankings: TRanking[];
  suggestions: TSuggestion[];
  checkedKeywords?: number;
  candidateCount?: number;
  searchDepth?: number;
  failedLookups?: number;
  mode: DiscoveryMode;
  loadedAt: string;
};

const DISCOVERY_MODE_LIMITS = {
  fast: {
    keywordLimit: 40,
    finalRankingLimit: 10,
    searchDepth: 100,
  },
  deep: {
    keywordLimit: 80,
    finalRankingLimit: 20,
    searchDepth: 150,
  },
} as const;

function normalizeFingerprintValue(value?: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hashDiscoveryFingerprint(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function getDiscoveryMetadataFingerprint(input: Pick<
  DiscoveryCacheIdentity,
  "title" | "description" | "category" | "developer"
>) {
  const normalizedPayload = [
    normalizeFingerprintValue(input.title),
    normalizeFingerprintValue(input.description),
    normalizeFingerprintValue(input.category),
    normalizeFingerprintValue(input.developer),
  ].join("|");
  return hashDiscoveryFingerprint(normalizedPayload);
}

export function getDiscoveryBaseCacheKey(input: DiscoveryCacheIdentity) {
  return [
    "discover",
    DISCOVERY_CACHE_VERSION,
    input.store,
    input.country.toLowerCase(),
    String(input.appId),
    getDiscoveryMetadataFingerprint(input),
  ].join("-");
}

export function getDiscoveryCandidateCacheKey(input: DiscoveryCacheIdentity) {
  return `${getDiscoveryBaseCacheKey(input)}-candidates`;
}

export function getDiscoveryRankedResultCacheKey(input: DiscoveryCacheIdentity) {
  return `${getDiscoveryBaseCacheKey(input)}-ranked`;
}

export function getDiscoveryCacheKey(
  input: DiscoveryCacheIdentity & { mode: DiscoveryMode },
) {
  return `${getDiscoveryBaseCacheKey(input)}-${input.mode}`;
}

export function getDiscoveryCacheLookupKeys(
  input: DiscoveryCacheIdentity & { mode: DiscoveryMode },
) {
  if (input.mode === "fast") {
    return [
      getDiscoveryCacheKey(input),
      getDiscoveryCacheKey({ ...input, mode: "deep" }),
    ];
  }

  return [getDiscoveryCacheKey(input)];
}

export function trimDiscoveryPayloadForMode<
  TPayload extends DiscoveryPayloadLike,
>(
  payload: TPayload,
  mode: DiscoveryMode,
) {
  if (mode === "deep") {
    return {
      ...payload,
      mode,
    } as TPayload;
  }

  const limits = DISCOVERY_MODE_LIMITS.fast;
  const rankings = payload.rankings.slice(0, limits.finalRankingLimit);
  const rankedKeywordSet = new Set(
    rankings.map((entry) =>
      typeof entry === "object" && entry && "keyword" in entry
        ? String((entry as { keyword: unknown }).keyword).toLowerCase()
        : "",
    ),
  );
  const suggestions = payload.suggestions
    .filter((entry) => {
      if (
        typeof entry === "object" &&
        entry &&
        "keyword" in entry
      ) {
        return !rankedKeywordSet.has(
          String((entry as { keyword: unknown }).keyword).toLowerCase(),
        );
      }

      return true;
    })
    .slice(0, limits.finalRankingLimit);

  return {
    ...payload,
    rankings,
    suggestions,
    checkedKeywords:
      typeof payload.checkedKeywords === "number"
        ? Math.min(payload.checkedKeywords, limits.keywordLimit)
        : payload.checkedKeywords,
    candidateCount:
      typeof payload.candidateCount === "number"
        ? Math.min(payload.candidateCount, limits.keywordLimit)
        : payload.candidateCount,
    searchDepth:
      typeof payload.searchDepth === "number"
        ? Math.min(payload.searchDepth, limits.searchDepth)
        : payload.searchDepth,
    mode,
  } as TPayload;
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
