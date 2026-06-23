"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Briefcase, ChevronRight, LayoutDashboard } from "lucide-react";
import { ClientLogo } from "@/components/ui/client-logo";
import { useLanguage } from "@/context/language-context";
import type { ClientPortfolioRow } from "@/modules/agency-home/use-agency-home-data";
import { cn } from "@/lib/utils";

type Props = {
  row: ClientPortfolioRow;
  onSelectClient: (slug: string) => void;
};

export function AgencyHomeClientCard({ row, onSelectClient }: Props) {
  const router = useRouter();
  const { t: lt } = useLanguage();
  const { client, attentionScore } = row;
  const accent = client.primaryColor || "#FF4500";
  const needsAttention = attentionScore > 0;

  const openDashboard = () => {
    onSelectClient(client.slug);
    router.push("/dashboard");
  };

  const openProjects = () => {
    onSelectClient(client.slug);
    router.push("/projects");
  };

  const openCrm = () => {
    onSelectClient(client.slug);
    router.push("/crm/dashboard");
  };

  return (
    <div
      className={cn(
        "group flex w-full flex-col rounded-2xl border border-white/[0.08] bg-[#161616] p-4 text-left transition hover:border-white/[0.14] hover:bg-[#1a1a1a]",
        needsAttention && "ring-1 ring-amber-500/25",
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={openDashboard}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openDashboard();
          }
        }}
        className="cursor-pointer rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#FF4500]/40"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <ClientLogo client={client} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{client.name}</p>
              {needsAttention ? (
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-300/90">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {lt("Needs attention")}
                </p>
              ) : (
                <p className="mt-0.5 text-[11px] text-[rgba(255,255,255,0.4)]">{lt("On track")}</p>
              )}
            </div>
          </div>
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[rgba(255,255,255,0.25)] transition group-hover:text-[rgba(255,255,255,0.55)]" />
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <Metric label={lt("Active projects")} value={row.activeProjects} accent={accent} />
          <Metric label={lt("Overdue tasks")} value={row.overdueTasks} warn={row.overdueTasks > 0} />
          <Metric label={lt("Waiting on client")} value={row.waitingClientApproval} warn={row.waitingClientApproval > 0} />
          <Metric label={lt("Posts (30d)")} value={row.postsPublished30d} />
          <Metric label={lt("CRM open leads")} value={row.crmOpenLeads} />
          <Metric label={lt("Invoices overdue")} value={row.invoicesOverdue} warn={row.invoicesOverdue > 0} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
        <QuickLink icon={LayoutDashboard} label={lt("Dashboard")} onClick={openDashboard} />
        <QuickLink icon={Briefcase} label={lt("Projects")} onClick={openProjects} />
        <Link
          href="/crm/dashboard"
          onClick={(e) => {
            e.preventDefault();
            openCrm();
          }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-[rgba(255,255,255,0.45)] transition hover:bg-white/[0.06] hover:text-white"
        >
          CRM
        </Link>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: number;
  accent?: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-[rgba(255,255,255,0.35)]">{label}</p>
      <p
        className={cn("mt-0.5 text-sm font-medium tabular-nums", warn ? "text-amber-300" : "text-white")}
        style={!warn && accent ? { color: accent } : undefined}
      >
        {value}
      </p>
    </div>
  );
}

function QuickLink({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-[rgba(255,255,255,0.45)] transition hover:bg-white/[0.06] hover:text-white"
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}
