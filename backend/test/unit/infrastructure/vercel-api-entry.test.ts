import assert from "node:assert/strict";
import test from "node:test";

import { expressApiUrl } from "../../../../api/server.js";

test("Vercel rewrite restores the Express API path and preserves user query parameters", () => {
  assert.equal(
    expressApiUrl("/api/server?path=invites%2Ftoken%2Fplaces&query=%EC%8B%A0%EC%B4%8C%EC%97%AD"),
    "/api/invites/token/places?query=%EC%8B%A0%EC%B4%8C%EC%97%AD",
  );
});
