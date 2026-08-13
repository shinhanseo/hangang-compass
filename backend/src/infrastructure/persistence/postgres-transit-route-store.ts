import { Pool } from "pg";

import type { TransitRouteStore, TransitRouteUsage } from "../../application/ports/transit-route-store.js";
import type { TransitRouteResult } from "../../domain/transit/transit-route.js";

type CacheRow = { payload: unknown };
type UsageRow = { requests: number; successes: number; failures: number; quota_exceeded: number };

const schemaSql = `
  CREATE TABLE IF NOT EXISTS transit_route_cache (
    provider TEXT NOT NULL,
    route_key TEXT NOT NULL,
    payload JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (provider, route_key)
  );
  CREATE INDEX IF NOT EXISTS transit_route_cache_expires_at_idx ON transit_route_cache(expires_at);
  CREATE TABLE IF NOT EXISTS transit_route_usage (
    usage_day DATE NOT NULL,
    provider TEXT NOT NULL,
    requests INTEGER NOT NULL DEFAULT 0,
    successes INTEGER NOT NULL DEFAULT 0,
    failures INTEGER NOT NULL DEFAULT 0,
    quota_exceeded INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (usage_day, provider)
  );
`;

export class PostgresTransitRouteStore implements TransitRouteStore {
  readonly #pool: Pool;
  readonly #usagePool: Pool;
  readonly #ready: Promise<void>;
  #cleanupAfter = 0;

  constructor(connectionString: string) {
    this.#pool = new Pool({ connectionString, max: 5 });
    this.#usagePool = new Pool({ connectionString, max: 2 });
    this.#ready = this.#pool.query(schemaSql).then(() => undefined);
  }

  async initialize(): Promise<void> {
    await this.#ready;
    await this.#pool.query("DELETE FROM transit_route_cache WHERE expires_at <= now()");
  }

  async routeResult(
    provider: string,
    routeKey: string,
    options: { successTtlMs: number; failureTtlMs: number; maxRequestsPerDay: number; now: Date },
    calculate: () => Promise<TransitRouteResult>,
  ): Promise<TransitRouteResult> {
    await this.#ready;
    if (options.now.getTime() >= this.#cleanupAfter) {
      this.#cleanupAfter = options.now.getTime() + 60 * 60_000;
      await this.#pool.query("DELETE FROM transit_route_cache WHERE expires_at <= $1", [options.now.toISOString()]);
    }
    const client = await this.#pool.connect();
    const lockKey = `route:${provider}:${routeKey}`;
    let budgetReserved = false;
    let usageRecorded = false;
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [lockKey]);
      const cached = await client.query<CacheRow>(`
        SELECT payload FROM transit_route_cache
        WHERE provider = $1 AND route_key = $2 AND expires_at > $3
      `, [provider, routeKey, options.now.toISOString()]);
      if (cached.rows[0]) {
        await client.query("COMMIT");
        return cached.rows[0].payload as TransitRouteResult;
      }
      const day = seoulDay(options.now);
      const budget = await this.#usagePool.query<UsageRow>(`
        INSERT INTO transit_route_usage (usage_day, provider, requests) VALUES ($1, $2, 1)
        ON CONFLICT(usage_day, provider) DO UPDATE SET requests = transit_route_usage.requests + 1
        WHERE transit_route_usage.requests < $3 AND transit_route_usage.quota_exceeded = 0
        RETURNING requests, successes, failures, quota_exceeded
      `, [day, provider, options.maxRequestsPerDay]);
      if (!budget.rows[0]) {
        const usage = await this.#usagePool.query<UsageRow>(`
          SELECT requests, successes, failures, quota_exceeded FROM transit_route_usage
          WHERE usage_day = $1 AND provider = $2
        `, [day, provider]);
        const unavailable: TransitRouteResult = {
          status: "unavailable",
          reason: (usage.rows[0]?.quota_exceeded ?? 0) > 0 ? "quota_exceeded" : "quota_guard",
        };
        await client.query("COMMIT");
        return unavailable;
      }
      budgetReserved = true;
      const result = await calculate();
      const quota = result.status === "unavailable" && result.reason === "quota_exceeded" ? 1 : 0;
      await this.#usagePool.query(`
        UPDATE transit_route_usage SET successes = successes + $1, failures = failures + $2, quota_exceeded = quota_exceeded + $3
        WHERE usage_day = $4 AND provider = $5
      `, [result.status === "available" ? 1 : 0, result.status === "unavailable" ? 1 : 0, quota, day, provider]);
      usageRecorded = true;
      const ttl = result.status === "available" ? options.successTtlMs : options.failureTtlMs;
      await client.query(`
        INSERT INTO transit_route_cache (provider, route_key, payload, expires_at, created_at)
        VALUES ($1, $2, $3::jsonb, $4, $5)
        ON CONFLICT(provider, route_key) DO UPDATE SET payload = excluded.payload, expires_at = excluded.expires_at, created_at = excluded.created_at
      `, [provider, routeKey, JSON.stringify(result), new Date(options.now.getTime() + ttl).toISOString(), options.now.toISOString()]);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      if (budgetReserved && !usageRecorded) await this.#usagePool.query(`
        UPDATE transit_route_usage SET failures = failures + 1
        WHERE usage_day = $1 AND provider = $2
      `, [seoulDay(options.now), provider]).catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async usage(provider: string, day: string): Promise<TransitRouteUsage> {
    await this.#ready;
    const result = await this.#usagePool.query<UsageRow>(`
      SELECT requests, successes, failures, quota_exceeded FROM transit_route_usage
      WHERE usage_day = $1 AND provider = $2
    `, [day, provider]);
    const row = result.rows[0];
    return {
      day,
      provider,
      requests: row?.requests ?? 0,
      successes: row?.successes ?? 0,
      failures: row?.failures ?? 0,
      quotaExceeded: row?.quota_exceeded ?? 0,
    };
  }

  async close(): Promise<void> {
    await Promise.all([this.#pool.end(), this.#usagePool.end()]);
  }
}

function seoulDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}
