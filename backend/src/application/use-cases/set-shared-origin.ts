import type { CapabilityTokenService } from "../ports/capability-token-service.js";
import type { MeetingRepository } from "../ports/meeting-repository.js";
import type { OriginPlaceProvider } from "../ports/origin-place-provider.js";
import { isAuthorizedHost } from "../services/authorize-host.js";

export async function setSharedOrigin(
  repository: MeetingRepository,
  tokens: CapabilityTokenService,
  origins: OriginPlaceProvider,
  input: {
    meetingId: string;
    hostToken: string | undefined;
    placeId: string;
    placeName: string;
  },
) {
  const meeting = await repository.findById(input.meetingId);
  if (!isAuthorizedHost(meeting, tokens, input.hostToken)) return null;
  if (meeting.travelPattern !== "shared_origin" || meeting.participants.length > 0) return null;
  const place = await origins.resolve({ id: input.placeId, name: input.placeName });
  if (!place) return null;
  meeting.sharedOrigin = { placeId: place.id, placeName: place.name };
  await repository.save(meeting);
  return { sharedOriginName: place.name };
}
