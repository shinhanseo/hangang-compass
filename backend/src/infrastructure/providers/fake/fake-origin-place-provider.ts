import type { OriginPlaceProvider } from "../../../application/ports/origin-place-provider.js";
import type { OriginPlace } from "../../../domain/origin/origin-place.js";
import { STATION_CATALOG } from "../../catalog/station-catalog.js";

export class FakeOriginPlaceProvider implements OriginPlaceProvider {
  async search(query: string) {
    const normalized = query.replace(/\s+/gu, "").toLowerCase();
    return {
      status: "ok" as const,
      places: STATION_CATALOG
        .filter((place) => place.name.replace(/\s+/gu, "").toLowerCase().includes(normalized))
        .map((place) => ({ id: place.id, name: place.name, address: "검증용 출발역", category: "지하철역" })),
    };
  }

  async resolve(place: OriginPlace) {
    const found = STATION_CATALOG.find((station) => station.id === place.id && station.name === place.name);
    return found ? { id: found.id, name: found.name, query: found.query } : null;
  }
}
