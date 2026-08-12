import type { MeetingRepository } from "../../application/ports/meeting-repository.js";
import type { Meeting } from "../../domain/meeting/meeting.js";

export class InMemoryMeetingRepository implements MeetingRepository {
  readonly #meetings = new Map<string, Meeting>();
  readonly #inviteIndex = new Map<string, string>();

  save(meeting: Meeting): void {
    this.#meetings.set(meeting.id, meeting);
    for (const inviteTokenHash of meeting.inviteTokenHashes) this.#inviteIndex.set(inviteTokenHash, meeting.id);
  }

  findById(id: string): Meeting | undefined {
    return this.#meetings.get(id);
  }

  findByInviteTokenHash(inviteTokenHash: string): Meeting | undefined {
    const id = this.#inviteIndex.get(inviteTokenHash);
    return id ? this.#meetings.get(id) : undefined;
  }
}
