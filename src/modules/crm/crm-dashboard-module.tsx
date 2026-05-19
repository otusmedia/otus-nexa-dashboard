"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DataTooltip } from "@/components/ui/data-tooltip";
import { useAppContext } from "@/components/providers/app-providers";
import { PageHeader } from "@/components/ui/page-header";
import { useLanguage } from "@/context/language-context";
import { rowMatchesDataClient } from "@/lib/client-utils";
import { supabase } from "@/lib/supabase";
import {
  CRM_KANBAN_COLUMNS,
  CRM_LEAD_SOURCE_LABELS,
  CRM_LEAD_STATUSES,
  formatLeadValue,
  mapCrmLeadRow,
  normalizeLeadStatus,
  normalizeSource,
  pipelineStageDotClass,
  type CrmLead,
  type CrmLeadStatus,
} from "@/lib/crm-data";
import { crmLeadStatusLabel, crmSourceLabel } from "@/lib/crm-i18n";
import { cn } from "@/lib/utils";

type KpiId =
  | "totalLeads"
  | "conversionRate"
  | "closedSales"
  | "totalSalesValue"
  | "openProposals"
  | "openProposalsValue";

function sourceCountMap(leads: CrmLead[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const label of CRM_LEAD_SOURCE_LABELS) m[label] = 0;
  for (const lead of leads) {
    const key = normalizeSource(lead.source);
    m[key] = (m[key] ?? 0) + 1;
  }
  return m;
}

export function CrmDashboardModule() {
  const { dataClientSlug } = useAppContext();
  const { language, t: lt } = useLanguage();
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.from("crm_leads").select("*").order("created_at", { ascending: false });
    if (error) {
      console.error("[crm dashboard]", error.message);
      setError(error.message);
      setLeads([]);
    } else {
      const mapped = ((data ?? []) as Record<string, unknown>[])
        .map((row) => mapCrmLeadRow(row))
        .filter((lead) => rowMatchesDataClient(lead.client_slug, dataClientSlug));
      setLeads(mapped);
    }
    setLoading(false);
  }, [dataClientSlug]);

  useEffect(() => {
    void load();

    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const poll = window.setInterval(() => void load(), 20_000);
    const channel = supabase
      .channel(`crm-leads-dashboard-${dataClientSlug ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_leads" }, () => {
        void load();
      })
      .subscribe();

    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [load, dataClientSlug]);

  const total = leads.length;
  const wonCount = leads.filter((l) => normalizeLeadStatus(l.status) === "Won").length;
  const conversionPct = total === 0 ? 0 : Math.round((wonCount / total) * 1000) / 10;
  const closedSales = wonCount;
  const totalSalesValue = leads
    .filter((l) => normalizeLeadStatus(l.status) === "Won")
    .reduce((a, l) => a + l.value, 0);
  const openProposalLeads = leads.filter((l) => normalizeLeadStatus(l.status) === "Proposal Sent");
  const openProposalsCount = openProposalLeads.length;
  const openProposalsValue = openProposalLeads.reduce((a, l) => a + l.value, 0);

  const sourceMap = useMemo(() => sourceCountMap(leads), [leads]);
  const sourceTotal = leads.length || 1;

  const pipelineRows = useMemo(() => {
    return CRM_LEAD_STATUSES.map((stage) => {
      const inStage = leads.filter((l) => normalizeLeadStatus(l.status) === stage);
      const count = inStage.length;
      const valueSum = inStage.reduce((a, l) => a + l.value, 0);
      return { stage, count, valueSum };
    });
  }, [leads]);

  const kpiCards = useMemo(
    () => [
      {
        id: "totalLeads" as KpiId,
        label: lt("Total Leads"),
        value: String(total),
        sub: `${total} ${lt("total")}`,
      },
      {
        id: "conversionRate" as KpiId,
        label: lt("Conversion Rate"),
        value: `${conversionPct}%`,
        sub: `${wonCount} ${lt("won /")} ${total} ${lt("leads")}`,
      },
      {
        id: "closedSales" as KpiId,
        label: lt("Closed Sales"),
        value: String(closedSales),
        sub: lt("Won"),
      },
      {
        id: "totalSalesValue" as KpiId,
        label: lt("Total Sales Value"),
        value: formatLeadValue(totalSalesValue),
        sub: lt("Won deals"),
      },
      {
        id: "openProposals" as KpiId,
        label: lt("Open Proposals"),
        value: String(openProposalsCount),
        sub: lt("Proposal Sent"),
      },
      {
        id: "openProposalsValue" as KpiId,
        label: lt("Open Proposals Value"),
        value: formatLeadValue(openProposalsValue),
        sub: lt("In proposal"),
      },
    ],
    [
      total,
      conversionPct,
      wonCount,
      closedSales,
      totalSalesValue,
      openProposalsCount,
      openProposalsValue,
      lt,
    ],
  );

  if (!loading && total === 0 && !error) {
    return (
      <>
        <PageHeader title={lt("CRM")} subtitle={lt("Sales performance and pipeline overview")} />
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-xl border border-[var(--border)] bg-[#161616] px-6 py-16 text-center">
          <p className="text-sm font-light text-[rgba(255,255,255,0.55)]">{lt("No leads yet")}</p>
          <p className="mt-2 max-w-md text-xs text-[rgba(255,255,255,0.4)]">
            {lt("Add leads from the pipeline to see KPIs, sources, and pipeline overview.")}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={lt("CRM")} subtitle={lt("Sales performance and pipeline overview")} />
      {error ? (
        <p className="mb-4 text-sm text-[#fca5a5]">
          {lt("Could not load CRM data:")} {error}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {kpiCards.map((kpi) => (
          <Card key={kpi.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-1">
                <p className="kpi-label">{kpi.label}</p>
                {kpi.id === "conversionRate" ? (
                  <DataTooltip
                    source="CRM module — Supabase database — calculated"
                    reliability="high"
                    note="Won leads divided by total leads. Accuracy depends on keeping lead statuses updated."
                  />
                ) : kpi.id === "totalSalesValue" ? (
                  <DataTooltip
                    source="CRM module — Supabase database"
                    reliability="high"
                    note="Sum of deal values for leads marked as Won."
                  />
                ) : kpi.id === "openProposalsValue" ? (
                  <DataTooltip
                    source="CRM module — Supabase database"
                    reliability="high"
                    note="Sum of deal values for leads in Proposal Sent stage."
                  />
                ) : null}
              </div>
              <MoreHorizontal className="h-4 w-4 text-[var(--muted)]" />
            </div>
            {loading ? (
              <>
                <div className="mt-2 h-9 w-24 animate-pulse rounded-md bg-[rgba(255,255,255,0.08)]" />
                <div className="mt-2 h-[2px] w-full animate-pulse rounded-[2px] bg-[rgba(255,255,255,0.12)]" />
                <div className="mt-2 h-3 w-28 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
              </>
            ) : (
              <>
                <p className="metric-value mt-2 text-3xl text-white">{kpi.value}</p>
                <div className="mt-2 h-[2px] rounded-[2px] bg-[rgba(255,255,255,0.08)]">
                  <div
                    className="h-[2px] rounded-[2px] bg-[rgba(255,255,255,0.35)]"
                    style={{
                      width:
                        kpi.id === "totalLeads"
                          ? "100%"
                          : kpi.id === "conversionRate"
                            ? `${Math.min(100, conversionPct)}%`
                            : kpi.id === "closedSales" && total > 0
                              ? `${Math.min(100, (closedSales / total) * 100)}%`
                              : kpi.id === "openProposals" && total > 0
                                ? `${Math.min(100, (openProposalsCount / total) * 100)}%`
                                : "35%",
                    }}
                  />
                </div>
                <p className="kpi-fraction mt-1 text-xs">{kpi.sub}</p>
              </>
            )}
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-[0.7rem] font-normal uppercase tracking-[0.1em] text-[rgba(255,255,255,0.4)]">
            {lt("LEAD SOURCES")}
          </h2>
          {loading ? (
            <div className="mt-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-md bg-[rgba(255,255,255,0.06)]" />
              ))}
            </div>
          ) : (
            <ul className="mt-4 space-y-4">
              {CRM_LEAD_SOURCE_LABELS.map((label) => {
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
                        className="h-full rounded-full bg-[#ff4500]"
                        style={{ width: `${Math.min(100, sourceTotal ? (count / sourceTotal) * 100 : 0)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-[0.7rem] font-normal uppercase tracking-[0.1em] text-[rgba(255,255,255,0.4)]">
            {lt("PIPELINE OVERVIEW")}
          </h2>
          {loading ? (
            <div className="mt-4 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-md bg-[rgba(255,255,255,0.06)]" />
              ))}
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--border)]">
              {pipelineRows.map(({ stage, count, valueSum }) => (
                <li key={stage} className="flex items-center gap-3 py-3 first:pt-0">
                  <span
                    className={cn("h-2 w-2 shrink-0 rounded-full", pipelineStageDotClass(stage as CrmLeadStatus))}
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
        </Card>
      </div>
    </>
  );
}
