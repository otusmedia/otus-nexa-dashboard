/**
 * Diagnose GHL-imported CRM data for a client (recovery check).
 *
 * Usage:
 *   npx tsx scripts/ghl-recovery-diagnostic.ts
 *   npx tsx scripts/ghl-recovery-diagnostic.ts --client-slug=biotecc
 */

import { loadGhlEnvFiles, createServiceSupabaseClient } from "./ghl-env";

const OPP_PREFIX = "ghl:opp:";
const CONTACT_PREFIX = "ghl:contact:";

type LeadRow = {
  id: string;
  name: string;
  external_id: string | null;
  form_payload: unknown;
  created_at: string;
};

async function countRows(
  sb: Awaited<ReturnType<typeof createServiceSupabaseClient>>,
  table: "crm_leads" | "crm_contacts",
  clientSlug: string,
  externalPrefix?: string,
): Promise<number> {
  let q = sb.from(table).select("*", { count: "exact", head: true }).eq("client_slug", clientSlug);
  if (externalPrefix) q = q.like("external_id", `${externalPrefix}%`);
  const { count, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function main() {
  loadGhlEnvFiles();
  const args = process.argv.slice(2);
  const clientArg = args.find((a) => a.startsWith("--client-slug="));
  const clientSlug = (clientArg?.split("=")[1] ?? process.env.GHL_CLIENT_SLUG ?? "biotecc").toLowerCase();

  const sb = await createServiceSupabaseClient();

  const ghlLeads = await countRows(sb, "crm_leads", clientSlug, OPP_PREFIX);
  const ghlContacts = await countRows(sb, "crm_contacts", clientSlug, CONTACT_PREFIX);
  const totalLeads = await countRows(sb, "crm_leads", clientSlug);
  const totalContacts = await countRows(sb, "crm_contacts", clientSlug);

  const { data: leadsData, error: leadsErr } = await sb
    .from("crm_leads")
    .select("id, name, external_id, form_payload, created_at")
    .eq("client_slug", clientSlug);
  if (leadsErr) throw new Error(leadsErr.message);

  const leads = (leadsData ?? []) as LeadRow[];
  const leadsWithGhlPayload = leads.filter(
    (r) =>
      r.form_payload != null &&
      typeof r.form_payload === "object" &&
      (r.form_payload as Record<string, unknown>).ghl != null,
  );

  const report = {
    clientSlug,
    checkedAt: new Date().toISOString(),
    ghlLeads,
    ghlContacts,
    leadsWithGhlPayload: leadsWithGhlPayload.length,
    totalLeads,
    totalContacts,
    recoverableInDb: ghlLeads + ghlContacts + leadsWithGhlPayload.length > 0,
    nextSteps:
      ghlLeads + ghlContacts > 0
        ? ["Run: npm run ghl:export -- --client-slug=" + clientSlug]
        : leadsWithGhlPayload.length > 0
          ? ["Run: npm run ghl:export -- --client-slug=" + clientSlug + " --include-ghl-payload"]
          : [
              "No GHL rows in live database.",
              "Check Supabase Dashboard → Database → Backups for PITR/snapshot before deletion.",
              "If you restore a backup, export GHL rows and run: npm run ghl:merge -- --file=backups/...",
            ],
    sampleLeads: leads.slice(0, 8).map((r) => ({
      id: r.id,
      name: r.name,
      external_id: r.external_id,
      hasGhlPayload: Boolean(
        r.form_payload &&
          typeof r.form_payload === "object" &&
          (r.form_payload as Record<string, unknown>).ghl,
      ),
      created_at: r.created_at,
    })),
    supabaseBackupsHint:
      "Supabase Dashboard → Project → Database → Backups. Pro plan: use PITR to restore a point between import and deletion, then export GHL rows.",
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.recoverableInDb ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
