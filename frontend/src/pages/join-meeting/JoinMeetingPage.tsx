import { useEffect, useState, type FormEvent } from "react";

import { RecommendationResult } from "../../features/recommendation/RecommendationResult";
import { PlaceSearchField } from "../../features/place-search/PlaceSearchField";
import type { OriginPlace, RecommendationResult as Recommendation } from "../../shared/api/contracts";
import { api } from "../../shared/api/http";
import { formatMeetingAt } from "../../shared/lib/format-meeting-at";
import { nextRecommendationRefreshDelay } from "../../shared/lib/recommendation-refresh";
import { AppIcon } from "../../shared/ui/AppIcon";
import { MobileAppBar } from "../../shared/ui/MobileAppBar";

export function JoinMeetingPage({ inviteToken }: { inviteToken: string }) {
  const [meeting, setMeeting] = useState<{ meetingAt: string; participantCount: number; travelPattern: "shared_origin" | "individual_round_trip"; sharedOriginName: string | null } | null>(null);
  const [alias, setAlias] = useState("");
  const [origin, setOrigin] = useState<OriginPlace | null>(null);
  const [destination, setDestination] = useState<OriginPlace | null>(null);
  const [result, setResult] = useState<Recommendation | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");
  const [recommendationUnavailable, setRecommendationUnavailable] = useState(false);
  const [recommendationUpdate, setRecommendationUpdate] = useState("");
  const [publicResult, setPublicResult] = useState<Recommendation | null>(null);
  const [viewingPublicResult, setViewingPublicResult] = useState(false);

  useEffect(() => {
    api<{ meeting: { meetingAt: string; participantCount: number; travelPattern: "shared_origin" | "individual_round_trip"; sharedOriginName: string | null } }>(`/api/invites/${inviteToken}`).then((invite) => {
      setMeeting(invite.meeting);
      setCount(invite.meeting.participantCount);
      if (invite.meeting.participantCount >= 2) {
        void api<{ result: Recommendation }>(`/api/invites/${inviteToken}/recommendation`)
          .then((response) => setPublicResult(response.result))
          .catch(() => undefined);
      }
    }).catch(() => setError("초대 링크가 없거나 만료됐어요."));
  }, [inviteToken]);

  useEffect(() => {
    const refreshAt = result?.refreshAt;
    if (!refreshAt) return;
    let timer = 0;
    const refreshRecommendation = async () => {
      try {
        const updated = await api<{ result: Recommendation }>(`/api/invites/${inviteToken}/recommendation`);
        if (result && result.stage !== "live_current" && updated.result.stage === "live_current") {
          setRecommendationUpdate(result.recommended.parkId === updated.result.recommended.parkId
            ? "도착 혼잡 예측까지 확인했어요. 1차 추천이 그대로 유지됐어요."
            : `도착 혼잡 예측을 반영했어요. 새 추천은 ${updated.result.recommended.parkName}이에요.`);
        }
        setResult(updated.result);
      } catch {
        // 기존 1차 추천을 유지하고 다음 방문이나 방장 새로고침에서 다시 계산한다.
      }
    };
    const schedule = () => {
      timer = window.setTimeout(
        Date.now() >= new Date(refreshAt).getTime() ? () => void refreshRecommendation() : schedule,
        nextRecommendationRefreshDelay(refreshAt),
      );
    };
    schedule();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() >= new Date(refreshAt).getTime()) void refreshRecommendation();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [inviteToken, result?.refreshAt]);

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
      setViewingPublicResult(false);
      setRecommendationUnavailable(joined.recommendationStatus === "route_unavailable");
    } catch {
      setError(meeting?.travelPattern === "shared_origin" ? "별칭과 귀가 장소를 다시 확인해 주세요." : "별칭과 출발·귀가 장소를 다시 확인해 주세요.");
    }
  }

  if (error && !meeting) return <main className="shell app-screen"><MobileAppBar /><div className="state-card"><span className="state-icon">!</span><h1>참여할 수 없어요</h1><p>{error}</p></div></main>;
  if (!meeting) return <main className="shell app-screen"><MobileAppBar /><div className="loading-screen"><span /><p>초대장을 불러오는 중…</p></div></main>;
  if (result) return <main className="shell app-screen"><MobileAppBar />
    {viewingPublicResult && <section className="public-result-banner"><div><small>이미 진행 중인 약속이에요</small><strong>현재 추천을 먼저 보고 있어요</strong></div><button type="button" onClick={() => { setResult(null); setViewingPublicResult(false); }}>내 장소도 입력하기</button></section>}
    <RecommendationResult result={result} updateNotice={recommendationUpdate} />
  </main>;
  if (recommendationUnavailable) return <main className="shell app-screen"><MobileAppBar /><section className="state-card"><span className="state-icon">!</span><h1>경로를 확인하지 못했어요</h1><p>일부 참여자의 이동 경로가 없어 지금은 추천을 만들 수 없습니다. 잠시 후 방장 화면에서 다시 확인해 주세요.</p></section></main>;

  const sharedOrigin = meeting.travelPattern === "shared_origin";
  return <main className="shell app-screen join-screen">
    <MobileAppBar />
    <section className="invite-hero"><div className="invite-label"><span className="status-dot" />친구가 초대했어요</div><h1>한강 피크닉</h1><div className="invite-date"><strong>{formatMeetingAt(meeting.meetingAt)}</strong><span><AppIcon name="people" size={17} />현재 {count}명 · 최대 8명</span></div><div className="invite-river" aria-hidden="true"><i /><i /><i /></div></section>
    {publicResult && <button className="public-result-trigger" type="button" onClick={() => { setResult(publicResult); setViewingPublicResult(true); }}><span><AppIcon name="spark" /></span><span><small>친구들이 만든 현재 결과</small><strong>추천 먼저 보기</strong></span><AppIcon name="chevron" /></button>}
    <form className="app-form join-form" onSubmit={submit}>
      <section className="form-section">
        <div className="section-title"><span>1</span><div><h2>누구인지 알려주세요</h2><p>친구들이 알아볼 이름이면 충분해요.</p></div></div>
        <label className="field-label" htmlFor="alias">별칭</label>
        <input id="alias" className="app-input" value={alias} onChange={(event) => setAlias(event.target.value)} maxLength={20} placeholder="예: 한강러버" required />
      </section>
      <section className="form-section">
        <div className="section-title"><span>2</span><div><h2>{sharedOrigin ? "약속 후 어디로 가나요?" : "어디에서 출발하나요?"}</h2><p>정확한 주소 대신 가까운 공개 장소를 골라주세요.</p></div></div>
      {sharedOrigin && <section className="origin-banner join-origin"><span className="banner-icon"><AppIcon name="map" /></span><span><small>함께 출발</small><strong>{meeting.sharedOriginName ?? "방장이 장소를 정하는 중이에요"}</strong></span><span className="check-badge">✓</span></section>}
      {!sharedOrigin && <PlaceSearchField
        searchPath={`/api/invites/${inviteToken}/places`}
        id="origin-place"
        label="출발하고 돌아갈 장소"
        help="정확한 집 주소 대신 가까운 역·학교·건물·공공장소 하나를 선택해 갈 때와 귀가에 함께 사용해요."
        selected={origin}
        onSelect={selectOrigin}
      />}
      {sharedOrigin && <PlaceSearchField searchPath={`/api/invites/${inviteToken}/places`} id="destination-place" label="약속 후 각자 이동할 장소" help="귀가할 집 주소가 아니라 가까운 공개 장소를 선택해 주세요." selected={destination} onSelect={setDestination} />}
      </section>
      {error && <p className="error">{error}</p>}
      <p className="privacy-card"><span><AppIcon name="lock" size={18} /></span><span><strong>내 이동 장소는 나만 알아요</strong><small>방장과 다른 친구에게 공개되지 않습니다.</small></span></p>
      <div className="bottom-action"><button className="primary-action" disabled={sharedOrigin ? !meeting.sharedOriginName || !destination : !origin}>이동 장소 제출하기<AppIcon name="chevron" /></button></div>
    </form>
  </main>;
}
