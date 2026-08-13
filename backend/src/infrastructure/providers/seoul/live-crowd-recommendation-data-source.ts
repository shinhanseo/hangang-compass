import type { CrowdDataProvider } from "../../../application/ports/crowd-data-provider.js";
import type { RecommendationDataSource } from "../../../application/ports/recommendation-data-source.js";
import { selectArrivalCrowd, type CrowdLevel, type CrowdSnapshotResult } from "../../../domain/crowd/crowd-snapshot.js";
import type { Participant } from "../../../domain/meeting/meeting.js";
import { SEOUL_HANGANG_AREAS } from "../../catalog/seoul-hangang-area-catalog.js";

const CROWD_LABEL: Record<CrowdLevel, string> = {
  relaxed: "여유",
  normal: "보통",
  busy: "약간 붐빔",
  very_busy: "붐빔",
};

export class LiveCrowdRecommendationDataSource implements RecommendationDataSource {
  readonly #base: RecommendationDataSource;
  readonly #crowd: CrowdDataProvider;
  readonly #now: () => number;
  readonly #results = new Map<string, CrowdSnapshotResult>();

  constructor(base: RecommendationDataSource, crowd: CrowdDataProvider, now: () => number = Date.now) {
    this.#base = base;
    this.#crowd = crowd;
    this.#now = now;
  }

  meetingPointFor(parkId: string) { return this.#base.meetingPointFor(parkId); }
  experienceFor(parkId: string) { return this.#base.experienceFor(parkId); }
  travelData(participants: Participant[]) { return this.#base.travelData(participants); }
  routeFailureFor(participants: Participant[]) { return this.#base.routeFailureFor(participants); }

  async prepareFor(participants: Participant[], meetingAt: string): Promise<void> {
    await this.#base.prepareFor(participants, meetingAt);
    const results = await Promise.all(SEOUL_HANGANG_AREAS.map(async (area) => ({
      parkId: area.parkId,
      result: await this.#crowd.crowdFor(area.parkId, area.areaName),
    })));
    for (const item of results) this.#results.set(item.parkId, item.result);
  }

  stageFor(meetingAt: string) {
    const target = new Date(meetingAt).getTime();
    const difference = target - this.#now();
    return difference >= 0 && difference <= 12 * 60 * 60_000 ? "current" as const : "provisional" as const;
  }

  candidates(participants: Participant[], meetingAt: string) {
    return this.#base.candidates(participants, meetingAt).map((candidate) => {
      const crowd = this.arrivalCrowdFor(candidate.parkId, meetingAt);
      return {
        ...candidate,
        conditions: {
          ...candidate.conditions,
          crowd: crowd.level && crowd.freshness
            ? { value: crowd.level, freshness: crowd.freshness }
            : { value: "normal" as const, freshness: "unavailable" as const },
        },
      };
    });
  }

  arrivalCrowdFor(parkId: string, meetingAt: string) {
    const result = this.#results.get(parkId);
    if (!result || result.status === "unavailable") {
      return {
        level: null,
        label: "확인 불가",
        status: "unavailable" as const,
        referenceAt: null,
        observedAt: null,
        fetchedAt: result?.fetchedAt ?? null,
        freshness: null,
        source: "seoul_realtime_citydata" as const,
        reason: result?.reason ?? "network_error" as const,
      };
    }
    const selected = selectArrivalCrowd(result.snapshot, meetingAt);
    if (selected.status === "unavailable") {
      return {
        level: null,
        label: selected.reason === "outside_forecast_window" ? "예측 범위 밖" : "확인 불가",
        status: selected.reason === "outside_forecast_window" ? "outside_forecast_window" as const : "unavailable" as const,
        referenceAt: null,
        observedAt: result.snapshot.current.observedAt,
        fetchedAt: result.snapshot.fetchedAt,
        freshness: result.snapshot.current.freshness,
        source: selected.source,
        reason: selected.reason,
      };
    }
    return {
      level: selected.level,
      label: CROWD_LABEL[selected.level],
      status: selected.basis === "forecast" ? "live_forecast" as const : "live_current" as const,
      referenceAt: selected.referenceAt,
      observedAt: selected.observedAt,
      fetchedAt: selected.fetchedAt,
      freshness: selected.freshness,
      source: selected.source,
    };
  }

  currentCrowdFor(parkId: string) {
    const result = this.#results.get(parkId);
    if (!result || result.status === "unavailable") {
      return {
        level: null,
        label: "확인 불가",
        observedAt: null,
        fetchedAt: result?.fetchedAt ?? null,
        freshness: null,
        source: "seoul_realtime_citydata" as const,
      };
    }
    return {
      level: result.snapshot.current.level,
      label: CROWD_LABEL[result.snapshot.current.level],
      observedAt: result.snapshot.current.observedAt,
      fetchedAt: result.snapshot.fetchedAt,
      freshness: result.snapshot.current.freshness,
      source: result.snapshot.source,
    };
  }
}
