export const MEETING_POINT_CATALOG = [
  { parkId: "gangseo", parkName: "강서한강공원", candidateName: "강서안내센터", meetingInstruction: "강서안내센터 건물 출입구 앞", officialAddress: "서울 강서구 양천로27길 279-23", poiQuery: "강서한강공원 강서안내센터" },
  { parkId: "gwangnaru", parkName: "광나루한강공원", candidateName: "광나루안내센터", meetingInstruction: "광나루안내센터 건물 출입구 앞", officialAddress: "서울 강동구 선사로 83-106", poiQuery: "광나루한강공원 광나루안내센터" },
  { parkId: "nanji", parkName: "난지한강공원", candidateName: "난지안내센터", meetingInstruction: "난지안내센터 건물 출입구 앞", officialAddress: "서울 마포구 한강난지로 162", poiQuery: "난지한강공원 난지안내센터" },
  { parkId: "ttukseom", parkName: "뚝섬한강공원", candidateName: "뚝섬자벌레", meetingInstruction: "뚝섬자벌레 1층 외부 출입구 앞", officialAddress: "서울 광진구 강변북로 2202", poiQuery: "뚝섬한강공원 뚝섬자벌레" },
  { parkId: "mangwon", parkName: "망원한강공원", candidateName: "망원안내센터", meetingInstruction: "망원안내센터 건물 출입구 앞", officialAddress: "서울 마포구 마포나루길 467", poiQuery: "망원한강공원 망원안내센터" },
  { parkId: "banpo", parkName: "반포한강공원", candidateName: "반포안내센터", meetingInstruction: "반포안내센터 건물 출입구 앞", officialAddress: "서울 서초구 신반포로11길 40", poiQuery: "반포한강공원 반포안내센터" },
  { parkId: "yanghwa", parkName: "양화한강공원", candidateName: "양화안내센터", meetingInstruction: "양화안내센터 건물 출입구 앞", officialAddress: "서울 영등포구 노들로 221", poiQuery: "양화한강공원 양화안내센터" },
  { parkId: "yeouido", parkName: "여의도한강공원", candidateName: "여의도안내센터", meetingInstruction: "여의도안내센터 건물 출입구 앞", officialAddress: "서울 영등포구 여의동로 330", poiQuery: "여의도한강공원 여의도안내센터" },
  { parkId: "ichon", parkName: "이촌한강공원", candidateName: "이촌안내센터", meetingInstruction: "이촌안내센터 건물 출입구 앞", officialAddress: "서울 용산구 이촌로72길 62", poiQuery: "이촌한강공원 이촌안내센터" },
  { parkId: "jamsil", parkName: "잠실한강공원", candidateName: "잠실안내센터", meetingInstruction: "잠실안내센터 건물 출입구 앞", officialAddress: "서울 송파구 한가람로 65", poiQuery: "잠실한강공원 잠실안내센터" },
  { parkId: "jamwon", parkName: "잠원한강공원", candidateName: "잠원안내센터", meetingInstruction: "잠원안내센터 건물 출입구 앞", officialAddress: "서울 서초구 잠원로 221-124", poiQuery: "잠원한강공원 잠원안내센터" },
] as const;

export function meetingPointByParkId(parkId: string) {
  return MEETING_POINT_CATALOG.find((point) => point.parkId === parkId) ?? null;
}
