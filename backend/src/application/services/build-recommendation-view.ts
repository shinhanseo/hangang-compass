import type { Meeting } from "../../domain/meeting/meeting.js";
import {
  FAIRNESS_POLICIES,
  recommend,
  type EvaluatedCandidate,
} from "../../domain/recommendation/recommendation.js";
import type { CandidateRole, RecommendationResultView } from "../models/meeting-view.js";
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
  if (!result.recommended?.travel || result.ranked.length < 3) return null;

  const candidateById = new Map(candidates.map((candidate) => [candidate.parkId, candidate]));
  const travelAlternative = result.ranked[1]!;
  const usedTags = new Set([
    ...dataSource.experienceFor(result.recommended.parkId).signatureTags,
    ...dataSource.experienceFor(travelAlternative.parkId).signatureTags,
  ]);
  const experienceAlternative = result.ranked.slice(2, 7).find((candidate) =>
    dataSource.experienceFor(candidate.parkId).signatureTags.some((tag) => !usedTags.has(tag)))
    ?? result.ranked[2]!;

  const view = (candidate: EvaluatedCandidate, role: CandidateRole) => {
    const experience = dataSource.experienceFor(candidate.parkId);
    const averageDelta = Math.round(
      ((candidate.travel?.averageMinutes ?? 0) - result.recommended!.travel!.averageMinutes) * 10,
    ) / 10;
    const selectionReason = role === "recommended"
      ? "이동시간의 평균·최장·참여자 간 차이를 함께 본 전체 균형 1순위예요."
      : role === "travel_alternative"
        ? averageDelta === 0
          ? "전체 균형 점수가 다음으로 좋고 평균 이동시간은 추천 장소와 같아요."
          : averageDelta < 0
            ? `전체 균형 점수가 다음으로 좋고 평균 이동시간은 ${Math.abs(averageDelta)}분 더 짧아요.`
            : `전체 균형 점수가 다음으로 좋지만 평균 이동시간은 ${averageDelta}분 더 걸려요.`
        : "상위 후보 중 추천 장소와 다른 대표 즐길거리를 가진 선택지예요.";
    return {
      role,
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
      arrivalCrowd: dataSource.arrivalCrowdFor(candidate.parkId),
      experience: {
        summary: experience.summary,
        highlights: experience.highlights,
        cautions: experience.cautions,
        sourceUrl: experience.sourceUrl,
        verifiedAt: experience.verifiedAt,
      },
      selectionReason,
    };
  };

  return {
    stage: "fake_provisional",
    recommended: view(result.recommended, "recommended"),
    alternatives: [
      view(travelAlternative, "travel_alternative"),
      view(experienceAlternative, "experience_alternative"),
    ],
    nearTie: result.nearTie,
    explanation: result.comparison?.summary ?? "이동 공평성을 기준으로 비교했습니다.",
    notice: "이동시간과 도착 혼잡도는 고정된 fake 표본입니다. 공원 특징은 서울시 공식 자료를 바탕으로 했으며 운영 상태는 방문 전에 다시 확인해야 합니다.",
  };
}

export function toHostMeetingView(meeting: Meeting, dataSource: RecommendationDataSource) {
  return {
    id: meeting.id,
    meetingAt: meeting.meetingAt,
    participantCount: meeting.participants.length,
    participants: meeting.participants.map((participant) => ({ alias: participant.alias })),
    result: buildRecommendationView(meeting, dataSource),
    confirmedParkId: meeting.confirmedParkId,
  };
}
