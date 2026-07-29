/**
 * One-shot cleanup: split messy service_product blobs into clean catalog names
 * and extract quantity + unit onto crm_leads.
 *
 * Requires supabase/crm-lead-quantity.sql applied first (quantity + quantity_unit).
 *
 *   npx tsx scripts/cleanup-crm-service-products.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";
import { parseCrmServiceProductBlob } from "../src/lib/crm-service-product-parse";

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  return Object.fromEntries(
    raw
      .split("\n")
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
      }),
  );
}

async function main() {
  const env = loadEnv();
  const sb = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const probe = await sb.from("crm_leads").select("quantity, quantity_unit").limit(1);
  const hasQty = !probe.error;
  if (!hasQty) {
    console.error("Missing quantity columns. Run supabase/crm-lead-quantity.sql first.");
    console.error(probe.error?.message);
  }

  const { data: leads, error: lErr } = await sb
    .from("crm_leads")
    .select("id, client_slug, service_product, notes")
    .not("service_product", "is", null);
  if (lErr) throw new Error(lErr.message);

  const catalogByClient = new Map<string, Set<string>>();
  let leadUpdated = 0;
  let qtyUpdated = 0;

  for (const lead of leads ?? []) {
    const raw = String(lead.service_product ?? "");
    const lines = parseCrmServiceProductBlob(raw).filter((l) => l.name);
    if (!lines.length) continue;

    const slug = String(lead.client_slug ?? "")
      .trim()
      .toLowerCase();
    if (slug) {
      if (!catalogByClient.has(slug)) catalogByClient.set(slug, new Set());
      for (const line of lines) catalogByClient.get(slug)!.add(line.name);
    }

    const primary = lines[0]!;
    const patch: Record<string, unknown> = { service_product: primary.name };
    if (hasQty) {
      if (primary.quantity != null) patch.quantity = Math.trunc(primary.quantity);
      if (primary.unit) patch.quantity_unit = primary.unit;
    }
    if (lines.length > 1) {
      const extras = lines.slice(1).map((l) => {
        const q =
          l.quantity != null ? ` ${Math.trunc(l.quantity)}${l.unit ? ` ${l.unit}` : ""}` : "";
        return `${l.name}${q}`.trim();
      });
      const block = `Produtos adicionais:\n- ${extras.join("\n- ")}`;
      const notes = String(lead.notes ?? "");
      if (!notes.includes("Produtos adicionais:")) {
        patch.notes = notes.trim() ? `${notes.trim()}\n\n${block}` : block;
      }
    }

    const { error } = await sb.from("crm_leads").update(patch).eq("id", lead.id);
    if (error) {
      console.error("lead", lead.id, error.message);
      continue;
    }
    leadUpdated++;
    if (hasQty && (primary.quantity != null || primary.unit)) qtyUpdated++;
  }

  // Refresh catalog from cleaned names
  const { data: existing } = await sb
    .from("crm_custom_service_products")
    .select("id, client_slug, service_product");

  for (const row of existing ?? []) {
    const lines = parseCrmServiceProductBlob(row.service_product);
    const slug = String(row.client_slug ?? "")
      .trim()
      .toLowerCase();
    const messy =
      String(row.service_product).includes(";") ||
      lines.length !== 1 ||
      (lines[0] && lines[0].name !== row.service_product);
    if (messy) {
      await sb.from("crm_custom_service_products").delete().eq("id", row.id);
      if (slug) {
        if (!catalogByClient.has(slug)) catalogByClient.set(slug, new Set());
        for (const line of lines) if (line.name) catalogByClient.get(slug)!.add(line.name);
      }
    } else if (slug && lines[0]?.name) {
      if (!catalogByClient.has(slug)) catalogByClient.set(slug, new Set());
      catalogByClient.get(slug)!.add(lines[0].name);
    }
  }

  let catalogInserted = 0;
  for (const [slug, names] of catalogByClient) {
    for (const name of names) {
      const { data: found } = await sb
        .from("crm_custom_service_products")
        .select("id")
        .eq("client_slug", slug)
        .ilike("service_product", name)
        .limit(1);
      if (found?.length) continue;
      const { error } = await sb.from("crm_custom_service_products").insert({
        client_slug: slug,
        service_product: name,
      });
      if (!error) catalogInserted++;
    }
  }

  console.log(
    JSON.stringify(
      { hasQty, leadUpdated, qtyUpdated, catalogInserted, clients: catalogByClient.size },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
