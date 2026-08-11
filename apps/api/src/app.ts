import express from "express";

import { FAKE_STATIONS } from "./fake-data.js";
import { createMeetingStore, type MeetingStore } from "./meeting-store.js";

function cookies(header: string | undefined): Record<string, string> {
  return Object.fromEntries((header ?? "").split(";").flatMap((part) => {
    const [name, ...value] = part.trim().split("=");
    return name ? [[name, decodeURIComponent(value.join("="))]] : [];
  }));
}

function validMeetingAt(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.getTime() > Date.now();
}

export function createApp(store: MeetingStore = createMeetingStore()) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb" }));
  app.use((_request, response, next) => {
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    next();
  });

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok", service: "hangang-compass-api" });
  });

  app.get("/api/stations", (_request, response) => {
    response.json({ stations: FAKE_STATIONS });
  });

  app.post("/api/meetings", (request, response) => {
    if (!validMeetingAt(request.body?.meetingAt)) {
      response.status(400).json({ error: "invalid_meeting_time" });
      return;
    }
    const created = store.create(request.body.meetingAt);
    response.cookie(`hc_host_${created.meeting.id}`, created.hostToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1_000,
    });
    response.cookie(`hc_invite_${created.meeting.id}`, created.inviteToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1_000,
    });
    response.status(201).json({
      meeting: created.meeting,
      invitePath: `/join/${created.inviteToken}`,
    });
  });

  app.get("/api/invites/:inviteToken", (request, response) => {
    const meeting = store.publicByInvite(request.params.inviteToken);
    if (!meeting) {
      response.status(404).json({ error: "invite_not_found" });
      return;
    }
    response.json({ meeting });
  });

  app.post("/api/invites/:inviteToken/participants", (request, response) => {
    const alias = typeof request.body?.alias === "string" ? request.body.alias.trim() : "";
    const stationId = typeof request.body?.stationId === "string" ? request.body.stationId : "";
    if (alias.length < 1 || alias.length > 20) {
      response.status(400).json({ error: "invalid_alias" });
      return;
    }
    const joined = store.addParticipant(request.params.inviteToken, alias, stationId);
    if (!joined) {
      response.status(400).json({ error: "join_failed" });
      return;
    }
    response.status(201).json(joined);
  });

  app.get("/api/meetings/:meetingId/host", (request, response) => {
    const requestCookies = cookies(request.headers.cookie);
    const hostToken = requestCookies[`hc_host_${request.params.meetingId}`];
    const meeting = store.hostById(request.params.meetingId, hostToken);
    if (!meeting) {
      response.status(403).json({ error: "host_access_denied" });
      return;
    }
    const inviteToken = requestCookies[`hc_invite_${request.params.meetingId}`];
    response.json({
      meeting,
      invitePath: inviteToken && store.publicByInvite(inviteToken) ? `/join/${inviteToken}` : null,
    });
  });

  app.use((_request, response) => {
    response.status(404).json({ error: "not_found" });
  });
  return app;
}
