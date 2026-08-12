import { useEffect, useState } from "react";

import { RecommendationResult } from "../../features/recommendation/RecommendationResult";
import { PlaceSearchField } from "../../features/place-search/PlaceSearchField";
import type { HostMeeting, OriginPlace, ParkResult } from "../../shared/api/contracts";
import { api } from "../../shared/api/http";
import { formatMeetingAt } from "../../shared/lib/format-meeting-at";
import { navigate } from "../../shared/lib/navigation";

export function HostMeetingPage({ meetingId }: { meetingId: string }) {
  const [data, setData] = useState<{ meeting: HostMeeting; invitePath: string | null } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [sharedOrigin, setSharedOrigin] = useState<OriginPlace | null>(null);
  const [savingOrigin, setSavingOrigin] = useState(false);
  const [originError, setOriginError] = useState("");

  async function refresh() {
    try {
      setData(await api(`/api/meetings/${meetingId}/host`));
      setError("");
    } catch {
      setError("이 브라우저에는 방장 권한이 없어요.");
    }
  }
  useEffect(() => { void refresh(); }, [meetingId]);

  if (error) return <main className="shell narrow"><div className="panel"><h1>접근할 수 없어요</h1><p>{error}</p><button onClick={() => navigate("/")}>새 약속 만들기</button></div></main>;
  if (!data) return <main className="shell narrow"><p>약속을 불러오는 중…</p></main>;
  const shareUrl = data.invitePath ? `${window.location.origin}${data.invitePath}` : "";

  async function copyShareLink() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
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

  const needsSharedOrigin = data.meeting.travelPattern === "shared_origin" && !data.meeting.sharedOriginName;
  const inviteToken = data.invitePath?.split("/").at(-1);

  return (
    <main className="shell">
      <section className="topbar">
        <div><p className="eyebrow">HOST · {data.meeting.travelPattern === "shared_origin" ? "TOGETHER" : "INDIVIDUAL"}</p><h1>한강 피크닉 약속</h1><p>{formatMeetingAt(data.meeting.meetingAt)} · {data.meeting.travelPattern === "shared_origin" ? "함께 출발 · 각자 귀가" : "각자 출발 · 각자 귀가"}</p></div>
        <button className="secondary" onClick={() => void refresh()}>새로고침</button>
      </section>
      {needsSharedOrigin && inviteToken && <section className="panel share-panel">
        <div><h2>함께 출발할 장소를 정해 주세요</h2><p>방장이 한 번만 입력하면 친구들은 자신의 귀가 장소만 제출합니다.</p></div>
        <PlaceSearchField
          searchPath={`/api/invites/${inviteToken}/places`}
          id="shared-origin-place"
          label="모두 함께 출발하는 장소"
          help="학교·역·건물 같은 공개 장소만 선택해 주세요. 초대받은 친구에게 이 장소명이 표시됩니다."
          selected={sharedOrigin}
          onSelect={setSharedOrigin}
        />
        <button onClick={() => void saveSharedOrigin()} disabled={!sharedOrigin || savingOrigin}>{savingOrigin ? "저장 중…" : "공통 출발 장소 저장"}</button>
        {originError && <p className="error">{originError}</p>}
      </section>}
      {!needsSharedOrigin && data.meeting.travelPattern === "shared_origin" && <section className="shared-origin-banner"><span>함께 출발</span><strong>{data.meeting.sharedOriginName}</strong></section>}
      <section className="panel share-panel">
        <div><h2>친구를 초대하세요</h2><p>{data.meeting.participantCount}명이 이동 장소를 제출했어요.</p></div>
        <input aria-label="공유 링크" readOnly value={needsSharedOrigin ? "공통 출발 장소를 먼저 저장해 주세요" : shareUrl} />
        <div className="actions">
          <button onClick={() => void copyShareLink()} disabled={!shareUrl || needsSharedOrigin}>{copied ? "복사했어요" : "링크 복사"}</button>
          {data.invitePath && !needsSharedOrigin && <a className="button-link" href={data.invitePath} target="_blank" rel="noreferrer">친구 화면 열기</a>}
        </div>
        {data.meeting.participants.length > 0 && <p className="submitted">참여 완료: {data.meeting.participants.map((item) => item.alias).join(", ")}</p>}
      </section>
      {data.meeting.result ? <RecommendationResult result={data.meeting.result} confirmedParkId={data.meeting.confirmedParkId} onConfirm={(park) => void confirmPark(park)} /> : data.meeting.recommendationStatus === "route_unavailable" ? (
        <section className="waiting"><h2>이동 경로를 확인하지 못했어요</h2><p>경로 API가 일부 또는 전체 후보를 계산하지 못했습니다. 잠시 후 새로고침해 주세요.</p></section>
      ) : needsSharedOrigin ? (
        <section className="waiting"><h2>공통 출발 장소를 먼저 정해 주세요</h2><p>저장하면 친구에게 공유할 링크가 활성화됩니다.</p></section>
      ) : (
        <section className="waiting"><h2>친구 2명의 입력을 기다리고 있어요</h2><p>공유 링크를 다른 탭에서 열어 두 번 제출한 뒤 새로고침하면 추천이 나타납니다.</p></section>
      )}
    </main>
  );
}
