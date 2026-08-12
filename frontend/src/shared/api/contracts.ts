export interface OriginPlace {
  id: string;
  name: string;
  address: string;
  category: string;
}

export interface ParkResult {
  role: "recommended" | "travel_alternative" | "experience_alternative";
  parkId: string;
  parkName: string;
  meetingPoint: string;
  travel: { averageMinutes: number; maximumMinutes: number; rangeMinutes: number };
  returnTravel: { averageMinutes: number; maximumMinutes: number; rangeMinutes: number } | null;
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
  experience: {
    summary: string;
    highlights: string[];
    cautions: string[];
    sourceUrl: string;
    verifiedAt: string;
  };
  selectionReason: string;
}

export interface RecommendationResult {
  travelPattern: "shared_origin" | "individual_round_trip";
  travelModes: { publicTransit: number; car: number };
  stage: "fake_provisional" | "live_provisional" | "live_current";
  recommended: ParkResult;
  alternatives: [ParkResult, ParkResult];
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
  nearTie: boolean;
  travelData: {
    source: "fake" | "kakao_public_transit" | "kakao_car" | "kakao_mixed";
    calculatedAt: string | null;
  };
}

export interface MeetingPoll {
  round: number;
  status: "open" | "tied" | "completed";
  candidateParkIds: string[];
  candidateLabels: Array<{ parkId: string; parkName: string; recommended: boolean }>;
  tally: Array<{ parkId: string; count: number }>;
  eligibleCount: number;
  votedCount: number;
  myVoteParkId: string | null;
  canVote: boolean;
  winnerParkId: string | null;
  resolution: "vote" | "random" | null;
}

export interface HostMeeting {
  id: string;
  meetingAt: string;
  travelPattern: "shared_origin" | "individual_round_trip";
  sharedOriginName: string | null;
  hostParticipantSubmitted: boolean;
  participantCount: number;
  participants: Array<{ alias: string; isHost: boolean; travelMode: TravelMode }>;
  result: RecommendationResult | null;
  recommendationStatus: "waiting_for_participants" | "ready" | "route_unavailable";
  confirmedParkId: string | null;
  poll: MeetingPoll | null;
}
export type TravelMode = "public_transit" | "car";
