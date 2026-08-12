export interface TransitEndpoint {
  id: string;
  name: string;
  query: string;
  officialAddress?: string;
  coordinate?: { x: string; y: string };
}

export interface TransitRouteEstimate {
  totalMinutes: number;
  transfers: number | null;
  fareWon: number | null;
  walkingMinutes: number | null;
  calculatedAt: string;
  tollWon?: number | null;
  parkingWalkMinutes?: number | null;
  source: "kakao_public_transit" | "kakao_driving" | "kakao_walking" | "kakao_car_with_parking";
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
