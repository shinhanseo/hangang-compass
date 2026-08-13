import type { Meeting } from "../../domain/meeting/meeting.js";
import type { RecommendationResultView } from "../models/meeting-view.js";

export interface MeetingRepository {
  save(meeting: Meeting): Promise<void>;
  findById(id: string): Promise<Meeting | undefined>;
  findByInviteTokenHash(inviteTokenHash: string): Promise<Meeting | undefined>;
  deleteById(id: string): Promise<boolean>;
  recommendationView(
    meetingId: string,
    revision: string,
    calculate: () => Promise<RecommendationResultView | null>,
  ): Promise<RecommendationResultView | null>;
}
