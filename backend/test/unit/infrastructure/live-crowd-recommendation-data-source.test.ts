import assert from "node:assert/strict";
import test from "node:test";
import type { CrowdDataProvider } from "../../../src/application/ports/crowd-data-provider.js";
import type { CrowdLevel, CrowdSnapshotResult } from "../../../src/domain/crowd/crowd-snapshot.js";
import { FakeRecommendationDataSource } from "../../../src/infrastructure/providers/fake/fake-recommendation-data-source.js";
import { LiveCrowdRecommendationDataSource } from "../../../src/infrastructure/providers/seoul/live-crowd-recommendation-data-source.js";

const now = new Date("2026-08-12T05:00:00.000Z").getTime();
const meetingAt = "2026-08-12T07:00:00.000Z";

function result(parkId: string, areaName: string, level: CrowdLevel): CrowdSnapshotResult {
  return {
    status: "available",
    snapshot: {
      parkId,
      areaName,
      areaCode: `code-${parkId}`,
      current: {
        level: "normal",
        observedAt: "2026-08-12T04:50:00.000Z",
        freshness: "fresh",
        isReplacement: false,
      },
      forecastStatus: "available",
      forecasts: [{ forecastFor: meetingAt, level, populationMin: null, populationMax: null }],
      fetchedAt: "2026-08-12T05:00:00.000Z",
      source: "seoul_realtime_citydata",
    },
  };
}

test("prepares all parks and injects arrival forecast into candidate conditions", async () => {
  let calls = 0;
  const provider: CrowdDataProvider = {
    crowdFor: async (parkId, areaName) => {
      calls += 1;
      return result(parkId, areaName, parkId === "banpo" ? "very_busy" : "relaxed");
    },
  };
  const source = new LiveCrowdRecommendationDataSource(new FakeRecommendationDataSource(), provider, () => now);
  await source.prepareFor([], meetingAt);
  assert.equal(calls, 11);
  assert.equal(source.stageFor(meetingAt), "current");
  const candidates = source.candidates([
    { id: "p1", alias: "민지", stationId: "hongdae" },
    { id: "p2", alias: "준호", stationId: "gangnam" },
  ], meetingAt);
  assert.deepEqual(candidates.find((candidate) => candidate.parkId === "banpo")?.conditions.crowd, {
    value: "very_busy",
    freshness: "fresh",
  });
  assert.equal(source.arrivalCrowdFor("banpo", meetingAt).status, "live_forecast");
});

test("keeps a far-future meeting provisional and labels crowd outside the forecast window", async () => {
  const provider: CrowdDataProvider = {
    crowdFor: async (parkId, areaName) => result(parkId, areaName, "normal"),
  };
  const source = new LiveCrowdRecommendationDataSource(new FakeRecommendationDataSource(), provider, () => now);
  const future = "2026-08-13T05:00:00.000Z";
  await source.prepareFor([], future);
  assert.equal(source.stageFor(future), "provisional");
  assert.equal(source.arrivalCrowdFor("yeouido", future).status, "outside_forecast_window");
});
