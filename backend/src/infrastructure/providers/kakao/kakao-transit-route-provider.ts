import type { TransitRouteProvider } from "../../../application/ports/transit-route-provider.js";
import type { TransitEndpoint, TransitRouteResult } from "../../../domain/transit/transit-route.js";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
interface Coordinate { x: string; y: string }

export interface KakaoTransitRouteProviderOptions {
  apiKey: string;
  requestTimeoutMs?: number;
  fetcher?: FetchLike;
}

function normalized(value: string): string {
  return value.replace(/\s+/gu, "").toLowerCase();
}

function documents(body: unknown): Array<Record<string, unknown>> {
  if (!body || typeof body !== "object") return [];
  const value = (body as Record<string, unknown>).documents;
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object") : [];
}

function coordinate(document: Record<string, unknown> | undefined): Coordinate | null {
  return typeof document?.x === "string" && typeof document.y === "string"
    ? { x: document.x, y: document.y }
    : null;
}

function addressMatches(expected: string, document: Record<string, unknown>): boolean {
  const expectedAddress = normalized(expected);
  return [document.road_address_name, document.address_name]
    .filter((value): value is string => typeof value === "string")
    .some((value) => expectedAddress.includes(normalized(value)) || normalized(value).includes(expectedAddress));
}

function meetingPointScore(endpoint: TransitEndpoint, document: Record<string, unknown>): number {
  const placeName = typeof document.place_name === "string" ? normalized(document.place_name) : "";
  const expectedName = normalized(endpoint.name);
  let score = placeName === expectedName ? 8 : placeName.endsWith(expectedName) ? 6 : 0;
  if (endpoint.officialAddress && addressMatches(endpoint.officialAddress, document)) score += 4;
  return score;
}

function fastestRoute(body: unknown, calculatedAt: Date): TransitRouteResult | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  if (record.status !== "OK" || !Array.isArray(record.routes)) return null;
  const routes = record.routes
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .flatMap((route) => {
      const properties = route.properties;
      if (!properties || typeof properties !== "object") return [];
      const routeProperties = properties as Record<string, unknown>;
      return typeof routeProperties.totalTime === "number" ? [{ route, properties: routeProperties }] : [];
    })
    .sort((left, right) => (left.properties.totalTime as number) - (right.properties.totalTime as number));
  const fastest = routes[0];
  if (!fastest) return null;
  const steps = Array.isArray(fastest.route.steps) ? fastest.route.steps : [];
  const walkingSeconds = steps.reduce((total, step) => {
    if (!step || typeof step !== "object") return total;
    const properties = (step as Record<string, unknown>).properties;
    if (!properties || typeof properties !== "object") return total;
    const values = properties as Record<string, unknown>;
    return values.type === "WALKING" && typeof values.time === "number" ? total + values.time : total;
  }, 0);
  const fare = fastest.properties.fare;
  const fareValue = fare && typeof fare === "object" ? (fare as Record<string, unknown>).value : null;
  return {
    status: "available",
    route: {
      totalMinutes: Math.max(1, Math.round((fastest.properties.totalTime as number) / 60)),
      transfers: typeof fastest.properties.transfers === "number" ? fastest.properties.transfers : null,
      fareWon: typeof fareValue === "number" ? fareValue : null,
      walkingMinutes: Math.round(walkingSeconds / 60),
      calculatedAt: calculatedAt.toISOString(),
      source: "kakao_public_transit",
    },
  };
}

export class KakaoTransitRouteProvider implements TransitRouteProvider {
  readonly #apiKey: string;
  readonly #requestTimeoutMs: number;
  readonly #fetcher: FetchLike;
  readonly #coordinates = new Map<string, Coordinate | null>();

  constructor(options: KakaoTransitRouteProviderOptions) {
    if (!options.apiKey) throw new Error("kakao_api_key_required");
    this.#apiKey = options.apiKey;
    this.#requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
    this.#fetcher = options.fetcher ?? fetch;
  }

  async #json(url: URL): Promise<{ response: Response; body: unknown }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#requestTimeoutMs);
    try {
      const response = await this.#fetcher(url, {
        signal: controller.signal,
        headers: { Authorization: `KakaoAK ${this.#apiKey}` },
      });
      return { response, body: await response.json().catch(() => null) };
    } finally {
      clearTimeout(timeout);
    }
  }

  async #resolve(endpoint: TransitEndpoint, destination: boolean): Promise<Coordinate | null> {
    if (endpoint.coordinate) return endpoint.coordinate;
    const key = `${destination ? "destination" : "origin"}:${endpoint.id}`;
    if (this.#coordinates.has(key)) return this.#coordinates.get(key) ?? null;
    const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
    url.searchParams.set("query", endpoint.query);
    url.searchParams.set("size", destination ? "5" : "3");
    const keyword = await this.#json(url);
    const candidates = documents(keyword.body);
    const selected = destination
      ? candidates.map((document) => ({ document, score: meetingPointScore(endpoint, document) }))
          .sort((left, right) => right.score - left.score)[0]
      : candidates.map((document) => ({ document, score: typeof document.place_name === "string" && normalized(document.place_name).includes(normalized(endpoint.name)) ? 1 : 0 }))
          .sort((left, right) => right.score - left.score)[0];
    let resolved = keyword.response.ok && selected && selected.score > 0 ? coordinate(selected.document) : null;

    if (!resolved && destination && endpoint.officialAddress) {
      const addressUrl = new URL("https://dapi.kakao.com/v2/local/search/address.json");
      addressUrl.searchParams.set("query", endpoint.officialAddress);
      addressUrl.searchParams.set("size", "1");
      const address = await this.#json(addressUrl);
      resolved = address.response.ok ? coordinate(documents(address.body)[0]) : null;
    }
    if (resolved) this.#coordinates.set(key, resolved);
    return resolved;
  }

  async routeFor(origin: TransitEndpoint, destination: TransitEndpoint): Promise<TransitRouteResult> {
    try {
      const [start, end] = await Promise.all([
        this.#resolve(origin, false),
        this.#resolve(destination, true),
      ]);
      if (!start) return { status: "unavailable", reason: "origin_unresolved" };
      if (!end) return { status: "unavailable", reason: "destination_unresolved" };
      const url = new URL("https://dapi.kakao.com/v2/routing/publictraffic");
      url.searchParams.set("start_x", start.x);
      url.searchParams.set("start_y", start.y);
      url.searchParams.set("end_x", end.x);
      url.searchParams.set("end_y", end.y);
      url.searchParams.set("s_name", origin.name);
      url.searchParams.set("e_name", destination.name);
      const response = await this.#json(url);
      if (!response.response.ok) return { status: "unavailable", reason: "http_error" };
      const route = fastestRoute(response.body, new Date());
      if (route) return route;
      const status = response.body && typeof response.body === "object"
        ? (response.body as Record<string, unknown>).status
        : null;
      return { status: "unavailable", reason: status === "NO_RESULTS" ? "no_route" : "provider_error" };
    } catch (error) {
      return {
        status: "unavailable",
        reason: error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error",
      };
    }
  }
}
