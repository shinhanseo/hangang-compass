export interface CapabilityTokenService {
  generateId(): string;
  generateCapability(): string;
  hashCapability(token: string): string;
}
