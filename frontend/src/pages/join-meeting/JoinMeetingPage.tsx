import { useEffect, useState, type FormEvent } from "react";

import { RecommendationResult } from "../../features/recommendation/RecommendationResult";
import type { RecommendationResult as Recommendation, Station } from "../../shared/api/contracts";
import { api } from "../../shared/api/http";
import { formatMeetingAt } from "../../shared/lib/format-meeting-at";

export function JoinMeetingPage({ inviteToken }: { inviteToken: string }) {
  const [meeting, setMeeting] = useState<{ meetingAt: string; participantCount: number } | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [alias, setAlias] = useState("");
  const [stationId, setStationId] = useState("");
  const [result, setResult] = useState<Recommendation | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");
  const [recommendationUnavailable, setRecommendationUnavailable] = useState(false);

  useEffect(() => {
    Promise.all([
      api<{ meeting: { meetingAt: string; participantCount: number } }>(`/api/invites/${inviteToken}`),
      api<{ stations: Station[] }>("/api/stations"),
    ]).then(([invite, stationData]) => {
      setMeeting(invite.meeting);
      setCount(invite.meeting.participantCount);
      setStations(stationData.stations);
      setStationId(stationData.stations[0]?.id ?? "");
    }).catch(() => setError("초대 링크가 없거나 만료됐어요."));
  }, [inviteToken]);

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
        { method: "POST", body: JSON.stringify({ alias, stationId }) },
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
  if (result) return <main className="shell"><RecommendationResult result={result} /><button className="secondary restart" onClick={() => { setResult(null); setAlias(""); }}>다른 친구 입력도 테스트하기</button></main>;
  if (recommendationUnavailable) return <main className="shell narrow"><section className="panel"><h1>이동 경로를 확인하지 못했어요</h1><p>일부 출발역에서 한강공원까지의 경로가 없어 지금은 추천을 만들 수 없습니다. 잠시 후 방장 화면에서 다시 확인해 주세요.</p></section></main>;

  return (
    <main className="shell narrow">
      <section className="hero compact"><p className="eyebrow">INVITATION</p><h1>한강 피크닉에 참여할까요?</h1><p className="description">{formatMeetingAt(meeting.meetingAt)} · 현재 {count}명 참여</p></section>
      <form className="panel" onSubmit={submit}>
        <label htmlFor="alias">별칭</label>
        <input id="alias" value={alias} onChange={(event) => setAlias(event.target.value)} maxLength={20} placeholder="친구들이 알아볼 이름" required />
        <label htmlFor="station">출발역</label>
        <select id="station" value={stationId} onChange={(event) => setStationId(event.target.value)} required>
          {stations.map((station) => <option key={station.id} value={station.id}>{station.name}</option>)}
        </select>
        {error && <p className="error">{error}</p>}
        <button>출발지 제출하기</button>
        <p className="note">방장과 다른 친구에게 출발역은 공개되지 않고 이동시간만 표시됩니다.</p>
      </form>
    </main>
  );
}
