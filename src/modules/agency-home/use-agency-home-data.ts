"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  mergeProjectsByColumn,
  type KanbanColumnId,
  type ProjectsByColumn,
} from "@/app/(platform)/projects/data";
import {
  attentionReasonSeverity,
  classifyTaskAttention,
  countsAsOverdue,
  countsAsWaitingClient,
  isAttentionReason,
  isTaskComplete,
  type TaskAttentionReason,
} from "@/lib/task-attention";
import { normalizeLeadStatus } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";
import type { Client } from "@/types";

export type AttentionItem = {
  clientSlug: string;
  clientName: string;
  projectId: string;
  projectName: string;
  taskId: string;
  taskTitle: string;
  dueDate: string | null;
  reason: TaskAttentionReason;
  owner: string;
  severity: number;
};

export type ClientPortfolioRow = {
  client: Client;
  activeProjects: number;
  activeTasks: number;
  overdueTasks: number;
  waitingClientApproval: number;
  postsPublished30d: number;
  crmLeads: number;
  crmOpenLeads: number;
  crmWon: number;
  invoicesOverdue: number;
  invoicesPending: number;
  invoicesPendingAmount: number;
  lastUpdateAt: string | null;
  attentionScore: number;
};

export type RecentUpdateRow = {
  id: string;
  clientSlug: string;
  clientName: string;
  content: string;
  category: string;
  authorName: string;
  createdAt: string;
};

export type AgencyHomeGlobalKpis = {
  activeClients: number;
  overdueTasks: number;
  waitingClientApproval: number;
  postsPublished30d: number;
  invoicesOverdue: number;
  crmOpenLeads: number;
};

type CrmLeadRow = {
  client_slug: string | null;
  status: string | null;
};

type InvoiceRow = {
  client_slug: string | null;
  status: string | null;
  amount: number | null;
};

type PostRow = {
  client_slug: string | null;
  status: string | null;
  published_at: string | null;
};

type UpdateRow = {
  id: string;
  client_slug: string | null;
  content: string;
  category: string;
  author_name: string;
  created_at: string;
};

const ACTIVE_PROJECT_COLUMNS: KanbanColumnId[] = ["planning", "in_progress", "paused"];

function emptySlugCounts(): Record<string, number> {
  return {};
}

function inc(map: Record<string, number>, slug: string, by = 1) {
  map[slug] = (map[slug] ?? 0) + by;
}

function isClosedCrmStatus(status: string): boolean {
  const s = normalizeLeadStatus(status);
  return s === "Won" || s === "Lost" || s === "Disqualified";
}

function thirtyDaysAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

export function useAgencyHomeData(clients: Client[], projectsByColumn: ProjectsByColumn) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [crmBySlug, setCrmBySlug] = useState<Record<string, { total: number; open: number; won: number }>>({});
  const [invoicesBySlug, setInvoicesBySlug] = useState<
    Record<string, { overdue: number; pending: number; pendingAmount: number }>
  >({});
  const [posts30dBySlug, setPosts30dBySlug] = useState<Record<string, number>>({});
  const [lastUpdateBySlug, setLastUpdateBySlug] = useState<Record<string, string>>({});
  const [recentUpdates, setRecentUpdates] = useState<RecentUpdateRow[]>([]);

  const activeClients = useMemo(() => clients.filter((c) => c.active !== false), [clients]);

  const clientNameBySlug = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clients) m.set(c.slug, c.name);
    return m;
  }, [clients]);

  const { attentionItems, opsBySlug } = useMemo(() => {
    const items: AttentionItem[] = [];
    const ops: Record<
      string,
      {
        activeProjects: number;
        activeTasks: number;
        overdueTasks: number;
        waitingClientApproval: number;
        attentionScore: number;
      }
    > = {};

    for (const client of activeClients) {
      ops[client.slug] = {
        activeProjects: 0,
        activeTasks: 0,
        overdueTasks: 0,
        waitingClientApproval: 0,
        attentionScore: 0,
      };
    }

    const projects = mergeProjectsByColumn(projectsByColumn);
    for (const project of projects) {
      const slug = (project.clientSlug ?? "").trim() || "rocketride";
      if (!ops[slug]) continue;

      if (ACTIVE_PROJECT_COLUMNS.includes(project.column)) {
        ops[slug].activeProjects += 1;
      }

      for (const task of project.tasks) {
        if (isTaskComplete(task.status)) continue;

        ops[slug].activeTasks += 1;
        const reason = classifyTaskAttention(task);

        if (countsAsOverdue(reason)) ops[slug].overdueTasks += 1;
        if (countsAsWaitingClient(reason)) ops[slug].waitingClientApproval += 1;

        if (isAttentionReason(reason)) {
          const severity = attentionReasonSeverity(reason);
          ops[slug].attentionScore += severity;
          items.push({
            clientSlug: slug,
            clientName: clientNameBySlug.get(slug) ?? slug,
            projectId: project.id,
            projectName: project.name,
            taskId: task.id,
            taskTitle: task.name,
            dueDate: task.dueDate,
            reason,
            owner: task.owner,
            severity,
          });
        }
      }
    }

    items.sort((a, b) => b.severity - a.severity || (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

    return { attentionItems: items, opsBySlug: ops };
  }, [activeClients, clientNameBySlug, projectsByColumn]);

  const loadRemote = useCallback(async () => {
    setLoading(true);
    setError(null);
    const since = thirtyDaysAgoIso();

    try {
      const [leadsRes, invRes, postsRes, updatesRes] = await Promise.all([
        supabase.from("crm_leads").select("client_slug, status"),
        supabase.from("invoices").select("client_slug, status, amount"),
        supabase.from("scheduled_posts").select("client_slug, status, published_at"),
        supabase
          .from("client_updates")
          .select("id, client_slug, content, category, author_name, created_at")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (leadsRes.error) throw new Error(leadsRes.error.message);
      if (invRes.error) throw new Error(invRes.error.message);
      if (postsRes.error) throw new Error(postsRes.error.message);
      if (updatesRes.error) throw new Error(updatesRes.error.message);

      const crmMap: Record<string, { total: number; open: number; won: number }> = {};
      for (const row of (leadsRes.data ?? []) as CrmLeadRow[]) {
        const slug = (row.client_slug ?? "").trim() || "rocketride";
        if (!crmMap[slug]) crmMap[slug] = { total: 0, open: 0, won: 0 };
        crmMap[slug].total += 1;
        if (normalizeLeadStatus(row.status) === "Won") crmMap[slug].won += 1;
        if (!isClosedCrmStatus(row.status ?? "")) crmMap[slug].open += 1;
      }
      setCrmBySlug(crmMap);

      const invMap: Record<string, { overdue: number; pending: number; pendingAmount: number }> = {};
      for (const row of (invRes.data ?? []) as InvoiceRow[]) {
        const slug = (row.client_slug ?? "").trim() || "rocketride";
        if (!invMap[slug]) invMap[slug] = { overdue: 0, pending: 0, pendingAmount: 0 };
        const status = String(row.status ?? "").toLowerCase();
        const amount = Number(row.amount ?? 0);
        if (status === "overdue") invMap[slug].overdue += 1;
        if (status === "pending") {
          invMap[slug].pending += 1;
          invMap[slug].pendingAmount += amount;
        }
      }
      setInvoicesBySlug(invMap);

      const postsMap = emptySlugCounts();
      for (const row of (postsRes.data ?? []) as PostRow[]) {
        if (String(row.status ?? "").toLowerCase() !== "published") continue;
        const publishedAt = row.published_at ? new Date(row.published_at) : null;
        if (!publishedAt || Number.isNaN(publishedAt.getTime()) || publishedAt.toISOString() < since) continue;
        const slug = (row.client_slug ?? "").trim() || "rocketride";
        inc(postsMap, slug);
      }
      setPosts30dBySlug(postsMap);

      const updateLatest: Record<string, string> = {};
      const feed: RecentUpdateRow[] = [];
      for (const row of (updatesRes.data ?? []) as UpdateRow[]) {
        const slug = (row.client_slug ?? "").trim() || "rocketride";
        if (!updateLatest[slug] || row.created_at > updateLatest[slug]) {
          updateLatest[slug] = row.created_at;
        }
        if (feed.length < 10) {
          feed.push({
            id: row.id,
            clientSlug: slug,
            clientName: clientNameBySlug.get(slug) ?? slug,
            content: row.content,
            category: row.category,
            authorName: row.author_name,
            createdAt: row.created_at,
          });
        }
      }
      setLastUpdateBySlug(updateLatest);
      setRecentUpdates(feed);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load agency home data");
    } finally {
      setLoading(false);
    }
  }, [clientNameBySlug]);

  useEffect(() => {
    void loadRemote();
  }, [loadRemote]);

  const portfolioRows: ClientPortfolioRow[] = useMemo(() => {
    return activeClients
      .map((client) => {
        const ops = opsBySlug[client.slug] ?? {
          activeProjects: 0,
          activeTasks: 0,
          overdueTasks: 0,
          waitingClientApproval: 0,
          attentionScore: 0,
        };
        const crm = crmBySlug[client.slug] ?? { total: 0, open: 0, won: 0 };
        const inv = invoicesBySlug[client.slug] ?? { overdue: 0, pending: 0, pendingAmount: 0 };
        const posts = posts30dBySlug[client.slug] ?? 0;
        const lastUpdateAt = lastUpdateBySlug[client.slug] ?? null;

        let attentionScore = ops.attentionScore;
        attentionScore += inv.overdue * 15;
        attentionScore += crm.open > 0 && ops.overdueTasks > 0 ? 5 : 0;

        return {
          client,
          activeProjects: ops.activeProjects,
          activeTasks: ops.activeTasks,
          overdueTasks: ops.overdueTasks,
          waitingClientApproval: ops.waitingClientApproval,
          postsPublished30d: posts,
          crmLeads: crm.total,
          crmOpenLeads: crm.open,
          crmWon: crm.won,
          invoicesOverdue: inv.overdue,
          invoicesPending: inv.pending,
          invoicesPendingAmount: inv.pendingAmount,
          lastUpdateAt,
          attentionScore,
        };
      })
      .sort((a, b) => b.attentionScore - a.attentionScore || a.client.name.localeCompare(b.client.name));
  }, [activeClients, crmBySlug, invoicesBySlug, lastUpdateBySlug, opsBySlug, posts30dBySlug]);

  const globalKpis: AgencyHomeGlobalKpis = useMemo(() => {
    return {
      activeClients: activeClients.length,
      overdueTasks: portfolioRows.reduce((s, r) => s + r.overdueTasks, 0),
      waitingClientApproval: portfolioRows.reduce((s, r) => s + r.waitingClientApproval, 0),
      postsPublished30d: portfolioRows.reduce((s, r) => s + r.postsPublished30d, 0),
      invoicesOverdue: portfolioRows.reduce((s, r) => s + r.invoicesOverdue, 0),
      crmOpenLeads: portfolioRows.reduce((s, r) => s + r.crmOpenLeads, 0),
    };
  }, [activeClients.length, portfolioRows]);

  return {
    loading,
    error,
    portfolioRows,
    attentionItems,
    recentUpdates,
    globalKpis,
    reload: loadRemote,
  };
}
