"use client";

import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CrmOwnerFilterItem } from "@/lib/crm-team-members";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function hue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h + name.charCodeAt(i) * 17) % 360;
  return h;
}

function OwnerAvatar({
  name,
  avatarUrl,
  active,
  accentColor,
}: {
  name: string;
  avatarUrl: string | null;
  active: boolean;
  accentColor: string;
}) {
  const ringStyle = active ? { boxShadow: `0 0 0 2px ${accentColor}` } : undefined;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={cn(
          "h-8 w-8 rounded-full border border-[var(--border-strong)] object-cover transition-transform",
          active && "scale-105",
        )}
        style={ringStyle}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border-strong)] text-[0.65rem] font-light text-white transition-transform",
        active && "scale-105",
      )}
      style={{ backgroundColor: `hsla(${hue(name)}, 35%, 32%, 1)`, ...ringStyle }}
    >
      {initials(name)}
    </span>
  );
}

type Props = {
  value: string;
  owners: CrmOwnerFilterItem[];
  onChange: (owner: string) => void;
  lt: (key: string) => string;
  accentColor?: string;
  className?: string;
};

export function CrmDashboardOwnerFilter({
  value,
  owners,
  onChange,
  lt,
  accentColor = "#FF4500",
  className,
}: Props) {
  if (owners.length === 0) return null;

  const activeOwner = owners.find((owner) => owner.name === value);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-[rgba(255,255,255,0.45)]">
          {lt("Filter by owner")}
        </p>
        {activeOwner ? (
          <p className="text-xs text-[rgba(255,255,255,0.55)]">{activeOwner.name}</p>
        ) : (
          <p className="text-xs text-[rgba(255,255,255,0.55)]">{lt("All owners")}</p>
        )}
      </div>

      <nav
        className="flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-[8px] border border-[var(--border)] p-1"
        aria-label={lt("Filter by owner")}
      >
        <button
          type="button"
          title={lt("All owners")}
          aria-pressed={!value}
          onClick={() => onChange("")}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] transition-colors",
            !value
              ? "text-white"
              : "text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white",
          )}
          style={
            !value
              ? { backgroundColor: `${accentColor}26`, boxShadow: `inset 0 0 0 1px ${accentColor}55` }
              : undefined
          }
        >
          <Users className="h-4 w-4" strokeWidth={1.75} />
        </button>

        {owners.map((owner) => {
          const active = value === owner.name;
          return (
            <button
              key={owner.name}
              type="button"
              title={owner.name}
              aria-pressed={active}
              aria-label={owner.name}
              onClick={() => onChange(owner.name)}
              className={cn(
                "shrink-0 rounded-[6px] p-0.5 transition-colors",
                active ? "bg-[rgba(255,255,255,0.04)]" : "hover:bg-[rgba(255,255,255,0.06)]",
              )}
            >
              <OwnerAvatar
                name={owner.name}
                avatarUrl={owner.avatarUrl}
                active={active}
                accentColor={accentColor}
              />
            </button>
          );
        })}
      </nav>
    </div>
  );
}
