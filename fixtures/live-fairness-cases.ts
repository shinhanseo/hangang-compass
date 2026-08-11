export interface LiveFairnessCase {
  id: string;
  label: string;
  origins: [string, string, string];
}

export const LIVE_FAIRNESS_CASES: LiveFairnessCase[] = [
  {
    id: "university_triangle",
    label: "대학가 서부·동부·남부",
    origins: ["신촌역", "건대입구역", "서울대입구역"],
  },
  {
    id: "metro_wide",
    label: "수도권 장거리 분산",
    origins: ["부평역", "수원역", "노원역"],
  },
  {
    id: "western_cluster",
    label: "서울 서부권 모임",
    origins: ["홍대입구역", "영등포역", "김포공항역"],
  },
  {
    id: "eastern_cluster",
    label: "서울 동부권 모임",
    origins: ["잠실역", "강남역", "천호역"],
  },
  {
    id: "city_mixed",
    label: "서울 도심 혼합",
    origins: ["혜화역", "사당역", "합정역"],
  },
];
