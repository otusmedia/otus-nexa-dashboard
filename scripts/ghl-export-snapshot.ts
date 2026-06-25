/**
 * Export GHL-imported CRM rows (or rows with form_payload.ghl) to JSON + CSV.
 *
 * Usage:
 *   npm run ghl:export -- --client-slug=biotecc
 *   npm run ghl:export -- --client-slug=biotecc --include-ghl-payload
 *   npm run ghl:export -- --file=backups/ghl-biotecc-2026-01-01.json  (re-export from backup file)
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { loadGhlEnvFiles, createServiceSupabaseClient } from "./ghl-env";

const OPP_PREFIX = "ghl:opp:";
const CONTACT_PREFIX = "ghl:contact:";

type ExportBundle = {
  exportedAt: string;
  clientSlug: string;
  source: "database" | "backup-file";
  leads: Record<string, unknown>[];
  contacts: Record<string, unknown>[];
};

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function leadsToCsv(leads: Record<string, unknown>[]): string {
  const headers = [
    "id",
    "external_id",
    "name",
    "email",
    "phone",
    "company",
    "status",
    "source",
    "value",
    "proposal_value",
    "closed_value",
    "owner",
    "created_at",
    "updated_at",
  ];
  const lines = [headers.join(",")];
  for (const row of leads) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

function contactsToCsv(contacts: Record<string, unknown>[]): string {
  const headers = ["id", "external_id", "name", "email", "phone", "company", "source", "role", "created_at"];
  const lines = [headers.join(",")];
  for (const row of contacts) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
}

function hasGhlPayload(row: Record<string, unknown>): boolean {
  const fp = row.form_payload;
  return fp != null && typeof fp === "object" && (fp as Record<string, unknown>).ghl != null;
}

async function fetchFromDatabase(
  sb: Awaited<ReturnType<typeof createServiceSupabaseClient>>,
  clientSlug: string,
  includeGhlPayload: boolean,
): Promise<{ leads: Record<string, unknown>[]; contacts: Record<string, unknown>[] }> {
  const { data: ghlLeads, error: le } = await sb
    .from("crm_leads")
    .select("*")
    .eq("client_slug", clientSlug)
    .like("external_id", `${OPP_PREFIX}%`);
  if (le) throw new Error(le.message);

  const { data: ghlContacts, error: ce } = await sb
    .from("crm_contacts")
    .select("*")
    .eq("client_slug", clientSlug)
    .like("external_id", `${CONTACT_PREFIX}%`);
  if (ce) throw new Error(ce.message);

  let leads = (ghlLeads ?? []) as Record<string, unknown>[];

  if (includeGhlPayload) {
    const { data: payloadLeads, error: pe } = await sb
      .from("crm_leads")
      .select("*")
      .eq("client_slug", clientSlug);
    if (pe) throw new Error(pe.message);
    const extra = ((payloadLeads ?? []) as Record<string, unknown>[]).filter(
      (r) => hasGhlPayload(r) && !String(r.external_id ?? "").startsWith(OPP_PREFIX),
    );
    const seen = new Set(leads.map((r) => String(r.id)));
    for (const row of extra) {
      if (!seen.has(String(row.id))) leads.push(row);
    }
  }

  return {
    leads,
    contacts: (ghlContacts ?? []) as Record<string, unknown>[],
  };
}

async function main() {
  loadGhlEnvFiles();
  const args = process.argv.slice(2);
  const clientArg = args.find((a) => a.startsWith("--client-slug="));
  const fileArg = args.find((a) => a.startsWith("--file="));
  const outArg = args.find((a) => a.startsWith("--out="));
  const includeGhlPayload = args.includes("--include-ghl-payload");
  const clientSlug = (clientArg?.split("=")[1] ?? process.env.GHL_CLIENT_SLUG ?? "biotecc").toLowerCase();

  let bundle: ExportBundle;

  if (fileArg) {
    const filePath = resolve(process.cwd(), fileArg.split("=")[1] ?? "");
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as ExportBundle;
    bundle = {
      exportedAt: new Date().toISOString(),
      clientSlug: parsed.clientSlug ?? clientSlug,
      source: "backup-file",
      leads: parsed.leads ?? [],
      contacts: parsed.contacts ?? [],
    };
  } else {
    const sb = await createServiceSupabaseClient();
    const { leads, contacts } = await fetchFromDatabase(sb, clientSlug, includeGhlPayload);
    bundle = {
      exportedAt: new Date().toISOString(),
      clientSlug,
      source: "database",
      leads,
      contacts,
    };
  }

  const stamp = bundle.exportedAt.replace(/[:.]/g, "-").slice(0, 19);
  const outDir = resolve(process.cwd(), outArg?.split("=")[1] ?? join("backups", `ghl-export-${clientSlug}-${stamp}`));
  mkdirSync(outDir, { recursive: true });

  const jsonPath = join(outDir, "ghl-snapshot.json");
  const leadsCsvPath = join(outDir, "leads.csv");
  const contactsCsvPath = join(outDir, "contacts.csv");

  writeFileSync(jsonPath, JSON.stringify(bundle, null, 2), "utf8");
  writeFileSync(leadsCsvPath, leadsToCsv(bundle.leads), "utf8");
  writeFileSync(contactsCsvPath, contactsToCsv(bundle.contacts), "utf8");

  const summary = {
    clientSlug: bundle.clientSlug,
    source: bundle.source,
    leads: bundle.leads.length,
    contacts: bundle.contacts.length,
    jsonPath,
    leadsCsvPath,
    contactsCsvPath,
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(bundle.leads.length + bundle.contacts.length > 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
