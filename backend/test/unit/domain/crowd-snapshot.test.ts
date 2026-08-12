import assert from "node:assert/strict";
import test from "node:test";
import { selectArrivalCrowd, type CrowdSnapshot } from "../../../src/domain/crowd/crowd-snapshot.js";

const snapshot: CrowdSnapshot = {
  parkId: "yeouido",
  areaName: "여의도한강공원",
  areaCode: "POI105",
  current: {
    level: "normal",
    observedAt: "2026-08-12T05:00:00.000Z",
    freshness: "fresh",
    isReplacement: false,
  },
  forecastStatus: "available",
  forecasts: [
    { forecastFor: "2026-08-12T06:00:00.000Z", level: "busy", populationMin: null, populationMax: null },
    { forecastFor: "2026-08-12T07:00:00.000Z", level: "very_busy", populationMin: null, populationMax: null },
  ],
  fetchedAt: "2026-08-12T05:20:00.000Z",
  source: "seoul_realtime_citydata",
};

test("selects the closest forecast within 30 minutes", () => {
  const result = selectArrivalCrowd(snapshot, "2026-08-12T06:20:00.000Z");
  assert.equal(result.status, "available");
  if (result.status === "available") {
    assert.equal(result.basis, "forecast");
    assert.equal(result.level, "busy");
    assert.equal(result.referenceAt, "2026-08-12T06:00:00.000Z");
  }
});

test("breaks an exact forecast-time tie toward the later forecast", () => {
  const result = selectArrivalCrowd(snapshot, "2026-08-12T06:30:00.000Z");
  assert.equal(result.status, "available");
  if (result.status === "available") assert.equal(result.referenceAt, "2026-08-12T07:00:00.000Z");
});

test("uses current crowd only for a target within 30 minutes of fetching", () => {
  const result = selectArrivalCrowd(snapshot, "2026-08-12T05:25:00.000Z");
  assert.equal(result.status, "available");
  if (result.status === "available") assert.equal(result.basis, "current");
});

test("does not invent crowd outside the official forecast window", () => {
  assert.deepEqual(selectArrivalCrowd(snapshot, "2026-08-13T06:00:00.000Z"), {
    status: "unavailable",
    reason: "outside_forecast_window",
    source: "seoul_realtime_citydata",
  });
});
