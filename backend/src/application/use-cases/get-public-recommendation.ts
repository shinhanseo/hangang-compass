import { buildRecommendationView } from "../services/build-recommendation-view.js";
import type { CapabilityTokenService } from "../ports/capability-token-service.js";
import type { MeetingRepository } from "../ports/meeting-repository.js";
import type { RecommendationDataSource } from "../ports/recommendation-data-source.js";

export async function getPublicRecommendation(
  repository: MeetingRepository,
  tokens: CapabilityTokenService,
  recommendations: RecommendationDataSource,
  inviteToken: string,
) {
  const meeting = await repository.findByInviteTokenHash(tokens.hashCapability(inviteToken));
  if (!meeting || meeting.participants.length < 2) return null;
  const result = await buildRecommendationView(meeting, recommendations, repository);
  if (!result) return null;
  return {
    ...result,
    recommended: { ...result.recommended, participantTimes: [] },
    alternatives: [
      { ...result.alternatives[0], participantTimes: [] },
      { ...result.alternatives[1], participantTimes: [] },
    ],
  };
}
