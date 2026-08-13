import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";

import type { Meeting } from "../../src/domain/meeting/meeting.js";
import type { TransitRouteResult } from "../../src/domain/transit/transit-route.js";
import { PostgresMeetingRepository } from "../../src/infrastructure/persistence/postgres-meeting-repository.js";
import { PostgresTransitRouteStore } from "../../src/infrastructure/persistence/postgres-transit-route-store.js";
import { FakeRecommendationDataSource } from "../../src/infrastructure/providers/fake/fake-recommendation-data-source.js";
import { buildRecommendationView } from "../../src/application/services/build-recommendation-view.js";

const databaseUrl = process.env.DATABASE_URL;

test("PostgreSQL repository persists and indexes a meeting", { skip: !databaseUrl }, async () => {
  assert.ok(databaseUrl);
  const id = `automated-check-${randomUUID()}`;
  const inviteTokenHash = createHash("sha256").update(randomUUID()).digest("hex");
  const meeting: Meeting = {
    id,
    createdAt: new Date().toISOString(),
    meetingAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    travelPattern: "individual_round_trip",
    sharedOrigin: null,
    inviteTokenHashes: [inviteTokenHash],
    hostTokenHashes: [createHash("sha256").update(randomUUID()).digest("hex")],
    participants: [],
    confirmedParkId: null,
  };
  const repository = new PostgresMeetingRepository(databaseUrl);
  const cleanup = new Pool({ connectionString: databaseUrl, max: 1 });

  try {
    await repository.initialize();
    await repository.save(meeting);
    assert.equal((await repository.findById(id))?.meetingAt, meeting.meetingAt);
    assert.equal((await repository.findByInviteTokenHash(inviteTokenHash))?.id, id);
    meeting.participants = [
      { id: "p1", alias: "하나", origin: { placeId: "hongdae", placeName: "홍대입구역" }, destination: { placeId: "hongdae", placeName: "홍대입구역" } },
      { id: "p2", alias: "둘", origin: { placeId: "gangnam", placeName: "강남역" }, destination: { placeId: "gangnam", placeName: "강남역" } },
    ];
    await repository.save(meeting);
    const calculated = await buildRecommendationView(meeting, new FakeRecommendationDataSource(), repository);
    assert.ok(calculated);
    const reopened = new PostgresMeetingRepository(databaseUrl);
    await reopened.initialize();
    const restored = await reopened.recommendationView(id, "recommendation-v1:2:provisional", async () => {
      throw new Error("persistent_recommendation_cache_missed");
    });
    assert.deepEqual(restored, calculated);
    await reopened.close();
    assert.equal(await repository.deleteById(id), true);
    assert.equal(await repository.findById(id), undefined);
    assert.equal(await repository.findByInviteTokenHash(inviteTokenHash), undefined);
    assert.equal(Number((await cleanup.query("SELECT count(*) FROM recommendation_views WHERE meeting_id = $1", [id])).rows[0].count), 0);
  } finally {
    await cleanup.query("DELETE FROM meetings WHERE id = $1", [id]);
    await cleanup.end();
    await repository.close();
  }
});

test("PostgreSQL shares route cache and daily usage across store instances", { skip: !databaseUrl }, async () => {
  assert.ok(databaseUrl);
  const provider = `automated-route-${randomUUID()}`;
  const parallelProvider = `${provider}-parallel`;
  const routeKey = createHash("sha256").update(randomUUID()).digest("hex");
  const now = new Date();
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const route: TransitRouteResult = {
    status: "available" as const,
    route: {
      totalMinutes: 25,
      transfers: 1,
      fareWon: 1_500,
      walkingMinutes: 4,
      calculatedAt: now.toISOString(),
      source: "kakao_public_transit",
    },
  };
  const store = new PostgresTransitRouteStore(databaseUrl);
  const cleanup = new Pool({ connectionString: databaseUrl, max: 1 });
  let concurrent: PostgresTransitRouteStore | undefined;
  let reopened: PostgresTransitRouteStore | undefined;
  let calls = 0;

  try {
    await store.initialize();
    concurrent = new PostgresTransitRouteStore(databaseUrl);
    await concurrent.initialize();
    const calculate = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return route;
    };
    const routeOptions = { successTtlMs: 60_000, failureTtlMs: 1_000, maxRequestsPerDay: 1, now };
    assert.deepEqual(await Promise.all([
      store.routeResult(provider, routeKey, routeOptions, calculate),
      concurrent.routeResult(provider, routeKey, routeOptions, calculate),
    ]), [route, route]);
    assert.equal(calls, 1);

    reopened = new PostgresTransitRouteStore(databaseUrl);
    await reopened.initialize();
    assert.deepEqual(await reopened.routeResult(provider, routeKey, {
      successTtlMs: 60_000,
      failureTtlMs: 1_000,
      maxRequestsPerDay: 1,
      now,
    }, async () => { throw new Error("persistent_route_cache_missed"); }), route);
    assert.deepEqual(await reopened.usage(provider, day), {
      day,
      provider,
      requests: 1,
      successes: 1,
      failures: 0,
      quotaExceeded: 0,
    });
    assert.deepEqual(await reopened.routeResult(provider, `${routeKey}-different`, {
      successTtlMs: 60_000,
      failureTtlMs: 1_000,
      maxRequestsPerDay: 1,
      now,
    }, async () => { calls += 1; return route; }), { status: "unavailable", reason: "quota_guard" });
    assert.equal(calls, 1);

    let parallelCalls = 0;
    let releaseParallel: (() => void) | undefined;
    const parallelReady = new Promise<void>((resolve) => { releaseParallel = resolve; });
    const calculateInParallel = async () => {
      parallelCalls += 1;
      if (parallelCalls === 2) releaseParallel?.();
      await Promise.race([
        parallelReady,
        new Promise((_, reject) => setTimeout(() => reject(new Error("route_usage_reservations_serialized")), 1_000)),
      ]);
      return route;
    };
    await Promise.all([
      store.routeResult(parallelProvider, `${routeKey}-a`, { ...routeOptions, maxRequestsPerDay: 2 }, calculateInParallel),
      concurrent.routeResult(parallelProvider, `${routeKey}-b`, { ...routeOptions, maxRequestsPerDay: 2 }, calculateInParallel),
    ]);
    assert.equal(parallelCalls, 2);
  } finally {
    await cleanup.query("DELETE FROM transit_route_cache WHERE provider = ANY($1::text[])", [[provider, parallelProvider]]);
    await cleanup.query("DELETE FROM transit_route_usage WHERE provider = ANY($1::text[])", [[provider, parallelProvider]]);
    await cleanup.end();
    if (reopened) await reopened.close();
    if (concurrent) await concurrent.close();
    await store.close();
  }
});
