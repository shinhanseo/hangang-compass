import { toHostMeetingView } from "../services/build-recommendation-view.js";
import type { CapabilityTokenService } from "../ports/capability-token-service.js";
import type { MeetingRepository } from "../ports/meeting-repository.js";
import type { RecommendationDataSource } from "../ports/recommendation-data-source.js";
import { isAuthorizedHost } from "../services/authorize-host.js";

export async function getHostMeeting(
  repository: MeetingRepository,
  tokens: CapabilityTokenService,
  recommendations: RecommendationDataSource,
  meetingId: string,
  hostToken: string | undefined,
) {
  const meeting = await repository.findById(meetingId);
  if (!isAuthorizedHost(meeting, tokens, hostToken)) return null;
  return toHostMeetingView(meeting, recommendations, repository);
}
