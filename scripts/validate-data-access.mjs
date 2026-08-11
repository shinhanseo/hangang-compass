import { readFile } from "node:fs/promises";

const REQUEST_TIMEOUT_MS = 15_000;

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

async function validateSeoul(key) {
  const area = "여의도한강공원";
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
  const populationObservedAtPresent = Boolean(xmlTag(xml, "PPLTN_TIME"));
  const apiCodeAllowsSuccess = !apiCode || apiCode === "INFO-000";
  const ok = response.ok
    && apiCodeAllowsSuccess
    && returnedArea === area
    && congestionPresent
    && populationObservedAtPresent;

  console.log(
    JSON.stringify({
      check: "seoul_citydata",
      ok,
      httpStatus: response.status,
      apiCode: apiCode ?? "not_provided",
      areaMatched: returnedArea === area,
      congestionPresent,
      populationObservedAtPresent,
      forecastEntries: countXmlTags(xml, "FCST_PPLTN"),
      weatherObservedAtPresent: Boolean(xmlTag(xml, "WEATHER_TIME")),
      eventEntries: countXmlTags(xml, "EVENT_STTS"),
      elapsedMs: Math.round(performance.now() - startedAt),
    }),
  );

  return ok;
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
    : provider === "kakao"
      ? [validateKakao(requireSecret(env, "KAKAO_REST_API_KEY"))]
      : [
          validateSeoul(requireSecret(env, "SEOUL_OPEN_DATA_KEY")),
          validateKakao(requireSecret(env, "KAKAO_REST_API_KEY")),
        ];
  const results = await Promise.all(checks);

  if (results.some((result) => !result)) process.exitCode = 1;
}

main().catch((error) => {
  const reason = error instanceof Error && error.message.startsWith("missing:")
    ? error.message
    : error?.name === "AbortError"
      ? "request_timeout"
      : "validation_failed";
  console.error(JSON.stringify({ check: "validation", ok: false, reason }));
  process.exitCode = 1;
});
