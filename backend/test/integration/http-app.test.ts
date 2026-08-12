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
    body: JSON.stringify({ meetingAt: new Date(Date.now() + 60_000).toISOString(), travelPattern: "individual_round_trip" }),
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
    body: JSON.stringify({ meetingAt, travelPattern: "individual_round_trip" }),
  });
  assert.equal(createResponse.status, 201);
  const hostCookie = createResponse.headers.get("set-cookie");
  assert.ok(hostCookie);
  const created = await createResponse.json();
  assert.match(created.invitePath, /^\/join\/[A-Za-z0-9_-]{43}$/u);

  const inviteToken = created.invitePath.split("/").at(-1);
  const participantCookies: string[] = [];
  for (const [alias, originPlaceId, originPlaceName] of [["민지", "hongdae", "홍대입구역"], ["준호", "gangnam", "강남역"]]) {
    const joinResponse = await fetch(`${baseUrl}/api/invites/${inviteToken}/participants`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alias, originPlaceId, originPlaceName }),
    });
    assert.equal(joinResponse.status, 201);
    assert.equal(JSON.stringify(await joinResponse.json()).includes("participantToken"), false);
    const participantCookie = joinResponse.headers.get("set-cookie")?.match(/hc_participant=[^;]+/u)?.[0];
    assert.ok(participantCookie);
    participantCookies.push(participantCookie);
  }

  const hostResponse = await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/host`, {
    headers: { cookie: hostCookie.split(";")[0]! },
  });
  assert.equal(hostResponse.status, 200);
  assert.equal((await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/host-access`, {
    headers: { cookie: hostCookie.split(";")[0]! },
  })).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/host-access`)).status, 403);
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

  const recoveryLinkResponse = await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/recovery-link`, {
    method: "POST",
    headers: { cookie: hostCookie.split(";")[0]! },
  });
  assert.equal(recoveryLinkResponse.status, 201);
  const recoveryUrl = new URL((await recoveryLinkResponse.json()).path, baseUrl);
  const recoveryCapabilities = new URLSearchParams(recoveryUrl.hash.slice(1));
  const recoverResponse = await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/recover`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      hostToken: recoveryCapabilities.get("host"),
      inviteToken: recoveryCapabilities.get("invite"),
    }),
  });
  assert.equal(recoverResponse.status, 200);
  const recoveredCookies = recoverResponse.headers.get("set-cookie") ?? "";
  const recoveredHostCookie = recoveredCookies.match(new RegExp(`hc_host_${created.meeting.id}=[^;,]+`, "u"))?.[0];
  assert.ok(recoveredHostCookie);
  const recoveredHostResponse = await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/host`, {
    headers: { cookie: recoveredHostCookie },
  });
  assert.equal(recoveredHostResponse.status, 200);
  assert.equal((await recoveredHostResponse.json()).meeting.id, created.meeting.id);

  const publicRecommendationResponse = await fetch(`${baseUrl}/api/invites/${inviteToken}/recommendation`);
  assert.equal(publicRecommendationResponse.status, 200);
  const publicRecommendation = (await publicRecommendationResponse.json()).result;
  assert.deepEqual(publicRecommendation.recommended.participantTimes, []);
  assert.ok(publicRecommendation.alternatives.every((park: { participantTimes: unknown[] }) => park.participantTimes.length === 0));
  assert.equal(JSON.stringify(publicRecommendation).includes("민지"), false);
  assert.equal((await fetch(`${baseUrl}/api/invites/invalid/recommendation`)).status, 404);

  const pollStartResponse = await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/poll`, {
    method: "POST",
    headers: { cookie: hostCookie.split(";")[0]! },
  });
  assert.equal(pollStartResponse.status, 201);
  const startedPoll = (await pollStartResponse.json()).poll;
  assert.equal(startedPoll.status, "open");
  assert.deepEqual(startedPoll.candidateParkIds, [hostView.meeting.result.recommended.parkId, ...hostView.meeting.result.alternatives.map((item: { parkId: string }) => item.parkId)]);
  assert.equal((await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/poll`)).status, 404);
  assert.equal((await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/poll`, { headers: { cookie: hostCookie.split(";")[0]! } })).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/invites/${inviteToken}/poll/vote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ parkId: startedPoll.candidateParkIds[0] }),
  })).status, 403);
  for (const [index, cookie] of participantCookies.entries()) {
    const voteResponse = await fetch(`${baseUrl}/api/invites/${inviteToken}/poll/vote`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ parkId: startedPoll.candidateParkIds[index] }),
    });
    assert.equal(voteResponse.status, 200);
    assert.equal((await voteResponse.json()).poll.myVoteParkId, startedPoll.candidateParkIds[index]);
  }
  const participantPoll = await fetch(`${baseUrl}/api/invites/${inviteToken}/poll`, { headers: { cookie: participantCookies[0]! } });
  const tiedParticipantPoll = (await participantPoll.json()).poll;
  assert.equal(tiedParticipantPoll.status, "tied");
  assert.equal(tiedParticipantPoll.canVote, false);
  const tiedPollResponse = await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/poll`, { headers: { cookie: hostCookie.split(";")[0]! } });
  assert.equal((await tiedPollResponse.json()).poll.status, "tied");
  const restartedPollResponse = await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/poll/restart`, {
    method: "POST",
    headers: { cookie: hostCookie.split(";")[0]! },
  });
  assert.equal((await restartedPollResponse.json()).poll.round, 2);
  for (const cookie of participantCookies) {
    await fetch(`${baseUrl}/api/invites/${inviteToken}/poll/vote`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ parkId: startedPoll.candidateParkIds[0] }),
    });
  }
  const completedPollResponse = await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/poll`, { headers: { cookie: hostCookie.split(";")[0]! } });
  const completedPoll = (await completedPollResponse.json()).poll;
  assert.equal(completedPoll.status, "completed");
  assert.equal(completedPoll.winnerParkId, startedPoll.candidateParkIds[0]);
  assert.equal(completedPoll.resolution, "vote");
  assert.equal((await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/poll/confirm`, { method: "POST" })).status, 403);
  const pollConfirmationResponse = await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/poll/confirm`, {
    method: "POST",
    headers: { cookie: hostCookie.split(";")[0]! },
  });
  assert.equal(pollConfirmationResponse.status, 200);
  assert.equal((await pollConfirmationResponse.json()).confirmedParkId, startedPoll.candidateParkIds[0]);

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

  assert.equal((await fetch(`${baseUrl}/api/meetings/${created.meeting.id}`, { method: "DELETE" })).status, 403);
  const deletionResponse = await fetch(`${baseUrl}/api/meetings/${created.meeting.id}`, {
    method: "DELETE",
    headers: { cookie: hostCookie.split(";")[0]! },
  });
  assert.equal(deletionResponse.status, 200);
  assert.deepEqual(await deletionResponse.json(), { deleted: true });
  assert.equal((await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/host`, {
    headers: { cookie: hostCookie.split(";")[0]! },
  })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/invites/${inviteToken}`)).status, 404);
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
    body: JSON.stringify({ meetingAt, travelPattern: "individual_round_trip" }),
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
  assert.equal(result.refreshAt, null);
  assert.equal(result.recommended.arrivalCrowd.status, "live_forecast");
  assert.equal(result.recommended.arrivalCrowd.source, "seoul_realtime_citydata");
  assert.equal(result.recommended.arrivalCrowd.referenceAt, meetingAt);
  assert.equal(result.travelData.source, "kakao_public_transit");
  assert.equal(result.travelData.calculatedAt, "2026-08-12T05:00:00.000Z");
  assert.equal(result.travelPattern, "individual_round_trip");
  assert.ok(result.recommended.returnTravel);
  assert.match(result.recommended.selectionReason, /도착 혼잡/u);
  assert.match(result.explanation, /도착 혼잡/u);
  assert.equal(result.crowdOverview.basis, "arrival");
  assert.equal(result.crowdOverview.parks.length, 11);
  assert.equal(result.crowdOverview.parks.filter((park: { isRecommended: boolean }) => park.isRecommended).length, 1);
  assert.equal(providerCalls, 11);
  assert.equal(routeCalls, 44);
});

test("far-future meetings show current crowd separately and publish a refresh boundary", async (context) => {
  const meetingAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  const source: CrowdDataProvider = {
    crowdFor: async (parkId, areaName) => ({
      status: "available",
      snapshot: {
        parkId,
        areaName,
        areaCode: `code-${parkId}`,
        current: {
          level: parkId === "yeouido" ? "busy" : "normal",
          observedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
          freshness: "fresh",
          isReplacement: false,
        },
        forecastStatus: "available",
        forecasts: [],
        fetchedAt: new Date().toISOString(),
        source: "seoul_realtime_citydata",
      },
    }),
  };
  const services = createApplicationServices({ crowdProvider: source });
  const server = createApp(services).listen(0, "127.0.0.1");
  context.after(() => server.close());
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const created = await (await fetch(`${baseUrl}/api/meetings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ meetingAt, travelPattern: "individual_round_trip" }),
  })).json();
  const inviteToken = created.invitePath.split("/").at(-1);
  for (const [alias, placeId, placeName] of [["민지", "hongdae", "홍대입구역"], ["준호", "gangnam", "강남역"]]) {
    await fetch(`${baseUrl}/api/invites/${inviteToken}/participants`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alias, originPlaceId: placeId, originPlaceName: placeName }),
    });
  }
  const response = await fetch(`${baseUrl}/api/invites/${inviteToken}/recommendation`);
  assert.equal(response.status, 200);
  const result = (await response.json()).result;
  assert.equal(result.stage, "live_provisional");
  assert.equal(result.crowdOverview.basis, "current");
  assert.equal(result.crowdOverview.parks.filter((park: { isRecommended: boolean }) => park.isRecommended).length, 0);
  assert.equal(result.refreshAt, new Date(new Date(meetingAt).getTime() - 12 * 60 * 60_000).toISOString());
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
    body: JSON.stringify({ meetingAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(), travelPattern: "individual_round_trip" }),
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

test("host submits an individual travel place and counts toward recommendation", async (context) => {
  const server = createApp().listen(0, "127.0.0.1");
  context.after(() => server.close());
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const createdResponse = await fetch(`${baseUrl}/api/meetings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ meetingAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(), travelPattern: "individual_round_trip" }),
  });
  const hostCookie = createdResponse.headers.get("set-cookie")!;
  const created = await createdResponse.json();

  const invalidMode = await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/host-participant`, {
    method: "PUT",
    headers: { cookie: hostCookie.split(";")[0]!, "content-type": "application/json" },
    body: JSON.stringify({ alias: "방장", originPlaceId: "gangnam", originPlaceName: "강남역", travelMode: "teleport" }),
  });
  assert.equal(invalidMode.status, 400);

  const unauthorized = await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/host-participant`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ alias: "방장", originPlaceId: "gangnam", originPlaceName: "강남역", travelMode: "car" }),
  });
  assert.equal(unauthorized.status, 403);

  const submitted = await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/host-participant`, {
    method: "PUT",
    headers: { cookie: hostCookie.split(";")[0]!, "content-type": "application/json" },
    body: JSON.stringify({ alias: "방장", originPlaceId: "gangnam", originPlaceName: "강남역", travelMode: "car" }),
  });
  assert.equal(submitted.status, 200);
  const submittedBody = await submitted.json();
  assert.equal(submittedBody.meeting.hostParticipantSubmitted, true);
  assert.equal(submittedBody.meeting.participantCount, 1);
  assert.deepEqual(submittedBody.meeting.participants, [{ alias: "방장", isHost: true, travelMode: "car" }]);
  assert.equal(JSON.stringify(submittedBody).includes("gangnam"), false);

  const duplicate = await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/host-participant`, {
    method: "PUT",
    headers: { cookie: hostCookie.split(";")[0]!, "content-type": "application/json" },
    body: JSON.stringify({ alias: "방장", originPlaceId: "hongdae", originPlaceName: "홍대입구역" }),
  });
  assert.equal(duplicate.status, 403);

  const inviteToken = created.invitePath.split("/").at(-1);
  const guest = await fetch(`${baseUrl}/api/invites/${inviteToken}/participants`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ alias: "친구", originPlaceId: "hongdae", originPlaceName: "홍대입구역" }),
  });
  assert.equal(guest.status, 201);
  const guestBody = await guest.json();
  assert.equal(guestBody.participantCount, 2);
  assert.ok(guestBody.result?.recommended.parkId);
});

test("shared-origin meeting reuses the common outbound and keeps private destinations", async (context) => {
  let routeCalls = 0;
  const routeSource: TransitRouteProvider = {
    routeFor: async (origin, destination) => {
      routeCalls += 1;
      return {
        status: "available",
        route: {
          totalMinutes: origin.id === "hongdae" ? 18 : destination.id === "gangnam" ? 27 : 36,
          transfers: null,
          fareWon: null,
          walkingMinutes: null,
          calculatedAt: "2026-08-12T05:00:00.000Z",
          source: "kakao_public_transit",
        },
      };
    },
  };
  const server = createApp(createApplicationServices({ routeProvider: new CachedTransitRouteProvider(routeSource, {
    ttlMs: 2 * 60 * 60_000,
    maxRequestsPerDay: 900,
  }) })).listen(0, "127.0.0.1");
  context.after(() => server.close());
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const createdResponse = await fetch(`${baseUrl}/api/meetings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ meetingAt: new Date(Date.now() + 24 * 60 * 60_000).toISOString(), travelPattern: "shared_origin" }),
  });
  const hostCookie = createdResponse.headers.get("set-cookie")!;
  const created = await createdResponse.json();
  const inviteToken = created.invitePath.split("/").at(-1);
  const setOriginResponse = await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/shared-origin`, {
    method: "PUT",
    headers: { cookie: hostCookie.split(";")[0]!, "content-type": "application/json" },
    body: JSON.stringify({ placeId: "hongdae", placeName: "홍대입구역" }),
  });
  assert.equal(setOriginResponse.status, 200);
  assert.deepEqual(await setOriginResponse.json(), { sharedOriginName: "홍대입구역" });
  const publicMeeting = await (await fetch(`${baseUrl}/api/invites/${inviteToken}`)).json();
  assert.equal(publicMeeting.meeting.travelPattern, "shared_origin");
  assert.equal(publicMeeting.meeting.sharedOriginName, "홍대입구역");

  const hostParticipant = await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/host-participant`, {
    method: "PUT",
    headers: { cookie: hostCookie.split(";")[0]!, "content-type": "application/json" },
    body: JSON.stringify({ alias: "방장", destinationPlaceId: "gangnam", destinationPlaceName: "강남역" }),
  });
  assert.equal(hostParticipant.status, 200);
  const joined = await fetch(`${baseUrl}/api/invites/${inviteToken}/participants`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ alias: "친구", destinationPlaceId: "nowon", destinationPlaceName: "노원역" }),
  });
  assert.equal(joined.status, 201);

  const hostView = await (await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/host`, {
    headers: { cookie: hostCookie.split(";")[0]! },
  })).json();
  const result = hostView.meeting.result;
  assert.equal(hostView.meeting.travelPattern, "shared_origin");
  assert.equal(hostView.meeting.sharedOriginName, "홍대입구역");
  assert.equal(hostView.meeting.hostParticipantSubmitted, true);
  assert.equal(result.travelPattern, "shared_origin");
  assert.ok(result.recommended.returnTravel);
  assert.ok(result.recommended.participantTimes.every((item: { returnMinutes: number | null }) => item.returnMinutes !== null));
  assert.match(result.explanation, /갈 때/u);
  assert.match(result.explanation, /귀가 최장시간/u);
  assert.equal(JSON.stringify(hostView).includes("originPlace"), false);
  assert.equal(JSON.stringify(hostView).includes("destinationPlace"), false);
  assert.equal(routeCalls, 33);

  const lateChange = await fetch(`${baseUrl}/api/meetings/${created.meeting.id}/shared-origin`, {
    method: "PUT",
    headers: { cookie: hostCookie.split(";")[0]!, "content-type": "application/json" },
    body: JSON.stringify({ placeId: "gangnam", placeName: "강남역" }),
  });
  assert.equal(lateChange.status, 403);
});
