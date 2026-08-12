import type { TransitEndpoint, TransitRouteResult } from "../../domain/transit/transit-route.js";

export interface TransitRouteProvider {
  routeFor(origin: TransitEndpoint, destination: TransitEndpoint): Promise<TransitRouteResult>;
}
