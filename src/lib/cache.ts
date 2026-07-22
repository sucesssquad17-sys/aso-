/**
 * A simple cache service using localStorage with TTL (Time To Live) support.
 */

import { isPerformanceCacheAllowed } from "./cookieConsent";
import { safeStorage } from "./storage";

interface CacheItem<T> {
  value: T;
  expiry: number;
}

const CACHE_KEY_PREFIXES = ["discover-", "app-", "search-", "ranking-"];

function isCacheKey(key: string): boolean {
  return CACHE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

export const CacheService = {
  /**
   * Set a value in the cache.
   * @param key The key to store the value under.
   * @param value The value to store.
   * @param ttl Time to live in milliseconds.
   */
  set: <T>(key: string, value: T, ttl: number): void => {
    if (!isPerformanceCacheAllowed() || !isCacheKey(key)) {
      return;
    }

    const now = new Date();
    const item: CacheItem<T> = {
      value,
      expiry: now.getTime() + ttl,
    };
    try {
      safeStorage.setItem(key, JSON.stringify(item));
    } catch (e) {
      console.warn('Cache storage failed:', e);
      // If storage fails (e.g. quota exceeded), clear old cache items
      CacheService.clearExpired();
    }
  },

  /**
   * Get a value from the cache.
   * @param key The key to retrieve the value for.
   * @returns The value if it exists and has not expired, otherwise null.
   */
  get: <T>(key: string): T | null => {
    if (!isPerformanceCacheAllowed() || !isCacheKey(key)) {
      return null;
    }

    try {
      const itemStr = safeStorage.getItem(key);
      if (!itemStr) return null;

      const item: CacheItem<T> = JSON.parse(itemStr);
      const now = new Date();

      if (now.getTime() > item.expiry) {
        safeStorage.removeItem(key);
        return null;
      }

      return item.value;
    } catch (e) {
      return null;
    }
  },

  /**
   * Remove a value from the cache.
   * @param key The key to remove.
   */
  remove: (key: string): void => {
    if (!isCacheKey(key)) {
      return;
    }

    try {
      safeStorage.removeItem(key);
    } catch (e) {
      console.warn('Failed to remove cache item', e);
    }
  },

  /**
   * Clear all expired items from the cache.
   */
  clearExpired: (): void => {
    try {
      const now = new Date().getTime();
      for (let i = safeStorage.length - 1; i >= 0; i--) {
        const key = safeStorage.key(i);
        if (key && isCacheKey(key)) {
          try {
            const itemStr = safeStorage.getItem(key);
            if (itemStr) {
              const item = JSON.parse(itemStr);
              if (item.expiry && now > item.expiry) {
                safeStorage.removeItem(key);
              }
            }
          } catch (e) {
            // Not a cache item or invalid JSON
          }
        }
      }
    } catch (e) {
      console.warn('Failed to clear expired cache', e);
    }
  },

  /**
   * Clear all items from the cache.
   */
  clearAll: (): void => {
    try {
      safeStorage
        .keys()
        .filter((key) => isCacheKey(key))
        .forEach((key) => safeStorage.removeItem(key));
    } catch (e) {
      console.warn('Failed to clear cache', e);
    }
  }
};

// TTL Constants
export const TTL = {
  SEARCH: 1000 * 60 * 60, // 1 hour
  APP_DETAILS: 1000 * 60 * 60 * 24, // 24 hours
  ANALYSIS: 1000 * 60 * 60 * 24 * 7, // 1 week
  RANKING: 1000 * 60 * 15, // 15 minutes; explicit checks should feel current
};
