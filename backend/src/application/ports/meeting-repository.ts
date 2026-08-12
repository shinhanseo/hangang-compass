import type { Meeting } from "../../domain/meeting/meeting.js";

export interface MeetingRepository {
  save(meeting: Meeting): Promise<void>;
  findById(id: string): Promise<Meeting | undefined>;
  findByInviteTokenHash(inviteTokenHash: string): Promise<Meeting | undefined>;
}
