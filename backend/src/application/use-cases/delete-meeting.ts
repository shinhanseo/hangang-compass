import type { CapabilityTokenService } from "../ports/capability-token-service.js";
import type { MeetingRepository } from "../ports/meeting-repository.js";
import { isAuthorizedHost } from "../services/authorize-host.js";

export async function deleteMeeting(
  repository: MeetingRepository,
  tokens: CapabilityTokenService,
  meetingId: string,
  hostToken: string | undefined,
): Promise<boolean> {
  const meeting = await repository.findById(meetingId);
  if (!isAuthorizedHost(meeting, tokens, hostToken)) return false;
  return repository.deleteById(meetingId);
}
