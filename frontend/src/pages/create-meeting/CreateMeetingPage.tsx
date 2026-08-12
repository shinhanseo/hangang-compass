import { useCallback, useEffect, useState, type FormEvent } from "react";

import { api } from "../../shared/api/http";
import type { HostMeeting } from "../../shared/api/contracts";
import { navigate } from "../../shared/lib/navigation";
import { formatLocalDateTime, roundUpToTenMinutes, toLocalDateTimeValue } from "../../shared/lib/local-date-time";
import { isOutsideArrivalForecastWindow } from "../../shared/lib/recommendation-refresh";
import { loadRecentMeetings, rememberRecentMeeting, replaceRecentMeetings } from "../../shared/lib/recent-meetings";
import { formatMeetingAt } from "../../shared/lib/format-meeting-at";
import { AppIcon } from "../../shared/ui/AppIcon";
import { DateTimeSheet } from "../../shared/ui/DateTimeSheet";
import { MobileAppBar } from "../../shared/ui/MobileAppBar";

function defaultMeetingTime(): string {
  return toLocalDateTimeValue(roundUpToTenMinutes(new Date(Date.now() + 24 * 60 * 60 * 1_000)));
}

export function CreateMeetingPage() {
  const [recentMeetings, setRecentMeetings] = useState(loadRecentMeetings);
  const [meetingAt, setMeetingAt] = useState(defaultMeetingTime);
  const [travelPattern, setTravelPattern] = useState<"shared_origin" | "individual_round_trip">("shared_origin");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [patternSheetOpen, setPatternSheetOpen] = useState(false);
  const [dateTimeSheetOpen, setDateTimeSheetOpen] = useState(false);
  const closeDateTimeSheet = useCallback(() => setDateTimeSheetOpen(false), []);

  useEffect(() => {
    if (!recentMeetings.length) return;
    let cancelled = false;
    Promise.all(recentMeetings.map(async (meeting) => {
      try {
        await api(`/api/meetings/${meeting.id}/host-access`);
        return meeting;
      } catch {
        return null;
      }
    })).then((items) => {
      if (cancelled) return;
      const available = items.filter((item): item is typeof recentMeetings[number] => item !== null);
      replaceRecentMeetings(available);
      setRecentMeetings(available);
    });
    return () => { cancelled = true; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = await api<{ meeting: HostMeeting }>("/api/meetings", {
        method: "POST",
        body: JSON.stringify({ meetingAt: new Date(meetingAt).toISOString(), travelPattern }),
      });
      if (isOutsideArrivalForecastWindow(body.meeting.meetingAt)) {
        sessionStorage.setItem(`hc_provisional_notice_${body.meeting.id}`, "1");
      }
      rememberRecentMeeting({ id: body.meeting.id, meetingAt: body.meeting.meetingAt });
      navigate(`/host/${body.meeting.id}`);
    } catch {
      setError("미래 날짜와 시간을 다시 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell app-screen create-screen">
      <MobileAppBar />
      <section className="create-hero">
        <p className="create-eyebrow">한강 약속 장소 추천</p>
        <h1>모두에게 좋은<br /><em>한강을 찾아봐요.</em></h1>
        <p className="create-description">출발하는 곳이 달라도 괜찮아요.<br />이동 시간과 혼잡도를 함께 비교해 드려요.</p>
        <p className="park-count"><strong>11개</strong> 한강공원을 한 번에 비교해요</p>
        <div className="hero-river-lines" aria-hidden="true"><i /><i /><i /></div>
      </section>
      {recentMeetings.length > 0 && <section className="recent-meetings" aria-labelledby="recent-meetings-title">
        <div><p>이 기기에서 만든 약속</p><h2 id="recent-meetings-title">진행 중인 약속 이어보기</h2></div>
        {recentMeetings.map((meeting) => <button key={meeting.id} type="button" onClick={() => navigate(`/host/${meeting.id}`)}>
          <span><AppIcon name="calendar" /></span><span><strong>한강 피크닉</strong><small>{formatMeetingAt(meeting.meetingAt)}</small></span><AppIcon name="chevron" />
        </button>)}
      </section>}
      <form className="app-form create-form" onSubmit={submit}>
        <section className="form-section">
          <div className="section-title"><span>1</span><div><h2>약속의 기준</h2><p>친구들이 도착할 시간을 알려주세요.</p></div></div>
          <span className="field-label">도착 날짜와 시간</span>
          <button className="setting-row date-time-trigger" type="button" onClick={() => setDateTimeSheetOpen(true)} aria-haspopup="dialog">
            <span className="setting-icon"><AppIcon name="calendar" /></span>
            <span className="setting-copy"><small>선택한 시간</small><strong>{formatLocalDateTime(meetingAt)}</strong></span>
            <AppIcon name="chevron" />
          </button>
        </section>
        <section className="form-section">
          <div className="section-title"><span>2</span><div><h2>이동 방식</h2><p>한 번 선택하면 친구들의 입력이 간단해져요.</p></div></div>
          <button className="setting-row" type="button" onClick={() => setPatternSheetOpen(true)} aria-haspopup="dialog">
            <span className="setting-icon"><AppIcon name="people" /></span>
            <span className="setting-copy"><small>선택한 방식</small><strong>{travelPattern === "shared_origin" ? "함께 출발 · 각자 귀가" : "각자 출발 · 각자 귀가"}</strong></span>
            <AppIcon name="chevron" />
          </button>
        </section>
        {error && <p className="error">{error}</p>}
        <p className="privacy-line"><AppIcon name="lock" size={16} />회원가입과 정확한 집 주소 없이 만들 수 있어요.</p>
        <div className="bottom-action"><button className="primary-action create-submit" disabled={busy}>{busy ? "약속을 만드는 중…" : "한강 약속 만들기"}<AppIcon name="chevron" /></button></div>
      </form>
      {dateTimeSheetOpen && <DateTimeSheet value={meetingAt} onClose={closeDateTimeSheet} onConfirm={setMeetingAt} />}
      {patternSheetOpen && <div className="sheet-layer">
        <button className="sheet-scrim" type="button" aria-label="이동 방식 선택 닫기" onClick={() => setPatternSheetOpen(false)} />
        <section className="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="travel-pattern-title">
          <div className="sheet-handle" />
          <div className="sheet-header"><div><p>이동 방식</p><h2 id="travel-pattern-title">어디에서 출발하나요?</h2></div><button className="icon-button" type="button" aria-label="닫기" onClick={() => setPatternSheetOpen(false)}><AppIcon name="close" /></button></div>
          <fieldset className="choice-list">
            <legend className="sr-only">친구들의 이동 방식</legend>
            <label className={travelPattern === "shared_origin" ? "choice-card selected" : "choice-card"}>
              <input type="radio" name="travel-pattern" value="shared_origin" checked={travelPattern === "shared_origin"} onChange={() => setTravelPattern("shared_origin")} />
              <span className="choice-symbol">함께</span><span><strong>같은 곳에서 출발해요</strong><small>학교에서 함께 출발하고 약속 후에는 각자 이동해요.</small></span><i />
            </label>
            <label className={travelPattern === "individual_round_trip" ? "choice-card selected" : "choice-card"}>
              <input type="radio" name="travel-pattern" value="individual_round_trip" checked={travelPattern === "individual_round_trip"} onChange={() => setTravelPattern("individual_round_trip")} />
              <span className="choice-symbol">각자</span><span><strong>각자 출발해 돌아가요</strong><small>각자의 출발지에서 만나고 같은 곳으로 다시 돌아가요.</small></span><i />
            </label>
          </fieldset>
          <button className="primary-action sheet-confirm" type="button" onClick={() => setPatternSheetOpen(false)}>이 방식으로 할게요</button>
        </section>
      </div>}
    </main>
  );
}
