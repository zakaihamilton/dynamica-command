export type StorageAdapter = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  keys: () => string[];
};

/** Storage can fail in browsers with disabled privacy storage or an exhausted quota. */
export function safeGetItem(storage: StorageAdapter, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetItem(storage: StorageAdapter, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemoveItem(storage: StorageAdapter, key: string): boolean {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function safeKeys(storage: StorageAdapter): string[] {
  try {
    return storage.keys();
  } catch {
    return [];
  }
}

export function memoryStorage(initial: Record<string, string> = {}): StorageAdapter {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    keys: () => [...map.keys()],
  };
}

export function localStorageAdapter(): StorageAdapter {
  return {
    getItem: (k) => window.localStorage.getItem(k),
    setItem: (k, v) => window.localStorage.setItem(k, v),
    removeItem: (k) => window.localStorage.removeItem(k),
    keys: () => Object.keys(window.localStorage),
  };
}

let _cachedStorage: StorageAdapter | null = null;

export function cachedLocalStorage(): StorageAdapter {
  if (typeof window === "undefined") return memoryStorage();
  if (!_cachedStorage) _cachedStorage = localStorageAdapter();
  return _cachedStorage;
}
