import assert from "node:assert/strict";
import test from "node:test";

import { RANDOM_DRAW_FRAME_DELAYS, randomDrawFrames } from "../src/shared/lib/random-draw.js";

test("random draw cycles tied candidates before revealing the stored winner", () => {
  const frames = randomDrawFrames(["반포한강공원", "여의도한강공원"], "여의도한강공원");

  assert.equal(frames.length, RANDOM_DRAW_FRAME_DELAYS.length + 1);
  assert.deepEqual(new Set(frames.slice(0, -1)), new Set(["반포한강공원", "여의도한강공원"]));
  assert.equal(frames.at(-1), "여의도한강공원");
});

test("random draw safely falls back to the stored winner", () => {
  assert.deepEqual(randomDrawFrames([], "이촌한강공원"), ["이촌한강공원"]);
});
