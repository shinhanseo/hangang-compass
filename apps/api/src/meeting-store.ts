import { createHash, randomUUID } from "node:crypto";

import { FAIRNESS_POLICIES, generateCapabilityToken, recommend } from "@hangang-compass/domain";

import { fakeCandidates, meetingPointFor, stationExists } from "./fake-data.js";

interface Participant {
  id: string;
  alias: string;
  stationId: string;
}

interface Meeting {
  id: string;
  meetingAt: string;
  inviteTokenHash: string;
  hostTokenHash: string;
  participants: Participant[];
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function resultFor(meeting: Meeting) {
  if (meeting.participants.length < 2) return null;
  const candidates = fakeCandidates(meeting.participants);
  const result = recommend({
    stage: "provisional",
    participantIds: meeting.participants.map((participant) => participant.id),
    candidates,
  }, FAIRNESS_POLICIES.balanced);
  if (!result.recommended || !result.alternative) return null;

  const candidateById = new Map(candidates.map((candidate) => [candidate.parkId, candidate]));
  const view = (candidate: typeof result.recommended) => ({
    parkId: candidate.parkId,
    parkName: candidate.parkName,
    meetingPoint: meetingPointFor(candidate.parkId),
    travel: candidate.travel,
    participantTimes: candidateById.get(candidate.parkId)?.routes.map((route) => ({
      alias: meeting.participants.find((participant) => participant.id === route.participantId)?.alias ?? "참여자",
      minutes: route.minutes,
    })) ?? [],
  });
  return {
    stage: "fake_provisional",
    recommended: view(result.recommended),
    alternative: view(result.alternative),
    nearTie: result.nearTie,
    explanation: result.comparison?.summary ?? "이동 공평성을 기준으로 비교했습니다.",
    notice: "고정된 테스트 이동시간으로 계산한 프로토타입 결과입니다.",
  };
}

function hostView(meeting: Meeting) {
  return {
    id: meeting.id,
    meetingAt: meeting.meetingAt,
    participantCount: meeting.participants.length,
    participants: meeting.participants.map((participant) => ({ alias: participant.alias })),
    result: resultFor(meeting),
  };
}

export function createMeetingStore() {
  const meetings = new Map<string, Meeting>();
  const inviteIndex = new Map<string, string>();

  return {
    create(meetingAt: string) {
      const id = randomUUID();
      const inviteToken = generateCapabilityToken();
      const hostToken = generateCapabilityToken();
      const meeting: Meeting = {
        id,
        meetingAt,
        inviteTokenHash: hashToken(inviteToken),
        hostTokenHash: hashToken(hostToken),
        participants: [],
      };
      meetings.set(id, meeting);
      inviteIndex.set(meeting.inviteTokenHash, id);
      return { meeting: hostView(meeting), inviteToken, hostToken };
    },
    publicByInvite(inviteToken: string) {
      const id = inviteIndex.get(hashToken(inviteToken));
      const meeting = id ? meetings.get(id) : undefined;
      return meeting ? {
        meetingAt: meeting.meetingAt,
        participantCount: meeting.participants.length,
      } : null;
    },
    addParticipant(inviteToken: string, alias: string, stationId: string) {
      const id = inviteIndex.get(hashToken(inviteToken));
      const meeting = id ? meetings.get(id) : undefined;
      if (!meeting || !stationExists(stationId) || meeting.participants.length >= 8) return null;
      meeting.participants.push({ id: randomUUID(), alias, stationId });
      return {
        participantCount: meeting.participants.length,
        result: resultFor(meeting),
      };
    },
    hostById(id: string, hostToken: string | undefined) {
      const meeting = meetings.get(id);
      if (!meeting || !hostToken || hashToken(hostToken) !== meeting.hostTokenHash) return null;
      return hostView(meeting);
    },
  };
}

export type MeetingStore = ReturnType<typeof createMeetingStore>;
