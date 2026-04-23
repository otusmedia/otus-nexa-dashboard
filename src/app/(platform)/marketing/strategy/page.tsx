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
type BudgetTypeKey = "paid_search" | "paid_social" | "display" | "content" | "offline" | "other";
type MarketingBudgetRow = {
  id: string;
  total_budget: number;
  paid_search: number;
  paid_social: number;
  display: number;
  content: number;
  offline: number;
  other: number;
  updated_by: string | null;
  updated_at: string | null;
};

const BUDGET_TYPE_ROWS: Array<{ key: BudgetTypeKey; label: string; campaignType: string }> = [
  { key: "paid_search", label: "Paid Search", campaignType: "Paid Search" },
  { key: "paid_social", label: "Paid Social", campaignType: "Paid Social" },
  { key: "display", label: "Display", campaignType: "Display" },
  { key: "content", label: "Content", campaignType: "Content" },
  { key: "offline", label: "Offline", campaignType: "Offline" },
  { key: "other", label: "Other", campaignType: "Other" },
];

const EMPTY_MARKETING_BUDGET: MarketingBudgetRow = {
  id: "",
  total_budget: 0,
  paid_search: 0,
  paid_social: 0,
  display: 0,
  content: 0,
  offline: 0,
  other: 0,
  updated_by: null,
  updated_at: null,
};

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
  const [budgetSettings, setBudgetSettings] = useState<MarketingBudgetRow>(EMPTY_MARKETING_BUDGET);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetSaveError, setBudgetSaveError] = useState("");

  useEffect(() => {
    let mounted = true;
    console.log("[marketing/strategy] fetch start: marketing_projects + marketing_tasks + marketing_strategy + marketing_budget");
    void Promise.all([
      supabase.from("marketing_projects").select("*"),
      supabase.from("marketing_tasks").select("id, project_id, status, title"),
      supabase.from("marketing_strategy").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("marketing_budget").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    ])
      .then(([projectsRes, tasksRes, strategyRes, budgetRes]) => {
        if (!mounted) return;
        console.log("[marketing/strategy] fetch result:", {
          projectsError: projectsRes.error?.message ?? null,
          tasksError: tasksRes.error?.message ?? null,
          strategyError: strategyRes.error?.message ?? null,
          budgetError: budgetRes.error?.message ?? null,
          projectsCount: projectsRes.data?.length ?? 0,
          tasksCount: tasksRes.data?.length ?? 0,
        });
        if (projectsRes.error) console.error("[supabase] marketing_projects fetch failed:", projectsRes.error.message);
        if (tasksRes.error) console.error("[supabase] marketing_tasks fetch failed:", tasksRes.error.message);
        if (strategyRes.error) console.error("[supabase] marketing_strategy fetch failed:", strategyRes.error.message);
        if (budgetRes.error) console.error("[supabase] marketing_budget fetch failed:", budgetRes.error.message);
        setProjects((projectsRes.data as Array<Record<string, unknown>> | null) ?? []);
        setTasks((tasksRes.data as Array<Record<string, unknown>> | null) ?? []);
        const row = (strategyRes.data as StrategyRow | null) ?? null;
        setStrategy(row);
        setDraftStrategy(row?.content ?? "");
        const budgetRow = (budgetRes.data as Record<string, unknown> | null) ?? null;
        if (budgetRow) {
          setBudgetSettings({
            id: String(budgetRow.id ?? ""),
            total_budget: Number(budgetRow.total_budget ?? 0) || 0,
            paid_search: Number(budgetRow.paid_search ?? 0) || 0,
            paid_social: Number(budgetRow.paid_social ?? 0) || 0,
            display: Number(budgetRow.display ?? 0) || 0,
            content: Number(budgetRow.content ?? 0) || 0,
            offline: Number(budgetRow.offline ?? 0) || 0,
            other: Number(budgetRow.other ?? 0) || 0,
            updated_by: budgetRow.updated_by ? String(budgetRow.updated_by) : null,
            updated_at: budgetRow.updated_at ? String(budgetRow.updated_at) : null,
          });
        }
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
  const totalBudget = Number(budgetSettings.total_budget ?? 0) || 0;
  const usedBudget = projects.reduce((acc, p) => acc + (Number(p.budget_used ?? 0) || 0), 0);
  const usedPct = totalBudget > 0 ? Math.round((usedBudget / totalBudget) * 100) : 0;
  const results = projects.reduce((acc, p) => acc + (Number(p.results ?? 0) || 0), 0);
  const spendByType = useMemo(() => {
    const map: Record<BudgetTypeKey, number> = {
      paid_search: 0,
      paid_social: 0,
      display: 0,
      content: 0,
      offline: 0,
      other: 0,
    };
    for (const row of BUDGET_TYPE_ROWS) {
      map[row.key] = projects
        .filter((p) => String(p.type ?? "").trim().toLowerCase() === row.campaignType.toLowerCase())
        .reduce((acc, p) => acc + (Number(p.budget_used ?? 0) || 0), 0);
    }
    return map;
  }, [projects]);
  const hasTypeBudgetOverrun = BUDGET_TYPE_ROWS.some((row) => {
    const allocated = Number(budgetSettings[row.key] ?? 0) || 0;
    return allocated > 0 && spendByType[row.key] > allocated;
  });
  const totalBudgetWarning = usedPct > 80 && usedPct <= 100;
  const totalBudgetOverrun = usedPct > 100;
  const breakdown = useMemo(() => {
    const total = Math.max(totalBudget, 1);
    return BUDGET_TYPE_ROWS.map((row) => {
      const allocated = Number(budgetSettings[row.key] ?? 0) || 0;
      return { name: row.label, budget: allocated, pct: Math.round((allocated / total) * 100) };
    });
  }, [budgetSettings, totalBudget]);

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

  const saveBudgetSettings = async () => {
    setBudgetSaveError("");
    setBudgetSaving(true);
    const payload = {
      id: budgetSettings.id || crypto.randomUUID(),
      total_budget: Number(budgetSettings.total_budget ?? 0) || 0,
      paid_search: Number(budgetSettings.paid_search ?? 0) || 0,
      paid_social: Number(budgetSettings.paid_social ?? 0) || 0,
      display: Number(budgetSettings.display ?? 0) || 0,
      content: Number(budgetSettings.content ?? 0) || 0,
      offline: Number(budgetSettings.offline ?? 0) || 0,
      other: Number(budgetSettings.other ?? 0) || 0,
      updated_by: currentUser.name,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("marketing_budget").upsert(payload, { onConflict: "id" }).select("*").single();
    if (error) {
      console.error("[supabase] marketing_budget upsert failed:", error.message);
      setBudgetSaveError("Failed to save budget settings.");
      setBudgetSaving(false);
      return;
    }
    const row = (data as Record<string, unknown>) ?? {};
    setBudgetSettings({
      id: String(row.id ?? payload.id),
      total_budget: Number(row.total_budget ?? 0) || 0,
      paid_search: Number(row.paid_search ?? 0) || 0,
      paid_social: Number(row.paid_social ?? 0) || 0,
      display: Number(row.display ?? 0) || 0,
      content: Number(row.content ?? 0) || 0,
      offline: Number(row.offline ?? 0) || 0,
      other: Number(row.other ?? 0) || 0,
      updated_by: row.updated_by ? String(row.updated_by) : payload.updated_by ?? null,
      updated_at: row.updated_at ? String(row.updated_at) : payload.updated_at,
    });
    setBudgetSaving(false);
  };

  return (
    <ModuleGuard module="marketing">
      <MarketingAccessGuard>
        <PageHeader title={t("marketing")} subtitle={lt("Campaign KPIs, budget allocation and strategic guidance.")} />

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title">{lt("BUDGET OVERVIEW")}</h2>
            <button
              type="button"
              onClick={() => void saveBudgetSettings()}
              disabled={budgetSaving}
              className="btn-primary rounded-lg px-3 py-1.5 text-xs disabled:opacity-60"
            >
              {budgetSaving ? lt("Saving...") : lt("Set Budget")}
            </button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="text-xs text-[var(--muted)]">
              {lt("Total Budget")}
              <input
                type="number"
                min={0}
                value={budgetSettings.total_budget}
                onChange={(e) =>
                  setBudgetSettings((prev) => ({ ...prev, total_budget: Math.max(0, Number(e.target.value) || 0) }))
                }
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="md:col-span-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-xs text-[var(--muted)]">
              <p className="mono-num">{lt("Used")}: {formatCurrency(usedBudget)}</p>
              <p className="mono-num">{lt("Remaining")}: {formatCurrency(Math.max(0, totalBudget - usedBudget))}</p>
              {budgetSettings.updated_at ? (
                <p className="mt-1">
                  {lt("Last budget update")}: <span className="mono-num">{new Date(budgetSettings.updated_at).toLocaleString()}</span> {lt("by")} {budgetSettings.updated_by ?? "—"}
                </p>
              ) : null}
            </div>
          </div>
          {budgetSaveError ? <p className="mt-2 text-xs text-[#ef4444]">{lt(budgetSaveError)}</p> : null}
          <div className="mt-4 overflow-hidden rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">
                  <th className="px-3 py-2">{lt("Type")}</th>
                  <th className="px-3 py-2">{lt("Allocated")}</th>
                  <th className="px-3 py-2">{lt("Spent")}</th>
                  <th className="px-3 py-2">{lt("Progress")}</th>
                </tr>
              </thead>
              <tbody>
                {BUDGET_TYPE_ROWS.map((row) => {
                  const allocated = Number(budgetSettings[row.key] ?? 0) || 0;
                  const spent = spendByType[row.key];
                  const pct = allocated > 0 ? Math.round((spent / allocated) * 100) : 0;
                  const warn = allocated > 0 && spent >= allocated * 0.8 && spent <= allocated;
                  const alert = allocated > 0 && spent > allocated;
                  return (
                    <tr key={row.key} className="border-b border-[var(--border)] last:border-b-0">
                      <td className="px-3 py-2">{lt(row.label)}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          value={allocated}
                          onChange={(e) =>
                            setBudgetSettings((prev) => ({
                              ...prev,
                              [row.key]: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="mono-num w-32 rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-xs text-white"
                        />
                      </td>
                      <td className="px-3 py-2 mono-num">{formatCurrency(spent)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-[6px] min-w-[120px] flex-1 rounded bg-[rgba(255,255,255,0.1)]">
                            <div
                              className={`h-[6px] rounded ${alert ? "bg-[#ef4444]" : warn ? "bg-[#f59e0b]" : "bg-[#ff4500]"}`}
                              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                            />
                          </div>
                          <span className={`mono-num text-xs ${alert ? "text-[#ef4444]" : warn ? "text-[#f59e0b]" : "text-[var(--muted)]"}`}>
                            {pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid gap-3 xl:grid-cols-4">
          <Card><p className="kpi-label">{lt("Active Campaigns")}</p><p className="metric-value mt-2">{activeCampaigns}</p></Card>
          <Card><p className="kpi-label">{lt("Total Budget")}</p><p className="metric-value mt-2">{formatCurrency(totalBudget)}</p></Card>
          <Card>
            <div className="flex items-center justify-between gap-2">
              <p className="kpi-label">{lt("Budget Used")}</p>
              {hasTypeBudgetOverrun ? (
                <span className="rounded-full bg-[rgba(239,68,68,0.2)] px-2 py-0.5 text-[0.65rem] text-[#ef4444]">{lt("Over budget")}</span>
              ) : totalBudgetOverrun ? (
                <span className="rounded-full bg-[rgba(239,68,68,0.2)] px-2 py-0.5 text-[0.65rem] text-[#ef4444]">{lt("Exceeded")}</span>
              ) : totalBudgetWarning ? (
                <span className="rounded-full bg-[rgba(245,158,11,0.2)] px-2 py-0.5 text-[0.65rem] text-[#f59e0b]">{lt("Warning")}</span>
              ) : null}
            </div>
            <p className="metric-value mt-2">{usedPct}%</p>
            <div className="mt-3 h-[2px] rounded-[2px] bg-[rgba(255,255,255,0.08)]">
              <div
                className={`h-[2px] rounded-[2px] ${hasTypeBudgetOverrun || totalBudgetOverrun ? "bg-[#ef4444]" : totalBudgetWarning ? "bg-[#f59e0b]" : "bg-[#ff4500]"}`}
                style={{ width: `${Math.min(100, usedPct)}%` }}
              />
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
