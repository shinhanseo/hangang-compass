import type { MeetingPoll } from "./meeting.js";

export function tallyPoll(poll: MeetingPoll): Array<{ parkId: string; count: number }> {
  return poll.candidateParkIds.map((parkId) => ({
    parkId,
    count: poll.votes.filter((vote) => vote.parkId === parkId).length,
  }));
}

export function closePoll(poll: MeetingPoll): MeetingPoll | null {
  if (poll.status !== "open" || poll.votes.length === 0) return null;
  const tally = tallyPoll(poll);
  const maximum = Math.max(...tally.map((item) => item.count));
  const winners = tally.filter((item) => item.count === maximum).map((item) => item.parkId);
  return winners.length === 1
    ? { ...poll, status: "completed", winnerParkId: winners[0]!, resolution: "vote" }
    : { ...poll, status: "tied", candidateParkIds: winners, winnerParkId: null, resolution: null };
}

export function restartTiedPoll(poll: MeetingPoll): MeetingPoll | null {
  return poll.status === "tied"
    ? { ...poll, round: poll.round + 1, status: "open", votes: [], winnerParkId: null, resolution: null }
    : null;
}

export function resolveTiedPollRandomly(poll: MeetingPoll, selectedIndex: number): MeetingPoll | null {
  if (poll.status !== "tied" || selectedIndex < 0 || selectedIndex >= poll.candidateParkIds.length) return null;
  return { ...poll, status: "completed", winnerParkId: poll.candidateParkIds[selectedIndex]!, resolution: "random" };
}
