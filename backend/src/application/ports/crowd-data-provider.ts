import type { CrowdSnapshotResult } from "../../domain/crowd/crowd-snapshot.js";

export interface CrowdDataProvider {
  crowdFor(parkId: string, areaName: string, fetchedAt?: Date): Promise<CrowdSnapshotResult>;
}
