const memoryStorage = new Map<string, string>();

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storage = window.localStorage;
    const probeKey = '__aso_storage_probe__';
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
}

function getLocalKeys(storage: Storage | null): string[] {
  if (!storage) {
    return [];
  }

  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key) {
      keys.push(key);
    }
  }
  return keys;
}

export const safeStorage = {
  getItem(key: string): string | null {
    const storage = getLocalStorage();
    if (storage) {
      try {
        const value = storage.getItem(key);
        if (value !== null) {
          return value;
        }
      } catch {
        // Fall back to the in-memory copy below.
      }
    }

    return memoryStorage.get(key) ?? null;
  },

  setItem(key: string, value: string): void {
    const storage = getLocalStorage();
    if (storage) {
      try {
        storage.setItem(key, value);
        memoryStorage.delete(key);
        return;
      } catch {
        // Keep a session-scoped backup if persistent storage is unavailable.
      }
    }

    memoryStorage.set(key, value);
  },

  removeItem(key: string): void {
    const storage = getLocalStorage();
    if (storage) {
      try {
        storage.removeItem(key);
      } catch {
        // Best effort; fall through to the in-memory copy.
      }
    }

    memoryStorage.delete(key);
  },

  clear(): void {
    const storage = getLocalStorage();
    if (storage) {
      try {
        storage.clear();
      } catch {
        // Best effort; fall through to the in-memory copy.
      }
    }

    memoryStorage.clear();
  },

  key(index: number): string | null {
    return this.keys()[index] ?? null;
  },

  keys(): string[] {
    return [...new Set([...getLocalKeys(getLocalStorage()), ...memoryStorage.keys()])];
  },

  get length(): number {
    return this.keys().length;
  },
};
