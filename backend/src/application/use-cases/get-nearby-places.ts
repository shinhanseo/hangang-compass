import type { CapabilityTokenService } from "../ports/capability-token-service.js";
import type { MeetingRepository } from "../ports/meeting-repository.js";
import type { NearbyPlaceProvider } from "../ports/nearby-place-provider.js";
import { isAuthorizedHost } from "../services/authorize-host.js";
import { authorizedParticipantId } from "../services/authorize-participant.js";

export async function getHostNearbyPlaces(
  repository: MeetingRepository,
  tokens: CapabilityTokenService,
  places: NearbyPlaceProvider,
  meetingId: string,
  hostToken: string | undefined,
) {
  const meeting = await repository.findById(meetingId);
  if (!isAuthorizedHost(meeting, tokens, hostToken) || !meeting.confirmedParkId) return null;
  return places.placesNear(meeting.confirmedParkId);
}

export async function getParticipantNearbyPlaces(
  repository: MeetingRepository,
  tokens: CapabilityTokenService,
  places: NearbyPlaceProvider,
  inviteToken: string,
  participantToken: string | undefined,
) {
  const meeting = await repository.findByInviteTokenHash(tokens.hashCapability(inviteToken));
  if (!meeting || !authorizedParticipantId(meeting, tokens, participantToken) || !meeting.confirmedParkId) return null;
  return places.placesNear(meeting.confirmedParkId);
}
