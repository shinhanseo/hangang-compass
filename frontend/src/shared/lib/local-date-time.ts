export type LocalDateTimeParts = {
  date: string;
  hour: number;
  minute: number;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toLocalDateTimeValue(date: Date): string {
  return `${toLocalDateString(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function parseLocalDateTime(value: string): LocalDateTimeParts {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/u.exec(value);
  if (!match) throw new Error("Invalid local date time");
  return { date: match[1]!, hour: Number(match[2]), minute: Number(match[3]) };
}

export function combineLocalDateTime(parts: LocalDateTimeParts): string {
  return `${parts.date}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function roundUpToTenMinutes(date: Date): Date {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  const remainder = rounded.getMinutes() % 10;
  if (remainder > 0) rounded.setMinutes(rounded.getMinutes() + 10 - remainder);
  return rounded;
}

export function formatLocalDateTime(value: string): string {
  const { date, hour, minute } = parseLocalDateTime(value);
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(year!, month! - 1, day!, hour, minute));
}

