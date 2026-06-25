/**
 * Merge GHL snapshot JSON into production CRM (upsert by external_id).
 * Use after restoring a Supabase backup to a temp project and exporting GHL rows.
 *
 * Usage:
 *   npm run ghl:merge -- --file=backups/ghl-biotecc-2026-01-01T12-00-00.json
 *   npm run ghl:merge -- --file=backups/ghl-export-biotecc-.../ghl-snapshot.json --dry-run
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadGhlEnvFiles, createServiceSupabaseClient } from "./ghl-env";

const UPSERT_BATCH = 50;

type ExportBundle = {
  clientSlug?: string;
  leads?: Record<string, unknown>[];
  contacts?: Record<string, unknown>[];
};

type UpsertStats = { inserted: number; updated: number; failed: number; errors: string[] };

async function loadExistingByExternalId(
  sb: Awaited<ReturnType<typeof createServiceSupabaseClient>>,
  table: "crm_leads" | "crm_contacts",
  clientSlug: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data, error } = await sb
    .from(table)
    .select("id, external_id")
    .eq("client_slug", clientSlug)
    .not("external_id", "is", null);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const ext = row.external_id != null ? String(row.external_id) : "";
    if (ext) map.set(ext, String(row.id));
  }
  return map;
}

function stripInternalIds(row: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, ...rest } = row;
  return rest;
}

async function persistBatched(
  sb: Awaited<ReturnType<typeof createServiceSupabaseClient>>,
  table: "crm_leads" | "crm_contacts",
  rows: Record<string, unknown>[],
  existingByExternal: Map<string, string>,
  dryRun: boolean,
): Promise<UpsertStats> {
  const stats: UpsertStats = { inserted: 0, updated: 0, failed: 0, errors: [] };
  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: Array<{ id: string; row: Record<string, unknown> }> = [];

  for (const row of rows) {
    const ext = String(row.external_id ?? "").trim();
    if (!ext) {
      stats.failed += 1;
      if (stats.errors.length < 5) stats.errors.push(`${table}: row missing external_id`);
      continue;
    }
    const payload = stripInternalIds(row);
    const id = existingByExternal.get(ext);
    if (id) toUpdate.push({ id, row: payload });
    else toInsert.push(payload);
  }

  if (dryRun) {
    stats.inserted = toInsert.length;
    stats.updated = toUpdate.length;
    return stats;
  }

  for (let i = 0; i < toInsert.length; i += UPSERT_BATCH) {
    const chunk = toInsert.slice(i, i + UPSERT_BATCH);
    const { error } = await sb.from(table).insert(chunk);
    if (error) {
      stats.failed += chunk.length;
      if (stats.errors.length < 5) stats.errors.push(`${table} insert: ${error.message}`);
    } else {
      stats.inserted += chunk.length;
    }
  }

  for (const { id, row } of toUpdate) {
    const { error } = await sb.from(table).update(row).eq("id", id);
    if (error) {
      stats.failed += 1;
      if (stats.errors.length < 5) stats.errors.push(`${table} update: ${error.message}`);
    } else {
      stats.updated += 1;
    }
  }

  return stats;
}

async function main() {
  loadGhlEnvFiles();
  const args = process.argv.slice(2);
  const fileArg = args.find((a) => a.startsWith("--file="));
  const clientArg = args.find((a) => a.startsWith("--client-slug="));
  const dryRun = args.includes("--dry-run");

  if (!fileArg) {
    console.error("Usage: npm run ghl:merge -- --file=backups/ghl-snapshot.json [--dry-run]");
    process.exit(1);
  }

  const filePath = resolve(process.cwd(), fileArg.split("=")[1] ?? "");
  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as ExportBundle;
  const clientSlug = (
    clientArg?.split("=")[1] ??
    parsed.clientSlug ??
    process.env.GHL_CLIENT_SLUG ??
    "biotecc"
  ).toLowerCase();
  const leads = (parsed.leads ?? []).filter((r) => String(r.client_slug ?? clientSlug) === clientSlug);
  const contacts = (parsed.contacts ?? []).filter((r) => String(r.client_slug ?? clientSlug) === clientSlug);

  const sb = await createServiceSupabaseClient();

  const existingLeads = await loadExistingByExternalId(sb, "crm_leads", clientSlug);
  const existingContacts = await loadExistingByExternalId(sb, "crm_contacts", clientSlug);

  const leadStats = await persistBatched(sb, "crm_leads", leads, existingLeads, dryRun);
  const contactStats = await persistBatched(sb, "crm_contacts", contacts, existingContacts, dryRun);

  const summary = {
    clientSlug,
    dryRun,
    file: filePath,
    leads: { total: leads.length, ...leadStats },
    contacts: { total: contacts.length, ...contactStats },
  };

  console.log(JSON.stringify(summary, null, 2));
  const ok = leadStats.inserted + leadStats.updated + contactStats.inserted + contactStats.updated > 0;
  process.exit(ok || dryRun ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
