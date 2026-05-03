import type { N450sJwtPayload } from "./jwks";

// short TTL by design — verifyAccessToken is called once per request edge,
// then again from auth() in route handlers; this avoids re-verifying the same
// signed token several times within a single request lifecycle
const TTL_MS = 30_000;
const MAX_ENTRIES = 1000;

interface Entry {
  payload: N450sJwtPayload;
  expiresAt: number;
}

const cache = new Map<string, Entry>();

export function getCachedPayload(token: string): N450sJwtPayload | undefined {
  const entry = cache.get(token);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(token);
    return undefined;
  }
  return entry.payload;
}

export function setCachedPayload(
  token: string,
  payload: N450sJwtPayload
): void {
  if (cache.size >= MAX_ENTRIES) {
    // simple FIFO eviction — Map preserves insertion order
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(token, { payload, expiresAt: Date.now() + TTL_MS });
}

export function clearPayloadCache(): void {
  cache.clear();
}
