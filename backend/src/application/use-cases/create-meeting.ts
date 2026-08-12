import type { Meeting, TravelPattern } from "../../domain/meeting/meeting.js";
import { toHostMeetingView } from "../services/build-recommendation-view.js";
import type { CapabilityTokenService } from "../ports/capability-token-service.js";
import type { MeetingRepository } from "../ports/meeting-repository.js";
import type { RecommendationDataSource } from "../ports/recommendation-data-source.js";

export interface CreateMeetingDependencies {
  repository: MeetingRepository;
  tokens: CapabilityTokenService;
  recommendations: RecommendationDataSource;
}

export async function createMeeting(dependencies: CreateMeetingDependencies, meetingAt: string, travelPattern: TravelPattern) {
  const inviteToken = dependencies.tokens.generateCapability();
  const hostToken = dependencies.tokens.generateCapability();
  const meeting: Meeting = {
    id: dependencies.tokens.generateId(),
    meetingAt,
    travelPattern,
    sharedOrigin: null,
    inviteTokenHash: dependencies.tokens.hashCapability(inviteToken),
    hostTokenHash: dependencies.tokens.hashCapability(hostToken),
    participants: [],
    confirmedParkId: null,
  };
  dependencies.repository.save(meeting);
  return {
    meeting: await toHostMeetingView(meeting, dependencies.recommendations),
    inviteToken,
    hostToken,
  };
}
