import { StrictMode, useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";

import "./styles.css";

interface Station { id: string; name: string }
interface ParkResult {
  parkId: string;
  parkName: string;
  meetingPoint: string;
  travel: { averageMinutes: number; maximumMinutes: number; rangeMinutes: number };
  participantTimes: Array<{ alias: string; minutes: number }>;
}
interface RecommendationResult {
  recommended: ParkResult;
  alternative: ParkResult;
  explanation: string;
  notice: string;
  nearTie: boolean;
}
interface HostMeeting {
  id: string;
  meetingAt: string;
  participantCount: number;
  participants: Array<{ alias: string }>;
  result: RecommendationResult | null;
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...options?.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "request_failed");
  return body;
}

function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function formatMeetingAt(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(value));
}

function ResultView({ result }: { result: RecommendationResult }) {
  const card = (label: string, park: ParkResult, primary = false) => (
    <article className={`result-card${primary ? " primary" : ""}`}>
      <p className="card-label">{label}</p>
      <h2>{park.parkName}</h2>
      <p className="meeting-point">{park.meetingPoint}</p>
      <dl className="metrics">
        <div><dt>평균</dt><dd>{park.travel.averageMinutes}분</dd></div>
        <div><dt>최장</dt><dd>{park.travel.maximumMinutes}분</dd></div>
        <div><dt>차이</dt><dd>{park.travel.rangeMinutes}분</dd></div>
      </dl>
      <ul className="times">
        {park.participantTimes.map((participant) => (
          <li key={participant.alias}><span>{participant.alias}</span><strong>{participant.minutes}분</strong></li>
        ))}
      </ul>
    </article>
  );
  return (
    <section className="result" aria-live="polite">
      <div className="result-heading">
        <p className="eyebrow">FAKE RECOMMENDATION</p>
        <h1>지금은 여기가 가장 공평해요</h1>
        <p>{result.explanation}</p>
        {result.nearTie && <span className="badge">두 후보의 차이가 크지 않아요</span>}
      </div>
      <div className="result-grid">
        {card("추천", result.recommended, true)}
        {card("대안", result.alternative)}
      </div>
      <p className="prototype-notice">{result.notice}</p>
    </section>
  );
}

function CreateMeeting() {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1_000);
  const initial = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60_000)
    .toISOString().slice(0, 16);
  const [meetingAt, setMeetingAt] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = await api<{ meeting: HostMeeting }>("/api/meetings", {
        method: "POST",
        body: JSON.stringify({ meetingAt: new Date(meetingAt).toISOString() }),
      });
      navigate(`/host/${body.meeting.id}`);
    } catch {
      setError("미래 날짜와 시간을 다시 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell narrow">
      <section className="hero">
        <p className="eyebrow">HANGANG COMPASS</p>
        <h1>친구들과 갈 한강, 계산해서 정해요.</h1>
        <p className="description">약속 시간을 만들고 친구들에게 링크를 보내면 이동 부담이 공평한 공원을 추천합니다.</p>
      </section>
      <form className="panel" onSubmit={submit}>
        <label htmlFor="meeting-at">모두가 도착할 날짜와 시간</label>
        <input id="meeting-at" type="datetime-local" value={meetingAt} onChange={(event) => setMeetingAt(event.target.value)} required />
        {error && <p className="error">{error}</p>}
        <button disabled={busy}>{busy ? "만드는 중…" : "피크닉 약속 만들기"}</button>
        <p className="note">회원가입 없이 만들 수 있어요. 현재 위치와 정확한 주소는 받지 않습니다.</p>
      </form>
    </main>
  );
}

function HostPage({ meetingId }: { meetingId: string }) {
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

  return (
    <main className="shell">
      <section className="topbar">
        <div><p className="eyebrow">HOST</p><h1>한강 피크닉 약속</h1><p>{formatMeetingAt(data.meeting.meetingAt)}</p></div>
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
      {data.meeting.result ? <ResultView result={data.meeting.result} /> : (
        <section className="waiting"><h2>친구 2명의 입력을 기다리고 있어요</h2><p>공유 링크를 다른 탭에서 열어 두 번 제출한 뒤 새로고침하면 추천이 나타납니다.</p></section>
      )}
    </main>
  );
}

function JoinPage({ inviteToken }: { inviteToken: string }) {
  const [meeting, setMeeting] = useState<{ meetingAt: string; participantCount: number } | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [alias, setAlias] = useState("");
  const [stationId, setStationId] = useState("");
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");

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
      const joined = await api<{ participantCount: number; result: RecommendationResult | null }>(
        `/api/invites/${inviteToken}/participants`,
        { method: "POST", body: JSON.stringify({ alias, stationId }) },
      );
      setCount(joined.participantCount);
      setResult(joined.result);
    } catch {
      setError("별칭과 출발역을 다시 확인해 주세요.");
    }
  }

  if (error && !meeting) return <main className="shell narrow"><div className="panel"><h1>참여할 수 없어요</h1><p>{error}</p></div></main>;
  if (!meeting) return <main className="shell narrow"><p>초대장을 불러오는 중…</p></main>;
  if (result) return <main className="shell"><ResultView result={result} /><button className="secondary restart" onClick={() => { setResult(null); setAlias(""); }}>다른 친구 입력도 테스트하기</button></main>;

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

function App() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  const host = path.match(/^\/host\/([^/]+)$/u);
  const join = path.match(/^\/join\/([^/]+)$/u);
  if (host) return <HostPage meetingId={host[1]!} />;
  if (join) return <JoinPage inviteToken={join[1]!} />;
  return <CreateMeeting />;
}

const root = document.getElementById("root");
if (!root) throw new Error("root_element_missing");
createRoot(root).render(<StrictMode><App /></StrictMode>);
