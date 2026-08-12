import { useEffect } from "react";

import { AppIcon } from "./AppIcon";

export function ProvisionalRecommendationSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return <div className="sheet-layer forecast-notice-layer">
    <button className="sheet-scrim" type="button" aria-label="1차 추천 안내 닫기" onClick={onClose} />
    <section className="bottom-sheet forecast-notice-sheet" role="dialog" aria-modal="true" aria-labelledby="forecast-notice-title">
      <div className="sheet-handle" />
      <p className="forecast-notice-kicker">약속 생성 완료</p>
      <div className="forecast-notice-symbols" aria-hidden="true">
        <span><AppIcon name="calendar" /></span><i /><span><AppIcon name="spark" /></span>
      </div>
      <h2 id="forecast-notice-title">아직 도착 혼잡<br />예측 전이에요</h2>
      <p className="forecast-notice-copy">약속까지 12시간보다 많이 남아<br />지금은 이동시간으로 1차 추천해요.</p>
      <div className="forecast-notice-next">
        <span><AppIcon name="refresh" size={18} /></span>
        <p><strong>약속 12시간 전 다시 계산</strong><small>이 방장 페이지를 다시 열면 서울시 도착 혼잡 예측까지 반영해 알려드릴게요.</small></p>
      </div>
      <button className="primary-action forecast-notice-confirm" type="button" autoFocus onClick={onClose}>확인했어요</button>
    </section>
  </div>;
}
