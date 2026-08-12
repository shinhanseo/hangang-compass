import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import type { Meeting } from "../../../src/domain/meeting/meeting.ts";
import { SqliteMeetingRepository } from "../../../src/infrastructure/persistence/sqlite-meeting-repository.ts";

function meeting(overrides: Partial<Meeting> = {}): Meeting {
  return {
    id: "meeting-1",
    createdAt: "2099-01-01T00:00:00.000Z",
    meetingAt: "2099-01-02T12:00:00.000Z",
    travelPattern: "individual_round_trip",
    sharedOrigin: null,
    inviteTokenHashes: ["invite-hash"],
    hostTokenHashes: ["host-hash"],
    participants: [],
    confirmedParkId: null,
    ...overrides,
  };
}

test("SQLite repository survives reopening without storing capability originals", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "hangang-meetings-"));
  const path = join(directory, "meetings.sqlite");
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const first = new SqliteMeetingRepository(path);
  await first.save(meeting());
  first.close();

  const reopened = new SqliteMeetingRepository(path);
  context.after(() => reopened.close());
  assert.equal((await reopened.findById("meeting-1"))?.meetingAt, "2099-01-02T12:00:00.000Z");
  assert.equal((await reopened.findByInviteTokenHash("invite-hash"))?.id, "meeting-1");
  assert.equal(await reopened.findByInviteTokenHash("invite-token-original"), undefined);
});

test("SQLite repository removes drafts after the approved seven-day retention", async (context) => {
  const repository = new SqliteMeetingRepository(":memory:");
  context.after(() => repository.close());
  await repository.save(meeting({ createdAt: "2099-01-01T00:00:00.000Z" }));
  assert.equal(repository.deleteExpired(new Date("2099-01-08T00:00:00.001Z")), 1);
  assert.equal(await repository.findById("meeting-1"), undefined);
});

test("confirming a meeting extends retention through one day after its time", async (context) => {
  const repository = new SqliteMeetingRepository(":memory:");
  context.after(() => repository.close());
  await repository.save(meeting({
    createdAt: "2099-01-01T00:00:00.000Z",
    meetingAt: "2099-01-20T12:00:00.000Z",
    confirmedParkId: "yeouido",
  }));
  assert.equal(repository.deleteExpired(new Date("2099-01-21T11:59:59.999Z")), 0);
  assert.equal(repository.deleteExpired(new Date("2099-01-21T12:00:00.000Z")), 1);
});
