export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readPersistedEnvelope<T>(
  storage: { getItem: (key: string) => string | null },
  key: string,
  normalize: (parsed: unknown) => T | null,
  fallback: T,
): T {
  // Reads stay guarded like safeGetItem: storage access itself can throw
  // under blocked privacy settings, not just JSON.parse.
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    console.debug(`[persist] Failed to read ${key}, using fallback`);
    return fallback;
  }
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return normalize(parsed) ?? fallback;
  } catch {
    console.debug(`[persist] Failed to parse ${key}, using fallback`);
    return fallback;
  }
}
