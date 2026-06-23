/**
 * Validate Biotecc Webflow → CRM Site funnel integration.
 * Usage: npx tsx scripts/validate-biotecc-webflow-crm.ts [--submit]
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

const CLIENT_SLUG = "biotecc";
const submit = process.argv.includes("--submit");

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env vars in .env.local");
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const issues: string[] = [];
  const ok: string[] = [];

  const { data: client, error: clientErr } = await sb
    .from("clients")
    .select("slug, name, crm_integration")
    .eq("slug", CLIENT_SLUG)
    .maybeSingle();

  if (clientErr || !client) {
    console.error("Client biotecc not found:", clientErr?.message ?? "missing row");
    process.exit(1);
  }

  const integration =
    client.crm_integration && typeof client.crm_integration === "object"
      ? (client.crm_integration as Record<string, unknown>)
      : {};

  const enabled = integration.enabled === true;
  const provider = String(integration.provider ?? "");
  const ingestSecret = String(integration.ingestSecret ?? "").trim();
  const defaultFunnelSlug = String(integration.defaultFunnelSlug ?? "").trim();
  const defaultSource = String(integration.defaultSource ?? "").trim();
  const allowedOrigins = Array.isArray(integration.allowedOrigins)
    ? integration.allowedOrigins.map(String).filter(Boolean)
    : [];

  if (enabled) ok.push("CRM ingest enabled");
  else issues.push("CRM ingest NOT enabled (Settings → Clients → Biotecc)");

  if (provider === "nexa") ok.push("Provider: Nexa CRM");
  else issues.push(`Provider should be nexa (current: ${provider || "empty"})`);

  if (ingestSecret) ok.push("Ingest secret configured");
  else issues.push("Ingest secret missing — generate in client settings");

  if (defaultFunnelSlug === "site") ok.push("Default funnel: site");
  else issues.push(`Default funnel should be site (current: ${defaultFunnelSlug || "empty"})`);

  if (defaultSource === "Site") ok.push("Default source: Site");
  else issues.push(`Default source should be Site (current: ${defaultSource || "empty"})`);

  if (allowedOrigins.length) ok.push(`Allowed origins: ${allowedOrigins.join(", ")}`);
  else issues.push("No allowed origins — add Webflow + production domain");

  const { data: funnel } = await sb
    .from("crm_funnels")
    .select("id, slug, name")
    .eq("client_slug", CLIENT_SLUG)
    .eq("slug", "site")
    .maybeSingle();

  if (funnel?.id) ok.push(`Site funnel exists (${funnel.id})`);
  else issues.push("Site funnel missing in crm_funnels");

  if (funnel?.id) {
    const { data: stages } = await sb
      .from("crm_funnel_stages")
      .select("name, sort_order")
      .eq("funnel_id", funnel.id)
      .order("sort_order", { ascending: true });
    if (stages?.length) ok.push(`Stages: ${stages.map((s) => s.name).join(" → ")}`);
    else issues.push("Site funnel has no stages");
  }

  let expectedInitialStatus: string | null = null;
  if (funnel?.id) {
    const { data: firstStage } = await sb
      .from("crm_funnel_stages")
      .select("name")
      .eq("funnel_id", funnel.id)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    expectedInitialStatus = firstStage?.name ? String(firstStage.name) : null;
  }

  console.log("\n=== Biotecc Webflow CRM validation ===\n");
  for (const line of ok) console.log(`✓ ${line}`);
  for (const line of issues) console.log(`✗ ${line}`);

  if (!submit) {
    console.log("\nRun with --submit to POST a test lead (requires dev server on :3000 and ingest enabled + secret).");
    process.exit(issues.length ? 1 : 0);
  }

  if (!enabled || !ingestSecret) {
    console.error("\nCannot submit test: enable ingest and set secret first.");
    process.exit(1);
  }

  const baseUrl = process.env.CRM_SUBMIT_BASE_URL?.trim() || "http://localhost:3000";
  const testEmail = `webflow-test+${Date.now()}@example.com`;
  const origin = allowedOrigins[0] ?? "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/crm/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Slug": CLIENT_SLUG,
      "X-Ingest-Secret": ingestSecret,
      Origin: origin,
    },
    body: JSON.stringify({
      name: "Teste Webflow Biotecc",
      email: testEmail,
      phone: "11999999999",
      message: "Validação automática integração Site funnel",
      source: "Site",
    }),
  });

  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; externalId?: string };
  console.log(`\nPOST ${baseUrl}/api/crm/submit → ${res.status}`, body);

  if (!res.ok || !body.ok) {
    console.error("Submit failed");
    process.exit(1);
  }

  await new Promise((r) => setTimeout(r, 500));

  const { data: lead, error: leadErr } = await sb
    .from("crm_leads")
    .select("id, name, email, funnel, source, status, client_slug")
    .eq("email", testEmail)
    .maybeSingle();

  if (leadErr || !lead) {
    console.error("Lead not found after submit:", leadErr?.message);
    process.exit(1);
  }

  console.log("\nLead created:", lead);

  const leadIssues: string[] = [];
  if (lead.funnel !== "site") leadIssues.push(`funnel=${lead.funnel} (expected site)`);
  if (lead.source !== "Site") leadIssues.push(`source=${lead.source} (expected Site)`);
  if (lead.client_slug !== CLIENT_SLUG) leadIssues.push(`client_slug=${lead.client_slug}`);
  if (expectedInitialStatus && lead.status !== expectedInitialStatus) {
    leadIssues.push(`status=${lead.status} (expected ${expectedInitialStatus})`);
  } else if (!expectedInitialStatus && lead.status !== "New Lead") {
    leadIssues.push(`status=${lead.status} (expected New Lead)`);
  }

  if (leadIssues.length) {
    console.error("\nLead field mismatches:", leadIssues.join(", "));
    process.exit(1);
  }

  console.log("\n✓ Test lead OK — funnel site, source Site, status New Lead");
  console.log(`  View: ${baseUrl}/crm/pipeline/site`);
  process.exit(issues.length ? 1 : 0);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
