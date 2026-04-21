"use client";

import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarView } from "@/types/calendar";
import { formatMonthYear, formatWeekRangeLabel } from "./calendar-utils";

const toggleShellStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.05)",
  backdropFilter: "blur(11px) saturate(110%)",
  WebkitBackdropFilter: "blur(11px) saturate(110%)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: 20,
  padding: 4,
};

export function CalendarHeader({
  view,
  onViewChange,
  currentDate,
  weekStart,
  onPrev,
  onNext,
  onToday,
  titleClassName,
}: {
  view: CalendarView;
  onViewChange: (v: CalendarView) => void;
  currentDate: Date;
  weekStart: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  titleClassName?: string;
}) {
  const title =
    view === "month" ? formatMonthYear(currentDate) : view === "week" ? formatWeekRangeLabel(weekStart) : formatMonthYear(currentDate);

  return (
    <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrev}
            className="rounded-lg border border-[var(--border)] p-2 text-[var(--text)] transition hover:bg-[var(--surface-elevated)]"
            aria-label="Previous"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-lg border border-[var(--border)] p-2 text-[var(--text)] transition hover:bg-[var(--surface-elevated)]"
            aria-label="Next"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
        <h1 className={cn("text-xl font-normal tracking-tight text-white md:text-2xl", titleClassName)}>{title}</h1>
        <button
          type="button"
          onClick={onToday}
          className="rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:border-[var(--primary)] hover:text-white"
        >
          Today
        </button>
      </div>

      <div className="inline-flex" style={toggleShellStyle} role="group" aria-label="Calendar view">
        {(["month", "week"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onViewChange(v)}
            className={cn(
              "rounded-2xl px-3 py-1.5 text-xs font-medium transition-all duration-200",
              view === v
                ? "bg-[rgba(255,69,0,0.2)] text-[#FF4500] shadow-[inset_0_0_0_1px_rgba(255,69,0,0.35)]"
                : "text-[var(--muted)] hover:text-white",
            )}
          >
            {v === "month" ? "Month" : "Week"}
          </button>
        ))}
      </div>
    </div>
  );
}
