import type { MeetingRepository } from "../../application/ports/meeting-repository.js";
import type { Meeting } from "../../domain/meeting/meeting.js";
import type { RecommendationResultView } from "../../application/models/meeting-view.js";

export class InMemoryMeetingRepository implements MeetingRepository {
  readonly #meetings = new Map<string, Meeting>();
  readonly #inviteIndex = new Map<string, string>();
  readonly #recommendations = new Map<string, RecommendationResultView>();
  readonly #recommendationRequests = new Map<string, Promise<RecommendationResultView | null>>();

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
    for (const key of this.#recommendations.keys()) if (key.startsWith(`${id}:`)) this.#recommendations.delete(key);
    return true;
  }

  async recommendationView(meetingId: string, revision: string, calculate: () => Promise<RecommendationResultView | null>) {
    const key = `${meetingId}:${revision}`;
    const cached = this.#recommendations.get(key);
    if (cached) return cached;
    const inFlight = this.#recommendationRequests.get(key);
    if (inFlight) return inFlight;
    const request = calculate().then((result) => {
      if (result) this.#recommendations.set(key, result);
      return result;
    }).finally(() => this.#recommendationRequests.delete(key));
    this.#recommendationRequests.set(key, request);
    return request;
  }
}
