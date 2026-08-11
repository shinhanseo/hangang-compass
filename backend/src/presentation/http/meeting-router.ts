import { Router } from "express";

import type { ApplicationServices } from "../../composition-root.js";
import { capabilityCookieOptions, parseCookies } from "./cookies.js";
import { isFutureMeetingTime, participantInput } from "./validation.js";

export function createMeetingRouter(services: ApplicationServices) {
  const router = Router();

  router.get("/stations", (_request, response) => {
    response.json({ stations: services.stations() });
  });

  router.post("/meetings", (request, response) => {
    if (!isFutureMeetingTime(request.body?.meetingAt)) {
      response.status(400).json({ error: "invalid_meeting_time" });
      return;
    }
    const created = services.createMeeting(request.body.meetingAt);
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

  router.post("/invites/:inviteToken/participants", (request, response) => {
    const input = participantInput(request.body);
    if (!input) {
      response.status(400).json({ error: "invalid_alias" });
      return;
    }
    const joined = services.joinMeeting({ inviteToken: request.params.inviteToken, ...input });
    if (!joined) {
      response.status(400).json({ error: "join_failed" });
      return;
    }
    response.status(201).json(joined);
  });

  router.get("/meetings/:meetingId/host", (request, response) => {
    const requestCookies = parseCookies(request.headers.cookie);
    const hostToken = requestCookies[`hc_host_${request.params.meetingId}`];
    const meeting = services.hostMeeting(request.params.meetingId, hostToken);
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

  return router;
}
