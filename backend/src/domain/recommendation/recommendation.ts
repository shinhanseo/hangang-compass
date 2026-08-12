export type Freshness = "fresh" | "stale" | "unavailable";
export type CrowdLevel = "relaxed" | "normal" | "busy" | "very_busy";
export type RecommendationStage = "provisional" | "current";

export interface FairnessPolicy {
  id: string;
  averageWeight: number;
  maximumWeight: number;
  rangeWeight: number;
}

export const FAIRNESS_POLICIES = {
  averageOnly: {
    id: "average-only-spike-v1",
    averageWeight: 1,
    maximumWeight: 0,
    rangeWeight: 0,
  },
  balanced: {
    id: "balanced-spike-v1",
    averageWeight: 0.4,
    maximumWeight: 0.4,
    rangeWeight: 0.2,
  },
  minimax: {
    id: "minimax-spike-v1",
    averageWeight: 0,
    maximumWeight: 1,
    rangeWeight: 0,
  },
} satisfies Record<string, FairnessPolicy>;

export interface RouteEstimate {
  participantId: string;
  minutes: number | null;
}

export interface SourcedValue<T> {
  value: T;
  freshness: Freshness;
}

export interface CandidateInput {
  parkId: string;
  parkName: string;
  routes: RouteEstimate[];
  meetingPointStatus: "verified" | "provisional";
  facilities: {
    restroom: boolean;
  };
  conditions: {
    control: SourcedValue<"open" | "closed">;
    weather: SourcedValue<"good" | "caution" | "danger">;
    eventImpact: SourcedValue<"none" | "moderate" | "high">;
    crowd?: SourcedValue<CrowdLevel>;
  };
}

export interface RecommendationInput {
  stage: RecommendationStage;
  participantIds: string[];
  candidates: CandidateInput[];
}

export interface TravelMetrics {
  averageMinutes: number;
  maximumMinutes: number;
  rangeMinutes: number;
}

export interface EvaluatedCandidate {
  parkId: string;
  parkName: string;
  eligible: boolean;
  exclusionReasons: string[];
  travel: TravelMetrics | null;
  penalties: {
    travel: number | null;
    crowd: number;
    weather: number;
    event: number;
    confidence: number;
    total: number | null;
  };
  warnings: string[];
  conditionSignals: string[];
  confidence: "normal" | "reduced";
}

export interface RecommendationResult {
  status: "ok" | "insufficient_data";
  policyId: string;
  stage: RecommendationStage;
  recommended: EvaluatedCandidate | null;
  alternative: EvaluatedCandidate | null;
  ranked: EvaluatedCandidate[];
  excluded: EvaluatedCandidate[];
  nearTie: boolean;
  comparison: {
    averageDifferenceMinutes: number;
    maximumDifferenceMinutes: number;
    rangeDifferenceMinutes: number;
    conditionPenaltyDifference: number;
    summary: string;
  } | null;
}

const CROWD_PENALTY: Record<CrowdLevel, number> = {
  relaxed: 0,
  normal: 4,
  busy: 12,
  very_busy: 24,
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function summarizeTravel(
  participantIds: string[],
  routes: RouteEstimate[],
): TravelMetrics | null {
  if (participantIds.length < 2 || new Set(participantIds).size !== participantIds.length) return null;
  const routeByParticipant = new Map(routes.map((route) => [route.participantId, route.minutes]));
  const minutes = participantIds.map((participantId) => routeByParticipant.get(participantId));
  if (minutes.some((value) => !Number.isFinite(value))) return null;

  const values = minutes as number[];
  const maximumMinutes = Math.max(...values);
  const minimumMinutes = Math.min(...values);
  return {
    averageMinutes: round1(values.reduce((total, value) => total + value, 0) / values.length),
    maximumMinutes,
    rangeMinutes: maximumMinutes - minimumMinutes,
  };
}

function exclusionReasons(input: RecommendationInput, candidate: CandidateInput): string[] {
  const reasons: string[] = [];
  if (candidate.conditions.control.value === "closed") reasons.push("park_closed");
  if (candidate.conditions.weather.value === "danger") reasons.push("dangerous_weather");
  if (!candidate.facilities.restroom) reasons.push("required_restroom_missing");
  if (!summarizeTravel(input.participantIds, candidate.routes)) reasons.push("participant_route_missing");
  return reasons;
}

function crowdPenalty(stage: RecommendationStage, candidate: CandidateInput, warnings: string[]): number {
  if (stage === "provisional") {
    warnings.push("crowd_outside_forecast_window");
    return 0;
  }

  const crowd = candidate.conditions.crowd;
  if (!crowd || crowd.freshness === "unavailable") {
    warnings.push("crowd_unavailable");
    return 15;
  }
  if (crowd.freshness === "stale") {
    warnings.push("crowd_stale");
    return 10;
  }
  return CROWD_PENALTY[crowd.value];
}

function sourcedPenalty<T>(
  source: SourcedValue<T>,
  penalties: Record<string, number>,
  unavailablePenalty: number,
  warningPrefix: string,
  warnings: string[],
): number {
  if (source.freshness === "unavailable") {
    warnings.push(`${warningPrefix}_unavailable`);
    return unavailablePenalty;
  }
  if (source.freshness === "stale") {
    warnings.push(`${warningPrefix}_stale`);
    return unavailablePenalty;
  }
  return penalties[String(source.value)] ?? 0;
}

export function evaluateCandidate(
  input: RecommendationInput,
  candidate: CandidateInput,
  policy: FairnessPolicy,
): EvaluatedCandidate {
  const excluded = exclusionReasons(input, candidate);
  const travel = summarizeTravel(input.participantIds, candidate.routes);
  const warnings: string[] = [];
  const crowd = crowdPenalty(input.stage, candidate, warnings);
  const weather = sourcedPenalty(
    candidate.conditions.weather,
    { good: 0, caution: 12, danger: 0 },
    12,
    "weather",
    warnings,
  );
  const event = sourcedPenalty(
    candidate.conditions.eventImpact,
    { none: 0, moderate: 8, high: 18 },
    8,
    "event",
    warnings,
  );
  const controlUncertainty = sourcedPenalty(
    candidate.conditions.control,
    { open: 0, closed: 0 },
    20,
    "control",
    warnings,
  );
  const confidence = (candidate.meetingPointStatus === "provisional" ? 5 : 0) + controlUncertainty;
  if (candidate.meetingPointStatus === "provisional") warnings.push("meeting_point_provisional");
  const conditionSignals: string[] = [];
  if (input.stage === "current" && candidate.conditions.crowd?.freshness === "fresh") {
    if (["busy", "very_busy"].includes(candidate.conditions.crowd.value)) {
      conditionSignals.push(`crowd_${candidate.conditions.crowd.value}`);
    }
  }
  if (candidate.conditions.weather.freshness === "fresh" && candidate.conditions.weather.value !== "good") {
    conditionSignals.push(`weather_${candidate.conditions.weather.value}`);
  }
  if (candidate.conditions.eventImpact.freshness === "fresh" && candidate.conditions.eventImpact.value !== "none") {
    conditionSignals.push(`event_${candidate.conditions.eventImpact.value}`);
  }
  const travelPenalty = travel
    ? round1(
      travel.averageMinutes * policy.averageWeight
      + travel.maximumMinutes * policy.maximumWeight
      + travel.rangeMinutes * policy.rangeWeight,
    )
    : null;

  return {
    parkId: candidate.parkId,
    parkName: candidate.parkName,
    eligible: excluded.length === 0,
    exclusionReasons: excluded,
    travel,
    penalties: {
      travel: travelPenalty,
      crowd,
      weather,
      event,
      confidence,
      total: travelPenalty === null ? null : round1(travelPenalty + crowd + weather + event + confidence),
    },
    warnings,
    conditionSignals,
    confidence: warnings.some((warning) => warning !== "crowd_outside_forecast_window")
      ? "reduced"
      : "normal",
  };
}

function compareCandidates(left: EvaluatedCandidate, right: EvaluatedCandidate): number {
  const totalDifference = (left.penalties.total ?? Infinity) - (right.penalties.total ?? Infinity);
  if (totalDifference !== 0) return totalDifference;
  const maximumDifference = (left.travel?.maximumMinutes ?? Infinity) - (right.travel?.maximumMinutes ?? Infinity);
  if (maximumDifference !== 0) return maximumDifference;
  const averageDifference = (left.travel?.averageMinutes ?? Infinity) - (right.travel?.averageMinutes ?? Infinity);
  if (averageDifference !== 0) return averageDifference;
  return left.parkId.localeCompare(right.parkId, "en");
}

function conditionPenalty(candidate: EvaluatedCandidate): number {
  return candidate.penalties.crowd
    + candidate.penalties.weather
    + candidate.penalties.event
    + candidate.penalties.confidence;
}

function buildComparison(
  recommended: EvaluatedCandidate,
  alternative: EvaluatedCandidate,
): RecommendationResult["comparison"] {
  const averageDifferenceMinutes = round1(
    (recommended.travel?.averageMinutes ?? 0) - (alternative.travel?.averageMinutes ?? 0),
  );
  const maximumDifferenceMinutes = round1(
    (recommended.travel?.maximumMinutes ?? 0) - (alternative.travel?.maximumMinutes ?? 0),
  );
  const rangeDifferenceMinutes = round1(
    (recommended.travel?.rangeMinutes ?? 0) - (alternative.travel?.rangeMinutes ?? 0),
  );
  const conditionPenaltyDifference = conditionPenalty(recommended) - conditionPenalty(alternative);
  const averagePhrase = averageDifferenceMinutes === 0
    ? "평균 이동시간이 같습니다"
    : averageDifferenceMinutes > 0
      ? `평균 ${averageDifferenceMinutes}분 더 걸립니다`
      : `평균 ${Math.abs(averageDifferenceMinutes)}분 덜 걸립니다`;
  const fairnessPhrase = maximumDifferenceMinutes < 0
    ? ` 가장 긴 이동은 ${Math.abs(maximumDifferenceMinutes)}분 줄어듭니다.`
    : rangeDifferenceMinutes < 0
      ? ` 참여자 간 차이는 ${Math.abs(rangeDifferenceMinutes)}분 줄어듭니다.`
      : "";
  const signalLabels: Record<string, string> = {
    crowd_busy: "혼잡한 예측",
    crowd_very_busy: "매우 혼잡한 예측",
    weather_caution: "주의가 필요한 날씨",
    weather_danger: "위험한 날씨",
    event_moderate: "행사 영향",
    event_high: "큰 행사 영향",
  };
  const avoidedSignals = alternative.conditionSignals
    .map((signal) => signalLabels[signal])
    .filter(Boolean);
  const conditionPhrase = conditionPenaltyDifference === 0
    ? "현장 상황 부담이 같습니다"
    : conditionPenaltyDifference < 0 && avoidedSignals.length
      ? `${alternative.parkName}의 ${avoidedSignals.join("과 ")}을 피합니다`
      : conditionPenaltyDifference < 0
        ? "상황·데이터 신뢰 부담이 더 낮습니다"
        : "상황·데이터 신뢰 부담이 더 높습니다";

  return {
    averageDifferenceMinutes,
    maximumDifferenceMinutes,
    rangeDifferenceMinutes,
    conditionPenaltyDifference,
    summary: `${alternative.parkName}보다 ${averagePhrase}.${fairnessPhrase} ${conditionPhrase}.`,
  };
}

export function recommend(
  input: RecommendationInput,
  policy: FairnessPolicy,
): RecommendationResult {
  const evaluations = input.candidates.map((candidate) => evaluateCandidate(input, candidate, policy));
  const eligible = evaluations.filter((candidate) => candidate.eligible).sort(compareCandidates);
  const excluded = evaluations.filter((candidate) => !candidate.eligible);

  if (eligible.length < 2) {
    return {
      status: "insufficient_data",
      policyId: policy.id,
      stage: input.stage,
      recommended: null,
      alternative: null,
      ranked: eligible,
      excluded,
      nearTie: false,
      comparison: null,
    };
  }

  const recommended = eligible[0]!;
  const alternative = eligible[1]!;
  return {
    status: "ok",
    policyId: policy.id,
    stage: input.stage,
    recommended,
    alternative,
    ranked: eligible,
    excluded,
    nearTie: (alternative.penalties.total ?? Infinity) - (recommended.penalties.total ?? Infinity) <= 3,
    comparison: buildComparison(recommended, alternative),
  };
}
