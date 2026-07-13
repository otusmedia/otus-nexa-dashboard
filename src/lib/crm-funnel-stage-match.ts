/**
 * Match GHL / legacy CRM status strings to a client's funnel stage names.
 * Biotecc funnels use Portuguese stage labels while the generic GHL mapper uses English.
 */

const GHL_STAGE_KEYWORDS: Record<string, string[]> = {
  "novo lead": ["novo lead", "new lead"],
  contato: ["em contato", "in contact", "contato"],
  "proposta enviada": ["proposta enviada", "proposal sent"],
  "em negociação": ["em negociação", "em negociacao", "proposta enviada", "em contato"],
  "em negociacao": ["em negociação", "em negociacao", "proposta enviada", "em contato"],
  qualificado: ["qualificado", "qualified"],
  finalizado: ["ganho", "won", "finalizado"],
  desqualificado: ["desqualificado", "disqualified"],
};

const ENGLISH_STATUS_KEYWORDS: Record<string, string[]> = {
  "new lead": ["novo lead", "new lead"],
  "in contact": ["em contato", "in contact", "contato"],
  "proposal sent": ["proposta enviada", "proposal sent"],
  qualified: ["qualificado", "qualified"],
  disqualified: ["desqualificado", "disqualified"],
  lost: ["perdido", "lost"],
  won: ["ganho", "won", "finalizado"],
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function findStageByKeywords(funnelStages: string[], keywords: string[]): string | null {
  const normalizedKeywords = keywords.map(normalizeKey);
  for (const stage of funnelStages) {
    const stageKey = normalizeKey(stage);
    if (normalizedKeywords.some((kw) => stageKey === kw || stageKey.includes(kw) || kw.includes(stageKey))) {
      return stage;
    }
  }
  return null;
}

function resolveByKeywordMap(
  funnelStages: string[],
  raw: string,
  map: Record<string, string[]>,
): string | null {
  const key = normalizeKey(raw);
  const direct = funnelStages.find((stage) => normalizeKey(stage) === key);
  if (direct) return direct;
  const keywords = map[key] ?? [key];
  return findStageByKeywords(funnelStages, keywords);
}

/** Resolve the CRM funnel column name for a lead from GHL stage / opportunity status. */
export function resolveFunnelStageName(
  funnelStages: string[],
  opts: {
    ghlStageName?: string | null;
    opportunityStatus?: string | null;
    legacyStatus?: string | null;
  },
): string {
  const fallback = funnelStages[0] ?? "New Lead";
  const oppStatus = normalizeKey(opts.opportunityStatus ?? "");

  if (oppStatus === "won") {
    return findStageByKeywords(funnelStages, ["ganho", "won", "finalizado"]) ?? fallback;
  }
  if (oppStatus === "lost") {
    return findStageByKeywords(funnelStages, ["perdido", "lost"]) ?? fallback;
  }
  if (oppStatus === "abandoned") {
    return findStageByKeywords(funnelStages, ["desqualificado", "disqualified"]) ?? fallback;
  }

  if (opts.ghlStageName?.trim()) {
    const match = resolveByKeywordMap(funnelStages, opts.ghlStageName, GHL_STAGE_KEYWORDS);
    if (match) return match;
  }

  if (opts.legacyStatus?.trim()) {
    const match = resolveByKeywordMap(funnelStages, opts.legacyStatus, ENGLISH_STATUS_KEYWORDS);
    if (match) return match;
  }

  return fallback;
}

/** Normalize a stored lead status to a funnel stage (handles English legacy imports). */
export function matchLeadStatusToFunnelStage(
  status: string | null | undefined,
  funnelStages: Array<{ name: string }>,
): string {
  const stageNames = funnelStages.map((s) => s.name);
  if (!stageNames.length) return (status ?? "").trim() || "New Lead";

  const trimmed = (status ?? "").trim();
  if (!trimmed) return stageNames[0];

  const direct = stageNames.find((name) => normalizeKey(name) === normalizeKey(trimmed));
  if (direct) return direct;

  return resolveFunnelStageName(stageNames, { legacyStatus: trimmed }) ?? stageNames[0];
}
