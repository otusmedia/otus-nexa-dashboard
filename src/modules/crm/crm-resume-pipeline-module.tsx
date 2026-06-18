"use client";

import { useMemo, useState } from "react";
import type { DropResult } from "@hello-pangea/dnd";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { supabase } from "@/lib/supabase";
import {
  CRM_RESUME_KANBAN_COLUMNS,
  groupResumeLeadsByStatus,
  normalizeResumeStatus,
  type CrmResumeStatus,
} from "@/lib/crm-data";
import { crmResumeStatusLabel } from "@/lib/crm-i18n";
import { CrmKanbanBoard } from "@/modules/crm/crm-kanban-board";
import { CrmLeadDetailPanel } from "@/modules/crm/crm-lead-detail-panel";
import { CrmPipelineShell } from "@/modules/crm/crm-pipeline-shell";
import { useCrmKanbanLeads } from "@/modules/crm/use-crm-kanban-leads";

export function CrmResumePipelineModule() {
  const { dataClientSlug } = useAppContext();
  const { language, t: lt } = useLanguage();
  const {
    leads,
    setLeads,
    loading,
    setSelectedId,
    selectedLead,
    onLeadUpdated,
    onLeadDeleted,
  } = useCrmKanbanLeads("resume", dataClientSlug, "/crm/pipeline/resumes");

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const columns = useMemo(
    () =>
      CRM_RESUME_KANBAN_COLUMNS.map((col) => ({
        id: col.id,
        label: crmResumeStatusLabel(col.id, language),
        dotClass: col.dotClass,
      })),
    [language],
  );

  const byColumn = useMemo(() => groupResumeLeadsByStatus(leads), [leads]);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const id = result.draggableId;
    const newStatus = result.destination.droppableId as CrmResumeStatus;
    const lead = leads.find((l) => l.id === id);
    if (!lead || normalizeResumeStatus(lead.status) === newStatus) return;

    const prev = leads;
    const now = new Date().toISOString();
    setLeads((p) => p.map((l) => (l.id === id ? { ...l, status: newStatus, updated_at: now } : l)));

    const { error } = await supabase
      .from("crm_leads")
      .update({ status: newStatus, updated_at: now })
      .eq("id", id);

    if (error) {
      console.error("[crm] resume drag update", error.message);
      setLeads(prev);
    }
  };

  const handleLeadDeleted = (leadId: string) => {
    onLeadDeleted(leadId);
    setSuccessMessage(lt("Lead deleted successfully."));
    window.setTimeout(() => setSuccessMessage(null), 2500);
  };

  return (
    <CrmPipelineShell>
      {successMessage ? (
        <p className="mb-3 rounded-md border border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.12)] px-3 py-2 text-sm text-[#86efac]">
          {successMessage}
        </p>
      ) : null}
      <CrmKanbanBoard
        columns={columns}
        leadsByColumn={byColumn}
        loading={loading}
        leadCount={leads.length}
        onDragEnd={onDragEnd}
        onOpenLead={(lead) => setSelectedId(lead.id)}
      />

      {selectedLead ? (
        <CrmLeadDetailPanel
          lead={selectedLead}
          onClose={() => setSelectedId(null)}
          onLeadUpdated={onLeadUpdated}
          onLeadDeleted={handleLeadDeleted}
        />
      ) : null}
    </CrmPipelineShell>
  );
}
