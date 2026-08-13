import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { TransitRouteProvider } from "../../../src/application/ports/transit-route-provider.js";
import type { TransitRouteResult } from "../../../src/domain/transit/transit-route.js";
import { SqliteTransitRouteStore } from "../../../src/infrastructure/persistence/sqlite-transit-route-store.js";
import { CachedTransitRouteProvider } from "../../../src/infrastructure/providers/cached-transit-route-provider.js";

const origin = { id: "place-1", name: "신촌역", query: "신촌역" };
const destination = { id: "park-1", name: "난지한강공원", query: "난지한강공원" };
const route: TransitRouteResult = {
  status: "available",
  route: {
    totalMinutes: 31,
    transfers: 1,
    fareWon: 1_500,
    walkingMinutes: 8,
    calculatedAt: "2026-08-13T01:00:00.000Z",
    source: "kakao_public_transit",
  },
};
const now = Date.parse("2026-08-13T01:00:00.000Z");

function cached(source: TransitRouteProvider, store: SqliteTransitRouteStore, maxRequestsPerDay = 900) {
  return new CachedTransitRouteProvider(source, {
    ttlMs: 2 * 60 * 60_000,
    unavailableTtlMs: 30_000,
    maxRequestsPerDay,
    now: () => now,
    store,
    providerKey: "kakao_public_transit",
  });
}

test("reuses a successful route after the process and store are reopened", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "hangang-route-cache-"));
  const path = join(directory, "routes.sqlite");
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  let calls = 0;
  const source: TransitRouteProvider = { routeFor: async () => { calls += 1; return route; } };

  const firstStore = new SqliteTransitRouteStore(path);
  assert.deepEqual(await cached(source, firstStore).routeFor(origin, destination), route);
  firstStore.close();

  const reopenedStore = new SqliteTransitRouteStore(path);
  context.after(() => reopenedStore.close());
  assert.deepEqual(await cached(source, reopenedStore).routeFor(origin, destination), route);
  assert.equal(calls, 1);
  assert.deepEqual(await reopenedStore.usage("kakao_public_transit", "2026-08-13"), {
    day: "2026-08-13",
    provider: "kakao_public_transit",
    requests: 1,
    successes: 1,
    failures: 0,
    quotaExceeded: 0,
  });
});

test("coalesces concurrent requests from separate provider wrappers", async (context) => {
  const store = new SqliteTransitRouteStore(":memory:");
  context.after(() => store.close());
  let calls = 0;
  const source: TransitRouteProvider = {
    routeFor: async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return route;
    },
  };

  await Promise.all([
    cached(source, store).routeFor(origin, destination),
    cached(source, store).routeFor(origin, destination),
  ]);
  assert.equal(calls, 1);
});

test("enforces one shared daily safety budget across provider wrappers", async (context) => {
  const store = new SqliteTransitRouteStore(":memory:");
  context.after(() => store.close());
  let calls = 0;
  const source: TransitRouteProvider = { routeFor: async () => { calls += 1; return route; } };

  assert.equal((await cached(source, store, 1).routeFor(origin, destination)).status, "available");
  assert.deepEqual(
    await cached(source, store, 1).routeFor({ ...origin, id: "place-2" }, destination),
    { status: "unavailable", reason: "quota_guard" },
  );
  assert.equal(calls, 1);
});

test("opens a provider-wide circuit after the upstream daily quota is exhausted", async (context) => {
  const store = new SqliteTransitRouteStore(":memory:");
  context.after(() => store.close());
  let calls = 0;
  const source: TransitRouteProvider = {
    routeFor: async () => {
      calls += 1;
      return { status: "unavailable", reason: "quota_exceeded" };
    },
  };

  assert.deepEqual(await cached(source, store).routeFor(origin, destination), {
    status: "unavailable", reason: "quota_exceeded",
  });
  assert.deepEqual(await cached(source, store).routeFor({ ...origin, id: "place-2" }, destination), {
    status: "unavailable", reason: "quota_exceeded",
  });
  assert.equal(calls, 1);
  assert.equal((await store.usage("kakao_public_transit", "2026-08-13")).quotaExceeded, 1);
});

test("does not reuse an expired durable result", async (context) => {
  const store = new SqliteTransitRouteStore(":memory:");
  context.after(() => store.close());
  let calls = 0;
  const calculate = async () => { calls += 1; return route; };
  const options = { successTtlMs: 1_000, failureTtlMs: 100, maxRequestsPerDay: 10, now: new Date(now) };

  await store.routeResult("kakao_public_transit", "route-hash", options, calculate);
  await store.routeResult("kakao_public_transit", "route-hash", {
    ...options,
    now: new Date(now + 1_000),
  }, calculate);
  assert.equal(calls, 2);
});
