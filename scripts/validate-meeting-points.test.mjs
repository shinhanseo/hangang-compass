import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  addressMatches,
  placeScore,
  selectBestPlace,
  summarizeFastestRoute,
  summarizeRouteMatrix,
} from "./validate-meeting-points.mjs";

const candidate = {
  parkName: "여의도한강공원",
  candidateName: "여의도안내센터",
  officialAddress: "서울 영등포구 여의동로 330",
};

test("meeting point catalog has 11 unique provisional candidates without coordinates", async () => {
  const catalog = JSON.parse(
    await readFile(new URL("../data/meeting-points.json", import.meta.url), "utf8"),
  );

  assert.equal(catalog.length, 11);
  assert.equal(new Set(catalog.map((item) => item.parkId)).size, 11);
  for (const item of catalog) {
    assert.equal(item.verificationStatus, "provisional");
    assert.match(item.officialSourceUrl, /^https:\/\/hangang\.seoul\.go\.kr\//u);
    assert.ok(item.meetingInstruction.endsWith("출입구 앞"));
    assert.equal("x" in item, false);
    assert.equal("y" in item, false);
  }
});

test("addressMatches accepts equivalent Kakao road addresses", () => {
  assert.equal(
    addressMatches(candidate.officialAddress, {
      road_address_name: "서울 영등포구 여의동로 330",
      address_name: "서울 영등포구 여의도동 8",
    }),
    true,
  );
});

test("selectBestPlace prefers the named facility and matching address", () => {
  const documents = [
    {
      place_name: "여의도한강공원",
      road_address_name: "서울 영등포구 여의동로 330",
    },
    {
      place_name: "여의도안내센터",
      road_address_name: "서울 영등포구 여의동로 330",
    },
  ];

  assert.ok(placeScore(candidate, documents[1]) > placeScore(candidate, documents[0]));
  assert.equal(selectBestPlace(candidate, documents).document.place_name, "여의도안내센터");
});

test("placeScore rejects a similarly named sub-facility", () => {
  const exact = {
    place_name: "미래한강본부 여의도안내센터",
    road_address_name: "서울 영등포구 여의동로 330",
  };
  const subFacility = {
    place_name: "여의도안내센터 개방형샤워장",
    road_address_name: "서울 영등포구 여의동로 330",
  };

  assert.ok(placeScore(candidate, exact) > placeScore(candidate, subFacility));
});

test("summarizeFastestRoute reports transit and final walk", () => {
  const result = summarizeFastestRoute({
    routes: [
      {
        properties: {
          totalTime: 2_400,
          transfers: 1,
          fare: { value: 1_500 },
        },
        steps: [
          { properties: { type: "SUBWAY", time: 1_500, distance: 8_000 } },
          { properties: { type: "WALKING", time: 600, distance: 700 } },
        ],
      },
    ],
  });

  assert.deepEqual(result, {
    routeCount: 1,
    totalMinutes: 40,
    transfers: 1,
    fareWon: 1_500,
    walkingMinutes: 10,
    walkingDistanceMeters: 700,
    finalWalkingDistanceMeters: 700,
  });
});

test("summarizeFastestRoute does not invent a zero final walk", () => {
  const result = summarizeFastestRoute({
    routes: [
      {
        properties: { totalTime: 1_200, transfers: 0 },
        steps: [{ properties: { type: "BUS", time: 1_200, distance: 5_000 } }],
      },
    ],
  });

  assert.equal(result.finalWalkingDistanceMeters, null);
});

test("summarizeRouteMatrix calculates fairness signals", () => {
  const results = ["nanji", "yeouido", "ttukseom"].flatMap((parkId, parkIndex) =>
    ["홍대입구역", "강남역", "노원역"].map((origin, originIndex) => ({
      parkId,
      origin,
      ok: true,
      totalMinutes: 20 + parkIndex * 5 + originIndex * 10,
      finalWalkingDistanceMeters: 100 + originIndex * 100,
    })),
  );
  const summary = summarizeRouteMatrix(results);

  assert.equal(summary.length, 3);
  assert.equal(summary[0].complete, true);
  assert.equal(summary[0].averageMinutes, 30);
  assert.equal(summary[0].timeRangeMinutes, 20);
  assert.equal(summary[0].maximumFinalWalkingMeters, 300);
});

test("summarizeRouteMatrix keeps an unverified final walk unknown", () => {
  const results = ["nanji", "yeouido", "ttukseom"].flatMap((parkId) =>
    ["홍대입구역", "강남역", "노원역"].map((origin) => ({
      parkId,
      origin,
      ok: true,
      totalMinutes: 30,
      finalWalkingDistanceMeters: null,
    })),
  );

  for (const park of summarizeRouteMatrix(results)) {
    assert.equal(park.maximumFinalWalkingMeters, null);
  }
});
