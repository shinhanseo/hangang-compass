import assert from "node:assert/strict";
import test from "node:test";

import { closePoll, resolveTiedPollRandomly, restartTiedPoll, tallyPoll } from "../../../src/domain/meeting/meeting-poll.ts";
import type { MeetingPoll } from "../../../src/domain/meeting/meeting.ts";

const tied: MeetingPoll = {
  round: 1,
  status: "open",
  candidateParkIds: ["a", "b", "c"],
  candidateLabels: [
    { parkId: "a", parkName: "A공원", recommended: true },
    { parkId: "b", parkName: "B공원", recommended: false },
    { parkId: "c", parkName: "C공원", recommended: false },
  ],
  votes: [{ participantId: "one", parkId: "a" }, { participantId: "two", parkId: "b" }],
  winnerParkId: null,
  resolution: null,
};

test("poll tallies one current vote per participant", () => {
  assert.deepEqual(tallyPoll(tied), [{ parkId: "a", count: 1 }, { parkId: "b", count: 1 }, { parkId: "c", count: 0 }]);
});

test("a tied poll can restart with only tied candidates", () => {
  const closed = closePoll(tied);
  assert.equal(closed?.status, "tied");
  assert.deepEqual(closed?.candidateParkIds, ["a", "b"]);
  const restarted = restartTiedPoll(closed!);
  assert.equal(restarted?.round, 2);
  assert.equal(restarted?.status, "open");
  assert.deepEqual(restarted?.votes, []);
});

test("a tied poll can be resolved by an explicit random selection", () => {
  const closed = closePoll(tied)!;
  const resolved = resolveTiedPollRandomly(closed, 1);
  assert.equal(resolved?.status, "completed");
  assert.equal(resolved?.winnerParkId, "b");
  assert.equal(resolved?.resolution, "random");
});
