import type { RecommendationDataSource } from "../../../application/ports/recommendation-data-source.js";
import type { TransitRouteProvider } from "../../../application/ports/transit-route-provider.js";
import type { Participant } from "../../../domain/meeting/meeting.js";
import type { TransitRouteResult } from "../../../domain/transit/transit-route.js";
import { MEETING_POINT_CATALOG } from "../../catalog/meeting-point-catalog.js";
import { stationById } from "../../catalog/station-catalog.js";

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
  readonly #results = new Map<string, TransitRouteResult>();

  constructor(base: RecommendationDataSource, routes: TransitRouteProvider) {
    this.#base = base;
    this.#routes = routes;
  }

  stations() { return this.#base.stations(); }
  hasStation(stationId: string) { return this.#base.hasStation(stationId); }
  stageFor(meetingAt: string) { return this.#base.stageFor(meetingAt); }
  meetingPointFor(parkId: string) { return this.#base.meetingPointFor(parkId); }
  experienceFor(parkId: string) { return this.#base.experienceFor(parkId); }
  arrivalCrowdFor(parkId: string, meetingAt: string) { return this.#base.arrivalCrowdFor(parkId, meetingAt); }

  async prepareFor(participants: Participant[], meetingAt: string): Promise<void> {
    await this.#base.prepareFor(participants, meetingAt);
    const uniqueStationIds = [...new Set(participants.map((participant) => participant.stationId))];
    const tasks = uniqueStationIds.flatMap((stationId) =>
      MEETING_POINT_CATALOG.map((point) => ({ stationId, point })));
    await mapWithConcurrency(tasks, 4, async ({ stationId, point }) => {
      const station = stationById(stationId);
      if (!station) return;
      const result = await this.#routes.routeFor(
        { id: station.id, name: station.name, query: station.query },
        { id: point.parkId, name: point.candidateName, query: point.poiQuery, officialAddress: point.officialAddress },
      );
      this.#results.set(`${stationId}:${point.parkId}`, result);
    });
  }

  candidates(participants: Participant[], meetingAt: string) {
    return this.#base.candidates(participants, meetingAt).map((candidate) => ({
      ...candidate,
      routes: participants.map((participant) => {
        const result = this.#results.get(`${participant.stationId}:${candidate.parkId}`);
        return {
          participantId: participant.id,
          minutes: result?.status === "available" ? result.route.totalMinutes : null,
        };
      }),
    }));
  }

  travelData(participants: Participant[]) {
    const stationIds = new Set(participants.map((participant) => participant.stationId));
    const available = [...this.#results.entries()].flatMap(([key, result]) =>
      stationIds.has(key.split(":", 1)[0]!) && result.status === "available"
        ? [result.route.calculatedAt]
        : []);
    return {
      source: "kakao_public_transit" as const,
      calculatedAt: available.sort().at(0) ?? null,
    };
  }
}
