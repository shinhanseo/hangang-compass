import type { CapabilityTokenService } from "../ports/capability-token-service.js";
import type { MeetingRepository } from "../ports/meeting-repository.js";

export function getPublicMeeting(
  repository: MeetingRepository,
  tokens: CapabilityTokenService,
  inviteToken: string,
) {
  const meeting = repository.findByInviteTokenHash(tokens.hashCapability(inviteToken));
  return meeting ? {
    meetingAt: meeting.meetingAt,
    participantCount: meeting.participants.length,
  } : null;
}
