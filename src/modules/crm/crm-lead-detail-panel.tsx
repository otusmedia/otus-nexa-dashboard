"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { CALENDAR_INVITABLE_USERS } from "@/components/calendar/calendar-invite-users";
import { useAppContext } from "@/components/providers/app-providers";
import { supabase } from "@/lib/supabase";
import {
  CRM_KANBAN_COLUMNS,
  CRM_SOURCE_OPTIONS,
  CRM_TEAM_MEMBERS,
  formatAppointmentTime,
  formatLeadCreatedAt,
  mapCrmAppointmentRow,
  mapCrmLeadRow,
  normalizeLeadStatus,
  type CrmAppointment,
  type CrmLead,
  type CrmLeadStatus,
} from "@/lib/crm-data";
import { formatCurrency } from "@/lib/utils";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { cn } from "@/lib/utils";

function statusBadgeClass(status: CrmLeadStatus) {
  const col = CRM_KANBAN_COLUMNS.find((c) => c.id === status);
  const dot = col?.dotClass ?? "bg-gray-500";
  return dot;
}

function calendarTimesFromAppointment(dateStr: string | null, timeStr: string | null): { start_at: string; end_at: string } {
  const d = dateStr?.trim() || new Date().toISOString().slice(0, 10);
  let h = 9;
  let mi = 0;
  if (timeStr?.trim()) {
    const p = timeStr.trim().slice(0, 8).split(":");
    h = Number(p[0]) || 0;
    mi = Number(p[1]) || 0;
  }
  const start = new Date(`${d}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:00`);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { start_at: start.toISOString(), end_at: end.toISOString() };
}

function normalizeYmd(dateStr: string | null): string {
  const raw = (dateStr ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

export function CrmLeadDetailPanel({
  lead,
  onClose,
  onLeadUpdated,
  onLeadDeleted,
}: {
  lead: CrmLead;
  onClose: () => void;
  onLeadUpdated: (lead: CrmLead) => void;
  onLeadDeleted: (leadId: string) => void;
}) {
  const { currentUser } = useAppContext();
  const [nameDraft, setNameDraft] = useState(lead.name);
  const [propDraft, setPropDraft] = useState({
    owner: lead.owner ?? "",
    company: lead.company ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    source: normalizeLeadSourceSelect(lead.source),
    valueStr: String(lead.value ?? 0),
  });
  const [descDraft, setDescDraft] = useState(lead.description ?? "");
  const [notesDraft, setNotesDraft] = useState(lead.notes ?? "");
  const [propsSaving, setPropsSaving] = useState(false);
  const [descSaving, setDescSaving] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [appointments, setAppointments] = useState<CrmAppointment[]>([]);
  const [apptsLoading, setApptsLoading] = useState(true);
  const [showApptForm, setShowApptForm] = useState(false);
  const [apptDraft, setApptDraft] = useState({
    title: "",
    date: "",
    time: "",
    owner: "",
    description: "",
  });
  const [deleteApptId, setDeleteApptId] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deleteLeadModalOpen, setDeleteLeadModalOpen] = useState(false);
  const [deletePasskey, setDeletePasskey] = useState("");
  const [deletingLead, setDeletingLead] = useState(false);

  const syncFromLead = useCallback((l: CrmLead) => {
    setNameDraft(l.name);
    setPropDraft({
      owner: l.owner ?? "",
      company: l.company ?? "",
      email: l.email ?? "",
      phone: l.phone ?? "",
      source: normalizeLeadSourceSelect(l.source),
      valueStr: String(l.value ?? 0),
    });
    setDescDraft(l.description ?? "");
    setNotesDraft(l.notes ?? "");
  }, []);

  useEffect(() => {
    syncFromLead(lead);
  }, [lead.id, lead.updated_at, syncFromLead]);

  const loadAppointments = useCallback(async () => {
    setApptsLoading(true);
    const { data, error } = await supabase
      .from("crm_appointments")
      .select("*")
      .eq("lead_id", lead.id)
      .order("date", { ascending: true });
    if (error) {
      console.error("[crm appointments]", error.message);
      setAppointments([]);
    } else {
      setAppointments((data ?? []).map((row) => mapCrmAppointmentRow(row as Record<string, unknown>)));
    }
    setApptsLoading(false);
  }, [lead.id]);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  const propsDirty =
    nameDraft.trim() !== lead.name ||
    (propDraft.owner || "") !== (lead.owner ?? "") ||
    (propDraft.company || "") !== (lead.company ?? "") ||
    (propDraft.email || "") !== (lead.email ?? "") ||
    (propDraft.phone || "") !== (lead.phone ?? "") ||
    propDraft.source !== normalizeLeadSourceSelect(lead.source) ||
    Number.parseFloat(propDraft.valueStr || "0") !== lead.value;

  const descDirty = descDraft !== (lead.description ?? "");
  const notesDirty = notesDraft !== (lead.notes ?? "");

  const saveProperties = async () => {
    const valueNum = Number.parseFloat(propDraft.valueStr.replace(/,/g, "")) || 0;
    setPropsSaving(true);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("crm_leads")
      .update({
        name: nameDraft.trim() || lead.name,
        owner: propDraft.owner.trim() || null,
        company: propDraft.company.trim() || null,
        email: propDraft.email.trim() || null,
        phone: propDraft.phone.trim() || null,
        source: propDraft.source,
        value: valueNum,
        updated_at: now,
      })
      .eq("id", lead.id)
      .select("*")
      .maybeSingle();
    setPropsSaving(false);
    if (error) {
      console.error("[crm] save properties", error.message);
      return;
    }
    if (data) onLeadUpdated(mapCrmLeadRow(data as Record<string, unknown>));
  };

  const cancelProperties = () => {
    syncFromLead(lead);
  };

  const saveDescription = async () => {
    setDescSaving(true);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("crm_leads")
      .update({ description: descDraft.trim() || null, updated_at: now })
      .eq("id", lead.id)
      .select("*")
      .maybeSingle();
    setDescSaving(false);
    if (error) {
      console.error("[crm] save description", error.message);
      return;
    }
    if (data) onLeadUpdated(mapCrmLeadRow(data as Record<string, unknown>));
  };

  const saveNotes = async () => {
    setNotesSaving(true);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("crm_leads")
      .update({ notes: notesDraft.trim() || null, updated_at: now })
      .eq("id", lead.id)
      .select("*")
      .maybeSingle();
    setNotesSaving(false);
    if (error) {
      console.error("[crm] save notes", error.message);
      return;
    }
    if (data) onLeadUpdated(mapCrmLeadRow(data as Record<string, unknown>));
  };

  const onStatusChange = async (next: CrmLeadStatus) => {
    if (next === normalizeLeadStatus(lead.status)) return;
    setStatusUpdating(true);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("crm_leads")
      .update({ status: next, updated_at: now })
      .eq("id", lead.id)
      .select("*")
      .maybeSingle();
    setStatusUpdating(false);
    if (error) {
      console.error("[crm] status", error.message);
      return;
    }
    if (data) onLeadUpdated(mapCrmLeadRow(data as Record<string, unknown>));
  };

  const saveAppointment = async () => {
    const title = apptDraft.title.trim();
    if (!title) return;
    const timeVal = toPgTime(apptDraft.time);
    const { data, error } = await supabase
      .from("crm_appointments")
      .insert({
        lead_id: lead.id,
        title,
        date: apptDraft.date || null,
        time: timeVal,
        owner: apptDraft.owner.trim() ? apptDraft.owner.trim() : null,
        description: apptDraft.description.trim() || null,
      })
      .select("*")
      .maybeSingle();
    if (error) {
      console.error("[crm] add appointment", error.message);
      return;
    }
    if (data) {
      const created = mapCrmAppointmentRow(data as Record<string, unknown>);
      console.log("CRM appointment created:", created);
      setAppointments((prev) => [...prev, created]);
      const leadName = lead.name;
      const normalizedDate = normalizeYmd(created.date);
      const { start_at, end_at } = calendarTimesFromAppointment(normalizedDate, created.time);
      const descParts = [
        `CRM Lead: ${leadName}`,
        created.description ?? "",
        created.owner ? `Owner: ${created.owner}` : "",
        currentUser.name ? `— ${currentUser.name}` : "",
      ].filter(Boolean);
      const description = descParts.join("\n");
      const calendarPayload = {
        title: created.title,
        type: "meeting",
        description,
        start_at,
        end_at,
        all_day: false,
        meet_link: null,
        location: null,
        color: "#10b981",
        created_by: null,
        source: "crm",
        source_id: created.id,
        lead_id: lead.id,
        lead_name: leadName,
      };
      console.log("Inserting into calendar_events:", calendarPayload);

      const calIns = await supabase
        .from("calendar_events")
        .insert(calendarPayload)
        .select("id")
        .maybeSingle();
      console.log("Calendar insert result:", calIns);

      if (calIns.error) {
        console.error("[crm] calendar sync insert", calIns.error.message);
      } else if (calIns.data?.id) {
        const ownerName = created.owner?.trim() ?? "";
        const inv = ownerName ? CALENDAR_INVITABLE_USERS.find((u) => u.name === ownerName) : undefined;
        if (inv) {
          const { error: invErr } = await supabase.from("calendar_event_invitees").insert({
            event_id: String(calIns.data.id),
            email: inv.email,
            user_id: null,
            status: "pending",
          });
          if (invErr) console.error("[crm] calendar invitee", invErr.message);
        }
      }
    }
    setApptDraft({
      title: "",
      date: "",
      time: "",
      owner: "",
      description: "",
    });
    setShowApptForm(false);
  };

  const confirmDeleteAppointment = async () => {
    if (!deleteApptId) return;
    const apptId = deleteApptId;
    const { error } = await supabase.from("crm_appointments").delete().eq("id", apptId);
    if (error) {
      console.error("[crm] delete appt", error.message);
      setDeleteApptId(null);
      return;
    }
    const { error: calDelErr } = await supabase.from("calendar_events").delete().eq("source", "crm").eq("source_id", apptId);
    if (calDelErr) console.error("[crm] calendar delete", calDelErr.message);
    setAppointments((prev) => prev.filter((a) => a.id !== apptId));
    setDeleteApptId(null);
  };

  const canConfirmDeleteLead = deletePasskey === "DELETE";

  const confirmDeleteLead = async () => {
    if (!canConfirmDeleteLead || deletingLead) return;
    setDeletingLead(true);
    const leadId = lead.id;

    const { error: calErr } = await supabase.from("calendar_events").delete().eq("lead_id", leadId);
    if (calErr) console.error("[crm] delete lead calendar events", calErr.message);

    const { error: apptErr } = await supabase.from("crm_appointments").delete().eq("lead_id", leadId);
    if (apptErr) console.error("[crm] delete lead appointments", apptErr.message);

    const { error: leadErr } = await supabase.from("crm_leads").delete().eq("id", leadId);
    setDeletingLead(false);
    if (leadErr) {
      console.error("[crm] delete lead", leadErr.message);
      return;
    }

    setDeleteLeadModalOpen(false);
    setDeletePasskey("");
    onLeadDeleted(leadId);
    onClose();
  };

  const currentStatus = normalizeLeadStatus(lead.status);

  return (
    <>
      <div className="fixed inset-0 z-[130] bg-black/60" aria-hidden onClick={onClose} />
      <aside
        className="fixed right-0 top-0 z-[131] flex h-full w-full max-w-md flex-col border-l border-[var(--border)] bg-[#141414] shadow-2xl"
        role="dialog"
        aria-labelledby="crm-lead-panel-title"
      >
        <div className="flex shrink-0 items-start gap-2 border-b border-[var(--border)] p-4">
          <div className="min-w-0 flex-1">
            <label className="sr-only" htmlFor="crm-lead-panel-title">
              Lead name
            </label>
            <input
              id="crm-lead-panel-title"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="w-full border-b border-transparent bg-transparent text-xl font-normal text-white outline-none focus:border-[#ff4500]"
            />
            <p className="mt-1 text-xs text-[rgba(255,255,255,0.35)]">Created {formatLeadCreatedAt(lead.created_at)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-white",
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", statusBadgeClass(currentStatus))} aria-hidden />
                <select
                  value={currentStatus}
                  disabled={statusUpdating}
                  onChange={(e) => void onStatusChange(e.target.value as CrmLeadStatus)}
                  className="border-none bg-transparent text-xs text-white outline-none"
                >
                  {CRM_KANBAN_COLUMNS.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#141414]">
                      {c.label}
                    </option>
                  ))}
                </select>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-[var(--border-strong)] p-1.5 text-[rgba(255,255,255,0.6)] hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <section>
            <h3 className="text-[0.65rem] font-normal uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
              Properties
            </h3>
            <div className="mt-3 grid gap-3">
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">Owner</span>
                <select
                  value={propDraft.owner}
                  onChange={(e) => setPropDraft((p) => ({ ...p, owner: e.target.value }))}
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
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">Company</span>
                <input
                  value={propDraft.company}
                  onChange={(e) => setPropDraft((p) => ({ ...p, company: e.target.value }))}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">Email</span>
                <input
                  type="email"
                  value={propDraft.email}
                  onChange={(e) => setPropDraft((p) => ({ ...p, email: e.target.value }))}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">Phone</span>
                <input
                  value={propDraft.phone}
                  onChange={(e) => setPropDraft((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">Source</span>
                <select
                  value={propDraft.source}
                  onChange={(e) => setPropDraft((p) => ({ ...p, source: e.target.value }))}
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
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">Value ($)</span>
                <input
                  value={propDraft.valueStr}
                  onChange={(e) => setPropDraft((p) => ({ ...p, valueStr: e.target.value }))}
                  inputMode="decimal"
                  className="mono-num w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
                <span className="text-xs text-[rgba(255,255,255,0.35)]">
                  Preview: {formatCurrency(Number.parseFloat(propDraft.valueStr.replace(/,/g, "")) || 0)}
                </span>
              </label>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                disabled={!propsDirty || propsSaving}
                onClick={cancelProperties}
                className="btn-ghost rounded-[8px] px-3 py-1.5 text-xs disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!propsDirty || propsSaving}
                onClick={() => void saveProperties()}
                className="btn-primary rounded-[8px] px-3 py-1.5 text-xs disabled:opacity-40"
              >
                {propsSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </section>

          <section className="mt-8">
            <h3 className="text-[0.65rem] font-normal uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
              Description
            </h3>
            <textarea
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                disabled={!descDirty || descSaving}
                onClick={() => setDescDraft(lead.description ?? "")}
                className="btn-ghost rounded-[8px] px-3 py-1.5 text-xs disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!descDirty || descSaving}
                onClick={() => void saveDescription()}
                className="btn-primary rounded-[8px] px-3 py-1.5 text-xs disabled:opacity-40"
              >
                {descSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </section>

          <section className="mt-8">
            <h3 className="text-[0.65rem] font-normal uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">Notes</h3>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={4}
              className="mt-2 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                disabled={!notesDirty || notesSaving}
                onClick={() => setNotesDraft(lead.notes ?? "")}
                className="btn-ghost rounded-[8px] px-3 py-1.5 text-xs disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!notesDirty || notesSaving}
                onClick={() => void saveNotes()}
                className="btn-primary rounded-[8px] px-3 py-1.5 text-xs disabled:opacity-40"
              >
                {notesSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </section>

          <section className="mt-8">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[0.65rem] font-normal uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                APPOINTMENTS
              </h3>
              <button
                type="button"
                onClick={() => setShowApptForm((v) => !v)}
                className="rounded-md border border-[var(--border)] px-2 py-1 text-[0.65rem] text-white hover:bg-[var(--surface-elevated)]"
              >
                {showApptForm ? "Close" : "Add Appointment"}
              </button>
            </div>

            {showApptForm ? (
              <div className="mt-3 space-y-3 rounded-lg border border-[var(--border)] bg-[#161616] p-3">
                <label className="block space-y-1">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                    Title *
                  </span>
                  <input
                    value={apptDraft.title}
                    onChange={(e) => setApptDraft((p) => ({ ...p, title: e.target.value }))}
                    className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">Date</span>
                    <input
                      type="date"
                      value={apptDraft.date}
                      onChange={(e) => setApptDraft((p) => ({ ...p, date: e.target.value }))}
                      className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white [color-scheme:dark]"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">Time</span>
                    <input
                      type="time"
                      value={apptDraft.time}
                      onChange={(e) => setApptDraft((p) => ({ ...p, time: e.target.value }))}
                      className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white [color-scheme:dark]"
                    />
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">Owner</span>
                  <select
                    value={apptDraft.owner}
                    onChange={(e) => setApptDraft((p) => ({ ...p, owner: e.target.value }))}
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
                <label className="block space-y-1">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                    Description
                  </span>
                  <textarea
                    value={apptDraft.description}
                    onChange={(e) => setApptDraft((p) => ({ ...p, description: e.target.value }))}
                    rows={2}
                    className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowApptForm(false)}
                    className="btn-ghost rounded-[8px] px-3 py-1.5 text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveAppointment()}
                    className="btn-primary rounded-[8px] px-3 py-1.5 text-xs"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : null}

            {apptsLoading ? (
              <p className="mt-3 text-xs text-[rgba(255,255,255,0.4)]">Loading…</p>
            ) : appointments.length === 0 ? (
              <p className="mt-3 text-xs text-[rgba(255,255,255,0.4)]">No appointments scheduled.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {appointments.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-[var(--border)] bg-[#161616] p-3 text-sm text-white"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{a.title}</p>
                        <p className="mt-1 text-xs text-[rgba(255,255,255,0.45)]">
                          {a.date ?? "—"} · {formatAppointmentTime(a.time)}
                          {a.owner ? ` · ${a.owner}` : ""}
                        </p>
                        {a.description?.trim() ? (
                          <p className="mt-2 text-xs font-light text-[rgba(255,255,255,0.55)]">{a.description}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeleteApptId(a.id)}
                        className="shrink-0 text-xs text-[#fca5a5] hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-10">
            <button
              type="button"
              onClick={() => setDeleteLeadModalOpen(true)}
              className="w-full rounded-[8px] border px-3 py-2 text-sm text-[#fca5a5] transition-colors hover:bg-[rgba(239,68,68,0.08)]"
              style={{ borderColor: "rgba(239,68,68,0.3)" }}
            >
              Delete Lead
            </button>
          </section>
        </div>
      </aside>

      <DeleteConfirmModal
        open={deleteApptId != null}
        title="Delete appointment"
        message="Remove this appointment? This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => setDeleteApptId(null)}
        onConfirm={() => void confirmDeleteAppointment()}
      />

      {deleteLeadModalOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-[8px] border border-[var(--border)] bg-[#161616] p-5">
            <h3 className="section-title">Delete Lead</h3>
            <p className="mt-2 text-sm font-light leading-relaxed text-[rgba(255,255,255,0.55)]">
              This action is permanent and cannot be undone. All appointments linked to this lead will also be deleted.
            </p>
            <label className="mt-4 block space-y-1">
              <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">Passkey</span>
              <input
                value={deletePasskey}
                onChange={(e) => setDeletePasskey(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteLeadModalOpen(false);
                  setDeletePasskey("");
                }}
                className="btn-ghost rounded-[8px] px-3 py-1.5 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canConfirmDeleteLead || deletingLead}
                onClick={() => void confirmDeleteLead()}
                className="rounded-[8px] bg-[#ef4444] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingLead ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function normalizeLeadSourceSelect(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (CRM_SOURCE_OPTIONS.includes(s as (typeof CRM_SOURCE_OPTIONS)[number])) return s;
  return "Other";
}

function toPgTime(htmlTime: string): string | null {
  const t = htmlTime?.trim();
  if (!t) return null;
  if (t.length === 5 && t.includes(":")) return `${t}:00`;
  return t.length >= 8 ? t.slice(0, 8) : t;
}
