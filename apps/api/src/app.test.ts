import assert from "node:assert/strict";
import test from "node:test";

import { createApp } from "./app.ts";

test("health endpoint returns safe headers and service status", async (context) => {
  const server = createApp().listen(0, "127.0.0.1");
  context.after(() => server.close());
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    status: "ok",
    service: "hangang-compass-api",
  });
});

test("unknown routes return a generic response without reflecting the URL", async (context) => {
  const server = createApp().listen(0, "127.0.0.1");
  context.after(() => server.close());
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const response = await fetch(`http://127.0.0.1:${address.port}/secret-token`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "not_found" });
});

test("create, invite, join twice, and recommend without exposing origins", async (context) => {
  const server = createApp().listen(0, "127.0.0.1");
  context.after(() => server.close());
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const meetingAt = new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString();

  const createResponse = await fetch(`${baseUrl}/api/meetings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ meetingAt }),
  });
  assert.equal(createResponse.status, 201);
  const hostCookie = createResponse.headers.get("set-cookie");
  assert.ok(hostCookie);
  const created = await createResponse.json();
  assert.match(created.invitePath, /^\/join\/[A-Za-z0-9_-]{43}$/u);

  const inviteToken = created.invitePath.split("/").at(-1);
  for (const [alias, stationId] of [["민지", "hongdae"], ["준호", "gangnam"]]) {
    const joinResponse = await fetch(`${baseUrl}/api/invites/${inviteToken}/participants`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alias, stationId }),
    });
    assert.equal(joinResponse.status, 201);
  }

  const hostResponse = await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/host`, {
    headers: { cookie: hostCookie.split(";")[0]! },
  });
  assert.equal(hostResponse.status, 200);
  const hostView = await hostResponse.json();
  assert.equal(hostView.meeting.participantCount, 2);
  assert.ok(hostView.meeting.result.recommended.parkName);
  assert.ok(hostView.meeting.result.alternative.parkName);
  assert.equal(JSON.stringify(hostView).includes("stationId"), false);
  assert.equal(JSON.stringify(hostView).includes("hongdae"), false);
});
