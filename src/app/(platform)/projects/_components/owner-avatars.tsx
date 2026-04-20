"use client";

import { cn } from "@/lib/utils";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function hue(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h + name.charCodeAt(i) * 17) % 360;
  return h;
}

export function OwnerAvatars({
  names,
  className,
  size = "sm",
}: {
  names: string[];
  className?: string;
  size?: "sm" | "md";
}) {
  if (names.length === 0) {
    return (
      <span className={cn("text-xs font-light text-[rgba(255,255,255,0.4)]", className)}>—</span>
    );
  }

  const dim = size === "sm" ? "h-6 w-6 text-[0.6rem]" : "h-8 w-8 text-[0.7rem]";

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex -space-x-1.5">
        {names.slice(0, 3).map((name) => (
          <div
            key={name}
            className={cn(
              "flex shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] font-light text-white",
              dim,
            )}
            style={{ backgroundColor: `hsla(${hue(name)}, 35%, 32%, 1)` }}
            title={name}
          >
            {initials(name)}
          </div>
        ))}
      </div>
      <span className="min-w-0 truncate text-xs font-light text-[rgba(255,255,255,0.4)]">
        {names.join(" · ")}
      </span>
    </div>
  );
}
