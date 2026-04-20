"use client";

import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";
import type { ProjectType } from "../data";

export function ProjectTypeBadge({ type, className }: { type: ProjectType; className?: string }) {
  const { t: lt } = useLanguage();
  return (
    <span
      className={cn(
        "inline-flex rounded-full border border-[var(--border-strong)] px-2 py-0.5 text-[0.68rem] font-normal tracking-[0.02em] text-[rgba(255,255,255,0.4)]",
        className,
      )}
    >
      {lt(type)}
    </span>
  );
}
