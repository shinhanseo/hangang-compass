import type { TransitRouteProvider } from "../../application/ports/transit-route-provider.js";
import type { TransitEndpoint, TransitRouteResult } from "../../domain/transit/transit-route.js";

interface Entry { result: TransitRouteResult; expiresAt: number }

export class CachedTransitRouteProvider implements TransitRouteProvider {
  readonly #source: TransitRouteProvider;
  readonly #ttlMs: number;
  readonly #unavailableTtlMs: number;
  readonly #maxRequestsPerDay: number;
  readonly #now: () => number;
  readonly #cache = new Map<string, Entry>();
  readonly #inFlight = new Map<string, Promise<TransitRouteResult>>();
  #budgetDay = "";
  #requestCount = 0;

  constructor(
    source: TransitRouteProvider,
    options: { ttlMs: number; unavailableTtlMs?: number; maxRequestsPerDay: number; now?: () => number },
  ) {
    if (options.ttlMs <= 0 || (options.unavailableTtlMs ?? 30_000) <= 0 || options.maxRequestsPerDay <= 0) {
      throw new Error("transit_cache_options_required");
    }
    this.#source = source;
    this.#ttlMs = options.ttlMs;
    this.#unavailableTtlMs = options.unavailableTtlMs ?? 30_000;
    this.#maxRequestsPerDay = options.maxRequestsPerDay;
    this.#now = options.now ?? Date.now;
  }

  #day(): string {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date(this.#now()));
  }

  async routeFor(origin: TransitEndpoint, destination: TransitEndpoint): Promise<TransitRouteResult> {
    const key = `${origin.id}:${destination.id}`;
    const cached = this.#cache.get(key);
    if (cached && cached.expiresAt > this.#now()) return cached.result;
    const existing = this.#inFlight.get(key);
    if (existing) return existing;

    const day = this.#day();
    if (day !== this.#budgetDay) {
      this.#budgetDay = day;
      this.#requestCount = 0;
    }
    if (this.#requestCount >= this.#maxRequestsPerDay) {
      return { status: "unavailable", reason: "quota_guard" };
    }
    this.#requestCount += 1;
    const request = this.#source.routeFor(origin, destination)
      .then((result) => {
        this.#cache.set(key, {
          result,
          expiresAt: this.#now() + (result.status === "available" ? this.#ttlMs : this.#unavailableTtlMs),
        });
        return result;
      })
      .finally(() => this.#inFlight.delete(key));
    this.#inFlight.set(key, request);
    return request;
  }
}
