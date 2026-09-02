import { redis } from "../config/redis";

/**
 * Versioned caching: each namespace (e.g. "donors", "blood-requests") has a
 * version counter in Redis. Cache keys embed the current version, so bumping
 * the version on any write instantly "invalidates" every previously-cached
 * filter/pagination combination for that namespace without having to track
 * or delete individual keys.
 */
export async function getCacheVersion(namespace: string): Promise<number> {
  if (!redis) return 0;
  const v = await redis.get(`cache:version:${namespace}`);
  return v ? Number(v) : 0;
}

export async function bumpCacheVersion(namespace: string): Promise<void> {
  if (!redis) return;
  await redis.incr(`cache:version:${namespace}`).catch(() => undefined);
}

export async function getCached<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null; // cache errors should never break the request
  }
}

export async function setCached(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // best-effort — ignore cache write failures
  }
}

/** Deterministic cache key from a namespace, version, and a filter/pagination object. */
export function buildCacheKey(namespace: string, version: number, params: Record<string, unknown>): string {
  const normalized = Object.keys(params)
    .sort()
    .reduce<Record<string, unknown>>((acc, k) => {
      if (params[k] !== undefined) acc[k] = params[k];
      return acc;
    }, {});
  return `cache:${namespace}:v${version}:${JSON.stringify(normalized)}`;
}
