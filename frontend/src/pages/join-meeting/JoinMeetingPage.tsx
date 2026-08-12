import { useEffect, useState, type FormEvent } from "react";

import { RecommendationResult } from "../../features/recommendation/RecommendationResult";
import { PlaceSearchField } from "../../features/place-search/PlaceSearchField";
import type { OriginPlace, RecommendationResult as Recommendation } from "../../shared/api/contracts";
import { api } from "../../shared/api/http";
import { formatMeetingAt } from "../../shared/lib/format-meeting-at";

export function JoinMeetingPage({ inviteToken }: { inviteToken: string }) {
  const [meeting, setMeeting] = useState<{ meetingAt: string; participantCount: number; travelPattern: "shared_origin" | "individual_round_trip"; sharedOriginName: string | null } | null>(null);
  const [alias, setAlias] = useState("");
  const [origin, setOrigin] = useState<OriginPlace | null>(null);
  const [destination, setDestination] = useState<OriginPlace | null>(null);
  const [result, setResult] = useState<Recommendation | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");
  const [recommendationUnavailable, setRecommendationUnavailable] = useState(false);

  useEffect(() => {
    api<{ meeting: { meetingAt: string; participantCount: number; travelPattern: "shared_origin" | "individual_round_trip"; sharedOriginName: string | null } }>(`/api/invites/${inviteToken}`).then((invite) => {
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
      setError(meeting?.travelPattern === "shared_origin" ? "별칭과 귀가 장소를 다시 확인해 주세요." : "별칭과 출발·귀가 장소를 다시 확인해 주세요.");
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
      {sharedOrigin && <section className="shared-origin-summary"><span>함께 출발하는 장소</span><strong>{meeting.sharedOriginName ?? "방장이 장소를 정하는 중이에요"}</strong></section>}
      {!sharedOrigin && <PlaceSearchField
        searchPath={`/api/invites/${inviteToken}/places`}
        id="origin-place"
        label="출발하고 돌아갈 장소"
        help="정확한 집 주소 대신 가까운 역·학교·건물·공공장소 하나를 선택해 갈 때와 귀가에 함께 사용해요."
        selected={origin}
        onSelect={selectOrigin}
      />}
      {sharedOrigin && <PlaceSearchField searchPath={`/api/invites/${inviteToken}/places`} id="destination-place" label="약속 후 각자 이동할 장소" help="귀가할 집 주소가 아니라 가까운 공개 장소를 선택해 주세요." selected={destination} onSelect={setDestination} />}
      {error && <p className="error">{error}</p>}
      <button disabled={sharedOrigin ? !meeting.sharedOriginName || !destination : !origin}>이동 장소 제출하기</button>
      <p className="note">공통 출발 장소는 초대받은 친구에게 보입니다. 개인 귀가 장소는 방장과 다른 친구에게 공개되지 않습니다.</p>
    </form>
  </main>;
}
