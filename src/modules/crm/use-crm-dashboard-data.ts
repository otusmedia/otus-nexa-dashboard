"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { filterCrmLeadsForUser } from "@/lib/crm-lead-visibility";
import {
  CRM_LEAD_STATUSES,
  formatLeadValue,
  getCrmLeadSourceLabels,
  isCrmAppointmentDone,
  isCrmDashboardLead,
  leadClosedValue,
  leadProposalValue,
  leadStageValueSum,
  mapCrmActivityLogRow,
  mapCrmAppointmentRow,
  mapCrmLeadRow,
  normalizeLeadStatus,
  normalizeServiceProduct,
  normalizeSource,
  type CrmAppointment,
  type CrmLead,
  type CrmLeadStatus,
} from "@/lib/crm-data";
import { rowMatchesDataClient } from "@/lib/client-utils";
import { supabase } from "@/lib/supabase";
import type { AppUser } from "@/types";

export type CrmChartRange = "7d" | "30d" | "90d" | "custom";

export type CrmCustomDateRange = {
  startYmd: string;
  endYmd: string;
};

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
  | { type: "appointment"; id: string; title: string; subtitle: string; at: string }
  | { type: "completion"; id: string; title: string; subtitle: string; at: string };

function sourceCountMap(leads: CrmLead[], dataClientSlug: string | null): Record<string, number> {
  const m: Record<string, number> = {};
  for (const label of getCrmLeadSourceLabels(dataClientSlug)) m[label] = 0;
  for (const lead of leads) {
    const key = normalizeSource(lead.source, dataClientSlug);
    m[key] = (m[key] ?? 0) + 1;
  }
  return m;
}

function serviceProductCountMap(leads: CrmLead[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const lead of leads) {
    const key = normalizeServiceProduct(lead.service_product);
    if (!key) continue;
    m[key] = (m[key] ?? 0) + 1;
  }
  return m;
}

function toDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localTodayKey(): string {
  return localDateKeyFromDate(new Date());
}

function addDaysLocal(base: Date, days: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

function localDateKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmdLocal(ymd: string): Date | null {
  const [y, m, d] = ymd.split("-").map(Number);
  if (![y, m, d].every((n) => Number.isFinite(n))) return null;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function resolvePeriodBounds(
  chartRange: CrmChartRange,
  customRange: CrmCustomDateRange | null,
): { startYmd: string; endYmd: string } {
  const end = new Date();
  end.setHours(12, 0, 0, 0);
  if (chartRange === "custom" && customRange?.startYmd && customRange?.endYmd) {
    return { startYmd: customRange.startYmd, endYmd: customRange.endYmd };
  }
  const days = chartRange === "90d" ? 90 : chartRange === "30d" ? 30 : 7;
  const start = addDaysLocal(end, -(days - 1));
  return { startYmd: localDateKeyFromDate(start), endYmd: localDateKeyFromDate(end) };
}

function leadInPeriod(lead: CrmLead, startYmd: string, endYmd: string): boolean {
  const key = toDateKey(lead.created_at);
  if (!key) return false;
  return key >= startYmd && key <= endYmd;
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

export function useCrmDashboardData(
  dataClientSlug: string | null,
  chartRange: CrmChartRange,
  locale: string,
  currentUser: AppUser,
  ownerFilter = "",
  customRange: CrmCustomDateRange | null = null,
) {
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [appointments, setAppointments] = useState<CrmAppointment[]>([]);
  const [activityLog, setActivityLog] = useState<
    Array<{ id: string; leadId: string; title: string; subtitle: string; at: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialLoadRef = useRef(true);

  const load = useCallback(async () => {
    const isInitialLoad = initialLoadRef.current;
    if (isInitialLoad) setLoading(true);
    if (isInitialLoad) setError(null);

    const [leadsRes, apptRes, logRes] = await Promise.all([
      supabase.from("crm_leads").select("*").order("created_at", { ascending: false }),
      supabase.from("crm_appointments").select("*").order("date", { ascending: true }),
      supabase
        .from("crm_activity_log")
        .select("*")
        .eq("event_type", "appointment_completed")
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    if (leadsRes.error) {
      console.error("[crm dashboard]", leadsRes.error.message);
      if (isInitialLoad) {
        setError(leadsRes.error.message);
        setLeads([]);
        setAppointments([]);
      }
      initialLoadRef.current = false;
      setLoading(false);
      return;
    }

    const mappedLeads = filterCrmLeadsForUser(
      ((leadsRes.data ?? []) as Record<string, unknown>[])
        .map((row) => mapCrmLeadRow(row))
        .filter((lead) => rowMatchesDataClient(lead.client_slug, dataClientSlug))
        .filter((lead) => isCrmDashboardLead(lead)),
      currentUser,
    );

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

    const completionItems =
      logRes.error || !logRes.data
        ? []
        : (logRes.data as Record<string, unknown>[])
            .map((row) => mapCrmActivityLogRow(row))
            .filter((entry) => entry.lead_id && leadIds.has(entry.lead_id))
            .filter((entry) => rowMatchesDataClient(entry.client_slug, dataClientSlug))
            .map((entry) => {
              const lead = entry.lead_id ? leadById.get(entry.lead_id) : undefined;
              const apptTitle = String(entry.payload.appointment_title ?? "");
              return {
                id: entry.id,
                leadId: entry.lead_id ?? "",
                title: apptTitle || "Appointment",
                subtitle: entry.actor_name
                  ? `${entry.actor_name}${lead?.name ? ` · ${lead.name}` : ""}`
                  : (lead?.name ?? "—"),
                at: entry.created_at,
              };
            });

    if (logRes.error) {
      console.error("[crm dashboard activity log]", logRes.error.message);
    }

    setLeads(mappedLeads);
    setAppointments(mappedAppts);
    setActivityLog(completionItems);
    initialLoadRef.current = false;
    setLoading(false);
  }, [dataClientSlug, currentUser]);

  useEffect(() => {
    initialLoadRef.current = true;
    setLoading(true);
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

    const logChannel = supabase
      .channel(`crm-activity-log-dashboard-${dataClientSlug ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_activity_log" }, () => {
        void load();
      })
      .subscribe();

    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(poll);
      void supabase.removeChannel(leadsChannel);
      void supabase.removeChannel(apptChannel);
      void supabase.removeChannel(logChannel);
    };
  }, [load, dataClientSlug]);

  const ownerOptions = useMemo(() => {
    const names = new Set<string>();
    for (const lead of leads) {
      const owner = (lead.owner ?? "").trim();
      if (owner) names.add(owner);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const owner = ownerFilter.trim();
    if (!owner) return leads;
    return leads.filter((lead) => (lead.owner ?? "").trim() === owner);
  }, [leads, ownerFilter]);

  const periodBounds = useMemo(
    () => resolvePeriodBounds(chartRange, customRange),
    [chartRange, customRange],
  );

  const periodLeads = useMemo(
    () => filteredLeads.filter((lead) => leadInPeriod(lead, periodBounds.startYmd, periodBounds.endYmd)),
    [filteredLeads, periodBounds],
  );

  const leadById = useMemo(() => new Map(filteredLeads.map((l) => [l.id, l])), [filteredLeads]);
  const filteredLeadIds = useMemo(() => new Set(filteredLeads.map((l) => l.id)), [filteredLeads]);

  const filteredAppointments = useMemo(
    () => appointments.filter((a) => filteredLeadIds.has(a.lead_id)),
    [appointments, filteredLeadIds],
  );

  const filteredActivityLog = useMemo(
    () => activityLog.filter((entry) => filteredLeadIds.has(entry.leadId)),
    [activityLog, filteredLeadIds],
  );

  const total = periodLeads.length;
  const wonCount = periodLeads.filter((l) => normalizeLeadStatus(l.status) === "Won").length;
  const conversionPct = total === 0 ? 0 : Math.round((wonCount / total) * 1000) / 10;
  const totalSalesValue = periodLeads
    .filter((l) => normalizeLeadStatus(l.status) === "Won")
    .reduce((a, l) => a + (leadClosedValue(l) > 0 ? leadClosedValue(l) : leadProposalValue(l)), 0);
  const openProposalLeads = periodLeads.filter((l) => normalizeLeadStatus(l.status) === "Proposal Sent");
  const openProposalsCount = openProposalLeads.length;
  const openProposalsValue = openProposalLeads.reduce((a, l) => a + leadProposalValue(l), 0);

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
    const start = parseYmdLocal(periodBounds.startYmd);
    const end = parseYmdLocal(periodBounds.endYmd);
    if (!start || !end) return [];

    const daySpan =
      Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    const useDaily = daySpan <= 45;
    const buckets: { dateKey: string; label: string; count: number }[] = [];

    if (useDaily) {
      for (let i = 0; i < daySpan; i++) {
        const d = addDaysLocal(start, i);
        const dateKey = localDateKeyFromDate(d);
        buckets.push({
          dateKey,
          label:
            chartRange === "7d" || daySpan <= 10
              ? formatShortDay(d, locale)
              : String(d.getDate()),
          count: 0,
        });
      }
      for (const lead of periodLeads) {
        const key = toDateKey(lead.created_at);
        const bucket = buckets.find((b) => b.dateKey === key);
        if (bucket) bucket.count += 1;
      }
    } else {
      // Weekly buckets for long custom ranges
      let cursor = new Date(start);
      while (cursor <= end) {
        const weekStart = localDateKeyFromDate(cursor);
        const weekEndDate = addDaysLocal(cursor, 6);
        const cappedEnd = weekEndDate > end ? end : weekEndDate;
        const weekEnd = localDateKeyFromDate(cappedEnd);
        buckets.push({
          dateKey: `${weekStart}_${weekEnd}`,
          label: formatShortDate(weekStart, locale),
          count: 0,
        });
        cursor = addDaysLocal(cursor, 7);
      }
      for (const lead of periodLeads) {
        const key = toDateKey(lead.created_at);
        const bucket = buckets.find((b) => {
          const [from, to] = b.dateKey.split("_");
          return key >= (from ?? "") && key <= (to ?? "");
        });
        if (bucket) bucket.count += 1;
      }
    }

    const max = Math.max(1, ...buckets.map((b) => b.count));
    return buckets.map((b) => ({
      ...b,
      heightPct: Math.max(8, Math.round((b.count / max) * 100)),
    }));
  }, [periodLeads, periodBounds, chartRange, locale]);

  const priorityLeads = useMemo(() => {
    return [...periodLeads]
      .sort((a, b) => {
        if (leadProposalValue(b) !== leadProposalValue(a)) return leadProposalValue(b) - leadProposalValue(a);
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      })
      .slice(0, 5);
  }, [periodLeads]);

  const appointmentsWithLead = useMemo((): CrmAppointmentWithLead[] => {
    return filteredAppointments
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
  }, [filteredAppointments, leadById]);

  const today = localTodayKey();

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
    const leadItems: CrmActivityItem[] = filteredLeads.map((l) => ({
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

    const completionActivity: CrmActivityItem[] = filteredActivityLog.map((c) => ({
      type: "completion",
      id: c.id,
      title: c.title,
      subtitle: c.subtitle,
      at: c.at,
    }));

    return [...leadItems, ...apptItems, ...completionActivity]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 8);
  }, [filteredLeads, appointmentsWithLead, filteredActivityLog]);

  const latestActivity = recentActivity[0] ?? null;

  const sourceMap = useMemo(() => sourceCountMap(periodLeads, dataClientSlug), [periodLeads, dataClientSlug]);
  const sourceLabels = useMemo(() => {
    const base = [...getCrmLeadSourceLabels(dataClientSlug)];
    for (const key of Object.keys(sourceMap)) {
      if ((sourceMap[key] ?? 0) > 0 && !base.includes(key)) base.push(key);
    }
    return base;
  }, [dataClientSlug, sourceMap]);
  const sourceTotal = periodLeads.length || 1;

  const serviceProductMap = useMemo(() => serviceProductCountMap(periodLeads), [periodLeads]);
  const serviceProductLabels = useMemo(() => {
    return Object.entries(serviceProductMap)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([label]) => label);
  }, [serviceProductMap]);
  const serviceProductTotal = useMemo(() => {
    const withType = periodLeads.filter((l) => normalizeServiceProduct(l.service_product)).length;
    return withType || 1;
  }, [periodLeads]);

  const pipelineRows = useMemo(() => {
    return CRM_LEAD_STATUSES.map((stage) => {
      const inStage = periodLeads.filter((l) => normalizeLeadStatus(l.status) === stage);
      return {
        stage: stage as CrmLeadStatus,
        count: inStage.length,
        valueSum: inStage.reduce((a, l) => a + leadStageValueSum(l), 0),
      };
    });
  }, [periodLeads]);

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
        const d = addDaysLocal(new Date(), i);
        const dateKey = localDateKeyFromDate(d);
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
    leads: periodLeads,
    allLeadsCount: leads.length,
    ownerOptions,
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
    sourceLabels,
    sourceTotal,
    serviceProductMap,
    serviceProductLabels,
    serviceProductTotal,
    pipelineRows,
    upcomingDateSlots,
    reload: load,
  };
}
