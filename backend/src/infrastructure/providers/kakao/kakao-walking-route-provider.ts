import type { TransitRouteProvider } from "../../../application/ports/transit-route-provider.js";
import type { TransitEndpoint, TransitRouteResult } from "../../../domain/transit/transit-route.js";
import { KakaoRouteEndpointResolver } from "./kakao-route-endpoint-resolver.js";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export class KakaoWalkingRouteProvider implements TransitRouteProvider {
  readonly #apiKey: string;
  readonly #fetcher: FetchLike;
  readonly #timeoutMs: number;
  readonly #resolver: KakaoRouteEndpointResolver;

  constructor(options: { apiKey: string; fetcher?: FetchLike; requestTimeoutMs?: number }) {
    this.#apiKey = options.apiKey;
    this.#fetcher = options.fetcher ?? fetch;
    this.#timeoutMs = options.requestTimeoutMs ?? 10_000;
    this.#resolver = new KakaoRouteEndpointResolver(options);
  }

  async routeFor(origin: TransitEndpoint, destination: TransitEndpoint): Promise<TransitRouteResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const [start, end] = await Promise.all([this.#resolver.resolve(origin), this.#resolver.resolve(destination)]);
      if (!start) return { status: "unavailable", reason: "origin_unresolved" };
      if (!end) return { status: "unavailable", reason: "destination_unresolved" };
      const url = new URL("https://dapi.kakao.com/v2/routing/walk");
      url.searchParams.set("start_x", start.x); url.searchParams.set("start_y", start.y);
      url.searchParams.set("end_x", end.x); url.searchParams.set("end_y", end.y);
      url.searchParams.set("route_mode", "SHORTEST");
      const response = await this.#fetcher(url, { signal: controller.signal, headers: { Authorization: `KakaoAK ${this.#apiKey}` } });
      const body = await response.json().catch(() => null) as Record<string, unknown> | null;
      if (!response.ok) return { status: "unavailable", reason: "http_error" };
      const route = body?.route && typeof body.route === "object" ? body.route as Record<string, unknown> : null;
      const properties = route?.properties && typeof route.properties === "object" ? route.properties as Record<string, unknown> : null;
      if (body?.status !== "OK" || typeof properties?.totalTime !== "number") return { status: "unavailable", reason: "no_route" };
      const minutes = Math.max(1, Math.round(properties.totalTime / 60));
      return { status: "available", route: {
        totalMinutes: minutes, transfers: null, fareWon: null, walkingMinutes: minutes,
        calculatedAt: new Date().toISOString(), source: "kakao_walking",
      } };
    } catch (error) {
      return { status: "unavailable", reason: error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error" };
    } finally {
      clearTimeout(timeout);
    }
  }
}
