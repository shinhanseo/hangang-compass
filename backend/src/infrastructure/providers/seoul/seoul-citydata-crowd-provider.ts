import type { CrowdDataProvider } from "../../../application/ports/crowd-data-provider.js";
import type {
  CrowdForecast,
  CrowdFreshness,
  CrowdLevel,
  CrowdSnapshotResult,
  CrowdUnavailableReason,
} from "../../../domain/crowd/crowd-snapshot.js";

const SOURCE = "seoul_realtime_citydata" as const;
const SEOUL_OFFSET = "+09:00";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface SeoulCrowdProviderOptions {
  apiKey: string;
  freshnessThresholdMinutes: number;
  requestTimeoutMs?: number;
  fetcher?: FetchLike;
}

function tag(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`<${name}>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?</${name}>`, "su"));
  return match?.[1]?.trim() || null;
}

function blocks(xml: string, name: string): string[] {
  return [...xml.matchAll(new RegExp(`<${name}>(.*?)</${name}>`, "gsu"))]
    .map((match) => match[1] ?? "");
}

function seoulInstant(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value.replace(" ", "T")}${SEOUL_OFFSET}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function crowdLevel(value: string | null): CrowdLevel | null {
  switch (value?.replace(/\s+/gu, " ")) {
    case "여유": return "relaxed";
    case "보통": return "normal";
    case "약간 붐빔": return "busy";
    case "붐빔": return "very_busy";
    default: return null;
  }
}

function integer(value: string | null): number | null {
  if (!value || !/^\d+$/u.test(value)) return null;
  return Number(value);
}

function unavailable(
  parkId: string,
  areaName: string,
  fetchedAt: Date,
  reason: CrowdUnavailableReason,
): CrowdSnapshotResult {
  return {
    status: "unavailable",
    parkId,
    areaName,
    fetchedAt: fetchedAt.toISOString(),
    source: SOURCE,
    reason,
  };
}

export function normalizeSeoulCrowdXml(input: {
  xml: string;
  parkId: string;
  requestedAreaName: string;
  fetchedAt: Date;
  freshnessThresholdMinutes: number;
}): CrowdSnapshotResult {
  const { xml, parkId, requestedAreaName, fetchedAt, freshnessThresholdMinutes } = input;
  if (!xml.trim()) return unavailable(parkId, requestedAreaName, fetchedAt, "empty_response");

  const providerCode = tag(xml, "CODE");
  if (providerCode && providerCode !== "INFO-000") {
    return unavailable(parkId, requestedAreaName, fetchedAt, "provider_error");
  }

  const returnedAreaName = tag(xml, "AREA_NM");
  if (returnedAreaName && returnedAreaName !== requestedAreaName) {
    return unavailable(parkId, requestedAreaName, fetchedAt, "area_mismatch");
  }

  const areaCode = tag(xml, "AREA_CD");
  const level = crowdLevel(tag(xml, "AREA_CONGEST_LVL"));
  const observedAt = seoulInstant(tag(xml, "PPLTN_TIME"));
  if (!returnedAreaName || !areaCode || !level || !observedAt) {
    return unavailable(parkId, requestedAreaName, fetchedAt, "malformed_response");
  }

  const observationAgeMs = fetchedAt.getTime() - observedAt.getTime();
  const freshness: CrowdFreshness = observationAgeMs >= 0
    && observationAgeMs <= freshnessThresholdMinutes * 60_000
    ? "fresh"
    : "stale";
  const forecasts: CrowdForecast[] = [];
  for (const block of blocks(xml, "FCST_PPLTN")) {
    const forecastAt = seoulInstant(tag(block, "FCST_TIME"));
    const forecastLevel = crowdLevel(tag(block, "FCST_CONGEST_LVL"));
    if (!forecastAt || !forecastLevel) continue;
    forecasts.push({
      forecastFor: forecastAt.toISOString(),
      level: forecastLevel,
      populationMin: integer(tag(block, "FCST_PPLTN_MIN")),
      populationMax: integer(tag(block, "FCST_PPLTN_MAX")),
    });
  }

  return {
    status: "available",
    snapshot: {
      parkId,
      areaName: returnedAreaName,
      areaCode,
      current: {
        level,
        observedAt: observedAt.toISOString(),
        freshness,
        isReplacement: tag(xml, "REPLACE_YN") === "Y",
      },
      forecastStatus: forecasts.length > 0 ? "available" : "unavailable",
      forecasts,
      fetchedAt: fetchedAt.toISOString(),
      source: SOURCE,
    },
  };
}

export class SeoulCitydataCrowdProvider implements CrowdDataProvider {
  readonly #apiKey: string;
  readonly #freshnessThresholdMinutes: number;
  readonly #requestTimeoutMs: number;
  readonly #fetcher: FetchLike;

  constructor(options: SeoulCrowdProviderOptions) {
    if (!options.apiKey) throw new Error("seoul_api_key_required");
    if (options.freshnessThresholdMinutes <= 0) throw new Error("freshness_threshold_required");
    this.#apiKey = options.apiKey;
    this.#freshnessThresholdMinutes = options.freshnessThresholdMinutes;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
    this.#fetcher = options.fetcher ?? fetch;
  }

  async crowdFor(parkId: string, areaName: string, fetchedAt?: Date): Promise<CrowdSnapshotResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#requestTimeoutMs);
    try {
      const url = new URL(
        `${encodeURIComponent(this.#apiKey)}/xml/citydata/1/5/${encodeURIComponent(areaName)}`,
        "http://openapi.seoul.go.kr:8088/",
      );
      const response = await this.#fetcher(url, { signal: controller.signal });
      const completedAt = fetchedAt ?? new Date();
      if (!response.ok) return unavailable(parkId, areaName, completedAt, "http_error");
      return normalizeSeoulCrowdXml({
        xml: await response.text(),
        parkId,
        requestedAreaName: areaName,
        fetchedAt: completedAt,
        freshnessThresholdMinutes: this.#freshnessThresholdMinutes,
      });
    } catch (error) {
      const reason = error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error";
      return unavailable(parkId, areaName, fetchedAt ?? new Date(), reason);
    } finally {
      clearTimeout(timeout);
    }
  }
}
