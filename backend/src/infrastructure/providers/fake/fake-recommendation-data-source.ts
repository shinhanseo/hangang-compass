import type { RecommendationDataSource } from "../../../application/ports/recommendation-data-source.js";
import type { Participant } from "../../../domain/meeting/meeting.js";
import type { CandidateInput } from "../../../domain/recommendation/recommendation.js";

const FAKE_STATIONS = [
  { id: "hongdae", name: "홍대입구역" },
  { id: "gangnam", name: "강남역" },
  { id: "nowon", name: "노원역" },
  { id: "konkuk", name: "건대입구역" },
  { id: "sadang", name: "사당역" },
  { id: "yeongdeungpo", name: "영등포역" },
] as const;

const PARKS = [
  ["gangseo", "강서한강공원", "강서안내센터 출입구 앞"],
  ["gwangnaru", "광나루한강공원", "광나루안내센터 출입구 앞"],
  ["nanji", "난지한강공원", "난지안내센터 출입구 앞"],
  ["ttukseom", "뚝섬한강공원", "뚝섬자벌레 1층 외부 출입구 앞"],
  ["mangwon", "망원한강공원", "망원안내센터 출입구 앞"],
  ["banpo", "반포한강공원", "반포안내센터 출입구 앞"],
  ["yanghwa", "양화한강공원", "양화안내센터 출입구 앞"],
  ["yeouido", "여의도한강공원", "여의도안내센터 출입구 앞"],
  ["ichon", "이촌한강공원", "이촌안내센터 출입구 앞"],
  ["jamsil", "잠실한강공원", "잠실안내센터 출입구 앞"],
  ["jamwon", "잠원한강공원", "잠원안내센터 출입구 앞"],
] as const;

const TIMES: Record<string, Record<string, number>> = {
  hongdae: { gangseo: 48, gwangnaru: 58, nanji: 40, ttukseom: 40, mangwon: 24, banpo: 38, yanghwa: 27, yeouido: 22, ichon: 31, jamsil: 48, jamwon: 42 },
  gangnam: { gangseo: 68, gwangnaru: 39, nanji: 60, ttukseom: 19, mangwon: 47, banpo: 24, yanghwa: 44, yeouido: 30, ichon: 28, jamsil: 27, jamwon: 22 },
  nowon: { gangseo: 88, gwangnaru: 50, nanji: 85, ttukseom: 38, mangwon: 67, banpo: 58, yanghwa: 64, yeouido: 48, ichon: 51, jamsil: 45, jamwon: 54 },
  konkuk: { gangseo: 72, gwangnaru: 32, nanji: 65, ttukseom: 14, mangwon: 51, banpo: 35, yanghwa: 48, yeouido: 35, ichon: 30, jamsil: 24, jamwon: 31 },
  sadang: { gangseo: 65, gwangnaru: 51, nanji: 57, ttukseom: 35, mangwon: 44, banpo: 25, yanghwa: 39, yeouido: 29, ichon: 24, jamsil: 36, jamwon: 23 },
  yeongdeungpo: { gangseo: 42, gwangnaru: 62, nanji: 47, ttukseom: 45, mangwon: 31, banpo: 39, yanghwa: 19, yeouido: 18, ichon: 29, jamsil: 50, jamwon: 43 },
};

function stationExists(stationId: string): boolean {
  return FAKE_STATIONS.some((station) => station.id === stationId);
}

function fakeCandidates(
  participants: Participant[],
): CandidateInput[] {
  return PARKS.map(([parkId, parkName]) => ({
    parkId,
    parkName,
    routes: participants.map((participant) => ({
      participantId: participant.id,
      minutes: TIMES[participant.stationId]?.[parkId] ?? null,
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
  return PARKS.find(([id]) => id === parkId)?.[2] ?? "만남 지점 확인 중";
}

export class FakeRecommendationDataSource implements RecommendationDataSource {
  stations() {
    return FAKE_STATIONS;
  }

  hasStation(stationId: string): boolean {
    return stationExists(stationId);
  }

  candidates(participants: Participant[]): CandidateInput[] {
    return fakeCandidates(participants);
  }

  meetingPointFor(parkId: string): string {
    return meetingPointFor(parkId);
  }
}
