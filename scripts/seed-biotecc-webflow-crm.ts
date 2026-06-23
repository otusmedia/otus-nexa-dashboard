/**
 * Seed Biotecc Site funnel + CRM form routing defaults.
 * Usage: npx tsx scripts/seed-biotecc-webflow-crm.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* ignore */
  }
}

const STAGES = [
  { name: "New Lead", sort_order: 0, dot_class: "bg-blue-500" },
  { name: "In Contact", sort_order: 1, dot_class: "bg-yellow-400" },
  { name: "Proposal Sent", sort_order: 2, dot_class: "bg-purple-500" },
  { name: "Won", sort_order: 3, dot_class: "bg-emerald-500" },
];

async function ensureSiteFunnel(sb: ReturnType<typeof createClient>, clientSlug: string) {
  const { data: existing } = await sb
    .from("crm_funnels")
    .select("id")
    .eq("client_slug", clientSlug)
    .eq("slug", "site")
    .maybeSingle();

  let funnelId = existing?.id ? String(existing.id) : null;

  if (!funnelId) {
    const { data, error } = await sb
      .from("crm_funnels")
      .insert({ client_slug: clientSlug, slug: "site", name: "Site", sort_order: 2 })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(`create funnel: ${error.message}`);
    funnelId = data?.id ? String(data.id) : null;
  }

  if (!funnelId) throw new Error("missing funnel id");

  const { data: stageRows } = await sb.from("crm_funnel_stages").select("name").eq("funnel_id", funnelId);
  const seen = new Set((stageRows ?? []).map((r) => String(r.name).toLowerCase()));
  const toInsert = STAGES.filter((s) => !seen.has(s.name.toLowerCase())).map((s) => ({
    funnel_id: funnelId,
    ...s,
  }));
  if (toInsert.length) {
    const { error } = await sb.from("crm_funnel_stages").insert(toInsert);
    if (error) throw new Error(`create stages: ${error.message}`);
  }

  return funnelId;
}

async function patchClientIntegration(
  sb: ReturnType<typeof createClient>,
  clientSlug: string,
  patch: Record<string, unknown>,
) {
  const { data, error: readErr } = await sb.from("clients").select("crm_integration").eq("slug", clientSlug).maybeSingle();
  if (readErr) throw new Error(`read client: ${readErr.message}`);

  const current =
    data?.crm_integration && typeof data.crm_integration === "object"
      ? (data.crm_integration as Record<string, unknown>)
      : {};

  const { error } = await sb
    .from("clients")
    .update({ crm_integration: { ...current, ...patch } })
    .eq("slug", clientSlug);
  if (error) throw new Error(`update client: ${error.message}`);
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const funnelId = await ensureSiteFunnel(sb, "biotecc");
  await patchClientIntegration(sb, "biotecc", {
    enabled: true,
    provider: "nexa",
    defaultFunnelSlug: "site",
    defaultSource: "Site",
  });

  console.log("Biotecc Site funnel ready:", funnelId);
  console.log("Next: Settings → Clients → Biotecc → enable CRM ingest, set allowed origins, generate secret, copy Webflow snippet.");
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
