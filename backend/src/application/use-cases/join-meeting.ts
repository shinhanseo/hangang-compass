import { buildRecommendationView } from "../services/build-recommendation-view.js";
import type { CapabilityTokenService } from "../ports/capability-token-service.js";
import type { MeetingRepository } from "../ports/meeting-repository.js";
import type { RecommendationDataSource } from "../ports/recommendation-data-source.js";
import type { OriginPlaceProvider } from "../ports/origin-place-provider.js";

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
  const origin = await origins.resolve({ id: input.originPlaceId, name: input.originPlaceName });
  if (!origin) return null;
  const destination = meeting.tripMode === "round_trip"
    ? await origins.resolve({ id: input.destinationPlaceId ?? "", name: input.destinationPlaceName ?? "" })
    : null;
  if (meeting.tripMode === "round_trip" && !destination) return null;
  meeting.participants.push({
    id: tokens.generateId(),
    alias: input.alias,
    origin: { placeId: origin.id, placeName: origin.name },
    destination: destination ? { placeId: destination.id, placeName: destination.name } : null,
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
