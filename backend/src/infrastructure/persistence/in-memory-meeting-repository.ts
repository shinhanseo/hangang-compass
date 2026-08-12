import type { MeetingRepository } from "../../application/ports/meeting-repository.js";
import type { Meeting } from "../../domain/meeting/meeting.js";

export class InMemoryMeetingRepository implements MeetingRepository {
  readonly #meetings = new Map<string, Meeting>();
  readonly #inviteIndex = new Map<string, string>();

  async save(meeting: Meeting): Promise<void> {
    this.#meetings.set(meeting.id, meeting);
    for (const inviteTokenHash of meeting.inviteTokenHashes) this.#inviteIndex.set(inviteTokenHash, meeting.id);
  }

  async findById(id: string): Promise<Meeting | undefined> {
    return this.#meetings.get(id);
  }

  async findByInviteTokenHash(inviteTokenHash: string): Promise<Meeting | undefined> {
    const id = this.#inviteIndex.get(inviteTokenHash);
    return id ? this.#meetings.get(id) : undefined;
  }

  async deleteById(id: string): Promise<boolean> {
    const meeting = this.#meetings.get(id);
    if (!meeting) return false;
    this.#meetings.delete(id);
    for (const hash of meeting.inviteTokenHashes) this.#inviteIndex.delete(hash);
    return true;
  }
}
