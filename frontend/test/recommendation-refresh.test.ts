import assert from "node:assert/strict";
import test from "node:test";

import { isOutsideArrivalForecastWindow, nextRecommendationRefreshDelay } from "../src/shared/lib/recommendation-refresh.js";

test("shows the first-recommendation notice only beyond twelve hours", () => {
  const now = Date.parse("2026-08-13T00:00:00.000Z");
  assert.equal(isOutsideArrivalForecastWindow("2026-08-13T12:00:01.000Z", now), true);
  assert.equal(isOutsideArrivalForecastWindow("2026-08-13T12:00:00.000Z", now), false);
  assert.equal(isOutsideArrivalForecastWindow("invalid", now), false);
});

test("checks a distant recommendation boundary at most hourly", () => {
  assert.equal(nextRecommendationRefreshDelay("2026-08-13T12:00:00.000Z", Date.parse("2026-08-13T00:00:00.000Z")), 60 * 60_000);
});

test("wakes exactly at a nearby recommendation boundary", () => {
  assert.equal(nextRecommendationRefreshDelay("2026-08-13T00:05:00.000Z", Date.parse("2026-08-13T00:00:00.000Z")), 5 * 60_000);
});

test("retries shortly after the recommendation boundary", () => {
  assert.equal(nextRecommendationRefreshDelay("2026-08-12T23:59:00.000Z", Date.parse("2026-08-13T00:00:00.000Z")), 1_000);
});
