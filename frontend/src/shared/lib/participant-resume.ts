const STORAGE_KEY = "hc_participant_resumes";
const MAX_RECORDS = 10;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

interface ResumeRecord {
  inviteToken: string;
  resumeToken: string;
  expiresAt: number;
}

type ResumeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function records(storage: ResumeStorage, now: number): ResumeRecord[] {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((record): record is ResumeRecord => {
      if (!record || typeof record !== "object") return false;
      const value = record as Partial<ResumeRecord>;
      return typeof value.inviteToken === "string"
        && TOKEN_PATTERN.test(value.inviteToken)
        && typeof value.resumeToken === "string"
        && TOKEN_PATTERN.test(value.resumeToken)
        && typeof value.expiresAt === "number"
        && value.expiresAt > now;
    });
  } catch {
    return [];
  }
}

export function saveParticipantResumeToken(
  inviteToken: string,
  resumeToken: string,
  storage?: ResumeStorage,
  now = Date.now(),
) {
  if (!TOKEN_PATTERN.test(inviteToken) || !TOKEN_PATTERN.test(resumeToken)) return;
  try {
    const target = storage ?? window.localStorage;
    const next = records(target, now).filter((record) => record.inviteToken !== inviteToken);
    next.unshift({ inviteToken, resumeToken, expiresAt: now + MAX_AGE_MS });
    target.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, MAX_RECORDS)));
  } catch {
    // 쿠키 복원 경로는 유지하고 저장소가 차단된 브라우저에서는 조용히 생략한다.
  }
}

export function getParticipantResumeToken(
  inviteToken: string,
  storage?: ResumeStorage,
  now = Date.now(),
): string | undefined {
  if (!TOKEN_PATTERN.test(inviteToken)) return undefined;
  try {
    const target = storage ?? window.localStorage;
    const active = records(target, now);
    if (active.length === 0) {
      target.removeItem(STORAGE_KEY);
      return undefined;
    }
    target.setItem(STORAGE_KEY, JSON.stringify(active));
    return active.find((record) => record.inviteToken === inviteToken)?.resumeToken;
  } catch {
    return undefined;
  }
}

export function inviteTokenFromApiPath(path: string): string | undefined {
  return path.match(/^\/api\/invites\/([A-Za-z0-9_-]{43})\/(?:participant-session|participants|poll(?:\/vote)?)(?:\?|$)/u)?.[1];
}
