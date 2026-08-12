import type { CapabilityTokenService } from "../ports/capability-token-service.js";
import type { MeetingRepository } from "../ports/meeting-repository.js";

export function recoverHostAccess(
  repository: MeetingRepository,
  tokens: CapabilityTokenService,
  meetingId: string,
  hostToken: string,
  inviteToken: string,
) {
  const meeting = repository.findById(meetingId);
  if (!meeting) return null;
  const hostAllowed = meeting.hostTokenHashes.includes(tokens.hashCapability(hostToken));
  const inviteAllowed = meeting.inviteTokenHashes.includes(tokens.hashCapability(inviteToken));
  if (!hostAllowed || !inviteAllowed) return null;
  return { meetingAt: meeting.meetingAt, hostToken, inviteToken };
}
