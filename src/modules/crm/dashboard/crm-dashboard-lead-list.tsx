"use client";

import { useRouter } from "next/navigation";
import { formatLeadValue, type CrmLead } from "@/lib/crm-data";
import { getLeadInitials } from "@/modules/crm/use-crm-dashboard-data";
import { cn } from "@/lib/utils";
import { CrmDashboardCard, CrmDashboardSectionTitle, CrmDashboardSkeleton } from "./crm-dashboard-card";

type Props = {
  leads: CrmLead[];
  loading: boolean;
  lt: (key: string) => string;
};

export function CrmDashboardLeadList({ leads, loading, lt }: Props) {
  const router = useRouter();

  return (
    <CrmDashboardCard className="flex h-full min-h-[280px] flex-col">
      <div className="mb-4 flex items-center justify-between gap-2">
        <CrmDashboardSectionTitle>{lt("Priority leads")}</CrmDashboardSectionTitle>
        <button
          type="button"
          onClick={() => router.push("/crm/pipeline")}
          className="text-[0.65rem] text-[rgba(255,255,255,0.45)] transition hover:text-white"
        >
          {lt("Show all")}
        </button>
      </div>

      {loading ? (
        <ul className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <li key={i} className="flex gap-3">
              <CrmDashboardSkeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <CrmDashboardSkeleton className="h-4 w-32" />
                <CrmDashboardSkeleton className="h-3 w-24" />
              </div>
            </li>
          ))}
        </ul>
      ) : leads.length === 0 ? (
        <p className="text-sm text-[rgba(255,255,255,0.4)]">{lt("No leads yet")}</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1">
          {leads.map((lead) => (
            <li key={lead.id}>
              <button
                type="button"
                onClick={() => router.push("/crm/pipeline")}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-white/[0.04]"
              >
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    "bg-white/[0.08] text-xs font-medium text-white",
                  )}
                >
                  {getLeadInitials(lead.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-white">{lead.name}</span>
                  <span className="block truncate text-xs text-[rgba(255,255,255,0.4)]">
                    {lead.company ?? lead.owner ?? "—"}
                  </span>
                </span>
                <span className="mono-num shrink-0 text-sm text-[rgba(255,255,255,0.55)]">
                  {formatLeadValue(lead.value)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </CrmDashboardCard>
  );
}
