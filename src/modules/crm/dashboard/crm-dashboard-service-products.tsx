"use client";

import { CrmDashboardCard, CrmDashboardSectionTitle, CrmDashboardSkeleton } from "./crm-dashboard-card";

type Props = {
  serviceProductMap: Record<string, number>;
  serviceProductLabels: readonly string[];
  serviceProductTotal: number;
  loading: boolean;
  lt: (key: string) => string;
};

export function CrmDashboardServiceProducts({
  serviceProductMap,
  serviceProductLabels,
  serviceProductTotal,
  loading,
  lt,
}: Props) {
  return (
    <CrmDashboardCard>
      <CrmDashboardSectionTitle>{lt("SERVICE / PRODUCT TYPES")}</CrmDashboardSectionTitle>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <CrmDashboardSkeleton key={i} className="h-10" />
            ))}
          </div>
        ) : serviceProductLabels.length === 0 ? (
          <p className="text-sm text-[rgba(255,255,255,0.45)]">{lt("No service or product types yet.")}</p>
        ) : (
          <ul className="space-y-4">
            {serviceProductLabels.map((label) => {
              const count = serviceProductMap[label] ?? 0;
              const pct = Math.round((count / serviceProductTotal) * 1000) / 10;
              return (
                <li key={label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white">{label}</span>
                    <span className="mono-num text-[rgba(255,255,255,0.45)]">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
                    <div
                      className="h-full rounded-full bg-[var(--primary)]"
                      style={{ width: `${Math.min(100, serviceProductTotal ? (count / serviceProductTotal) * 100 : 0)}%` }}
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
