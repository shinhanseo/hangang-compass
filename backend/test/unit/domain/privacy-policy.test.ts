import assert from "node:assert/strict";
import test from "node:test";

import {
  PROPOSED_PRIVACY_POLICY,
  can,
  deletionDueAt,
  sanitizeOperationalLog,
} from "../../../src/domain/privacy/privacy-policy.ts";
import { NodeCapabilityTokenService } from "../../../src/infrastructure/security/node-capability-token-service.ts";

test("host can manage the meeting but cannot inspect participant origins", () => {
  assert.equal(can("host", "edit_meeting"), true);
  assert.equal(can("host", "remove_participant"), true);
  assert.equal(can("host", "confirm_recommendation"), true);
  assert.equal(can("host", "vote_in_meeting_poll"), true);
  assert.equal(can("host", "delete_meeting"), true);
  assert.equal(can("host", "view_other_origin"), false);
  assert.equal(can("host", "view_own_origin"), false);
});

test("invite link permits joining but not reading participant details or editing", () => {
  assert.equal(can("invitee", "view_public_meeting"), true);
  assert.equal(can("invitee", "join_meeting"), true);
  assert.equal(can("invitee", "view_participant_aliases_and_times"), false);
  assert.equal(can("invitee", "edit_own_origin"), false);
  assert.equal(can("invitee", "edit_meeting"), false);
});

test("participant capability is limited to the participant's own origin", () => {
  assert.equal(can("participant", "view_own_origin"), true);
  assert.equal(can("participant", "edit_own_origin"), true);
  assert.equal(can("participant", "delete_own_participation"), true);
  assert.equal(can("participant", "vote_in_meeting_poll"), true);
  assert.equal(can("participant", "view_other_origin"), false);
  assert.equal(can("participant", "remove_participant"), false);
});

test("draft meeting expires seven days after creation", () => {
  const createdAt = new Date("2026-08-12T00:00:00.000Z");
  assert.equal(
    deletionDueAt({ status: "draft", createdAt }).toISOString(),
    "2026-08-19T00:00:00.000Z",
  );
});

test("scheduled meeting expires 24 hours after its meeting time", () => {
  const createdAt = new Date("2026-08-01T00:00:00.000Z");
  const meetingAt = new Date("2026-08-20T09:00:00.000Z");
  assert.equal(
    deletionDueAt({ status: "scheduled", createdAt, meetingAt }).toISOString(),
    "2026-08-21T09:00:00.000Z",
  );
});

test("manual deletion is due immediately", () => {
  const deletedAt = new Date("2026-08-12T03:04:05.000Z");
  assert.equal(
    deletionDueAt({ status: "deleted", createdAt: deletedAt, deletedAt }).toISOString(),
    deletedAt.toISOString(),
  );
});

test("operational logs discard tokens, aliases, origins, coordinates, and raw URLs", () => {
  const sanitized = sanitizeOperationalLog({
    requestId: "request-1",
    routeTemplate: "/meetings/:meetingId",
    method: "GET",
    statusCode: 200,
    durationMs: 18,
    provider: "kakao",
    errorCode: undefined,
    url: "/meetings/secret-token?origin=home",
    inviteToken: "secret-token",
    hostToken: "host-secret",
    alias: "real-name",
    originLabel: "home",
    latitude: 37.1,
    longitude: 127.1,
  });

  assert.deepEqual(sanitized, {
    requestId: "request-1",
    routeTemplate: "/meetings/:meetingId",
    method: "GET",
    statusCode: 200,
    durationMs: 18,
    provider: "kakao",
  });
});

test("capability tokens use 256 random bits and URL-safe encoding", () => {
  const tokens = new NodeCapabilityTokenService();
  const first = tokens.generateCapability();
  const second = tokens.generateCapability();

  assert.equal(PROPOSED_PRIVACY_POLICY.tokenRandomBytes, 32);
  assert.match(first, /^[A-Za-z0-9_-]{43}$/u);
  assert.notEqual(first, second);
});

test("proposed MVP does not persist raw addresses or precise coordinates", () => {
  assert.equal(PROPOSED_PRIVACY_POLICY.status, "approved");
  assert.equal(PROPOSED_PRIVACY_POLICY.persistRawAddress, false);
  assert.equal(PROPOSED_PRIVACY_POLICY.persistPreciseCoordinates, false);
  assert.equal(PROPOSED_PRIVACY_POLICY.mvpOriginInput, "provider_place_reference_only");
});
