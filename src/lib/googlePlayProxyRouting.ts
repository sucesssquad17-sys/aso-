export type PlayStoreFetchInitInput<TDispatcher = unknown> = {
  timeoutMs: number;
  useProxy?: boolean;
  dispatcher?: TDispatcher;
};

export function buildPlayStoreFetchInit<TDispatcher = unknown>({
  timeoutMs,
  useProxy = false,
  dispatcher,
}: PlayStoreFetchInitInput<TDispatcher>) {
  return {
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    ...(useProxy && dispatcher ? { dispatcher } : {}),
  };
}

export type GooglePlayRankMethod = 'web' | 'scraper';
export type GooglePlayRankTransport = 'direct' | 'proxy';

export type GooglePlayRankLogEvent = {
  keyword: string;
  country: string;
  contextLabel: 'discovery' | 'ranking';
  transport: GooglePlayRankTransport;
  method: GooglePlayRankMethod;
  rank: number | 'error';
};

export type GooglePlayRankFallbackInput = {
  keyword: string;
  country: string;
  contextLabel: 'discovery' | 'ranking';
  proxyAvailable: boolean;
  proxyFallbackOnNotRanked?: boolean;
  proxyFirst?: boolean;
  directWebLookup: () => Promise<number>;
  proxyWebLookup?: () => Promise<number>;
  proxyScraperLookup?: () => Promise<number>;
  log?: (event: GooglePlayRankLogEvent) => void;
};

function getPreferredProxyLookup(input: GooglePlayRankFallbackInput) {
  if (input.proxyScraperLookup) {
    return {
      method: 'scraper' as const,
      lookup: input.proxyScraperLookup,
    };
  }

  if (input.proxyWebLookup) {
    return {
      method: 'web' as const,
      lookup: input.proxyWebLookup,
    };
  }

  return null;
}

export async function resolveGooglePlayRankWithFallback(
  input: GooglePlayRankFallbackInput,
) {
  const proxyLookup = input.proxyAvailable ? getPreferredProxyLookup(input) : null;

  if (input.proxyFirst && proxyLookup) {
    try {
      const rank = await proxyLookup.lookup();
      input.log?.({
        keyword: input.keyword,
        country: input.country,
        contextLabel: input.contextLabel,
        transport: 'proxy',
        method: proxyLookup.method,
        rank,
      });
      if (rank !== -1) {
        return rank;
      }
    } catch {
      input.log?.({
        keyword: input.keyword,
        country: input.country,
        contextLabel: input.contextLabel,
        transport: 'proxy',
        method: proxyLookup.method,
        rank: 'error',
      });
    }

    const rank = await input.directWebLookup();
    input.log?.({
      keyword: input.keyword,
      country: input.country,
      contextLabel: input.contextLabel,
      transport: 'direct',
      method: 'web',
      rank,
    });
    return rank;
  }

  try {
    const directRank = await input.directWebLookup();
    input.log?.({
      keyword: input.keyword,
      country: input.country,
      contextLabel: input.contextLabel,
      transport: 'direct',
      method: 'web',
      rank: directRank,
    });

    if (
      directRank !== -1 ||
      input.proxyFallbackOnNotRanked !== true ||
      !proxyLookup
    ) {
      return directRank;
    }

    const proxyRank = await proxyLookup.lookup();
    input.log?.({
      keyword: input.keyword,
      country: input.country,
      contextLabel: input.contextLabel,
      transport: 'proxy',
      method: proxyLookup.method,
      rank: proxyRank,
    });
    return proxyRank;
  } catch (error) {
    input.log?.({
      keyword: input.keyword,
      country: input.country,
      contextLabel: input.contextLabel,
      transport: 'direct',
      method: 'web',
      rank: 'error',
    });

    if (!proxyLookup) {
      throw error;
    }

    const proxyRank = await proxyLookup.lookup();
    input.log?.({
      keyword: input.keyword,
      country: input.country,
      contextLabel: input.contextLabel,
      transport: 'proxy',
      method: proxyLookup.method,
      rank: proxyRank,
    });
    return proxyRank;
  }
}
