import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildRecommendationView } from "../../../src/application/services/build-recommendation-view.js";
import type { Meeting } from "../../../src/domain/meeting/meeting.js";
import { InMemoryMeetingRepository } from "../../../src/infrastructure/persistence/in-memory-meeting-repository.js";
import { SqliteMeetingRepository } from "../../../src/infrastructure/persistence/sqlite-meeting-repository.js";
import { FakeRecommendationDataSource } from "../../../src/infrastructure/providers/fake/fake-recommendation-data-source.js";

function meeting(): Meeting {
  return {
    id: "meeting-cache-test",
    createdAt: new Date().toISOString(),
    meetingAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    travelPattern: "individual_round_trip",
    sharedOrigin: null,
    inviteTokenHashes: ["invite-hash"],
    hostTokenHashes: ["host-hash"],
    confirmedParkId: null,
    participants: [
      { id: "p1", alias: "하나", origin: { placeId: "hongdae", placeName: "홍대입구역" }, destination: { placeId: "hongdae", placeName: "홍대입구역" } },
      { id: "p2", alias: "둘", origin: { placeId: "gangnam", placeName: "강남역" }, destination: { placeId: "gangnam", placeName: "강남역" } },
    ],
  };
}

class CountingRecommendations extends FakeRecommendationDataSource {
  prepares = 0;
  override async prepareFor(...args: Parameters<FakeRecommendationDataSource["prepareFor"]>) {
    this.prepares += 1;
    return super.prepareFor(...args);
  }
}

test("coalesces concurrent recommendation requests for the same participant revision", async () => {
  const repository = new InMemoryMeetingRepository();
  const value = meeting();
  await repository.save(value);
  const recommendations = new CountingRecommendations();
  const [first, second, third] = await Promise.all([
    buildRecommendationView(value, recommendations, repository),
    buildRecommendationView(value, recommendations, repository),
    buildRecommendationView(value, recommendations, repository),
  ]);
  assert.ok(first);
  assert.deepEqual(second, first);
  assert.deepEqual(third, first);
  assert.equal(recommendations.prepares, 1);
});

test("restores a recommendation from SQLite after the process repository is reopened", async () => {
  const directory = mkdtempSync(join(tmpdir(), "hangang-recommendation-cache-"));
  const path = join(directory, "meetings.sqlite");
  const value = meeting();
  const firstRepository = new SqliteMeetingRepository(path);
  await firstRepository.save(value);
  const firstRecommendations = new CountingRecommendations();
  const first = await buildRecommendationView(value, firstRecommendations, firstRepository);
  firstRepository.close();

  const reopened = new SqliteMeetingRepository(path);
  const secondRecommendations = new CountingRecommendations();
  const restored = await buildRecommendationView(value, secondRecommendations, reopened);
  reopened.close();
  assert.ok(first);
  assert.deepEqual(restored, first);
  assert.equal(firstRecommendations.prepares, 1);
  assert.equal(secondRecommendations.prepares, 0);
});
