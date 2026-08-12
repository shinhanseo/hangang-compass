import type { CapabilityTokenService } from "../ports/capability-token-service.js";
import type { MeetingRepository } from "../ports/meeting-repository.js";
import { isAuthorizedHost } from "../services/authorize-host.js";

export function getHostAccessSummary(
  repository: MeetingRepository,
  tokens: CapabilityTokenService,
  meetingId: string,
  hostToken: string | undefined,
) {
  const meeting = repository.findById(meetingId);
  return isAuthorizedHost(meeting, tokens, hostToken)
    ? { id: meeting.id, meetingAt: meeting.meetingAt }
    : null;
}
