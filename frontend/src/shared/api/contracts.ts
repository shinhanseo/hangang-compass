export interface Station {
  id: string;
  name: string;
}

export interface ParkResult {
  parkId: string;
  parkName: string;
  meetingPoint: string;
  travel: { averageMinutes: number; maximumMinutes: number; rangeMinutes: number };
  participantTimes: Array<{ alias: string; minutes: number }>;
}

export interface RecommendationResult {
  recommended: ParkResult;
  alternative: ParkResult;
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
}
