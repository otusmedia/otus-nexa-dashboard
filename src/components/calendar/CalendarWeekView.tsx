"use client";

import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/types/calendar";
import {
  WEEK_VIEW_END_HOUR,
  WEEK_VIEW_HOUR_COUNT,
  WEEK_VIEW_START_HOUR,
  addDays,
  eventDisplayColor,
  eventOverlapsLocalDay,
  isToday,
  startOfDay,
} from "./calendar-utils";

const PX_PER_HOUR = 44;
const TOTAL_PX = WEEK_VIEW_HOUR_COUNT * PX_PER_HOUR;
const HOURS = Array.from({ length: WEEK_VIEW_HOUR_COUNT }, (_, i) => WEEK_VIEW_START_HOUR + i);

function clampEventToWeekView(ev: CalendarEvent, day: Date): { top: number; height: number } | null {
  if (!eventOverlapsLocalDay(ev, day)) return null;
  const dayStart = startOfDay(day);
  const start = new Date(ev.start_at);
  const end = new Date(ev.end_at);
  const viewStart = new Date(dayStart);
  viewStart.setHours(WEEK_VIEW_START_HOUR, 0, 0, 0);
  const viewEnd = new Date(dayStart);
  viewEnd.setHours(WEEK_VIEW_END_HOUR, 59, 59, 999);

  const clipStart = start < viewStart ? viewStart : start;
  const clipEnd = end > viewEnd ? viewEnd : end;
  if (clipEnd <= viewStart || clipStart > viewEnd) return null;

  const startM = (clipStart.getTime() - dayStart.getTime()) / 60000 - WEEK_VIEW_START_HOUR * 60;
  const endM = (clipEnd.getTime() - dayStart.getTime()) / 60000 - WEEK_VIEW_START_HOUR * 60;
  const dur = Math.max(endM - startM, 15);
  const totalM = WEEK_VIEW_HOUR_COUNT * 60;
  const top = (startM / totalM) * TOTAL_PX;
  const height = (dur / totalM) * TOTAL_PX;
  return { top: Math.max(0, top), height: Math.max(height, 18) };
}

function nowLineOffset(day: Date): number | null {
  if (!isToday(day)) return null;
  const now = new Date();
  const dayStart = startOfDay(day);
  const viewStart = new Date(dayStart);
  viewStart.setHours(WEEK_VIEW_START_HOUR, 0, 0, 0);
  const viewEnd = new Date(dayStart);
  viewEnd.setHours(WEEK_VIEW_END_HOUR, 59, 59, 999);
  if (now < viewStart || now > viewEnd) return null;
  const startM = (now.getTime() - dayStart.getTime()) / 60000 - WEEK_VIEW_START_HOUR * 60;
  const totalM = WEEK_VIEW_HOUR_COUNT * 60;
  return (startM / totalM) * TOTAL_PX;
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
    <div
      className="overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0a0a0a]"
      style={{ borderColor: "rgba(255,255,255,0.06)" }}
    >
      <div className="grid border-b border-[rgba(255,255,255,0.06)]" style={{ gridTemplateColumns: `56px repeat(7, minmax(0,1fr))` }}>
        <div className="border-r border-[rgba(255,255,255,0.06)]" />
        {days.map((day) => (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onDayClick(startOfDay(day))}
            className={cn(
              "border-r border-[rgba(255,255,255,0.06)] px-1 py-2 text-center last:border-r-0 hover:bg-[rgba(255,255,255,0.03)]",
              isToday(day) && "ring-1 ring-[rgba(255,69,0,0.35)] ring-inset",
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
        <div className="grid border-b border-[rgba(255,255,255,0.06)] bg-[#161616]" style={{ gridTemplateColumns: `56px repeat(7, minmax(0,1fr))` }}>
          <div className="flex items-center justify-end border-r border-[rgba(255,255,255,0.06)] px-1 py-1 text-[0.6rem] text-[var(--muted)]">
            all-day
          </div>
          {days.map((day, col) => (
            <div key={`allday-${day.toISOString()}`} className="space-y-0.5 border-r border-[rgba(255,255,255,0.06)] p-1 last:border-r-0">
              {allDayByDay[col].map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(ev, e);
                  }}
                  title={ev.title}
                  className="w-full truncate rounded-md px-1.5 py-0.5 text-left text-[0.65rem] font-medium"
                  style={{
                    backgroundColor: "rgba(24, 119, 242, 0.15)",
                    borderLeft: `3px solid ${eventDisplayColor(ev)}`,
                    color: eventDisplayColor(ev),
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
        <div className="shrink-0 border-r border-[rgba(255,255,255,0.06)] bg-[#161616]" style={{ width: 56 }}>
          {HOURS.map((h) => (
            <div
              key={h}
              className="border-b border-[rgba(255,255,255,0.04)] pr-1 text-right text-[0.65rem] tabular-nums text-[var(--muted)]"
              style={{ height: PX_PER_HOUR, paddingTop: 2 }}
            >
              {`${h}:00`}
            </div>
          ))}
        </div>
        <div className="grid min-w-0 flex-1" style={{ gridTemplateColumns: `repeat(7, minmax(0,1fr))` }}>
          {days.map((day) => {
            const lineY = nowLineOffset(day);
            return (
              <div
                key={`col-${day.toISOString()}`}
                className={cn(
                  "relative border-r border-[rgba(255,255,255,0.06)] bg-[#161616] last:border-r-0",
                  isToday(day) && "ring-1 ring-inset ring-[rgba(255,69,0,0.2)]",
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
                    className="w-full border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]"
                    style={{ height: PX_PER_HOUR }}
                    aria-label={`${day.toDateString()} ${h}:00`}
                  />
                ))}
                {lineY != null ? (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-20 border-t-2 border-[#ff4500]"
                    style={{ top: lineY }}
                    aria-hidden
                  />
                ) : null}
                {events
                  .filter((e) => !e.all_day && eventOverlapsLocalDay(e, day))
                  .map((ev) => {
                    const pos = clampEventToWeekView(ev, day);
                    if (!pos) return null;
                    const col = eventDisplayColor(ev);
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        title={ev.title}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(ev, e);
                        }}
                        className="absolute left-0.5 right-0.5 z-10 overflow-hidden rounded-md px-1 py-0.5 text-left text-[0.65rem] font-medium leading-tight shadow-sm"
                        style={{
                          top: pos.top,
                          height: pos.height,
                          backgroundColor: `${col}26`,
                          borderLeft: `3px solid ${col}`,
                          color: "#fff",
                        }}
                      >
                        <span className="line-clamp-3">{ev.title}</span>
                      </button>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
