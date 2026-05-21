"use client";

import { formatLeadValue, pipelineStageDotClass, type CrmLeadStatus } from "@/lib/crm-data";
import { crmLeadStatusLabel } from "@/lib/crm-i18n";
import type { AppLanguage } from "@/lib/locale-types";
import { cn } from "@/lib/utils";
import { CrmDashboardCard, CrmDashboardSectionTitle, CrmDashboardSkeleton } from "./crm-dashboard-card";

type PipelineRow = {
  stage: CrmLeadStatus;
  count: number;
  valueSum: number;
};

type Props = {
  rows: PipelineRow[];
  loading: boolean;
  language: AppLanguage;
  lt: (key: string) => string;
};

export function CrmDashboardPipeline({ rows, loading, language, lt }: Props) {
  return (
    <CrmDashboardCard>
      <CrmDashboardSectionTitle>{lt("PIPELINE OVERVIEW")}</CrmDashboardSectionTitle>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <CrmDashboardSkeleton key={i} className="h-12" />
          ))}
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-white/[0.06]">
          {rows.map(({ stage, count, valueSum }) => (
            <li key={stage} className="flex items-center gap-3 py-3 first:pt-0">
              <span
                className={cn("h-2 w-2 shrink-0 rounded-full", pipelineStageDotClass(stage))}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white">{crmLeadStatusLabel(stage, language)}</p>
                <p className="mono-num text-xs text-[rgba(255,255,255,0.4)]">
                  {count} {lt("leads")} · {formatLeadValue(valueSum)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      </div>
    </CrmDashboardCard>
  );
}
