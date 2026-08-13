import type { Participant } from "../../domain/meeting/meeting.js";
import type { ParkExperience } from "../../domain/park/park-experience.js";
import type { CandidateInput } from "../../domain/recommendation/recommendation.js";
import type { CrowdLevel, CrowdUnavailableReason } from "../../domain/crowd/crowd-snapshot.js";
import type { RecommendationStage } from "../../domain/recommendation/recommendation.js";

export interface RecommendationDataSource {
  prepareFor(participants: Participant[], meetingAt: string): Promise<void>;
  stageFor(meetingAt: string): RecommendationStage;
  candidates(participants: Participant[], meetingAt: string): CandidateInput[];
  meetingPointFor(parkId: string): string;
  experienceFor(parkId: string): ParkExperience;
  travelData(participants: Participant[]): {
    source: "fake" | "kakao_public_transit" | "kakao_car" | "kakao_mixed";
    calculatedAt: string | null;
  };
  routeFailureFor(participants: Participant[]): "quota_exceeded" | "quota_guard" | "route_unavailable" | null;
  arrivalCrowdFor(parkId: string, meetingAt: string): {
    level: CrowdLevel | null;
    label: string;
    status: "fake_sample" | "live_current" | "live_forecast" | "outside_forecast_window" | "unavailable";
    referenceAt: string | null;
    observedAt: string | null;
    fetchedAt: string | null;
    freshness: "fresh" | "stale" | null;
    source: "fake" | "seoul_realtime_citydata";
    reason?: CrowdUnavailableReason | "outside_forecast_window" | "forecast_unavailable" | "invalid_target_time";
  };
  currentCrowdFor(parkId: string): {
    level: CrowdLevel | null;
    label: string;
    observedAt: string | null;
    fetchedAt: string | null;
    freshness: "fresh" | "stale" | null;
    source: "fake" | "seoul_realtime_citydata";
  };
}
