"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatDisplayDate } from "@/app/(platform)/projects/data";
import { useAppContext } from "@/components/providers/app-providers";
import { PageHeader } from "@/components/ui/page-header";
import { useLanguage } from "@/context/language-context";
import { canAccessMarketingForUser, resolveAgencyClientLandingPath } from "@/lib/default-landing-path";
import { readSidebarNavOrder } from "@/lib/sidebar-nav-order";
import { AgencyHomeAttentionTable } from "@/modules/agency-home/agency-home-attention-table";
import { AgencyHomeClientCard } from "@/modules/agency-home/agency-home-client-card";
import { useAgencyHomeData } from "@/modules/agency-home/use-agency-home-data";
import { CrmDashboardCard, CrmDashboardSectionTitle, CrmDashboardSkeleton } from "@/modules/crm/dashboard/crm-dashboard-card";
import { cn } from "@/lib/utils";

export function AgencyHomeModule() {
  const router = useRouter();
  const { clients, projectsByColumn, setProjectsClientFilter, currentUser, users } =
    useAppContext();
  const { t: lt } = useLanguage();
  const { loading, error, portfolioRows, attentionItems, recentUpdates, globalKpis, reload } =
    useAgencyHomeData(clients, projectsByColumn);

  const onSelectClient = useCallback(
    (slug: string) => {
      const landing = resolveAgencyClientLandingPath(
        currentUser,
        slug,
        { clients, users },
        {
          navOrder: readSidebarNavOrder(currentUser.id),
          canAccessMarketing: canAccessMarketingForUser(currentUser),
        },
      );
      router.push(landing);
      setProjectsClientFilter(slug);
    },
    [clients, currentUser, router, setProjectsClientFilter, users],
  );

  const openClientCrm = (slug: string) => {
    router.push("/crm/dashboard");
    setProjectsClientFilter(slug);
  };

  const openClientFinancial = (slug: string) => {
    router.push("/financial");
    setProjectsClientFilter(slug);
  };

  return (
    <div className="min-w-0 w-full space-y-8 overflow-x-hidden pb-8">
      <PageHeader
        title={lt("Home")}
        subtitle={lt("Agency portfolio overview across all clients")}
      />

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {lt("Could not load agency home data:")} {error}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <GlobalKpi label={lt("Active clients")} value={globalKpis.activeClients} loading={loading} />
        <GlobalKpi label={lt("Overdue tasks")} value={globalKpis.overdueTasks} loading={loading} warn={globalKpis.overdueTasks > 0} />
        <GlobalKpi
          label={lt("Waiting on client approval")}
          value={globalKpis.waitingClientApproval}
          loading={loading}
          highlight={globalKpis.waitingClientApproval > 0}
        />
        <GlobalKpi label={lt("Posts published (30d)")} value={globalKpis.postsPublished30d} loading={loading} />
        <GlobalKpi label={lt("Invoices overdue")} value={globalKpis.invoicesOverdue} loading={loading} warn={globalKpis.invoicesOverdue > 0} />
        <GlobalKpi label={lt("CRM open leads")} value={globalKpis.crmOpenLeads} loading={loading} />
      </section>

      <section className="space-y-3">
        <CrmDashboardSectionTitle>{lt("Clients")}</CrmDashboardSectionTitle>
        {loading && portfolioRows.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <CrmDashboardSkeleton key={i} className="h-48 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {portfolioRows.map((row) => (
              <AgencyHomeClientCard key={row.client.slug} row={row} onSelectClient={onSelectClient} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <CrmDashboardSectionTitle>{lt("Needs attention")}</CrmDashboardSectionTitle>
        <AgencyHomeAttentionTable items={attentionItems} onSelectClient={onSelectClient} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <CrmDashboardSectionTitle>{lt("CRM by client")}</CrmDashboardSectionTitle>
          <CrmDashboardCard>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wide text-[rgba(255,255,255,0.35)]">
                    <th className="pb-2 pr-4 font-normal">{lt("Client")}</th>
                    <th className="pb-2 pr-4 font-normal">{lt("Total Leads")}</th>
                    <th className="pb-2 pr-4 font-normal">{lt("Open leads")}</th>
                    <th className="pb-2 font-normal">{lt("Won deals")}</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioRows.map((row) => (
                    <tr
                      key={row.client.slug}
                      className="cursor-pointer border-b border-white/[0.04] transition hover:bg-white/[0.03]"
                      onClick={() => openClientCrm(row.client.slug)}
                    >
                      <td className="py-2.5 pr-4 text-white">{row.client.name}</td>
                      <td className="py-2.5 pr-4 tabular-nums text-[rgba(255,255,255,0.65)]">{row.crmLeads}</td>
                      <td className="py-2.5 pr-4 tabular-nums text-[rgba(255,255,255,0.65)]">{row.crmOpenLeads}</td>
                      <td className="py-2.5 tabular-nums text-emerald-300/90">{row.crmWon}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CrmDashboardCard>
        </section>

        <section className="space-y-3">
          <CrmDashboardSectionTitle>{lt("Financial overview")}</CrmDashboardSectionTitle>
          <CrmDashboardCard>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wide text-[rgba(255,255,255,0.35)]">
                    <th className="pb-2 pr-4 font-normal">{lt("Client")}</th>
                    <th className="pb-2 pr-4 font-normal">{lt("Invoices overdue")}</th>
                    <th className="pb-2 font-normal">{lt("Pending invoices")}</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioRows.map((row) => (
                    <tr
                      key={row.client.slug}
                      className="cursor-pointer border-b border-white/[0.04] transition hover:bg-white/[0.03]"
                      onClick={() => openClientFinancial(row.client.slug)}
                    >
                      <td className="py-2.5 pr-4 text-white">{row.client.name}</td>
                      <td className={cn("py-2.5 pr-4 tabular-nums", row.invoicesOverdue > 0 ? "text-amber-300" : "text-[rgba(255,255,255,0.65)]")}>
                        {row.invoicesOverdue}
                      </td>
                      <td className="py-2.5 tabular-nums text-[rgba(255,255,255,0.65)]">{row.invoicesPending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CrmDashboardCard>
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <CrmDashboardSectionTitle>{lt("Recent updates")}</CrmDashboardSectionTitle>
          <Link href="/updates" className="text-[11px] text-[#FF4500] hover:underline">
            {lt("View all updates")}
          </Link>
        </div>
        <CrmDashboardCard className="divide-y divide-white/[0.06] p-0">
          {loading && recentUpdates.length === 0 ? (
            <div className="space-y-3 p-5">
              <CrmDashboardSkeleton className="h-12" />
              <CrmDashboardSkeleton className="h-12" />
            </div>
          ) : recentUpdates.length === 0 ? (
            <p className="p-5 text-sm text-[rgba(255,255,255,0.45)]">{lt("No updates yet.")}</p>
          ) : (
            recentUpdates.map((update) => (
              <div key={update.id} className="flex flex-col gap-1 px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white">{update.clientName}</span>
                  <span className="text-[10px] text-[rgba(255,255,255,0.35)]">{update.category}</span>
                  <span className="text-[10px] text-[rgba(255,255,255,0.35)]">
                    {formatDisplayDate(update.createdAt.slice(0, 10))}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs text-[rgba(255,255,255,0.7)]">{update.content}</p>
                <p className="text-[10px] text-[rgba(255,255,255,0.35)]">{update.authorName}</p>
              </div>
            ))
          )}
        </CrmDashboardCard>
      </section>

      {!loading ? (
        <div className="flex justify-end">
          <button type="button" onClick={() => void reload()} className="text-xs text-[rgba(255,255,255,0.45)] hover:text-white">
            {lt("Reload")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function GlobalKpi({
  label,
  value,
  loading,
  warn,
  highlight,
}: {
  label: string;
  value: number;
  loading: boolean;
  warn?: boolean;
  highlight?: boolean;
}) {
  return (
    <CrmDashboardCard className="min-h-[88px] justify-center p-4">
      <p className="text-[10px] uppercase tracking-wide text-[rgba(255,255,255,0.35)]">{label}</p>
      {loading ? (
        <CrmDashboardSkeleton className="mt-2 h-7 w-12" />
      ) : (
        <p
          className={cn(
            "mt-1 text-2xl font-light tabular-nums",
            highlight ? "text-amber-300" : warn ? "text-red-300/90" : "text-white",
          )}
        >
          {value}
        </p>
      )}
    </CrmDashboardCard>
  );
}
