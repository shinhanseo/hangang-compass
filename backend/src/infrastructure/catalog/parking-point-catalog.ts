export const PARKING_POINT_CATALOG = [
  { parkId: "gangseo", name: "강서한강공원 개화나들목 앞 주차장", placeId: "523246900", address: "서울 강서구 방화동 18-1" },
  { parkId: "gwangnaru", name: "광나루한강공원 제2주차장", placeId: "778421459", address: "서울 강동구 천호동 483-8" },
  { parkId: "nanji", name: "난지한강공원 주차장", placeId: "18224859", address: "서울 마포구 상암동 487-370" },
  { parkId: "ttukseom", name: "뚝섬한강공원 제4주차장", placeId: "1474436273", address: "서울 광진구 자양동 97-5" },
  { parkId: "mangwon", name: "망원한강공원 2,3주차장", placeId: "1641107416", address: "서울 마포구 망원동 205-5" },
  { parkId: "banpo", name: "반포한강공원 3주차장", placeId: "1125686641", address: "서울 서초구 반포동 115-5" },
  { parkId: "yanghwa", name: "양화한강공원 1주차장", placeId: "26096487", address: "서울 영등포구 한강남자전거길 1203" },
  { parkId: "yeouido", name: "여의도한강공원 2주차장", placeId: "27051769", address: "서울 영등포구 여의동로 지하 343" },
  { parkId: "ichon", name: "이촌한강공원 3주차장", placeId: "2005915568", address: "서울 용산구 이촌동 302-17" },
  { parkId: "jamsil", name: "잠실한강공원 제2주차장", placeId: "27296442", address: "서울 송파구 잠실동 1-1" },
  { parkId: "jamwon", name: "잠원한강공원 4공영주차장", placeId: "1265112099", address: "서울 강남구 압구정동 386" },
] as const;

export function parkingPointByParkId(parkId: string) {
  return PARKING_POINT_CATALOG.find((point) => point.parkId === parkId) ?? null;
}
