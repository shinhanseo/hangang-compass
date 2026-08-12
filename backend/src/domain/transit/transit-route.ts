export interface TransitEndpoint {
  id: string;
  name: string;
  query: string;
  officialAddress?: string;
}

export interface TransitRouteEstimate {
  totalMinutes: number;
  transfers: number | null;
  fareWon: number | null;
  walkingMinutes: number | null;
  calculatedAt: string;
  source: "kakao_public_transit";
}

export type TransitRouteUnavailableReason =
  | "origin_unresolved"
  | "destination_unresolved"
  | "no_route"
  | "http_error"
  | "provider_error"
  | "timeout"
  | "network_error"
  | "quota_guard";

export type TransitRouteResult =
  | { status: "available"; route: TransitRouteEstimate }
  | { status: "unavailable"; reason: TransitRouteUnavailableReason };
