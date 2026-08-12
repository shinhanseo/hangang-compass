export type CrowdLevel = "relaxed" | "normal" | "busy" | "very_busy";
export type CrowdFreshness = "fresh" | "stale";

export interface CrowdForecast {
  forecastFor: string;
  level: CrowdLevel;
  populationMin: number | null;
  populationMax: number | null;
}

export interface CrowdSnapshot {
  parkId: string;
  areaName: string;
  areaCode: string;
  current: {
    level: CrowdLevel;
    observedAt: string;
    freshness: CrowdFreshness;
    isReplacement: boolean;
  };
  forecastStatus: "available" | "unavailable";
  forecasts: CrowdForecast[];
  fetchedAt: string;
  source: "seoul_realtime_citydata";
}

export type CrowdUnavailableReason =
  | "timeout"
  | "network_error"
  | "http_error"
  | "provider_error"
  | "empty_response"
  | "area_mismatch"
  | "malformed_response";

export type CrowdSnapshotResult =
  | { status: "available"; snapshot: CrowdSnapshot }
  | {
    status: "unavailable";
    parkId: string;
    areaName: string;
    fetchedAt: string;
    source: "seoul_realtime_citydata";
    reason: CrowdUnavailableReason;
  };
