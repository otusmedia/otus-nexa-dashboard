"use client";

import { useRouter } from "next/navigation";
import { formatLeadCreatedAt } from "@/lib/crm-data";
import type { CrmActivityItem } from "@/modules/crm/use-crm-dashboard-data";
import { CrmDashboardCard, CrmDashboardSectionTitle, CrmDashboardSkeleton } from "./crm-dashboard-card";

type Props = {
  latest: CrmActivityItem | null;
  items: CrmActivityItem[];
  loading: boolean;
  lt: (key: string) => string;
};

export function CrmDashboardActivityCard({ latest, items, loading, lt }: Props) {
  const router = useRouter();

  return (
    <CrmDashboardCard>
      <CrmDashboardSectionTitle>{lt("Recent activity")}</CrmDashboardSectionTitle>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
      {loading ? (
        <div className="space-y-3">
          <CrmDashboardSkeleton className="h-24 w-full rounded-xl" />
          <CrmDashboardSkeleton className="h-4 w-full" />
          <CrmDashboardSkeleton className="h-4 w-3/4" />
        </div>
      ) : !latest ? (
        <p className="flex flex-1 items-center text-sm text-[rgba(255,255,255,0.4)]">{lt("No activity yet")}</p>
      ) : (
        <>
          <div className="rounded-xl border border-white/[0.08] bg-[rgba(255,255,255,0.03)] p-4">
            <p className="text-[0.65rem] uppercase tracking-[0.1em] text-[rgba(255,255,255,0.4)]">
              {latest.type === "lead" ? lt("Lead updated") : lt("Appointment")}
            </p>
            <p className="mt-2 text-lg font-medium text-white">{latest.title}</p>
            <p className="mt-1 text-sm text-[rgba(255,255,255,0.45)]">{latest.subtitle}</p>
            <p className="mono-num mt-2 text-xs text-[rgba(255,255,255,0.35)]">
              {formatLeadCreatedAt(latest.at)}
            </p>
            <button
              type="button"
              onClick={() => router.push("/crm/pipeline")}
              className="mt-4 w-full rounded-lg border border-white/20 py-2 text-xs font-medium text-white transition hover:bg-white/[0.06]"
            >
              {lt("View in pipeline")}
            </button>
          </div>

          {items.length > 1 ? (
            <ul className="mt-4 space-y-2 border-t border-white/[0.06] pt-3">
              {items.slice(1, 5).map((item) => (
                <li key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-[rgba(255,255,255,0.55)]">{item.title}</span>
                  <span className="shrink-0 text-[rgba(255,255,255,0.3)]">
                    {formatLeadCreatedAt(item.at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
      </div>
    </CrmDashboardCard>
  );
}
