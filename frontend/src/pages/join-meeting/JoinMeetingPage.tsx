import { useEffect, useState, type FormEvent } from "react";

import { RecommendationResult } from "../../features/recommendation/RecommendationResult";
import type { OriginPlace, RecommendationResult as Recommendation } from "../../shared/api/contracts";
import { api } from "../../shared/api/http";
import { formatMeetingAt } from "../../shared/lib/format-meeting-at";

function PlaceField({ inviteToken, id, label, help, selected, onSelect }: {
  inviteToken: string;
  id: string;
  label: string;
  help: string;
  selected: OriginPlace | null;
  onSelect: (place: OriginPlace | null) => void;
}) {
  const [query, setQuery] = useState(selected?.name ?? "");
  const [places, setPlaces] = useState<OriginPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    if (selected) setQuery(selected.name);
  }, [selected]);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2 || selected?.name === normalized) {
      setPlaces([]);
      setSearching(false);
      setSearchError("");
      return;
    }
    let active = true;
    setSearching(true);
    setSearchError("");
    const timeout = window.setTimeout(() => {
      api<{ places: OriginPlace[] }>(`/api/invites/${inviteToken}/places?query=${encodeURIComponent(normalized)}`)
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
  }, [inviteToken, query, selected]);

  return <div className="place-field">
    <label htmlFor={id}>{label}</label>
    <input
      id={id}
      value={query}
      onChange={(event) => {
        setQuery(event.target.value);
        if (selected?.name !== event.target.value) onSelect(null);
      }}
      maxLength={50}
      placeholder="역, 학교, 건물, 공공장소 검색"
      autoComplete="off"
      aria-describedby={`${id}-help ${id}-status`}
      required
    />
    <p id={`${id}-help`} className="note">{help}</p>
    <div id={`${id}-status`} className="place-status" aria-live="polite">
      {searching && <p className="note">카카오맵에서 장소를 찾는 중…</p>}
      {searchError && <p className="error">{searchError}</p>}
      {selected && <p className="selected-place"><strong>{selected.name}</strong><span>{selected.address || selected.category}</span></p>}
    </div>
    {!selected && places.length > 0 && <ul className="place-results" aria-label={`${label} 검색 결과`}>
      {places.map((place) => <li key={place.id}>
        <button type="button" onClick={() => { onSelect(place); setQuery(place.name); setPlaces([]); }}>
          <strong>{place.name}</strong><span>{place.address || "주소 정보 없음"}</span><small>{place.category}</small>
        </button>
      </li>)}
    </ul>}
  </div>;
}

export function JoinMeetingPage({ inviteToken }: { inviteToken: string }) {
  const [meeting, setMeeting] = useState<{ meetingAt: string; participantCount: number; travelPattern: "shared_origin" | "individual_round_trip" } | null>(null);
  const [alias, setAlias] = useState("");
  const [origin, setOrigin] = useState<OriginPlace | null>(null);
  const [destination, setDestination] = useState<OriginPlace | null>(null);
  const [result, setResult] = useState<Recommendation | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");
  const [recommendationUnavailable, setRecommendationUnavailable] = useState(false);

  useEffect(() => {
    api<{ meeting: { meetingAt: string; participantCount: number; travelPattern: "shared_origin" | "individual_round_trip" } }>(`/api/invites/${inviteToken}`).then((invite) => {
      setMeeting(invite.meeting);
      setCount(invite.meeting.participantCount);
    }).catch(() => setError("초대 링크가 없거나 만료됐어요."));
  }, [inviteToken]);

  function selectOrigin(place: OriginPlace | null) {
    setOrigin(place);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const joined = await api<{
        participantCount: number;
        result: Recommendation | null;
        recommendationStatus: "waiting_for_participants" | "ready" | "route_unavailable";
      }>(`/api/invites/${inviteToken}/participants`, {
        method: "POST",
        body: JSON.stringify({
          alias,
          originPlaceId: origin?.id,
          originPlaceName: origin?.name,
          destinationPlaceId: destination?.id,
          destinationPlaceName: destination?.name,
        }),
      });
      setCount(joined.participantCount);
      setResult(joined.result);
      setRecommendationUnavailable(joined.recommendationStatus === "route_unavailable");
    } catch {
      setError(meeting?.travelPattern === "shared_origin" ? "별칭과 공통 출발·귀가 장소를 다시 확인해 주세요." : "별칭과 출발·귀가 장소를 다시 확인해 주세요.");
    }
  }

  function restart() {
    setResult(null);
    setAlias("");
    setOrigin(null);
    setDestination(null);
  }

  if (error && !meeting) return <main className="shell narrow"><div className="panel"><h1>참여할 수 없어요</h1><p>{error}</p></div></main>;
  if (!meeting) return <main className="shell narrow"><p>초대장을 불러오는 중…</p></main>;
  if (result) return <main className="shell"><RecommendationResult result={result} /><button className="secondary restart" onClick={restart}>다른 친구 입력도 테스트하기</button></main>;
  if (recommendationUnavailable) return <main className="shell narrow"><section className="panel"><h1>이동 경로를 확인하지 못했어요</h1><p>일부 참여자의 갈 때 또는 귀가 경로가 없어 지금은 추천을 만들 수 없습니다. 잠시 후 방장 화면에서 다시 확인해 주세요.</p></section></main>;

  const sharedOrigin = meeting.travelPattern === "shared_origin";
  return <main className="shell narrow">
    <section className="hero compact"><p className="eyebrow">INVITATION · {sharedOrigin ? "TOGETHER" : "INDIVIDUAL"}</p><h1>한강 피크닉에 참여할까요?</h1><p className="description">{formatMeetingAt(meeting.meetingAt)} · 현재 {count}명 참여</p></section>
    <form className="panel" onSubmit={submit}>
      <label htmlFor="alias">별칭</label>
      <input id="alias" value={alias} onChange={(event) => setAlias(event.target.value)} maxLength={20} placeholder="친구들이 알아볼 이름" required />
      <PlaceField
        inviteToken={inviteToken}
        id="origin-place"
        label={sharedOrigin ? "모두 함께 출발하는 장소" : "출발하고 돌아갈 장소"}
        help={sharedOrigin
          ? "친구들과 약속한 같은 학교·역·건물 같은 공개 장소를 선택해 주세요. 같은 장소 경로는 한 번만 계산해요."
          : "정확한 집 주소 대신 가까운 역·학교·건물·공공장소 하나를 선택해 갈 때와 귀가에 함께 사용해요."}
        selected={origin}
        onSelect={selectOrigin}
      />
      {sharedOrigin && <PlaceField inviteToken={inviteToken} id="destination-place" label="약속 후 각자 이동할 장소" help="귀가할 집 주소가 아니라 가까운 공개 장소를 선택해 주세요." selected={destination} onSelect={setDestination} />}
      {error && <p className="error">{error}</p>}
      <button disabled={!origin || (sharedOrigin && !destination)}>이동 장소 제출하기</button>
      <p className="note">방장과 다른 친구에게 장소는 공개되지 않고 방향별 이동시간만 표시됩니다.</p>
    </form>
  </main>;
}
