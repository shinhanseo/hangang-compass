import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { parseEnv } from "./validate-data-access.mjs";

const REQUEST_TIMEOUT_MS = 15_000;
const ROUTE_SAMPLE_PARK_IDS = ["nanji", "yeouido", "ttukseom"];
const ROUTE_SAMPLE_ORIGINS = ["홍대입구역", "강남역", "노원역"];

function requireSecret(env, name) {
  const value = env[name];
  if (!value) throw new Error(`missing:${name}`);
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

function normalized(value) {
  return value.replace(/\s+/gu, "").toLowerCase();
}

function addressMatches(expected, document) {
  const expectedAddress = normalized(expected);
  return [document.road_address_name, document.address_name]
    .filter(Boolean)
    .some((address) => {
      const actualAddress = normalized(address);
      return expectedAddress.includes(actualAddress) || actualAddress.includes(expectedAddress);
    });
}

function placeScore(candidate, document) {
  const placeName = normalized(document.place_name ?? "");
  const candidateName = normalized(candidate.candidateName);
  const parkName = normalized(candidate.parkName);
  let score = 0;

  if (placeName === candidateName) score += 8;
  else if (placeName.endsWith(candidateName)) score += 6;
  if (placeName.includes(parkName)) score += 2;
  if (addressMatches(candidate.officialAddress, document)) score += 4;

  return score;
}

function selectBestPlace(candidate, documents) {
  return documents
    .map((document) => ({ document, score: placeScore(candidate, document) }))
    .sort((left, right) => right.score - left.score)[0] ?? null;
}

async function kakaoJson(key, url) {
  const response = await request(url, {
    headers: { Authorization: `KakaoAK ${key}` },
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function keywordSearch(key, query, size = 5) {
  const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
  url.searchParams.set("query", query);
  url.searchParams.set("size", String(size));
  return kakaoJson(key, url);
}

async function addressSearch(key, address) {
  const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
  url.searchParams.set("query", address);
  url.searchParams.set("size", "1");
  return kakaoJson(key, url);
}

async function resolveMeetingPoint(key, candidate) {
  const startedAt = performance.now();
  const keyword = await keywordSearch(key, candidate.poiQuery);
  const documents = keyword.body?.documents ?? [];
  const best = selectBestPlace(candidate, documents);

  if (keyword.response.ok && best?.score >= 6 && best.document?.x && best.document?.y) {
    return {
      summary: {
        check: "meeting_point_candidate",
        parkId: candidate.parkId,
        candidateName: candidate.candidateName,
        ok: true,
        resolution: "poi",
        keywordResultCount: keyword.body?.meta?.total_count ?? documents.length,
        selectedPlaceName: best.document.place_name,
        nameMatched: normalized(best.document.place_name).endsWith(normalized(candidate.candidateName)),
        addressMatched: addressMatches(candidate.officialAddress, best.document),
        elapsedMs: Math.round(performance.now() - startedAt),
      },
      coordinate: { x: best.document.x, y: best.document.y },
    };
  }

  const address = await addressSearch(key, candidate.officialAddress);
  const document = address.body?.documents?.[0];
  const ok = address.response.ok && Boolean(document?.x) && Boolean(document?.y);

  return {
    summary: {
      check: "meeting_point_candidate",
      parkId: candidate.parkId,
      candidateName: candidate.candidateName,
      ok,
      resolution: ok ? "address_only" : "unresolved",
      keywordResultCount: keyword.body?.meta?.total_count ?? documents.length,
      selectedPlaceName: best?.document?.place_name ?? null,
      nameMatched: false,
      addressMatched: ok,
      elapsedMs: Math.round(performance.now() - startedAt),
    },
    coordinate: ok ? { x: document.x, y: document.y } : null,
  };
}

async function resolveOrigin(key, query) {
  const result = await keywordSearch(key, query, 1);
  const document = result.body?.documents?.[0];
  if (!result.response.ok || !document?.x || !document?.y) return null;
  return { x: document.x, y: document.y };
}

function summarizeFastestRoute(body) {
  const routes = (body?.routes ?? []).filter((route) => Number.isFinite(route?.properties?.totalTime));
  const fastest = routes.sort(
    (left, right) => left.properties.totalTime - right.properties.totalTime,
  )[0];
  if (!fastest) return null;

  const steps = fastest.steps ?? [];
  const walkingSteps = steps.filter((step) => step?.properties?.type === "WALKING");
  const lastStep = steps.at(-1)?.properties;

  return {
    routeCount: routes.length,
    totalMinutes: Math.round(fastest.properties.totalTime / 60),
    transfers: fastest.properties.transfers,
    fareWon: fastest.properties.fare?.value ?? null,
    walkingMinutes: Math.round(
      walkingSteps.reduce((total, step) => total + (step.properties.time ?? 0), 0) / 60,
    ),
    walkingDistanceMeters: walkingSteps.reduce(
      (total, step) => total + (step.properties.distance ?? 0),
      0,
    ),
    finalWalkingDistanceMeters: lastStep?.type === "WALKING" ? lastStep.distance ?? 0 : null,
  };
}

async function inspectRoute(key, originName, origin, candidate, destination) {
  const url = new URL("https://dapi.kakao.com/v2/routing/publictraffic");
  url.searchParams.set("start_x", origin.x);
  url.searchParams.set("start_y", origin.y);
  url.searchParams.set("end_x", destination.x);
  url.searchParams.set("end_y", destination.y);
  url.searchParams.set("s_name", originName);
  url.searchParams.set("e_name", candidate.candidateName);

  const startedAt = performance.now();
  const { response, body } = await kakaoJson(key, url);
  const fastest = summarizeFastestRoute(body);

  return {
    check: "meeting_point_route",
    ok: response.ok && body?.status === "OK" && Boolean(fastest),
    origin: originName,
    parkId: candidate.parkId,
    apiStatus: body?.status ?? "missing",
    ...fastest,
    elapsedMs: Math.round(performance.now() - startedAt),
  };
}

function mean(values) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function summarizeRouteMatrix(results) {
  return ROUTE_SAMPLE_PARK_IDS.map((parkId) => {
    const parkResults = results.filter((result) => result.parkId === parkId && result.ok);
    const times = parkResults.map((result) => result.totalMinutes);
    const finalWalks = parkResults
      .map((result) => result.finalWalkingDistanceMeters)
      .filter(Number.isFinite);

    return {
      parkId,
      complete: parkResults.length === ROUTE_SAMPLE_ORIGINS.length,
      averageMinutes: times.length ? Math.round(mean(times)) : null,
      maximumMinutes: times.length ? Math.max(...times) : null,
      timeRangeMinutes: times.length ? Math.max(...times) - Math.min(...times) : null,
      maximumFinalWalkingMeters: finalWalks.length ? Math.max(...finalWalks) : null,
    };
  });
}

async function main() {
  const env = parseEnv(await readFile(new URL("../.env", import.meta.url), "utf8"));
  const key = requireSecret(env, "KAKAO_REST_API_KEY");
  const candidates = JSON.parse(
    await readFile(new URL("../data/meeting-points.json", import.meta.url), "utf8"),
  );
  const mode = process.argv.find((argument) => argument.startsWith("--mode="))?.split("=")[1] ?? "all";
  const resolved = new Map();

  for (const candidate of candidates) {
    const result = await resolveMeetingPoint(key, candidate);
    resolved.set(candidate.parkId, result.coordinate);
    console.log(JSON.stringify(result.summary));
  }

  const candidateSummaries = candidates.map((candidate) => ({
    candidate,
    resolved: resolved.get(candidate.parkId),
  }));
  const unresolved = candidateSummaries.filter((item) => !item.resolved).map((item) => item.candidate.parkId);
  console.log(JSON.stringify({
    check: "meeting_point_catalog",
    ok: unresolved.length === 0,
    candidateCount: candidates.length,
    unresolved,
  }));

  if (mode === "poi") {
    if (unresolved.length) process.exitCode = 1;
    return;
  }

  const origins = new Map();
  for (const originName of ROUTE_SAMPLE_ORIGINS) {
    origins.set(originName, await resolveOrigin(key, originName));
  }

  const routeResults = [];
  for (const parkId of ROUTE_SAMPLE_PARK_IDS) {
    const candidate = candidates.find((item) => item.parkId === parkId);
    const destination = resolved.get(parkId);
    if (!candidate || !destination) continue;

    for (const originName of ROUTE_SAMPLE_ORIGINS) {
      const origin = origins.get(originName);
      if (!origin) continue;
      const result = await inspectRoute(key, originName, origin, candidate, destination);
      routeResults.push(result);
      console.log(JSON.stringify(result));
    }
  }

  const matrix = summarizeRouteMatrix(routeResults);
  console.log(JSON.stringify({
    check: "meeting_point_route_matrix",
    ok: matrix.every((item) => item.complete),
    parks: matrix,
  }));

  if (unresolved.length || matrix.some((item) => !item.complete)) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    const reason = error instanceof Error && error.message.startsWith("missing:")
      ? error.message
      : error?.name === "AbortError"
        ? "request_timeout"
        : "validation_failed";
    console.error(JSON.stringify({ check: "meeting_point_validation", ok: false, reason }));
    process.exitCode = 1;
  });
}

export {
  addressMatches,
  placeScore,
  selectBestPlace,
  summarizeFastestRoute,
  summarizeRouteMatrix,
};
