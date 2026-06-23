"use client";

import { crmSourceLabel } from "@/lib/crm-i18n";
import type { AppLanguage } from "@/lib/locale-types";
import { CrmDashboardCard, CrmDashboardSectionTitle, CrmDashboardSkeleton } from "./crm-dashboard-card";

type Props = {
  sourceMap: Record<string, number>;
  sourceLabels: readonly string[];
  sourceTotal: number;
  loading: boolean;
  language: AppLanguage;
  lt: (key: string) => string;
};

export function CrmDashboardSources({ sourceMap, sourceLabels, sourceTotal, loading, language, lt }: Props) {
  return (
    <CrmDashboardCard>
      <CrmDashboardSectionTitle>{lt("LEAD SOURCES")}</CrmDashboardSectionTitle>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <CrmDashboardSkeleton key={i} className="h-10" />
          ))}
        </div>
      ) : (
        <ul className="space-y-4">
          {sourceLabels.map((label) => {
            const count = sourceMap[label] ?? 0;
            const pct = Math.round((count / sourceTotal) * 1000) / 10;
            return (
              <li key={label}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white">{crmSourceLabel(label, language)}</span>
                  <span className="mono-num text-[rgba(255,255,255,0.45)]">
                    {count} ({pct}%)
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
                  <div
                    className="h-full rounded-full bg-[var(--primary)]"
                    style={{ width: `${Math.min(100, sourceTotal ? (count / sourceTotal) * 100 : 0)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      </div>
    </CrmDashboardCard>
  );
}
