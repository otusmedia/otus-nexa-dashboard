"use client";

import type { CrmTrendBar } from "@/modules/crm/use-crm-dashboard-data";
import { CrmDashboardCard, CrmDashboardSectionTitle, CrmDashboardSkeleton } from "./crm-dashboard-card";

type Props = {
  bars: CrmTrendBar[];
  loading: boolean;
  accentColor?: string;
  lt: (key: string) => string;
};

export function CrmDashboardTrendChart({ bars, loading, accentColor, lt }: Props) {
  const barColor = accentColor ?? "#ffffff";

  return (
    <CrmDashboardCard className="flex h-full min-h-[280px] flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <CrmDashboardSectionTitle>{lt("Leads created")}</CrmDashboardSectionTitle>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-end">
        {loading ? (
          <div className="flex h-[200px] items-end gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <CrmDashboardSkeleton key={i} className="h-[60%] flex-1" />
            ))}
          </div>
        ) : (
          <>
            <div className="flex h-[200px] items-end gap-1.5 border-b border-white/[0.06] pb-3 md:gap-2">
              {bars.map((bar) => (
                <div key={bar.dateKey} className="group relative flex h-full min-h-0 flex-1 flex-col justify-end">
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded bg-[#222] px-2 py-1 text-[0.7rem] text-white opacity-0 transition group-hover:opacity-100">
                    <span className="mono-num">{bar.count}</span>
                  </div>
                  <div
                    className="w-full rounded-sm transition-all"
                    style={{
                      height: `${bar.heightPct}%`,
                      backgroundColor: bar.count > 0 ? barColor : "rgba(255,255,255,0.12)",
                    }}
                  />
                </div>
              ))}
            </div>
            <div
              className="mt-2 grid text-[0.65rem] text-[rgba(255,255,255,0.4)]"
              style={{ gridTemplateColumns: `repeat(${Math.max(bars.length, 1)}, minmax(0, 1fr))` }}
            >
              {bars.map((bar) => (
                <span key={`lbl-${bar.dateKey}`} className="truncate text-center">
                  {bar.label}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </CrmDashboardCard>
  );
}
