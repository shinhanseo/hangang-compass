import { FAIRNESS_POLICIES, recommend } from "../domain/recommendation.ts";
import { RECOMMENDATION_CASES } from "../fixtures/recommendation-cases.ts";

for (const [caseId, fixture] of Object.entries(RECOMMENDATION_CASES)) {
  const policies = Object.values(FAIRNESS_POLICIES).map((policy) => {
    const result = recommend(fixture, policy);
    return {
      policyId: policy.id,
      status: result.status,
      recommendedParkId: result.recommended?.parkId ?? null,
      alternativeParkId: result.alternative?.parkId ?? null,
      recommendedTravel: result.recommended?.travel ?? null,
      recommendedPenalty: result.recommended?.penalties.total ?? null,
      nearTie: result.nearTie,
      excludedCount: result.excluded.length,
      warnings: result.recommended?.warnings ?? [],
      explanation: result.comparison?.summary ?? null,
    };
  });

  console.log(JSON.stringify({ caseId, policies }));
}
