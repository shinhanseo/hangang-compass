import { toHostMeetingView } from "../services/build-recommendation-view.js";
import { addMeetingParticipant } from "../services/add-meeting-participant.js";
import type { CapabilityTokenService } from "../ports/capability-token-service.js";
import type { MeetingRepository } from "../ports/meeting-repository.js";
import type { OriginPlaceProvider } from "../ports/origin-place-provider.js";
import type { RecommendationDataSource } from "../ports/recommendation-data-source.js";
import { isAuthorizedHost } from "../services/authorize-host.js";

export async function setHostParticipant(
  repository: MeetingRepository,
  tokens: CapabilityTokenService,
  recommendations: RecommendationDataSource,
  origins: OriginPlaceProvider,
  input: {
    meetingId: string;
    hostToken: string | undefined;
    alias: string;
    originPlaceId: string;
    originPlaceName: string;
    destinationPlaceId?: string;
    destinationPlaceName?: string;
  },
) {
  const meeting = await repository.findById(input.meetingId);
  if (!isAuthorizedHost(meeting, tokens, input.hostToken)) return null;
  if (meeting.participants.some((participant) => participant.role === "host")) return null;
  const participant = await addMeetingParticipant(meeting, tokens, origins, { ...input, role: "host" });
  if (!participant) return null;
  meeting.participants.push(participant);
  await repository.save(meeting);
  return toHostMeetingView(meeting, recommendations);
}
