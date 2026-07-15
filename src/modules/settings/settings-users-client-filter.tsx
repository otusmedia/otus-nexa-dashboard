"use client";

import { LayoutGrid } from "lucide-react";
import { ClientLogo } from "@/components/ui/client-logo";
import { cn } from "@/lib/utils";
import type { Client } from "@/types";

export type SettingsClientFilterValue = "" | "nexa" | "otus" | string;

function clientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function ClientFilterChip({
  client,
  active,
  accentColor,
  onClick,
}: {
  client: Pick<Client, "name" | "slug" | "logoUrl" | "logoLightUrl" | "primaryColor">;
  active: boolean;
  accentColor: string;
  onClick: () => void;
}) {
  const ringStyle = active ? { boxShadow: `0 0 0 2px ${accentColor}` } : undefined;

  return (
    <button
      type="button"
      title={client.name}
      aria-pressed={active}
      aria-label={client.name}
      onClick={onClick}
      className={cn(
        "flex h-9 max-w-[120px] shrink-0 items-center gap-1.5 rounded-[6px] px-2 transition-colors",
        active ? "bg-[rgba(255,255,255,0.06)]" : "hover:bg-[rgba(255,255,255,0.06)]",
      )}
      style={active ? { boxShadow: `inset 0 0 0 1px ${accentColor}55` } : undefined}
    >
      {client.logoUrl ? (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-strong)] bg-[#161616] p-0.5">
          <ClientLogo client={client} size="xs" className="h-4 max-w-none object-contain" />
        </span>
      ) : (
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[0.6rem] font-light text-white"
          style={{ backgroundColor: client.primaryColor || "#FF4500", ...ringStyle }}
        >
          {clientInitials(client.name)}
        </span>
      )}
      <span className="truncate text-[0.65rem] text-[rgba(255,255,255,0.75)]">{client.name}</span>
    </button>
  );
}

type Props = {
  value: SettingsClientFilterValue;
  clients: Client[];
  onChange: (value: SettingsClientFilterValue) => void;
  lt: (key: string) => string;
  className?: string;
};

export function SettingsUsersClientFilter({ value, clients, onChange, lt, className }: Props) {
  const sortedClients = [...clients].sort((a, b) => a.name.localeCompare(b.name));
  const activeClient = sortedClients.find((c) => c.slug === value);
  const activeLabel =
    value === ""
      ? lt("All clients")
      : value === "nexa"
        ? lt("Nexa")
        : value === "otus"
          ? lt("Otus")
          : activeClient?.name ?? value;

  return (
    <div className={cn("border-b border-[var(--border)] px-4 py-3", className)}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-[rgba(255,255,255,0.45)]">
          {lt("Filter by client")}
        </p>
        <p className="text-xs text-[rgba(255,255,255,0.55)]">{activeLabel}</p>
      </div>

      <nav
        className="flex w-full max-w-full items-center gap-1 overflow-x-auto rounded-[8px] border border-[var(--border)] p-1"
        aria-label={lt("Filter by client")}
      >
        <button
          type="button"
          title={lt("All clients")}
          aria-pressed={!value}
          onClick={() => onChange("")}
          className={cn(
            "flex h-9 shrink-0 items-center gap-1.5 rounded-[6px] px-2.5 text-[0.65rem] transition-colors",
            !value
              ? "bg-[rgba(255,69,0,0.15)] text-white"
              : "text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white",
          )}
        >
          <LayoutGrid className="h-3.5 w-3.5" strokeWidth={1.75} />
          {lt("All")}
        </button>

        {(["nexa", "otus"] as const).map((agency) => {
          const active = value === agency;
          const label = agency === "nexa" ? lt("Nexa") : lt("Otus");
          return (
            <button
              key={agency}
              type="button"
              title={label}
              aria-pressed={active}
              onClick={() => onChange(agency)}
              className={cn(
                "shrink-0 rounded-[6px] px-2.5 py-1.5 text-[0.65rem] uppercase tracking-[0.06em] transition-colors",
                active
                  ? agency === "nexa"
                    ? "border border-[rgba(59,130,246,0.45)] bg-[rgba(59,130,246,0.12)] text-[rgba(147,197,253,0.95)]"
                    : "border border-[rgba(168,85,247,0.45)] bg-[rgba(168,85,247,0.12)] text-[rgba(216,180,254,0.95)]"
                  : "text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white",
              )}
            >
              {label}
            </button>
          );
        })}

        {sortedClients.map((client) => (
          <ClientFilterChip
            key={client.slug}
            client={client}
            active={value === client.slug}
            accentColor={client.primaryColor || "#FF4500"}
            onClick={() => onChange(client.slug)}
          />
        ))}
      </nav>
    </div>
  );
}

export function userMatchesClientFilter(user: { company: string; clientSlug?: string | null }, filter: SettingsClientFilterValue): boolean {
  if (!filter) return true;
  if (filter === "nexa" || filter === "otus") return user.company === filter;
  return user.company === filter || (user.clientSlug ?? "") === filter;
}
