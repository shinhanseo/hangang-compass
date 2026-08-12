import type {
  OriginPlaceProvider,
  OriginPlaceSearchResult,
} from "../../../application/ports/origin-place-provider.js";
import type { OriginPlace, OriginPlaceSearchItem } from "../../../domain/origin/origin-place.js";
import type { TransitEndpoint } from "../../../domain/transit/transit-route.js";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
type KakaoDocument = Record<string, unknown>;

export interface KakaoOriginPlaceProviderOptions {
  apiKey: string;
  requestTimeoutMs?: number;
  cacheTtlMs?: number;
  fetcher?: FetchLike;
  now?: () => number;
}

interface SearchCacheEntry { result: OriginPlaceSearchResult; expiresAt: number }

function documents(body: unknown): KakaoDocument[] {
  if (!body || typeof body !== "object") return [];
  const value = (body as Record<string, unknown>).documents;
  return Array.isArray(value)
    ? value.filter((item): item is KakaoDocument => Boolean(item) && typeof item === "object")
    : [];
}

function text(document: KakaoDocument, key: string): string {
  return typeof document[key] === "string" ? document[key] : "";
}

function endpoint(document: KakaoDocument): TransitEndpoint | null {
  const id = text(document, "id");
  const name = text(document, "place_name");
  const x = text(document, "x");
  const y = text(document, "y");
  return id && name && x && y ? { id, name, query: name, coordinate: { x, y } } : null;
}

function item(document: KakaoDocument): OriginPlaceSearchItem | null {
  const resolved = endpoint(document);
  if (!resolved) return null;
  const categoryPath = text(document, "category_name").split(">").map((value) => value.trim()).filter(Boolean);
  return {
    id: resolved.id,
    name: resolved.name,
    address: text(document, "road_address_name") || text(document, "address_name"),
    category: text(document, "category_group_name") || categoryPath.at(-1) || "장소",
  };
}

export class KakaoOriginPlaceProvider implements OriginPlaceProvider {
  readonly #apiKey: string;
  readonly #requestTimeoutMs: number;
  readonly #cacheTtlMs: number;
  readonly #fetcher: FetchLike;
  readonly #now: () => number;
  readonly #searchCache = new Map<string, SearchCacheEntry>();
  readonly #resolved = new Map<string, TransitEndpoint>();

  constructor(options: KakaoOriginPlaceProviderOptions) {
    if (!options.apiKey) throw new Error("kakao_api_key_required");
    this.#apiKey = options.apiKey;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 5_000;
    this.#cacheTtlMs = options.cacheTtlMs ?? 10 * 60_000;
    this.#fetcher = options.fetcher ?? fetch;
    this.#now = options.now ?? Date.now;
  }

  async #request(query: string, size: number): Promise<{ ok: boolean; documents: KakaoDocument[] }> {
    const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
    url.searchParams.set("query", query);
    url.searchParams.set("size", String(size));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#requestTimeoutMs);
    try {
      const response = await this.#fetcher(url, {
        signal: controller.signal,
        headers: { Authorization: `KakaoAK ${this.#apiKey}` },
      });
      const body = await response.json().catch(() => null);
      return { ok: response.ok, documents: documents(body) };
    } finally {
      clearTimeout(timeout);
    }
  }

  async search(query: string): Promise<OriginPlaceSearchResult> {
    const normalized = query.trim().replace(/\s+/gu, " ");
    if (normalized.length < 2 || normalized.length > 50) return { status: "ok", places: [] };
    const cached = this.#searchCache.get(normalized);
    if (cached && cached.expiresAt > this.#now()) return cached.result;
    try {
      const response = await this.#request(normalized, 10);
      if (!response.ok) return { status: "unavailable" };
      const places = response.documents.flatMap((document) => {
        const place = item(document);
        const resolved = endpoint(document);
        if (!place || !resolved) return [];
        this.#resolved.set(place.id, resolved);
        return [place];
      });
      const result = { status: "ok" as const, places };
      this.#searchCache.set(normalized, { result, expiresAt: this.#now() + this.#cacheTtlMs });
      return result;
    } catch {
      return { status: "unavailable" };
    }
  }

  async resolve(place: OriginPlace): Promise<TransitEndpoint | null> {
    const cached = this.#resolved.get(place.id);
    if (cached?.name === place.name) return cached;
    try {
      const response = await this.#request(place.name, 15);
      if (!response.ok) return null;
      const resolved = response.documents
        .filter((document) => text(document, "id") === place.id && text(document, "place_name") === place.name)
        .map(endpoint)
        .find((value): value is TransitEndpoint => value !== null) ?? null;
      if (resolved) this.#resolved.set(place.id, resolved);
      return resolved;
    } catch {
      return null;
    }
  }
}
