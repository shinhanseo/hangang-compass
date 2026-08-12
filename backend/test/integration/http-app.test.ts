import assert from "node:assert/strict";
import test from "node:test";

import type { CrowdDataProvider } from "../../src/application/ports/crowd-data-provider.js";
import type { TransitRouteProvider } from "../../src/application/ports/transit-route-provider.js";
import { createApplicationServices } from "../../src/composition-root.js";
import { CachedCrowdDataProvider } from "../../src/infrastructure/providers/cached-crowd-data-provider.js";
import { CachedTransitRouteProvider } from "../../src/infrastructure/providers/cached-transit-route-provider.js";
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

test("searches selectable public places only through a valid invite", async (context) => {
  const server = createApp().listen(0, "127.0.0.1");
  context.after(() => server.close());
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const created = await (await fetch(`${baseUrl}/api/meetings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ meetingAt: new Date(Date.now() + 60_000).toISOString() }),
  })).json();
  const inviteToken = created.invitePath.split("/").at(-1);

  const response = await fetch(`${baseUrl}/api/invites/${inviteToken}/places?query=${encodeURIComponent("홍대")}`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    places: [{ id: "hongdae", name: "홍대입구역", address: "검증용 출발역", category: "지하철역" }],
  });
  assert.equal((await fetch(`${baseUrl}/api/invites/invalid/places?query=${encodeURIComponent("홍대")}`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/api/invites/${inviteToken}/places?query=${encodeURIComponent("홍")}`)).status, 400);
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
  for (const [alias, originPlaceId, originPlaceName] of [["민지", "hongdae", "홍대입구역"], ["준호", "gangnam", "강남역"]]) {
    const joinResponse = await fetch(`${baseUrl}/api/invites/${inviteToken}/participants`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alias, originPlaceId, originPlaceName }),
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
  assert.equal(JSON.stringify(hostView).includes("origin"), false);
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

test("live crowd and transit routes are cached and exposed through HTTP", async (context) => {
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
  let routeCalls = 0;
  const routeSource: TransitRouteProvider = {
    routeFor: async (origin, destination) => {
      routeCalls += 1;
      return {
        status: "available",
        route: {
          totalMinutes: origin.id === "hongdae" ? 20 : destination.id === "yeouido" ? 30 : 40,
          transfers: 1,
          fareWon: 1400,
          walkingMinutes: 3,
          calculatedAt: "2026-08-12T05:00:00.000Z",
          source: "kakao_public_transit",
        },
      };
    },
  };
  const services = createApplicationServices({
    crowdProvider: new CachedCrowdDataProvider(source, 5 * 60_000),
    routeProvider: new CachedTransitRouteProvider(routeSource, {
      ttlMs: 2 * 60 * 60_000,
      maxRequestsPerDay: 900,
    }),
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
  for (const [alias, originPlaceId, originPlaceName] of [["민지", "hongdae", "홍대입구역"], ["준호", "gangnam", "강남역"]]) {
    await fetch(`${baseUrl}/api/invites/${inviteToken}/participants`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alias, originPlaceId, originPlaceName }),
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
  assert.equal(result.travelData.source, "kakao_public_transit");
  assert.equal(result.travelData.calculatedAt, "2026-08-12T05:00:00.000Z");
  assert.equal(providerCalls, 11);
  assert.equal(routeCalls, 22);
});

test("route outage returns an explicit unavailable state instead of fake minutes", async (context) => {
  const routeSource: TransitRouteProvider = {
    routeFor: async () => ({ status: "unavailable", reason: "network_error" }),
  };
  const services = createApplicationServices({ routeProvider: routeSource });
  const server = createApp(services).listen(0, "127.0.0.1");
  context.after(() => server.close());
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const created = await (await fetch(`${baseUrl}/api/meetings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ meetingAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString() }),
  })).json();
  const inviteToken = created.invitePath.split("/").at(-1);
  let secondJoin: Response | null = null;
  for (const [alias, originPlaceId, originPlaceName] of [["민지", "hongdae", "홍대입구역"], ["준호", "gangnam", "강남역"]]) {
    secondJoin = await fetch(`${baseUrl}/api/invites/${inviteToken}/participants`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alias, originPlaceId, originPlaceName }),
    });
  }
  const body = await secondJoin!.json();
  assert.equal(body.result, null);
  assert.equal(body.recommendationStatus, "route_unavailable");
});
