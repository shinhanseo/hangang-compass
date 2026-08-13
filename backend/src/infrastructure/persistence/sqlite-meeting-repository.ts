import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { MeetingRepository } from "../../application/ports/meeting-repository.js";
import type { Meeting } from "../../domain/meeting/meeting.js";
import type { RecommendationResultView } from "../../application/models/meeting-view.js";
import { deletionDueAt } from "../../domain/privacy/privacy-policy.js";

type MeetingRow = { payload: string };
type RecommendationRow = { payload: string };

function expiresAt(meeting: Meeting): string {
  return deletionDueAt(meeting.confirmedParkId
    ? { status: "scheduled", createdAt: new Date(meeting.createdAt), meetingAt: new Date(meeting.meetingAt) }
    : { status: "draft", createdAt: new Date(meeting.createdAt) }).toISOString();
}

function parseMeeting(payload: string): Meeting | undefined {
  try {
    const value = JSON.parse(payload) as Partial<Meeting>;
    return typeof value.id === "string"
      && typeof value.createdAt === "string"
      && typeof value.meetingAt === "string"
      && Array.isArray(value.inviteTokenHashes)
      && Array.isArray(value.hostTokenHashes)
      && Array.isArray(value.participants)
      ? value as Meeting
      : undefined;
  } catch {
    return undefined;
  }
}

export class SqliteMeetingRepository implements MeetingRepository {
  readonly #database: DatabaseSync;
  readonly #recommendationRequests = new Map<string, Promise<RecommendationResultView | null>>();

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.#database = new DatabaseSync(path);
    this.#database.exec("PRAGMA foreign_keys = ON");
    this.#database.exec("PRAGMA journal_mode = WAL");
    this.#database.exec(`
      CREATE TABLE IF NOT EXISTS meetings (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS invite_capabilities (
        token_hash TEXT PRIMARY KEY,
        meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS meetings_expires_at_idx ON meetings(expires_at);
      CREATE TABLE IF NOT EXISTS recommendation_views (
        meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
        revision TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (meeting_id, revision)
      );
    `);
    this.deleteExpired();
  }

  async save(meeting: Meeting): Promise<void> {
    const insertMeeting = this.#database.prepare(`
      INSERT INTO meetings (id, payload, expires_at) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, expires_at = excluded.expires_at
    `);
    const deleteCapabilities = this.#database.prepare("DELETE FROM invite_capabilities WHERE meeting_id = ?");
    const insertCapability = this.#database.prepare("INSERT INTO invite_capabilities (token_hash, meeting_id) VALUES (?, ?)");
    this.#database.exec("BEGIN IMMEDIATE");
    try {
      insertMeeting.run(meeting.id, JSON.stringify(meeting), expiresAt(meeting));
      deleteCapabilities.run(meeting.id);
      for (const hash of meeting.inviteTokenHashes) insertCapability.run(hash, meeting.id);
      this.#database.exec("COMMIT");
    } catch (error) {
      this.#database.exec("ROLLBACK");
      throw error;
    }
  }

  async findById(id: string): Promise<Meeting | undefined> {
    this.deleteExpired();
    const row = this.#database.prepare("SELECT payload FROM meetings WHERE id = ?").get(id) as MeetingRow | undefined;
    return row ? parseMeeting(row.payload) : undefined;
  }

  async findByInviteTokenHash(inviteTokenHash: string): Promise<Meeting | undefined> {
    this.deleteExpired();
    const row = this.#database.prepare(`
      SELECT meetings.payload
      FROM invite_capabilities
      JOIN meetings ON meetings.id = invite_capabilities.meeting_id
      WHERE invite_capabilities.token_hash = ?
    `).get(inviteTokenHash) as MeetingRow | undefined;
    return row ? parseMeeting(row.payload) : undefined;
  }

  async deleteById(id: string): Promise<boolean> {
    return Number(this.#database.prepare("DELETE FROM meetings WHERE id = ?").run(id).changes) > 0;
  }

  async recommendationView(meetingId: string, revision: string, calculate: () => Promise<RecommendationResultView | null>) {
    const key = `${meetingId}:${revision}`;
    const row = this.#database.prepare("SELECT payload FROM recommendation_views WHERE meeting_id = ? AND revision = ?").get(meetingId, revision) as RecommendationRow | undefined;
    if (row) return JSON.parse(row.payload) as RecommendationResultView;
    const inFlight = this.#recommendationRequests.get(key);
    if (inFlight) return inFlight;
    const request = calculate().then((result) => {
      if (result) this.#database.prepare(`
        INSERT INTO recommendation_views (meeting_id, revision, payload, created_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(meeting_id, revision) DO UPDATE SET payload = excluded.payload, created_at = excluded.created_at
      `).run(meetingId, revision, JSON.stringify(result), new Date().toISOString());
      return result;
    }).finally(() => this.#recommendationRequests.delete(key));
    this.#recommendationRequests.set(key, request);
    return request;
  }

  deleteExpired(now = new Date()): number {
    return Number(this.#database.prepare("DELETE FROM meetings WHERE expires_at <= ?").run(now.toISOString()).changes);
  }

  close(): void {
    this.#database.close();
  }
}
