/**
 * Remove GHL-imported CRM rows for a client (external_id prefix).
 *
 * Usage:
 *   npx tsx scripts/ghl-cleanup.ts
 *   npx tsx scripts/ghl-cleanup.ts --client-slug=biotecc
 *   npx tsx scripts/ghl-cleanup.ts --dry-run
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") process.env[key] = val;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

const OPP_PREFIX = "ghl:opp:";
const CONTACT_PREFIX = "ghl:contact:";

async function purgeTable(
  sb: ReturnType<typeof import("@supabase/supabase-js").createClient>,
  table: "crm_leads" | "crm_contacts",
  clientSlug: string,
  prefix: string,
  dryRun: boolean,
): Promise<number> {
  let total = 0;
  for (let round = 0; round < 100; round++) {
    const { data, error } = await sb
      .from(table)
      .select("id")
      .eq("client_slug", clientSlug)
      .like("external_id", `${prefix}%`)
      .limit(500);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data?.length) break;
    if (dryRun) {
      total += data.length;
      if (data.length < 500) break;
      continue;
    }
    const ids = data.map((r) => r.id);
    const { error: delErr } = await sb.from(table).delete().in("id", ids);
    if (delErr) throw new Error(`${table} delete: ${delErr.message}`);
    total += ids.length;
    if (data.length < 500) break;
  }
  return total;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const clientArg = args.find((a) => a.startsWith("--client-slug="));
  const clientSlug = (clientArg?.split("=")[1] ?? process.env.GHL_CLIENT_SLUG ?? "biotecc").toLowerCase();

  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const sb = createClient(url, key);
  console.log(
    `${dryRun ? "[dry-run] " : ""}Removing GHL import for client "${clientSlug}"…`,
  );

  const leads = await purgeTable(sb, "crm_leads", clientSlug, OPP_PREFIX, dryRun);
  const contacts = await purgeTable(sb, "crm_contacts", clientSlug, CONTACT_PREFIX, dryRun);

  const { count: leadsLeft } = await sb
    .from("crm_leads")
    .select("*", { count: "exact", head: true })
    .eq("client_slug", clientSlug)
    .like("external_id", `${OPP_PREFIX}%`);
  const { count: contactsLeft } = await sb
    .from("crm_contacts")
    .select("*", { count: "exact", head: true })
    .eq("client_slug", clientSlug)
    .like("external_id", `${CONTACT_PREFIX}%`);

  console.log(
    JSON.stringify(
      {
        clientSlug,
        dryRun,
        leadsRemoved: leads,
        contactsRemoved: contacts,
        ghlLeadsRemaining: leadsLeft ?? 0,
        ghlContactsRemaining: contactsLeft ?? 0,
      },
      null,
      2,
    ),
  );

  if (!dryRun && (leadsLeft ?? 0) + (contactsLeft ?? 0) > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
