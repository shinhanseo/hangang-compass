import type { CapabilityTokenService } from "../ports/capability-token-service.js";
import type { MeetingRepository } from "../ports/meeting-repository.js";
import type { RandomIndexProvider } from "../ports/random-index-provider.js";
import type { RecommendationDataSource } from "../ports/recommendation-data-source.js";
import { closePoll, resolveTiedPollRandomly, restartTiedPoll } from "../../domain/meeting/meeting-poll.js";
import { authorizedParticipantId } from "../services/authorize-participant.js";
import { isAuthorizedHost } from "../services/authorize-host.js";
import { buildMeetingPollView } from "../services/build-meeting-poll-view.js";
import { buildRecommendationView } from "../services/build-recommendation-view.js";

export async function startMeetingPoll(repository: MeetingRepository, tokens: CapabilityTokenService, recommendations: RecommendationDataSource, meetingId: string, hostToken: string | undefined) {
  const meeting = await repository.findById(meetingId);
  if (!isAuthorizedHost(meeting, tokens, hostToken) || meeting.confirmedParkId) return null;
  if (!meeting.poll) {
    const result = await buildRecommendationView(meeting, recommendations, repository);
    if (!result) return null;
    meeting.poll = {
      round: 1,
      status: "open",
      candidateParkIds: [result.recommended.parkId, ...result.alternatives.map((park) => park.parkId)],
      candidateLabels: [result.recommended, ...result.alternatives].map((park) => ({ parkId: park.parkId, parkName: park.parkName, recommended: park.role === "recommended" })),
      votes: [],
      winnerParkId: null,
      resolution: null,
    };
    await repository.save(meeting);
  }
  const hostId = meeting.participants.find((participant) => participant.role === "host")?.id;
  return buildMeetingPollView(meeting, hostId);
}

export async function getPublicMeetingPoll(repository: MeetingRepository, tokens: CapabilityTokenService, inviteToken: string, participantToken: string | undefined) {
  const meeting = await repository.findByInviteTokenHash(tokens.hashCapability(inviteToken));
  if (!meeting?.poll) return null;
  return buildMeetingPollView(meeting, authorizedParticipantId(meeting, tokens, participantToken));
}

export async function getHostMeetingPoll(repository: MeetingRepository, tokens: CapabilityTokenService, meetingId: string, hostToken: string | undefined) {
  const meeting = await repository.findById(meetingId);
  if (!isAuthorizedHost(meeting, tokens, hostToken) || !meeting.poll) return null;
  const hostId = meeting.participants.find((participant) => participant.role === "host")?.id;
  return buildMeetingPollView(meeting, hostId);
}

async function saveVote(repository: MeetingRepository, meeting: NonNullable<Awaited<ReturnType<MeetingRepository["findById"]>>>, participantId: string, parkId: string) {
  if (!meeting.poll || meeting.poll.status !== "open" || !meeting.poll.candidateParkIds.includes(parkId)) return null;
  meeting.poll.votes = [...meeting.poll.votes.filter((vote) => vote.participantId !== participantId), { participantId, parkId }];
  if (meeting.poll.votes.length === meeting.participants.length) meeting.poll = closePoll(meeting.poll) ?? meeting.poll;
  await repository.save(meeting);
  return buildMeetingPollView(meeting, participantId);
}

export async function votePublicMeetingPoll(repository: MeetingRepository, tokens: CapabilityTokenService, inviteToken: string, participantToken: string | undefined, parkId: string) {
  const meeting = await repository.findByInviteTokenHash(tokens.hashCapability(inviteToken));
  if (!meeting) return null;
  const participantId = authorizedParticipantId(meeting, tokens, participantToken);
  return participantId ? saveVote(repository, meeting, participantId, parkId) : null;
}

export async function voteHostMeetingPoll(repository: MeetingRepository, tokens: CapabilityTokenService, meetingId: string, hostToken: string | undefined, parkId: string) {
  const meeting = await repository.findById(meetingId);
  if (!isAuthorizedHost(meeting, tokens, hostToken)) return null;
  const hostId = meeting.participants.find((participant) => participant.role === "host")?.id;
  return hostId ? saveVote(repository, meeting, hostId, parkId) : null;
}

export async function closeMeetingPoll(repository: MeetingRepository, tokens: CapabilityTokenService, meetingId: string, hostToken: string | undefined) {
  const meeting = await repository.findById(meetingId);
  if (!isAuthorizedHost(meeting, tokens, hostToken) || !meeting.poll) return null;
  const closed = closePoll(meeting.poll);
  if (!closed) return null;
  meeting.poll = closed;
  await repository.save(meeting);
  const hostId = meeting.participants.find((participant) => participant.role === "host")?.id;
  return buildMeetingPollView(meeting, hostId);
}

export async function restartMeetingPoll(repository: MeetingRepository, tokens: CapabilityTokenService, meetingId: string, hostToken: string | undefined) {
  const meeting = await repository.findById(meetingId);
  if (!isAuthorizedHost(meeting, tokens, hostToken) || !meeting.poll) return null;
  const restarted = restartTiedPoll(meeting.poll);
  if (!restarted) return null;
  meeting.poll = restarted;
  await repository.save(meeting);
  const hostId = meeting.participants.find((participant) => participant.role === "host")?.id;
  return buildMeetingPollView(meeting, hostId);
}

export async function randomizeMeetingPoll(repository: MeetingRepository, tokens: CapabilityTokenService, random: RandomIndexProvider, meetingId: string, hostToken: string | undefined) {
  const meeting = await repository.findById(meetingId);
  if (!isAuthorizedHost(meeting, tokens, hostToken) || !meeting.poll) return null;
  const resolved = resolveTiedPollRandomly(meeting.poll, random.pickIndex(meeting.poll.candidateParkIds.length));
  if (!resolved) return null;
  meeting.poll = resolved;
  await repository.save(meeting);
  const hostId = meeting.participants.find((participant) => participant.role === "host")?.id;
  return buildMeetingPollView(meeting, hostId);
}

export async function confirmMeetingPollWinner(repository: MeetingRepository, tokens: CapabilityTokenService, meetingId: string, hostToken: string | undefined) {
  const meeting = await repository.findById(meetingId);
  if (!isAuthorizedHost(meeting, tokens, hostToken) || meeting.poll?.status !== "completed" || !meeting.poll.winnerParkId) return null;
  meeting.confirmedParkId = meeting.poll.winnerParkId;
  await repository.save(meeting);
  return { confirmedParkId: meeting.poll.winnerParkId };
}
