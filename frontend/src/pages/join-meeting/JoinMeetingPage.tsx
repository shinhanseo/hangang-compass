import { useEffect, useState, type FormEvent } from "react";

import { RecommendationResult } from "../../features/recommendation/RecommendationResult";
import { MeetingPollPanel } from "../../features/poll/MeetingPollPanel";
import { PlaceSearchField } from "../../features/place-search/PlaceSearchField";
import { TravelModeSelector } from "../../features/travel-mode/TravelModeSelector";
import type { MeetingPoll, OriginPlace, RecommendationResult as Recommendation, TravelMode } from "../../shared/api/contracts";
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
  const [travelMode, setTravelMode] = useState<TravelMode>("public_transit");
  const [result, setResult] = useState<Recommendation | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");
  const [recommendationUnavailable, setRecommendationUnavailable] = useState(false);
  const [recommendationUpdate, setRecommendationUpdate] = useState("");
  const [publicResult, setPublicResult] = useState<Recommendation | null>(null);
  const [viewingPublicResult, setViewingPublicResult] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [poll, setPoll] = useState<MeetingPoll | null>(null);
  const [pollBusy, setPollBusy] = useState(false);
  const [pollError, setPollError] = useState("");

  useEffect(() => {
    api<{ meeting: { meetingAt: string; participantCount: number; travelPattern: "shared_origin" | "individual_round_trip"; sharedOriginName: string | null } }>(`/api/invites/${inviteToken}`).then((invite) => {
      setMeeting(invite.meeting);
      setCount(invite.meeting.participantCount);
      if (invite.meeting.participantCount >= 2) {
        void api<{ result: Recommendation }>(`/api/invites/${inviteToken}/recommendation`)
          .then((response) => {
            setPublicResult(response.result);
            if (new URLSearchParams(window.location.search).get("view") === "poll") {
              setResult(response.result);
              setViewingPublicResult(true);
            }
          })
          .catch(() => undefined);
      }
    }).catch(() => setError("초대 링크가 없거나 만료됐어요."));
    void api<{ poll: MeetingPoll }>(`/api/invites/${inviteToken}/poll`).then((response) => setPoll(response.poll)).catch(() => undefined);
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
  useEffect(() => {
    if (!publicResult && !result) return;
    const refreshPoll = () => void api<{ poll: MeetingPoll }>(`/api/invites/${inviteToken}/poll`).then((response) => setPoll(response.poll)).catch(() => undefined);
    refreshPoll();
    const timer = window.setInterval(refreshPoll, 4_000);
    return () => window.clearInterval(timer);
  }, [inviteToken, Boolean(publicResult), Boolean(result)]);

  function selectOrigin(place: OriginPlace | null) {
    setOrigin(place);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;
    setError("");
    setIsSubmitting(true);
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
          travelMode,
        }),
      });
      setCount(joined.participantCount);
      setResult(joined.result);
      setViewingPublicResult(false);
      setRecommendationUnavailable(joined.recommendationStatus === "route_unavailable");
      void api<{ poll: MeetingPoll }>(`/api/invites/${inviteToken}/poll`).then((response) => setPoll(response.poll)).catch(() => undefined);
    } catch {
      setError(meeting?.travelPattern === "shared_origin" ? "별칭과 귀가 장소를 다시 확인해 주세요." : "별칭과 출발·귀가 장소를 다시 확인해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function vote(parkId: string) {
    setPollBusy(true);
    setPollError("");
    try {
      const response = await api<{ poll: MeetingPoll }>(`/api/invites/${inviteToken}/poll/vote`, {
        method: "POST",
        body: JSON.stringify({ parkId }),
      });
      setPoll(response.poll);
    } catch {
      setPollError("투표하지 못했어요. 장소를 제출한 브라우저인지 확인해 주세요.");
    } finally {
      setPollBusy(false);
    }
  }

  if (error && !meeting) return <main className="shell app-screen"><MobileAppBar /><div className="state-card"><span className="state-icon">!</span><h1>참여할 수 없어요</h1><p>{error}</p></div></main>;
  if (!meeting) return <main className="shell app-screen"><MobileAppBar /><div className="loading-screen"><span /><p>초대장을 불러오는 중…</p></div></main>;
  if (result) return <main className="shell app-screen"><MobileAppBar />
    {viewingPublicResult && <section className="public-result-banner"><div><small>{poll ? "친구들 투표가 열렸어요" : "이미 진행 중인 약속이에요"}</small><strong>{poll ? "후보와 투표 현황을 보고 있어요" : "현재 추천을 먼저 보고 있어요"}</strong></div><button type="button" onClick={() => { setResult(null); setViewingPublicResult(false); }}>내 장소도 입력하기</button></section>}
    <RecommendationResult result={result} updateNotice={recommendationUpdate} decisionPanel={poll ? <>
      <MeetingPollPanel result={result} poll={poll} role="participant" busy={pollBusy} onVote={(parkId) => void vote(parkId)} />
      {pollError && <p className="error poll-error" role="alert">{pollError}</p>}
    </> : undefined} />
  </main>;
  if (recommendationUnavailable) return <main className="shell app-screen"><MobileAppBar /><section className="state-card"><span className="state-icon">!</span><h1>경로를 확인하지 못했어요</h1><p>일부 참여자의 이동 경로가 없어 지금은 추천을 만들 수 없습니다. 잠시 후 방장 화면에서 다시 확인해 주세요.</p></section></main>;

  const sharedOrigin = meeting.travelPattern === "shared_origin";
  return <main className="shell app-screen join-screen">
    <MobileAppBar />
    <section className="invite-hero">
      <p className="invite-eyebrow">한강 피크닉 초대</p>
      <div className="invite-copy"><p>우리에게 좋은 한강을 함께 골라요</p><h1>한강 피크닉</h1></div>
      <div className="invite-summary">
        <span className="invite-summary-icon"><AppIcon name="calendar" size={18} /></span>
        <span className="invite-summary-time"><small>약속 시간</small><strong>{formatMeetingAt(meeting.meetingAt)}</strong></span>
        <span className="invite-summary-count"><AppIcon name="people" size={16} /><strong>현재 {count}명</strong><small>최대 8명</small></span>
      </div>
      <div className="invite-river" aria-hidden="true"><i /><i /><i /></div>
    </section>
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
      <section className="form-section">
        <div className="section-title"><span>3</span><div><h2>이동 방법을 골라주세요</h2><p>각자 실제로 이용할 방법으로 시간을 비교해요.</p></div></div>
        <TravelModeSelector value={travelMode} onChange={setTravelMode} />
      </section>
      {error && <p className="error">{error}</p>}
      <p className="privacy-card"><span><AppIcon name="lock" size={18} /></span><span><strong>내 이동 장소는 나만 알아요</strong><small>방장과 다른 친구에게 공개되지 않습니다.</small></span></p>
      {publicResult && <button className="public-result-trigger" type="button" onClick={() => { setResult(publicResult); setViewingPublicResult(true); }}><span><AppIcon name="spark" /></span><span><small>친구들이 먼저 입력했어요</small><strong>내 장소를 넣기 전 현재 추천 보기</strong></span><AppIcon name="chevron" /></button>}
      <div className={`bottom-action join-submit-action${isSubmitting ? " submitting" : ""}`}>
        {isSubmitting && <p className="submit-progress" role="status">11개 공원의 이동시간과 혼잡도를 비교하고 있어요.</p>}
        <button
          className="primary-action join-submit"
          disabled={isSubmitting || !alias.trim() || (sharedOrigin ? !meeting.sharedOriginName || !destination : !origin)}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? <><span className="button-spinner" aria-hidden="true" />추천 공원 계산 중…</> : <>이동 장소 제출하기<AppIcon name="chevron" /></>}
        </button>
      </div>
    </form>
  </main>;
}
