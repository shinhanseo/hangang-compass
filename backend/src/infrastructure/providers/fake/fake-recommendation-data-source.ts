import type { RecommendationDataSource } from "../../../application/ports/recommendation-data-source.js";
import type { Participant } from "../../../domain/meeting/meeting.js";
import type { CandidateInput } from "../../../domain/recommendation/recommendation.js";
import { parkExperienceFor } from "../../catalog/park-experience-catalog.js";
import { MEETING_POINT_CATALOG } from "../../catalog/meeting-point-catalog.js";

const TIMES: Record<string, Record<string, number>> = {
  hongdae: { gangseo: 48, gwangnaru: 58, nanji: 40, ttukseom: 40, mangwon: 24, banpo: 38, yanghwa: 27, yeouido: 22, ichon: 31, jamsil: 48, jamwon: 42 },
  gangnam: { gangseo: 68, gwangnaru: 39, nanji: 60, ttukseom: 19, mangwon: 47, banpo: 24, yanghwa: 44, yeouido: 30, ichon: 28, jamsil: 27, jamwon: 22 },
  nowon: { gangseo: 88, gwangnaru: 50, nanji: 85, ttukseom: 38, mangwon: 67, banpo: 58, yanghwa: 64, yeouido: 48, ichon: 51, jamsil: 45, jamwon: 54 },
  konkuk: { gangseo: 72, gwangnaru: 32, nanji: 65, ttukseom: 14, mangwon: 51, banpo: 35, yanghwa: 48, yeouido: 35, ichon: 30, jamsil: 24, jamwon: 31 },
  sadang: { gangseo: 65, gwangnaru: 51, nanji: 57, ttukseom: 35, mangwon: 44, banpo: 25, yanghwa: 39, yeouido: 29, ichon: 24, jamsil: 36, jamwon: 23 },
  yeongdeungpo: { gangseo: 42, gwangnaru: 62, nanji: 47, ttukseom: 45, mangwon: 31, banpo: 39, yanghwa: 19, yeouido: 18, ichon: 29, jamsil: 50, jamwon: 43 },
};

const FAKE_ARRIVAL_CROWD = {
  gangseo: ["relaxed", "여유"] as const,
  gwangnaru: ["normal", "보통"] as const,
  nanji: ["relaxed", "여유"] as const,
  ttukseom: ["busy", "붐빔"] as const,
  mangwon: ["normal", "보통"] as const,
  banpo: ["very_busy", "매우 붐빔"] as const,
  yanghwa: ["relaxed", "여유"] as const,
  yeouido: ["normal", "보통"] as const,
  ichon: ["relaxed", "여유"] as const,
  jamsil: ["normal", "보통"] as const,
  jamwon: ["normal", "보통"] as const,
};

function fakeCandidates(
  participants: Participant[],
): CandidateInput[] {
  return MEETING_POINT_CATALOG.map(({ parkId, parkName }) => ({
    parkId,
    parkName,
    routes: participants.map((participant) => ({
      participantId: participant.id,
      minutes: TIMES[participant.origin.placeId]?.[parkId] ?? null,
    })),
    returnRoutes: participants.map((participant) => ({
      participantId: participant.id,
      minutes: participant.destination ? TIMES[participant.destination.placeId]?.[parkId] ?? null : null,
    })),
    meetingPointStatus: "provisional",
    facilities: { restroom: true },
    conditions: {
      control: { value: "open", freshness: "fresh" },
      weather: { value: "good", freshness: "fresh" },
      eventImpact: { value: "none", freshness: "fresh" },
      crowd: { value: "normal", freshness: "fresh" },
    },
  }));
}

function meetingPointFor(parkId: string): string {
  return MEETING_POINT_CATALOG.find((point) => point.parkId === parkId)?.meetingInstruction ?? "만남 지점 확인 중";
}

export class FakeRecommendationDataSource implements RecommendationDataSource {
  async prepareFor(_participants: Participant[], _meetingAt: string): Promise<void> {}

  stageFor() {
    return "provisional" as const;
  }

  candidates(participants: Participant[], _meetingAt: string): CandidateInput[] {
    return fakeCandidates(participants);
  }

  meetingPointFor(parkId: string): string {
    return meetingPointFor(parkId);
  }

  experienceFor(parkId: string) {
    return parkExperienceFor(parkId);
  }

  travelData(_participants: Participant[]) {
    return { source: "fake" as const, calculatedAt: null };
  }

  routeFailureFor(_participants: Participant[]) { return null; }

  arrivalCrowdFor(parkId: string, _meetingAt: string) {
    const [level, label] = FAKE_ARRIVAL_CROWD[parkId as keyof typeof FAKE_ARRIVAL_CROWD]
      ?? ["normal", "보통"] as const;
    return {
      level,
      label,
      status: "fake_sample" as const,
      referenceAt: null,
      observedAt: null,
      fetchedAt: null,
      freshness: null,
      source: "fake" as const,
    };
  }

  currentCrowdFor(parkId: string) {
    const [level, label] = FAKE_ARRIVAL_CROWD[parkId as keyof typeof FAKE_ARRIVAL_CROWD]
      ?? ["normal", "보통"] as const;
    return { level, label, observedAt: null, fetchedAt: null, freshness: null, source: "fake" as const };
  }
}
