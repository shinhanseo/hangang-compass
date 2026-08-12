import type { TravelMetrics } from "../../domain/recommendation/recommendation.js";
import type { ParkExperience } from "../../domain/park/park-experience.js";

export type CandidateRole = "recommended" | "travel_alternative" | "experience_alternative";

export interface ParkResultView {
  role: CandidateRole;
  parkId: string;
  parkName: string;
  meetingPoint: string;
  travel: TravelMetrics;
  participantTimes: Array<{ alias: string; minutes: number }>;
  arrivalCrowd: {
    level: "relaxed" | "normal" | "busy" | "very_busy";
    label: string;
    status: "fake_sample";
  };
  experience: Pick<ParkExperience, "summary" | "highlights" | "cautions" | "sourceUrl" | "verifiedAt">;
  selectionReason: string;
}

export interface RecommendationResultView {
  stage: "fake_provisional";
  recommended: ParkResultView;
  alternatives: [ParkResultView, ParkResultView];
  nearTie: boolean;
  explanation: string;
  notice: string;
}

export interface HostMeetingView {
  id: string;
  meetingAt: string;
  participantCount: number;
  participants: Array<{ alias: string }>;
  result: RecommendationResultView | null;
  confirmedParkId: string | null;
}

export interface PublicMeetingView {
  meetingAt: string;
  participantCount: number;
}
