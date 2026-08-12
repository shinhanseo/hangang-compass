import { Router } from "express";

import type { ApplicationServices } from "../../composition-root.js";
import { capabilityCookieOptions, parseCookies } from "./cookies.js";
import { isFutureMeetingTime, participantInput, placeQuery } from "./validation.js";

export function createMeetingRouter(services: ApplicationServices) {
  const router = Router();

  router.post("/meetings", async (request, response) => {
    if (!isFutureMeetingTime(request.body?.meetingAt)) {
      response.status(400).json({ error: "invalid_meeting_time" });
      return;
    }
    const created = await services.createMeeting(request.body.meetingAt);
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
