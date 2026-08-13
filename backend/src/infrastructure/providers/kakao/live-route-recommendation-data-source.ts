import type { RecommendationDataSource } from "../../../application/ports/recommendation-data-source.js";
import type { OriginPlaceProvider } from "../../../application/ports/origin-place-provider.js";
import type { TransitRouteProvider } from "../../../application/ports/transit-route-provider.js";
import type { Participant } from "../../../domain/meeting/meeting.js";
import type { TransitRouteResult } from "../../../domain/transit/transit-route.js";
import { MEETING_POINT_CATALOG } from "../../catalog/meeting-point-catalog.js";
import { parkingPointByParkId } from "../../catalog/parking-point-catalog.js";

async function mapWithConcurrency<T>(items: T[], concurrency: number, mapper: (item: T) => Promise<void>) {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      await mapper(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
}

export class LiveRouteRecommendationDataSource implements RecommendationDataSource {
  readonly #base: RecommendationDataSource;
  readonly #routes: TransitRouteProvider;
  readonly #drivingRoutes?: TransitRouteProvider;
  readonly #walkingRoutes?: TransitRouteProvider;
  readonly #origins: OriginPlaceProvider;
  readonly #results = new Map<string, TransitRouteResult>();

  constructor(base: RecommendationDataSource, routes: TransitRouteProvider, origins: OriginPlaceProvider, options: { drivingRoutes?: TransitRouteProvider; walkingRoutes?: TransitRouteProvider } = {}) {
    this.#base = base;
    this.#routes = routes;
    this.#origins = origins;
    this.#drivingRoutes = options.drivingRoutes;
    this.#walkingRoutes = options.walkingRoutes;
  }

  stageFor(meetingAt: string) { return this.#base.stageFor(meetingAt); }
  meetingPointFor(parkId: string) { return this.#base.meetingPointFor(parkId); }
  experienceFor(parkId: string) { return this.#base.experienceFor(parkId); }
  arrivalCrowdFor(parkId: string, meetingAt: string) { return this.#base.arrivalCrowdFor(parkId, meetingAt); }
  currentCrowdFor(parkId: string) { return this.#base.currentCrowdFor(parkId); }

  async prepareFor(participants: Participant[], meetingAt: string): Promise<void> {
    await this.#base.prepareFor(participants, meetingAt);
    const uniqueOrigins = [...new Map(participants.map((participant) => [
      `${participant.travelMode ?? "public_transit"}:${participant.origin.placeId}`,
      { id: participant.origin.placeId, name: participant.origin.placeName, travelMode: participant.travelMode ?? "public_transit" },
    ])).values()];
    const resolvedOrigins = new Map<string, Awaited<ReturnType<OriginPlaceProvider["resolve"]>>>((await Promise.all(uniqueOrigins.map(async (origin) => [
      `${origin.travelMode}:${origin.id}`,
      await this.#origins.resolve(origin),
    ] as const))).filter((entry) => entry[1] !== null));
    const tasks = uniqueOrigins.flatMap((origin) =>
      MEETING_POINT_CATALOG.map((point) => ({ origin, point })));
    await mapWithConcurrency(tasks, 4, async ({ origin, point }) => {
      const modeKey = `${origin.travelMode}:${origin.id}`;
      const modeResolvedOrigin = resolvedOrigins.get(modeKey);
      if (!modeResolvedOrigin) return;
      if (origin.travelMode === "car") {
        const parking = parkingPointByParkId(point.parkId);
        if (!parking || !this.#drivingRoutes || !this.#walkingRoutes) return;
        const parkingEndpoint = { id: parking.placeId, name: parking.name, query: parking.name, officialAddress: parking.address };
        const meetingEndpoint = { id: point.parkId, name: point.candidateName, query: point.poiQuery, officialAddress: point.officialAddress };
        const [drive, walk] = await Promise.all([
          this.#drivingRoutes.routeFor(modeResolvedOrigin, parkingEndpoint),
          this.#walkingRoutes.routeFor(parkingEndpoint, meetingEndpoint),
        ]);
        this.#results.set(`outbound:car:${origin.id}:${point.parkId}`, combineCarRoute(drive, walk));
        return;
      }
      const result = await this.#routes.routeFor(
        modeResolvedOrigin,
        { id: point.parkId, name: point.candidateName, query: point.poiQuery, officialAddress: point.officialAddress },
      );
      this.#results.set(`outbound:public_transit:${origin.id}:${point.parkId}`, result);
    });
    const uniqueDestinations = [...new Map(participants.flatMap((participant) => participant.destination ? [[
      `${participant.travelMode ?? "public_transit"}:${participant.destination.placeId}`,
      { id: participant.destination.placeId, name: participant.destination.placeName, travelMode: participant.travelMode ?? "public_transit" },
    ] as const] : [])).values()];
    const resolvedDestinations = new Map<string, Awaited<ReturnType<OriginPlaceProvider["resolve"]>>>((await Promise.all(uniqueDestinations.map(async (destination) => [
      `${destination.travelMode}:${destination.id}`,
      await this.#origins.resolve(destination),
    ] as const))).filter((entry) => entry[1] !== null));
    const returnTasks = uniqueDestinations.flatMap((destination) =>
      MEETING_POINT_CATALOG.map((point) => ({ destination, point })));
    await mapWithConcurrency(returnTasks, 4, async ({ destination, point }) => {
      const resolvedDestination = resolvedDestinations.get(`${destination.travelMode}:${destination.id}`);
      if (!resolvedDestination) return;
      if (destination.travelMode === "car") {
        const parking = parkingPointByParkId(point.parkId);
        if (!parking || !this.#drivingRoutes || !this.#walkingRoutes) return;
        const parkingEndpoint = { id: parking.placeId, name: parking.name, query: parking.name, officialAddress: parking.address };
        const meetingEndpoint = { id: point.parkId, name: point.candidateName, query: point.poiQuery, officialAddress: point.officialAddress };
        const [walk, drive] = await Promise.all([
          this.#walkingRoutes.routeFor(meetingEndpoint, parkingEndpoint),
          this.#drivingRoutes.routeFor(parkingEndpoint, resolvedDestination),
        ]);
        this.#results.set(`return:car:${destination.id}:${point.parkId}`, combineCarRoute(drive, walk));
        return;
      }
      const result = await this.#routes.routeFor(
        { id: point.parkId, name: point.candidateName, query: point.poiQuery, officialAddress: point.officialAddress },
        resolvedDestination,
      );
      this.#results.set(`return:public_transit:${destination.id}:${point.parkId}`, result);
    });
  }

  candidates(participants: Participant[], meetingAt: string) {
    return this.#base.candidates(participants, meetingAt).map((candidate) => ({
      ...candidate,
      routes: participants.map((participant) => {
        const mode = participant.travelMode ?? "public_transit";
        const result = this.#results.get(`outbound:${mode}:${participant.origin.placeId}:${candidate.parkId}`);
        return {
          participantId: participant.id,
          minutes: result?.status === "available" ? result.route.totalMinutes : null,
        };
      }),
      returnRoutes: participants.map((participant) => {
        const mode = participant.travelMode ?? "public_transit";
        const result = participant.destination
          ? this.#results.get(`return:${mode}:${participant.destination.placeId}:${candidate.parkId}`)
          : undefined;
        return {
          participantId: participant.id,
          minutes: result?.status === "available" ? result.route.totalMinutes : null,
        };
      }),
    }));
  }

  travelData(participants: Participant[]) {
    const routeKeys = new Set(participants.flatMap((participant) => [
      `outbound:${participant.travelMode ?? "public_transit"}:${participant.origin.placeId}`,
      ...(participant.destination ? [`return:${participant.travelMode ?? "public_transit"}:${participant.destination.placeId}`] : []),
    ]));
    const available = [...this.#results.entries()].flatMap(([key, result]) =>
      [...routeKeys].some((prefix) => key.startsWith(`${prefix}:`)) && result.status === "available"
        ? [result.route.calculatedAt]
        : []);
    const modes = new Set(participants.map((participant) => participant.travelMode ?? "public_transit"));
    return {
      source: modes.size > 1 ? "kakao_mixed" as const : modes.has("car") ? "kakao_car" as const : "kakao_public_transit" as const,
      calculatedAt: available.sort().at(0) ?? null,
    };
  }

  routeFailureFor(participants: Participant[]) {
    const relevantIds = new Set(participants.flatMap((participant) => [
      participant.origin.placeId,
      ...(participant.destination ? [participant.destination.placeId] : []),
    ]));
    const reasons = [...this.#results.entries()].flatMap(([key, result]) =>
      [...relevantIds].some((id) => key.includes(`:${id}:`)) && result.status === "unavailable" ? [result.reason] : []);
    if (reasons.includes("quota_exceeded")) return "quota_exceeded" as const;
    if (reasons.includes("quota_guard")) return "quota_guard" as const;
    return reasons.length > 0 ? "route_unavailable" as const : null;
  }
}

function combineCarRoute(drive: TransitRouteResult, walk: TransitRouteResult): TransitRouteResult {
  if (drive.status !== "available") return drive;
  if (walk.status !== "available") return walk;
  return { status: "available", route: {
    totalMinutes: drive.route.totalMinutes + walk.route.totalMinutes,
    transfers: null,
    fareWon: null,
    walkingMinutes: walk.route.totalMinutes,
    parkingWalkMinutes: walk.route.totalMinutes,
    tollWon: drive.route.tollWon ?? null,
    calculatedAt: [drive.route.calculatedAt, walk.route.calculatedAt].sort()[0]!,
    source: "kakao_car_with_parking",
  } };
}
