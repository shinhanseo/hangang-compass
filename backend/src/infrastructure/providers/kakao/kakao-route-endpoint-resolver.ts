import type { TransitEndpoint } from "../../../domain/transit/transit-route.js";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
type Coordinate = { x: string; y: string };

function documents(body: unknown): Array<Record<string, unknown>> {
  const value = body && typeof body === "object" ? (body as Record<string, unknown>).documents : null;
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
}

function coordinate(document: Record<string, unknown> | undefined): Coordinate | null {
  return typeof document?.x === "string" && typeof document.y === "string" ? { x: document.x, y: document.y } : null;
}

export class KakaoRouteEndpointResolver {
  readonly #apiKey: string;
  readonly #fetcher: FetchLike;
  readonly #timeoutMs: number;
  readonly #cache = new Map<string, Coordinate | null>();

  constructor(options: { apiKey: string; fetcher?: FetchLike; requestTimeoutMs?: number }) {
    this.#apiKey = options.apiKey;
    this.#fetcher = options.fetcher ?? fetch;
    this.#timeoutMs = options.requestTimeoutMs ?? 5_000;
  }

  async #json(url: URL) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const response = await this.#fetcher(url, { signal: controller.signal, headers: { Authorization: `KakaoAK ${this.#apiKey}` } });
      return { ok: response.ok, body: await response.json().catch(() => null) };
    } finally {
      clearTimeout(timeout);
    }
  }

  async resolve(endpoint: TransitEndpoint): Promise<Coordinate | null> {
    if (endpoint.coordinate) return endpoint.coordinate;
    if (this.#cache.has(endpoint.id)) return this.#cache.get(endpoint.id) ?? null;
    const keywordUrl = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
    keywordUrl.searchParams.set("query", endpoint.query);
    keywordUrl.searchParams.set("size", "15");
    const keyword = await this.#json(keywordUrl);
    const exact = documents(keyword.body).find((document) => document.id === endpoint.id)
      ?? documents(keyword.body).find((document) => document.place_name === endpoint.name);
    let resolved = keyword.ok ? coordinate(exact) : null;
    if (!resolved && endpoint.officialAddress) {
      const addressUrl = new URL("https://dapi.kakao.com/v2/local/search/address.json");
      addressUrl.searchParams.set("query", endpoint.officialAddress);
      addressUrl.searchParams.set("size", "1");
      const address = await this.#json(addressUrl);
      resolved = address.ok ? coordinate(documents(address.body)[0]) : null;
    }
    if (resolved) this.#cache.set(endpoint.id, resolved);
    return resolved;
  }
}
