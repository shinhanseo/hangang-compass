import assert from "node:assert/strict";
import test from "node:test";

import { FAIRNESS_POLICIES, evaluateCandidate, recommend } from "./recommendation.ts";
import { RECOMMENDATION_CASES } from "../fixtures/recommendation-cases.ts";

test("each acceptance fixture evaluates all 11 Hangang parks", () => {
  for (const fixture of Object.values(RECOMMENDATION_CASES)) {
    assert.equal(fixture.candidates.length, 11);
    assert.equal(new Set(fixture.candidates.map((candidate) => candidate.parkId)).size, 11);
  }
});

test("B1 recommends the slightly farther park when fresh crowd and event burden is lower", () => {
  const result = recommend(RECOMMENDATION_CASES.nearbyButCrowded, FAIRNESS_POLICIES.balanced);

  assert.equal(result.status, "ok");
  assert.equal(result.recommended?.parkId, "yeouido");
  assert.equal(result.alternative?.parkId, "banpo");
  assert.equal(result.comparison?.averageDifferenceMinutes, 6);
  assert.equal(result.comparison?.conditionPenaltyDifference, -38);
  assert.match(result.comparison?.summary ?? "", /평균 6분 더 걸립니다/u);
  assert.match(result.comparison?.summary ?? "", /매우 혼잡한 예측과 큰 행사 영향을 피합니다/u);
});

test("B2 exposes the product consequence of average-only versus balanced fairness", () => {
  const averageOnly = recommend(RECOMMENDATION_CASES.unfairOutlier, FAIRNESS_POLICIES.averageOnly);
  const balanced = recommend(RECOMMENDATION_CASES.unfairOutlier, FAIRNESS_POLICIES.balanced);
  const minimax = recommend(RECOMMENDATION_CASES.unfairOutlier, FAIRNESS_POLICIES.minimax);

  assert.equal(averageOnly.recommended?.parkId, "mangwon");
  assert.deepEqual(averageOnly.recommended?.travel, {
    averageMinutes: 30,
    maximumMinutes: 70,
    rangeMinutes: 60,
  });
  assert.equal(balanced.recommended?.parkId, "yeouido");
  assert.equal(minimax.recommended?.parkId, "yeouido");
  assert.match(balanced.comparison?.summary ?? "", /가장 긴 이동은 34분 줄어듭니다/u);
});

test("B3 excludes a closed park instead of merely subtracting points", () => {
  const result = recommend(RECOMMENDATION_CASES.closedFastest, FAIRNESS_POLICIES.balanced);
  const closed = result.excluded.find((candidate) => candidate.parkId === "banpo");

  assert.equal(result.recommended?.parkId, "yeouido");
  assert.deepEqual(closed?.exclusionReasons, ["park_closed"]);
});

test("B4 resolves an exact tie by maximum, average, then stable park id", () => {
  const result = recommend(RECOMMENDATION_CASES.exactTie, FAIRNESS_POLICIES.balanced);

  assert.equal(result.recommended?.parkId, "banpo");
  assert.equal(result.alternative?.parkId, "yeouido");
  assert.equal(result.nearTie, true);
});

test("E1 unavailable crowd is not interpreted as relaxed", () => {
  const result = recommend(RECOMMENDATION_CASES.crowdUnavailable, FAIRNESS_POLICIES.balanced);
  const candidate = result.recommended;

  assert.equal(candidate?.parkId, "yeouido");
  assert.equal(candidate?.penalties.crowd, 15);
  assert.equal(candidate?.confidence, "reduced");
  assert.ok(candidate?.warnings.includes("crowd_unavailable"));
});

test("E2 returns no recommendation when route data is unavailable", () => {
  const result = recommend(RECOMMENDATION_CASES.allRoutesUnavailable, FAIRNESS_POLICIES.balanced);

  assert.equal(result.status, "insufficient_data");
  assert.equal(result.recommended, null);
  assert.equal(result.excluded.length, 11);
});

test("E3 stale relaxed crowd uses uncertainty penalty instead of its level", () => {
  const input = RECOMMENDATION_CASES.staleCrowd;
  const banpo = input.candidates.find((candidate) => candidate.parkId === "banpo");
  assert.ok(banpo);
  const evaluated = evaluateCandidate(input, banpo, FAIRNESS_POLICIES.balanced);

  assert.equal(evaluated.penalties.crowd, 10);
  assert.ok(evaluated.warnings.includes("crowd_stale"));
});

test("E3 applies freshness rules to weather, events, and controls too", () => {
  const input = structuredClone(RECOMMENDATION_CASES.staleCrowd);
  const candidate = input.candidates.find((item) => item.parkId === "yeouido");
  assert.ok(candidate);
  candidate.conditions.weather = { value: "good", freshness: "stale" };
  candidate.conditions.eventImpact = { value: "none", freshness: "unavailable" };
  candidate.conditions.control = { value: "open", freshness: "stale" };

  const evaluated = evaluateCandidate(input, candidate, FAIRNESS_POLICIES.balanced);
  assert.equal(evaluated.penalties.weather, 12);
  assert.equal(evaluated.penalties.event, 8);
  assert.equal(evaluated.penalties.confidence, 20);
  assert.deepEqual(
    evaluated.warnings,
    ["weather_stale", "event_unavailable", "control_stale"],
  );
  assert.equal(evaluated.confidence, "reduced");
});

test("E4 excludes a candidate with one participant route missing", () => {
  const result = recommend(RECOMMENDATION_CASES.oneParticipantMissing, FAIRNESS_POLICIES.balanced);
  const incomplete = result.excluded.find((candidate) => candidate.parkId === "banpo");

  assert.equal(result.recommended?.parkId, "yeouido");
  assert.ok(incomplete?.exclusionReasons.includes("participant_route_missing"));
});

test("D1 provisional recommendation ignores crowd outside the forecast window", () => {
  const result = recommend(RECOMMENDATION_CASES.provisionalOutsideForecast, FAIRNESS_POLICIES.balanced);

  assert.equal(result.recommended?.parkId, "yeouido");
  assert.equal(result.recommended?.penalties.crowd, 0);
  assert.ok(result.recommended?.warnings.includes("crowd_outside_forecast_window"));
});

test("recommendation is deterministic and does not mutate fixture input", () => {
  const fixture = RECOMMENDATION_CASES.nearbyButCrowded;
  const before = JSON.stringify(fixture);
  const first = recommend(fixture, FAIRNESS_POLICIES.balanced);
  const second = recommend(fixture, FAIRNESS_POLICIES.balanced);

  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(fixture), before);
});
