import type { TravelMode } from "../../shared/api/contracts";

export function TravelModeSelector({ value, onChange }: { value: TravelMode; onChange: (mode: TravelMode) => void }) {
  return <fieldset className="travel-mode-selector">
    <legend>어떻게 이동하나요?</legend>
    <div>
      <button type="button" className={value === "public_transit" ? "selected" : ""} aria-pressed={value === "public_transit"} onClick={() => onChange("public_transit")}>
        <strong>대중교통</strong><small>버스·지하철 경로</small>
      </button>
      <button type="button" className={value === "car" ? "selected" : ""} aria-pressed={value === "car"} onClick={() => onChange("car")}>
        <strong>자가용</strong><small>주차 후 도보 포함</small>
      </button>
    </div>
    {value === "car" && <p>공원 주차장까지 운전한 뒤, 모두가 만나는 지점까지 걷는 시간도 계산해요. 주차 대기시간은 포함하지 않아요.</p>}
  </fieldset>;
}
