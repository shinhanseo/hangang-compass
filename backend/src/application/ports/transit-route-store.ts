import type { TransitRouteResult } from "../../domain/transit/transit-route.js";

export interface TransitRouteUsage {
  day: string;
  provider: string;
  requests: number;
  successes: number;
  failures: number;
  quotaExceeded: number;
}

export interface TransitRouteStore {
  routeResult(
    provider: string,
    routeKey: string,
    options: { successTtlMs: number; failureTtlMs: number; maxRequestsPerDay: number; now: Date },
    calculate: () => Promise<TransitRouteResult>,
  ): Promise<TransitRouteResult>;
  usage(provider: string, day: string): Promise<TransitRouteUsage>;
  close(): Promise<void> | void;
}
