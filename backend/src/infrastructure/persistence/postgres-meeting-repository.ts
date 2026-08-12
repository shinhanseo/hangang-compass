import { Pool, type PoolClient } from "pg";

import type { MeetingRepository } from "../../application/ports/meeting-repository.js";
import type { Meeting } from "../../domain/meeting/meeting.js";
import { deletionDueAt } from "../../domain/privacy/privacy-policy.js";

type MeetingRow = { payload: unknown };

const schemaSql = `
  CREATE TABLE IF NOT EXISTS meetings (
    id TEXT PRIMARY KEY,
    payload JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
  );
  CREATE TABLE IF NOT EXISTS invite_capabilities (
    token_hash TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS meetings_expires_at_idx ON meetings(expires_at);
`;

function expiresAt(meeting: Meeting): string {
  return deletionDueAt(meeting.confirmedParkId
    ? { status: "scheduled", createdAt: new Date(meeting.createdAt), meetingAt: new Date(meeting.meetingAt) }
    : { status: "draft", createdAt: new Date(meeting.createdAt) }).toISOString();
}

function parseMeeting(payload: unknown): Meeting | undefined {
  try {
    const value = (typeof payload === "string" ? JSON.parse(payload) : payload) as Partial<Meeting> | null;
    return value
      && typeof value.id === "string"
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

export class PostgresMeetingRepository implements MeetingRepository {
  readonly #pool: Pool;
  readonly #ready: Promise<void>;

  constructor(connectionString: string) {
    this.#pool = new Pool({ connectionString, max: 5 });
    this.#ready = this.#pool.query(schemaSql).then(() => undefined);
  }

  async initialize(): Promise<void> {
    await this.#ready;
    await this.deleteExpired();
  }

  async save(meeting: Meeting): Promise<void> {
    await this.#ready;
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`
        INSERT INTO meetings (id, payload, expires_at) VALUES ($1, $2::jsonb, $3)
        ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, expires_at = excluded.expires_at
      `, [meeting.id, JSON.stringify(meeting), expiresAt(meeting)]);
      await client.query("DELETE FROM invite_capabilities WHERE meeting_id = $1", [meeting.id]);
      await this.insertCapabilities(client, meeting);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<Meeting | undefined> {
    await this.#ready;
    await this.deleteExpired();
    const result = await this.#pool.query<MeetingRow>("SELECT payload FROM meetings WHERE id = $1", [id]);
    return result.rows[0] ? parseMeeting(result.rows[0].payload) : undefined;
  }

  async findByInviteTokenHash(inviteTokenHash: string): Promise<Meeting | undefined> {
    await this.#ready;
    await this.deleteExpired();
    const result = await this.#pool.query<MeetingRow>(`
      SELECT meetings.payload
      FROM invite_capabilities
      JOIN meetings ON meetings.id = invite_capabilities.meeting_id
      WHERE invite_capabilities.token_hash = $1
    `, [inviteTokenHash]);
    return result.rows[0] ? parseMeeting(result.rows[0].payload) : undefined;
  }

  async deleteById(id: string): Promise<boolean> {
    await this.#ready;
    const result = await this.#pool.query("DELETE FROM meetings WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async deleteExpired(now = new Date()): Promise<number> {
    await this.#ready;
    const result = await this.#pool.query("DELETE FROM meetings WHERE expires_at <= $1", [now.toISOString()]);
    return result.rowCount ?? 0;
  }

  async close(): Promise<void> {
    await this.#pool.end();
  }

  private async insertCapabilities(client: PoolClient, meeting: Meeting): Promise<void> {
    if (meeting.inviteTokenHashes.length === 0) return;
    await client.query(`
      INSERT INTO invite_capabilities (token_hash, meeting_id)
      SELECT token_hash, $2 FROM unnest($1::text[]) AS token_hash
    `, [meeting.inviteTokenHashes, meeting.id]);
  }
}
