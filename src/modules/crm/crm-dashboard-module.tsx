"use client";

import Link from "next/link";
import { useState } from "react";
import { useAppContext } from "@/components/providers/app-providers";
import { PageHeader } from "@/components/ui/page-header";
import { useLanguage } from "@/context/language-context";
import { isAgencyAdmin } from "@/lib/client-utils";
import { CrmDashboardActivityCard } from "@/modules/crm/dashboard/crm-dashboard-activity-card";
import { CrmDashboardAppointmentsGrid } from "@/modules/crm/dashboard/crm-dashboard-appointments-grid";
import { CrmDashboardHero } from "@/modules/crm/dashboard/crm-dashboard-hero";
import { CrmDashboardLeadList } from "@/modules/crm/dashboard/crm-dashboard-lead-list";
import { CrmDashboardPipeline } from "@/modules/crm/dashboard/crm-dashboard-pipeline";
import { CrmDashboardSchedule } from "@/modules/crm/dashboard/crm-dashboard-schedule";
import { CrmDashboardSources } from "@/modules/crm/dashboard/crm-dashboard-sources";
import { CrmDashboardTrendChart } from "@/modules/crm/dashboard/crm-dashboard-trend-chart";
import { useCrmDashboardData, type CrmChartRange } from "@/modules/crm/use-crm-dashboard-data";

export function CrmDashboardModule() {
  const { dataClientSlug, currentUser, clients, projectsClientFilter } = useAppContext();
  const { language, t: lt } = useLanguage();
  const [chartRange, setChartRange] = useState<CrmChartRange>("7d");

  const activeClient = dataClientSlug ? clients.find((c) => c.slug === dataClientSlug) : undefined;
  const viewingAllClients = isAgencyAdmin(currentUser) && projectsClientFilter === "all";

  const {
    loading,
    error,
    total,
    heroMetric,
    compactKpis,
    trendBars,
    priorityLeads,
    upcomingAppointments,
    todayAppointments,
    recentActivity,
    latestActivity,
    sourceMap,
    sourceTotal,
    pipelineRows,
    upcomingDateSlots,
    reload,
  } = useCrmDashboardData(dataClientSlug, chartRange, language);

  const accentColor = activeClient?.primaryColor ?? "#FF4500";
  const showSelectClientHint =
    isAgencyAdmin(currentUser) && viewingAllClients && !loading && total > 0;

  if (!loading && total === 0 && !error) {
    return (
      <>
        <PageHeader title={lt("CRM")} subtitle={lt("Sales performance and pipeline overview")} />
        <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#161616] px-6 py-16 text-center">
          <p className="text-sm font-light text-[rgba(255,255,255,0.55)]">{lt("No leads yet")}</p>
          <p className="mt-2 max-w-md text-xs text-[rgba(255,255,255,0.4)]">
            {lt("Add leads from the pipeline to see KPIs, sources, and pipeline overview.")}
          </p>
          <Link
            href="/crm/pipeline"
            className="btn-primary mt-6 inline-flex rounded-lg px-4 py-2 text-sm"
          >
            {lt("View pipeline")}
          </Link>
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

      {showSelectClientHint ? (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/90">
          {lt("Showing aggregated data for all clients. Select a client for scoped appointments and charts.")}
        </p>
      ) : null}

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-12">
        <div className="h-full xl:col-span-4">
          <CrmDashboardHero hero={heroMetric} compactKpis={compactKpis} loading={loading} lt={lt} />
        </div>
        <div className="h-full xl:col-span-5">
          <CrmDashboardTrendChart
            bars={trendBars}
            range={chartRange}
            onRangeChange={setChartRange}
            loading={loading}
            accentColor={accentColor}
            lt={lt}
          />
        </div>
        <div className="h-full xl:col-span-3">
          <CrmDashboardLeadList leads={priorityLeads} loading={loading} lt={lt} />
        </div>

        <div className="h-full xl:col-span-4">
          <CrmDashboardAppointmentsGrid
            slots={upcomingDateSlots}
            appointments={upcomingAppointments}
            loading={loading}
            lt={lt}
          />
        </div>
        <div className="h-full xl:col-span-4">
          <CrmDashboardSchedule
            appointments={todayAppointments}
            loading={loading}
            lt={lt}
            onAppointmentCompleted={() => void reload()}
          />
        </div>
        <div className="h-full xl:col-span-4">
          <CrmDashboardActivityCard
            latest={latestActivity}
            items={recentActivity}
            loading={loading}
            lt={lt}
          />
        </div>

        <div className="h-full xl:col-span-6">
          <CrmDashboardSources
            sourceMap={sourceMap}
            sourceTotal={sourceTotal}
            loading={loading}
            language={language}
            lt={lt}
          />
        </div>
        <div className="h-full xl:col-span-6">
          <CrmDashboardPipeline rows={pipelineRows} loading={loading} language={language} lt={lt} />
        </div>
      </div>
    </>
  );
}
