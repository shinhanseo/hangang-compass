import { Router } from "express";

import type { ApplicationServices } from "../../composition-root.js";
import { capabilityCookieOptions, parseCookies } from "./cookies.js";
import { isFutureMeetingTime, participantInput, placeQuery, travelPattern } from "./validation.js";

export function createMeetingRouter(services: ApplicationServices) {
  const router = Router();

  router.post("/meetings", async (request, response) => {
    const selectedTravelPattern = travelPattern(request.body?.travelPattern);
    if (!isFutureMeetingTime(request.body?.meetingAt) || !selectedTravelPattern) {
      response.status(400).json({ error: "invalid_meeting_time" });
      return;
    }
    const created = await services.createMeeting(request.body.meetingAt, selectedTravelPattern);
    response.cookie(`hc_host_${created.meeting.id}`, created.hostToken, capabilityCookieOptions());
    response.cookie(`hc_invite_${created.meeting.id}`, created.inviteToken, capabilityCookieOptions());
    response.status(201).json({
      meeting: created.meeting,
      invitePath: `/join/${created.inviteToken}`,
    });
  });

  router.get("/invites/:inviteToken", (request, response) => {
    const meeting = services.publicMeeting(request.params.inviteToken);
    if (!meeting) {
      response.status(404).json({ error: "invite_not_found" });
      return;
    }
    response.json({ meeting });
  });

  router.get("/invites/:inviteToken/places", async (request, response) => {
    if (!services.publicMeeting(request.params.inviteToken)) {
      response.status(404).json({ error: "invite_not_found" });
      return;
    }
    const query = placeQuery(request.query.query);
    if (!query) {
      response.status(400).json({ error: "invalid_place_query" });
      return;
    }
    const result = await services.searchOriginPlaces(query);
    if (result.status === "unavailable") {
      response.status(503).json({ error: "place_search_unavailable" });
      return;
    }
    response.json({ places: result.places });
  });

  router.get("/invites/:inviteToken/recommendation", async (request, response) => {
    const result = await services.publicRecommendation(request.params.inviteToken);
    if (!result) {
      response.status(404).json({ error: "recommendation_not_ready" });
      return;
    }
    response.json({ result });
  });

  router.post("/invites/:inviteToken/participants", async (request, response) => {
    const input = participantInput(request.body);
    if (!input) {
      response.status(400).json({ error: "invalid_alias" });
      return;
    }
    const joined = await services.joinMeeting({ inviteToken: request.params.inviteToken, ...input });
    if (!joined) {
      response.status(400).json({ error: "join_failed" });
      return;
    }
    response.status(201).json(joined);
  });

  router.get("/meetings/:meetingId/host", async (request, response) => {
    const requestCookies = parseCookies(request.headers.cookie);
    const hostToken = requestCookies[`hc_host_${request.params.meetingId}`];
    const meeting = await services.hostMeeting(request.params.meetingId, hostToken);
    if (!meeting) {
      response.status(403).json({ error: "host_access_denied" });
      return;
    }
    const inviteToken = requestCookies[`hc_invite_${request.params.meetingId}`];
    response.json({
      meeting,
      invitePath: inviteToken && services.publicMeeting(inviteToken) ? `/join/${inviteToken}` : null,
    });
  });

  router.get("/meetings/:meetingId/host-access", (request, response) => {
    const requestCookies = parseCookies(request.headers.cookie);
    const summary = services.hostAccessSummary(
      request.params.meetingId,
      requestCookies[`hc_host_${request.params.meetingId}`],
    );
    if (!summary) {
      response.status(403).json({ error: "host_access_denied" });
      return;
    }
    response.json({ meeting: summary });
  });

  router.post("/meetings/:meetingId/recovery-link", (request, response) => {
    const requestCookies = parseCookies(request.headers.cookie);
    const recovery = services.createHostRecoveryLink(
      request.params.meetingId,
      requestCookies[`hc_host_${request.params.meetingId}`],
    );
    if (!recovery) {
      response.status(403).json({ error: "host_access_denied" });
      return;
    }
    response.status(201).json(recovery);
  });

  router.post("/meetings/:meetingId/recover", (request, response) => {
    const hostToken = typeof request.body?.hostToken === "string" ? request.body.hostToken : "";
    const inviteToken = typeof request.body?.inviteToken === "string" ? request.body.inviteToken : "";
    if (!/^[A-Za-z0-9_-]{43}$/u.test(hostToken) || !/^[A-Za-z0-9_-]{43}$/u.test(inviteToken)) {
      response.status(400).json({ error: "invalid_recovery_capability" });
      return;
    }
    const recovered = services.recoverHostAccess(request.params.meetingId, hostToken, inviteToken);
    if (!recovered) {
      response.status(403).json({ error: "recovery_denied" });
      return;
    }
    response.cookie(`hc_host_${request.params.meetingId}`, recovered.hostToken, capabilityCookieOptions());
    response.cookie(`hc_invite_${request.params.meetingId}`, recovered.inviteToken, capabilityCookieOptions());
    response.json({ hostPath: `/host/${request.params.meetingId}`, meetingAt: recovered.meetingAt });
  });

  router.put("/meetings/:meetingId/shared-origin", async (request, response) => {
    const requestCookies = parseCookies(request.headers.cookie);
    const placeId = typeof request.body?.placeId === "string" ? request.body.placeId.trim() : "";
    const placeName = typeof request.body?.placeName === "string" ? request.body.placeName.trim() : "";
    if (!placeId || placeId.length > 80 || !placeName || placeName.length > 100) {
      response.status(400).json({ error: "invalid_shared_origin" });
      return;
    }
    const result = await services.setSharedOrigin({
      meetingId: request.params.meetingId,
      hostToken: requestCookies[`hc_host_${request.params.meetingId}`],
      placeId,
      placeName,
    });
    if (!result) {
      response.status(403).json({ error: "shared_origin_denied" });
      return;
    }
    response.json(result);
  });

  router.put("/meetings/:meetingId/host-participant", async (request, response) => {
    const input = participantInput(request.body);
    if (!input) {
      response.status(400).json({ error: "invalid_host_participant" });
      return;
    }
    const requestCookies = parseCookies(request.headers.cookie);
    const meeting = await services.setHostParticipant({
      meetingId: request.params.meetingId,
      hostToken: requestCookies[`hc_host_${request.params.meetingId}`],
      ...input,
    });
    if (!meeting) {
      response.status(403).json({ error: "host_participant_denied" });
      return;
    }
    response.json({ meeting });
  });

  router.post("/meetings/:meetingId/confirmation", async (request, response) => {
    const parkId = typeof request.body?.parkId === "string" ? request.body.parkId : "";
    const requestCookies = parseCookies(request.headers.cookie);
    const hostToken = requestCookies[`hc_host_${request.params.meetingId}`];
    const confirmation = await services.confirmMeetingPark(request.params.meetingId, hostToken, parkId);
    if (!confirmation) {
      response.status(403).json({ error: "confirmation_denied" });
      return;
    }
    response.json(confirmation);
  });

  return router;
}
