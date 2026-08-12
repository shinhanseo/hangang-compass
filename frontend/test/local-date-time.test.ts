import assert from "node:assert/strict";
import test from "node:test";

import {
  combineLocalDateTime,
  parseLocalDateTime,
  roundUpToTenMinutes,
  toLocalDateTimeValue,
} from "../src/shared/lib/local-date-time";

test("local datetime values round-trip without changing timezone", () => {
  const value = "2026-08-15T18:30";
  assert.equal(combineLocalDateTime(parseLocalDateTime(value)), value);
});

test("default meeting minutes round up to the next ten-minute slot", () => {
  const rounded = roundUpToTenMinutes(new Date(2026, 7, 13, 17, 24, 51));
  assert.equal(toLocalDateTimeValue(rounded), "2026-08-13T17:30");
});

test("an exact ten-minute slot is kept", () => {
  const rounded = roundUpToTenMinutes(new Date(2026, 7, 13, 17, 30, 23));
  assert.equal(toLocalDateTimeValue(rounded), "2026-08-13T17:30");
});

