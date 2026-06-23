"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { supabase } from "@/lib/supabase";
import {
  CRM_KANBAN_COLUMNS,
  CRM_RESUME_INITIAL_STATUS,
  CRM_RESUME_KANBAN_COLUMNS,
  leadClosedValue,
  leadProposalValue,
  normalizeCrmSourceSelect,
  completeCrmAppointment,
  crmAppointmentCompletionErrorMessage,
  crmMoneyInputValue,
  formatAppointmentTime,
  formatCrmAppointmentCompletedAt,
  formatLeadCreatedAt,
  isCrmAppointmentDone,
  isResumeLead,
  isSalesLead,
  mapCrmActivityLogRow,
  mapCrmAppointmentRow,
  mapCrmLeadRow,
  type CrmActivityLogEntry,
  normalizeLeadStatus,
  normalizeResumeStatus,
  type CrmAppointment,
  type CrmLead,
  type CrmLeadStatus,
  type CrmResumeStatus,
  pipelineStageDotClass,
  resumeStageDotClass,
} from "@/lib/crm-data";
import { clientCrmResumesEnabledForSlug } from "@/lib/client-crm-features";
import { crmLeadStatusLabel, crmResumeStatusLabel, crmSourceLabel } from "@/lib/crm-i18n";
import { findCrmOwnerUser, resolveCrmOwnerOptions } from "@/lib/crm-team-members";
import { formatCurrency, cn } from "@/lib/utils";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { dispatchCrmAppointmentCompleted } from "@/lib/crm-appointment-events";
import { CrmSourceField } from "@/modules/crm/crm-source-field";
import { useCrmSourceOptions } from "@/modules/crm/use-crm-source-options";
import {
  funnelStageDotClass,
  isResumeFunnelSlug,
  isSalesFunnelSlug,
  normalizeFunnelStageStatus,
  SALES_FUNNEL_TRANSFER_STATUS,
  shouldTransferLeadToSalesFunnel,
  type CrmFunnelDef,
} from "@/lib/crm-funnels";

function statusBadgeClass(lead: CrmLead, status: string, funnelConfig?: CrmFunnelDef) {
  if (funnelConfig) return funnelStageDotClass(funnelConfig, status);
  if (isResumeLead(lead)) return resumeStageDotClass(status as CrmResumeStatus);
  return pipelineStageDotClass(status as CrmLeadStatus);
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
  funnelConfig,
  onClose,
  onLeadUpdated,
  onLeadDeleted,
  onLeadMovedToResume,
  resumesEnabled,
}: {
  lead: CrmLead;
  funnelConfig?: CrmFunnelDef;
  onClose: () => void;
  onLeadUpdated: (lead: CrmLead) => void;
  onLeadDeleted: (leadId: string) => void;
  onLeadMovedToResume?: (leadId: string) => void;
  resumesEnabled?: boolean;
}) {
  const { currentUser, users, dataClientSlug, clients, pushNotification } = useAppContext();
  const { language, t: lt } = useLanguage();
  const ownerOptions = useMemo(
    () => resolveCrmOwnerOptions(users, dataClientSlug, currentUser),
    [users, dataClientSlug, currentUser],
  );
  const eventClientSlug = (lead.client_slug ?? dataClientSlug ?? "").trim() || null;
  const crmClientSlug = eventClientSlug ?? dataClientSlug;
  const resumesFeatureEnabled =
    resumesEnabled ?? clientCrmResumesEnabledForSlug(clients, crmClientSlug);
  const { sourceOptions, rememberSource } = useCrmSourceOptions(crmClientSlug);
  const [nameDraft, setNameDraft] = useState(lead.name);
  const [propDraft, setPropDraft] = useState({
    owner: lead.owner ?? "",
    company: lead.company ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    source: normalizeCrmSourceSelect(lead.source, crmClientSlug),
    proposalValueStr: crmMoneyInputValue(leadProposalValue(lead)),
    closedValueStr: crmMoneyInputValue(leadClosedValue(lead)),
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
  const [completingApptId, setCompletingApptId] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<CrmActivityLogEntry[]>([]);
  const [activityLogLoading, setActivityLogLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deleteLeadModalOpen, setDeleteLeadModalOpen] = useState(false);
  const [deletePasskey, setDeletePasskey] = useState("");
  const [deletingLead, setDeletingLead] = useState(false);
  const [markResumeModalOpen, setMarkResumeModalOpen] = useState(false);
  const [markingResume, setMarkingResume] = useState(false);
  const [moveBackToSalesModalOpen, setMoveBackToSalesModalOpen] = useState(false);
  const [movingBackToSales, setMovingBackToSales] = useState(false);

  const syncFromLead = useCallback((l: CrmLead) => {
    setNameDraft(l.name);
    setPropDraft({
      owner: l.owner ?? "",
      company: l.company ?? "",
      email: l.email ?? "",
      phone: l.phone ?? "",
      source: normalizeCrmSourceSelect(l.source, l.client_slug ?? dataClientSlug),
      proposalValueStr: crmMoneyInputValue(leadProposalValue(l)),
      closedValueStr: crmMoneyInputValue(leadClosedValue(l)),
    });
    setDescDraft(l.description ?? "");
    setNotesDraft(l.notes ?? "");
  }, [dataClientSlug]);

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

  const loadActivityLog = useCallback(async () => {
    setActivityLogLoading(true);
    const { data, error } = await supabase
      .from("crm_activity_log")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      console.error("[crm activity log]", error.message);
      setActivityLog([]);
    } else {
      setActivityLog((data ?? []).map((row) => mapCrmActivityLogRow(row as Record<string, unknown>)));
    }
    setActivityLogLoading(false);
  }, [lead.id]);

  useEffect(() => {
    void loadAppointments();
    void loadActivityLog();

    const channel = supabase
      .channel(`crm-appointments-${lead.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_appointments", filter: `lead_id=eq.${lead.id}` },
        () => {
          void loadAppointments();
        },
      )
      .subscribe();

    const logChannel = supabase
      .channel(`crm-activity-log-${lead.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_activity_log", filter: `lead_id=eq.${lead.id}` },
        () => {
          void loadActivityLog();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(logChannel);
    };
  }, [loadAppointments, loadActivityLog, lead.id]);

  const propsDirty =
    nameDraft.trim() !== lead.name ||
    (propDraft.owner || "") !== (lead.owner ?? "") ||
    (propDraft.company || "") !== (lead.company ?? "") ||
    (propDraft.email || "") !== (lead.email ?? "") ||
    (propDraft.phone || "") !== (lead.phone ?? "") ||
    propDraft.source.trim() !== (lead.source ?? "").trim() ||
    Number.parseFloat(propDraft.proposalValueStr || "0") !== leadProposalValue(lead) ||
    Number.parseFloat(propDraft.closedValueStr || "0") !== leadClosedValue(lead);

  const descDirty = descDraft !== (lead.description ?? "");
  const notesDirty = notesDraft !== (lead.notes ?? "");

  const ownerTransferPending = useMemo(() => {
    if (!funnelConfig || funnelConfig.isBuiltin) return false;
    const ownerName = propDraft.owner.trim();
    if (!ownerName) return false;
    const ownerUser = findCrmOwnerUser(users, ownerName);
    return shouldTransferLeadToSalesFunnel(funnelConfig, ownerUser);
  }, [funnelConfig, propDraft.owner, users]);

  const saveProperties = async () => {
    const proposalNum = Number.parseFloat(propDraft.proposalValueStr.replace(/,/g, "")) || 0;
    const closedNum = Number.parseFloat(propDraft.closedValueStr.replace(/,/g, "")) || 0;
    const source = propDraft.source.trim();
    const ownerName = propDraft.owner.trim();
    const ownerUser = findCrmOwnerUser(users, ownerName);
    const transferToSales = shouldTransferLeadToSalesFunnel(funnelConfig, ownerUser);
    setPropsSaving(true);
    const now = new Date().toISOString();
    const actor = currentUser.name?.trim() || currentUser.email || "User";
    const clientSlug = (lead.client_slug ?? dataClientSlug ?? "").trim() || null;
    const updatePayload: Record<string, unknown> = {
      name: nameDraft.trim() || lead.name,
      owner: ownerName || null,
      company: propDraft.company.trim() || null,
      email: propDraft.email.trim() || null,
      phone: propDraft.phone.trim() || null,
      source: source || null,
      value: proposalNum,
      proposal_value: proposalNum,
      closed_value: closedNum,
      updated_at: now,
    };
    if (transferToSales) {
      updatePayload.funnel = "sales";
      updatePayload.status = SALES_FUNNEL_TRANSFER_STATUS;
    }
    const { data, error } = await supabase
      .from("crm_leads")
      .update(updatePayload)
      .eq("id", lead.id)
      .select("*")
      .maybeSingle();
    setPropsSaving(false);
    if (error) {
      console.error("[crm] save properties", error.message);
      return;
    }
    if (source) await rememberSource(source);
    if (transferToSales && funnelConfig) {
      const { error: logErr } = await supabase.from("crm_activity_log").insert({
        lead_id: lead.id,
        client_slug: clientSlug,
        actor_name: actor,
        event_type: "lead_transferred_to_sales",
        payload: {
          from_funnel: funnelConfig.slug,
          to_funnel: "sales",
          owner: ownerName,
        },
      });
      if (logErr) console.error("[crm] activity log", logErr.message);
      pushNotification(lt("Lead transferred to Sales pipeline"), "task");
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

  const onStatusChange = async (next: string) => {
    if (funnelConfig && !isSalesFunnelSlug(funnelConfig.slug) && !isResumeFunnelSlug(funnelConfig.slug)) {
      const normalized = normalizeFunnelStageStatus(next, funnelConfig.stages);
      if (normalized === normalizeFunnelStageStatus(lead.status, funnelConfig.stages)) return;
      setStatusUpdating(true);
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("crm_leads")
        .update({ status: normalized, updated_at: now })
        .eq("id", lead.id)
        .select("*")
        .maybeSingle();
      setStatusUpdating(false);
      if (error) {
        console.error("[crm] status", error.message);
        return;
      }
      if (data) onLeadUpdated(mapCrmLeadRow(data as Record<string, unknown>));
      return;
    }

    if (isResumeLead(lead)) {
      const normalized = normalizeResumeStatus(next);
      if (normalized === normalizeResumeStatus(lead.status)) return;
      setStatusUpdating(true);
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("crm_leads")
        .update({ status: normalized, updated_at: now })
        .eq("id", lead.id)
        .select("*")
        .maybeSingle();
      setStatusUpdating(false);
      if (error) {
        console.error("[crm] status", error.message);
        return;
      }
      if (data) onLeadUpdated(mapCrmLeadRow(data as Record<string, unknown>));
      return;
    }

    const nextStatus = next as CrmLeadStatus;
    if (nextStatus === normalizeLeadStatus(lead.status)) return;
    setStatusUpdating(true);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("crm_leads")
      .update({ status: nextStatus, updated_at: now })
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

  const confirmMarkAsResume = async () => {
    if (!isSalesLead(lead)) return;
    setMarkingResume(true);
    const now = new Date().toISOString();
    const actor = currentUser.name?.trim() || currentUser.email || "User";
    const noteLine = lt("Moved to resume funnel by {name} on {date}")
      .replace("{name}", actor)
      .replace("{date}", new Date().toLocaleString(language === "pt-BR" ? "pt-BR" : "en-US"));
    const existingNotes = (lead.notes ?? "").trim();
    const notes = existingNotes ? `${existingNotes}\n\n${noteLine}` : noteLine;
    const clientSlug = (lead.client_slug ?? dataClientSlug ?? "").trim() || null;

    const { data, error } = await supabase
      .from("crm_leads")
      .update({
        funnel: "resume",
        status: CRM_RESUME_INITIAL_STATUS,
        notes,
        updated_at: now,
      })
      .eq("id", lead.id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[crm] mark as resume", error.message);
      setMarkingResume(false);
      return;
    }

    const { error: logErr } = await supabase.from("crm_activity_log").insert({
      lead_id: lead.id,
      client_slug: clientSlug,
      actor_name: actor,
      event_type: "lead_moved_to_resume",
      payload: { from_funnel: "sales", to_funnel: "resume" },
    });
    if (logErr) console.error("[crm] activity log", logErr.message);

    setMarkingResume(false);
    setMarkResumeModalOpen(false);
    if (data) {
      if (onLeadMovedToResume) {
        onLeadMovedToResume(lead.id);
      } else {
        onLeadUpdated(mapCrmLeadRow(data as Record<string, unknown>));
      }
    }
  };

  const confirmMoveBackToSales = async () => {
    if (!isResumeLead(lead)) return;
    setMovingBackToSales(true);
    const now = new Date().toISOString();
    const actor = currentUser.name?.trim() || currentUser.email || "User";
    const noteLine = lt("Moved back to sales funnel as Disqualified by {name} on {date}")
      .replace("{name}", actor)
      .replace("{date}", new Date().toLocaleString(language === "pt-BR" ? "pt-BR" : "en-US"));
    const existingNotes = (lead.notes ?? "").trim();
    const notes = existingNotes ? `${existingNotes}\n\n${noteLine}` : noteLine;
    const clientSlug = (lead.client_slug ?? dataClientSlug ?? "").trim() || null;
    const salesStatus: CrmLeadStatus = "Disqualified";

    const { data, error } = await supabase
      .from("crm_leads")
      .update({
        funnel: "sales",
        status: salesStatus,
        notes,
        updated_at: now,
      })
      .eq("id", lead.id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[crm] move back to sales", error.message);
      setMovingBackToSales(false);
      return;
    }

    const { error: logErr } = await supabase.from("crm_activity_log").insert({
      lead_id: lead.id,
      client_slug: clientSlug,
      actor_name: actor,
      event_type: "lead_moved_to_sales",
      payload: { from_funnel: "resume", to_funnel: "sales", status: salesStatus },
    });
    if (logErr) console.error("[crm] activity log", logErr.message);

    setMovingBackToSales(false);
    setMoveBackToSalesModalOpen(false);
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
        client_slug: eventClientSlug,
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
        const inv = ownerName ? ownerOptions.find((u) => u.name === ownerName) : undefined;
        if (inv?.email) {
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

  const resolveActorName = () =>
    currentUser.name?.trim() || currentUser.email?.trim() || "";

  const markAppointmentDone = async (apptId: string) => {
    const actor = resolveActorName();
    if (!actor) {
      pushNotification(crmAppointmentCompletionErrorMessage("MISSING_ACTOR", language), "task");
      return;
    }
    setCompletingApptId(apptId);
    const result = await completeCrmAppointment(apptId, actor, language);
    setCompletingApptId(null);
    if (!result.ok) {
      const msg = crmAppointmentCompletionErrorMessage(result.error, language);
      pushNotification(`${lt("Could not complete appointment")}: ${msg}`, "task");
      console.error("[crm] complete appointment", result.error);
      return;
    }
    const completedAt = new Date().toISOString();
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === apptId
          ? {
              ...a,
              status: "done",
              completed_at: completedAt,
              completed_by: actor,
            }
          : a,
      ),
    );
    pushNotification(lt("Appointment marked as done"), "task");
    void loadActivityLog();
    dispatchCrmAppointmentCompleted(apptId, result.leadId ?? lead.id);
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

  const isResume = funnelConfig ? isResumeFunnelSlug(funnelConfig.slug) : isResumeLead(lead);
  const isSales = funnelConfig ? isSalesFunnelSlug(funnelConfig.slug) : isSalesLead(lead);
  const currentStatus = funnelConfig
    ? normalizeFunnelStageStatus(lead.status, funnelConfig.stages)
    : isResumeLead(lead)
      ? normalizeResumeStatus(lead.status)
      : normalizeLeadStatus(lead.status);
  const statusColumns = funnelConfig
    ? funnelConfig.stages.map((stage) => ({
        id: stage.name,
        label: stage.name,
        dotClass: stage.dotClass,
      }))
    : isResumeLead(lead)
      ? CRM_RESUME_KANBAN_COLUMNS
      : CRM_KANBAN_COLUMNS;

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
            <p className="mt-1 text-xs text-[rgba(255,255,255,0.35)]">
              {lt("Created")} {formatLeadCreatedAt(lead.created_at)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1 text-xs text-white",
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", statusBadgeClass(lead, currentStatus, funnelConfig))} aria-hidden />
                <select
                  value={currentStatus}
                  disabled={statusUpdating}
                  onChange={(e) => void onStatusChange(e.target.value)}
                  className="border-none bg-transparent text-xs text-white outline-none"
                >
                  {statusColumns.map((c) => (
                    <option key={c.id} value={c.id} className="bg-[#141414]">
                      {funnelConfig && !isSales && !isResume
                        ? c.id
                        : isResume
                          ? crmResumeStatusLabel(c.id, language)
                          : crmLeadStatusLabel(c.id, language)}
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
              {lt("Properties")}
            </h3>
            <div className="mt-3 grid gap-3">
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Owner")}</span>
                <select
                  value={propDraft.owner}
                  onChange={(e) => setPropDraft((p) => ({ ...p, owner: e.target.value }))}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                >
                  <option value="">{lt("Unassigned")}</option>
                  {ownerOptions.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
                {ownerTransferPending ? (
                  <p className="text-xs text-[rgba(255,255,255,0.45)]">
                    {lt("Owner outside funnel transfer hint")}
                  </p>
                ) : null}
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Company")}</span>
                <input
                  value={propDraft.company}
                  onChange={(e) => setPropDraft((p) => ({ ...p, company: e.target.value }))}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Email")}</span>
                <input
                  type="email"
                  value={propDraft.email}
                  onChange={(e) => setPropDraft((p) => ({ ...p, email: e.target.value }))}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Phone")}</span>
                <input
                  value={propDraft.phone}
                  onChange={(e) => setPropDraft((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <div className="block space-y-1">
                <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Source")}</span>
                <CrmSourceField
                  value={propDraft.source}
                  onChange={(next) => setPropDraft((p) => ({ ...p, source: next }))}
                  sourceOptions={sourceOptions}
                  language={language}
                  hint={lt("Select or type a new source")}
                  onCreateOption={rememberSource}
                />
              </div>
              {isSales ? (
                <>
                  <label className="block space-y-1">
                    <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                      {lt("Proposal value")}
                    </span>
                    <input
                      value={propDraft.proposalValueStr}
                      onChange={(e) => setPropDraft((p) => ({ ...p, proposalValueStr: e.target.value }))}
                      inputMode="decimal"
                      className="mono-num w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                    />
                    <span className="text-xs text-[rgba(255,255,255,0.35)]">
                      {lt("Preview")}: {formatCurrency(Number.parseFloat(propDraft.proposalValueStr.replace(/,/g, "")) || 0)}
                    </span>
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                      {lt("Closed value")}
                    </span>
                    <input
                      value={propDraft.closedValueStr}
                      onChange={(e) => setPropDraft((p) => ({ ...p, closedValueStr: e.target.value }))}
                      inputMode="decimal"
                      className="mono-num w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                    />
                    <span className="text-xs text-[rgba(255,255,255,0.35)]">
                      {lt("Preview")}: {formatCurrency(Number.parseFloat(propDraft.closedValueStr.replace(/,/g, "")) || 0)}
                    </span>
                  </label>
                </>
              ) : null}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                disabled={!propsDirty || propsSaving}
                onClick={cancelProperties}
                className="btn-ghost rounded-[8px] px-3 py-1.5 text-xs disabled:opacity-40"
              >
                {lt("Cancel")}
              </button>
              <button
                type="button"
                disabled={!propsDirty || propsSaving}
                onClick={() => void saveProperties()}
                className="btn-primary rounded-[8px] px-3 py-1.5 text-xs disabled:opacity-40"
              >
                {propsSaving ? lt("Saving…") : lt("Save")}
              </button>
            </div>
          </section>

          <section className="mt-8">
            <h3 className="text-[0.65rem] font-normal uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
              {lt("Description")}
            </h3>
            <AutoResizeTextarea
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              minRows={3}
              className="mt-2 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                disabled={!descDirty || descSaving}
                onClick={() => setDescDraft(lead.description ?? "")}
                className="btn-ghost rounded-[8px] px-3 py-1.5 text-xs disabled:opacity-40"
              >
                {lt("Cancel")}
              </button>
              <button
                type="button"
                disabled={!descDirty || descSaving}
                onClick={() => void saveDescription()}
                className="btn-primary rounded-[8px] px-3 py-1.5 text-xs disabled:opacity-40"
              >
                {descSaving ? lt("Saving…") : lt("Save")}
              </button>
            </div>
          </section>

          <section className="mt-8">
            <h3 className="text-[0.65rem] font-normal uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Notes")}</h3>
            <AutoResizeTextarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              minRows={3}
              className="mt-2 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                disabled={!notesDirty || notesSaving}
                onClick={() => setNotesDraft(lead.notes ?? "")}
                className="btn-ghost rounded-[8px] px-3 py-1.5 text-xs disabled:opacity-40"
              >
                {lt("Cancel")}
              </button>
              <button
                type="button"
                disabled={!notesDirty || notesSaving}
                onClick={() => void saveNotes()}
                className="btn-primary rounded-[8px] px-3 py-1.5 text-xs disabled:opacity-40"
              >
                {notesSaving ? lt("Saving…") : lt("Save")}
              </button>
            </div>
          </section>

          <section className="mt-8">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[0.65rem] font-normal uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                {lt("APPOINTMENTS")}
              </h3>
              <button
                type="button"
                onClick={() => setShowApptForm((v) => !v)}
                className="rounded-md border border-[var(--border)] px-2 py-1 text-[0.65rem] text-white hover:bg-[var(--surface-elevated)]"
              >
                {showApptForm ? lt("Close") : lt("Add Appointment")}
              </button>
            </div>

            {showApptForm ? (
              <div className="mt-3 space-y-3 rounded-lg border border-[var(--border)] bg-[#161616] p-3">
                <label className="block space-y-1">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                    {lt("Title")} *
                  </span>
                  <input
                    value={apptDraft.title}
                    onChange={(e) => setApptDraft((p) => ({ ...p, title: e.target.value }))}
                    className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Date")}</span>
                    <input
                      type="date"
                      value={apptDraft.date}
                      onChange={(e) => setApptDraft((p) => ({ ...p, date: e.target.value }))}
                      className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white [color-scheme:dark]"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Time")}</span>
                    <input
                      type="time"
                      value={apptDraft.time}
                      onChange={(e) => setApptDraft((p) => ({ ...p, time: e.target.value }))}
                      className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white [color-scheme:dark]"
                    />
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Owner")}</span>
                  <select
                    value={apptDraft.owner}
                    onChange={(e) => setApptDraft((p) => ({ ...p, owner: e.target.value }))}
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
                <label className="block space-y-1">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                    {lt("Description")}
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
                    {lt("Cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveAppointment()}
                    className="btn-primary rounded-[8px] px-3 py-1.5 text-xs"
                  >
                    {lt("Save")}
                  </button>
                </div>
              </div>
            ) : null}

            {apptsLoading ? (
              <p className="mt-3 text-xs text-[rgba(255,255,255,0.4)]">{lt("Loading…")}</p>
            ) : appointments.length === 0 ? (
              <p className="mt-3 text-xs text-[rgba(255,255,255,0.4)]">{lt("No appointments scheduled.")}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {appointments.map((a) => {
                  const done = isCrmAppointmentDone(a);
                  return (
                    <li
                      key={a.id}
                      className={cn(
                        "rounded-lg border border-[var(--border)] bg-[#161616] p-3 text-sm text-white",
                        done && "opacity-80",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={cn("font-medium", done && "line-through text-[rgba(255,255,255,0.55)]")}>
                              {a.title}
                            </p>
                            {done ? (
                              <span className="rounded-full bg-[rgba(34,197,94,0.15)] px-2 py-0.5 text-[0.65rem] font-medium text-[#86efac]">
                                {lt("Done")}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-[rgba(255,255,255,0.45)]">
                            {a.date ?? "—"} · {formatAppointmentTime(a.time)}
                            {a.owner ? ` · ${a.owner}` : ""}
                          </p>
                          {done && a.completed_by ? (
                            <p className="mt-1 text-xs text-[#86efac]">
                              {lt("Completed by")} {a.completed_by}
                              {a.completed_at
                                ? ` · ${formatCrmAppointmentCompletedAt(a.completed_at, language)}`
                                : ""}
                            </p>
                          ) : null}
                          {a.description?.trim() ? (
                            <p className="mt-2 text-xs font-light text-[rgba(255,255,255,0.55)]">{a.description}</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {!done ? (
                            <button
                              type="button"
                              disabled={completingApptId === a.id}
                              onClick={() => void markAppointmentDone(a.id)}
                              className="rounded-md border border-[rgba(34,197,94,0.35)] px-2 py-1 text-[0.65rem] font-medium text-[#86efac] transition hover:bg-[rgba(34,197,94,0.12)] disabled:opacity-50"
                            >
                              {completingApptId === a.id ? lt("Saving…") : lt("Mark as done")}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setDeleteApptId(a.id)}
                            className="text-xs text-[#fca5a5] hover:underline"
                          >
                            {lt("Delete")}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <h3 className="text-[0.65rem] font-normal uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
              {lt("Activity log")}
            </h3>
            {activityLogLoading ? (
              <p className="mt-3 text-xs text-[rgba(255,255,255,0.4)]">{lt("Loading…")}</p>
            ) : activityLog.length === 0 ? (
              <p className="mt-3 text-xs text-[rgba(255,255,255,0.4)]">{lt("No activity logged")}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {activityLog.map((entry) => {
                  const title =
                    entry.event_type === "appointment_completed"
                      ? String(entry.payload.appointment_title ?? lt("Appointment completed"))
                      : entry.event_type === "lead_moved_to_resume"
                        ? lt("Moved to resume funnel")
                        : entry.event_type === "lead_moved_to_sales"
                          ? lt("Moved back to sales funnel")
                          : entry.event_type;
                  return (
                    <li
                      key={entry.id}
                      className="rounded-lg border border-[var(--border)] bg-[#161616] px-3 py-2 text-xs text-[rgba(255,255,255,0.75)]"
                    >
                      <p className="font-medium text-white">
                        {entry.event_type === "appointment_completed"
                          ? lt("Appointment completed")
                          : entry.event_type === "lead_moved_to_resume"
                            ? lt("Moved to resume funnel")
                            : entry.event_type === "lead_moved_to_sales"
                              ? lt("Moved back to sales funnel")
                              : title}
                        {entry.event_type === "appointment_completed" && title ? `: ${title}` : ""}
                      </p>
                      <p className="mt-1 text-[rgba(255,255,255,0.45)]">
                        {entry.actor_name
                          ? `${entry.event_type === "appointment_completed" ? lt("Completed by") : lt("By")} ${entry.actor_name}`
                          : "—"}
                        {entry.created_at
                          ? ` · ${formatCrmAppointmentCompletedAt(entry.created_at, language)}`
                          : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="mt-10 space-y-3">
            {isSales && resumesFeatureEnabled ? (
              <button
                type="button"
                onClick={() => setMarkResumeModalOpen(true)}
                className="w-full rounded-[8px] border border-[var(--border-strong)] px-3 py-2 text-sm text-[rgba(255,255,255,0.75)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
              >
                {lt("Mark as resume")}
              </button>
            ) : null}
            {isResume && resumesFeatureEnabled ? (
              <button
                type="button"
                onClick={() => setMoveBackToSalesModalOpen(true)}
                className="w-full rounded-[8px] border border-[var(--border-strong)] px-3 py-2 text-sm text-[rgba(255,255,255,0.75)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
              >
                {lt("Move back to sales (Disqualified)")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setDeleteLeadModalOpen(true)}
              className="w-full rounded-[8px] border px-3 py-2 text-sm text-[#fca5a5] transition-colors hover:bg-[rgba(239,68,68,0.08)]"
              style={{ borderColor: "rgba(239,68,68,0.3)" }}
            >
              {lt("Delete Lead")}
            </button>
          </section>
        </div>
      </aside>

      <DeleteConfirmModal
        open={deleteApptId != null}
        title={lt("Delete appointment")}
        message={lt("Remove this appointment? This cannot be undone.")}
        confirmLabel={lt("Delete")}
        cancelLabel={lt("Cancel")}
        onCancel={() => setDeleteApptId(null)}
        onConfirm={() => void confirmDeleteAppointment()}
      />

      {markResumeModalOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-[8px] border border-[var(--border)] bg-[#161616] p-5">
            <h3 className="section-title">{lt("Mark as resume")}</h3>
            <p className="mt-2 text-sm font-light leading-relaxed text-[rgba(255,255,255,0.55)]">
              {lt("This lead will leave the sales pipeline and appear in the Resumes funnel as a new application.")}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMarkResumeModalOpen(false)}
                className="btn-ghost rounded-[8px] px-3 py-1.5 text-xs"
                disabled={markingResume}
              >
                {lt("Cancel")}
              </button>
              <button
                type="button"
                disabled={markingResume}
                onClick={() => void confirmMarkAsResume()}
                className="btn-primary rounded-[8px] px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {markingResume ? lt("Saving…") : lt("Confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {moveBackToSalesModalOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-[8px] border border-[var(--border)] bg-[#161616] p-5">
            <h3 className="section-title">{lt("Move back to sales (Disqualified)")}</h3>
            <p className="mt-2 text-sm font-light leading-relaxed text-[rgba(255,255,255,0.55)]">
              {lt(
                "This application will leave the Resumes funnel and return to the sales pipeline as Disqualified.",
              )}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMoveBackToSalesModalOpen(false)}
                className="btn-ghost rounded-[8px] px-3 py-1.5 text-xs"
                disabled={movingBackToSales}
              >
                {lt("Cancel")}
              </button>
              <button
                type="button"
                disabled={movingBackToSales}
                onClick={() => void confirmMoveBackToSales()}
                className="btn-primary rounded-[8px] px-3 py-1.5 text-xs disabled:opacity-50"
              >
                {movingBackToSales ? lt("Saving…") : lt("Confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteLeadModalOpen ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-[8px] border border-[var(--border)] bg-[#161616] p-5">
            <h3 className="section-title">{lt("Delete Lead")}</h3>
            <p className="mt-2 text-sm font-light leading-relaxed text-[rgba(255,255,255,0.55)]">
              {lt(
                "This action is permanent and cannot be undone. All appointments linked to this lead will also be deleted.",
              )}
            </p>
            <label className="mt-4 block space-y-1">
              <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">{lt("Passkey")}</span>
              <input
                value={deletePasskey}
                onChange={(e) => setDeletePasskey(e.target.value)}
                placeholder={lt("Type DELETE to confirm")}
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
                {lt("Cancel")}
              </button>
              <button
                type="button"
                disabled={!canConfirmDeleteLead || deletingLead}
                onClick={() => void confirmDeleteLead()}
                className="rounded-[8px] bg-[#ef4444] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deletingLead ? lt("Deleting…") : lt("Delete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function toPgTime(htmlTime: string): string | null {
  const t = htmlTime?.trim();
  if (!t) return null;
  if (t.length === 5 && t.includes(":")) return `${t}:00`;
  return t.length >= 8 ? t.slice(0, 8) : t;
}
