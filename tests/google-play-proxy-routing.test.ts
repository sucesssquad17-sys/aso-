import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPlayStoreFetchInit,
  resolveGooglePlayRankWithFallback,
} from '../src/lib/googlePlayProxyRouting';

test('fetchPlayStoreHtml request init does not use proxy dispatcher by default', () => {
  const dispatcher = { tag: 'proxy-dispatcher' };
  const init = buildPlayStoreFetchInit({
    timeoutMs: 15_000,
    dispatcher,
  });

  assert.equal('dispatcher' in init, false);
});

test('fetchPlayStoreHtml request init uses proxy dispatcher only when requested', () => {
  const dispatcher = { tag: 'proxy-dispatcher' };
  const init = buildPlayStoreFetchInit({
    timeoutMs: 15_000,
    useProxy: true,
    dispatcher,
  });

  assert.equal((init as { dispatcher?: unknown }).dispatcher, dispatcher);
});

test('getGooglePlayRankWithFallback avoids duplicate proxy checks after a direct miss', async () => {
  let directCalls = 0;
  let proxyScraperCalls = 0;
  let proxyWebCalls = 0;

  const rank = await resolveGooglePlayRankWithFallback({
    keyword: 'budget app',
    country: 'us',
    contextLabel: 'discovery',
    proxyAvailable: true,
    proxyFallbackOnNotRanked: true,
    directWebLookup: async () => {
      directCalls += 1;
      return -1;
    },
    proxyWebLookup: async () => {
      proxyWebCalls += 1;
      return 12;
    },
    proxyScraperLookup: async () => {
      proxyScraperCalls += 1;
      return 9;
    },
  });

  assert.equal(rank, 9);
  assert.equal(directCalls, 1);
  assert.equal(proxyScraperCalls, 1);
  assert.equal(proxyWebCalls, 0);
});

test('android discovery path still returns a verified ranking after direct failure', async () => {
  const rank = await resolveGooglePlayRankWithFallback({
    keyword: 'expense tracker',
    country: 'us',
    contextLabel: 'discovery',
    proxyAvailable: true,
    proxyFallbackOnNotRanked: true,
    directWebLookup: async () => {
      throw new Error('play-html-failed');
    },
    proxyScraperLookup: async () => 4,
  });

  assert.equal(rank, 4);
});

test('proxy-first flow uses a single proxy method, then falls back to direct web once', async () => {
  let directCalls = 0;
  let proxyScraperCalls = 0;
  let proxyWebCalls = 0;

  const rank = await resolveGooglePlayRankWithFallback({
    keyword: 'calendar planner',
    country: 'us',
    contextLabel: 'ranking',
    proxyAvailable: true,
    proxyFirst: true,
    directWebLookup: async () => {
      directCalls += 1;
      return 6;
    },
    proxyWebLookup: async () => {
      proxyWebCalls += 1;
      return 8;
    },
    proxyScraperLookup: async () => {
      proxyScraperCalls += 1;
      return -1;
    },
  });

  assert.equal(rank, 6);
  assert.equal(proxyScraperCalls, 1);
  assert.equal(proxyWebCalls, 0);
  assert.equal(directCalls, 1);
});
