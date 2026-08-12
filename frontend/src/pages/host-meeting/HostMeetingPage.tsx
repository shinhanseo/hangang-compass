import { useEffect, useState } from "react";

import { RecommendationResult } from "../../features/recommendation/RecommendationResult";
import type { HostMeeting, ParkResult } from "../../shared/api/contracts";
import { api } from "../../shared/api/http";
import { formatMeetingAt } from "../../shared/lib/format-meeting-at";
import { navigate } from "../../shared/lib/navigation";

export function HostMeetingPage({ meetingId }: { meetingId: string }) {
  const [data, setData] = useState<{ meeting: HostMeeting; invitePath: string | null } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

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

  return (
    <main className="shell">
      <section className="topbar">
        <div><p className="eyebrow">HOST · {data.meeting.tripMode === "round_trip" ? "ROUND TRIP" : "ONE WAY"}</p><h1>한강 피크닉 약속</h1><p>{formatMeetingAt(data.meeting.meetingAt)} · {data.meeting.tripMode === "round_trip" ? "왕복까지 비교" : "갈 때만 비교"}</p></div>
        <button className="secondary" onClick={() => void refresh()}>새로고침</button>
      </section>
      <section className="panel share-panel">
        <div><h2>친구를 초대하세요</h2><p>{data.meeting.participantCount}명이 출발지를 제출했어요.</p></div>
        <input aria-label="공유 링크" readOnly value={shareUrl} />
        <div className="actions">
          <button onClick={() => void copyShareLink()} disabled={!shareUrl}>{copied ? "복사했어요" : "링크 복사"}</button>
          {data.invitePath && <a className="button-link" href={data.invitePath} target="_blank" rel="noreferrer">친구 화면 열기</a>}
        </div>
        {data.meeting.participants.length > 0 && <p className="submitted">참여 완료: {data.meeting.participants.map((item) => item.alias).join(", ")}</p>}
      </section>
      {data.meeting.result ? <RecommendationResult result={data.meeting.result} confirmedParkId={data.meeting.confirmedParkId} onConfirm={(park) => void confirmPark(park)} /> : data.meeting.recommendationStatus === "route_unavailable" ? (
        <section className="waiting"><h2>이동 경로를 확인하지 못했어요</h2><p>경로 API가 일부 또는 전체 후보를 계산하지 못했습니다. 잠시 후 새로고침해 주세요.</p></section>
      ) : (
        <section className="waiting"><h2>친구 2명의 입력을 기다리고 있어요</h2><p>공유 링크를 다른 탭에서 열어 두 번 제출한 뒤 새로고침하면 추천이 나타납니다.</p></section>
      )}
    </main>
  );
}
