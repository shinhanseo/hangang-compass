export const STATION_CATALOG = [
  { id: "hongdae", name: "홍대입구역", query: "홍대입구역" },
  { id: "gangnam", name: "강남역", query: "강남역" },
  { id: "nowon", name: "노원역", query: "노원역" },
  { id: "konkuk", name: "건대입구역", query: "건대입구역" },
  { id: "sadang", name: "사당역", query: "사당역" },
  { id: "yeongdeungpo", name: "영등포역", query: "영등포역" },
] as const;

export function stationById(stationId: string) {
  return STATION_CATALOG.find((station) => station.id === stationId) ?? null;
}
