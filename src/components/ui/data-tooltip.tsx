"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type DataTooltipReliability = "high" | "medium" | "low";

export type DataTooltipProps = {
  source: string;
  reliability: DataTooltipReliability;
  note?: string;
  /** Formatted “last fetched” time; if omitted, shows an em dash */
  lastUpdated?: string | null;
  className?: string;
};

const RELIABILITY_DOT: Record<DataTooltipReliability, string> = {
  high: "#22c55e",
  medium: "#eab308",
  low: "#ef4444",
};

const RELIABILITY_WORD: Record<DataTooltipReliability, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const TOOLTIP_MAX_W = 260;
const TOOLTIP_EST_H = 200;
const VIEW_MARGIN = 8;

export function DataTooltip({ source, reliability, note, lastUpdated, className }: DataTooltipProps) {
  const uid = useId();
  const panelId = `${uid}-panel`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; placement: "top" | "bottom" }>({
    left: 0,
    top: 0,
    placement: "top",
  });
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => {
      setFadeIn(false);
      setOpen(false);
    }, 180);
  };

  const handleOpen = () => {
    clearCloseTimer();
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const preferBelow = spaceAbove < TOOLTIP_EST_H + VIEW_MARGIN && spaceBelow > spaceAbove;
    const placement = preferBelow ? "bottom" : "top";
    const centerX = rect.left + rect.width / 2;
    let left = centerX - TOOLTIP_MAX_W / 2;
    left = Math.max(VIEW_MARGIN, Math.min(left, window.innerWidth - TOOLTIP_MAX_W - VIEW_MARGIN));
    const top = placement === "top" ? rect.top - VIEW_MARGIN : rect.bottom + VIEW_MARGIN;
    setPos({ left, top, placement });
  }, [open]);

  useEffect(() => {
    if (!open) {
      setFadeIn(false);
      return;
    }
    const idRaf = requestAnimationFrame(() => setFadeIn(true));
    return () => cancelAnimationFrame(idRaf);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const spaceAbove = rect.top;
      const spaceBelow = window.innerHeight - rect.bottom;
      const preferBelow = spaceAbove < TOOLTIP_EST_H + VIEW_MARGIN && spaceBelow > spaceAbove;
      const placement = preferBelow ? "bottom" : "top";
      const centerX = rect.left + rect.width / 2;
      let left = centerX - TOOLTIP_MAX_W / 2;
      left = Math.max(VIEW_MARGIN, Math.min(left, window.innerWidth - TOOLTIP_MAX_W - VIEW_MARGIN));
      const top = placement === "top" ? rect.top - VIEW_MARGIN : rect.bottom + VIEW_MARGIN;
      setPos({ left, top, placement });
    };
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open]);

  const panel =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="tooltip"
            className="fixed z-[9999] box-border max-w-[260px] rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#1a1a1a] p-3 text-[0.75rem] leading-snug text-[rgba(255,255,255,0.7)]"
            style={{
              left: pos.left,
              top: pos.top,
              transform: pos.placement === "top" ? "translateY(-100%)" : "none",
              opacity: fadeIn ? 1 : 0,
              transition: "opacity 150ms ease-out",
              pointerEvents: fadeIn ? "auto" : "none",
            }}
            onMouseEnter={clearCloseTimer}
            onMouseLeave={scheduleClose}
          >
            <div className="text-[0.65rem] font-normal uppercase tracking-[0.06em] text-[rgba(255,255,255,0.4)]">Source</div>
            <p className="mt-0.5 font-normal text-white">{source}</p>
            <div className="mt-2 text-[0.65rem] font-normal uppercase tracking-[0.06em] text-[rgba(255,255,255,0.4)]">Reliability</div>
            <div className="mt-0.5 flex items-center gap-2 font-normal text-white">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: RELIABILITY_DOT[reliability] }}
                aria-hidden
              />
              {RELIABILITY_WORD[reliability]}
            </div>
            <div className="mt-2 text-[0.65rem] font-normal uppercase tracking-[0.06em] text-[rgba(255,255,255,0.4)]">Last updated</div>
            <p className="mt-0.5 font-normal text-white">{lastUpdated != null && String(lastUpdated).trim() ? lastUpdated : "—"}</p>
            {note ? (
              <p className="mt-2 border-t border-[rgba(255,255,255,0.08)] pt-2 font-normal text-[rgba(255,255,255,0.65)]">{note}</p>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded border-0 bg-transparent p-0 align-middle text-[rgba(255,255,255,0.3)] outline-none hover:text-[rgba(255,255,255,0.45)] focus-visible:ring-1 focus-visible:ring-white/30",
          className,
        )}
        aria-label="Data source and reliability"
        aria-describedby={open ? panelId : undefined}
        onMouseEnter={handleOpen}
        onMouseLeave={scheduleClose}
        onFocus={handleOpen}
        onBlur={scheduleClose}
      >
        <Info className="h-3 w-3" strokeWidth={2} aria-hidden />
      </button>
      {panel}
    </>
  );
}
