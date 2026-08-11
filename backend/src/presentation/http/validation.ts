export function isFutureMeetingTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.getTime() > Date.now();
}

export function participantInput(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const candidate = body as Record<string, unknown>;
  const alias = typeof candidate.alias === "string" ? candidate.alias.trim() : "";
  const stationId = typeof candidate.stationId === "string" ? candidate.stationId : "";
  return alias.length >= 1 && alias.length <= 20 ? { alias, stationId } : null;
}
