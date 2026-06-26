import { mergeCrmSourceOptions } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";

function isMissingRelationError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("schema cache") ||
    lower.includes("could not find the table") ||
    lower.includes("does not exist") ||
    (lower.includes("relation") && lower.includes("does not exist"))
  );
}

function isMissingServiceProductColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("service_product") && lower.includes("does not exist");
}

export function isCrmServiceProductSchemaError(message: string): boolean {
  return isMissingRelationError(message) || isMissingServiceProductColumnError(message);
}

export async function fetchCustomCrmServiceProducts(clientSlug: string | null | undefined): Promise<string[]> {
  const slug = (clientSlug ?? "").trim().toLowerCase();
  if (!slug) return [];

  const fromTable: string[] = [];
  const { data, error } = await supabase
    .from("crm_custom_service_products")
    .select("service_product")
    .eq("client_slug", slug)
    .order("service_product", { ascending: true });

  if (!error && data) {
    for (const row of data) {
      const s = String(row.service_product ?? "").trim();
      if (s) fromTable.push(s);
    }
  }

  const { data: leadRows, error: leadErr } = await supabase
    .from("crm_leads")
    .select("service_product")
    .eq("client_slug", slug)
    .not("service_product", "is", null);

  const fromLeads: string[] = [];
  if (!leadErr && leadRows) {
    for (const row of leadRows) {
      const s = String(row.service_product ?? "").trim();
      if (s) fromLeads.push(s);
    }
  } else if (leadErr && !isMissingServiceProductColumnError(leadErr.message)) {
    console.error("[crm] fetch service products from leads", leadErr.message);
  }

  return mergeCrmSourceOptions([], [...fromTable, ...fromLeads]);
}

export async function rememberCustomCrmServiceProduct(
  clientSlug: string | null | undefined,
  serviceProduct: string,
): Promise<string[]> {
  const slug = (clientSlug ?? "").trim().toLowerCase();
  const trimmed = serviceProduct.trim();
  if (!slug || !trimmed) return fetchCustomCrmServiceProducts(slug);

  const existing = await fetchCustomCrmServiceProducts(slug);
  const alreadyKnown = existing.some((opt) => opt.toLowerCase() === trimmed.toLowerCase());
  if (alreadyKnown) return existing;

  const { error } = await supabase.from("crm_custom_service_products").insert({
    client_slug: slug,
    service_product: trimmed,
  });

  if (error) {
    if (isMissingRelationError(error.message)) {
      return mergeCrmSourceOptions([], [...existing, trimmed]);
    }
    if (!error.message.toLowerCase().includes("duplicate")) {
      console.error("[crm] remember custom service product", error.message);
    }
  }

  return mergeCrmSourceOptions([], [...existing, trimmed]);
}
