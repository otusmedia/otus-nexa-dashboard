"use client";

import { publishedPlatformChipClass } from "@/components/ui/published-to-modal";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";
import { TASK_STATUS_OPTIONS, type TaskRowStatus } from "../data";

const statusLookup = Object.fromEntries(TASK_STATUS_OPTIONS.map((option) => [option.value, option])) as Record<
  TaskRowStatus,
  (typeof TASK_STATUS_OPTIONS)[number]
>;

export function TaskRowStatusBadge({
  status,
  publishedTo,
  className,
}: {
  status: TaskRowStatus;
  publishedTo?: string[] | null;
  className?: string;
}) {
  const { t: lt } = useLanguage();
  const option = statusLookup[status];
  const chips = status === "Published" && publishedTo?.length ? publishedTo : [];
  return (
    <span
      className={cn(
        "inline-flex flex-wrap items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-2 py-0.5 text-[0.68rem] font-normal tracking-[0.02em] text-[rgba(255,255,255,0.75)]",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", option.dotClass)} aria-hidden />
      {lt(status)}
      {chips.map((p) => (
        <span
          key={p}
          className={cn(
            "rounded border px-1 py-0 text-[0.58rem] font-medium leading-tight",
            publishedPlatformChipClass(p),
          )}
        >
          {p}
        </span>
      ))}
    </span>
  );
}
