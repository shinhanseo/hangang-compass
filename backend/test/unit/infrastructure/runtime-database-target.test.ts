import assert from "node:assert/strict";
import test from "node:test";

import { databaseTarget } from "../../../src/runtime/create-live-app.js";

test("Vercel requires PostgreSQL instead of silently using ephemeral SQLite", () => {
  assert.throws(() => databaseTarget({ VERCEL: "1" }), /DATABASE_URL/u);
});

test("Vercel selects the configured PostgreSQL connection", () => {
  assert.deepEqual(databaseTarget({ VERCEL: "1", DATABASE_URL: "postgresql://example.invalid/db" }), {
    kind: "postgres",
    connectionString: "postgresql://example.invalid/db",
  });
});
