import type { CandidateInput, RecommendationInput, RouteEstimate } from "../../src/domain/recommendation/recommendation.ts";

const PARKS = [
  ["gangseo", "강서한강공원"],
  ["gwangnaru", "광나루한강공원"],
  ["nanji", "난지한강공원"],
  ["ttukseom", "뚝섬한강공원"],
  ["mangwon", "망원한강공원"],
  ["banpo", "반포한강공원"],
  ["yanghwa", "양화한강공원"],
  ["yeouido", "여의도한강공원"],
  ["ichon", "이촌한강공원"],
  ["jamsil", "잠실한강공원"],
  ["jamwon", "잠원한강공원"],
] as const;

const PARTICIPANTS = ["participant-a", "participant-b", "participant-c"];

type CandidateOverride = Partial<Omit<CandidateInput, "conditions" | "facilities" | "routes">> & {
  routes?: Array<number | null>;
  conditions?: Partial<CandidateInput["conditions"]>;
  facilities?: Partial<CandidateInput["facilities"]>;
};

function routes(minutes: Array<number | null>): RouteEstimate[] {
  return PARTICIPANTS.map((participantId, index) => ({
    participantId,
    minutes: minutes[index] ?? null,
  }));
}

function fixture(
  overrides: Record<string, CandidateOverride>,
  stage: RecommendationInput["stage"] = "current",
): RecommendationInput {
  return {
    stage,
    travelPattern: "individual_round_trip",
    participantIds: PARTICIPANTS,
    candidates: PARKS.map(([parkId, parkName], index) => {
      const override = overrides[parkId] ?? {};
      return {
        parkId,
        parkName,
        routes: routes(override.routes ?? [80 + index, 82 + index, 84 + index]),
        returnRoutes: routes(override.routes ?? [80 + index, 82 + index, 84 + index]),
        meetingPointStatus: override.meetingPointStatus ?? "verified",
        facilities: { restroom: override.facilities?.restroom ?? true },
        conditions: {
          control: override.conditions?.control ?? { value: "open", freshness: "fresh" },
          weather: override.conditions?.weather ?? { value: "good", freshness: "fresh" },
          eventImpact: override.conditions?.eventImpact ?? { value: "none", freshness: "fresh" },
          crowd: override.conditions?.crowd ?? { value: "normal", freshness: "fresh" },
        },
      };
    }),
  };
}

export const RECOMMENDATION_CASES = {
  nearbyButCrowded: fixture({
    banpo: {
      routes: [24, 28, 32],
      conditions: {
        crowd: { value: "very_busy", freshness: "fresh" },
        eventImpact: { value: "high", freshness: "fresh" },
      },
    },
    yeouido: { routes: [32, 34, 36] },
  }),
  unfairOutlier: fixture({
    mangwon: { routes: [10, 10, 70] },
    yeouido: { routes: [36, 36, 36] },
  }),
  closedFastest: fixture({
    banpo: {
      routes: [15, 16, 17],
      conditions: { control: { value: "closed", freshness: "fresh" } },
    },
    yeouido: { routes: [30, 31, 32] },
  }),
  exactTie: fixture({
    banpo: { routes: [30, 35, 40] },
    yeouido: { routes: [30, 35, 40] },
  }),
  crowdUnavailable: fixture({
    yeouido: {
      routes: [25, 27, 29],
      conditions: { crowd: { value: "relaxed", freshness: "unavailable" } },
    },
  }),
  allRoutesUnavailable: fixture(
    Object.fromEntries(PARKS.map(([parkId]) => [parkId, { routes: [null, null, null] }])),
  ),
  staleCrowd: fixture({
    banpo: {
      routes: [24, 25, 26],
      conditions: { crowd: { value: "relaxed", freshness: "stale" } },
    },
    yeouido: { routes: [30, 31, 32] },
  }),
  oneParticipantMissing: fixture({
    banpo: { routes: [15, 16, null] },
    yeouido: { routes: [30, 31, 32] },
  }),
  provisionalOutsideForecast: fixture({
    yeouido: {
      routes: [25, 27, 29],
      conditions: { crowd: { value: "very_busy", freshness: "fresh" } },
    },
  }, "provisional"),
} satisfies Record<string, RecommendationInput>;
