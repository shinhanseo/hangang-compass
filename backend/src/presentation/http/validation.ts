export function isFutureMeetingTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.getTime() > Date.now();
}

export function participantInput(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const candidate = body as Record<string, unknown>;
  const alias = typeof candidate.alias === "string" ? candidate.alias.trim() : "";
  const originPlaceId = typeof candidate.originPlaceId === "string" ? candidate.originPlaceId.trim() : "";
  const originPlaceName = typeof candidate.originPlaceName === "string" ? candidate.originPlaceName.trim() : "";
  const destinationPlaceId = typeof candidate.destinationPlaceId === "string" ? candidate.destinationPlaceId.trim() : "";
  const destinationPlaceName = typeof candidate.destinationPlaceName === "string" ? candidate.destinationPlaceName.trim() : "";
  const travelMode: TravelMode | null = candidate.travelMode === undefined
    ? "public_transit"
    : candidate.travelMode === "public_transit" || candidate.travelMode === "car"
      ? candidate.travelMode
      : null;
  const originValid = (originPlaceId.length === 0 && originPlaceName.length === 0)
    || (originPlaceId.length >= 1 && originPlaceId.length <= 80 && originPlaceName.length >= 1 && originPlaceName.length <= 100);
  const destinationValid = (destinationPlaceId.length === 0 && destinationPlaceName.length === 0)
    || (destinationPlaceId.length >= 1 && destinationPlaceId.length <= 80 && destinationPlaceName.length >= 1 && destinationPlaceName.length <= 100);
  return alias.length >= 1 && alias.length <= 20
    && originValid
    && destinationValid
    && travelMode !== null
    ? { alias, originPlaceId, originPlaceName, destinationPlaceId, destinationPlaceName, travelMode }
    : null;
}

export function travelPattern(value: unknown) {
  return value === "shared_origin" || value === "individual_round_trip" ? value : null;
}

export function placeQuery(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const query = value.trim().replace(/\s+/gu, " ");
  return query.length >= 2 && query.length <= 50 ? query : null;
}
import type { TravelMode } from "../../domain/meeting/meeting.js";
