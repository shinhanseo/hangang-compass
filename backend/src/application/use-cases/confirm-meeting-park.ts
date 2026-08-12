import { buildRecommendationView } from "../services/build-recommendation-view.js";
import type { CapabilityTokenService } from "../ports/capability-token-service.js";
import type { MeetingRepository } from "../ports/meeting-repository.js";
import type { RecommendationDataSource } from "../ports/recommendation-data-source.js";

export async function confirmMeetingPark(
  repository: MeetingRepository,
  tokens: CapabilityTokenService,
  recommendations: RecommendationDataSource,
  meetingId: string,
  hostToken: string | undefined,
  parkId: string,
) {
  const meeting = repository.findById(meetingId);
  if (!meeting || !hostToken || tokens.hashCapability(hostToken) !== meeting.hostTokenHash) return null;
  const result = await buildRecommendationView(meeting, recommendations);
  const candidates = result ? [result.recommended, ...result.alternatives] : [];
  const selected = candidates.find((candidate) => candidate.parkId === parkId);
  if (!selected) return null;
  meeting.confirmedParkId = selected.parkId;
  repository.save(meeting);
  return { confirmedParkId: selected.parkId, confirmedParkName: selected.parkName };
}
