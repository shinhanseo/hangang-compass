import type { Meeting } from "../../domain/meeting/meeting.js";
import {
  FAIRNESS_POLICIES,
  recommend,
  type EvaluatedCandidate,
} from "../../domain/recommendation/recommendation.js";
import type { RecommendationResultView } from "../models/meeting-view.js";
import type { RecommendationDataSource } from "../ports/recommendation-data-source.js";

export function buildRecommendationView(
  meeting: Meeting,
  dataSource: RecommendationDataSource,
): RecommendationResultView | null {
  if (meeting.participants.length < 2) return null;
  const candidates = dataSource.candidates(meeting.participants);
  const result = recommend({
    stage: "provisional",
    participantIds: meeting.participants.map((participant) => participant.id),
    candidates,
  }, FAIRNESS_POLICIES.balanced);
  if (!result.recommended?.travel || !result.alternative?.travel) return null;

  const candidateById = new Map(candidates.map((candidate) => [candidate.parkId, candidate]));
  const view = (candidate: EvaluatedCandidate) => ({
    parkId: candidate.parkId,
    parkName: candidate.parkName,
    meetingPoint: dataSource.meetingPointFor(candidate.parkId),
    travel: candidate.travel!,
    participantTimes: candidateById.get(candidate.parkId)?.routes.flatMap((route) => {
      const participant = meeting.participants.find((item) => item.id === route.participantId);
      return participant && route.minutes !== null
        ? [{ alias: participant.alias, minutes: route.minutes }]
        : [];
    }) ?? [],
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

export function toHostMeetingView(meeting: Meeting, dataSource: RecommendationDataSource) {
  return {
    id: meeting.id,
    meetingAt: meeting.meetingAt,
    participantCount: meeting.participants.length,
    participants: meeting.participants.map((participant) => ({ alias: participant.alias })),
    result: buildRecommendationView(meeting, dataSource),
  };
}
