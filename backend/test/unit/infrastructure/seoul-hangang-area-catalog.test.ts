import assert from "node:assert/strict";
import test from "node:test";
import { SEOUL_HANGANG_AREAS } from "../../../src/infrastructure/catalog/seoul-hangang-area-catalog.js";

test("maps all 11 distinct Hangang parks to Seoul citydata area names", () => {
  assert.equal(SEOUL_HANGANG_AREAS.length, 11);
  assert.equal(new Set(SEOUL_HANGANG_AREAS.map((area) => area.parkId)).size, 11);
  assert.equal(new Set(SEOUL_HANGANG_AREAS.map((area) => area.areaName)).size, 11);
  assert.ok(SEOUL_HANGANG_AREAS.every((area) => area.areaName.endsWith("한강공원")));
});
