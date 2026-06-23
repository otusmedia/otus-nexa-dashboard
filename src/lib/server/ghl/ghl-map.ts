import type { CrmLeadStatus } from "@/lib/server/ghl/ghl-stage-map";
import type { GhlContact, GhlOpportunity, GhlPipeline } from "@/lib/server/ghl/ghl-types";

type GhlJson = Record<string, unknown>;

const GHL_SOURCE_LABEL = "Go High Level";

function pickString(obj: GhlJson, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return undefined;
}

function pickPhone(raw: GhlJson): string | undefined {
  const direct = pickString(raw, "phone", "phoneNumber");
  if (direct) return direct;
  const additional = raw.additionalPhones;
  if (Array.isArray(additional) && additional[0] && typeof additional[0] === "object") {
    return pickString(additional[0] as GhlJson, "phone");
  }
  return undefined;
}

/** Normalize GHL contact from search API, embedded `contact`, or `relations[]`. */
export function mapGhlContactFromRaw(raw: GhlJson): GhlContact | null {
  const id = pickString(raw, "id", "contactId", "recordId");
  if (!id) return null;

  const firstName = pickString(raw, "firstName", "first_name");
  const lastName = pickString(raw, "lastName", "last_name");
  const contactName = pickString(raw, "contactName", "fullName", "name");
  const name =
    contactName ||
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    pickString(raw, "companyName", "businessName") ||
    "Sem nome";

  const tags = Array.isArray(raw.tags) ? raw.tags.map((t) => String(t)) : [];

  let source = pickString(raw, "source");
  if (!source && raw.attributionSource && typeof raw.attributionSource === "object") {
    const att = raw.attributionSource as GhlJson;
    source = pickString(att, "medium", "sessionSource");
  }

  return {
    id,
    name,
    firstName,
    lastName,
    email: pickString(raw, "email"),
    phone: pickPhone(raw),
    companyName: pickString(raw, "companyName", "businessName"),
    source,
    tags: tags.length ? tags : undefined,
    assignedTo: pickString(raw, "assignedTo", "assigned_to"),
    dateAdded: pickString(raw, "dateAdded", "createdAt"),
    type: pickString(raw, "type"),
    city: pickString(raw, "city"),
    state: pickString(raw, "state"),
    country: pickString(raw, "country"),
  };
}

function primaryRelationContact(raw: GhlJson): GhlContact | null {
  const relations = raw.relations;
  if (!Array.isArray(relations)) return null;
  const primary =
    relations.find((r) => r && typeof r === "object" && (r as GhlJson).primary === true) ??
    relations[0];
  if (!primary || typeof primary !== "object") return null;
  return mapGhlContactFromRaw(primary as GhlJson);
}

function mergeContacts(base?: GhlContact | null, extra?: GhlContact | null): GhlContact | undefined {
  if (!base && !extra) return undefined;
  if (!base) return extra ?? undefined;
  if (!extra) return base;
  return {
    ...base,
    name: base.name !== "Sem nome" ? base.name : extra.name,
    email: base.email ?? extra.email,
    phone: base.phone ?? extra.phone,
    companyName: base.companyName ?? extra.companyName,
    source: base.source ?? extra.source,
    tags: [...(base.tags ?? []), ...(extra.tags ?? [])].filter(
      (t, i, arr) => arr.indexOf(t) === i,
    ),
    assignedTo: base.assignedTo ?? extra.assignedTo,
  };
}

export function mapGhlOpportunityFromRaw(raw: GhlJson): GhlOpportunity | null {
  const id = pickString(raw, "id");
  if (!id) return null;

  const embedded =
    raw.contact && typeof raw.contact === "object" && !Array.isArray(raw.contact)
      ? mapGhlContactFromRaw(raw.contact as GhlJson)
      : undefined;
  const fromRelation = primaryRelationContact(raw);
  const contact = mergeContacts(embedded, fromRelation);

  return {
    id,
    name: pickString(raw, "name", "title") ?? contact?.name ?? "Oportunidade",
    monetaryValue: pickNumber(raw, "monetaryValue", "monetary_value"),
    status: pickString(raw, "status"),
    pipelineId: pickString(raw, "pipelineId", "pipeline_id"),
    pipelineStageId: pickString(raw, "pipelineStageId", "pipeline_stage_id", "pipelineStageUId"),
    contactId: pickString(raw, "contactId", "contact_id") ?? contact?.id,
    contact,
    assignedTo: pickString(raw, "assignedTo", "assigned_to"),
    source: pickString(raw, "source"),
    createdAt: pickString(raw, "createdAt", "created_at"),
    updatedAt: pickString(raw, "updatedAt", "updated_at"),
    customFields: Array.isArray(raw.customFields) ? raw.customFields : undefined,
    attributions: Array.isArray(raw.attributions) ? raw.attributions : undefined,
  };
}

function pickNumber(obj: GhlJson, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (v == null || v === "") continue;
    const n = typeof v === "number" ? v : Number.parseFloat(String(v));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function pipelineNameById(pipelines: GhlPipeline[], pipelineId?: string | null): string | null {
  if (!pipelineId) return null;
  return pipelines.find((p) => p.id === pipelineId)?.name ?? null;
}

export function stageNameById(pipelines: GhlPipeline[], stageId?: string | null): string | null {
  if (!stageId) return null;
  for (const p of pipelines) {
    const stage = p.stages.find((s) => s.id === stageId);
    if (stage) return stage.name;
  }
  return null;
}

function formatNotes(lines: Array<string | null | undefined>): string {
  return lines.filter((line): line is string => Boolean(line?.trim())).join("\n");
}

export function buildCrmLeadFromGhlOpportunity(
  opp: GhlOpportunity,
  clientSlug: string,
  crmStatus: CrmLeadStatus,
  pipelines: GhlPipeline[],
): Record<string, unknown> {
  const c = opp.contact;
  const stageName = stageNameById(pipelines, opp.pipelineStageId);
  const pipelineName = pipelineNameById(pipelines, opp.pipelineId);
  const leadSource = opp.source?.trim() || c?.source?.trim() || GHL_SOURCE_LABEL;

  const description = formatNotes([
    "Importado do Go High Level.",
    opp.name ? `Oportunidade: ${opp.name}` : null,
    pipelineName ? `Pipeline: ${pipelineName}` : null,
    stageName ? `Estágio: ${stageName}` : null,
    opp.status ? `Status GHL: ${opp.status}` : null,
    c?.tags?.length ? `Tags: ${c.tags.join(", ")}` : null,
    c?.city || c?.state ? `Local: ${[c.city, c.state, c.country].filter(Boolean).join(", ")}` : null,
  ]);

  const notes = formatNotes([
    c?.type ? `Tipo contato: ${c.type}` : null,
    opp.assignedTo ? `Responsável GHL ID: ${opp.assignedTo}` : null,
  ]);

  const row: Record<string, unknown> = {
    name: c?.name?.trim() || opp.name.trim() || "Oportunidade",
    company: c?.companyName?.trim() || null,
    email: c?.email?.trim().toLowerCase() || null,
    phone: c?.phone?.trim() || null,
    status: crmStatus,
    owner: null,
    source: leadSource,
    value: opp.monetaryValue ?? 0,
    proposal_value: opp.monetaryValue ?? 0,
    closed_value: 0,
    description,
    notes: notes || null,
    client_slug: clientSlug,
    external_id: `ghl:opp:${opp.id}`,
    form_payload: {
      ghl: {
        opportunityId: opp.id,
        contactId: opp.contactId ?? c?.id ?? null,
        pipelineId: opp.pipelineId ?? null,
        pipelineStageId: opp.pipelineStageId ?? null,
        status: opp.status ?? null,
        contact: c ?? null,
        customFields: opp.customFields ?? null,
        attributions: opp.attributions ?? null,
      },
    },
  };

  if (opp.createdAt) row.created_at = opp.createdAt;
  if (opp.updatedAt) row.updated_at = opp.updatedAt;

  return row;
}

export function buildCrmContactFromGhl(
  contact: GhlContact,
  clientSlug: string,
): Record<string, unknown> {
  const notes = formatNotes([
    "Importado do Go High Level.",
    contact.type ? `Tipo: ${contact.type}` : null,
    contact.tags?.length ? `Tags: ${contact.tags.join(", ")}` : null,
    contact.city || contact.state
      ? `Local: ${[contact.city, contact.state, contact.country].filter(Boolean).join(", ")}`
      : null,
    contact.source ? `Origem GHL: ${contact.source}` : null,
  ]);

  const row: Record<string, unknown> = {
    name: contact.name.trim() || "Sem nome",
    company: contact.companyName?.trim() || null,
    email: contact.email?.trim().toLowerCase() || null,
    phone: contact.phone?.trim() || null,
    role: null,
    source: contact.source?.trim() || GHL_SOURCE_LABEL,
    notes,
    client_slug: clientSlug,
    external_id: `ghl:contact:${contact.id}`,
  };

  if (contact.dateAdded) row.created_at = contact.dateAdded;

  return row;
}
