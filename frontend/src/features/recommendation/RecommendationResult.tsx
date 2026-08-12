import type { ParkResult, RecommendationResult as Recommendation } from "../../shared/api/contracts";

const ROLE_LABEL = {
  recommended: "오늘의 추천",
  travel_alternative: "이동 균형 대안",
  experience_alternative: "다른 즐길거리 대안",
} as const;

function dateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(value));
}

function CrowdStatus({ crowd }: { crowd: ParkResult["arrivalCrowd"] }) {
  const title = crowd.status === "fake_sample"
    ? `가상 도착 혼잡 · ${crowd.label}`
    : crowd.status === "live_forecast"
      ? `도착 예측 · ${crowd.label}`
      : crowd.status === "live_current"
        ? `현재 관측 · ${crowd.label}`
        : `도착 혼잡 · ${crowd.label}`;
  const details = crowd.referenceAt
    ? `${crowd.status === "live_forecast" ? "예측 기준" : "관측 기준"} ${dateTime(crowd.referenceAt)}${crowd.freshness === "stale" ? " · 오래된 데이터" : ""}`
    : null;
  return (
    <div className="crowd-status">
      <span className={`crowd crowd-${crowd.level ?? "unavailable"}`}>{title}</span>
      {details && <small>{details}</small>}
    </div>
  );
}

function ResultCard({ park, primary = false, confirmed = false, onConfirm }: {
  park: ParkResult;
  primary?: boolean;
  confirmed?: boolean;
  onConfirm?: (park: ParkResult) => void;
}) {
  return (
    <article className={`result-card${primary ? " primary" : ""}${confirmed ? " confirmed" : ""}`}>
      <div className="card-topline">
        <p className="card-label">{ROLE_LABEL[park.role]}</p>
        <CrowdStatus crowd={park.arrivalCrowd} />
      </div>
      <h2>{park.parkName}</h2>
      <p className="meeting-point">{park.meetingPoint}</p>
      <p className="selection-reason">{park.selectionReason}</p>
      <dl className="metrics">
        <div><dt>평균</dt><dd>{park.travel.averageMinutes}분</dd></div>
        <div><dt>최장</dt><dd>{park.travel.maximumMinutes}분</dd></div>
        <div><dt>차이</dt><dd>{park.travel.rangeMinutes}분</dd></div>
      </dl>
      <section className="experience">
        <h3>여기서 즐길 수 있어요</h3>
        <p>{park.experience.summary}</p>
        <ul className="highlight-list">
          {park.experience.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}
        </ul>
        <h3>알아둘 점</h3>
        <ul className="caution-list">
          {park.experience.cautions.map((caution) => <li key={caution}>{caution}</li>)}
        </ul>
        <a href={park.experience.sourceUrl} target="_blank" rel="noreferrer">서울시 공식 정보 확인</a>
      </section>
      <ul className="times">
        {park.participantTimes.map((participant) => (
          <li key={participant.alias}>
            <span>{participant.alias}</span>
            <strong>{participant.minutes}분</strong>
          </li>
        ))}
      </ul>
      {onConfirm && (
        <button className={confirmed ? "confirmed-button" : "confirm-button"} onClick={() => onConfirm(park)} disabled={confirmed}>
          {confirmed ? "이 장소로 확정됨" : `${park.parkName}으로 확정`}
        </button>
      )}
    </article>
  );
}

export function RecommendationResult({ result, confirmedParkId, onConfirm }: {
  result: Recommendation;
  confirmedParkId?: string | null;
  onConfirm?: (park: ParkResult) => void;
}) {
  return (
    <section className="result" aria-live="polite">
      <div className="result-heading">
        <p className="eyebrow">{result.stage === "fake_provisional" ? "FAKE RECOMMENDATION" : "LIVE CROWD · ROUTE SAMPLE"}</p>
        <h1>지금은 여기가 가장 공평해요</h1>
        <p>{result.explanation}</p>
        {result.nearTie && <span className="badge">두 후보의 차이가 크지 않아요</span>}
      </div>
      <div className="result-grid">
        <ResultCard park={result.recommended} primary confirmed={confirmedParkId === result.recommended.parkId} onConfirm={onConfirm} />
        {result.alternatives.map((park) => (
          <ResultCard key={park.parkId} park={park} confirmed={confirmedParkId === park.parkId} onConfirm={onConfirm} />
        ))}
      </div>
      <p className="prototype-notice">{result.notice}</p>
    </section>
  );
}
