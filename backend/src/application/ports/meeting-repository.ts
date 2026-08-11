import type { Meeting } from "../../domain/meeting/meeting.js";

export interface MeetingRepository {
  save(meeting: Meeting): void;
  findById(id: string): Meeting | undefined;
  findByInviteTokenHash(inviteTokenHash: string): Meeting | undefined;
}
