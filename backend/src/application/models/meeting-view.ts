import type { TravelMetrics } from "../../domain/recommendation/recommendation.js";

export interface ParkResultView {
  parkId: string;
  parkName: string;
  meetingPoint: string;
  travel: TravelMetrics;
  participantTimes: Array<{ alias: string; minutes: number }>;
}

export interface RecommendationResultView {
  stage: "fake_provisional";
  recommended: ParkResultView;
  alternative: ParkResultView;
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
}

export interface PublicMeetingView {
  meetingAt: string;
  participantCount: number;
}
