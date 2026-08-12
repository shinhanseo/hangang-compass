import { useState, type FormEvent } from "react";

import { api } from "../../shared/api/http";
import type { HostMeeting } from "../../shared/api/contracts";
import { navigate } from "../../shared/lib/navigation";

function defaultMeetingTime(): string {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1_000);
  return new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60_000)
    .toISOString().slice(0, 16);
}

export function CreateMeetingPage() {
  const [meetingAt, setMeetingAt] = useState(defaultMeetingTime);
  const [travelPattern, setTravelPattern] = useState<"shared_origin" | "individual_round_trip">("shared_origin");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = await api<{ meeting: HostMeeting }>("/api/meetings", {
        method: "POST",
        body: JSON.stringify({ meetingAt: new Date(meetingAt).toISOString(), travelPattern }),
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
        <input id="meeting-at" type="datetime-local" value={meetingAt} onInput={(event) => setMeetingAt(event.currentTarget.value)} required />
        <fieldset className="mode-picker">
          <legend>친구들이 어떻게 이동하나요?</legend>
          <label className={travelPattern === "shared_origin" ? "selected" : ""}>
            <input type="radio" name="travel-pattern" value="shared_origin" checked={travelPattern === "shared_origin"} onChange={() => setTravelPattern("shared_origin")} />
            <span><strong>같은 곳에서 출발해요</strong><small>학교처럼 한곳에서 출발하고, 약속 후에는 각자 다른 곳으로 가요.</small></span>
          </label>
          <label className={travelPattern === "individual_round_trip" ? "selected" : ""}>
            <input type="radio" name="travel-pattern" value="individual_round_trip" checked={travelPattern === "individual_round_trip"} onChange={() => setTravelPattern("individual_round_trip")} />
            <span><strong>각자 출발해 다시 돌아가요</strong><small>각자 가까운 공개 장소에서 출발하고 같은 곳으로 돌아가요.</small></span>
          </label>
        </fieldset>
        {error && <p className="error">{error}</p>}
        <button disabled={busy}>{busy ? "만드는 중…" : "피크닉 약속 만들기"}</button>
        <p className="note">회원가입 없이 만들 수 있어요. 현재 위치와 정확한 주소는 받지 않습니다.</p>
      </form>
    </main>
  );
}
