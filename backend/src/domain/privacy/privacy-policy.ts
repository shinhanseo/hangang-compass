export type CapabilityRole = "invitee" | "participant" | "host";
export type CapabilityAction =
  | "view_public_meeting"
  | "join_meeting"
  | "view_own_origin"
  | "edit_own_origin"
  | "delete_own_participation"
  | "view_participant_aliases_and_times"
  | "edit_meeting"
  | "remove_participant"
  | "confirm_recommendation"
  | "delete_meeting"
  | "view_other_origin";

export const PROPOSED_PRIVACY_POLICY = {
  version: "privacy-spike-v1",
  status: "approved",
  tokenRandomBytes: 32,
  draftRetentionDays: 7,
  afterMeetingRetentionHours: 24,
  backupMaximumDays: 30,
  persistRawAddress: false,
  persistPreciseCoordinates: false,
  mvpOriginInput: "provider_place_reference_only",
} as const;

const CAPABILITIES: Record<CapabilityRole, ReadonlySet<CapabilityAction>> = {
  invitee: new Set([
    "view_public_meeting",
    "join_meeting",
  ]),
  participant: new Set([
    "view_public_meeting",
    "view_own_origin",
    "edit_own_origin",
    "delete_own_participation",
    "view_participant_aliases_and_times",
  ]),
  host: new Set([
    "view_public_meeting",
    "view_participant_aliases_and_times",
    "edit_meeting",
    "remove_participant",
    "confirm_recommendation",
    "delete_meeting",
  ]),
};

export function can(role: CapabilityRole, action: CapabilityAction): boolean {
  return CAPABILITIES[role].has(action);
}

const DAY_MS = 24 * 60 * 60 * 1_000;
const HOUR_MS = 60 * 60 * 1_000;

export interface RetentionInput {
  status: "draft" | "scheduled" | "deleted";
  createdAt: Date;
  meetingAt?: Date;
  deletedAt?: Date;
}

export function deletionDueAt(input: RetentionInput): Date {
  if (input.status === "deleted") {
    if (!input.deletedAt) throw new Error("deletedAt_required");
    return input.deletedAt;
  }
  if (input.status === "scheduled") {
    if (!input.meetingAt) throw new Error("meetingAt_required");
    return new Date(
      input.meetingAt.getTime() + PROPOSED_PRIVACY_POLICY.afterMeetingRetentionHours * HOUR_MS,
    );
  }
  return new Date(
    input.createdAt.getTime() + PROPOSED_PRIVACY_POLICY.draftRetentionDays * DAY_MS,
  );
}

export interface OperationalLogInput {
  requestId?: string;
  routeTemplate?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  provider?: string;
  errorCode?: string;
  [key: string]: unknown;
}

const ALLOWED_LOG_FIELDS = [
  "requestId",
  "routeTemplate",
  "method",
  "statusCode",
  "durationMs",
  "provider",
  "errorCode",
] as const;

export function sanitizeOperationalLog(input: OperationalLogInput): OperationalLogInput {
  return Object.fromEntries(
    ALLOWED_LOG_FIELDS.flatMap((field) => input[field] === undefined ? [] : [[field, input[field]]]),
  );
}
