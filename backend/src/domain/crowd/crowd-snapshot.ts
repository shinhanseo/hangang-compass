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

export type ArrivalCrowdSelection =
  | {
    status: "available";
    level: CrowdLevel;
    basis: "current" | "forecast";
    referenceAt: string;
    observedAt: string;
    fetchedAt: string;
    freshness: CrowdFreshness;
    source: "seoul_realtime_citydata";
  }
  | {
    status: "unavailable";
    reason: "outside_forecast_window" | "forecast_unavailable" | "invalid_target_time";
    source: "seoul_realtime_citydata";
  };

export function selectArrivalCrowd(
  snapshot: CrowdSnapshot,
  targetTime: string,
  maximumDifferenceMinutes = 30,
): ArrivalCrowdSelection {
  const target = new Date(targetTime);
  if (Number.isNaN(target.getTime())) {
    return { status: "unavailable", reason: "invalid_target_time", source: snapshot.source };
  }

  const maximumDifferenceMs = maximumDifferenceMinutes * 60_000;
  const forecasts = snapshot.forecasts
    .map((forecast) => ({ forecast, time: new Date(forecast.forecastFor).getTime() }))
    .filter(({ time }) => Number.isFinite(time))
    .map(({ forecast, time }) => ({ forecast, time, difference: Math.abs(time - target.getTime()) }))
    .filter(({ difference }) => difference <= maximumDifferenceMs)
    .sort((left, right) => left.difference - right.difference || right.time - left.time);
  const selected = forecasts[0]?.forecast;
  if (selected) {
    return {
      status: "available",
      level: selected.level,
      basis: "forecast",
      referenceAt: selected.forecastFor,
      observedAt: snapshot.current.observedAt,
      fetchedAt: snapshot.fetchedAt,
      freshness: snapshot.current.freshness,
      source: snapshot.source,
    };
  }

  const fetchedAt = new Date(snapshot.fetchedAt).getTime();
  if (Number.isFinite(fetchedAt) && Math.abs(target.getTime() - fetchedAt) <= maximumDifferenceMs) {
    return {
      status: "available",
      level: snapshot.current.level,
      basis: "current",
      referenceAt: snapshot.current.observedAt,
      observedAt: snapshot.current.observedAt,
      fetchedAt: snapshot.fetchedAt,
      freshness: snapshot.current.freshness,
      source: snapshot.source,
    };
  }

  return {
    status: "unavailable",
    reason: snapshot.forecastStatus === "unavailable" ? "forecast_unavailable" : "outside_forecast_window",
    source: snapshot.source,
  };
}
