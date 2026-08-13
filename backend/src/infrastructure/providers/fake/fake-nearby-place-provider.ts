import type { NearbyPlaceProvider } from "../../../application/ports/nearby-place-provider.js";

export class FakeNearbyPlaceProvider implements NearbyPlaceProvider {
  async placesNear(parkId: string) {
    return {
      status: "available" as const,
      parkId,
      fetchedAt: "2026-08-14T00:00:00.000Z",
      source: "fake" as const,
      sections: [
        { kind: "spot" as const, status: "available" as const, places: [{ id: "sample-spot", name: "샘플 전망대", category: "전망대", address: "서울", distanceMeters: 320, kakaoMapUrl: "https://place.map.kakao.com/1" }] },
        { kind: "food" as const, status: "available" as const, places: [{ id: "sample-food", name: "샘플 식당", category: "음식점", address: "서울", distanceMeters: 450, kakaoMapUrl: "https://place.map.kakao.com/2" }] },
        { kind: "cafe" as const, status: "available" as const, places: [] },
        { kind: "store" as const, status: "available" as const, places: [] },
      ],
    };
  }
}
