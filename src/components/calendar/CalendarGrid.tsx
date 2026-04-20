"use client";

import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/types/calendar";
import { CalendarEventPill } from "./CalendarEventPill";
import { eventOverlapsLocalDay, getMonthGridDays, isToday } from "./calendar-utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE = 3;

export function CalendarGrid({
  anchorDate,
  events,
  loading,
  onDayClick,
  onEventClick,
}: {
  anchorDate: Date;
  events: CalendarEvent[];
  loading: boolean;
  onDayClick: (day: Date) => void;
  onEventClick: (event: CalendarEvent, e: React.MouseEvent) => void;
}) {
  const days = getMonthGridDays(anchorDate);

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[#0a0a0a]">
        <div className="grid grid-cols-7 border-b border-[var(--border)]">
          {WEEKDAYS.map((d) => (
            <div key={d} className="border-r border-[var(--border)] px-2 py-2 text-center text-[0.65rem] font-medium uppercase tracking-wider text-[var(--muted)] last:border-r-0">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 42 }).map((_, i) => (
            <div
              key={i}
              className="min-h-[88px] animate-pulse border-b border-r border-[var(--border)] bg-[var(--surface-elevated)]/30 last:border-r-0"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[#0a0a0a] transition-opacity duration-200">
      <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface)]">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="border-r border-[var(--border)] px-2 py-2 text-center text-[0.65rem] font-medium uppercase tracking-wider text-[var(--muted)] last:border-r-0"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = day.getMonth() === anchorDate.getMonth();
          const dayEvents = events
            .filter((e) => eventOverlapsLocalDay(e, day))
            .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
          const visible = dayEvents.slice(0, MAX_VISIBLE);
          const more = dayEvents.length - visible.length;

          return (
            <div
              key={day.toISOString()}
              role="button"
              tabIndex={0}
              onClick={() => onDayClick(day)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onDayClick(day);
                }
              }}
              className={cn(
                "group min-h-[100px] cursor-pointer border-b border-r border-[var(--border)] p-1.5 transition-colors duration-150 last:border-r-0 md:min-h-[120px]",
                "hover:bg-[rgba(255,255,255,0.03)]",
                !inMonth && "bg-[rgba(0,0,0,0.35)] text-[var(--muted)]",
                isToday(day) &&
                  "shadow-[inset_0_0_0_1px_rgba(255,69,0,0.5)] ring-1 ring-[rgba(255,69,0,0.25)]",
              )}
            >
              <div className="flex justify-end">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium tabular-nums",
                    isToday(day)
                      ? "bg-[var(--primary)] text-white"
                      : inMonth
                        ? "text-white"
                        : "text-[var(--muted)]",
                  )}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="mt-1 space-y-1">
                {visible.map((ev) => (
                  <CalendarEventPill key={ev.id} event={ev} onClick={(e) => onEventClick(ev, e)} />
                ))}
                {more > 0 ? (
                  <span className="block truncate rounded-full bg-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[0.65rem] font-medium text-[var(--muted)]">
                    +{more} more
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarEmptyState({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="mt-4 text-center text-sm font-light text-[var(--muted)]">
      No events yet — create one with <span className="text-white/80">New Event</span> or click a day.
    </p>
  );
}
