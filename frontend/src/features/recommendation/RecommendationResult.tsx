import type { ParkResult, RecommendationResult as Recommendation } from "../../shared/api/contracts";

function ResultCard({ label, park, primary = false }: {
  label: string;
  park: ParkResult;
  primary?: boolean;
}) {
  return (
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
          <li key={participant.alias}>
            <span>{participant.alias}</span>
            <strong>{participant.minutes}분</strong>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function RecommendationResult({ result }: { result: Recommendation }) {
  return (
    <section className="result" aria-live="polite">
      <div className="result-heading">
        <p className="eyebrow">FAKE RECOMMENDATION</p>
        <h1>지금은 여기가 가장 공평해요</h1>
        <p>{result.explanation}</p>
        {result.nearTie && <span className="badge">두 후보의 차이가 크지 않아요</span>}
      </div>
      <div className="result-grid">
        <ResultCard label="추천" park={result.recommended} primary />
        <ResultCard label="대안" park={result.alternative} />
      </div>
      <p className="prototype-notice">{result.notice}</p>
    </section>
  );
}
