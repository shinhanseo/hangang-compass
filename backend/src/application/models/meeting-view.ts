import type { TravelMetrics } from "../../domain/recommendation/recommendation.js";
import type { ParkExperience } from "../../domain/park/park-experience.js";
import type { TripMode } from "../../domain/meeting/meeting.js";

export type CandidateRole = "recommended" | "travel_alternative" | "experience_alternative";

export interface ParkResultView {
  role: CandidateRole;
  parkId: string;
  parkName: string;
  meetingPoint: string;
  travel: TravelMetrics;
  returnTravel: TravelMetrics | null;
  participantTimes: Array<{ alias: string; minutes: number; returnMinutes: number | null }>;
  arrivalCrowd: {
    level: "relaxed" | "normal" | "busy" | "very_busy" | null;
    label: string;
    status: "fake_sample" | "live_current" | "live_forecast" | "outside_forecast_window" | "unavailable";
    referenceAt: string | null;
    observedAt: string | null;
    fetchedAt: string | null;
    freshness: "fresh" | "stale" | null;
    source: "fake" | "seoul_realtime_citydata";
    reason?: string;
  };
  experience: Pick<ParkExperience, "summary" | "highlights" | "cautions" | "sourceUrl" | "verifiedAt">;
  selectionReason: string;
}

export interface RecommendationResultView {
  tripMode: TripMode;
  stage: "fake_provisional" | "live_provisional" | "live_current";
  recommended: ParkResultView;
  alternatives: [ParkResultView, ParkResultView];
  nearTie: boolean;
  explanation: string;
  notice: string;
  travelData: {
    source: "fake" | "kakao_public_transit";
    calculatedAt: string | null;
  };
}

export interface HostMeetingView {
  id: string;
  meetingAt: string;
  tripMode: TripMode;
  participantCount: number;
  participants: Array<{ alias: string }>;
  result: RecommendationResultView | null;
  recommendationStatus: "waiting_for_participants" | "ready" | "route_unavailable";
  confirmedParkId: string | null;
}

export interface PublicMeetingView {
  meetingAt: string;
  tripMode: TripMode;
  participantCount: number;
}
