import type { Meeting, Participant } from "../../domain/meeting/meeting.js";
import type { CapabilityTokenService } from "../ports/capability-token-service.js";
import type { OriginPlaceProvider } from "../ports/origin-place-provider.js";

export async function addMeetingParticipant(
  meeting: Meeting,
  tokens: CapabilityTokenService,
  origins: OriginPlaceProvider,
  input: {
    alias: string;
    role: NonNullable<Participant["role"]>;
    originPlaceId: string;
    originPlaceName: string;
    destinationPlaceId?: string;
    destinationPlaceName?: string;
    travelMode: NonNullable<Participant["travelMode"]>;
  },
): Promise<Participant | null> {
  const requestedOrigin = meeting.travelPattern === "shared_origin"
    ? meeting.sharedOrigin
    : { placeId: input.originPlaceId, placeName: input.originPlaceName };
  if (!requestedOrigin) return null;
  const origin = await origins.resolve({ id: requestedOrigin.placeId, name: requestedOrigin.placeName });
  if (!origin) return null;
  const hasSeparateDestination = Boolean(input.destinationPlaceId && input.destinationPlaceName);
  const requestedDestination = meeting.travelPattern === "individual_round_trip" && !hasSeparateDestination
    ? { id: origin.id, name: origin.name }
    : { id: input.destinationPlaceId ?? "", name: input.destinationPlaceName ?? "" };
  const destination = await origins.resolve(requestedDestination);
  if (!destination) return null;
  return {
    id: tokens.generateId(),
    alias: input.alias,
    role: input.role,
    origin: { placeId: origin.id, placeName: origin.name },
    destination: { placeId: destination.id, placeName: destination.name },
    travelMode: input.travelMode,
  };
}
