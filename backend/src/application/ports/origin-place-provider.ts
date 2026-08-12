import type { OriginPlace, OriginPlaceSearchItem } from "../../domain/origin/origin-place.js";
import type { TransitEndpoint } from "../../domain/transit/transit-route.js";

export type OriginPlaceSearchResult =
  | { status: "ok"; places: OriginPlaceSearchItem[] }
  | { status: "unavailable" };

export interface OriginPlaceProvider {
  search(query: string): Promise<OriginPlaceSearchResult>;
  resolve(place: OriginPlace): Promise<TransitEndpoint | null>;
}
