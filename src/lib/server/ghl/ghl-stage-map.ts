export const CRM_LEAD_STATUS_VALUES = [
  "New Lead",
  "In Contact",
  "Proposal Sent",
  "Qualified",
  "Disqualified",
  "Lost",
  "Won",
] as const;

export type CrmLeadStatus = (typeof CRM_LEAD_STATUS_VALUES)[number];

const NAME_TO_STATUS: Record<string, CrmLeadStatus> = {
  "new lead": "New Lead",
  "novo lead": "New Lead",
  new: "New Lead",
  novo: "New Lead",
  lead: "New Lead",
  "in contact": "In Contact",
  contact: "In Contact",
  contato: "In Contact",
  contacted: "In Contact",
  "proposal sent": "Proposal Sent",
  "proposta enviada": "Proposal Sent",
  proposal: "Proposal Sent",
  proposta: "Proposal Sent",
  "em negociação": "In Contact",
  "em negociacao": "In Contact",
  negociação: "In Contact",
  qualified: "Qualified",
  qualificado: "Qualified",
  disqualified: "Disqualified",
  desqualificado: "Disqualified",
  finalizado: "Won",
  lost: "Lost",
  perdido: "Lost",
  won: "Won",
  ganho: "Won",
  closed: "Won",
  "closed won": "Won",
  "closed lost": "Lost",
};

/** Map GHL opportunity status + pipeline stage name to CRM kanban column. */
export function mapGhlToCrmStatus(opts: {
  opportunityStatus?: string | null;
  stageName?: string | null;
  stageMap?: Record<string, string>;
  stageId?: string | null;
}): CrmLeadStatus {
  const { opportunityStatus, stageName, stageMap, stageId } = opts;
  const status = (opportunityStatus ?? "").trim().toLowerCase();
  if (status === "won") return "Won";
  if (status === "lost") return "Lost";
  if (status === "abandoned") return "Disqualified";

  if (stageId && stageMap?.[stageId]) {
    const mapped = stageMap[stageId].trim();
    if (isCrmLeadStatus(mapped)) return mapped;
  }

  const byName = normalizeStageName(stageName);
  if (byName) return byName;

  return "New Lead";
}

function normalizeStageName(name?: string | null): CrmLeadStatus | null {
  if (!name?.trim()) return null;
  const key = name.trim().toLowerCase();
  if (NAME_TO_STATUS[key]) return NAME_TO_STATUS[key];
  for (const [pattern, status] of Object.entries(NAME_TO_STATUS)) {
    if (key.includes(pattern)) return status;
  }
  return null;
}

function isCrmLeadStatus(value: string): value is CrmLeadStatus {
  return (CRM_LEAD_STATUS_VALUES as readonly string[]).includes(value);
}

export function normalizeLeadStatus(status: string | null | undefined): CrmLeadStatus {
  const s = (status ?? "").trim();
  return isCrmLeadStatus(s) ? s : "New Lead";
}

export function buildStageMapFromPipelines(
  pipelines: Array<{ stages: Array<{ id: string; name: string }> }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pipeline of pipelines) {
    for (const stage of pipeline.stages) {
      const status = mapGhlToCrmStatus({ stageName: stage.name });
      out[stage.id] = status;
    }
  }
  return out;
}
