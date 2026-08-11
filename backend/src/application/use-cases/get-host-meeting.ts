import { toHostMeetingView } from "../services/build-recommendation-view.js";
import type { CapabilityTokenService } from "../ports/capability-token-service.js";
import type { MeetingRepository } from "../ports/meeting-repository.js";
import type { RecommendationDataSource } from "../ports/recommendation-data-source.js";

export function getHostMeeting(
  repository: MeetingRepository,
  tokens: CapabilityTokenService,
  recommendations: RecommendationDataSource,
  meetingId: string,
  hostToken: string | undefined,
) {
  const meeting = repository.findById(meetingId);
  if (!meeting || !hostToken || tokens.hashCapability(hostToken) !== meeting.hostTokenHash) return null;
  return toHostMeetingView(meeting, recommendations);
}
