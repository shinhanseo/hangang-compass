import type { TravelMetrics } from "../../domain/recommendation/recommendation.js";
import type { ParkExperience } from "../../domain/park/park-experience.js";
import type { TravelMode, TravelPattern } from "../../domain/meeting/meeting.js";

export type CandidateRole = "recommended" | "travel_alternative" | "experience_alternative";

export interface ParkResultView {
  role: CandidateRole;
  parkId: string;
  parkName: string;
  meetingPoint: string;
  travel: TravelMetrics;
  returnTravel: TravelMetrics | null;
  participantTimes: Array<{ alias: string; travelMode: TravelMode; minutes: number; returnMinutes: number | null }>;
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
  travelPattern: TravelPattern;
  travelModes: { publicTransit: number; car: number };
  stage: "fake_provisional" | "live_provisional" | "live_current";
  recommended: ParkResultView;
  alternatives: [ParkResultView, ParkResultView];
  nearTie: boolean;
  explanation: string;
  notice: string;
  refreshAt: string | null;
  crowdOverview: {
    basis: "arrival" | "current";
    referenceAt: string | null;
    parks: Array<{
      parkId: string;
      parkName: string;
      level: "relaxed" | "normal" | "busy" | "very_busy" | null;
      label: string;
      isRecommended: boolean;
    }>;
  };
  travelData: {
    source: "fake" | "kakao_public_transit" | "kakao_car" | "kakao_mixed";
    calculatedAt: string | null;
  };
}

export interface HostMeetingView {
  id: string;
  meetingAt: string;
  travelPattern: TravelPattern;
  sharedOriginName: string | null;
  hostParticipantSubmitted: boolean;
  participantCount: number;
  participants: Array<{ alias: string; isHost: boolean; travelMode: TravelMode }>;
  result: RecommendationResultView | null;
  recommendationStatus: "waiting_for_participants" | "ready" | "route_unavailable" | "route_quota_exceeded";
  confirmedParkId: string | null;
  poll: MeetingPollView | null;
}

export interface MeetingPollView {
  round: number;
  status: "open" | "tied" | "completed";
  candidateParkIds: string[];
  tally: Array<{ parkId: string; count: number }>;
  eligibleCount: number;
  votedCount: number;
  myVoteParkId: string | null;
  canVote: boolean;
  winnerParkId: string | null;
  resolution: "vote" | "random" | null;
}

export interface PublicMeetingView {
  meetingAt: string;
  travelPattern: TravelPattern;
  sharedOriginName: string | null;
  participantCount: number;
}
