import type { RecommendationDataSource } from "../../../application/ports/recommendation-data-source.js";
import type { OriginPlaceProvider } from "../../../application/ports/origin-place-provider.js";
import type { TransitRouteProvider } from "../../../application/ports/transit-route-provider.js";
import type { Participant } from "../../../domain/meeting/meeting.js";
import type { TransitRouteResult } from "../../../domain/transit/transit-route.js";
import { MEETING_POINT_CATALOG } from "../../catalog/meeting-point-catalog.js";

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
  readonly #origins: OriginPlaceProvider;
  readonly #results = new Map<string, TransitRouteResult>();

  constructor(base: RecommendationDataSource, routes: TransitRouteProvider, origins: OriginPlaceProvider) {
    this.#base = base;
    this.#routes = routes;
    this.#origins = origins;
  }

  stageFor(meetingAt: string) { return this.#base.stageFor(meetingAt); }
  meetingPointFor(parkId: string) { return this.#base.meetingPointFor(parkId); }
  experienceFor(parkId: string) { return this.#base.experienceFor(parkId); }
  arrivalCrowdFor(parkId: string, meetingAt: string) { return this.#base.arrivalCrowdFor(parkId, meetingAt); }

  async prepareFor(participants: Participant[], meetingAt: string): Promise<void> {
    await this.#base.prepareFor(participants, meetingAt);
    const uniqueOrigins = [...new Map(participants.map((participant) => [
      participant.origin.placeId,
      { id: participant.origin.placeId, name: participant.origin.placeName },
    ])).values()];
    const resolvedOrigins = new Map((await Promise.all(uniqueOrigins.map(async (origin) => [
      origin.id,
      await this.#origins.resolve(origin),
    ] as const))).filter((entry) => entry[1] !== null));
    const tasks = uniqueOrigins.flatMap((origin) =>
      MEETING_POINT_CATALOG.map((point) => ({ origin, point })));
    await mapWithConcurrency(tasks, 4, async ({ origin, point }) => {
      const resolvedOrigin = resolvedOrigins.get(origin.id);
      if (!resolvedOrigin) return;
      const result = await this.#routes.routeFor(
        resolvedOrigin,
        { id: point.parkId, name: point.candidateName, query: point.poiQuery, officialAddress: point.officialAddress },
      );
      this.#results.set(`${origin.id}:${point.parkId}`, result);
    });
  }

  candidates(participants: Participant[], meetingAt: string) {
    return this.#base.candidates(participants, meetingAt).map((candidate) => ({
      ...candidate,
      routes: participants.map((participant) => {
        const result = this.#results.get(`${participant.origin.placeId}:${candidate.parkId}`);
        return {
          participantId: participant.id,
          minutes: result?.status === "available" ? result.route.totalMinutes : null,
        };
      }),
    }));
  }

  travelData(participants: Participant[]) {
    const placeIds = new Set(participants.map((participant) => participant.origin.placeId));
    const available = [...this.#results.entries()].flatMap(([key, result]) =>
      placeIds.has(key.split(":", 1)[0]!) && result.status === "available"
        ? [result.route.calculatedAt]
        : []);
    return {
      source: "kakao_public_transit" as const,
      calculatedAt: available.sort().at(0) ?? null,
    };
  }
}
