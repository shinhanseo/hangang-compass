import { createMeeting } from "./application/use-cases/create-meeting.js";
import { confirmMeetingPark } from "./application/use-cases/confirm-meeting-park.js";
import { getHostMeeting } from "./application/use-cases/get-host-meeting.js";
import { getPublicMeeting } from "./application/use-cases/get-public-meeting.js";
import { getPublicRecommendation } from "./application/use-cases/get-public-recommendation.js";
import { joinMeeting } from "./application/use-cases/join-meeting.js";
import { getParticipantSession } from "./application/use-cases/get-participant-session.js";
import { FakeRecommendationDataSource } from "./infrastructure/providers/fake/fake-recommendation-data-source.js";
import type { CrowdDataProvider } from "./application/ports/crowd-data-provider.js";
import type { TransitRouteProvider } from "./application/ports/transit-route-provider.js";
import type { OriginPlaceProvider } from "./application/ports/origin-place-provider.js";
import type { NearbyPlaceProvider } from "./application/ports/nearby-place-provider.js";
import { LiveCrowdRecommendationDataSource } from "./infrastructure/providers/seoul/live-crowd-recommendation-data-source.js";
import { LiveRouteRecommendationDataSource } from "./infrastructure/providers/kakao/live-route-recommendation-data-source.js";
import { InMemoryMeetingRepository } from "./infrastructure/persistence/in-memory-meeting-repository.js";
import { NodeCapabilityTokenService } from "./infrastructure/security/node-capability-token-service.js";
import { FakeOriginPlaceProvider } from "./infrastructure/providers/fake/fake-origin-place-provider.js";
import { FakeNearbyPlaceProvider } from "./infrastructure/providers/fake/fake-nearby-place-provider.js";
import type { TravelMode, TravelPattern } from "./domain/meeting/meeting.js";
import { setSharedOrigin } from "./application/use-cases/set-shared-origin.js";
import { setHostParticipant } from "./application/use-cases/set-host-participant.js";
import { createHostRecoveryLink } from "./application/use-cases/create-host-recovery-link.js";
import { recoverHostAccess } from "./application/use-cases/recover-host-access.js";
import type { MeetingRepository } from "./application/ports/meeting-repository.js";
import { getHostAccessSummary } from "./application/use-cases/get-host-access-summary.js";
import { deleteMeeting } from "./application/use-cases/delete-meeting.js";
import { NodeRandomIndexProvider } from "./infrastructure/random/node-random-index-provider.js";
import { closeMeetingPoll, confirmMeetingPollWinner, getHostMeetingPoll, getPublicMeetingPoll, randomizeMeetingPoll, restartMeetingPoll, startMeetingPoll, voteHostMeetingPoll, votePublicMeetingPoll } from "./application/use-cases/manage-meeting-poll.js";
import { getHostNearbyPlaces, getParticipantNearbyPlaces } from "./application/use-cases/get-nearby-places.js";

export function createApplicationServices(options: {
  crowdProvider?: CrowdDataProvider;
  routeProvider?: TransitRouteProvider;
  drivingRouteProvider?: TransitRouteProvider;
  walkingRouteProvider?: TransitRouteProvider;
  originPlaceProvider?: OriginPlaceProvider;
  nearbyPlaceProvider?: NearbyPlaceProvider;
  meetingRepository?: MeetingRepository;
} = {}) {
  const repository = options.meetingRepository ?? new InMemoryMeetingRepository();
  const tokens = new NodeCapabilityTokenService();
  const random = new NodeRandomIndexProvider();
  const fakeRecommendations = new FakeRecommendationDataSource();
  const origins = options.originPlaceProvider ?? new FakeOriginPlaceProvider();
  const nearbyPlaces = options.nearbyPlaceProvider ?? new FakeNearbyPlaceProvider();
  const crowdRecommendations = options.crowdProvider
    ? new LiveCrowdRecommendationDataSource(fakeRecommendations, options.crowdProvider)
    : fakeRecommendations;
  const recommendations = options.routeProvider
    ? new LiveRouteRecommendationDataSource(crowdRecommendations, options.routeProvider, origins, {
        drivingRoutes: options.drivingRouteProvider,
        walkingRoutes: options.walkingRouteProvider,
      })
    : crowdRecommendations;

  return {
    searchOriginPlaces: (query: string) => origins.search(query),
    createMeeting: (meetingAt: string, travelPattern: TravelPattern) => createMeeting({ repository, tokens, recommendations }, meetingAt, travelPattern),
    publicMeeting: (inviteToken: string) => getPublicMeeting(repository, tokens, inviteToken),
    publicRecommendation: (inviteToken: string) => getPublicRecommendation(repository, tokens, recommendations, inviteToken),
    participantSession: (inviteToken: string, participantToken: string | undefined) =>
      getParticipantSession(repository, tokens, recommendations, inviteToken, participantToken),
    joinMeeting: (input: { inviteToken: string; alias: string; originPlaceId: string; originPlaceName: string; destinationPlaceId?: string; destinationPlaceName?: string; travelMode: TravelMode }) =>
      joinMeeting(repository, tokens, recommendations, origins, input),
    hostMeeting: (meetingId: string, hostToken: string | undefined) =>
      getHostMeeting(repository, tokens, recommendations, meetingId, hostToken),
    hostAccessSummary: (meetingId: string, hostToken: string | undefined) =>
      getHostAccessSummary(repository, tokens, meetingId, hostToken),
    setSharedOrigin: (input: { meetingId: string; hostToken: string | undefined; placeId: string; placeName: string }) =>
      setSharedOrigin(repository, tokens, origins, input),
    setHostParticipant: (input: { meetingId: string; hostToken: string | undefined; alias: string; originPlaceId: string; originPlaceName: string; destinationPlaceId?: string; destinationPlaceName?: string; travelMode: TravelMode }) =>
      setHostParticipant(repository, tokens, recommendations, origins, input),
    confirmMeetingPark: (meetingId: string, hostToken: string | undefined, parkId: string) =>
      confirmMeetingPark(repository, tokens, recommendations, meetingId, hostToken, parkId),
    createHostRecoveryLink: (meetingId: string, hostToken: string | undefined) =>
      createHostRecoveryLink(repository, tokens, meetingId, hostToken),
    recoverHostAccess: (meetingId: string, hostToken: string, inviteToken: string) =>
      recoverHostAccess(repository, tokens, meetingId, hostToken, inviteToken),
    deleteMeeting: (meetingId: string, hostToken: string | undefined) =>
      deleteMeeting(repository, tokens, meetingId, hostToken),
    startMeetingPoll: (meetingId: string, hostToken: string | undefined) => startMeetingPoll(repository, tokens, recommendations, meetingId, hostToken),
    publicMeetingPoll: (inviteToken: string, participantToken: string | undefined) => getPublicMeetingPoll(repository, tokens, inviteToken, participantToken),
    hostMeetingPoll: (meetingId: string, hostToken: string | undefined) => getHostMeetingPoll(repository, tokens, meetingId, hostToken),
    votePublicMeetingPoll: (inviteToken: string, participantToken: string | undefined, parkId: string) => votePublicMeetingPoll(repository, tokens, inviteToken, participantToken, parkId),
    voteHostMeetingPoll: (meetingId: string, hostToken: string | undefined, parkId: string) => voteHostMeetingPoll(repository, tokens, meetingId, hostToken, parkId),
    closeMeetingPoll: (meetingId: string, hostToken: string | undefined) => closeMeetingPoll(repository, tokens, meetingId, hostToken),
    restartMeetingPoll: (meetingId: string, hostToken: string | undefined) => restartMeetingPoll(repository, tokens, meetingId, hostToken),
    randomizeMeetingPoll: (meetingId: string, hostToken: string | undefined) => randomizeMeetingPoll(repository, tokens, random, meetingId, hostToken),
    confirmMeetingPollWinner: (meetingId: string, hostToken: string | undefined) => confirmMeetingPollWinner(repository, tokens, meetingId, hostToken),
    hostNearbyPlaces: (meetingId: string, hostToken: string | undefined) =>
      getHostNearbyPlaces(repository, tokens, nearbyPlaces, meetingId, hostToken),
    participantNearbyPlaces: (inviteToken: string, participantToken: string | undefined) =>
      getParticipantNearbyPlaces(repository, tokens, nearbyPlaces, inviteToken, participantToken),
  };
}

export type ApplicationServices = ReturnType<typeof createApplicationServices>;
