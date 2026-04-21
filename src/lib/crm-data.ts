import { formatDisplayDate } from "@/app/(platform)/projects/data";
import { formatCurrency } from "@/lib/utils";

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
  created_at: string;
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
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export function mapCrmAppointmentRow(row: Record<string, unknown>): CrmAppointment {
  return {
    id: String(row.id ?? ""),
    lead_id: String(row.lead_id ?? ""),
    title: String(row.title ?? ""),
    date: row.date != null ? String(row.date).slice(0, 10) : null,
    time: row.time != null ? String(row.time) : null,
    description: row.description != null ? String(row.description) : null,
    owner: row.owner != null ? String(row.owner) : null,
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
