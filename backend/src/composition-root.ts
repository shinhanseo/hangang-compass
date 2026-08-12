import { createMeeting } from "./application/use-cases/create-meeting.js";
import { confirmMeetingPark } from "./application/use-cases/confirm-meeting-park.js";
import { getHostMeeting } from "./application/use-cases/get-host-meeting.js";
import { getPublicMeeting } from "./application/use-cases/get-public-meeting.js";
import { joinMeeting } from "./application/use-cases/join-meeting.js";
import { FakeRecommendationDataSource } from "./infrastructure/providers/fake/fake-recommendation-data-source.js";
import type { CrowdDataProvider } from "./application/ports/crowd-data-provider.js";
import { LiveCrowdRecommendationDataSource } from "./infrastructure/providers/seoul/live-crowd-recommendation-data-source.js";
import { InMemoryMeetingRepository } from "./infrastructure/persistence/in-memory-meeting-repository.js";
import { NodeCapabilityTokenService } from "./infrastructure/security/node-capability-token-service.js";

export function createApplicationServices(options: { crowdProvider?: CrowdDataProvider } = {}) {
  const repository = new InMemoryMeetingRepository();
  const tokens = new NodeCapabilityTokenService();
  const fakeRecommendations = new FakeRecommendationDataSource();
  const recommendations = options.crowdProvider
    ? new LiveCrowdRecommendationDataSource(fakeRecommendations, options.crowdProvider)
    : fakeRecommendations;

  return {
    stations: () => recommendations.stations(),
    createMeeting: (meetingAt: string) => createMeeting({ repository, tokens, recommendations }, meetingAt),
    publicMeeting: (inviteToken: string) => getPublicMeeting(repository, tokens, inviteToken),
    joinMeeting: (input: { inviteToken: string; alias: string; stationId: string }) =>
      joinMeeting(repository, tokens, recommendations, input),
    hostMeeting: (meetingId: string, hostToken: string | undefined) =>
      getHostMeeting(repository, tokens, recommendations, meetingId, hostToken),
    confirmMeetingPark: (meetingId: string, hostToken: string | undefined, parkId: string) =>
      confirmMeetingPark(repository, tokens, recommendations, meetingId, hostToken, parkId),
  };
}

export type ApplicationServices = ReturnType<typeof createApplicationServices>;
