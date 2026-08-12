import { useEffect, useState, type FormEvent } from "react";

import { RecommendationResult } from "../../features/recommendation/RecommendationResult";
import type { OriginPlace, RecommendationResult as Recommendation } from "../../shared/api/contracts";
import { api } from "../../shared/api/http";
import { formatMeetingAt } from "../../shared/lib/format-meeting-at";

export function JoinMeetingPage({ inviteToken }: { inviteToken: string }) {
  const [meeting, setMeeting] = useState<{ meetingAt: string; participantCount: number } | null>(null);
  const [alias, setAlias] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [places, setPlaces] = useState<OriginPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<OriginPlace | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [result, setResult] = useState<Recommendation | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");
  const [recommendationUnavailable, setRecommendationUnavailable] = useState(false);

  useEffect(() => {
    api<{ meeting: { meetingAt: string; participantCount: number } }>(`/api/invites/${inviteToken}`).then((invite) => {
      setMeeting(invite.meeting);
      setCount(invite.meeting.participantCount);
    }).catch(() => setError("초대 링크가 없거나 만료됐어요."));
  }, [inviteToken]);

  useEffect(() => {
    const query = placeQuery.trim();
    if (query.length < 2 || selectedPlace?.name === query) {
      setPlaces([]);
      setSearching(false);
      setSearchError("");
      return;
    }
    let active = true;
    setSearching(true);
    setSearchError("");
    const timeout = window.setTimeout(() => {
      api<{ places: OriginPlace[] }>(`/api/invites/${inviteToken}/places?query=${encodeURIComponent(query)}`)
        .then((result) => {
          if (!active) return;
          setPlaces(result.places);
          setSearchError(result.places.length ? "" : "검색 결과가 없어요. 장소 이름을 더 구체적으로 입력해 주세요.");
        })
        .catch(() => active && setSearchError("장소 검색을 잠시 사용할 수 없어요. 조금 뒤 다시 시도해 주세요."))
        .finally(() => active && setSearching(false));
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [inviteToken, placeQuery, selectedPlace]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const joined = await api<{
        participantCount: number;
        result: Recommendation | null;
        recommendationStatus: "waiting_for_participants" | "ready" | "route_unavailable";
      }>(
        `/api/invites/${inviteToken}/participants`,
        { method: "POST", body: JSON.stringify({
          alias,
          originPlaceId: selectedPlace?.id,
          originPlaceName: selectedPlace?.name,
        }) },
      );
      setCount(joined.participantCount);
      setResult(joined.result);
      setRecommendationUnavailable(joined.recommendationStatus === "route_unavailable");
    } catch {
      setError("별칭과 출발역을 다시 확인해 주세요.");
    }
  }

  if (error && !meeting) return <main className="shell narrow"><div className="panel"><h1>참여할 수 없어요</h1><p>{error}</p></div></main>;
  if (!meeting) return <main className="shell narrow"><p>초대장을 불러오는 중…</p></main>;
  if (result) return <main className="shell"><RecommendationResult result={result} /><button className="secondary restart" onClick={() => { setResult(null); setAlias(""); setPlaceQuery(""); setSelectedPlace(null); }}>다른 친구 입력도 테스트하기</button></main>;
  if (recommendationUnavailable) return <main className="shell narrow"><section className="panel"><h1>이동 경로를 확인하지 못했어요</h1><p>일부 출발 장소에서 한강공원까지의 경로가 없어 지금은 추천을 만들 수 없습니다. 잠시 후 방장 화면에서 다시 확인해 주세요.</p></section></main>;

  return (
    <main className="shell narrow">
      <section className="hero compact"><p className="eyebrow">INVITATION</p><h1>한강 피크닉에 참여할까요?</h1><p className="description">{formatMeetingAt(meeting.meetingAt)} · 현재 {count}명 참여</p></section>
      <form className="panel" onSubmit={submit}>
        <label htmlFor="alias">별칭</label>
        <input id="alias" value={alias} onChange={(event) => setAlias(event.target.value)} maxLength={20} placeholder="친구들이 알아볼 이름" required />
        <label htmlFor="origin-place">출발 장소</label>
        <input
          id="origin-place"
          value={placeQuery}
          onChange={(event) => {
            setPlaceQuery(event.target.value);
            if (selectedPlace?.name !== event.target.value) setSelectedPlace(null);
          }}
          maxLength={50}
          placeholder="역, 학교, 건물, 공공장소 검색"
          autoComplete="off"
          aria-describedby="place-help place-status"
          required
        />
        <p id="place-help" className="note">정확한 집 주소 대신 친구들이 아는 가까운 공개 장소를 선택해 주세요.</p>
        <div id="place-status" className="place-status" aria-live="polite">
          {searching && <p className="note">카카오맵에서 장소를 찾는 중…</p>}
          {searchError && <p className="error">{searchError}</p>}
          {selectedPlace && <p className="selected-place"><strong>{selectedPlace.name}</strong><span>{selectedPlace.address || selectedPlace.category}</span></p>}
        </div>
        {!selectedPlace && places.length > 0 && (
          <ul className="place-results" aria-label="장소 검색 결과">
            {places.map((place) => (
              <li key={place.id}>
                <button type="button" onClick={() => { setSelectedPlace(place); setPlaceQuery(place.name); setPlaces([]); }}>
                  <strong>{place.name}</strong>
                  <span>{place.address || "주소 정보 없음"}</span>
                  <small>{place.category}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="error">{error}</p>}
        <button disabled={!selectedPlace || searching}>출발 장소 제출하기</button>
        <p className="note">방장과 다른 친구에게 선택한 장소는 공개되지 않고 이동시간만 표시됩니다.</p>
      </form>
    </main>
  );
}
