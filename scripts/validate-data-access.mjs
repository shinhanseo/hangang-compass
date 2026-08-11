import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const REQUEST_TIMEOUT_MS = 15_000;
const HANGANG_PARKS = [
  "강서한강공원",
  "광나루한강공원",
  "난지한강공원",
  "뚝섬한강공원",
  "망원한강공원",
  "반포한강공원",
  "양화한강공원",
  "여의도한강공원",
  "이촌한강공원",
  "잠실한강공원",
  "잠원한강공원",
];

function parseEnv(source) {
  const values = {};

  for (const line of source.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;

    const name = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/u, "$2");
    values[name] = value;
  }

  return values;
}

function requireSecret(env, name) {
  const value = env[name];
  if (!value) {
    throw new Error(`missing:${name}`);
  }
  return value;
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function xmlTag(xml, name) {
  const match = xml.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${name}>`, "su"));
  return match?.[1]?.trim();
}

function countXmlTags(xml, name) {
  return [...xml.matchAll(new RegExp(`<${name}(?:>|\\s)`, "gu"))].length;
}

function xmlTags(xml, name) {
  return [...xml.matchAll(new RegExp(`<${name}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${name}>`, "gsu"))]
    .map((match) => match[1]?.trim())
    .filter(Boolean);
}

function seoulTimestamp(value) {
  if (!value) return null;
  const parsed = new Date(`${value.replace(" ", "T")}+09:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function ageMinutes(value) {
  const parsed = seoulTimestamp(value);
  return parsed ? Math.round((Date.now() - parsed.getTime()) / 60_000) : null;
}

function forecastIntervalMinutes(values) {
  const timestamps = values.map(seoulTimestamp).filter(Boolean).map((value) => value.getTime());
  if (timestamps.length < 2) return null;
  const intervals = timestamps.slice(1).map((value, index) => (value - timestamps[index]) / 60_000);
  return intervals.every((value) => value === intervals[0]) ? intervals[0] : "mixed";
}

async function inspectSeoulArea(key, area) {
  const url = new URL(
    `${encodeURIComponent(key)}/xml/citydata/1/5/${encodeURIComponent(area)}`,
    "http://openapi.seoul.go.kr:8088/",
  );
  const startedAt = performance.now();
  const response = await request(url);
  const xml = await response.text();
  const apiCode = xmlTag(xml, "CODE");
  const returnedArea = xmlTag(xml, "AREA_NM");
  const congestionPresent = Boolean(xmlTag(xml, "AREA_CONGEST_LVL"));
  const populationObservedAt = xmlTag(xml, "PPLTN_TIME");
  const weatherObservedAt = xmlTag(xml, "WEATHER_TIME");
  const forecastTimes = xmlTags(xml, "FCST_TIME");
  const apiCodeAllowsSuccess = !apiCode || apiCode === "INFO-000";
  const ok = response.ok
    && apiCodeAllowsSuccess
    && returnedArea === area
    && Boolean(xmlTag(xml, "AREA_CD"))
    && congestionPresent
    && Boolean(populationObservedAt)
    && forecastTimes.length > 0
    && Boolean(weatherObservedAt);

  return {
    check: "seoul_citydata_area",
    area,
    ok,
    httpStatus: response.status,
    apiCode: apiCode ?? "not_provided",
    areaMatched: returnedArea === area,
    areaCodePresent: Boolean(xmlTag(xml, "AREA_CD")),
    congestionLevel: xmlTag(xml, "AREA_CONGEST_LVL") ?? null,
    populationObservedAt: populationObservedAt ?? null,
    populationAgeMinutes: ageMinutes(populationObservedAt),
    populationReplaced: xmlTag(xml, "REPLACE_YN") ?? null,
    forecastProvided: xmlTag(xml, "FCST_YN") ?? null,
    forecastEntries: countXmlTags(xml, "FCST_PPLTN"),
    forecastFirstAt: forecastTimes.at(0) ?? null,
    forecastLastAt: forecastTimes.at(-1) ?? null,
    forecastIntervalMinutes: forecastIntervalMinutes(forecastTimes),
    weatherObservedAt: weatherObservedAt ?? null,
    weatherAgeMinutes: ageMinutes(weatherObservedAt),
    weatherForecastEntries: countXmlTags(xml, "FCST_DT"),
    parkingEntries: countXmlTags(xml, "PRK_NM"),
    liveParkingEntries: xmlTags(xml, "CUR_PRK_YN").filter((value) => value === "Y").length,
    eventEntries: countXmlTags(xml, "EVENT_NM"),
    responseBytes: Buffer.byteLength(xml),
    elapsedMs: Math.round(performance.now() - startedAt),
  };
}

async function validateSeoul(key) {
  const result = await inspectSeoulArea(key, "여의도한강공원");
  console.log(JSON.stringify(result));

  return result.ok;
}

function percentile(values, ratio) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * ratio) - 1];
}

async function validateAllSeoulParks(key) {
  const results = [];
  for (const area of HANGANG_PARKS) {
    const result = await inspectSeoulArea(key, area);
    results.push(result);
    console.log(JSON.stringify(result));
  }

  const summary = {
    check: "seoul_citydata_all_parks",
    ok: results.every((result) => result.ok),
    parkCount: results.length,
    passedCount: results.filter((result) => result.ok).length,
    failedAreas: results.filter((result) => !result.ok).map((result) => result.area),
    areasWithoutParking: results.filter((result) => result.parkingEntries === 0).map((result) => result.area),
    areasWithoutLiveParking: results.filter((result) => result.liveParkingEntries === 0).map((result) => result.area),
    areasWithoutEvents: results.filter((result) => result.eventEntries === 0).map((result) => result.area),
    forecastEntryRange: [
      Math.min(...results.map((result) => result.forecastEntries)),
      Math.max(...results.map((result) => result.forecastEntries)),
    ],
    populationAgeRangeMinutes: [
      Math.min(...results.map((result) => result.populationAgeMinutes).filter(Number.isFinite)),
      Math.max(...results.map((result) => result.populationAgeMinutes).filter(Number.isFinite)),
    ],
    latencyMs: {
      p50: percentile(results.map((result) => result.elapsedMs), 0.5),
      p95: percentile(results.map((result) => result.elapsedMs), 0.95),
      max: Math.max(...results.map((result) => result.elapsedMs)),
    },
  };

  console.log(JSON.stringify(summary));

  return summary.ok;
}

async function searchPlace(key, query) {
  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", query);
  url.searchParams.set("size", "1");

  const response = await request(url, {
    headers: { Authorization: `KakaoAK ${key}` },
  });
  const body = await response.json().catch(() => null);
  const document = body?.documents?.[0];

  return {
    ok: response.ok && Boolean(document?.x) && Boolean(document?.y),
    httpStatus: response.status,
    count: body?.meta?.total_count ?? 0,
    coordinate: document ? { x: document.x, y: document.y } : null,
  };
}

async function validateKakao(key) {
  const startedAt = performance.now();
  const [origin, destination] = await Promise.all([
    searchPlace(key, "홍대입구역"),
    searchPlace(key, "여의나루역"),
  ]);
  const placeSearchOk = origin.ok && destination.ok;

  console.log(
    JSON.stringify({
      check: "kakao_place_search",
      ok: placeSearchOk,
      httpStatuses: [origin.httpStatus, destination.httpStatus],
      resultCounts: [origin.count, destination.count],
      elapsedMs: Math.round(performance.now() - startedAt),
    }),
  );

  if (!placeSearchOk) return false;

  const routeUrl = new URL("https://dapi.kakao.com/v2/routing/publictraffic");
  routeUrl.searchParams.set("start_x", origin.coordinate.x);
  routeUrl.searchParams.set("start_y", origin.coordinate.y);
  routeUrl.searchParams.set("end_x", destination.coordinate.x);
  routeUrl.searchParams.set("end_y", destination.coordinate.y);

  const routeStartedAt = performance.now();
  const response = await request(routeUrl, {
    headers: { Authorization: `KakaoAK ${key}` },
  });
  const body = await response.json().catch(() => null);
  const routeTimes = (body?.routes ?? [])
    .map((route) => route?.properties?.totalTime)
    .filter(Number.isFinite);
  const ok = response.ok && body?.status === "OK" && routeTimes.length > 0;

  console.log(
    JSON.stringify({
      check: "kakao_public_transit",
      ok,
      httpStatus: response.status,
      apiStatus: body?.status ?? "missing",
      routeCount: routeTimes.length,
      fastestMinutes: routeTimes.length ? Math.round(Math.min(...routeTimes) / 60) : null,
      elapsedMs: Math.round(performance.now() - routeStartedAt),
    }),
  );

  return ok;
}

async function main() {
  const env = parseEnv(await readFile(new URL("../.env", import.meta.url), "utf8"));
  const provider = process.argv.find((argument) => argument.startsWith("--provider="))?.split("=")[1];
  const checks = provider === "seoul"
    ? [validateSeoul(requireSecret(env, "SEOUL_OPEN_DATA_KEY"))]
    : provider === "seoul-all"
      ? [validateAllSeoulParks(requireSecret(env, "SEOUL_OPEN_DATA_KEY"))]
    : provider === "kakao"
      ? [validateKakao(requireSecret(env, "KAKAO_REST_API_KEY"))]
      : [
          validateSeoul(requireSecret(env, "SEOUL_OPEN_DATA_KEY")),
          validateKakao(requireSecret(env, "KAKAO_REST_API_KEY")),
        ];
  const results = await Promise.all(checks);

  if (results.some((result) => !result)) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    const reason = error instanceof Error && error.message.startsWith("missing:")
      ? error.message
      : error?.name === "AbortError"
        ? "request_timeout"
        : "validation_failed";
    console.error(JSON.stringify({ check: "validation", ok: false, reason }));
    process.exitCode = 1;
  });
}

export { forecastIntervalMinutes, parseEnv, xmlTag, xmlTags };
