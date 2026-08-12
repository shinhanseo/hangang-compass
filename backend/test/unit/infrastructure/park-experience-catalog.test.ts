import assert from "node:assert/strict";
import test from "node:test";

import {
  PARK_EXPERIENCE_CATALOG,
  parkExperienceFor,
} from "../../../src/infrastructure/catalog/park-experience-catalog.ts";

test("experience catalog covers all 11 Hangang parks with official sources", () => {
  assert.equal(PARK_EXPERIENCE_CATALOG.length, 11);
  assert.equal(new Set(PARK_EXPERIENCE_CATALOG.map((item) => item.parkId)).size, 11);
  for (const item of PARK_EXPERIENCE_CATALOG) {
    assert.equal(item.highlights.length >= 3, true);
    assert.equal(item.cautions.length >= 1, true);
    assert.match(item.sourceUrl, /^https:\/\/hangang\.seoul\.go\.kr\//u);
    assert.equal(item.verificationStatus, "official_web_confirmed");
  }
});

test("unknown parks fail instead of receiving invented experience copy", () => {
  assert.throws(() => parkExperienceFor("unknown"), /park_experience_missing/u);
});
