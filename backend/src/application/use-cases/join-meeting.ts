import { buildRecommendationView } from "../services/build-recommendation-view.js";
import type { CapabilityTokenService } from "../ports/capability-token-service.js";
import type { MeetingRepository } from "../ports/meeting-repository.js";
import type { RecommendationDataSource } from "../ports/recommendation-data-source.js";
import type { OriginPlaceProvider } from "../ports/origin-place-provider.js";
import { addMeetingParticipant } from "../services/add-meeting-participant.js";

export interface JoinMeetingInput {
  inviteToken: string;
  alias: string;
  originPlaceId: string;
  originPlaceName: string;
  destinationPlaceId?: string;
  destinationPlaceName?: string;
}

export async function joinMeeting(
  repository: MeetingRepository,
  tokens: CapabilityTokenService,
  recommendations: RecommendationDataSource,
  origins: OriginPlaceProvider,
  input: JoinMeetingInput,
) {
  const meeting = repository.findByInviteTokenHash(tokens.hashCapability(input.inviteToken));
  if (!meeting || meeting.participants.length >= 8) {
    return null;
  }
  const participant = await addMeetingParticipant(meeting, tokens, origins, { ...input, role: "guest" });
  if (!participant) return null;
  meeting.participants.push(participant);
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
