import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";

import type { Meeting } from "../../src/domain/meeting/meeting.js";
import { PostgresMeetingRepository } from "../../src/infrastructure/persistence/postgres-meeting-repository.js";

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
  } finally {
    await cleanup.query("DELETE FROM meetings WHERE id = $1", [id]);
    await cleanup.end();
    await repository.close();
  }
});
