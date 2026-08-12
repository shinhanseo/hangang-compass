import type { Participant } from "../../domain/meeting/meeting.js";
import type { ParkExperience } from "../../domain/park/park-experience.js";
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
  experienceFor(parkId: string): ParkExperience;
  arrivalCrowdFor(parkId: string): {
    level: "relaxed" | "normal" | "busy" | "very_busy";
    label: string;
    status: "fake_sample";
  };
}
