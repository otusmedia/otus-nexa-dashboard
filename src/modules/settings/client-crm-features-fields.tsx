"use client";

import type { ClientCrmIntegration } from "@/types";

export function ClientCrmFeaturesFields({
  value,
  onChange,
  lt,
}: {
  value: ClientCrmIntegration;
  onChange: (next: ClientCrmIntegration) => void;
  lt: (key: string) => string;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-[var(--border)] p-3">
      <p className="text-xs font-normal uppercase tracking-[0.08em] text-[var(--muted)]">{lt("CRM")}</p>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
        <input
          type="checkbox"
          checked={value.resumesEnabled !== false}
          onChange={(e) => onChange({ ...value, resumesEnabled: e.target.checked })}
          className="rounded border-[var(--border)]"
        />
        {lt("Enable resumes funnel")}
      </label>
      <p className="text-[11px] font-light leading-relaxed text-[var(--muted)]">{lt("Enable resumes funnel hint")}</p>
    </div>
  );
}
