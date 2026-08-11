import type { Participant } from "../../domain/meeting/meeting.js";
import type { CandidateInput } from "../../domain/recommendation/recommendation.js";

export interface StationView {
  id: string;
  name: string;
}

export interface RecommendationDataSource {
  stations(): readonly StationView[];
  hasStation(stationId: string): boolean;
  candidates(participants: Participant[]): CandidateInput[];
  meetingPointFor(parkId: string): string;
}
