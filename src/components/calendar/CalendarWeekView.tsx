"use client";

import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/types/calendar";
import {
  addDays,
  endOfDay,
  eventDisplayColor,
  eventOverlapsLocalDay,
  isToday,
  startOfDay,
} from "./calendar-utils";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const PX_PER_HOUR = 44;
const TOTAL_PX = 24 * PX_PER_HOUR;

function minutesFromDayStart(d: Date, day: Date): number {
  const sod = startOfDay(day);
  return Math.max(0, (d.getTime() - sod.getTime()) / 60000);
}

function clampEventToDay(ev: CalendarEvent, day: Date): { top: number; height: number } | null {
  if (!eventOverlapsLocalDay(ev, day)) return null;
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const start = new Date(ev.start_at);
  const end = new Date(ev.end_at);
  const clipStart = start < dayStart ? dayStart : start;
  const clipEnd = end > dayEnd ? dayEnd : end;
  const startM = minutesFromDayStart(clipStart, day);
  const endM = minutesFromDayStart(clipEnd, day);
  const dur = Math.max(endM - startM, 15);
  const top = (startM / (24 * 60)) * TOTAL_PX;
  const height = (dur / (24 * 60)) * TOTAL_PX;
  return { top, height: Math.max(height, 18) };
}

const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarWeekView({
  weekStart,
  events,
  onDayClick,
  onEventClick,
}: {
  weekStart: Date;
  events: CalendarEvent[];
  onDayClick: (day: Date) => void;
  onEventClick: (event: CalendarEvent, e: React.MouseEvent) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const allDayByDay = days.map((day) =>
    events.filter((e) => e.all_day && eventOverlapsLocalDay(e, day)),
  );

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[#0a0a0a]">
      <div className="grid border-b border-[var(--border)]" style={{ gridTemplateColumns: `56px repeat(7, minmax(0,1fr))` }}>
        <div className="border-r border-[var(--border)]" />
        {days.map((day) => (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onDayClick(day)}
            className={cn(
              "border-r border-[var(--border)] px-1 py-2 text-center last:border-r-0 transition hover:bg-[rgba(255,255,255,0.03)]",
              isToday(day) && "bg-[rgba(255,69,0,0.08)]",
            )}
          >
            <div className="text-[0.65rem] font-medium uppercase tracking-wider text-[var(--muted)]">{SHORT[day.getDay()]}</div>
            <div
              className={cn(
                "mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium tabular-nums",
                isToday(day) ? "bg-[var(--primary)] text-white" : "text-white",
              )}
            >
              {day.getDate()}
            </div>
          </button>
        ))}
      </div>

      {allDayByDay.some((a) => a.length > 0) ? (
        <div className="grid border-b border-[var(--border)] bg-[var(--surface)]" style={{ gridTemplateColumns: `56px repeat(7, minmax(0,1fr))` }}>
          <div className="flex items-center justify-end border-r border-[var(--border)] px-1 py-1 text-[0.6rem] text-[var(--muted)]">
            all-day
          </div>
          {days.map((day, col) => (
            <div key={`allday-${day.toISOString()}`} className="space-y-0.5 border-r border-[var(--border)] p-1 last:border-r-0">
              {allDayByDay[col].map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(ev, e);
                  }}
                  title={ev.title}
                  className="w-full truncate rounded-md px-1.5 py-0.5 text-left text-[0.65rem] font-medium text-white"
                  style={{
                    backgroundColor: `${eventDisplayColor(ev)}44`,
                    border: `1px solid ${eventDisplayColor(ev)}66`,
                  }}
                >
                  {ev.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex max-h-[min(640px,70vh)] overflow-y-auto">
        <div className="shrink-0 border-r border-[var(--border)] bg-[var(--surface)]" style={{ width: 56 }}>
          {HOURS.map((h) => (
            <div
              key={h}
              className="border-b border-[var(--border)] pr-1 text-right text-[0.65rem] tabular-nums text-[var(--muted)]"
              style={{ height: PX_PER_HOUR, paddingTop: 2 }}
            >
              {h === 0 ? "" : `${h}:00`}
            </div>
          ))}
        </div>
        <div className="grid min-w-0 flex-1" style={{ gridTemplateColumns: `repeat(7, minmax(0,1fr))` }}>
          {days.map((day) => (
            <div
              key={`col-${day.toISOString()}`}
              className={cn(
                "relative border-r border-[var(--border)] last:border-r-0",
                isToday(day) && "bg-[rgba(255,69,0,0.04)]",
              )}
              style={{ minHeight: TOTAL_PX }}
            >
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    const d = new Date(day);
                    d.setHours(h, 0, 0, 0);
                    onDayClick(d);
                  }}
                  className="w-full border-b border-[var(--border)] transition hover:bg-[rgba(255,255,255,0.02)]"
                  style={{ height: PX_PER_HOUR }}
                  aria-label={`${day.toDateString()} ${h}:00`}
                />
              ))}
              {events
                .filter((e) => !e.all_day && eventOverlapsLocalDay(e, day))
                .map((ev) => {
                  const pos = clampEventToDay(ev, day);
                  if (!pos) return null;
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      title={ev.title}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(ev, e);
                      }}
                      className="absolute left-0.5 right-0.5 z-10 overflow-hidden rounded-md px-1 py-0.5 text-left text-[0.65rem] font-medium leading-tight text-white shadow-sm transition hover:brightness-110"
                      style={{
                        top: pos.top,
                        height: pos.height,
                        backgroundColor: `${eventDisplayColor(ev)}cc`,
                        border: `1px solid ${eventDisplayColor(ev)}`,
                      }}
                    >
                      <span className="line-clamp-3">{ev.title}</span>
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
