"use client";

import { Camera, Globe, Linkedin, Tag } from "lucide-react";
import { useLanguage } from "@/context/language-context";
import { cn } from "@/lib/utils";
import { TASK_STATUS_OPTIONS, type TaskRowStatus } from "../data";

const statusLookup = Object.fromEntries(TASK_STATUS_OPTIONS.map((option) => [option.value, option])) as Record<
  TaskRowStatus,
  (typeof TASK_STATUS_OPTIONS)[number]
>;

type PlatformIconKind = "blog" | "instagram" | "x" | "linkedin" | "custom";

function platformIconKind(name: string): PlatformIconKind {
  const t = name.trim();
  const lower = t.toLowerCase();
  if (t === "Blog" || lower === "blog") return "blog";
  if (t === "Instagram" || lower === "instagram") return "instagram";
  if (t === "X" || lower === "twitter" || t === "X / Twitter") return "x";
  if (t === "LinkedIn" || t === "Linkedin" || lower === "linkedin") return "linkedin";
  return "custom";
}

const iconStroke = 1.5;

/** Decorative 12px platform hints for Published tasks — icons only, subtle gray. */
export function PublishedPlatformIconRow({ platforms }: { platforms: string[] }) {
  if (!platforms?.length) return null;
  const iconClass = "h-3 w-3 shrink-0 text-[rgba(255,255,255,0.35)]";
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      {platforms.map((p, i) => {
        const kind = platformIconKind(p);
        if (kind === "blog") {
          return <Globe key={`${i}-${p}`} className={iconClass} strokeWidth={iconStroke} />;
        }
        if (kind === "instagram") {
          return <Camera key={`${i}-${p}`} className={iconClass} strokeWidth={iconStroke} />;
        }
        if (kind === "x") {
          return (
            <span
              key={`${i}-${p}`}
              className="inline-flex h-3 w-3 shrink-0 items-center justify-center text-[12px] font-medium leading-none text-[rgba(255,255,255,0.35)]"
            >
              𝕏
            </span>
          );
        }
        if (kind === "linkedin") {
          return <Linkedin key={`${i}-${p}`} className={iconClass} strokeWidth={iconStroke} />;
        }
        return <Tag key={`${i}-${p}`} className={iconClass} strokeWidth={iconStroke} />;
      })}
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
