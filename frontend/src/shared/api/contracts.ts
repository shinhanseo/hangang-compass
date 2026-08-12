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
    level: "relaxed" | "normal" | "busy" | "very_busy";
    label: string;
    status: "fake_sample";
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
