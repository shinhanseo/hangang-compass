import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { TransitRouteStore, TransitRouteUsage } from "../../application/ports/transit-route-store.js";
import type { TransitRouteResult } from "../../domain/transit/transit-route.js";

type CacheRow = { payload: string; expires_at: string };
type UsageRow = { requests: number; successes: number; failures: number; quota_exceeded: number };

export class SqliteTransitRouteStore implements TransitRouteStore {
  readonly #database: DatabaseSync;
  readonly #inFlight = new Map<string, Promise<TransitRouteResult>>();
  #cleanupAfter = 0;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.#database = new DatabaseSync(path);
    this.#database.exec("PRAGMA journal_mode = WAL");
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS transit_route_cache (
        provider TEXT NOT NULL,
        route_key TEXT NOT NULL,
        payload TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (provider, route_key)
      );
      CREATE INDEX IF NOT EXISTS transit_route_cache_expires_at_idx ON transit_route_cache(expires_at);
      CREATE TABLE IF NOT EXISTS transit_route_usage (
        usage_day TEXT NOT NULL,
        provider TEXT NOT NULL,
        requests INTEGER NOT NULL DEFAULT 0,
        successes INTEGER NOT NULL DEFAULT 0,
        failures INTEGER NOT NULL DEFAULT 0,
        quota_exceeded INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (usage_day, provider)
      );
    `);
  }

  async routeResult(
    provider: string,
    routeKey: string,
    options: { successTtlMs: number; failureTtlMs: number; maxRequestsPerDay: number; now: Date },
    calculate: () => Promise<TransitRouteResult>,
  ): Promise<TransitRouteResult> {
    if (options.now.getTime() >= this.#cleanupAfter) {
      this.#database.prepare("DELETE FROM transit_route_cache WHERE expires_at <= ?").run(options.now.toISOString());
      this.#cleanupAfter = options.now.getTime() + 60 * 60_000;
    }
    const key = `${provider}:${routeKey}`;
    const cached = this.#database.prepare(`
      SELECT payload, expires_at FROM transit_route_cache
      WHERE provider = ? AND route_key = ? AND expires_at > ?
    `).get(provider, routeKey, options.now.toISOString()) as CacheRow | undefined;
    if (cached) return JSON.parse(cached.payload) as TransitRouteResult;
    const pending = this.#inFlight.get(key);
    if (pending) return pending;
    const request = this.#calculate(provider, routeKey, options, calculate)
      .finally(() => this.#inFlight.delete(key));
    this.#inFlight.set(key, request);
    return request;
  }

  async #calculate(
    provider: string,
    routeKey: string,
    options: { successTtlMs: number; failureTtlMs: number; maxRequestsPerDay: number; now: Date },
    calculate: () => Promise<TransitRouteResult>,
  ): Promise<TransitRouteResult> {
    const day = seoulDay(options.now);
    const usage = this.usageRow(provider, day);
    if (usage.quotaExceeded > 0) return { status: "unavailable", reason: "quota_exceeded" };
    if (usage.requests >= options.maxRequestsPerDay) return { status: "unavailable", reason: "quota_guard" };
    this.#database.prepare(`
      INSERT INTO transit_route_usage (usage_day, provider, requests) VALUES (?, ?, 1)
      ON CONFLICT(usage_day, provider) DO UPDATE SET requests = requests + 1
    `).run(day, provider);
    const result = await calculate();
    const quota = result.status === "unavailable" && result.reason === "quota_exceeded" ? 1 : 0;
    this.#database.prepare(`
      UPDATE transit_route_usage SET successes = successes + ?, failures = failures + ?, quota_exceeded = quota_exceeded + ?
      WHERE usage_day = ? AND provider = ?
    `).run(result.status === "available" ? 1 : 0, result.status === "unavailable" ? 1 : 0, quota, day, provider);
    const ttl = result.status === "available" ? options.successTtlMs : options.failureTtlMs;
    const expiresAt = new Date(options.now.getTime() + ttl).toISOString();
    this.#database.prepare(`
      INSERT INTO transit_route_cache (provider, route_key, payload, expires_at, created_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(provider, route_key) DO UPDATE SET payload = excluded.payload, expires_at = excluded.expires_at, created_at = excluded.created_at
    `).run(provider, routeKey, JSON.stringify(result), expiresAt, options.now.toISOString());
    return result;
  }

  usageRow(provider: string, day: string): TransitRouteUsage {
    const row = this.#database.prepare(`
      SELECT requests, successes, failures, quota_exceeded FROM transit_route_usage
      WHERE usage_day = ? AND provider = ?
    `).get(day, provider) as UsageRow | undefined;
    return {
      day,
      provider,
      requests: row?.requests ?? 0,
      successes: row?.successes ?? 0,
      failures: row?.failures ?? 0,
      quotaExceeded: row?.quota_exceeded ?? 0,
    };
  }

  async usage(provider: string, day: string): Promise<TransitRouteUsage> {
    return this.usageRow(provider, day);
  }

  close(): void {
    this.#database.close();
  }
}

function seoulDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}
