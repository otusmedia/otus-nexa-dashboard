"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DropResult } from "@hello-pangea/dnd";
import { DragDropContext } from "@hello-pangea/dnd";
import { PageHeader } from "@/components/ui/page-header";
import { supabase } from "@/lib/supabase";
import {
  CRM_KANBAN_COLUMNS,
  CRM_SOURCE_OPTIONS,
  CRM_TEAM_MEMBERS,
  groupLeadsByStatus,
  mapCrmLeadRow,
  normalizeLeadStatus,
  type CrmLead,
  type CrmLeadStatus,
} from "@/lib/crm-data";
import { CrmPipelineColumn } from "@/modules/crm/crm-pipeline-column";
import { CrmLeadDetailPanel } from "@/modules/crm/crm-lead-detail-panel";

export function CrmPipelineModule() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("crm_leads").select("*").order("created_at", { ascending: false });
    if (error) {
      console.error("[crm pipeline]", error.message);
      setLeads([]);
    } else {
      setLeads((data ?? []).map((row) => mapCrmLeadRow(row as Record<string, unknown>)));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const leadParam = searchParams.get("lead");
    if (!leadParam || loading) return;
    if (leads.some((l) => l.id === leadParam)) {
      setSelectedId(leadParam);
    }
    router.replace("/crm/pipeline", { scroll: false });
  }, [searchParams, leads, loading, router]);

  const byColumn = useMemo(() => groupLeadsByStatus(leads), [leads]);

  const selectedLead = selectedId ? (leads.find((l) => l.id === selectedId) ?? null) : null;

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

  const openAddModal = (columnId: CrmLeadStatus) => {
    setTargetColumn(columnId);
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
      setNameError("Name is required.");
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
          },
        ]);
        if (contactErr) console.error("[crm] auto-create contact", contactErr.message);
      }
    }
    closeAddModal();
  };

  const onLeadUpdated = (updated: CrmLead) => {
    setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  };

  const onLeadDeleted = (leadId: string) => {
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
    setSelectedId(null);
    setSuccessMessage("Lead deleted successfully.");
    window.setTimeout(() => setSuccessMessage(null), 2500);
  };

  const leadCount = leads.length;

  return (
    <div className="w-full min-w-0">
      <PageHeader title="Pipeline" subtitle="Kanban pipeline" />
      {successMessage ? (
        <p className="mb-3 rounded-md border border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.12)] px-3 py-2 text-sm text-[#86efac]">
          {successMessage}
        </p>
      ) : null}
      {loading ? (
        <p className="text-sm text-[rgba(255,255,255,0.45)]">Loading pipeline…</p>
      ) : (
        <div className="w-full min-w-0 overflow-x-auto">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="mb-3 px-1 text-xs font-light text-[rgba(255,255,255,0.4)]">{leadCount} leads</div>
            <div className="h-[80vh] w-max overflow-hidden">
              <div className="flex h-full min-h-0 w-max flex-row gap-4 px-1 pb-4">
                {CRM_KANBAN_COLUMNS.map((col) => (
                  <CrmPipelineColumn
                    key={col.id}
                    columnId={col.id}
                    label={col.label}
                    dotClass={col.dotClass}
                    leads={byColumn[col.id]}
                    onAddLead={openAddModal}
                    onOpenLead={(lead) => setSelectedId(lead.id)}
                  />
                ))}
              </div>
            </div>
          </DragDropContext>
        </div>
      )}

      {selectedLead ? (
        <CrmLeadDetailPanel
          lead={selectedLead}
          onClose={() => setSelectedId(null)}
          onLeadUpdated={onLeadUpdated}
          onLeadDeleted={onLeadDeleted}
        />
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={handleAddSubmit}
            className="w-full max-w-xl rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-normal uppercase tracking-[0.08em] text-white">Add New Lead</h3>
              <button
                type="button"
                onClick={closeAddModal}
                className="rounded-md border border-[var(--border-strong)] px-2 py-1 text-xs text-[rgba(255,255,255,0.7)]"
              >
                Close
              </button>
            </div>
            <p className="mt-2 text-xs text-[rgba(255,255,255,0.45)]">Status: {targetColumn}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="block space-y-1 md:col-span-2">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">Name *</span>
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
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">Company</span>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">Phone</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">Source</span>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                >
                  {CRM_SOURCE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">Value</span>
                <input
                  value={valueStr}
                  onChange={(e) => setValueStr(e.target.value)}
                  inputMode="decimal"
                  className="mono-num w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1 md:col-span-2">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">Owner</span>
                <select
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                >
                  <option value="">Unassigned</option>
                  {CRM_TEAM_MEMBERS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 md:col-span-2">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                  Description
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
                Cancel
              </button>
              <button type="submit" className="btn-primary rounded-[8px] px-3 py-1.5 text-xs">
                Save
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
