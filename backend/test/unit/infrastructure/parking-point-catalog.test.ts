import assert from "node:assert/strict";
import test from "node:test";
import { MEETING_POINT_CATALOG } from "../../../src/infrastructure/catalog/meeting-point-catalog.js";
import { PARKING_POINT_CATALOG } from "../../../src/infrastructure/catalog/parking-point-catalog.js";

test("every recommended park has one parking route anchor", () => {
  assert.equal(PARKING_POINT_CATALOG.length, 11);
  assert.equal(new Set(PARKING_POINT_CATALOG.map((point) => point.parkId)).size, 11);
  assert.deepEqual(
    PARKING_POINT_CATALOG.map((point) => point.parkId).sort(),
    MEETING_POINT_CATALOG.map((point) => point.parkId).sort(),
  );
});
