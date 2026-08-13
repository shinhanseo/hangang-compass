export type NearbySearchKind = "food" | "cafe" | "convenience";

const SEARCH_TERM: Record<NearbySearchKind, string> = {
  food: "맛집",
  cafe: "카페",
  convenience: "편의점",
};

export function kakaoMapSearchUrl(parkName: string, kind: NearbySearchKind): string {
  return `https://map.kakao.com/link/search/${encodeURIComponent(`${parkName} ${SEARCH_TERM[kind]}`)}`;
}
