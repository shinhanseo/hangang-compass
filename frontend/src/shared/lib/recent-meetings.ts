const STORAGE_KEY = "hc_recent_host_meetings_v1";
const MAX_RECENT_MEETINGS = 5;

export interface RecentMeeting {
  id: string;
  meetingAt: string;
}

export function normalizeRecentMeetings(value: unknown, now = Date.now()): RecentMeeting[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.id !== "string" || typeof candidate.meetingAt !== "string") return [];
    const meetingAt = new Date(candidate.meetingAt).getTime();
    return Number.isFinite(meetingAt) && meetingAt + 24 * 60 * 60_000 > now
      ? [{ id: candidate.id, meetingAt: candidate.meetingAt }]
      : [];
  }).slice(0, MAX_RECENT_MEETINGS);
}

export function loadRecentMeetings(): RecentMeeting[] {
  try {
    return normalizeRecentMeetings(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function rememberRecentMeeting(meeting: RecentMeeting): void {
  const next = [meeting, ...loadRecentMeetings().filter((item) => item.id !== meeting.id)].slice(0, MAX_RECENT_MEETINGS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function forgetRecentMeeting(meetingId: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(loadRecentMeetings().filter((item) => item.id !== meetingId)));
}

export function replaceRecentMeetings(meetings: RecentMeeting[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meetings.slice(0, MAX_RECENT_MEETINGS)));
}
