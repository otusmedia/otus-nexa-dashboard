"use client";

import { useLanguage } from "@/context/language-context";
import { PublishedPlatformGlyph } from "@/components/ui/published-to-modal";
import { cn } from "@/lib/utils";
import { TASK_STATUS_OPTIONS, type TaskRowStatus } from "../data";

const statusLookup = Object.fromEntries(TASK_STATUS_OPTIONS.map((option) => [option.value, option])) as Record<
  TaskRowStatus,
  (typeof TASK_STATUS_OPTIONS)[number]
>;

/** Decorative platform hints for Published tasks — same glyphs as PublishedTo modal chips. */
export function PublishedPlatformIconRow({ platforms }: { platforms: string[] }) {
  if (!platforms?.length) return null;
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      {platforms.map((p, i) => (
        <PublishedPlatformGlyph key={`${i}-${p}`} platform={p} />
      ))}
    </span>
  );
}

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
  const showIcons = status === "Published" && publishedTo && publishedTo.length > 0;
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-2 py-0.5 text-[0.68rem] font-normal tracking-[0.02em] text-[rgba(255,255,255,0.75)]",
          className,
        )}
      >
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", option.dotClass)} aria-hidden />
        {lt(status)}
      </span>
      {showIcons ? <PublishedPlatformIconRow platforms={publishedTo} /> : null}
    </span>
  );
}
