import type { CapabilityTokenService } from "../ports/capability-token-service.js";
import type { MeetingRepository } from "../ports/meeting-repository.js";
import type { RecommendationDataSource } from "../ports/recommendation-data-source.js";
import { authorizedParticipantId } from "../services/authorize-participant.js";
import { buildRecommendationView } from "../services/build-recommendation-view.js";

export async function getParticipantSession(
  repository: MeetingRepository,
  tokens: CapabilityTokenService,
  recommendations: RecommendationDataSource,
  inviteToken: string,
  participantToken: string | undefined,
) {
  const meeting = await repository.findByInviteTokenHash(tokens.hashCapability(inviteToken));
  if (!meeting) return null;
  const submitted = Boolean(authorizedParticipantId(meeting, tokens, participantToken));
  if (!submitted) return { submitted: false as const };
  const result = await buildRecommendationView(meeting, recommendations);
  return {
    submitted: true as const,
    participantCount: meeting.participants.length,
    result,
    recommendationStatus: meeting.participants.length < 2
      ? "waiting_for_participants" as const
      : result ? "ready" as const : "route_unavailable" as const,
  };
}
