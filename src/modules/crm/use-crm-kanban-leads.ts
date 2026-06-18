"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { rowMatchesDataClient } from "@/lib/client-utils";
import { supabase } from "@/lib/supabase";
import { mapCrmLeadRow, type CrmLead, type CrmLeadFunnel } from "@/lib/crm-data";

export function useCrmKanbanLeads(funnel: CrmLeadFunnel, dataClientSlug: string | null, pipelinePath: string) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(true);
  const initialLoadRef = useRef(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const isInitialLoad = initialLoadRef.current;
    if (isInitialLoad) setLoading(true);

    let query = supabase.from("crm_leads").select("*").order("created_at", { ascending: false });
    const { data, error } = await query.eq("funnel", funnel);

    if (error) {
      console.error("[crm pipeline]", error.message);
      const fallback = await supabase.from("crm_leads").select("*").order("created_at", { ascending: false });
      if (fallback.error) {
        console.error("[crm pipeline fallback]", fallback.error.message);
        if (isInitialLoad) setLeads([]);
      } else {
        const rows = (fallback.data ?? []) as Record<string, unknown>[];
        const mapped = rows
          .map((row) => mapCrmLeadRow(row))
          .filter(
            (lead) =>
              rowMatchesDataClient(lead.client_slug, dataClientSlug) &&
              (lead.funnel === funnel || (funnel === "sales" && lead.funnel === "sales")),
          );
        setLeads(mapped);
      }
    } else {
      const rows = (data ?? []) as Record<string, unknown>[];
      const mapped = rows
        .map((row) => mapCrmLeadRow(row))
        .filter((lead) => rowMatchesDataClient(lead.client_slug, dataClientSlug));
      setLeads(mapped);
    }

    initialLoadRef.current = false;
    setLoading(false);
  }, [dataClientSlug, funnel]);

  useEffect(() => {
    initialLoadRef.current = true;
    setLoading(true);
    void load();

    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);

    const poll = window.setInterval(() => void load(), 20_000);

    const channel = supabase
      .channel(`crm-leads-pipeline-${funnel}-${dataClientSlug ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_leads" }, () => {
        void load();
      })
      .subscribe();

    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [load, dataClientSlug, funnel]);

  useEffect(() => {
    const leadParam = searchParams.get("lead");
    if (!leadParam || loading) return;
    if (leads.some((l) => l.id === leadParam)) {
      setSelectedId(leadParam);
    }
    router.replace(pipelinePath, { scroll: false });
  }, [searchParams, leads, loading, router, pipelinePath]);

  const onLeadUpdated = useCallback((updated: CrmLead) => {
    if (updated.funnel !== funnel) {
      setLeads((prev) => prev.filter((l) => l.id !== updated.id));
      setSelectedId(null);
      return;
    }
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }, [funnel]);

  const onLeadDeleted = useCallback((leadId: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    setSelectedId(null);
  }, []);

  const onLeadMovedToResume = useCallback((leadId: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    setSelectedId(null);
  }, []);

  const selectedLead = selectedId ? (leads.find((l) => l.id === selectedId) ?? null) : null;

  return {
    leads,
    setLeads,
    loading,
    selectedId,
    setSelectedId,
    selectedLead,
    onLeadUpdated,
    onLeadDeleted,
    onLeadMovedToResume,
  };
}
