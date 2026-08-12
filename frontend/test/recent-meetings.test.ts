import assert from "node:assert/strict";
import test from "node:test";

import { normalizeRecentMeetings } from "../src/shared/lib/recent-meetings.js";

test("recent meetings keep only valid meetings through one day after the appointment", () => {
  const now = Date.parse("2026-08-13T00:00:00.000Z");
  assert.deepEqual(normalizeRecentMeetings([
    { id: "future", meetingAt: "2026-08-13T12:00:00.000Z" },
    { id: "expired", meetingAt: "2026-08-11T12:00:00.000Z" },
    { id: 3, meetingAt: "2026-08-14T12:00:00.000Z" },
  ], now), [{ id: "future", meetingAt: "2026-08-13T12:00:00.000Z" }]);
});
