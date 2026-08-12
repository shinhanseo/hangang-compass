export interface Station {
  id: string;
  name: string;
}

export interface ParkResult {
  role: "recommended" | "travel_alternative" | "experience_alternative";
  parkId: string;
  parkName: string;
  meetingPoint: string;
  travel: { averageMinutes: number; maximumMinutes: number; rangeMinutes: number };
  participantTimes: Array<{ alias: string; minutes: number }>;
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
  stage: "fake_provisional" | "live_provisional" | "live_current";
  recommended: ParkResult;
  alternatives: [ParkResult, ParkResult];
  explanation: string;
  notice: string;
  nearTie: boolean;
}

export interface HostMeeting {
  id: string;
  meetingAt: string;
  participantCount: number;
  participants: Array<{ alias: string }>;
  result: RecommendationResult | null;
  confirmedParkId: string | null;
}
