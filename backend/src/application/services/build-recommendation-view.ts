import type { Meeting } from "../../domain/meeting/meeting.js";
import {
  FAIRNESS_POLICIES,
  recommend,
  type EvaluatedCandidate,
} from "../../domain/recommendation/recommendation.js";
import type { CandidateRole, RecommendationResultView } from "../models/meeting-view.js";
import type { RecommendationDataSource } from "../ports/recommendation-data-source.js";

export async function buildRecommendationView(
  meeting: Meeting,
  dataSource: RecommendationDataSource,
): Promise<RecommendationResultView | null> {
  if (meeting.participants.length < 2) return null;
  await dataSource.prepareFor(meeting.participants, meeting.meetingAt);
  const stage = dataSource.stageFor(meeting.meetingAt);
  const candidates = dataSource.candidates(meeting.participants, meeting.meetingAt);
  const result = recommend({
    stage,
    travelPattern: meeting.travelPattern,
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
  const crowdSource = dataSource.arrivalCrowdFor(result.recommended.parkId, meeting.meetingAt).source;
  const travelData = dataSource.travelData(meeting.participants);

  const roundTripExplanation = () => {
    if (!result.recommended?.returnTravel || !travelAlternative.returnTravel) {
      return result.comparison?.summary ?? "이동 공평성을 기준으로 비교했습니다.";
    }
    const outboundDelta = Math.round((result.recommended.travel!.averageMinutes - travelAlternative.travel!.averageMinutes) * 10) / 10;
    const returnDelta = Math.round((result.recommended.returnTravel.maximumMinutes - travelAlternative.returnTravel.maximumMinutes) * 10) / 10;
    const outbound = outboundDelta === 0
      ? "갈 때 평균시간은 같고"
      : outboundDelta < 0
        ? `갈 때 평균은 ${Math.abs(outboundDelta)}분 빠르고`
        : `갈 때 평균은 ${outboundDelta}분 더 걸리지만`;
    const returning = returnDelta === 0
      ? "귀가 최장시간도 같습니다"
      : returnDelta < 0
        ? `귀가 최장시간을 ${Math.abs(returnDelta)}분 줄입니다`
        : `귀가 최장시간은 ${returnDelta}분 늘어납니다`;
    return `${travelAlternative.parkName}보다 ${outbound} ${returning}.`;
  };

  const view = (candidate: EvaluatedCandidate, role: CandidateRole) => {
    const experience = dataSource.experienceFor(candidate.parkId);
    const selectionReason = role === "recommended"
      ? "갈 때와 귀가의 평균·최장·참여자 간 차이를 각각 계산해 반씩 반영한 1순위예요."
      : role === "travel_alternative"
        ? "갈 때와 귀가를 함께 본 전체 균형 점수가 다음으로 좋은 선택지예요."
        : "상위 후보 중 추천 장소와 다른 대표 즐길거리를 가진 선택지예요.";
    return {
      role,
      parkId: candidate.parkId,
      parkName: candidate.parkName,
      meetingPoint: dataSource.meetingPointFor(candidate.parkId),
      travel: candidate.travel!,
      returnTravel: candidate.returnTravel,
      participantTimes: candidateById.get(candidate.parkId)?.routes.flatMap((route) => {
        const participant = meeting.participants.find((item) => item.id === route.participantId);
        const returnRoute = candidateById.get(candidate.parkId)?.returnRoutes?.find((item) => item.participantId === route.participantId);
        return participant && route.minutes !== null
          ? [{ alias: participant.alias, minutes: route.minutes, returnMinutes: returnRoute?.minutes ?? null }]
          : [];
      }) ?? [],
      arrivalCrowd: dataSource.arrivalCrowdFor(candidate.parkId, meeting.meetingAt),
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
    travelPattern: meeting.travelPattern,
    stage: crowdSource === "fake"
      ? "fake_provisional"
      : stage === "current" ? "live_current" : "live_provisional",
    recommended: view(result.recommended, "recommended"),
    alternatives: [
      view(travelAlternative, "travel_alternative"),
      view(experienceAlternative, "experience_alternative"),
    ],
    nearTie: result.nearTie,
    explanation: roundTripExplanation(),
    notice: travelData.source === "kakao_public_transit"
      ? crowdSource === "seoul_realtime_citydata"
        ? "이동시간은 카카오 대중교통 경로 조회값이고 혼잡도는 서울시 실시간 도시데이터입니다. 이동시간은 약속 시각 시간표가 아니며 혼잡은 추정치입니다."
        : "이동시간은 카카오 대중교통 경로 조회값이고 도착 혼잡도는 고정된 fake 표본입니다. 이동시간은 약속 시각 시간표가 아닙니다."
      : crowdSource === "fake"
        ? "이동시간과 도착 혼잡도는 고정된 fake 표본입니다. 공원 특징은 서울시 공식 자료를 바탕으로 했으며 운영 상태는 방문 전에 다시 확인해야 합니다."
        : "이동시간은 고정된 fake 표본이고 혼잡도는 서울시 실시간 도시데이터입니다. 혼잡은 추정치이며 관측·예측 기준 시각을 확인해 주세요.",
    travelData,
  };
}

export async function toHostMeetingView(meeting: Meeting, dataSource: RecommendationDataSource) {
  const result = await buildRecommendationView(meeting, dataSource);
  return {
    id: meeting.id,
    meetingAt: meeting.meetingAt,
    travelPattern: meeting.travelPattern,
    participantCount: meeting.participants.length,
    participants: meeting.participants.map((participant) => ({ alias: participant.alias })),
    result,
    recommendationStatus: meeting.participants.length < 2
      ? "waiting_for_participants" as const
      : result ? "ready" as const : "route_unavailable" as const,
    confirmedParkId: meeting.confirmedParkId,
  };
}
