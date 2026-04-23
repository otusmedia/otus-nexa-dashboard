"use client";

import { useEffect, useMemo, useState } from "react";
import { ModuleGuard } from "@/components/layout/module-guard";
import { useAppContext } from "@/components/providers/app-providers";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { useLanguage } from "@/context/language-context";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import { MarketingAccessGuard } from "../_components/marketing-access-guard";

type StrategyRow = { id: string; content: string; updated_by: string | null; updated_at: string };
type CampaignRow = Record<string, unknown>;
type TaskRow = Record<string, unknown>;

function campaignOverviewProgressFromTasks(campaignId: string, allTasks: TaskRow[]): number {
  const list = allTasks.filter((t) => String(t.project_id ?? "") === campaignId);
  if (list.length === 0) return 0;
  const completed = list.filter((t) => {
    const st = String(t.status ?? "");
    return st === "Done" || st === "Published";
  }).length;
  return Math.round((completed / list.length) * 100);
}

function campaignsOverviewStatusStyle(status: string): { backgroundColor: string; color: string } {
  const s = status.trim().toLowerCase();
  if (s === "planning") return { backgroundColor: "rgba(59,130,246,0.2)", color: "#3b82f6" };
  if (s === "in progress") return { backgroundColor: "rgba(255,69,0,0.2)", color: "#FF4500" };
  if (s === "paused") return { backgroundColor: "rgba(139,92,246,0.2)", color: "#8b5cf6" };
  if (s === "done") return { backgroundColor: "rgba(34,197,94,0.2)", color: "#22c55e" };
  if (s === "cancelled") return { backgroundColor: "rgba(239,68,68,0.2)", color: "#ef4444" };
  return { backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" };
}

export default function MarketingStrategyPage() {
  const { t, currentUser } = useAppContext();
  const { t: lt } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Array<Record<string, unknown>>>([]);
  const [tasks, setTasks] = useState<Array<Record<string, unknown>>>([]);
  const [expandedCampaigns, setExpandedCampaigns] = useState<string[]>([]);
  const [strategy, setStrategy] = useState<StrategyRow | null>(null);
  const [draftStrategy, setDraftStrategy] = useState("");

  useEffect(() => {
    let mounted = true;
    console.log("[marketing/strategy] fetch start: marketing_projects + marketing_tasks + marketing_strategy");
    void Promise.all([
      supabase.from("marketing_projects").select("*"),
      supabase.from("marketing_tasks").select("id, project_id, status, title"),
      supabase.from("marketing_strategy").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ])
      .then(([projectsRes, tasksRes, strategyRes]) => {
        if (!mounted) return;
        console.log("[marketing/strategy] fetch result:", {
          projectsError: projectsRes.error?.message ?? null,
          tasksError: tasksRes.error?.message ?? null,
          strategyError: strategyRes.error?.message ?? null,
          projectsCount: projectsRes.data?.length ?? 0,
          tasksCount: tasksRes.data?.length ?? 0,
        });
        if (projectsRes.error) console.error("[supabase] marketing_projects fetch failed:", projectsRes.error.message);
        if (tasksRes.error) console.error("[supabase] marketing_tasks fetch failed:", tasksRes.error.message);
        if (strategyRes.error) console.error("[supabase] marketing_strategy fetch failed:", strategyRes.error.message);
        setProjects((projectsRes.data as Array<Record<string, unknown>> | null) ?? []);
        setTasks((tasksRes.data as Array<Record<string, unknown>> | null) ?? []);
        const row = (strategyRes.data as StrategyRow | null) ?? null;
        setStrategy(row);
        setDraftStrategy(row?.content ?? "");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const byMonth = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }).map((_, index) => {
      const dt = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
      const label = dt.toLocaleDateString("en-US", { month: "short" });
      const value = projects
        .filter((p) => String(p.created_at ?? "").slice(0, 7) === key)
        .reduce((acc, p) => acc + (Number(p.budget_used ?? 0) || 0), 0);
      return { label, value };
    });
  }, [projects]);

  const maxMonth = Math.max(...byMonth.map((m) => m.value), 1);
  const activeCampaigns = projects.filter((p) => String(p.status ?? "").toLowerCase() === "in progress").length;
  const totalBudget = projects.reduce((acc, p) => acc + (Number(p.budget ?? 0) || 0), 0);
  const usedBudget = projects.reduce((acc, p) => acc + (Number(p.budget_used ?? 0) || 0), 0);
  const usedPct = totalBudget > 0 ? Math.round((usedBudget / totalBudget) * 100) : 0;
  const results = projects.reduce((acc, p) => acc + (Number(p.results ?? 0) || 0), 0);

  const breakdown = useMemo(() => {
    const categories = ["Paid Search", "Paid Social", "Display", "Content", "Offline", "Other"];
    const total = Math.max(totalBudget, 1);
    return categories.map((name) => {
      const sum = projects
        .filter((p) => String(p.type ?? "") === name)
        .reduce((acc, p) => acc + (Number(p.budget ?? 0) || 0), 0);
      return { name, budget: sum, pct: Math.round((sum / total) * 100) };
    });
  }, [projects, totalBudget]);

  const campaigns = projects as CampaignRow[];
  const campaignTasks = tasks as TaskRow[];

  const tasksByCampaign = useMemo(() => {
    return campaigns.reduce<Record<string, TaskRow[]>>((acc, campaign) => {
      const id = String(campaign.id ?? "");
      acc[id] = campaignTasks.filter((task) => String(task.project_id ?? "") === id);
      return acc;
    }, {});
  }, [campaigns, campaignTasks]);

  const overviewProgressByCampaignId = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of campaigns) {
      const id = String(c.id ?? "");
      m[id] = campaignOverviewProgressFromTasks(id, campaignTasks);
    }
    return m;
  }, [campaigns, campaignTasks]);

  const toggleCampaign = (id: string) => {
    setExpandedCampaigns((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const saveStrategy = () => {
    const content = draftStrategy.trim();
    if (strategy?.id) {
      void supabase
        .from("marketing_strategy")
        .update({ content, updated_by: currentUser.name, updated_at: new Date().toISOString() })
        .eq("id", strategy.id)
        .then(({ error }) => {
          if (error) console.error("[supabase] marketing_strategy update failed:", error.message);
          else {
            setStrategy((prev) =>
              prev
                ? { ...prev, content, updated_by: currentUser.name, updated_at: new Date().toISOString() }
                : prev,
            );
          }
        });
      return;
    }
    const id = crypto.randomUUID();
    const updatedAt = new Date().toISOString();
    void supabase
      .from("marketing_strategy")
      .insert({ id, content, updated_by: currentUser.name, updated_at: updatedAt })
      .then(({ error }) => {
        if (error) console.error("[supabase] marketing_strategy insert failed:", error.message);
        else setStrategy({ id, content, updated_by: currentUser.name, updated_at: updatedAt });
      });
  };

  return (
    <ModuleGuard module="marketing">
      <MarketingAccessGuard>
        <PageHeader title={t("marketing")} subtitle={lt("Campaign KPIs, budget allocation and strategic guidance.")} />

        <div className="grid gap-3 xl:grid-cols-4">
          <Card><p className="kpi-label">{lt("Active Campaigns")}</p><p className="metric-value mt-2">{activeCampaigns}</p></Card>
          <Card><p className="kpi-label">{lt("Total Budget")}</p><p className="metric-value mt-2">{formatCurrency(totalBudget)}</p></Card>
          <Card>
            <p className="kpi-label">{lt("Budget Used")}</p>
            <p className="metric-value mt-2">{usedPct}%</p>
            <div className="mt-3 h-[2px] rounded-[2px] bg-[rgba(255,255,255,0.08)]">
              <div className="h-[2px] rounded-[2px] bg-[#ff4500]" style={{ width: `${Math.min(100, usedPct)}%` }} />
            </div>
          </Card>
          <Card><p className="kpi-label">{lt("Results (Leads/Conversions)")}</p><p className="metric-value mt-2">{results}</p></Card>
        </div>

        <div className="mt-6 grid gap-3 xl:grid-cols-2">
          <Card>
            <h2 className="section-title">{lt("Monthly budget spend")}</h2>
            <div className="mt-4 flex h-64 items-end gap-2 border-b border-[var(--border)] pb-3">
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex h-full flex-1 flex-col justify-end">
                      <div className="w-full animate-pulse rounded-sm bg-[rgba(255,69,0,0.25)]" style={{ height: `${25 + i * 8}%` }} />
                    </div>
                  ))
                : byMonth.map((m) => (
                    <div key={m.label} className="group flex h-full flex-1 flex-col justify-end">
                      <div className="w-full rounded-sm bg-[#ff4500]" style={{ height: `${Math.max(5, (m.value / maxMonth) * 100)}%` }} />
                      <p className="mt-2 text-center text-[0.7rem] text-[var(--muted)]">{m.label}</p>
                    </div>
                  ))}
            </div>
          </Card>
          <Card>
            <h2 className="section-title">{lt("Budget breakdown")}</h2>
            <div className="mt-4 overflow-hidden rounded-lg border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">
                    <th className="px-3 py-2">{lt("Type")}</th>
                    <th className="px-3 py-2">{lt("Budget")}</th>
                    <th className="px-3 py-2">{lt("% of total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((row) => (
                    <tr key={row.name} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="px-3 py-2">{row.name}</td>
                      <td className="px-3 py-2 mono-num">{formatCurrency(row.budget)}</td>
                      <td className="px-3 py-2 mono-num">{row.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <Card className="mt-6">
          <h2 className="section-title">{lt("CURRENT STRATEGY")}</h2>
          <textarea
            value={draftStrategy}
            onChange={(e) => setDraftStrategy(e.target.value)}
            onBlur={saveStrategy}
            placeholder={lt("Describe the current marketing strategy, budget allocation rationale and key objectives...")}
            rows={8}
            className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
          />
          <div className="mt-3 flex items-center justify-between text-xs text-[var(--muted)]">
            <p>
              {lt("Last updated")}:{" "}
              <span className="mono-num">
                {strategy?.updated_at ? new Date(strategy.updated_at).toLocaleString() : "—"}
              </span>{" "}
              {lt("by")} {strategy?.updated_by ?? "—"}
            </p>
            <button type="button" onClick={saveStrategy} className="btn-primary rounded-lg px-3 py-1.5 text-xs">
              {lt("Save")}
            </button>
          </div>
        </Card>

        <Card className="mt-6">
          <h2 className="section-title">{lt("Campaigns Overview")}</h2>
          <div className="mt-3 overflow-hidden rounded-lg border border-[var(--border)]">
            {campaigns.length === 0 ? (
              <div className="px-4 py-6 text-sm text-[var(--muted)]">{lt("No campaigns yet.")}</div>
            ) : (
              campaigns.map((campaign) => {
                const id = String(campaign.id ?? "");
                const isExpanded = expandedCampaigns.includes(id);
                const status = String(campaign.status ?? "Planning");
                const start = String(campaign.campaign_period_start ?? campaign.start_date ?? "—");
                const end = String(campaign.campaign_period_end ?? campaign.end_date ?? "—");
                const progress = overviewProgressByCampaignId[id] ?? 0;
                const spend = Number(campaign.budget_used ?? 0) || 0;
                const impressions = Number(campaign.impressions ?? 0) || 0;
                const campaignResults = Number(campaign.results ?? 0) || 0;
                return (
                  <div key={id} className="border-b border-[var(--border)] last:border-b-0">
                    <button
                      type="button"
                      onClick={() => toggleCampaign(id)}
                      className="w-full px-4 py-3 text-left hover:bg-[var(--surface-elevated)]"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm text-white">{String(campaign.name ?? "")}</p>
                        <span
                          className="rounded-full px-2 py-0.5 text-[0.65rem] font-medium"
                          style={campaignsOverviewStatusStyle(status)}
                        >
                          {status}
                        </span>
                        <div className="min-w-[140px] flex-1">
                          <div className="h-[2px] rounded-[2px] bg-[rgba(255,255,255,0.08)]">
                            <div className="h-[2px] rounded-[2px] bg-[#ff4500]" style={{ width: `${Math.min(100, progress)}%` }} />
                          </div>
                        </div>
                        <span className="mono-num shrink-0 text-xs text-[var(--muted)]">{progress}%</span>
                        <span className="mono-num text-xs text-[var(--muted)]">{start} — {end}</span>
                        <span className="mono-num text-xs text-[var(--muted)]">{lt("Spend")}: {formatCurrency(spend)}</span>
                        <span className="mono-num text-xs text-[var(--muted)]">{lt("Impressions")}: {impressions.toLocaleString("en-US")}</span>
                        <span className="mono-num text-xs text-[var(--muted)]">{lt("Results")}: {campaignResults.toLocaleString("en-US")}</span>
                      </div>
                    </button>
                    {isExpanded ? (
                      <div className="border-t border-[var(--border)] px-4 py-2">
                        {tasksByCampaign[id]?.length ? (
                          <div className="space-y-1">
                            {tasksByCampaign[id].map((task) => (
                              <div key={String(task.id ?? "")} className="flex items-center justify-between rounded border border-[var(--border)] px-2 py-1 text-xs">
                                <span>{String(task.title ?? "")}</span>
                                <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[0.65rem] text-[var(--muted)]">
                                  {String(task.status ?? "Not Started")}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-[var(--muted)]">{lt("No tasks for this campaign.")}</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </MarketingAccessGuard>
    </ModuleGuard>
  );
}
