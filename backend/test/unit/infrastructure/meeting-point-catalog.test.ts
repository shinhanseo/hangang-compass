import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { MEETING_POINT_CATALOG } from "../../../src/infrastructure/catalog/meeting-point-catalog.js";

test("runtime meeting points stay aligned with the verified source catalog", async () => {
  const source = JSON.parse(
    await readFile(new URL("../../../../data/meeting-points.json", import.meta.url), "utf8"),
  ) as Array<Record<string, unknown>>;
  const runtimeFields = source.map((item) => ({
    parkId: item.parkId,
    parkName: item.parkName,
    candidateName: item.candidateName,
    meetingInstruction: item.meetingInstruction,
    officialAddress: item.officialAddress,
    poiQuery: item.poiQuery,
  }));

  assert.deepEqual(MEETING_POINT_CATALOG, runtimeFields);
});
