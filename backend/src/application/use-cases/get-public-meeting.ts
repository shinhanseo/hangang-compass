import type { CapabilityTokenService } from "../ports/capability-token-service.js";
import type { MeetingRepository } from "../ports/meeting-repository.js";

export async function getPublicMeeting(
  repository: MeetingRepository,
  tokens: CapabilityTokenService,
  inviteToken: string,
) {
  const meeting = await repository.findByInviteTokenHash(tokens.hashCapability(inviteToken));
  return meeting ? {
    meetingAt: meeting.meetingAt,
    travelPattern: meeting.travelPattern,
    sharedOriginName: meeting.sharedOrigin?.placeName ?? null,
    participantCount: meeting.participants.length,
    confirmedParkId: meeting.confirmedParkId,
  } : null;
}
