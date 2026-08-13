import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";

import type { Meeting } from "../../src/domain/meeting/meeting.js";
import { PostgresMeetingRepository } from "../../src/infrastructure/persistence/postgres-meeting-repository.js";
import { FakeRecommendationDataSource } from "../../src/infrastructure/providers/fake/fake-recommendation-data-source.js";
import { buildRecommendationView } from "../../src/application/services/build-recommendation-view.js";

const databaseUrl = process.env.DATABASE_URL;

test("PostgreSQL repository persists and indexes a meeting", { skip: !databaseUrl }, async () => {
  assert.ok(databaseUrl);
  const id = `automated-check-${randomUUID()}`;
  const inviteTokenHash = createHash("sha256").update(randomUUID()).digest("hex");
  const meeting: Meeting = {
    id,
    createdAt: new Date().toISOString(),
    meetingAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
    travelPattern: "individual_round_trip",
    sharedOrigin: null,
    inviteTokenHashes: [inviteTokenHash],
    hostTokenHashes: [createHash("sha256").update(randomUUID()).digest("hex")],
    participants: [],
    confirmedParkId: null,
  };
  const repository = new PostgresMeetingRepository(databaseUrl);
  const cleanup = new Pool({ connectionString: databaseUrl, max: 1 });

  try {
    await repository.initialize();
    await repository.save(meeting);
    assert.equal((await repository.findById(id))?.meetingAt, meeting.meetingAt);
    assert.equal((await repository.findByInviteTokenHash(inviteTokenHash))?.id, id);
    meeting.participants = [
      { id: "p1", alias: "하나", origin: { placeId: "hongdae", placeName: "홍대입구역" }, destination: { placeId: "hongdae", placeName: "홍대입구역" } },
      { id: "p2", alias: "둘", origin: { placeId: "gangnam", placeName: "강남역" }, destination: { placeId: "gangnam", placeName: "강남역" } },
    ];
    await repository.save(meeting);
    const calculated = await buildRecommendationView(meeting, new FakeRecommendationDataSource(), repository);
    assert.ok(calculated);
    const reopened = new PostgresMeetingRepository(databaseUrl);
    await reopened.initialize();
    const restored = await reopened.recommendationView(id, "recommendation-v1:2:provisional", async () => {
      throw new Error("persistent_recommendation_cache_missed");
    });
    assert.deepEqual(restored, calculated);
    await reopened.close();
    assert.equal(await repository.deleteById(id), true);
    assert.equal(await repository.findById(id), undefined);
    assert.equal(await repository.findByInviteTokenHash(inviteTokenHash), undefined);
    assert.equal(Number((await cleanup.query("SELECT count(*) FROM recommendation_views WHERE meeting_id = $1", [id])).rows[0].count), 0);
  } finally {
    await cleanup.query("DELETE FROM meetings WHERE id = $1", [id]);
    await cleanup.end();
    await repository.close();
  }
});
