import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { CapabilityTokenService } from "../../application/ports/capability-token-service.js";
import { PROPOSED_PRIVACY_POLICY } from "../../domain/privacy/privacy-policy.js";

export class NodeCapabilityTokenService implements CapabilityTokenService {
  generateId(): string {
    return randomUUID();
  }

  generateCapability(): string {
    return randomBytes(PROPOSED_PRIVACY_POLICY.tokenRandomBytes).toString("base64url");
  }

  hashCapability(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
