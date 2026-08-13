import type { Meeting } from "../../domain/meeting/meeting.js";
import {
  FAIRNESS_POLICIES,
  recommend,
  type EvaluatedCandidate,
} from "../../domain/recommendation/recommendation.js";
import type { CandidateRole, RecommendationResultView } from "../models/meeting-view.js";
import type { RecommendationDataSource } from "../ports/recommendation-data-source.js";
import type { MeetingRepository } from "../ports/meeting-repository.js";
import { buildMeetingPollView } from "./build-meeting-poll-view.js";

export async function buildRecommendationView(
  meeting: Meeting,
  dataSource: RecommendationDataSource,
  repository?: MeetingRepository,
): Promise<RecommendationResultView | null> {
  if (meeting.participants.length < 2) return null;
  const revision = `recommendation-v1:${meeting.participants.length}:${dataSource.stageFor(meeting.meetingAt)}`;
  const calculate = () => calculateRecommendationView(meeting, dataSource);
  return repository ? repository.recommendationView(meeting.id, revision, calculate) : calculate();
}

async function calculateRecommendationView(
  meeting: Meeting,
  dataSource: RecommendationDataSource,
): Promise<RecommendationResultView | null> {
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
  const crowdOverviewBasis = stage === "current" ? "arrival" as const : "current" as const;
  const overviewParks = candidates.map((candidate) => {
    if (crowdOverviewBasis === "arrival") {
      const crowd = dataSource.arrivalCrowdFor(candidate.parkId, meeting.meetingAt);
      return {
        parkId: candidate.parkId,
        parkName: candidate.parkName,
        level: crowd.level,
        label: crowd.label,
        isRecommended: candidate.parkId === result.recommended!.parkId,
        referenceAt: crowd.referenceAt,
      };
    }
    const crowd = dataSource.currentCrowdFor(candidate.parkId);
    return {
      parkId: candidate.parkId,
      parkName: candidate.parkName,
      level: crowd.level,
      label: crowd.label,
      isRecommended: false,
      referenceAt: crowd.observedAt,
    };
  });
  const overviewReferenceAt = overviewParks.map((park) => park.referenceAt).filter((value): value is string => Boolean(value)).sort().at(0) ?? null;

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
    const travelExplanation = `${travelAlternative.parkName}보다 ${outbound} ${returning}.`;
    if (stage !== "current") {
      return `${travelExplanation} 아직 공식 혼잡 예측 범위 밖이라 이동시간을 우선 비교했어요.`;
    }
    const recommendedCrowd = dataSource.arrivalCrowdFor(result.recommended.parkId, meeting.meetingAt);
    const alternativeCrowd = dataSource.arrivalCrowdFor(travelAlternative.parkId, meeting.meetingAt);
    const crowdExplanation = recommendedCrowd.level && alternativeCrowd.level
      ? ` 도착 혼잡은 ${result.recommended.parkName} ${recommendedCrowd.label}, ${travelAlternative.parkName} ${alternativeCrowd.label}으로 함께 반영했어요.`
      : " 도착 혼잡 데이터를 확인할 수 없는 후보에는 불확실성 부담을 반영했어요.";
    return `${travelExplanation}${crowdExplanation}`;
  };

  const view = (candidate: EvaluatedCandidate, role: CandidateRole) => {
    const experience = dataSource.experienceFor(candidate.parkId);
    const selectionReason = role === "recommended"
      ? stage === "current"
        ? "갈 때·귀가의 이동 공평성과 약속 시각의 도착 혼잡을 함께 계산한 1순위예요."
        : "공식 혼잡 예측 전이라 갈 때·귀가의 이동 공평성을 먼저 계산한 1차 추천이에요."
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
          ? [{ alias: participant.alias, travelMode: participant.travelMode ?? "public_transit", minutes: route.minutes, returnMinutes: returnRoute?.minutes ?? null }]
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
    refreshAt: stage === "provisional" && crowdSource !== "fake"
      ? new Date(new Date(meeting.meetingAt).getTime() - 12 * 60 * 60_000).toISOString()
      : null,
    notice: travelData.source === "kakao_mixed" || travelData.source === "kakao_car"
      ? stage === "provisional"
        ? "대중교통은 카카오 대중교통 경로, 자가용은 주차장까지의 운전과 공통 집결점까지의 도보를 합산했습니다. 지금 혼잡은 오늘 기준 참고 정보이며 약속 12시간 전부터 다시 계산합니다."
        : "대중교통은 카카오 대중교통 경로, 자가용은 주차장까지의 운전과 공통 집결점까지의 도보를 합산했습니다. 도착 혼잡은 서울시 데이터이며 주차 대기시간은 포함하지 않습니다."
      : travelData.source === "kakao_public_transit"
      ? stage === "provisional"
        ? "이동시간은 카카오 대중교통 경로 조회값입니다. 지금 혼잡은 오늘 기준 참고 정보이며, 약속 12시간 전부터 도착 예측을 반영해 다시 계산합니다."
        : crowdSource === "seoul_realtime_citydata"
        ? "이동시간은 카카오 대중교통 경로 조회값이고 혼잡도는 서울시 실시간 도시데이터입니다. 이동시간은 약속 시각 시간표가 아니며 혼잡은 추정치입니다."
        : "이동시간은 카카오 대중교통 경로 조회값이고 도착 혼잡도는 고정된 fake 표본입니다. 이동시간은 약속 시각 시간표가 아닙니다."
      : crowdSource === "fake"
        ? "이동시간과 도착 혼잡도는 고정된 fake 표본입니다. 공원 특징은 서울시 공식 자료를 바탕으로 했으며 운영 상태는 방문 전에 다시 확인해야 합니다."
        : "이동시간은 고정된 fake 표본이고 혼잡도는 서울시 실시간 도시데이터입니다. 혼잡은 추정치이며 관측·예측 기준 시각을 확인해 주세요.",
    crowdOverview: {
      basis: crowdOverviewBasis,
      referenceAt: overviewReferenceAt,
      parks: overviewParks.map(({ referenceAt: _referenceAt, ...park }) => park),
    },
    travelModes: {
      publicTransit: meeting.participants.filter((participant) => (participant.travelMode ?? "public_transit") === "public_transit").length,
      car: meeting.participants.filter((participant) => participant.travelMode === "car").length,
    },
    travelData,
  };
}

export async function toHostMeetingView(meeting: Meeting, dataSource: RecommendationDataSource, repository?: MeetingRepository) {
  const result = await buildRecommendationView(meeting, dataSource, repository);
  const hostId = meeting.participants.find((participant) => participant.role === "host")?.id;
  return {
    id: meeting.id,
    meetingAt: meeting.meetingAt,
    travelPattern: meeting.travelPattern,
    sharedOriginName: meeting.sharedOrigin?.placeName ?? null,
    hostParticipantSubmitted: meeting.participants.some((participant) => participant.role === "host"),
    participantCount: meeting.participants.length,
    participants: meeting.participants.map((participant) => ({
      alias: participant.alias,
      isHost: participant.role === "host",
      travelMode: participant.travelMode ?? "public_transit",
    })),
    result,
    recommendationStatus: meeting.participants.length < 2
      ? "waiting_for_participants" as const
      : result ? "ready" as const
        : ["quota_exceeded", "quota_guard"].includes(dataSource.routeFailureFor(meeting.participants) ?? "")
          ? "route_quota_exceeded" as const
          : "route_unavailable" as const,
    confirmedParkId: meeting.confirmedParkId,
    poll: buildMeetingPollView(meeting, hostId),
  };
}
