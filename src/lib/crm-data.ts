import { formatDisplayDate } from "@/app/(platform)/projects/data";
import type { AppLanguage } from "@/lib/locale-types";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

export type CrmAppointmentStatus = "pending" | "done";

export const CRM_LEAD_STATUSES = [
  "New Lead",
  "In Contact",
  "Proposal Sent",
  "Qualified",
  "Disqualified",
  "Lost",
  "Won",
] as const;

export type CrmLeadStatus = (typeof CRM_LEAD_STATUSES)[number];

export const CRM_SOURCE_OPTIONS = [
  "Website",
  "Referral",
  "Social Media",
  "Cold Outreach",
  "Event",
  "Go High Level",
  "Other",
] as const;

export type CrmSourceOption = (typeof CRM_SOURCE_OPTIONS)[number];

export const CRM_TEAM_MEMBERS = [
  "Matheus Canci",
  "David Martins",
  "Matheus Foletto",
  "Joe",
  "Karla",
  "Luca",
] as const;

export type CrmTeamMember = (typeof CRM_TEAM_MEMBERS)[number];

export const CRM_KANBAN_COLUMNS: Array<{
  id: CrmLeadStatus;
  label: string;
  dotClass: string;
}> = [
  { id: "New Lead", label: "New Lead", dotClass: "bg-blue-500" },
  { id: "In Contact", label: "In Contact", dotClass: "bg-yellow-400" },
  { id: "Proposal Sent", label: "Proposal Sent", dotClass: "bg-purple-500" },
  { id: "Qualified", label: "Qualified", dotClass: "bg-green-500" },
  { id: "Disqualified", label: "Disqualified", dotClass: "bg-gray-500" },
  { id: "Lost", label: "Lost", dotClass: "bg-red-500" },
  { id: "Won", label: "Won", dotClass: "bg-emerald-500" },
];

export const CRM_LEAD_SOURCE_LABELS: CrmSourceOption[] = [...CRM_SOURCE_OPTIONS];

export interface CrmLead {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  owner: string | null;
  source: string | null;
  value: number;
  description: string | null;
  notes: string | null;
  client_slug: string | null;
  external_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrmAppointment {
  id: string;
  lead_id: string;
  title: string;
  date: string | null;
  time: string | null;
  description: string | null;
  owner: string | null;
  status: CrmAppointmentStatus;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
}

export function isCrmAppointmentDone(a: Pick<CrmAppointment, "status" | "completed_at">): boolean {
  return a.status === "done" || Boolean(a.completed_at?.trim());
}

export function formatCrmAppointmentCompletedAt(iso: string | null, lang: AppLanguage): string {
  if (!iso?.trim()) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(lang === "pt-BR" ? "pt-BR" : "en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export type CrmActivityLogEntry = {
  id: string;
  client_slug: string | null;
  lead_id: string | null;
  appointment_id: string | null;
  event_type: string;
  actor_name: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export function mapCrmActivityLogRow(row: Record<string, unknown>): CrmActivityLogEntry {
  const payloadRaw = row.payload;
  const payload =
    payloadRaw && typeof payloadRaw === "object" && !Array.isArray(payloadRaw)
      ? (payloadRaw as Record<string, unknown>)
      : {};
  return {
    id: String(row.id ?? ""),
    client_slug: row.client_slug != null ? String(row.client_slug) : null,
    lead_id: row.lead_id != null ? String(row.lead_id) : null,
    appointment_id: row.appointment_id != null ? String(row.appointment_id) : null,
    event_type: String(row.event_type ?? ""),
    actor_name: row.actor_name != null ? String(row.actor_name) : null,
    payload,
    created_at: String(row.created_at ?? ""),
  };
}

export function crmAppointmentCompletionErrorMessage(
  error: string,
  lang: AppLanguage,
): string {
  if (error === "MISSING_ACTOR") {
    return lang === "pt-BR"
      ? "Informe seu nome no perfil para registrar quem concluiu o compromisso."
      : "Add your name in profile settings to record who completed this appointment.";
  }
  const lower = error.toLowerCase();
  if (lower.includes("completed_at") || lower.includes("completed_by") || lower.includes("status")) {
    return lang === "pt-BR"
      ? "Atualize o banco (script crm-appointment-completion.sql) e tente novamente."
      : "Run the crm-appointment-completion.sql migration in Supabase and try again.";
  }
  return error;
}

export async function completeCrmAppointment(
  appointmentId: string,
  completedBy: string,
  lang: AppLanguage,
): Promise<{ ok: true; leadId: string | null } | { ok: false; error: string }> {
  const trimmedBy = completedBy.trim();
  if (!trimmedBy) return { ok: false, error: "MISSING_ACTOR" };

  const { data: apptRow, error: fetchErr } = await supabase
    .from("crm_appointments")
    .select("id, lead_id, title")
    .eq("id", appointmentId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!apptRow) return { ok: false, error: "Appointment not found" };

  const leadId = apptRow.lead_id != null ? String(apptRow.lead_id) : null;
  let clientSlug: string | null = null;

  if (leadId) {
    const { data: leadRow } = await supabase
      .from("crm_leads")
      .select("client_slug")
      .eq("id", leadId)
      .maybeSingle();
    clientSlug = leadRow?.client_slug != null ? String(leadRow.client_slug) : null;
  }

  const completedAt = new Date().toISOString();
  const { error } = await supabase
    .from("crm_appointments")
    .update({
      status: "done",
      completed_at: completedAt,
      completed_by: trimmedBy,
    })
    .eq("id", appointmentId);

  if (error) return { ok: false, error: error.message };

  const completionLabel = formatCrmAppointmentCompletedAt(completedAt, lang);
  const logLine =
    lang === "pt-BR"
      ? `\n✓ Concluído por ${trimmedBy} em ${completionLabel}`
      : `\n✓ Completed by ${trimmedBy} on ${completionLabel}`;

  const { data: calRow } = await supabase
    .from("calendar_events")
    .select("id, description")
    .eq("source", "crm")
    .eq("source_id", appointmentId)
    .maybeSingle();

  if (calRow?.id) {
    const prevDesc = calRow.description != null ? String(calRow.description) : "";
    const alreadyLogged = prevDesc.includes("✓ Concluído") || prevDesc.includes("✓ Completed");
    const description = alreadyLogged ? prevDesc : `${prevDesc.trim()}${logLine}`.trim();
    await supabase
      .from("calendar_events")
      .update({ description, color: "#6b7280" })
      .eq("id", String(calRow.id));
  }

  const appointmentTitle = String(apptRow.title ?? "");
  const { error: logErr } = await supabase.from("crm_activity_log").insert({
    client_slug: clientSlug,
    lead_id: leadId,
    appointment_id: appointmentId,
    event_type: "appointment_completed",
    actor_name: trimmedBy,
    payload: {
      appointment_title: appointmentTitle,
      completed_at: completedAt,
    },
  });
  if (logErr) {
    console.error("[crm] activity log insert failed:", logErr.message);
  }

  return { ok: true, leadId };
}

export interface CrmContact {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  source: string | null;
  notes: string | null;
  client_slug: string | null;
  external_id: string | null;
  created_at: string;
}

export function mapCrmLeadRow(row: Record<string, unknown>): CrmLead {
  const v = row.value;
  const num =
    v == null || v === "" ? 0 : typeof v === "number" ? v : Number.parseFloat(String(v));
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    company: row.company != null ? String(row.company) : null,
    email: row.email != null ? String(row.email) : null,
    phone: row.phone != null ? String(row.phone) : null,
    status: String(row.status ?? "New Lead"),
    owner: row.owner != null ? String(row.owner) : null,
    source: row.source != null ? String(row.source) : null,
    value: Number.isFinite(num) ? num : 0,
    description: row.description != null ? String(row.description) : null,
    notes: row.notes != null ? String(row.notes) : null,
    client_slug: row.client_slug != null ? String(row.client_slug) : null,
    external_id: row.external_id != null ? String(row.external_id) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function mapCrmAppointmentRow(row: Record<string, unknown>): CrmAppointment {
  const statusRaw = String(row.status ?? "").trim().toLowerCase();
  const status: CrmAppointmentStatus =
    statusRaw === "done" || row.completed_at != null ? "done" : "pending";
  return {
    id: String(row.id ?? ""),
    lead_id: String(row.lead_id ?? ""),
    title: String(row.title ?? ""),
    date: row.date != null ? String(row.date).slice(0, 10) : null,
    time: row.time != null ? String(row.time) : null,
    description: row.description != null ? String(row.description) : null,
    owner: row.owner != null ? String(row.owner) : null,
    status,
    completed_at: row.completed_at != null ? String(row.completed_at) : null,
    completed_by: row.completed_by != null ? String(row.completed_by) : null,
    created_at: String(row.created_at ?? ""),
  };
}

export function mapCrmContactRow(row: Record<string, unknown>): CrmContact {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    company: row.company != null ? String(row.company) : null,
    email: row.email != null ? String(row.email) : null,
    phone: row.phone != null ? String(row.phone) : null,
    role: row.role != null ? String(row.role) : null,
    source: row.source != null ? String(row.source) : null,
    notes: row.notes != null ? String(row.notes) : null,
    client_slug: row.client_slug != null ? String(row.client_slug) : null,
    external_id: row.external_id != null ? String(row.external_id) : null,
    created_at: String(row.created_at ?? ""),
  };
}

export function normalizeLeadStatus(status: string | null | undefined): CrmLeadStatus {
  const s = (status ?? "").trim();
  return CRM_LEAD_STATUSES.includes(s as CrmLeadStatus) ? (s as CrmLeadStatus) : "New Lead";
}

export function normalizeSource(raw: string | null | undefined): CrmSourceOption {
  const s = (raw ?? "").trim().toLowerCase();
  for (const opt of CRM_SOURCE_OPTIONS) {
    if (opt.toLowerCase() === s) return opt;
  }
  return "Other";
}

export function groupLeadsByStatus(leads: CrmLead[]): Record<CrmLeadStatus, CrmLead[]> {
  const buckets = Object.fromEntries(CRM_KANBAN_COLUMNS.map((c) => [c.id, [] as CrmLead[]])) as Record<
    CrmLeadStatus,
    CrmLead[]
  >;
  for (const lead of leads) {
    const st = normalizeLeadStatus(lead.status);
    buckets[st].push(lead);
  }
  return buckets;
}

export function formatLeadValue(value: number): string {
  return formatCurrency(value);
}

export function formatLeadCreatedAt(iso: string): string {
  return formatDisplayDate(iso || null);
}

export function formatAppointmentTime(time: string | null): string {
  if (!time) return "—";
  const parts = time.slice(0, 8).split(":");
  if (parts.length < 2) return time;
  const h = Number(parts[0]);
  const m = parts[1];
  if (!Number.isFinite(h)) return time;
  const am = h < 12;
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${am ? "AM" : "PM"}`;
}

export function pipelineStageDotClass(status: CrmLeadStatus): string {
  const col = CRM_KANBAN_COLUMNS.find((c) => c.id === status);
  return col?.dotClass ?? "bg-gray-500";
}
