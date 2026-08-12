import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSeoulCrowdXml,
  SeoulCitydataCrowdProvider,
} from "../../../src/infrastructure/providers/seoul/seoul-citydata-crowd-provider.js";

const FIXTURE = `
<SeoulRtd.citydata>
  <CITYDATA>
    <AREA_NM><![CDATA[여의도한강공원]]></AREA_NM>
    <AREA_CD>POI017</AREA_CD>
    <LIVE_PPLTN_STTS>
      <AREA_CONGEST_LVL>약간 붐빔</AREA_CONGEST_LVL>
      <REPLACE_YN>N</REPLACE_YN>
      <PPLTN_TIME>2026-08-12 14:00</PPLTN_TIME>
      <FCST_PPLTN>
        <FCST_TIME>2026-08-12 15:00</FCST_TIME>
        <FCST_CONGEST_LVL>붐빔</FCST_CONGEST_LVL>
        <FCST_PPLTN_MIN>12000</FCST_PPLTN_MIN>
        <FCST_PPLTN_MAX>14000</FCST_PPLTN_MAX>
      </FCST_PPLTN>
      <FCST_PPLTN>
        <FCST_TIME>2026-08-12 16:00</FCST_TIME>
        <FCST_CONGEST_LVL>보통</FCST_CONGEST_LVL>
        <FCST_PPLTN_MIN>9000</FCST_PPLTN_MIN>
        <FCST_PPLTN_MAX>11000</FCST_PPLTN_MAX>
      </FCST_PPLTN>
    </LIVE_PPLTN_STTS>
  </CITYDATA>
</SeoulRtd.citydata>`;

test("normalizes current and forecast crowd with source timestamps", () => {
  const result = normalizeSeoulCrowdXml({
    xml: FIXTURE,
    parkId: "yeouido",
    requestedAreaName: "여의도한강공원",
    fetchedAt: new Date("2026-08-12T05:20:00.000Z"),
    freshnessThresholdMinutes: 30,
  });
  assert.equal(result.status, "available");
  if (result.status !== "available") return;
  assert.deepEqual(result.snapshot.current, {
    level: "busy",
    observedAt: "2026-08-12T05:00:00.000Z",
    freshness: "fresh",
    isReplacement: false,
  });
  assert.equal(result.snapshot.forecasts.length, 2);
  assert.equal(result.snapshot.forecastStatus, "available");
  assert.deepEqual(result.snapshot.forecasts[0], {
    forecastFor: "2026-08-12T06:00:00.000Z",
    level: "very_busy",
    populationMin: 12000,
    populationMax: 14000,
  });
  assert.equal(result.snapshot.source, "seoul_realtime_citydata");
});

test("keeps a valid current observation when forecasts are unavailable", () => {
  const result = normalizeSeoulCrowdXml({
    xml: FIXTURE.replace(/<FCST_PPLTN>[\s\S]*<\/FCST_PPLTN>/u, ""),
    parkId: "yeouido",
    requestedAreaName: "여의도한강공원",
    fetchedAt: new Date("2026-08-12T05:20:00.000Z"),
    freshnessThresholdMinutes: 30,
  });
  assert.equal(result.status, "available");
  if (result.status === "available") {
    assert.equal(result.snapshot.forecastStatus, "unavailable");
    assert.deepEqual(result.snapshot.forecasts, []);
  }
});

test("marks an old observation stale using the injected threshold", () => {
  const result = normalizeSeoulCrowdXml({
    xml: FIXTURE,
    parkId: "yeouido",
    requestedAreaName: "여의도한강공원",
    fetchedAt: new Date("2026-08-12T06:01:00.000Z"),
    freshnessThresholdMinutes: 30,
  });
  assert.equal(result.status, "available");
  if (result.status === "available") assert.equal(result.snapshot.current.freshness, "stale");
});

test("distinguishes empty, provider error, area mismatch, and malformed responses", () => {
  const base = {
    parkId: "yeouido",
    requestedAreaName: "여의도한강공원",
    fetchedAt: new Date("2026-08-12T05:20:00.000Z"),
    freshnessThresholdMinutes: 30,
  };
  assert.equal(normalizeSeoulCrowdXml({ ...base, xml: "" }).status, "unavailable");
  assert.deepEqual(normalizeSeoulCrowdXml({ ...base, xml: "<RESULT><CODE>ERROR-301</CODE></RESULT>" }), {
    status: "unavailable", parkId: "yeouido", areaName: "여의도한강공원",
    fetchedAt: "2026-08-12T05:20:00.000Z", source: "seoul_realtime_citydata", reason: "provider_error",
  });
  assert.equal(normalizeSeoulCrowdXml({ ...base, xml: FIXTURE.replaceAll("여의도한강공원", "반포한강공원") }).status, "unavailable");
  assert.equal(normalizeSeoulCrowdXml({ ...base, xml: FIXTURE.replace("<AREA_CD>POI017</AREA_CD>", "") }).status, "unavailable");
});

test("maps HTTP, timeout, and network failures without leaking request details", async () => {
  const fixed = new Date("2026-08-12T05:20:00.000Z");
  const httpProvider = new SeoulCitydataCrowdProvider({
    apiKey: "test-key",
    freshnessThresholdMinutes: 30,
    fetcher: async () => new Response("failure", { status: 503 }),
  });
  assert.equal((await httpProvider.crowdFor("yeouido", "여의도한강공원", fixed)).status, "unavailable");

  const networkProvider = new SeoulCitydataCrowdProvider({
    apiKey: "test-key",
    freshnessThresholdMinutes: 30,
    fetcher: async () => { throw new Error("request including a secret URL"); },
  });
  const network = await networkProvider.crowdFor("yeouido", "여의도한강공원", fixed);
  assert.deepEqual(network, {
    status: "unavailable", parkId: "yeouido", areaName: "여의도한강공원",
    fetchedAt: fixed.toISOString(), source: "seoul_realtime_citydata", reason: "network_error",
  });

  const timeoutProvider = new SeoulCitydataCrowdProvider({
    apiKey: "test-key",
    freshnessThresholdMinutes: 30,
    requestTimeoutMs: 1,
    fetcher: async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }),
  });
  const timeout = await timeoutProvider.crowdFor("yeouido", "여의도한강공원", fixed);
  assert.equal(timeout.status, "unavailable");
  if (timeout.status === "unavailable") assert.equal(timeout.reason, "timeout");
});
