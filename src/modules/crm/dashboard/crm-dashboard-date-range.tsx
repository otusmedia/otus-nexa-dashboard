"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { CrmChartRange, CrmCustomDateRange } from "@/modules/crm/use-crm-dashboard-data";

function formatCustomRangeButtonLabel(startYmd: string, endYmd: string): string {
  const a = new Date(`${startYmd}T12:00:00`);
  const b = new Date(`${endYmd}T12:00:00`);
  const fmt = (dt: Date) =>
    dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(a)} — ${fmt(b)}`;
}

type Props = {
  range: CrmChartRange;
  customRange: CrmCustomDateRange | null;
  onRangeChange: (range: CrmChartRange) => void;
  onCustomRangeApply: (range: CrmCustomDateRange) => void;
  lt: (key: string) => string;
  className?: string;
};

export function CrmDashboardDateRange({
  range,
  customRange,
  onRangeChange,
  onCustomRangeApply,
  lt,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState(customRange?.startYmd ?? "");
  const [draftEnd, setDraftEnd] = useState(customRange?.endYmd ?? "");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraftStart(customRange?.startYmd ?? "");
    setDraftEnd(customRange?.endYmd ?? "");
  }, [open, customRange]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const applyDisabled =
    !draftStart || !draftEnd || draftEnd < draftStart;

  return (
    <div ref={rootRef} className={cn("relative flex gap-1 rounded-lg border border-white/[0.08] p-0.5", className)}>
      {(["7d", "30d", "90d"] as const).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => {
            setOpen(false);
            onRangeChange(r);
          }}
          className={cn(
            "rounded-md px-2.5 py-1 text-[0.65rem] transition",
            range === r ? "bg-white text-black" : "text-[rgba(255,255,255,0.45)] hover:text-white",
          )}
        >
          {r === "7d" ? lt("Last 7 days") : r === "30d" ? lt("Last 30 days") : lt("Last 90 days")}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "rounded-md px-2.5 py-1 text-[0.65rem] transition",
          range === "custom" ? "bg-white text-black" : "text-[rgba(255,255,255,0.45)] hover:text-white",
        )}
      >
        {range === "custom" && customRange
          ? formatCustomRangeButtonLabel(customRange.startYmd, customRange.endYmd)
          : lt("Custom Range")}
      </button>
      {open ? (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-[60] w-[min(calc(100vw-2rem),300px)] rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1a1a1a] p-4 shadow-none"
          role="dialog"
          aria-label={lt("Custom Range")}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-[0.65rem] font-normal uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
              {lt("Start Date")}
              <input
                type="date"
                value={draftStart}
                onChange={(e) => setDraftStart(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-[rgba(255,255,255,0.12)] bg-[#0d0d0d] px-2.5 py-2 text-xs font-light text-white [color-scheme:dark]"
              />
            </label>
            <label className="block text-[0.65rem] font-normal uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
              {lt("End Date")}
              <input
                type="date"
                value={draftEnd}
                onChange={(e) => setDraftEnd(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-[rgba(255,255,255,0.12)] bg-[#0d0d0d] px-2.5 py-2 text-xs font-light text-white [color-scheme:dark]"
              />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost rounded-md px-3 py-1.5 text-xs">
              {lt("Cancel")}
            </button>
            <button
              type="button"
              disabled={applyDisabled}
              onClick={() => {
                onCustomRangeApply({ startYmd: draftStart, endYmd: draftEnd });
                setOpen(false);
              }}
              className="btn-primary rounded-md px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
            >
              {lt("Apply")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
