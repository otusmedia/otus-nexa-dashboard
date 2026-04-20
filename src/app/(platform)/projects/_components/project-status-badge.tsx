"use client";

import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "../data";

const styles: Record<ProjectStatus, string> = {
  Planning: "border-[#3b82f6]/40 bg-[#3b82f6]/15 text-[#93c5fd]",
  "In Progress": "border-[#ff4500]/40 bg-[#ff4500]/15 text-[#ffb79e]",
  Paused: "border-[#a855f7]/40 bg-[#a855f7]/15 text-[#d8b4fe]",
  Done: "border-[#22c55e]/40 bg-[#22c55e]/15 text-[#86efac]",
  Cancelled: "border-[#ef4444]/40 bg-[#ef4444]/15 text-[#fca5a5]",
};

export function ProjectStatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  const { t: lt } = useLanguage();
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2 py-0.5 text-[0.68rem] font-normal tracking-[0.02em]",
        styles[status],
        className,
      )}
    >
      {lt(status)}
    </span>
  );
}
