import assert from "node:assert/strict";
import test from "node:test";
import type { TransitRouteProvider } from "../../../src/application/ports/transit-route-provider.js";
import { FakeRecommendationDataSource } from "../../../src/infrastructure/providers/fake/fake-recommendation-data-source.js";
import { LiveRouteRecommendationDataSource } from "../../../src/infrastructure/providers/kakao/live-route-recommendation-data-source.js";
import { FakeOriginPlaceProvider } from "../../../src/infrastructure/providers/fake/fake-origin-place-provider.js";

test("evaluates all unique origin-to-park routes and injects real minutes", async () => {
  let calls = 0;
  const routes: TransitRouteProvider = {
    routeFor: async (origin, destination) => {
      calls += 1;
      return {
        status: "available",
        route: {
          totalMinutes: origin.id === "hongdae" ? 20 : destination.id === "yeouido" ? 30 : 40,
          transfers: null, fareWon: null, walkingMinutes: null,
          calculatedAt: origin.id === "hongdae"
            ? "2026-08-12T05:00:00.000Z"
            : "2026-08-12T05:01:00.000Z",
          source: "kakao_public_transit",
        },
      };
    },
  };
  const source = new LiveRouteRecommendationDataSource(new FakeRecommendationDataSource(), routes, new FakeOriginPlaceProvider());
  const participants = [
    { id: "p1", alias: "민지", origin: { placeId: "hongdae", placeName: "홍대입구역" } },
    { id: "p2", alias: "준호", origin: { placeId: "gangnam", placeName: "강남역" } },
    { id: "p3", alias: "민지2", origin: { placeId: "hongdae", placeName: "홍대입구역" } },
  ];
  await source.prepareFor(participants, "2026-08-13T05:00:00.000Z");
  assert.equal(calls, 22);
  const candidate = source.candidates(participants, "2026-08-13T05:00:00.000Z")
    .find((item) => item.parkId === "yeouido");
  assert.deepEqual(candidate?.routes.map((route) => route.minutes), [20, 30, 20]);
  assert.equal(source.travelData(participants).source, "kakao_public_transit");
  assert.equal(source.travelData(participants).calculatedAt, "2026-08-12T05:00:00.000Z");
});

test("keeps a failed participant route null so the candidate is excluded", async () => {
  const routes: TransitRouteProvider = {
    routeFor: async (origin) => origin.id === "gangnam"
      ? { status: "unavailable", reason: "no_route" }
      : { status: "available", route: { totalMinutes: 20, transfers: null, fareWon: null, walkingMinutes: null, calculatedAt: "2026-08-12T05:00:00.000Z", source: "kakao_public_transit" } },
  };
  const source = new LiveRouteRecommendationDataSource(new FakeRecommendationDataSource(), routes, new FakeOriginPlaceProvider());
  const participants = [
    { id: "p1", alias: "민지", origin: { placeId: "hongdae", placeName: "홍대입구역" } },
    { id: "p2", alias: "준호", origin: { placeId: "gangnam", placeName: "강남역" } },
  ];
  await source.prepareFor(participants, "2026-08-13T05:00:00.000Z");
  assert.ok(source.candidates(participants, "2026-08-13T05:00:00.000Z")
    .every((candidate) => candidate.routes[1]?.minutes === null));
});

test("shared-origin preparation deduplicates the common outbound and keeps direction-specific routes", async () => {
  let calls = 0;
  const routes: TransitRouteProvider = {
    routeFor: async (origin, destination) => {
      calls += 1;
      return {
        status: "available",
        route: {
          totalMinutes: origin.id === "hongdae" ? 20 : destination.id === "gangnam" ? 35 : 45,
          transfers: null, fareWon: null, walkingMinutes: null,
          calculatedAt: "2026-08-12T05:00:00.000Z",
          source: "kakao_public_transit",
        },
      };
    },
  };
  const source = new LiveRouteRecommendationDataSource(new FakeRecommendationDataSource(), routes, new FakeOriginPlaceProvider());
  const participants = [
    { id: "p1", alias: "민지", origin: { placeId: "hongdae", placeName: "홍대입구역" }, destination: { placeId: "gangnam", placeName: "강남역" } },
    { id: "p2", alias: "준호", origin: { placeId: "hongdae", placeName: "홍대입구역" }, destination: { placeId: "gangnam", placeName: "강남역" } },
  ];

  await source.prepareFor(participants, "2026-08-13T05:00:00.000Z");
  assert.equal(calls, 22);
  const candidate = source.candidates(participants, "2026-08-13T05:00:00.000Z").find((item) => item.parkId === "yeouido");
  assert.deepEqual(candidate?.routes.map((route) => route.minutes), [20, 20]);
  assert.deepEqual(candidate?.returnRoutes?.map((route) => route.minutes), [35, 35]);
});

test("mixed transport compares transit with driving plus parking walk without a multiplier", async () => {
  const transit: TransitRouteProvider = { routeFor: async () => ({ status: "available", route: { totalMinutes: 31, transfers: 1, fareWon: 1_500, walkingMinutes: 4, calculatedAt: "2026-08-12T05:00:00.000Z", source: "kakao_public_transit" } }) };
  const driving: TransitRouteProvider = { routeFor: async () => ({ status: "available", route: { totalMinutes: 18, transfers: null, fareWon: null, walkingMinutes: null, tollWon: 0, calculatedAt: "2026-08-12T05:01:00.000Z", source: "kakao_driving" } }) };
  const walking: TransitRouteProvider = { routeFor: async () => ({ status: "available", route: { totalMinutes: 6, transfers: null, fareWon: null, walkingMinutes: 6, calculatedAt: "2026-08-12T05:02:00.000Z", source: "kakao_walking" } }) };
  const source = new LiveRouteRecommendationDataSource(new FakeRecommendationDataSource(), transit, new FakeOriginPlaceProvider(), { drivingRoutes: driving, walkingRoutes: walking });
  const participants = [
    { id: "p1", alias: "버스", travelMode: "public_transit" as const, origin: { placeId: "hongdae", placeName: "홍대입구역" } },
    { id: "p2", alias: "차", travelMode: "car" as const, origin: { placeId: "gangnam", placeName: "강남역" } },
  ];
  await source.prepareFor(participants, "2026-08-13T05:00:00.000Z");
  const candidate = source.candidates(participants, "2026-08-13T05:00:00.000Z").find((item) => item.parkId === "yeouido");
  assert.deepEqual(candidate?.routes.map((route) => route.minutes), [31, 24]);
  assert.equal(source.travelData(participants).source, "kakao_mixed");
});
