"use client";

import { DataTooltip } from "@/components/ui/data-tooltip";
import type { CrmCompactKpi, CrmHeroMetric } from "@/modules/crm/use-crm-dashboard-data";
import { CrmDashboardCard, CrmDashboardSkeleton } from "./crm-dashboard-card";

type Props = {
  hero: CrmHeroMetric;
  compactKpis: CrmCompactKpi[];
  loading: boolean;
  lt: (key: string) => string;
};

export function CrmDashboardHero({ hero, compactKpis, loading, lt }: Props) {
  return (
    <CrmDashboardCard className="flex h-full min-h-[280px] flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2">
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-[rgba(255,255,255,0.45)]">
            {lt(hero.label)}
          </p>
          <DataTooltip
            source="CRM module — Supabase database — calculated"
            reliability="high"
            note="Won leads divided by total leads in the selected period (sales and site funnels). Accuracy depends on keeping lead statuses updated."
          />
        </div>
        {loading ? (
          <>
            <CrmDashboardSkeleton className="mt-4 h-14 w-32" />
            <CrmDashboardSkeleton className="mt-4 h-1.5 w-full" />
            <CrmDashboardSkeleton className="mt-2 h-4 w-40" />
          </>
        ) : (
          <>
            <p className="metric-value mt-3 text-5xl font-light leading-none text-white md:text-6xl">{hero.value}</p>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
              <div
                className="h-full rounded-full bg-white transition-all duration-500"
                style={{ width: `${hero.progressPct}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-[rgba(255,255,255,0.45)]">
              {hero.wonCount} {lt("won /")} {hero.total} {lt("leads")}
            </p>
          </>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-5">
        {compactKpis.map((kpi) => (
          <div
            key={kpi.id}
            className="rounded-xl border border-white/[0.06] bg-[rgba(255,255,255,0.02)] px-3 py-2.5"
          >
            {loading ? (
              <>
                <CrmDashboardSkeleton className="h-3 w-16" />
                <CrmDashboardSkeleton className="mt-2 h-6 w-12" />
              </>
            ) : (
              <>
                <p className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">
                  {lt(kpi.label)}
                </p>
                <p className="metric-value mt-1 text-lg text-white">{kpi.value}</p>
              </>
            )}
          </div>
        ))}
      </div>
    </CrmDashboardCard>
  );
}
