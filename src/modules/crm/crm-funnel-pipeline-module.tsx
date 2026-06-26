"use client";

import { Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { DropResult } from "@hello-pangea/dnd";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import {
  funnelInitialStage,
  funnelPipelinePath,
  groupLeadsByFunnelStages,
  isResumeFunnelSlug,
  isSalesFunnelSlug,
  normalizeFunnelStageStatus,
  type CrmFunnelDef,
} from "@/lib/crm-funnels";
import { type CrmLead } from "@/lib/crm-data";
import { crmLeadStatusLabel, crmResumeStatusLabel } from "@/lib/crm-i18n";
import type { AppLanguage } from "@/lib/locale-types";
import { supabase } from "@/lib/supabase";
import { CrmEditFunnelModal } from "@/modules/crm/crm-edit-funnel-modal";
import { CrmKanbanBoard } from "@/modules/crm/crm-kanban-board";
import { CrmLeadFormModal } from "@/modules/crm/crm-lead-form-modal";
import { CrmPipelineShell } from "@/modules/crm/crm-pipeline-shell";
import { deleteCrmFunnel, notifyCrmFunnelsReload, updateCrmFunnelDef, useCrmFunnels } from "@/modules/crm/use-crm-funnels";
import { useCrmKanbanLeads } from "@/modules/crm/use-crm-kanban-leads";

function stageLabel(funnel: CrmFunnelDef, stageName: string, language: AppLanguage): string {
  if (isResumeFunnelSlug(funnel.slug)) return crmResumeStatusLabel(stageName, language);
  if (isSalesFunnelSlug(funnel.slug)) return crmLeadStatusLabel(stageName, language);
  return stageName;
}

export function CrmFunnelPipelineModule({ funnel: initialFunnel }: { funnel: CrmFunnelDef }) {
  const router = useRouter();
  const { dataClientSlug, currentUser } = useAppContext();
  const { language, t: lt } = useLanguage();
  const { reload, canManageFunnels, resumesEnabled } = useCrmFunnels();
  const [funnel, setFunnel] = useState(initialFunnel);
  const pipelinePath = funnelPipelinePath(funnel.slug);
  const allowAddLead = !isResumeFunnelSlug(funnel.slug);
  const canEditFunnel = canManageFunnels;

  useEffect(() => {
    setFunnel(initialFunnel);
  }, [initialFunnel]);

  const {
    leads,
    setLeads,
    loading,
    setSelectedId,
    selectedLead,
    onLeadUpdated,
    onLeadDeleted,
    onLeadMovedToResume,
  } = useCrmKanbanLeads(funnel.slug, dataClientSlug, pipelinePath, currentUser);

  const initialStage = funnelInitialStage(funnel);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createStage, setCreateStage] = useState(initialStage);
  const [editOpen, setEditOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const columns = useMemo(
    () =>
      funnel.stages.map((col) => ({
        id: col.name,
        label: stageLabel(funnel, col.name, language),
        dotClass: col.dotClass,
      })),
    [funnel, language],
  );

  const byColumn = useMemo(() => groupLeadsByFunnelStages(leads, funnel.stages), [leads, funnel.stages]);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const id = result.draggableId;
    const newStatus = result.destination.droppableId;
    const lead = leads.find((l) => l.id === id);
    if (!lead || normalizeFunnelStageStatus(lead.status, funnel.stages) === newStatus) return;

    const prev = leads;
    const now = new Date().toISOString();
    setLeads((p) => p.map((l) => (l.id === id ? { ...l, status: newStatus, updated_at: now } : l)));

    const { error } = await supabase
      .from("crm_leads")
      .update({ status: newStatus, updated_at: now })
      .eq("id", id);

    if (error) {
      console.error("[crm] drag update", error.message);
      setLeads(prev);
    }
  };

  const openAddModal = (columnId: string) => {
    setCreateStage(columnId);
    setCreateModalOpen(true);
  };

  const handleLeadSaved = (savedLead: CrmLead, meta?: { transferredToSales?: boolean }) => {
    if (meta?.transferredToSales) {
      setSuccessMessage(lt("Lead transferred to Sales pipeline"));
      window.setTimeout(() => setSuccessMessage(null), 2500);
      setLeads((prev) => prev.filter((l) => l.id !== savedLead.id));
      setSelectedId(null);
      return;
    }
    const existing = leads.some((l) => l.id === savedLead.id);
    if (existing) {
      onLeadUpdated(savedLead);
    } else {
      setLeads((prev) => [savedLead, ...prev]);
      setSelectedId(savedLead.id);
    }
  };

  const handleLeadDeleted = (leadId: string) => {
    onLeadDeleted(leadId);
    setSuccessMessage(lt("Lead deleted successfully."));
    window.setTimeout(() => setSuccessMessage(null), 2500);
  };

  const handleLeadMovedToResume = (leadId: string) => {
    onLeadMovedToResume(leadId);
    router.push("/crm/pipeline/resumes");
  };

  const handleFunnelUpdated = async (input: {
    name: string;
    stages: Array<{ name: string; dotClass: string }>;
    accessUserIds: string[];
  }) => {
    if (!dataClientSlug) return null;
    const updated = await updateCrmFunnelDef(funnel, dataClientSlug, input);
    if (updated) {
      setFunnel(updated);
      await reload();
      notifyCrmFunnelsReload();
    }
    return updated;
  };

  const handleFunnelDeleted = async () => {
    if (!funnel.id || !dataClientSlug || funnel.isBuiltin) return false;
    const result = await deleteCrmFunnel(funnel.id, dataClientSlug);
    if (result.ok) {
      await reload();
      notifyCrmFunnelsReload();
      router.push("/crm/pipeline");
      return true;
    }
    return false;
  };

  return (
    <CrmPipelineShell>
      {canEditFunnel ? (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-[8px] border border-[var(--border)] px-3 py-1.5 text-xs text-[rgba(255,255,255,0.65)] transition-colors hover:bg-[rgba(255,255,255,0.04)] hover:text-white"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {lt("Edit funnel")}
          </button>
        </div>
      ) : null}
      {successMessage ? (
        <p className="mb-3 rounded-md border border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.12)] px-3 py-2 text-sm text-[#86efac]">
          {successMessage}
        </p>
      ) : null}
      <CrmKanbanBoard
        columns={columns}
        leadsByColumn={byColumn as Record<string, CrmLead[]>}
        loading={loading}
        leadCount={leads.length}
        onDragEnd={onDragEnd}
        onOpenLead={(lead) => setSelectedId(lead.id)}
        onAddLead={allowAddLead ? openAddModal : undefined}
        addLeadLabel={allowAddLead ? lt("Add New Lead") : undefined}
      />

      {allowAddLead ? (
        <CrmLeadFormModal
          open={createModalOpen}
          mode="create"
          funnel={funnel}
          initialStage={createStage}
          onClose={() => setCreateModalOpen(false)}
          onSaved={handleLeadSaved}
        />
      ) : null}

      <CrmLeadFormModal
        open={selectedLead != null}
        mode="edit"
        funnel={funnel}
        lead={selectedLead}
        onClose={() => setSelectedId(null)}
        onSaved={handleLeadSaved}
        onDeleted={handleLeadDeleted}
        onLeadMovedToResume={isSalesFunnelSlug(funnel.slug) && resumesEnabled ? handleLeadMovedToResume : undefined}
        resumesEnabled={resumesEnabled}
      />

      {canEditFunnel ? (
        <CrmEditFunnelModal
          open={editOpen}
          funnel={funnel}
          allowDelete={!funnel.isBuiltin}
          onClose={() => setEditOpen(false)}
          onUpdated={handleFunnelUpdated}
          onDeleted={handleFunnelDeleted}
        />
      ) : null}
    </CrmPipelineShell>
  );
}
