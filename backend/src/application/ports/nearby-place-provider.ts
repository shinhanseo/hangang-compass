export type NearbyPlaceKind = "spot" | "food" | "cafe" | "store";

export interface NearbyPlaceRecommendation {
  id: string;
  name: string;
  category: string;
  address: string;
  distanceMeters: number;
  kakaoMapUrl: string;
}

export interface NearbyPlaceSection {
  kind: NearbyPlaceKind;
  status: "available" | "unavailable";
  places: NearbyPlaceRecommendation[];
}

export type NearbyPlaceResult =
  | { status: "available"; parkId: string; fetchedAt: string; source: "kakao_local" | "fake"; sections: NearbyPlaceSection[] }
  | { status: "unavailable" };

export interface NearbyPlaceProvider {
  placesNear(parkId: string): Promise<NearbyPlaceResult>;
}
