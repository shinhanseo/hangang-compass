import assert from "node:assert/strict";
import test from "node:test";

import {
  forecastIntervalMinutes,
  parseEnv,
  xmlTag,
  xmlTags,
} from "./validate-data-access.mjs";

test("parseEnv keeps values local and supports equals signs", () => {
  assert.deepEqual(
    parseEnv("# local only\nSEOUL_OPEN_DATA_KEY=abc=123\nKAKAO_REST_API_KEY='xyz'\n"),
    {
      SEOUL_OPEN_DATA_KEY: "abc=123",
      KAKAO_REST_API_KEY: "xyz",
    },
  );
});

test("xmlTag reads plain and CDATA values", () => {
  assert.equal(xmlTag("<CODE>INFO-000</CODE>", "CODE"), "INFO-000");
  assert.equal(xmlTag("<AREA_NM><![CDATA[여의도한강공원]]></AREA_NM>", "AREA_NM"), "여의도한강공원");
  assert.equal(xmlTag("<ROOT />", "CODE"), undefined);
});

test("xmlTags and forecastIntervalMinutes detect hourly forecasts", () => {
  const xml = [
    "<FCST_TIME>2026-08-12 02:00</FCST_TIME>",
    "<FCST_TIME>2026-08-12 03:00</FCST_TIME>",
    "<FCST_TIME>2026-08-12 04:00</FCST_TIME>",
  ].join("");
  const times = xmlTags(xml, "FCST_TIME");

  assert.deepEqual(times, ["2026-08-12 02:00", "2026-08-12 03:00", "2026-08-12 04:00"]);
  assert.equal(forecastIntervalMinutes(times), 60);
});

test("forecastIntervalMinutes reports mixed and insufficient intervals", () => {
  assert.equal(
    forecastIntervalMinutes([
      "2026-08-12 02:00",
      "2026-08-12 03:00",
      "2026-08-12 05:00",
    ]),
    "mixed",
  );
  assert.equal(forecastIntervalMinutes(["2026-08-12 02:00"]), null);
});
