"use client";

import { useMemo, useState, type FormEvent } from "react";
import type { DropResult } from "@hello-pangea/dnd";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { supabase } from "@/lib/supabase";
import {
  CRM_KANBAN_COLUMNS,
  CRM_SOURCE_OPTIONS,
  groupLeadsByStatus,
  mapCrmLeadRow,
  normalizeLeadStatus,
  type CrmLead,
  type CrmLeadStatus,
} from "@/lib/crm-data";
import { crmLeadStatusLabel, crmSourceLabel } from "@/lib/crm-i18n";
import { resolveCrmOwnerOptions } from "@/lib/crm-team-members";
import { CrmKanbanBoard } from "@/modules/crm/crm-kanban-board";
import { CrmLeadDetailPanel } from "@/modules/crm/crm-lead-detail-panel";
import { CrmPipelineShell } from "@/modules/crm/crm-pipeline-shell";
import { useCrmKanbanLeads } from "@/modules/crm/use-crm-kanban-leads";

export function CrmPipelineModule() {
  const { dataClientSlug, users, currentUser } = useAppContext();
  const { language, t: lt } = useLanguage();
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
  } = useCrmKanbanLeads("sales", dataClientSlug, "/crm/pipeline");

  const [modalOpen, setModalOpen] = useState(false);
  const [targetColumn, setTargetColumn] = useState<CrmLeadStatus>("New Lead");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState<string>(CRM_SOURCE_OPTIONS[0]);
  const [valueStr, setValueStr] = useState("0");
  const [owner, setOwner] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const columns = useMemo(
    () =>
      CRM_KANBAN_COLUMNS.map((col) => ({
        id: col.id,
        label: crmLeadStatusLabel(col.id, language),
        dotClass: col.dotClass,
      })),
    [language],
  );

  const byColumn = useMemo(() => groupLeadsByStatus(leads), [leads]);

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const id = result.draggableId;
    const newStatus = result.destination.droppableId as CrmLeadStatus;
    const lead = leads.find((l) => l.id === id);
    if (!lead || normalizeLeadStatus(lead.status) === newStatus) return;

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
    setTargetColumn(columnId as CrmLeadStatus);
    setName("");
    setCompany("");
    setEmail("");
    setPhone("");
    setSource(CRM_SOURCE_OPTIONS[0]);
    setValueStr("0");
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
    const valueNum = Number.parseFloat(valueStr.replace(/,/g, "")) || 0;
    const { data, error } = await supabase
      .from("crm_leads")
      .insert({
        name: trimmed,
        company: company.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        source: source || null,
        value: valueNum,
        owner: owner.trim() || null,
        description: description.trim() || null,
        status: targetColumn,
        funnel: "sales",
        client_slug: leadClientSlug,
      })
      .select("*")
      .maybeSingle();
    if (error) {
      console.error("[crm] add lead", error.message);
      return;
    }
    if (data) {
      const createdLead = mapCrmLeadRow(data as Record<string, unknown>);
      setLeads((prev) => [createdLead, ...prev]);
      const leadEmail = (createdLead.email ?? "").trim();
      if (leadEmail) {
        const { data: existing, error: existingErr } = await supabase
          .from("crm_contacts")
          .select("id")
          .eq("email", leadEmail)
          .maybeSingle();
        if (existingErr) {
          console.error("[crm] check existing contact", existingErr.message);
        }
        if (existing?.id) {
          console.log("Contact already exists");
        } else {
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
        onAddLead={openAddModal}
        addLeadLabel={lt("Add New Lead")}
      />

      {selectedLead ? (
        <CrmLeadDetailPanel
          lead={selectedLead}
          onClose={() => setSelectedId(null)}
          onLeadUpdated={onLeadUpdated}
          onLeadDeleted={handleLeadDeleted}
          onLeadMovedToResume={onLeadMovedToResume}
        />
      ) : null}

      {modalOpen ? (
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
              {lt("Status")}: {crmLeadStatusLabel(targetColumn, language)}
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
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Source")}</span>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                >
                  {CRM_SOURCE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {crmSourceLabel(s, language)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Value")}</span>
                <input
                  value={valueStr}
                  onChange={(e) => setValueStr(e.target.value)}
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
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                  {lt("Description")}
                </span>
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
    </CrmPipelineShell>
  );
}
