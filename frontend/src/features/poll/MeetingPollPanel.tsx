import type { MeetingPoll, ParkResult, RecommendationResult } from "../../shared/api/contracts";

function candidates(result: RecommendationResult): ParkResult[] {
  return [result.recommended, ...result.alternatives];
}

export function MeetingPollPanel({ result, poll, role, busy = false, confirmedParkId, onStart, onVote, onShare, onClose, onRestart, onRandom, onConfirmWinner }: {
  result: RecommendationResult;
  poll: MeetingPoll | null;
  role: "host" | "participant";
  busy?: boolean;
  confirmedParkId?: string | null;
  onStart?: () => void;
  onVote?: (parkId: string) => void;
  onShare?: () => void;
  onClose?: () => void;
  onRestart?: () => void;
  onRandom?: () => void;
  onConfirmWinner?: (parkId: string) => void;
}) {
  const parks = candidates(result);
  if (!poll) return role === "host" ? <section className="poll-entry">
    <div><h2>아직 결정하기 어렵나요?</h2><p>지금 비교한 세 곳으로 친구들과 투표할 수 있어요.</p></div>
    <button type="button" onClick={onStart} disabled={busy}>친구들과 투표하기</button>
  </section> : null;

  const pollParks = poll.candidateParkIds.flatMap((id) => {
    const current = parks.find((item) => item.parkId === id);
    const saved = poll.candidateLabels.find((item) => item.parkId === id);
    return current
      ? [{ parkId: current.parkId, parkName: current.parkName, recommended: current.role === "recommended" }]
      : saved ? [saved] : [];
  });
  const winner = poll.candidateLabels.find((park) => park.parkId === poll.winnerParkId);
  return <section className="meeting-poll" aria-labelledby="meeting-poll-title">
    <header><div><p>{poll.round === 1 ? "친구들 투표" : `${poll.round}차 재투표`}</p><h2 id="meeting-poll-title">{poll.status === "open" ? "어디가 가장 끌리나요?" : poll.status === "tied" ? "투표가 동률이에요" : `${winner?.parkName ?? "투표 결과"} 선택`}</h2></div><strong>{poll.votedCount}/{poll.eligibleCount}명</strong></header>
    {poll.status === "completed" && winner && <div className="poll-winner"><small>{poll.resolution === "random" ? "랜덤으로 선택" : "투표 1위"}</small><strong>{winner.parkName}</strong></div>}
    {poll.status !== "completed" && <div className="poll-options">
      {pollParks.map((park) => {
        const count = poll.tally.find((item) => item.parkId === park.parkId)?.count ?? 0;
        const selected = poll.myVoteParkId === park.parkId;
        return <button type="button" key={park.parkId} className={selected ? "selected" : ""} onClick={() => onVote?.(park.parkId)} disabled={busy || !poll.canVote || poll.status !== "open"}>
          <span><small>{park.recommended ? "한강갈까 추천" : "대안"}</small><strong>{park.parkName}</strong></span><b>{count}표</b>
        </button>;
      })}
    </div>}
    {poll.status === "open" && !poll.canVote && role === "participant" && <p className="poll-help">장소를 제출한 참여자만 투표할 수 있어요.</p>}
    {poll.status === "open" && poll.canVote && <p className="poll-help">표는 투표가 마감되기 전까지 바꿀 수 있어요.</p>}
    {role === "host" && <div className="poll-actions">
      {poll.status === "open" && <><button type="button" className="secondary-action" onClick={onShare} disabled={busy}>카카오톡으로 투표 공유</button><button type="button" className="primary-action" onClick={onClose} disabled={busy || poll.votedCount === 0}>투표 마감</button></>}
      {poll.status === "tied" && <><button type="button" className="secondary-action" onClick={onRestart} disabled={busy}>동률 후보 재투표</button><button type="button" className="primary-action" onClick={onRandom} disabled={busy}>랜덤으로 정하기</button></>}
      {poll.status === "completed" && winner && <button type="button" className="primary-action" onClick={() => onConfirmWinner?.(winner.parkId)} disabled={busy || confirmedParkId === winner.parkId}>{confirmedParkId === winner.parkId ? "투표 결과로 확정됨" : `${winner.parkName}으로 확정`}</button>}
    </div>}
  </section>;
}
