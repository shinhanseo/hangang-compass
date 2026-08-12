import { readFile } from "node:fs/promises";
import { SEOUL_HANGANG_AREAS } from "../backend/src/infrastructure/catalog/seoul-hangang-area-catalog.js";
import { SeoulCitydataCrowdProvider } from "../backend/src/infrastructure/providers/seoul/seoul-citydata-crowd-provider.js";

const SPIKE_FRESHNESS_THRESHOLD_MINUTES = 45;

function parseEnv(source: string): Record<string, string> {
  return Object.fromEntries(source.split(/\r?\n/u).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return [];
    const separator = trimmed.indexOf("=");
    if (separator < 1) return [];
    return [[
      trimmed.slice(0, separator).trim(),
      trimmed.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/u, "$2"),
    ]];
  }));
}

const env = parseEnv(await readFile(new URL("../.env", import.meta.url), "utf8"));
const apiKey = env.SEOUL_OPEN_DATA_KEY;
if (!apiKey) throw new Error("missing:SEOUL_OPEN_DATA_KEY");

const provider = new SeoulCitydataCrowdProvider({
  apiKey,
  freshnessThresholdMinutes: SPIKE_FRESHNESS_THRESHOLD_MINUTES,
});
const summaries = [];
for (const area of SEOUL_HANGANG_AREAS) {
  const result = await provider.crowdFor(area.parkId, area.areaName);
  if (result.status === "unavailable") {
    summaries.push({ parkId: area.parkId, status: result.status, reason: result.reason });
    continue;
  }
  const observationAgeMinutes = Math.round(
    (new Date(result.snapshot.fetchedAt).getTime() - new Date(result.snapshot.current.observedAt).getTime()) / 60_000,
  );
  summaries.push({
    parkId: area.parkId,
    status: result.status,
    areaCode: result.snapshot.areaCode,
    currentLevel: result.snapshot.current.level,
    freshness: result.snapshot.current.freshness,
    observationAgeMinutes,
    replacement: result.snapshot.current.isReplacement,
    forecastStatus: result.snapshot.forecastStatus,
    forecastCount: result.snapshot.forecasts.length,
  });
}

for (const summary of summaries) console.log(JSON.stringify(summary));
const available = summaries.filter((summary) => summary.status === "available");
console.log(JSON.stringify({
  check: "normalized_seoul_hangang_crowd",
  ok: available.length === SEOUL_HANGANG_AREAS.length,
  parkCount: SEOUL_HANGANG_AREAS.length,
  availableCount: available.length,
  spikeFreshnessThresholdMinutes: SPIKE_FRESHNESS_THRESHOLD_MINUTES,
  note: "threshold_is_not_a_final_product_policy",
}));
if (available.length !== SEOUL_HANGANG_AREAS.length) process.exitCode = 1;
