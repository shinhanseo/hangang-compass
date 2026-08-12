import type { CapabilityTokenService } from "../ports/capability-token-service.js";
import type { Meeting } from "../../domain/meeting/meeting.js";

export function isAuthorizedHost(
  meeting: Meeting | undefined,
  tokens: CapabilityTokenService,
  hostToken: string | undefined,
): meeting is Meeting {
  return Boolean(meeting && hostToken && meeting.hostTokenHashes.includes(tokens.hashCapability(hostToken)));
}
