import assert from "node:assert/strict";
import test from "node:test";

import { getParticipantResumeToken, inviteTokenFromApiPath, saveParticipantResumeToken } from "../src/shared/lib/participant-resume.ts";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const invite = "i".repeat(43);
const resume = "r".repeat(43);

test("stores an opaque participant resume token for seven-day re-entry", () => {
  const storage = new MemoryStorage();
  saveParticipantResumeToken(invite, resume, storage, 1_000);
  assert.equal(getParticipantResumeToken(invite, storage, 1_000), resume);
  assert.equal(getParticipantResumeToken(invite, storage, 1_000 + 7 * 24 * 60 * 60 * 1_000), undefined);
});

test("only attaches resume credentials to a matching invite API path", () => {
  assert.equal(inviteTokenFromApiPath(`/api/invites/${invite}/participant-session`), invite);
  assert.equal(inviteTokenFromApiPath(`/api/invites/${invite}/poll/vote`), invite);
  assert.equal(inviteTokenFromApiPath(`/api/invites/${invite}/places`), undefined);
  assert.equal(inviteTokenFromApiPath(`/join/${invite}`), undefined);
  assert.equal(inviteTokenFromApiPath("https://example.com/api/invites/" + invite), undefined);
});
