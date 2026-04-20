"use client";

import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/types/calendar";
import {
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

export function CalendarDayView({
  day,
  events,
  onSlotClick,
  onEventClick,
}: {
  day: Date;
  events: CalendarEvent[];
  onSlotClick: (d: Date) => void;
  onEventClick: (event: CalendarEvent, e: React.MouseEvent) => void;
}) {
  const allDay = events.filter((e) => e.all_day && eventOverlapsLocalDay(e, day));

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[#0a0a0a]">
      {allDay.length > 0 ? (
        <div className="border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <p className="mb-1 text-[0.65rem] font-medium uppercase tracking-wider text-[var(--muted)]">All day</p>
          <div className="flex flex-wrap gap-1">
            {allDay.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={(e) => onEventClick(ev, e)}
                className="truncate rounded-md px-2 py-1 text-left text-xs font-medium text-white"
                style={{
                  backgroundColor: `${eventDisplayColor(ev)}44`,
                  border: `1px solid ${eventDisplayColor(ev)}66`,
                }}
              >
                {ev.title}
              </button>
            ))}
          </div>
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
        <div
          className={cn(
            "relative min-w-0 flex-1",
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
                onSlotClick(d);
              }}
              className="w-full border-b border-[var(--border)] transition hover:bg-[rgba(255,255,255,0.02)]"
              style={{ height: PX_PER_HOUR }}
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
                  className="absolute left-1 right-1 z-10 overflow-hidden rounded-md px-2 py-1 text-left text-xs font-medium text-white shadow-sm transition hover:brightness-110"
                  style={{
                    top: pos.top,
                    height: pos.height,
                    backgroundColor: `${eventDisplayColor(ev)}cc`,
                    border: `1px solid ${eventDisplayColor(ev)}`,
                  }}
                >
                  <span className="line-clamp-4">{ev.title}</span>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}
