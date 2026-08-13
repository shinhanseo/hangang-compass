import type { ParkResult } from "../../shared/api/contracts";
import { kakaoMapSearchUrl, type NearbySearchKind } from "../../shared/lib/kakao-map-search";
import { AppIcon } from "../../shared/ui/AppIcon";

const NEARBY_SEARCHES: Array<{ kind: NearbySearchKind; label: string; description: string }> = [
  { kind: "food", label: "근처 맛집", description: "피크닉 전후 식사할 곳" },
  { kind: "cafe", label: "근처 카페", description: "쉬어가기 좋은 공간" },
  { kind: "convenience", label: "편의점", description: "간식과 준비물 사기" },
];

export function ConfirmedParkGuide({ park }: { park: ParkResult }) {
  return <section className="confirmed-park-guide" aria-labelledby="confirmed-guide-title">
    <header className="confirmed-guide-heading">
      <p><span aria-hidden="true">✓</span> 약속 장소 확정</p>
      <h1 id="confirmed-guide-title">{park.parkName}에서<br />이렇게 놀아봐요</h1>
      <span className="confirmed-meeting-point"><AppIcon name="map" size={17} />{park.meetingPoint}</span>
    </header>
    <div className="confirmed-guide-body">
      <section className="confirmed-activities" aria-labelledby="confirmed-activities-title">
        <div className="confirmed-section-title"><span>01</span><h2 id="confirmed-activities-title">공원에서 할 것</h2></div>
        <p>{park.experience.summary}</p>
        <ol>{park.experience.highlights.map((highlight) => <li key={highlight}><span aria-hidden="true" />{highlight}</li>)}</ol>
      </section>
      <section className="nearby-searches" aria-labelledby="nearby-search-title">
        <div className="confirmed-section-title"><span>02</span><h2 id="nearby-search-title">주변에서 더 찾기</h2></div>
        <p>카카오맵의 최신 장소 결과로 바로 연결해요.</p>
        <div>{NEARBY_SEARCHES.map((search) => <a key={search.kind} href={kakaoMapSearchUrl(park.parkName, search.kind)} target="_blank" rel="noreferrer">
          <span className="nearby-search-icon"><AppIcon name="search" size={17} /></span>
          <span><strong>{search.label}</strong><small>{search.description}</small></span>
          <AppIcon name="chevron" size={16} />
        </a>)}</div>
      </section>
      <aside className="confirmed-cautions"><strong>가기 전에 확인해요</strong><ul>{park.experience.cautions.map((caution) => <li key={caution}>{caution}</li>)}</ul><a href={park.experience.sourceUrl} target="_blank" rel="noreferrer">서울시 공식 공원 정보 <AppIcon name="chevron" size={14} /></a></aside>
    </div>
  </section>;
}
