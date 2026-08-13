import type {
  NearbyPlaceKind,
  NearbyPlaceProvider,
  NearbyPlaceRecommendation,
  NearbyPlaceResult,
  NearbyPlaceSection,
} from "../../../application/ports/nearby-place-provider.js";
import { meetingPointByParkId } from "../../catalog/meeting-point-catalog.js";
import { KakaoRouteEndpointResolver } from "./kakao-route-endpoint-resolver.js";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
type KakaoDocument = Record<string, unknown>;

const CATEGORY: Record<NearbyPlaceKind, { code: string; radius: number; size: number }> = {
  spot: { code: "AT4", radius: 2_500, size: 15 },
  food: { code: "FD6", radius: 1_500, size: 8 },
  cafe: { code: "CE7", radius: 1_500, size: 8 },
  store: { code: "CS2", radius: 1_500, size: 8 },
};

interface CacheEntry { result: NearbyPlaceResult; expiresAt: number }

export class KakaoNearbyPlaceProvider implements NearbyPlaceProvider {
  readonly #apiKey: string;
  readonly #fetcher: FetchLike;
  readonly #timeoutMs: number;
  readonly #cacheTtlMs: number;
  readonly #now: () => number;
  readonly #resolver: KakaoRouteEndpointResolver;
  readonly #cache = new Map<string, CacheEntry>();
  readonly #inFlight = new Map<string, Promise<NearbyPlaceResult>>();

  constructor(options: {
    apiKey: string;
    fetcher?: FetchLike;
    requestTimeoutMs?: number;
    cacheTtlMs?: number;
    now?: () => number;
  }) {
    if (!options.apiKey) throw new Error("kakao_api_key_required");
    this.#apiKey = options.apiKey;
    this.#fetcher = options.fetcher ?? fetch;
    this.#timeoutMs = options.requestTimeoutMs ?? 5_000;
    this.#cacheTtlMs = options.cacheTtlMs ?? 30 * 60_000;
    this.#now = options.now ?? Date.now;
    this.#resolver = new KakaoRouteEndpointResolver({
      apiKey: options.apiKey,
      fetcher: this.#fetcher,
      requestTimeoutMs: this.#timeoutMs,
    });
  }

  async placesNear(parkId: string): Promise<NearbyPlaceResult> {
    const cached = this.#cache.get(parkId);
    if (cached && cached.expiresAt > this.#now()) return cached.result;
    const pending = this.#inFlight.get(parkId);
    if (pending) return pending;
    const request = this.#load(parkId).then((result) => {
      this.#cache.set(parkId, {
        result,
        expiresAt: this.#now() + (result.status === "available" ? this.#cacheTtlMs : 30_000),
      });
      return result;
    }).finally(() => this.#inFlight.delete(parkId));
    this.#inFlight.set(parkId, request);
    return request;
  }

  async #load(parkId: string): Promise<NearbyPlaceResult> {
    const point = meetingPointByParkId(parkId);
    if (!point) return { status: "unavailable" };
    try {
      const coordinate = await this.#resolver.resolve({
        id: point.parkId,
        name: point.candidateName,
        query: point.poiQuery,
        officialAddress: point.officialAddress,
      });
      if (!coordinate) return { status: "unavailable" };
      const kinds: readonly NearbyPlaceKind[] = ["spot", "food", "cafe", "store"];
      const settled = await Promise.allSettled(kinds.map((kind) => this.#category(kind, coordinate)));
      const sections = kinds.map((kind, index): NearbyPlaceSection => {
        const result = settled[index];
        return result?.status === "fulfilled"
          ? { kind, status: "available", places: selectPlaces(kind, result.value, point.parkName, point.candidateName) }
          : { kind, status: "unavailable", places: [] };
      });
      return sections.every((section) => section.status === "unavailable")
        ? { status: "unavailable" }
        : { status: "available", parkId, fetchedAt: new Date(this.#now()).toISOString(), source: "kakao_local", sections };
    } catch {
      return { status: "unavailable" };
    }
  }

  async #category(kind: NearbyPlaceKind, coordinate: { x: string; y: string }): Promise<NearbyPlaceRecommendation[]> {
    const config = CATEGORY[kind];
    const url = new URL("https://dapi.kakao.com/v2/local/search/category.json");
    const parameters: Array<[string, string]> = [
      ["category_group_code", config.code], ["x", coordinate.x], ["y", coordinate.y],
      ["radius", String(config.radius)], ["sort", "distance"], ["size", String(config.size)],
    ];
    for (const [name, value] of parameters) url.searchParams.set(name, value);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await this.#fetcher(url, {
        signal: controller.signal,
        headers: { Authorization: `KakaoAK ${this.#apiKey}` },
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error("kakao_nearby_search_failed");
      return documents(body).flatMap(place);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function documents(body: unknown): KakaoDocument[] {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>).documents : null;
  return Array.isArray(value) ? value.filter((item): item is KakaoDocument => Boolean(item) && typeof item === "object") : [];
}

function string(document: KakaoDocument, key: string): string {
  return typeof document[key] === "string" ? document[key] : "";
}

function place(document: KakaoDocument): NearbyPlaceRecommendation[] {
  const id = string(document, "id");
  const name = string(document, "place_name");
  const url = string(document, "place_url").replace(/^http:/u, "https:");
  const distanceMeters = Number(string(document, "distance"));
  const category = string(document, "category_name").split(" > ").map((value) => value.trim()).filter(Boolean).at(-1) ?? "장소";
  if (!id || !name || !Number.isFinite(distanceMeters) || distanceMeters < 0 || !/^https:\/\/place\.map\.kakao\.com\/[0-9]+$/u.test(url)) return [];
  return [{
    id,
    name,
    category,
    address: string(document, "road_address_name") || string(document, "address_name"),
    distanceMeters,
    kakaoMapUrl: url,
  }];
}

function selectPlaces(kind: NearbyPlaceKind, places: NearbyPlaceRecommendation[], parkName: string, candidateName: string) {
  const filtered = places.filter((item) => item.name !== candidateName && item.name !== parkName);
  if (kind !== "spot") return filtered.slice(0, 2);
  const categories = new Set<string>();
  const selected: NearbyPlaceRecommendation[] = [];
  for (const item of filtered) {
    if (categories.has(item.category)) continue;
    categories.add(item.category);
    selected.push(item);
    if (selected.length === 3) break;
  }
  return selected;
}
