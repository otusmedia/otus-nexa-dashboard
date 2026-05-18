"use client";

import { useMemo } from "react";
import { ClientLogo } from "@/components/ui/client-logo";
import type { Client } from "@/types";
import { cn } from "@/lib/utils";

type SidebarClientPickerProps = {
  clients: Client[];
  value: string;
  onChange: (slug: string) => void;
  label: string;
  allLabel: string;
  className?: string;
};

export function SidebarClientPicker({
  clients,
  value,
  onChange,
  label,
  allLabel,
  className,
}: SidebarClientPickerProps) {
  const selected = useMemo(
    () => (value === "all" ? null : clients.find((c) => c.slug === value) ?? null),
    [clients, value],
  );

  return (
    <div className={cn("px-3", className)}>
      <label className="block">
        <span className="mb-1.5 block text-[10px] font-normal uppercase tracking-[0.1em] text-[rgba(255,255,255,0.4)]">
          {label}
        </span>
        <div className="flex items-center gap-2">
          {selected?.logoUrl ? <ClientLogo client={selected} size="xs" /> : null}
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-xs text-white"
          >
            <option value="all">{allLabel}</option>
            {clients
              .filter((c) => c.active)
              .map((client) => (
                <option key={client.id} value={client.slug}>
                  {client.name}
                </option>
              ))}
          </select>
        </div>
      </label>
    </div>
  );
}
