"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { rowMatchesDataClient } from "@/lib/client-utils";
import {
  CRM_LEAD_SOURCE_LABELS,
  CRM_LEAD_STATUSES,
  formatLeadValue,
  isCrmAppointmentDone,
  mapCrmAppointmentRow,
  mapCrmLeadRow,
  normalizeLeadStatus,
  normalizeSource,
  type CrmAppointment,
  type CrmLead,
  type CrmLeadStatus,
} from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";

export type CrmChartRange = "7d" | "30d";

export type CrmHeroMetric = {
  value: string;
  label: string;
  wonCount: number;
  total: number;
  progressPct: number;
};

export type CrmCompactKpi = {
  id: string;
  label: string;
  value: string;
};

export type CrmTrendBar = {
  label: string;
  count: number;
  heightPct: number;
  dateKey: string;
};

export type CrmAppointmentWithLead = CrmAppointment & {
  leadName: string;
  leadCompany: string | null;
};

export type CrmActivityItem =
  | { type: "lead"; id: string; title: string; subtitle: string; at: string }
  | { type: "appointment"; id: string; title: string; subtitle: string; at: string };

function sourceCountMap(leads: CrmLead[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const label of CRM_LEAD_SOURCE_LABELS) m[label] = 0;
  for (const lead of leads) {
    const key = normalizeSource(lead.source);
    m[key] = (m[key] ?? 0) + 1;
  }
  return m;
}

function toDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function formatShortDay(date: Date, locale: string): string {
  return date.toLocaleDateString(locale === "pt-BR" ? "pt-BR" : "en-US", { weekday: "short" });
}

function formatShortDate(dateStr: string, locale: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(locale === "pt-BR" ? "pt-BR" : "en-US", {
    month: "short",
    day: "numeric",
  });
}

function leadInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function getLeadInitials(name: string): string {
  return leadInitials(name);
}

export function useCrmDashboardData(dataClientSlug: string | null, chartRange: CrmChartRange, locale: string) {
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [appointments, setAppointments] = useState<CrmAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [leadsRes, apptRes] = await Promise.all([
      supabase.from("crm_leads").select("*").order("created_at", { ascending: false }),
      supabase.from("crm_appointments").select("*").order("date", { ascending: true }),
    ]);

    if (leadsRes.error) {
      console.error("[crm dashboard]", leadsRes.error.message);
      setError(leadsRes.error.message);
      setLeads([]);
      setAppointments([]);
      setLoading(false);
      return;
    }

    const mappedLeads = ((leadsRes.data ?? []) as Record<string, unknown>[])
      .map((row) => mapCrmLeadRow(row))
      .filter((lead) => rowMatchesDataClient(lead.client_slug, dataClientSlug));

    const leadIds = new Set(mappedLeads.map((l) => l.id));
    const leadById = new Map(mappedLeads.map((l) => [l.id, l]));

    const mappedAppts =
      apptRes.error
        ? []
        : ((apptRes.data ?? []) as Record<string, unknown>[])
            .map((row) => mapCrmAppointmentRow(row))
            .filter((a) => leadIds.has(a.lead_id) && leadById.has(a.lead_id));

    if (apptRes.error) {
      console.error("[crm dashboard appointments]", apptRes.error.message);
    }

    setLeads(mappedLeads);
    setAppointments(mappedAppts);
    setLoading(false);
  }, [dataClientSlug]);

  useEffect(() => {
    void load();

    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    const poll = window.setInterval(() => void load(), 20_000);

    const leadsChannel = supabase
      .channel(`crm-leads-dashboard-${dataClientSlug ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_leads" }, () => {
        void load();
      })
      .subscribe();

    const apptChannel = supabase
      .channel(`crm-appts-dashboard-${dataClientSlug ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_appointments" }, () => {
        void load();
      })
      .subscribe();

    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(poll);
      void supabase.removeChannel(leadsChannel);
      void supabase.removeChannel(apptChannel);
    };
  }, [load, dataClientSlug]);

  const leadById = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);

  const total = leads.length;
  const wonCount = leads.filter((l) => normalizeLeadStatus(l.status) === "Won").length;
  const conversionPct = total === 0 ? 0 : Math.round((wonCount / total) * 1000) / 10;
  const totalSalesValue = leads
    .filter((l) => normalizeLeadStatus(l.status) === "Won")
    .reduce((a, l) => a + l.value, 0);
  const openProposalLeads = leads.filter((l) => normalizeLeadStatus(l.status) === "Proposal Sent");
  const openProposalsCount = openProposalLeads.length;
  const openProposalsValue = openProposalLeads.reduce((a, l) => a + l.value, 0);

  const heroMetric = useMemo((): CrmHeroMetric => {
    return {
      value: `${conversionPct}%`,
      label: "Conversion Rate",
      wonCount,
      total,
      progressPct: Math.min(100, conversionPct),
    };
  }, [conversionPct, wonCount, total]);

  const compactKpis = useMemo(
    (): CrmCompactKpi[] => [
      { id: "totalLeads", label: "Total Leads", value: String(total) },
      { id: "closedSales", label: "Closed Sales", value: String(wonCount) },
      { id: "totalSalesValue", label: "Total Sales Value", value: formatLeadValue(totalSalesValue) },
      { id: "openProposals", label: "Open Proposals", value: String(openProposalsCount) },
    ],
    [total, wonCount, totalSalesValue, openProposalsCount],
  );

  const trendBars = useMemo((): CrmTrendBar[] => {
    const days = chartRange === "7d" ? 7 : 30;
    const end = new Date();
    end.setHours(12, 0, 0, 0);
    const buckets: { dateKey: string; label: string; count: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = addDays(end, -i);
      const dateKey = d.toISOString().slice(0, 10);
      buckets.push({
        dateKey,
        label: chartRange === "7d" ? formatShortDay(d, locale) : String(d.getDate()),
        count: 0,
      });
    }

    for (const lead of leads) {
      const key = toDateKey(lead.created_at);
      const bucket = buckets.find((b) => b.dateKey === key);
      if (bucket) bucket.count += 1;
    }

    const max = Math.max(1, ...buckets.map((b) => b.count));
    return buckets.map((b) => ({
      ...b,
      heightPct: Math.max(8, Math.round((b.count / max) * 100)),
    }));
  }, [leads, chartRange, locale]);

  const priorityLeads = useMemo(() => {
    return [...leads]
      .sort((a, b) => {
        if (b.value !== a.value) return b.value - a.value;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      })
      .slice(0, 5);
  }, [leads]);

  const appointmentsWithLead = useMemo((): CrmAppointmentWithLead[] => {
    return appointments
      .map((a) => {
        const lead = leadById.get(a.lead_id);
        if (!lead) return null;
        return {
          ...a,
          leadName: lead.name,
          leadCompany: lead.company,
        };
      })
      .filter((a): a is CrmAppointmentWithLead => a != null);
  }, [appointments, leadById]);

  const today = todayKey();

  const upcomingAppointments = useMemo(() => {
    return appointmentsWithLead
      .filter((a) => !isCrmAppointmentDone(a) && a.date != null && a.date >= today)
      .sort((a, b) => {
        const da = `${a.date ?? ""}T${a.time ?? "00:00"}`;
        const db = `${b.date ?? ""}T${b.time ?? "00:00"}`;
        return da.localeCompare(db);
      })
      .slice(0, 6);
  }, [appointmentsWithLead, today]);

  const todayAppointments = useMemo(() => {
    return appointmentsWithLead
      .filter((a) => !isCrmAppointmentDone(a) && a.date === today)
      .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  }, [appointmentsWithLead, today]);

  const recentActivity = useMemo((): CrmActivityItem[] => {
    const leadItems: CrmActivityItem[] = leads.map((l) => ({
      type: "lead",
      id: l.id,
      title: l.name,
      subtitle: l.company ?? l.owner ?? "—",
      at: l.updated_at || l.created_at,
    }));

    const apptItems: CrmActivityItem[] = appointmentsWithLead.map((a) => ({
      type: "appointment",
      id: a.id,
      title: a.title,
      subtitle: a.leadName,
      at: a.created_at,
    }));

    return [...leadItems, ...apptItems]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 8);
  }, [leads, appointmentsWithLead]);

  const latestActivity = recentActivity[0] ?? null;

  const sourceMap = useMemo(() => sourceCountMap(leads), [leads]);
  const sourceTotal = leads.length || 1;

  const pipelineRows = useMemo(() => {
    return CRM_LEAD_STATUSES.map((stage) => {
      const inStage = leads.filter((l) => normalizeLeadStatus(l.status) === stage);
      return {
        stage: stage as CrmLeadStatus,
        count: inStage.length,
        valueSum: inStage.reduce((a, l) => a + l.value, 0),
      };
    });
  }, [leads]);

  const upcomingDateSlots = useMemo(() => {
    const slots: { dateKey: string; label: string; count: number; isToday: boolean; isNext: boolean }[] = [];
    const seen = new Set<string>();
    let nextMarked = false;

    for (const a of upcomingAppointments) {
      if (!a.date || seen.has(a.date)) continue;
      seen.add(a.date);
      slots.push({
        dateKey: a.date,
        label: formatShortDate(a.date, locale),
        count: upcomingAppointments.filter((x) => x.date === a.date).length,
        isToday: a.date === today,
        isNext: false,
      });
      if (slots.length >= 6) break;
    }

    const firstFuture = slots.find((s) => s.dateKey >= today && !s.isToday);
    if (firstFuture) firstFuture.isNext = true;
    if (slots.length === 0 && !nextMarked) {
      for (let i = 0; i < 6; i++) {
        const d = addDays(new Date(), i);
        const dateKey = d.toISOString().slice(0, 10);
        slots.push({
          dateKey,
          label: formatShortDate(dateKey, locale),
          count: 0,
          isToday: dateKey === today,
          isNext: i === 1,
        });
      }
    }

    return slots.slice(0, 6);
  }, [upcomingAppointments, today, locale]);

  return {
    leads,
    loading,
    error,
    total,
    conversionPct,
    wonCount,
    openProposalsValue,
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
    reload: load,
  };
}
