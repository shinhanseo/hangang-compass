import assert from "node:assert/strict";
import test from "node:test";

import type { CrowdDataProvider } from "../../src/application/ports/crowd-data-provider.js";
import { createApplicationServices } from "../../src/composition-root.js";
import { CachedCrowdDataProvider } from "../../src/infrastructure/providers/cached-crowd-data-provider.js";
import { createApp } from "../../src/presentation/http/app.ts";

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
  assert.equal(hostView.meeting.result.alternatives.length, 2);
  assert.deepEqual(
    hostView.meeting.result.alternatives.map((item: { role: string }) => item.role),
    ["travel_alternative", "experience_alternative"],
  );
  assert.equal(new Set([
    hostView.meeting.result.recommended.parkId,
    ...hostView.meeting.result.alternatives.map((item: { parkId: string }) => item.parkId),
  ]).size, 3);
  assert.equal(hostView.meeting.result.recommended.arrivalCrowd.status, "fake_sample");
  assert.match(hostView.meeting.result.recommended.experience.sourceUrl, /^https:\/\/hangang\.seoul\.go\.kr\//u);
  assert.equal(JSON.stringify(hostView).includes("stationId"), false);
  assert.equal(JSON.stringify(hostView).includes("hongdae"), false);

  const selectedParkId = hostView.meeting.result.alternatives[1].parkId;
  const confirmationResponse = await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/confirmation`, {
    method: "POST",
    headers: { cookie: hostCookie.split(";")[0]!, "content-type": "application/json" },
    body: JSON.stringify({ parkId: selectedParkId }),
  });
  assert.equal(confirmationResponse.status, 200);
  assert.equal((await confirmationResponse.json()).confirmedParkId, selectedParkId);

  const refreshedHost = await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/host`, {
    headers: { cookie: hostCookie.split(";")[0]! },
  });
  assert.equal((await refreshedHost.json()).meeting.confirmedParkId, selectedParkId);
});

test("live crowd is cached and exposed as an arrival forecast through HTTP", async (context) => {
  const meetingAt = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
  let providerCalls = 0;
  const source: CrowdDataProvider = {
    crowdFor: async (parkId, areaName) => {
      providerCalls += 1;
      return {
        status: "available",
        snapshot: {
          parkId,
          areaName,
          areaCode: `code-${parkId}`,
          current: {
            level: "normal",
            observedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
            freshness: "fresh",
            isReplacement: false,
          },
          forecastStatus: "available",
          forecasts: [{ forecastFor: meetingAt, level: parkId === "yeouido" ? "busy" : "normal", populationMin: null, populationMax: null }],
          fetchedAt: new Date().toISOString(),
          source: "seoul_realtime_citydata",
        },
      };
    },
  };
  const services = createApplicationServices({
    crowdProvider: new CachedCrowdDataProvider(source, 5 * 60_000),
  });
  const server = createApp(services).listen(0, "127.0.0.1");
  context.after(() => server.close());
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const createdResponse = await fetch(`${baseUrl}/api/meetings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ meetingAt }),
  });
  const hostCookie = createdResponse.headers.get("set-cookie")!;
  const created = await createdResponse.json();
  const inviteToken = created.invitePath.split("/").at(-1);
  for (const [alias, stationId] of [["민지", "hongdae"], ["준호", "gangnam"]]) {
    await fetch(`${baseUrl}/api/invites/${inviteToken}/participants`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alias, stationId }),
    });
  }
  const hostResponse = await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/host`, {
    headers: { cookie: hostCookie.split(";")[0]! },
  });
  const result = (await hostResponse.json()).meeting.result;
  assert.equal(result.stage, "live_current");
  assert.equal(result.recommended.arrivalCrowd.status, "live_forecast");
  assert.equal(result.recommended.arrivalCrowd.source, "seoul_realtime_citydata");
  assert.equal(result.recommended.arrivalCrowd.referenceAt, meetingAt);
  assert.equal(providerCalls, 11);
});
