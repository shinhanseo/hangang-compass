import { useState } from "react";
import type { NearbyPlaceGuide, NearbyPlaceKind, ParkResult } from "../../shared/api/contracts";
import { kakaoMapSearchUrl } from "../../shared/lib/kakao-map-search";
import { AppIcon } from "../../shared/ui/AppIcon";

const SECTION_COPY: Record<NearbyPlaceKind, { label: string; description: string }> = {
  spot: { label: "둘러볼 곳", description: "공원 근처에서 함께 들를 만한 명소예요." },
  food: { label: "먹을 곳", description: "피크닉 전후 동선이 짧은 음식점이에요." },
  cafe: { label: "카페", description: "공원에서 가까운 순으로 골랐어요." },
  store: { label: "준비물", description: "간식과 준비물을 사기 가까운 편의점이에요." },
};

function distance(value: number) {
  return value < 1_000 ? `${value}m` : `${(value / 1_000).toFixed(1)}km`;
}

export function ConfirmedParkGuide({ park, nearby, nearbyStatus = "idle" }: {
  park: ParkResult;
  nearby?: NearbyPlaceGuide | null;
  nearbyStatus?: "idle" | "loading" | "ready" | "failed";
}) {
  const sections = nearby?.sections.filter((section) => section.status === "available" && section.places.length > 0) ?? [];
  const [activeKind, setActiveKind] = useState<NearbyPlaceKind>("spot");
  const active = sections.find((section) => section.kind === activeKind) ?? sections[0] ?? null;
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
        <div className="confirmed-section-title"><span>02</span><h2 id="nearby-search-title">근처에서 여기 가봐요</h2></div>
        <p>확정 장소를 기준으로 카카오맵의 실제 장소를 가까운 순으로 찾았어요.</p>
        {nearbyStatus === "loading" && <div className="nearby-loading" role="status"><i /><i /><span>주변 장소를 고르는 중…</span></div>}
        {nearbyStatus === "ready" && active && <>
          <div className="nearby-tabs" role="tablist" aria-label="주변 장소 종류">
            {sections.map((section) => <button key={section.kind} type="button" role="tab" aria-selected={active.kind === section.kind} onClick={() => setActiveKind(section.kind)}>{SECTION_COPY[section.kind].label}</button>)}
          </div>
          <p className="nearby-section-description">{SECTION_COPY[active.kind].description}</p>
          <ol className="nearby-place-list">{active.places.map((place, index) => <li key={place.id}>
            <a href={place.kakaoMapUrl} target="_blank" rel="noreferrer">
              <span className="nearby-place-rank">{String(index + 1).padStart(2, "0")}</span>
              <span className="nearby-place-copy"><span><strong>{place.name}</strong><small>{place.category}</small></span><span>{distance(place.distanceMeters)} · {place.address || "카카오맵에서 위치 확인"}</span></span>
              <AppIcon name="chevron" size={17} />
            </a>
          </li>)}</ol>
          <small className="nearby-source">거리·분류 기준 · 카카오맵 장소 정보</small>
        </>}
        {(nearbyStatus === "failed" || (nearbyStatus === "ready" && !active)) && <div className="nearby-fallback"><p>지금은 실제 장소를 불러오지 못했어요.</p><a href={kakaoMapSearchUrl(park.parkName, "food")} target="_blank" rel="noreferrer">카카오맵에서 주변 전체 보기 <AppIcon name="chevron" size={14} /></a></div>}
      </section>
      <aside className="confirmed-cautions"><strong>가기 전에 확인해요</strong><ul>{park.experience.cautions.map((caution) => <li key={caution}>{caution}</li>)}</ul><a href={park.experience.sourceUrl} target="_blank" rel="noreferrer">서울시 공식 공원 정보 <AppIcon name="chevron" size={14} /></a></aside>
    </div>
  </section>;
}
