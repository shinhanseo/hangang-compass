import assert from "node:assert/strict";
import test from "node:test";
import type { CrowdDataProvider } from "../../../src/application/ports/crowd-data-provider.js";
import type { CrowdSnapshotResult } from "../../../src/domain/crowd/crowd-snapshot.js";
import { CachedCrowdDataProvider } from "../../../src/infrastructure/providers/cached-crowd-data-provider.js";

const result: CrowdSnapshotResult = {
  status: "unavailable",
  parkId: "yeouido",
  areaName: "여의도한강공원",
  fetchedAt: "2026-08-12T05:00:00.000Z",
  source: "seoul_realtime_citydata",
  reason: "network_error",
};

test("reuses a result for five minutes and refreshes after expiry", async () => {
  let now = 0;
  let calls = 0;
  const source: CrowdDataProvider = {
    crowdFor: async () => { calls += 1; return result; },
  };
  const cache = new CachedCrowdDataProvider(source, 5 * 60_000, () => now);
  await cache.crowdFor("yeouido", "여의도한강공원");
  now = 299_999;
  await cache.crowdFor("yeouido", "여의도한강공원");
  assert.equal(calls, 1);
  now = 300_000;
  await cache.crowdFor("yeouido", "여의도한강공원");
  assert.equal(calls, 2);
});

test("coalesces concurrent requests for the same park", async () => {
  let calls = 0;
  let resolve!: (value: CrowdSnapshotResult) => void;
  const pending = new Promise<CrowdSnapshotResult>((done) => { resolve = done; });
  const source: CrowdDataProvider = {
    crowdFor: async () => { calls += 1; return pending; },
  };
  const cache = new CachedCrowdDataProvider(source, 5 * 60_000);
  const first = cache.crowdFor("yeouido", "여의도한강공원");
  const second = cache.crowdFor("yeouido", "여의도한강공원");
  resolve(result);
  assert.deepEqual(await Promise.all([first, second]), [result, result]);
  assert.equal(calls, 1);
});
