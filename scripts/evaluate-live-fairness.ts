import { readFile } from "node:fs/promises";

import { FAIRNESS_POLICIES, recommend, type CandidateInput } from "../backend/src/domain/recommendation/recommendation.ts";
import { LIVE_FAIRNESS_CASES } from "../backend/test/fixtures/live-fairness-cases.ts";
import { parseEnv } from "./validate-data-access.mjs";
import { inspectRoute, resolveMeetingPoint, resolveOrigin } from "./validate-meeting-points.mjs";

interface MeetingPointCandidate {
  parkId: string;
  parkName: string;
  candidateName: string;
  verificationStatus: "provisional";
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function requireSecret(env: Record<string, string>, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`missing:${name}`);
  return value;
}

function policySummary(result: ReturnType<typeof recommend>) {
  return {
    policyId: result.policyId,
    status: result.status,
    recommended: result.recommended
      ? {
        parkId: result.recommended.parkId,
        travel: result.recommended.travel,
        penalty: result.recommended.penalties.total,
      }
      : null,
    alternative: result.alternative
      ? {
        parkId: result.alternative.parkId,
        travel: result.alternative.travel,
        penalty: result.alternative.penalties.total,
      }
      : null,
    nearTie: result.nearTie,
    excludedCount: result.excluded.length,
    explanation: result.comparison?.summary ?? null,
  };
}

async function main() {
  const env = parseEnv(await readFile(new URL("../.env", import.meta.url), "utf8"));
  const key = requireSecret(env, "KAKAO_REST_API_KEY");
  const meetingPoints = JSON.parse(
    await readFile(new URL("../data/meeting-points.json", import.meta.url), "utf8"),
  ) as MeetingPointCandidate[];
  const requestedCase = process.argv.find((argument) => argument.startsWith("--case="))
    ?.slice("--case=".length);
  const cases = requestedCase
    ? LIVE_FAIRNESS_CASES.filter((item) => item.id === requestedCase)
    : LIVE_FAIRNESS_CASES;
  if (!cases.length) throw new Error("unknown_case");

  const resolvedPoints = await mapWithConcurrency(meetingPoints, 4, async (candidate) => ({
    candidate,
    result: await resolveMeetingPoint(key, candidate),
  }));
  const unresolvedParks = resolvedPoints
    .filter((item) => !item.result.coordinate)
    .map((item) => item.candidate.parkId);
  if (unresolvedParks.length) throw new Error("meeting_point_unresolved");

  const uniqueOrigins = [...new Set(cases.flatMap((item) => item.origins))];
  const resolvedOrigins = new Map(
    await mapWithConcurrency(uniqueOrigins, 4, async (originName) => [
      originName,
      await resolveOrigin(key, originName),
    ] as const),
  );
  const unresolvedOrigins = uniqueOrigins.filter((origin) => !resolvedOrigins.get(origin));
  if (unresolvedOrigins.length) throw new Error("origin_unresolved");

  const tasks = cases.flatMap((scenario) =>
    resolvedPoints.flatMap(({ candidate, result }) =>
      scenario.origins.map((originName, participantIndex) => ({
        scenario,
        candidate,
        destination: result.coordinate,
        originName,
        participantIndex,
      })),
    ),
  );
  const routeResults = await mapWithConcurrency(tasks, 4, async (task) => ({
    ...task,
    route: await inspectRoute(
      key,
      task.originName,
      resolvedOrigins.get(task.originName),
      task.candidate,
      task.destination,
    ),
  }));

  let failedRouteCount = 0;
  for (const scenario of cases) {
    const candidates: CandidateInput[] = meetingPoints.map((meetingPoint) => {
      const routes = routeResults
        .filter((item) => item.scenario.id === scenario.id && item.candidate.parkId === meetingPoint.parkId)
        .sort((left, right) => left.participantIndex - right.participantIndex)
        .map((item) => {
          if (!item.route.ok) failedRouteCount += 1;
          return {
            participantId: `participant-${item.participantIndex + 1}`,
            minutes: item.route.ok ? item.route.totalMinutes : null,
          };
        });
      return {
        parkId: meetingPoint.parkId,
        parkName: meetingPoint.parkName,
        routes,
        meetingPointStatus: meetingPoint.verificationStatus,
        facilities: { restroom: true },
        conditions: {
          control: { value: "open", freshness: "fresh" },
          weather: { value: "good", freshness: "fresh" },
          eventImpact: { value: "none", freshness: "fresh" },
          crowd: { value: "normal", freshness: "fresh" },
        },
      };
    });
    const input = {
      stage: "provisional" as const,
      participantIds: ["participant-1", "participant-2", "participant-3"],
      candidates,
    };
    const policies = Object.values(FAIRNESS_POLICIES).map((policy) =>
      policySummary(recommend(input, policy))
    );
    console.log(JSON.stringify({
      check: "live_fairness_case",
      scope: "travel_fairness_only",
      neutralizedInputs: ["crowd", "weather", "events", "controls", "facilities"],
      caseId: scenario.id,
      label: scenario.label,
      origins: scenario.origins,
      candidateCount: candidates.length,
      policyChangedRecommendation: new Set(
        policies.map((policy) => policy.recommended?.parkId ?? null),
      ).size > 1,
      policies,
    }));
  }

  console.log(JSON.stringify({
    check: "live_fairness_matrix",
    ok: failedRouteCount === 0,
    caseCount: cases.length,
    candidateCount: meetingPoints.length,
    routeRequestCount: tasks.length,
    failedRouteCount,
    persistedRawRoutes: false,
    persistedCoordinates: false,
  }));
  if (failedRouteCount) process.exitCode = 1;
}

main().catch((error) => {
  const reason = error instanceof Error && error.message.startsWith("missing:")
    ? error.message
    : error instanceof Error && [
      "unknown_case",
      "meeting_point_unresolved",
      "origin_unresolved",
    ].includes(error.message)
      ? error.message
      : error?.name === "AbortError"
        ? "request_timeout"
        : "evaluation_failed";
  console.error(JSON.stringify({ check: "live_fairness_matrix", ok: false, reason }));
  process.exitCode = 1;
});
