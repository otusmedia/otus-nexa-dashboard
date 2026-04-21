"use client";

import { Plus } from "lucide-react";
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
  onAddOnDay,
}: {
  anchorDate: Date;
  events: CalendarEvent[];
  loading: boolean;
  onDayClick: (day: Date) => void;
  onEventClick: (event: CalendarEvent, e: React.MouseEvent) => void;
  onAddOnDay: (day: Date) => void;
}) {
  const days = getMonthGridDays(anchorDate);

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#161616]">
        <div className="grid grid-cols-7 border-b border-[rgba(255,255,255,0.06)]">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="border-r border-[rgba(255,255,255,0.06)] px-2 py-2 text-center text-[0.65rem] font-medium uppercase tracking-wider text-[var(--muted)] last:border-r-0"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: 42 }).map((_, i) => (
            <div
              key={i}
              className="min-h-[88px] animate-pulse border-b border-r border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] last:border-r-0 md:min-h-[120px]"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#161616] transition-opacity duration-200">
      <div className="grid grid-cols-7 border-b border-[rgba(255,255,255,0.06)] bg-[#161616]">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="border-r border-[rgba(255,255,255,0.06)] px-2 py-2 text-center text-[0.65rem] font-medium uppercase tracking-wider text-[var(--muted)] last:border-r-0"
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
          const today = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "group relative min-h-[100px] border-b border-r border-[rgba(255,255,255,0.06)] p-1.5 transition-colors duration-150 last:border-r-0 md:min-h-[120px]",
                "bg-[#161616]",
                !inMonth && "opacity-45",
                today && "ring-1 ring-inset ring-[rgba(255,69,0,0.45)]",
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <button
                  type="button"
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums",
                    today ? "bg-[var(--primary)] text-white" : inMonth ? "text-white" : "text-[var(--muted)]",
                  )}
                  onClick={() => onDayClick(day)}
                >
                  {day.getDate()}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddOnDay(day);
                  }}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[rgba(255,255,255,0.1)] text-[rgba(255,255,255,0.5)] opacity-0 transition hover:border-[rgba(255,69,0,0.4)] hover:text-[#ff4500] group-hover:opacity-100",
                  )}
                  aria-label="Add event"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
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
      No calendar events in this range — use the <span className="text-white/80">+</span> on a day to add one.
    </p>
  );
}
