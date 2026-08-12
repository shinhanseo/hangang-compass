import { useEffect, useRef, useState } from "react";

import { RecommendationResult } from "../../features/recommendation/RecommendationResult";
import { MeetingPollPanel } from "../../features/poll/MeetingPollPanel";
import { PlaceSearchField } from "../../features/place-search/PlaceSearchField";
import type { HostMeeting, MeetingPoll, OriginPlace, ParkResult } from "../../shared/api/contracts";
import { api } from "../../shared/api/http";
import { formatMeetingAt } from "../../shared/lib/format-meeting-at";
import { navigate } from "../../shared/lib/navigation";
import { nextRecommendationRefreshDelay } from "../../shared/lib/recommendation-refresh";
import { forgetRecentMeeting, rememberRecentMeeting } from "../../shared/lib/recent-meetings";
import { shareInviteToKakao, sharePollToKakao } from "../../shared/lib/share-invite";
import { AppIcon } from "../../shared/ui/AppIcon";
import { MobileAppBar } from "../../shared/ui/MobileAppBar";
import { ProvisionalRecommendationSheet } from "../../shared/ui/ProvisionalRecommendationSheet";

export function HostMeetingPage({ meetingId }: { meetingId: string }) {
  const [data, setData] = useState<{ meeting: HostMeeting; invitePath: string | null } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [sharedOrigin, setSharedOrigin] = useState<OriginPlace | null>(null);
  const [savingOrigin, setSavingOrigin] = useState(false);
  const [originError, setOriginError] = useState("");
  const [hostPlace, setHostPlace] = useState<OriginPlace | null>(null);
  const [savingHostPlace, setSavingHostPlace] = useState(false);
  const [hostPlaceError, setHostPlaceError] = useState("");
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState("");
  const [recommendationUpdate, setRecommendationUpdate] = useState("");
  const [provisionalNoticeOpen, setProvisionalNoticeOpen] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
  const [deletingMeeting, setDeletingMeeting] = useState(false);
  const [deletionError, setDeletionError] = useState("");
  const [pollBusy, setPollBusy] = useState(false);
  const [pollError, setPollError] = useState("");
  const previousResult = useRef<HostMeeting["result"]>(null);

  async function refresh() {
    try {
      const next = await api<{ meeting: HostMeeting; invitePath: string | null }>(`/api/meetings/${meetingId}/host`);
      const previous = previousResult.current;
      if (previous && previous.stage !== "live_current" && next.meeting.result?.stage === "live_current") {
        setRecommendationUpdate(previous.recommended.parkId === next.meeting.result.recommended.parkId
          ? "도착 혼잡 예측까지 확인했어요. 1차 추천이 그대로 유지됐어요."
          : `도착 혼잡 예측을 반영했어요. 새 추천은 ${next.meeting.result.recommended.parkName}이에요.`);
      }
      previousResult.current = next.meeting.result;
      rememberRecentMeeting({ id: next.meeting.id, meetingAt: next.meeting.meetingAt });
      setData(next);
      setError("");
    } catch (cause) {
      if (cause instanceof Error && cause.message === "host_access_denied") forgetRecentMeeting(meetingId);
      setError("이 브라우저에는 방장 권한이 없어요.");
    }
  }
  useEffect(() => { void refresh(); }, [meetingId]);
  useEffect(() => {
    const key = `hc_provisional_notice_${meetingId}`;
    if (sessionStorage.getItem(key) !== "1") return;
    sessionStorage.removeItem(key);
    setProvisionalNoticeOpen(true);
  }, [meetingId]);
  useEffect(() => {
    const refreshAt = data?.meeting.result?.refreshAt;
    if (!refreshAt) return;
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(
        Date.now() >= new Date(refreshAt).getTime() ? () => void refresh() : schedule,
        nextRecommendationRefreshDelay(refreshAt),
      );
    };
    schedule();
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() >= new Date(refreshAt).getTime()) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [data?.meeting.result?.refreshAt, meetingId]);
  useEffect(() => {
    if (data?.meeting.poll?.status !== "open") return;
    const timer = window.setInterval(() => {
      void api<{ poll: MeetingPoll }>(`/api/meetings/${meetingId}/poll`).then((response) => updatePoll(response.poll)).catch(() => undefined);
    }, 4_000);
    return () => window.clearInterval(timer);
  }, [data?.meeting.poll?.status, meetingId]);

  if (error) return <main className="shell app-screen"><MobileAppBar /><div className="state-card"><span className="state-icon">!</span><h1>접근할 수 없어요</h1><p>{error}</p><button className="primary-action" onClick={() => navigate("/")}>새 약속 만들기</button></div></main>;
  if (!data) return <main className="shell app-screen"><MobileAppBar /><div className="loading-screen"><span /><p>약속을 불러오는 중…</p></div></main>;
  const shareUrl = data.invitePath ? `${window.location.origin}${data.invitePath}` : "";

  async function copyShareLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
  }

  async function shareToKakao() {
    if (!shareUrl) return;
    setSharing(true);
    setShareError("");
    try {
      await shareInviteToKakao(shareUrl, formatMeetingAt(data!.meeting.meetingAt));
    } catch {
      setShareError("이 기기에서 공유 앱을 열지 못했어요. 아래 링크 복사를 이용해 주세요.");
    } finally {
      setSharing(false);
    }
  }

  async function confirmPark(park: ParkResult) {
    const confirmed = await api<{ confirmedParkId: string }>(`/api/meetings/${meetingId}/confirmation`, {
      method: "POST",
      body: JSON.stringify({ parkId: park.parkId }),
    });
    setData((current) => current ? {
      ...current,
      meeting: { ...current.meeting, confirmedParkId: confirmed.confirmedParkId },
    } : current);
  }

  async function createRecoveryUrl(): Promise<string> {
    const recovery = await api<{ path: string }>(`/api/meetings/${meetingId}/recovery-link`, { method: "POST" });
    return `${window.location.origin}${recovery.path}`;
  }

  async function copyRecoveryLink() {
    setRecoveryBusy(true);
    setRecoveryMessage("");
    try {
      await navigator.clipboard.writeText(await createRecoveryUrl());
      setRecoveryMessage("방장 전용 링크를 복사했어요. 나만 볼 수 있는 곳에 보관해 주세요.");
    } catch {
      setRecoveryMessage("방장 링크를 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setRecoveryBusy(false);
    }
  }

  async function shareRecoveryLink() {
    setRecoveryBusy(true);
    setRecoveryMessage("");
    try {
      const url = await createRecoveryUrl();
      const canShare = typeof navigator.share === "function";
      if (canShare) await navigator.share({ title: "한강갈까 방장 약속", text: "나중에 이 약속을 다시 관리할 방장 전용 링크예요.", url });
      else await navigator.clipboard.writeText(url);
      setRecoveryMessage(canShare ? "방장 링크 공유 화면을 열었어요." : "공유 기능이 없어 방장 링크를 복사했어요.");
    } catch {
      setRecoveryMessage("공유를 완료하지 못했어요. 링크 복사를 이용해 주세요.");
    } finally {
      setRecoveryBusy(false);
    }
  }

  async function saveSharedOrigin() {
    if (!sharedOrigin) return;
    setSavingOrigin(true);
    setOriginError("");
    try {
      const result = await api<{ sharedOriginName: string }>(`/api/meetings/${meetingId}/shared-origin`, {
        method: "PUT",
        body: JSON.stringify({ placeId: sharedOrigin.id, placeName: sharedOrigin.name }),
      });
      setData((current) => current ? {
        ...current,
        meeting: { ...current.meeting, sharedOriginName: result.sharedOriginName },
      } : current);
    } catch {
      setOriginError("공통 출발 장소를 저장하지 못했어요. 참여자가 들어오기 전에 다시 선택해 주세요.");
    } finally {
      setSavingOrigin(false);
    }
  }

  async function saveHostPlace() {
    if (!hostPlace) return;
    setSavingHostPlace(true);
    setHostPlaceError("");
    try {
      const sharedOriginPattern = data!.meeting.travelPattern === "shared_origin";
      const result = await api<{ meeting: HostMeeting }>(`/api/meetings/${meetingId}/host-participant`, {
        method: "PUT",
        body: JSON.stringify({
          alias: "방장",
          originPlaceId: sharedOriginPattern ? undefined : hostPlace.id,
          originPlaceName: sharedOriginPattern ? undefined : hostPlace.name,
          destinationPlaceId: sharedOriginPattern ? hostPlace.id : undefined,
          destinationPlaceName: sharedOriginPattern ? hostPlace.name : undefined,
        }),
      });
      setData((current) => current ? { ...current, meeting: result.meeting } : current);
    } catch {
      setHostPlaceError("방장님의 이동 장소를 저장하지 못했어요. 장소를 다시 선택해 주세요.");
    } finally {
      setSavingHostPlace(false);
    }
  }

  async function cancelMeeting() {
    if (deletingMeeting) return;
    setDeletingMeeting(true);
    setDeletionError("");
    try {
      await api<{ deleted: true }>(`/api/meetings/${meetingId}`, { method: "DELETE" });
      forgetRecentMeeting(meetingId);
      navigate("/");
    } catch {
      setDeletionError("약속을 취소하지 못했어요. 잠시 후 다시 시도해 주세요.");
      setDeletingMeeting(false);
    }
  }

  function updatePoll(poll: MeetingPoll) {
    setData((current) => current ? { ...current, meeting: { ...current.meeting, poll } } : current);
  }

  async function pollAction(path: string, body?: { parkId: string }) {
    setPollBusy(true);
    setPollError("");
    try {
      const response = await api<{ poll: MeetingPoll }>(`/api/meetings/${meetingId}/poll${path}`, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
      updatePoll(response.poll);
    } catch {
      setPollError("투표 상태를 바꾸지 못했어요. 새로고침 후 다시 시도해 주세요.");
    } finally {
      setPollBusy(false);
    }
  }

  async function sharePoll() {
    if (!shareUrl) return;
    setPollBusy(true);
    setPollError("");
    try {
      await sharePollToKakao(`${shareUrl}?view=poll`, formatMeetingAt(data!.meeting.meetingAt));
    } catch {
      setPollError("카카오톡 투표 공유를 열지 못했어요. 초대 링크 복사를 이용해 주세요.");
    } finally {
      setPollBusy(false);
    }
  }

  async function confirmPollWinner() {
    setPollBusy(true);
    setPollError("");
    try {
      const response = await api<{ confirmedParkId: string }>(`/api/meetings/${meetingId}/poll/confirm`, { method: "POST" });
      setData((current) => current ? { ...current, meeting: { ...current.meeting, confirmedParkId: response.confirmedParkId } } : current);
    } catch {
      setPollError("투표 결과를 확정하지 못했어요. 새로고침 후 다시 시도해 주세요.");
    } finally {
      setPollBusy(false);
    }
  }

  const needsSharedOrigin = data.meeting.travelPattern === "shared_origin" && !data.meeting.sharedOriginName;
  const needsHostPlace = !data.meeting.hostParticipantSubmitted;
  const setupIncomplete = needsSharedOrigin || needsHostPlace;
  const inviteToken = data.invitePath?.split("/").at(-1);

  return (
    <main className="shell app-screen host-screen">
      <MobileAppBar action={<button className="icon-button" aria-label="새로고침" onClick={() => void refresh()}><AppIcon name="refresh" /></button>} />
      <section className="meeting-hero">
        <div className="host-status"><span>방장</span><span className="status-dot" />{data.meeting.participantCount < 2 ? "최소 인원 대기 중" : `${data.meeting.participantCount}명으로 추천 중`}</div>
        <h1>한강 피크닉</h1>
        <div className="meeting-meta"><span><AppIcon name="calendar" size={18} />{formatMeetingAt(data.meeting.meetingAt)}</span><span><AppIcon name="people" size={18} />{data.meeting.travelPattern === "shared_origin" ? "함께 출발 · 각자 귀가" : "각자 출발 · 각자 귀가"}</span></div>
      </section>
      <section className="host-recovery-card">
        <span className="host-recovery-icon"><AppIcon name="lock" /></span>
        <div><small>나중에 다시 들어오려면</small><strong>방장 전용 링크를 보관하세요</strong><p>이 기기에서는 홈의 진행 중인 약속으로 이어볼 수 있어요. 다른 기기에서는 이 링크가 필요해요.</p></div>
        <div className="host-recovery-actions">
          <button type="button" onClick={() => void copyRecoveryLink()} disabled={recoveryBusy}><AppIcon name="copy" size={17} />링크 복사</button>
          <button type="button" onClick={() => void shareRecoveryLink()} disabled={recoveryBusy}><AppIcon name="share" size={17} />공유</button>
        </div>
        <p className="host-recovery-warning"><AppIcon name="lock" size={14} />이 링크를 가진 사람은 약속을 관리할 수 있어요. 친구 초대 링크와 구분해 주세요.</p>
        {recoveryMessage && <p className="host-recovery-message" role="status">{recoveryMessage}</p>}
      </section>
      {needsSharedOrigin && inviteToken && <section className="task-card priority-task">
        <div className="task-kicker"><span>먼저 할 일</span><b>1/3</b></div>
        <div className="task-heading"><span className="task-icon"><AppIcon name="map" /></span><div><h2>함께 출발할 장소</h2><p>방장이 한 번 정하면 친구들은 귀가지만 입력해요.</p></div></div>
        <PlaceSearchField
          searchPath={`/api/invites/${inviteToken}/places`}
          id="shared-origin-place"
          label="모두 함께 출발하는 장소"
          help="학교·역·건물 같은 공개 장소만 선택해 주세요. 초대받은 친구에게 이 장소명이 표시됩니다."
          selected={sharedOrigin}
          onSelect={setSharedOrigin}
        />
        <button className="primary-action" onClick={() => void saveSharedOrigin()} disabled={!sharedOrigin || savingOrigin}>{savingOrigin ? "장소를 저장하는 중…" : "출발 장소 정하기"}</button>
        {originError && <p className="error">{originError}</p>}
      </section>}
      {!needsSharedOrigin && data.meeting.travelPattern === "shared_origin" && <section className="origin-banner"><span className="banner-icon"><AppIcon name="map" /></span><span><small>함께 출발</small><strong>{data.meeting.sharedOriginName}</strong></span><span className="check-badge">✓</span></section>}
      {needsHostPlace && !needsSharedOrigin && inviteToken && <section className="task-card priority-task host-travel-card">
        <div className="task-kicker"><span>{data.meeting.travelPattern === "shared_origin" ? "다음 할 일" : "먼저 할 일"}</span><b>{data.meeting.travelPattern === "shared_origin" ? "2/3" : "1/2"}</b></div>
        <div className="task-heading"><span className="task-icon"><AppIcon name="map" /></span><div><h2>{data.meeting.travelPattern === "shared_origin" ? "방장님의 귀가 장소" : "방장님의 출발·귀가 장소"}</h2><p>방장님도 이동시간 비교에 포함할게요.</p></div></div>
        <PlaceSearchField
          searchPath={`/api/invites/${inviteToken}/places`}
          id="host-travel-place"
          label={data.meeting.travelPattern === "shared_origin" ? "약속 후 이동할 장소" : "출발하고 돌아갈 장소"}
          help={data.meeting.travelPattern === "shared_origin" ? "집 주소 대신 귀가할 때 이용할 가까운 역·학교·건물 같은 공개 장소를 골라주세요." : "공개 장소 하나를 갈 때와 귀가에 함께 사용해 불필요한 검색을 줄여요."}
          selected={hostPlace}
          onSelect={setHostPlace}
        />
        <p className="privacy-line host-privacy"><AppIcon name="lock" size={15} />이 장소는 친구들에게 공개되지 않아요.</p>
        <button className="primary-action" onClick={() => void saveHostPlace()} disabled={!hostPlace || savingHostPlace}>{savingHostPlace ? "내 장소를 저장하는 중…" : "내 이동 장소 저장하기"}</button>
        {hostPlaceError && <p className="error">{hostPlaceError}</p>}
      </section>}
      <section className={`task-card invite-card${setupIncomplete ? " locked" : ""}`}>
        <div className="task-kicker"><span>{setupIncomplete ? "다음 할 일" : "친구 초대"}</span><b>{setupIncomplete ? (data.meeting.travelPattern === "shared_origin" ? "3/3" : "2/2") : `현재 ${data.meeting.participantCount}명 · 최대 8명`}</b></div>
        <div className="task-heading"><span className="task-icon"><AppIcon name={setupIncomplete ? "lock" : "people"} /></span><div><h2>친구에게 초대 보내기</h2><p>{setupIncomplete ? "방장님의 이동 장소까지 정하면 초대를 보낼 수 있어요." : "최소 2명부터 추천하고, 최대 8명까지 함께 비교해요."}</p></div></div>
        {setupIncomplete ? <div className="share-locked"><AppIcon name="lock" size={17} />내 이동 장소를 먼저 정해 주세요</div> : <div className="invite-share-actions">
          <button className="kakao-share-button" onClick={() => void shareToKakao()} disabled={!shareUrl || sharing}><span className="kakao-mark" aria-hidden="true" />{sharing ? "공유 화면 여는 중…" : "카카오톡으로 초대"}</button>
          <button className="link-copy-button" onClick={() => void copyShareLink()} disabled={!shareUrl} aria-label="초대 링크 복사"><AppIcon name="copy" />{copied ? "복사 완료" : "링크 복사"}</button>
        </div>}
        {shareError && <p className="error">{shareError}</p>}
        <div className="inline-actions">
          {data.invitePath && !setupIncomplete && <a className="text-action" href={data.invitePath} target="_blank" rel="noreferrer">참여자 화면 미리보기 <AppIcon name="chevron" size={17} /></a>}
        </div>
        {data.meeting.participants.length > 0 && <div className="participant-list"><p>참여 완료</p><div>{data.meeting.participants.map((item) => <span className="participant-chip" key={`${item.alias}-${item.isHost}`}><i>{item.alias.slice(0, 1)}</i>{item.alias}{item.isHost && <small>나</small>}</span>)}</div></div>}
      </section>
      {data.meeting.result ? <RecommendationResult result={data.meeting.result} confirmedParkId={data.meeting.confirmedParkId} onConfirm={data.meeting.poll ? undefined : (park) => void confirmPark(park)} updateNotice={recommendationUpdate} decisionPanel={(data.meeting.poll || !data.meeting.confirmedParkId) ? <>
        <MeetingPollPanel
          result={data.meeting.result}
          poll={data.meeting.poll}
          role="host"
          busy={pollBusy}
          confirmedParkId={data.meeting.confirmedParkId}
          onStart={() => void pollAction("")}
          onVote={(parkId) => void pollAction("/vote", { parkId })}
          onShare={() => void sharePoll()}
          onClose={() => void pollAction("/close")}
          onRestart={() => void pollAction("/restart")}
          onRandom={() => void pollAction("/random")}
          onConfirmWinner={() => void confirmPollWinner()}
        />
        {pollError && <p className="error poll-error" role="alert">{pollError}</p>}
      </> : undefined} /> : data.meeting.recommendationStatus === "route_unavailable" ? (
        <section className="waiting-state"><span>!</span><h2>이동 경로를 확인하지 못했어요</h2><p>일부 경로를 계산하지 못했습니다. 잠시 후 위의 새로고침 버튼을 눌러주세요.</p></section>
      ) : setupIncomplete ? (
        <section className="waiting-state compact"><div className="progress-track"><i /></div><p>방장님의 이동 장소를 정하면 초대가 시작돼요.</p></section>
      ) : (
        <section className="waiting-state"><span><AppIcon name="spark" /></span><h2>추천 시작까지 1명 남았어요</h2><p>친구 한 명 이상이 참여하면 추천을 시작하고, 이후 참여자가 늘어날 때마다 최대 8명까지 다시 계산해요.</p><div className="capacity-status"><strong>현재 {data.meeting.participantCount}명</strong><small>최소 2명 · 최대 8명</small></div></section>
      )}
      <section className="meeting-cancel-area" aria-label="약속 관리">
        <button type="button" onClick={() => { setDeletionError(""); setCancelSheetOpen(true); }}>약속 취소하기</button>
        <p>취소하면 초대 링크와 참여 정보가 함께 삭제돼요.</p>
      </section>
      {provisionalNoticeOpen && <ProvisionalRecommendationSheet onClose={() => setProvisionalNoticeOpen(false)} />}
      {cancelSheetOpen && <div className="sheet-layer">
        <button className="sheet-scrim" type="button" aria-label="약속 취소 닫기" onClick={() => !deletingMeeting && setCancelSheetOpen(false)} />
        <section className="bottom-sheet cancel-meeting-sheet" role="dialog" aria-modal="true" aria-labelledby="cancel-meeting-title">
          <div className="sheet-handle" />
          <div className="sheet-header"><div><p>약속 관리</p><h2 id="cancel-meeting-title">이 약속을 취소할까요?</h2></div><button className="icon-button" type="button" aria-label="닫기" onClick={() => setCancelSheetOpen(false)} disabled={deletingMeeting}><AppIcon name="close" /></button></div>
          <p className="cancel-meeting-copy">참여자의 이동 장소와 추천 결과가 삭제되고, 친구에게 보낸 초대 링크도 바로 사용할 수 없게 됩니다.</p>
          {deletionError && <p className="error" role="alert">{deletionError}</p>}
          <div className="cancel-meeting-actions">
            <button type="button" className="secondary-action" onClick={() => setCancelSheetOpen(false)} disabled={deletingMeeting}>돌아가기</button>
            <button type="button" className="danger-action" onClick={() => void cancelMeeting()} disabled={deletingMeeting}>{deletingMeeting ? "취소하는 중…" : "약속 취소"}</button>
          </div>
        </section>
      </div>}
    </main>
  );
}
