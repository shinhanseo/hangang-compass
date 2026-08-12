import { buildRecommendationView } from "../services/build-recommendation-view.js";
import type { CapabilityTokenService } from "../ports/capability-token-service.js";
import type { MeetingRepository } from "../ports/meeting-repository.js";
import type { RecommendationDataSource } from "../ports/recommendation-data-source.js";

export interface JoinMeetingInput {
  inviteToken: string;
  alias: string;
  stationId: string;
}

export async function joinMeeting(
  repository: MeetingRepository,
  tokens: CapabilityTokenService,
  recommendations: RecommendationDataSource,
  input: JoinMeetingInput,
) {
  const meeting = repository.findByInviteTokenHash(tokens.hashCapability(input.inviteToken));
  if (!meeting || !recommendations.hasStation(input.stationId) || meeting.participants.length >= 8) {
    return null;
  }
  meeting.participants.push({
    id: tokens.generateId(),
    alias: input.alias,
    stationId: input.stationId,
  });
  repository.save(meeting);
  const result = await buildRecommendationView(meeting, recommendations);
  return {
    participantCount: meeting.participants.length,
    result,
    recommendationStatus: meeting.participants.length < 2
      ? "waiting_for_participants" as const
      : result ? "ready" as const : "route_unavailable" as const,
  };
}
