import type { ReactNode } from "react";
import type { ParkResult, RecommendationResult as Recommendation } from "../../shared/api/contracts";
import { AppIcon } from "../../shared/ui/AppIcon";

const ROLE_LABEL = {
  recommended: "추천",
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

function TravelMetrics({ title, travel }: { title: string; travel: ParkResult["travel"] }) {
  return <section className="travel-metrics"><h3>{title}</h3><dl className="metrics">
    <div><dt>평균</dt><dd>{travel.averageMinutes}<small>분</small></dd></div>
    <div><dt>가장 오래</dt><dd>{travel.maximumMinutes}<small>분</small></dd></div>
    <div><dt>친구 간 차이</dt><dd>{travel.rangeMinutes}<small>분</small></dd></div>
  </dl></section>;
}

function KeyMetrics({ park }: { park: ParkResult }) {
  return <dl className="key-metrics">
    <div><dt>갈 때 평균</dt><dd>{park.travel.averageMinutes}<small>분</small></dd></div>
    {park.returnTravel
      ? <div><dt>귀가 평균</dt><dd>{park.returnTravel.averageMinutes}<small>분</small></dd></div>
      : <div><dt>가장 오래</dt><dd>{park.travel.maximumMinutes}<small>분</small></dd></div>}
    <div className="fairness-metric"><dt>친구 간 차이 <span>공평성</span></dt><dd>{park.travel.rangeMinutes}<small>분</small></dd>{park.returnTravel && <p>귀가는 {park.returnTravel.rangeMinutes}분 차이</p>}</div>
  </dl>;
}

const CROWD_ORDER = { very_busy: 4, busy: 3, normal: 2, relaxed: 1 } as const;

function CrowdOverview({ overview }: { overview: Recommendation["crowdOverview"] }) {
  const parks = [...overview.parks].sort((left, right) =>
    (right.level ? CROWD_ORDER[right.level] : 0) - (left.level ? CROWD_ORDER[left.level] : 0)
      || left.parkName.localeCompare(right.parkName, "ko"));
  return <section className="crowd-overview" aria-labelledby="crowd-overview-title">
    <div className="crowd-overview-heading">
      <div><p>{overview.basis === "arrival" ? "약속 시각 예측" : "서울시 · 오늘 지금 기준"}</p><h2 id="crowd-overview-title">11개 한강공원 혼잡도</h2></div>
      {overview.referenceAt && <time dateTime={overview.referenceAt}>{dateTime(overview.referenceAt)} 기준</time>}
    </div>
    <div className="crowd-legend" aria-hidden="true"><span>여유</span><i /><i /><i /><i /><span>붐빔</span></div>
    <ol className="crowd-bars">
      {parks.map((park) => <li key={park.parkId} className={park.isRecommended ? "recommended" : ""}>
        <span className="crowd-park-name">{park.parkName.replace("한강공원", "")}{park.isRecommended && <b>추천</b>}</span>
        <span className={`crowd-bar-track level-${park.level ?? "unavailable"}`}><i /></span>
        <strong>{park.label}</strong>
      </li>)}
    </ol>
    <p className="crowd-overview-note">{overview.basis === "arrival"
      ? "이 도착 예상 혼잡을 이동 공평성과 함께 추천에 반영했어요."
      : "오늘 지금의 혼잡을 비교한 참고 그래프예요. 약속 12시간 전부터 도착 예측으로 다시 계산해요."}</p>
  </section>;
}

function ResultCard({ park, stage, primary = false, confirmed = false, onConfirm }: {
  park: ParkResult;
  stage: Recommendation["stage"];
  primary?: boolean;
  confirmed?: boolean;
  onConfirm?: (park: ParkResult) => void;
}) {
  return (
    <article className={`result-card${primary ? " primary" : ""}${confirmed ? " confirmed" : ""}`}>
      <div className="card-topline">
        <p className="card-label">{park.role === "recommended"
          ? stage === "live_current" ? "도착 혼잡 반영 추천" : "이동 기준 1차 추천"
          : ROLE_LABEL[park.role]}</p>
        <CrowdStatus crowd={park.arrivalCrowd} />
      </div>
      <div className="park-title"><span><AppIcon name="map" /></span><div><h2>{park.parkName}</h2><p className="meeting-point">{park.meetingPoint}</p></div></div>
      <p className="selection-reason">{park.selectionReason}</p>
      <KeyMetrics park={park} />
      <details className="result-details">
        <summary>상세 이동시간과 공원 정보 <AppIcon name="chevron" size={17} /></summary>
        <TravelMetrics title="갈 때 상세" travel={park.travel} />
        {park.returnTravel && <TravelMetrics title="귀가 상세" travel={park.returnTravel} />}
        <ul className="times">
          {park.participantTimes.map((participant) => (
            <li key={participant.alias}>
              <span><i>{participant.alias.slice(0, 1)}</i><span>{participant.alias}<small className="participant-mode">{participant.travelMode === "car" ? "자가용" : "대중교통"}</small></span></span>
              <strong>{participant.minutes}분{participant.returnMinutes !== null ? ` → ${participant.returnMinutes}분` : ""}</strong>
            </li>
          ))}
        </ul>
        <section className="experience">
          <h3>이 공원에서</h3>
          <p>{park.experience.summary}</p>
          <ul className="highlight-list">{park.experience.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>
          <h3>알아둘 점</h3>
          <ul className="caution-list">{park.experience.cautions.map((caution) => <li key={caution}>{caution}</li>)}</ul>
          <a href={park.experience.sourceUrl} target="_blank" rel="noreferrer">서울시 공식 정보 확인</a>
        </section>
      </details>
      {onConfirm && (
        <button className={confirmed ? "confirmed-button" : "confirm-button primary-action"} onClick={() => onConfirm(park)} disabled={confirmed}>
          {confirmed ? "이 장소로 확정됨" : `${park.parkName}으로 확정`}
        </button>
      )}
    </article>
  );
}

function AlternativeCard({ park, confirmed = false, onConfirm }: {
  park: ParkResult;
  confirmed?: boolean;
  onConfirm?: (park: ParkResult) => void;
}) {
  return <article className={`alternative-card${confirmed ? " confirmed" : ""}`}>
    <div className="alternative-main">
      <div><small>{ROLE_LABEL[park.role]}</small><h3>{park.parkName}</h3><p>갈 때 평균 {park.travel.averageMinutes}분{park.returnTravel ? ` · 귀가 평균 ${park.returnTravel.averageMinutes}분` : ""}</p></div>
      <CrowdStatus crowd={park.arrivalCrowd} />
    </div>
    <details className="alternative-details">
      <summary>비교 정보 보기 <AppIcon name="chevron" size={16} /></summary>
      <p className="selection-reason">{park.selectionReason}</p>
      <KeyMetrics park={park} />
      <TravelMetrics title="갈 때 상세" travel={park.travel} />
      {park.returnTravel && <TravelMetrics title="귀가 상세" travel={park.returnTravel} />}
      {onConfirm && <button className={confirmed ? "confirmed-button" : "confirm-button primary-action"} onClick={() => onConfirm(park)} disabled={confirmed}>{confirmed ? "이 장소로 확정됨" : `${park.parkName}으로 확정`}</button>}
    </details>
  </article>;
}

export function RecommendationResult({ result, confirmedParkId, onConfirm, updateNotice, decisionPanel }: {
  result: Recommendation;
  confirmedParkId?: string | null;
  onConfirm?: (park: ParkResult) => void;
  updateNotice?: string;
  decisionPanel?: ReactNode;
}) {
  return (
    <section className="result" aria-live="polite">
      <div className="result-heading">
        {updateNotice && <p className="recommendation-update" role="status"><AppIcon name="spark" size={17} />{updateNotice}</p>}
        <p className="result-kicker"><span><AppIcon name="spark" size={15} /></span>현재 추천 결과</p>
        <h1>지금은 여기를<br />가장 추천해요</h1>
      </div>
      <div className="result-grid">
        <ResultCard park={result.recommended} stage={result.stage} primary confirmed={confirmedParkId === result.recommended.parkId} onConfirm={onConfirm} />
        {decisionPanel}
        <section className="result-context" aria-label="추천 계산 근거">
        <div className={`calculation-status ${result.stage === "live_current" ? "current" : "provisional"}`}>
          <span><AppIcon name={result.stage === "live_current" ? "spark" : "calendar"} size={17} /></span>
          <div><strong>{result.stage === "live_current" ? "이동시간 + 도착 혼잡 반영" : "이동 기준 1차 추천"}</strong><small>{result.stage === "live_current" ? "서울시의 약속 시각 혼잡 예측까지 함께 계산했어요." : "약속 12시간 전부터 공식 혼잡 예측을 추가해 다시 계산해요."}</small></div>
        </div>
        <p className="mode-summary">{result.travelPattern === "shared_origin" ? "함께 출발하는 길 50% · 각자 귀가 50%로 비교했어요." : "각자 갈 때 50% · 각자 귀가 50%로 비교했어요."}</p>
        <p className="transport-summary">{[
          result.travelModes.publicTransit ? `대중교통 ${result.travelModes.publicTransit}명` : "",
          result.travelModes.car ? `자가용 ${result.travelModes.car}명` : "",
        ].filter(Boolean).join(" · ")}의 실제 경로를 비교했어요.</p>
        <p>{result.explanation}</p>
        {result.travelData.calculatedAt && <p className="data-time">카카오 경로 조회 기준 {dateTime(result.travelData.calculatedAt)}</p>}
        {result.nearTie && <span className="badge">두 후보의 차이가 크지 않아요</span>}
        </section>
        <section className="alternatives" aria-labelledby="alternatives-title"><div className="section-heading"><h2 id="alternatives-title">다른 대안 2곳</h2><span>이동시간과 혼잡도 비교</span></div>{result.alternatives.map((park) => <AlternativeCard key={park.parkId} park={park} confirmed={confirmedParkId === park.parkId} onConfirm={onConfirm} />)}</section>
      </div>
      <CrowdOverview overview={result.crowdOverview} />
      <p className="prototype-notice">{result.notice}</p>
    </section>
  );
}
