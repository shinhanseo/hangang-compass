import type { CapabilityTokenService } from "../ports/capability-token-service.js";
import type { MeetingRepository } from "../ports/meeting-repository.js";
import { isAuthorizedHost } from "../services/authorize-host.js";

const MAX_ACTIVE_CAPABILITIES = 10;

export async function createHostRecoveryLink(
  repository: MeetingRepository,
  tokens: CapabilityTokenService,
  meetingId: string,
  currentHostToken: string | undefined,
) {
  const meeting = await repository.findById(meetingId);
  if (!isAuthorizedHost(meeting, tokens, currentHostToken)) return null;
  const hostToken = tokens.generateCapability();
  const inviteToken = tokens.generateCapability();
  meeting.hostTokenHashes = [...meeting.hostTokenHashes, tokens.hashCapability(hostToken)].slice(-MAX_ACTIVE_CAPABILITIES);
  meeting.inviteTokenHashes = [...meeting.inviteTokenHashes, tokens.hashCapability(inviteToken)].slice(-MAX_ACTIVE_CAPABILITIES);
  await repository.save(meeting);
  return {
    path: `/recover/${meeting.id}#host=${hostToken}&invite=${inviteToken}`,
  };
}
