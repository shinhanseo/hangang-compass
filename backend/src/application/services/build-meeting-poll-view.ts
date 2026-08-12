import type { Meeting } from "../../domain/meeting/meeting.js";
import { tallyPoll } from "../../domain/meeting/meeting-poll.js";

export function buildMeetingPollView(meeting: Meeting, viewerParticipantId?: string) {
  const poll = meeting.poll;
  if (!poll) return null;
  return {
    round: poll.round,
    status: poll.status,
    candidateParkIds: poll.candidateParkIds,
    candidateLabels: poll.candidateLabels.filter((candidate) => poll.candidateParkIds.includes(candidate.parkId)),
    tally: tallyPoll(poll),
    eligibleCount: meeting.participants.length,
    votedCount: poll.votes.length,
    myVoteParkId: viewerParticipantId
      ? poll.votes.find((vote) => vote.participantId === viewerParticipantId)?.parkId ?? null
      : null,
    canVote: Boolean(viewerParticipantId) && poll.status === "open",
    winnerParkId: poll.winnerParkId,
    resolution: poll.resolution,
  };
}
