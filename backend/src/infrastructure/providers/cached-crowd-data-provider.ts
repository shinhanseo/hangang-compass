import type { CrowdDataProvider } from "../../application/ports/crowd-data-provider.js";
import type { CrowdSnapshotResult } from "../../domain/crowd/crowd-snapshot.js";

interface CacheEntry {
  expiresAt: number;
  result: CrowdSnapshotResult;
}

export class CachedCrowdDataProvider implements CrowdDataProvider {
  readonly #source: CrowdDataProvider;
  readonly #ttlMs: number;
  readonly #now: () => number;
  readonly #cache = new Map<string, CacheEntry>();
  readonly #inFlight = new Map<string, Promise<CrowdSnapshotResult>>();

  constructor(source: CrowdDataProvider, ttlMs: number, now: () => number = Date.now) {
    if (ttlMs <= 0) throw new Error("cache_ttl_required");
    this.#source = source;
    this.#ttlMs = ttlMs;
    this.#now = now;
  }

  async crowdFor(parkId: string, areaName: string): Promise<CrowdSnapshotResult> {
    const cacheKey = `${parkId}:${areaName}`;
    const cached = this.#cache.get(cacheKey);
    if (cached && cached.expiresAt > this.#now()) return cached.result;

    const existing = this.#inFlight.get(cacheKey);
    if (existing) return existing;

    const request = this.#source.crowdFor(parkId, areaName)
      .then((result) => {
        this.#cache.set(cacheKey, { result, expiresAt: this.#now() + this.#ttlMs });
        return result;
      })
      .finally(() => this.#inFlight.delete(cacheKey));
    this.#inFlight.set(cacheKey, request);
    return request;
  }
}
