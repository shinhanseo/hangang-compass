import { getParticipantResumeToken, inviteTokenFromApiPath } from "../lib/participant-resume";

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set("content-type", "application/json");
  const inviteToken = inviteTokenFromApiPath(path);
  const resumeToken = inviteToken ? getParticipantResumeToken(inviteToken) : undefined;
  if (resumeToken) headers.set("x-hc-participant-resume", resumeToken);
  const response = await fetch(path, {
    ...options,
    headers,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "request_failed");
  return body;
}
