"use client";

import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";
import { DEFAULT_PROJECT_BOARD_STATUSES } from "@/lib/project-board-statuses";
import type { ProjectStatus } from "../data";

const defaultStyles: Record<string, string> = Object.fromEntries(
  DEFAULT_PROJECT_BOARD_STATUSES.map((s) => {
    const color = s.dotClass.replace("bg-", "");
    return [
      s.name,
      `border-[${color}]/40 bg-[${color}]/15 text-white`,
    ];
  }),
);

// Explicit Tailwind-safe classes (dynamic class strings above won't compile)
const styles: Record<string, string> = {
  Planning: "border-[#3b82f6]/40 bg-[#3b82f6]/15 text-[#93c5fd]",
  "In Progress": "border-[#ff4500]/40 bg-[#ff4500]/15 text-[#ffb79e]",
  Scheduled: "border-[#06b6d4]/40 bg-[#06b6d4]/15 text-[#67e8f9]",
  Done: "border-[#22c55e]/40 bg-[#22c55e]/15 text-[#86efac]",
  Cancelled: "border-[#ef4444]/40 bg-[#ef4444]/15 text-[#fca5a5]",
  Paused: "border-[#a855f7]/40 bg-[#a855f7]/15 text-[#d8b4fe]",
};

const FALLBACK = "border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.06)] text-[rgba(255,255,255,0.75)]";

export function ProjectStatusBadge({
  status,
  className,
  dotClass,
}: {
  status: ProjectStatus;
  className?: string;
  /** Optional board status color hint */
  dotClass?: string;
}) {
  const { t: lt } = useLanguage();
  void defaultStyles;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.68rem] font-normal tracking-[0.02em]",
        styles[status] ?? FALLBACK,
        className,
      )}
    >
      {dotClass ? <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden /> : null}
      {lt(status)}
    </span>
  );
}
