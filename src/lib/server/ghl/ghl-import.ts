import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { writeGhlImportBackup } from "@/lib/server/ghl/ghl-backup";
import { fetchGhlContacts, fetchGhlOpportunities, fetchGhlPipelines } from "@/lib/server/ghl/ghl-client";
import {
  buildCrmContactFromGhl,
  buildCrmLeadFromGhlOpportunity,
  stageNameById,
} from "@/lib/server/ghl/ghl-map";
import {
  buildStageMapFromPipelines,
  mapGhlToCrmStatus,
  normalizeLeadStatus,
} from "@/lib/server/ghl/ghl-stage-map";
import type { GhlImportConfig, GhlImportResult } from "@/lib/server/ghl/ghl-types";

const OPP_EXT_PREFIX = "ghl:opp:";
const CONTACT_EXT_PREFIX = "ghl:contact:";
const UPSERT_BATCH = 50;

type UpsertStats = { inserted: number; updated: number; failed: number; errors: string[] };

function logProgress(msg: string) {
  console.log(`[ghl-import] ${msg}`);
}

async function loadExistingByExternalId(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: "crm_leads" | "crm_contacts",
  clientSlug: string,
  prefix: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data, error } = await supabase
    .from(table)
    .select("id, external_id")
    .eq("client_slug", clientSlug)
    .like("external_id", `${prefix}%`);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const ext = row.external_id != null ? String(row.external_id) : "";
    if (ext) map.set(ext, String(row.id));
  }
  return map;
}

async function persistBatched(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: "crm_leads" | "crm_contacts",
  rows: Record<string, unknown>[],
  existingByExternal: Map<string, string>,
): Promise<UpsertStats> {
  const stats: UpsertStats = { inserted: 0, updated: 0, failed: 0, errors: [] };
  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: Array<{ id: string; row: Record<string, unknown> }> = [];

  for (const row of rows) {
    const ext = String(row.external_id ?? "");
    const id = existingByExternal.get(ext);
    if (id) toUpdate.push({ id, row });
    else toInsert.push(row);
  }

  for (let i = 0; i < toInsert.length; i += UPSERT_BATCH) {
    const chunk = toInsert.slice(i, i + UPSERT_BATCH);
    const { error } = await supabase.from(table).insert(chunk);
    if (error) {
      stats.failed += chunk.length;
      if (stats.errors.length < 5) stats.errors.push(`${table} insert: ${error.message}`);
    } else {
      stats.inserted += chunk.length;
    }
  }

  for (let i = 0; i < toUpdate.length; i += UPSERT_BATCH) {
    const chunk = toUpdate.slice(i, i + UPSERT_BATCH);
    const results = await Promise.all(
      chunk.map(({ id, row }) => supabase.from(table).update(row).eq("id", id)),
    );
    for (const { error } of results) {
      if (error) {
        stats.failed += 1;
        if (stats.errors.length < 5) stats.errors.push(`${table} update: ${error.message}`);
      } else {
        stats.updated += 1;
      }
    }
  }

  return stats;
}

export function loadGhlImportConfigFromEnv(overrides?: Partial<GhlImportConfig>): GhlImportConfig | null {
  const token =
    overrides?.token?.trim() ||
    process.env.GHL_PRIVATE_TOKEN?.trim() ||
    process.env.GHL_API_TOKEN?.trim() ||
    "";
  const locationId =
    overrides?.locationId?.trim() ||
    process.env.GHL_LOCATION_ID?.trim() ||
    "";
  const clientSlug =
    overrides?.clientSlug?.trim() ||
    process.env.GHL_CLIENT_SLUG?.trim() ||
    "biotecc";
  if (!token || !locationId) return null;

  const importContactsEnv = process.env.GHL_IMPORT_CONTACTS?.trim().toLowerCase();
  const importContacts =
    overrides?.importContacts ??
    (importContactsEnv === "false" || importContactsEnv === "0" ? false : true);

  const pipelineIdsFromEnv = process.env.GHL_PIPELINE_IDS?.split(",").map((s) => s.trim()).filter(Boolean);
  const pipelineIds =
    overrides?.pipelineIds?.map((s) => s.trim()).filter(Boolean) ??
    pipelineIdsFromEnv ??
    undefined;

  return {
    token,
    locationId,
    clientSlug: clientSlug.toLowerCase(),
    pipelineId:
      overrides?.pipelineId?.trim() ||
      process.env.GHL_PIPELINE_ID?.trim() ||
      undefined,
    pipelineIds,
    stageMap: overrides?.stageMap,
    dryRun: overrides?.dryRun ?? false,
    importContacts,
  };
}

export async function runGhlImport(config: GhlImportConfig): Promise<GhlImportResult> {
  const result: GhlImportResult = {
    ok: true,
    clientSlug: config.clientSlug,
    dryRun: config.dryRun === true,
    pipelines: 0,
    importedPipelineNames: [],
    contactsFetched: 0,
    contactsInserted: 0,
    contactsUpdated: 0,
    contactsSkipped: 0,
    opportunitiesFetched: 0,
    leadsInserted: 0,
    leadsUpdated: 0,
    leadsSkipped: 0,
    errors: [],
  };

  const supabase = getSupabaseAdmin();

  const { data: clientRow, error: clientErr } = await supabase
    .from("clients")
    .select("slug")
    .eq("slug", config.clientSlug)
    .maybeSingle();
  if (clientErr) throw new Error(clientErr.message);
  if (!clientRow) {
    throw new Error(
      `Cliente "${config.clientSlug}" não existe na tabela clients. Crie o cliente ou ajuste GHL_CLIENT_SLUG.`,
    );
  }

  logProgress("Carregando pipelines do GHL…");
  const pipelines = await fetchGhlPipelines(config.token, config.locationId);
  result.pipelines = pipelines.length;

  const stageMap = {
    ...buildStageMapFromPipelines(pipelines),
    ...(config.stageMap ?? {}),
  };

  const pipelineIdsToImport =
    config.pipelineIds && config.pipelineIds.length > 0
      ? config.pipelineIds
      : config.pipelineId
        ? [config.pipelineId]
        : pipelines.map((p) => p.id);

  const pipelineNameById = new Map(pipelines.map((p) => [p.id, p.name]));
  result.importedPipelineNames = pipelineIdsToImport.map((id) => pipelineNameById.get(id) ?? id);

  logProgress(
    `Importando oportunidades de ${pipelineIdsToImport.length} pipeline(s): ${result.importedPipelineNames.join(", ")}…`,
  );

  const opportunities: Awaited<ReturnType<typeof fetchGhlOpportunities>> = [];
  const seenOppIds = new Set<string>();
  for (const pipelineId of pipelineIdsToImport) {
    const label = pipelineNameById.get(pipelineId) ?? pipelineId;
    logProgress(`Pipeline "${label}"…`);
    const batch = await fetchGhlOpportunities(
      config.token,
      config.locationId,
      pipelineId,
      logProgress,
    );
    for (const opp of batch) {
      if (!seenOppIds.has(opp.id)) {
        seenOppIds.add(opp.id);
        opportunities.push(opp);
      }
    }
  }
  result.opportunitiesFetched = opportunities.length;

  let contacts: Awaited<ReturnType<typeof fetchGhlContacts>> = [];
  if (config.importContacts !== false) {
    logProgress("Carregando contatos…");
    contacts = await fetchGhlContacts(config.token, config.locationId, logProgress);
    result.contactsFetched = contacts.length;
  }

  const contactIdsWithOpp = new Set<string>();
  for (const opp of opportunities) {
    const cid = opp.contactId ?? opp.contact?.id;
    if (cid) contactIdsWithOpp.add(cid);
  }

  const leadPayloads: Record<string, unknown>[] = [];
  for (const opp of opportunities) {
    try {
      const stageName = stageNameById(pipelines, opp.pipelineStageId);
      const crmStatus = normalizeLeadStatus(
        mapGhlToCrmStatus({
          opportunityStatus: opp.status,
          stageName: stageName ?? null,
          stageMap,
          stageId: opp.pipelineStageId,
        }),
      );
      leadPayloads.push(buildCrmLeadFromGhlOpportunity(opp, config.clientSlug, crmStatus, pipelines));
    } catch (e) {
      result.errors.push(`Lead ${opp.id}: ${e instanceof Error ? e.message : String(e)}`);
      result.leadsSkipped += 1;
    }
  }

  const contactPayloads: Record<string, unknown>[] = [];
  for (const contact of contacts) {
    if (contactIdsWithOpp.has(contact.id)) {
      result.contactsSkipped += 1;
      continue;
    }
    contactPayloads.push(buildCrmContactFromGhl(contact, config.clientSlug));
  }

  if (!config.dryRun) {
    const backupPath = writeGhlImportBackup({
      clientSlug: config.clientSlug,
      dryRun: false,
      leads: leadPayloads,
      contacts: contactPayloads,
    });
    if (backupPath) logProgress(`Backup salvo em ${backupPath}`);
  }

  logProgress(`Gravando ${leadPayloads.length} leads no CRM…`);
  if (config.dryRun) {
    result.leadsInserted = leadPayloads.length;
  } else {
    const existingLeads = await loadExistingByExternalId(
      supabase,
      "crm_leads",
      config.clientSlug,
      OPP_EXT_PREFIX,
    );
    const leadStats = await persistBatched(supabase, "crm_leads", leadPayloads, existingLeads);
    result.leadsInserted = leadStats.inserted;
    result.leadsUpdated = leadStats.updated;
    result.leadsSkipped += leadStats.failed;
    result.errors.push(...leadStats.errors);
  }

  if (config.importContacts !== false) {
    logProgress(`Gravando ${contactPayloads.length} contatos no CRM…`);
    if (config.dryRun) {
      result.contactsInserted = contactPayloads.length;
    } else {
      const existingContacts = await loadExistingByExternalId(
        supabase,
        "crm_contacts",
        config.clientSlug,
        CONTACT_EXT_PREFIX,
      );
      const contactStats = await persistBatched(supabase, "crm_contacts", contactPayloads, existingContacts);
      result.contactsInserted = contactStats.inserted;
      result.contactsUpdated = contactStats.updated;
      result.contactsSkipped += contactStats.failed;
      result.errors.push(...contactStats.errors);
    }
  }

  if (result.errors.length > 0) {
    result.ok =
      result.leadsInserted + result.leadsUpdated > 0 || result.contactsInserted + result.contactsUpdated > 0;
  }

  logProgress("Concluído.");
  return result;
}
