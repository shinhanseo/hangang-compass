import type { TransitRouteProvider } from "../../../application/ports/transit-route-provider.js";
import type { TransitEndpoint, TransitRouteResult } from "../../../domain/transit/transit-route.js";
import { KakaoRouteEndpointResolver } from "./kakao-route-endpoint-resolver.js";

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export class KakaoDrivingRouteProvider implements TransitRouteProvider {
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
      const url = new URL("https://apis-navi.kakaomobility.com/v1/directions");
      url.searchParams.set("origin", `${start.x},${start.y}`);
      url.searchParams.set("destination", `${end.x},${end.y}`);
      url.searchParams.set("priority", "TIME");
      url.searchParams.set("summary", "true");
      const response = await this.#fetcher(url, { signal: controller.signal, headers: { Authorization: `KakaoAK ${this.#apiKey}` } });
      const body = await response.json().catch(() => null) as Record<string, unknown> | null;
      if (!response.ok) return { status: "unavailable", reason: "http_error" };
      const routes = Array.isArray(body?.routes) ? body.routes : [];
      const route = routes.find((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && item.result_code === 0);
      const summary = route?.summary && typeof route.summary === "object" ? route.summary as Record<string, unknown> : null;
      if (!summary || typeof summary.duration !== "number") return { status: "unavailable", reason: "no_route" };
      const fare = summary.fare && typeof summary.fare === "object" ? summary.fare as Record<string, unknown> : null;
      return { status: "available", route: {
        totalMinutes: Math.max(1, Math.round(summary.duration / 60)), transfers: null, fareWon: null, walkingMinutes: null,
        tollWon: typeof fare?.toll === "number" ? fare.toll : null,
        calculatedAt: new Date().toISOString(), source: "kakao_driving",
      } };
    } catch (error) {
      return { status: "unavailable", reason: error instanceof Error && error.name === "AbortError" ? "timeout" : "network_error" };
    } finally {
      clearTimeout(timeout);
    }
  }
}
