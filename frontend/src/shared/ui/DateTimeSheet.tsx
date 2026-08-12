import { useEffect, useMemo, useRef, useState } from "react";

import {
  combineLocalDateTime,
  formatLocalDateTime,
  parseLocalDateTime,
  toLocalDateString,
  type LocalDateTimeParts,
} from "../lib/local-date-time";
import { AppIcon } from "./AppIcon";

type CalendarDay = {
  date: string;
  day: number;
  inMonth: boolean;
};

function calendarDays(year: number, month: number): CalendarDay[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return {
      date: toLocalDateString(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month,
    };
  });
}

function monthLabel(year: number, month: number): string {
  return `${year}년 ${month + 1}월`;
}

export function DateTimeSheet({
  value,
  onClose,
  onConfirm,
}: {
  value: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
}) {
  const initial = parseLocalDateTime(value);
  const [draft, setDraft] = useState<LocalDateTimeParts>(initial);
  const selectedDate = new Date(`${initial.date}T00:00:00`);
  const [visibleMonth, setVisibleMonth] = useState({ year: selectedDate.getFullYear(), month: selectedDate.getMonth() });
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const selectedHourRef = useRef<HTMLButtonElement>(null);
  const today = toLocalDateString(new Date());
  const days = useMemo(() => calendarDays(visibleMonth.year, visibleMonth.month), [visibleMonth]);
  const combinedValue = combineLocalDateTime(draft);
  const isFuture = new Date(combinedValue).getTime() > Date.now();
  const isCurrentMonth = visibleMonth.year === new Date().getFullYear() && visibleMonth.month === new Date().getMonth();

  useEffect(() => {
    closeButtonRef.current?.focus();
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

  useEffect(() => {
    selectedHourRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, []);

  function changeMonth(amount: number) {
    const next = new Date(visibleMonth.year, visibleMonth.month + amount, 1);
    setVisibleMonth({ year: next.getFullYear(), month: next.getMonth() });
  }

  return <div className="sheet-layer date-time-layer">
    <button className="sheet-scrim" type="button" aria-label="날짜와 시간 선택 닫기" onClick={onClose} />
    <section className="bottom-sheet date-time-sheet" role="dialog" aria-modal="true" aria-labelledby="date-time-title">
      <div className="sheet-handle" />
      <div className="sheet-header date-time-header">
        <div><p>약속 시간</p><h2 id="date-time-title">언제 만날까요?</h2></div>
        <button ref={closeButtonRef} className="icon-button" type="button" aria-label="닫기" onClick={onClose}><AppIcon name="close" /></button>
      </div>

      <div className="date-time-summary" aria-live="polite">
        <span><AppIcon name="calendar" size={18} /></span>
        <div><small>선택한 도착 시간</small><strong>{formatLocalDateTime(combinedValue)}</strong></div>
      </div>

      <section className="calendar-picker" aria-label="날짜 선택">
        <div className="calendar-toolbar">
          <strong>{monthLabel(visibleMonth.year, visibleMonth.month)}</strong>
          <div>
            <button type="button" aria-label="이전 달" disabled={isCurrentMonth} onClick={() => changeMonth(-1)}><AppIcon name="chevron" /></button>
            <button type="button" aria-label="다음 달" onClick={() => changeMonth(1)}><AppIcon name="chevron" /></button>
          </div>
        </div>
        <div className="weekday-row" aria-hidden="true">{["일", "월", "화", "수", "목", "금", "토"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {days.map((item) => {
            const disabled = !item.inMonth || item.date < today;
            const selected = item.date === draft.date;
            return <button
              key={item.date}
              type="button"
              className={selected ? "selected" : ""}
              disabled={disabled}
              aria-pressed={selected}
              aria-label={`${item.date}${item.date === today ? ", 오늘" : ""}`}
              onClick={() => setDraft((current) => ({ ...current, date: item.date }))}
            >{item.day}</button>;
          })}
        </div>
      </section>

      <section className="time-picker" aria-label="시간 선택">
        <div className="picker-label"><strong>시간</strong><small>약속 장소에 모두 도착할 시간이에요.</small></div>
        <div className="hour-scroller" role="group" aria-label="시 선택">
          {Array.from({ length: 24 }, (_, hour) => <button
            key={hour}
            ref={draft.hour === hour ? selectedHourRef : undefined}
            type="button"
            className={draft.hour === hour ? "selected" : ""}
            aria-pressed={draft.hour === hour}
            onClick={() => setDraft((current) => ({ ...current, hour }))}
          >{String(hour).padStart(2, "0")}시</button>)}
        </div>
        <div className="minute-picker" role="group" aria-label="분 선택">
          {[0, 10, 20, 30, 40, 50].map((minute) => <button
            key={minute}
            type="button"
            className={draft.minute === minute ? "selected" : ""}
            aria-pressed={draft.minute === minute}
            onClick={() => setDraft((current) => ({ ...current, minute }))}
          >{String(minute).padStart(2, "0")}분</button>)}
        </div>
      </section>

      {!isFuture && <p className="date-time-error">지금보다 뒤의 시간을 선택해 주세요.</p>}
      <button className="primary-action sheet-confirm" type="button" disabled={!isFuture} onClick={() => { onConfirm(combinedValue); onClose(); }}>이 시간으로 정할게요</button>
    </section>
  </div>;
}
