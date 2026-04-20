import type { CalendarEvent, CalendarEventType } from "@/types/calendar";

export function defaultColorForType(type: CalendarEventType): string {
  switch (type) {
    case "event":
      return "#ef4444";
    case "meeting":
      return "#3b82f6";
    case "deadline":
      return "#f97316";
    case "other":
      return "#6b7280";
    default:
      return "#ef4444";
  }
}

export function eventDisplayColor(event: CalendarEvent): string {
  if (event.color?.trim()) return event.color;
  return defaultColorForType(event.type);
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Week starts Sunday (Apple Calendar default). */
export function startOfWeekSunday(d: Date): Date {
  const x = startOfDay(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

/** 42-day grid (6 rows) covering the month containing `anchor`. */
export function getMonthGridDays(anchor: Date): Date[] {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const firstOfMonth = new Date(y, m, 1);
  const start = startOfWeekSunday(firstOfMonth);
  const days: Date[] = [];
  for (let i = 0; i < 42; i += 1) {
    days.push(addDays(start, i));
  }
  return days;
}

export function getMonthGridRange(anchor: Date): { rangeStart: Date; rangeEnd: Date } {
  const days = getMonthGridDays(anchor);
  return {
    rangeStart: startOfDay(days[0]),
    rangeEnd: endOfDay(days[41]),
  };
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

/** Event overlaps calendar day in local timezone (all-day uses date parts only). */
export function eventOverlapsLocalDay(event: CalendarEvent, day: Date): boolean {
  const start = new Date(event.start_at);
  const end = new Date(event.end_at);
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  return start <= dayEnd && end >= dayStart;
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatMonthYear(d: Date): string {
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatWeekRangeLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  if (weekStart.getMonth() === weekEnd.getMonth()) {
    return `${SHORT_MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} – ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;
  }
  return `${SHORT_MONTHS[weekStart.getMonth()]} ${weekStart.getDate()} – ${SHORT_MONTHS[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
}

export function formatDayTitle(d: Date): string {
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Local datetime string for datetime-local input: YYYY-MM-DDTHH:mm */
export function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(s: string): string {
  const d = new Date(s);
  return d.toISOString();
}

/** For all-day: date only YYYY-MM-DD */
export function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function fromDateInputAtStartOfDay(s: string): string {
  const d = new Date(`${s}T00:00:00`);
  return d.toISOString();
}

export function fromDateInputAtEndOfDay(s: string): string {
  const d = new Date(`${s}T23:59:59`);
  return d.toISOString();
}
