export interface SeoulHangangArea {
  parkId: string;
  areaName: string;
}

export const SEOUL_HANGANG_AREAS: readonly SeoulHangangArea[] = [
  { parkId: "gangseo", areaName: "강서한강공원" },
  { parkId: "gwangnaru", areaName: "광나루한강공원" },
  { parkId: "nanji", areaName: "난지한강공원" },
  { parkId: "ttukseom", areaName: "뚝섬한강공원" },
  { parkId: "mangwon", areaName: "망원한강공원" },
  { parkId: "banpo", areaName: "반포한강공원" },
  { parkId: "yanghwa", areaName: "양화한강공원" },
  { parkId: "yeouido", areaName: "여의도한강공원" },
  { parkId: "ichon", areaName: "이촌한강공원" },
  { parkId: "jamsil", areaName: "잠실한강공원" },
  { parkId: "jamwon", areaName: "잠원한강공원" },
] as const;
