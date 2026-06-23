"use client";

import { Settings2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
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
  SALES_FUNNEL_TRANSFER_STATUS,
  shouldTransferLeadToSalesFunnel,
  type CrmFunnelDef,
} from "@/lib/crm-funnels";
import { mapCrmLeadRow, type CrmLead } from "@/lib/crm-data";
import { crmLeadStatusLabel, crmResumeStatusLabel } from "@/lib/crm-i18n";
import type { AppLanguage } from "@/lib/locale-types";
import { findCrmOwnerUser, resolveCrmOwnerOptions } from "@/lib/crm-team-members";
import { supabase } from "@/lib/supabase";
import { CrmEditFunnelModal } from "@/modules/crm/crm-edit-funnel-modal";
import { CrmKanbanBoard } from "@/modules/crm/crm-kanban-board";
import { CrmLeadDetailPanel } from "@/modules/crm/crm-lead-detail-panel";
import { CrmPipelineShell } from "@/modules/crm/crm-pipeline-shell";
import { CrmSourceField } from "@/modules/crm/crm-source-field";
import { deleteCrmFunnel, notifyCrmFunnelsReload, updateCrmFunnelDef, useCrmFunnels } from "@/modules/crm/use-crm-funnels";
import { useCrmKanbanLeads } from "@/modules/crm/use-crm-kanban-leads";
import { useCrmSourceOptions } from "@/modules/crm/use-crm-source-options";

function stageLabel(funnel: CrmFunnelDef, stageName: string, language: AppLanguage): string {
  if (isResumeFunnelSlug(funnel.slug)) return crmResumeStatusLabel(stageName, language);
  if (isSalesFunnelSlug(funnel.slug)) return crmLeadStatusLabel(stageName, language);
  return stageName;
}

export function CrmFunnelPipelineModule({ funnel: initialFunnel }: { funnel: CrmFunnelDef }) {
  const router = useRouter();
  const { dataClientSlug, users, currentUser } = useAppContext();
  const { language, t: lt } = useLanguage();
  const { reload, canManageFunnels, resumesEnabled } = useCrmFunnels();
  const [funnel, setFunnel] = useState(initialFunnel);
  const pipelinePath = funnelPipelinePath(funnel.slug);
  const allowAddLead = !isResumeFunnelSlug(funnel.slug);
  const canEditFunnel = canManageFunnels;

  useEffect(() => {
    setFunnel(initialFunnel);
  }, [initialFunnel]);

  const ownerOptions = useMemo(
    () => resolveCrmOwnerOptions(users, dataClientSlug, currentUser),
    [users, dataClientSlug, currentUser],
  );
  const leadClientSlug = dataClientSlug ?? "rocketride";

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

  const { sourceOptions, rememberSource } = useCrmSourceOptions(dataClientSlug);
  const defaultSource = sourceOptions[0] ?? "WhatsApp";
  const initialStage = funnelInitialStage(funnel);

  const [modalOpen, setModalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [targetColumn, setTargetColumn] = useState(initialStage);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState<string>(defaultSource);
  const [proposalValueStr, setProposalValueStr] = useState("0");
  const [closedValueStr, setClosedValueStr] = useState("0");
  const [owner, setOwner] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState("");
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
    setTargetColumn(columnId);
    setName("");
    setCompany("");
    setEmail("");
    setPhone("");
    setSource(defaultSource);
    setProposalValueStr("0");
    setClosedValueStr("0");
    setOwner("");
    setDescription("");
    setNameError("");
    setModalOpen(true);
  };

  const closeAddModal = () => {
    setModalOpen(false);
    setNameError("");
  };

  const handleAddSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(lt("Name is required."));
      return;
    }
    const proposalNum = Number.parseFloat(proposalValueStr.replace(/,/g, "")) || 0;
    const closedNum = Number.parseFloat(closedValueStr.replace(/,/g, "")) || 0;
    const sourceTrimmed = source.trim();
    const ownerName = owner.trim();
    const ownerUser = findCrmOwnerUser(users, ownerName);
    const transferToSales = shouldTransferLeadToSalesFunnel(funnel, ownerUser);
    const leadFunnel = transferToSales ? "sales" : funnel.slug;
    const leadStatus = transferToSales ? SALES_FUNNEL_TRANSFER_STATUS : targetColumn;
    const { data, error } = await supabase
      .from("crm_leads")
      .insert({
        name: trimmed,
        company: company.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        source: sourceTrimmed || null,
        value: proposalNum,
        proposal_value: proposalNum,
        closed_value: closedNum,
        owner: ownerName || null,
        description: description.trim() || null,
        status: leadStatus,
        funnel: leadFunnel,
        client_slug: leadClientSlug,
      })
      .select("*")
      .maybeSingle();
    if (error) {
      console.error("[crm] add lead", error.message);
      return;
    }
    if (sourceTrimmed) await rememberSource(sourceTrimmed);
    if (data) {
      const createdLead = mapCrmLeadRow(data as Record<string, unknown>);
      if (!transferToSales) {
        setLeads((prev) => [createdLead, ...prev]);
      } else {
        setSuccessMessage(lt("Lead transferred to Sales pipeline"));
        window.setTimeout(() => setSuccessMessage(null), 2500);
      }
      const leadEmail = (createdLead.email ?? "").trim();
      if (leadEmail) {
        const { data: existing, error: existingErr } = await supabase
          .from("crm_contacts")
          .select("id")
          .eq("email", leadEmail)
          .maybeSingle();
        if (existingErr) console.error("[crm] check existing contact", existingErr.message);
        if (!existing?.id) {
          const { error: contactErr } = await supabase.from("crm_contacts").insert([
            {
              name: createdLead.name,
              company: createdLead.company ?? "",
              email: createdLead.email ?? "",
              phone: createdLead.phone ?? "",
              role: "",
              source: createdLead.source ?? "",
              notes: `Auto-created from lead: ${createdLead.name}`,
              client_slug: leadClientSlug,
            },
          ]);
          if (contactErr) console.error("[crm] auto-create contact", contactErr.message);
        }
      } else {
        const { error: contactErr } = await supabase.from("crm_contacts").insert([
          {
            name: createdLead.name,
            company: createdLead.company ?? "",
            email: "",
            phone: createdLead.phone ?? "",
            role: "",
            source: createdLead.source ?? "",
            notes: `Auto-created from lead: ${createdLead.name}`,
            client_slug: leadClientSlug,
          },
        ]);
        if (contactErr) console.error("[crm] auto-create contact", contactErr.message);
      }
    }
    closeAddModal();
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

      {selectedLead ? (
        <CrmLeadDetailPanel
          lead={selectedLead}
          funnelConfig={funnel}
          onClose={() => setSelectedId(null)}
          onLeadUpdated={onLeadUpdated}
          onLeadDeleted={handleLeadDeleted}
          onLeadMovedToResume={isSalesFunnelSlug(funnel.slug) && resumesEnabled ? handleLeadMovedToResume : undefined}
          resumesEnabled={resumesEnabled}
        />
      ) : null}

      {modalOpen && allowAddLead ? (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={handleAddSubmit}
            className="w-full max-w-xl rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-normal uppercase tracking-[0.08em] text-white">{lt("Add New Lead")}</h3>
              <button
                type="button"
                onClick={closeAddModal}
                className="rounded-md border border-[var(--border-strong)] px-2 py-1 text-xs text-[rgba(255,255,255,0.7)]"
              >
                {lt("Close")}
              </button>
            </div>
            <p className="mt-2 text-xs text-[rgba(255,255,255,0.45)]">
              {lt("Status")}: {stageLabel(funnel, targetColumn, language)}
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="block space-y-1 md:col-span-2">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Name *")}</span>
                <input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError("");
                  }}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  required
                />
                {nameError ? <p className="text-xs text-[#f87171]">{nameError}</p> : null}
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Company")}</span>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Email")}</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Phone")}</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <div className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Source")}</span>
                <CrmSourceField
                  value={source}
                  onChange={setSource}
                  sourceOptions={sourceOptions}
                  language={language}
                  hint={lt("Select or type a new source")}
                  onCreateOption={rememberSource}
                />
              </div>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Proposal value")}</span>
                <input
                  value={proposalValueStr}
                  onChange={(e) => setProposalValueStr(e.target.value)}
                  inputMode="decimal"
                  className="mono-num w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Closed value")}</span>
                <input
                  value={closedValueStr}
                  onChange={(e) => setClosedValueStr(e.target.value)}
                  inputMode="decimal"
                  className="mono-num w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1 md:col-span-2">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Owner")}</span>
                <select
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                >
                  <option value="">{lt("Unassigned")}</option>
                  {ownerOptions.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 md:col-span-2">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Description")}</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={closeAddModal} className="btn-ghost rounded-[8px] px-3 py-1.5 text-xs">
                {lt("Cancel")}
              </button>
              <button type="submit" className="btn-primary rounded-[8px] px-3 py-1.5 text-xs">
                {lt("Save")}
              </button>
            </div>
          </form>
        </div>
      ) : null}

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
