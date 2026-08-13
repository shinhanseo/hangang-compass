import type { Meeting } from "../../domain/meeting/meeting.js";
import type { CapabilityTokenService } from "../ports/capability-token-service.js";

export function authorizedParticipantId(
  meeting: Meeting,
  tokens: CapabilityTokenService,
  participantToken: string | undefined,
): string | undefined {
  if (!participantToken) return undefined;
  const hash = tokens.hashCapability(participantToken);
  return meeting.participants.find((participant) =>
    participant.capabilityTokenHash === hash || participant.resumeTokenHash === hash
  )?.id;
}
