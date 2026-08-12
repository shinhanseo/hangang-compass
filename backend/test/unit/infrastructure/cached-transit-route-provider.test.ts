import assert from "node:assert/strict";
import test from "node:test";
import type { TransitRouteProvider } from "../../../src/application/ports/transit-route-provider.js";
import type { TransitRouteResult } from "../../../src/domain/transit/transit-route.js";
import { CachedTransitRouteProvider } from "../../../src/infrastructure/providers/cached-transit-route-provider.js";

const origin = { id: "hongdae", name: "홍대입구역", query: "홍대입구역" };
const destination = { id: "yeouido", name: "여의도안내센터", query: "여의도안내센터" };
const result: TransitRouteResult = {
  status: "available",
  route: { totalMinutes: 20, transfers: 1, fareWon: 1400, walkingMinutes: 3, calculatedAt: "2026-08-12T05:00:00.000Z", source: "kakao_public_transit" },
};

test("caches and coalesces routes for two hours", async () => {
  let now = 0;
  let calls = 0;
  const source: TransitRouteProvider = { routeFor: async () => { calls += 1; return result; } };
  const cache = new CachedTransitRouteProvider(source, { ttlMs: 2 * 60 * 60_000, maxRequestsPerDay: 900, now: () => now });
  await Promise.all([cache.routeFor(origin, destination), cache.routeFor(origin, destination)]);
  now = 2 * 60 * 60_000 - 1;
  await cache.routeFor(origin, destination);
  assert.equal(calls, 1);
  now += 1;
  await cache.routeFor(origin, destination);
  assert.equal(calls, 2);
});

test("stops before the configured daily safety budget", async () => {
  const source: TransitRouteProvider = { routeFor: async () => result };
  const cache = new CachedTransitRouteProvider(source, { ttlMs: 1, maxRequestsPerDay: 1, now: () => 0 });
  await cache.routeFor(origin, destination);
  assert.deepEqual(await cache.routeFor(origin, { ...destination, id: "banpo" }), {
    status: "unavailable", reason: "quota_guard",
  });
});

test("retries an unavailable route after the short failure cache expires", async () => {
  let now = 0;
  let calls = 0;
  const source: TransitRouteProvider = {
    routeFor: async () => {
      calls += 1;
      return calls === 1 ? { status: "unavailable", reason: "network_error" } : result;
    },
  };
  const cache = new CachedTransitRouteProvider(source, {
    ttlMs: 2 * 60 * 60_000,
    unavailableTtlMs: 30_000,
    maxRequestsPerDay: 900,
    now: () => now,
  });

  assert.equal((await cache.routeFor(origin, destination)).status, "unavailable");
  now = 29_999;
  assert.equal((await cache.routeFor(origin, destination)).status, "unavailable");
  assert.equal(calls, 1);
  now = 30_000;
  assert.equal((await cache.routeFor(origin, destination)).status, "available");
  assert.equal(calls, 2);
});
