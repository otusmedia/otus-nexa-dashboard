import { formatCrmServiceProductLabel, mergeCrmSourceOptions } from "@/lib/crm-data";
import { primaryParsedCrmProduct } from "@/lib/crm-service-product-parse";
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

function isMissingQuantityColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    (lower.includes("quantity") || lower.includes("quantity_unit")) &&
    lower.includes("does not exist")
  );
}

export function isCrmServiceProductSchemaError(message: string): boolean {
  return isMissingRelationError(message) || isMissingServiceProductColumnError(message);
}

export function isCrmQuantitySchemaError(message: string): boolean {
  return isMissingQuantityColumnError(message);
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

  if (error) {
    if (!isMissingRelationError(error.message)) {
      console.error("[crm] fetch custom service products", error.message);
    }
    return [];
  }

  for (const row of data ?? []) {
    const s = formatCrmServiceProductLabel(String(row.service_product ?? ""));
    if (s) fromTable.push(s);
  }

  return mergeCrmSourceOptions([], fromTable).sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
  );
}

export async function rememberCustomCrmServiceProduct(
  clientSlug: string | null | undefined,
  serviceProduct: string,
): Promise<string[]> {
  const slug = (clientSlug ?? "").trim().toLowerCase();
  const trimmed = formatCrmServiceProductLabel(primaryParsedCrmProduct(serviceProduct).name || serviceProduct);
  if (!slug || !trimmed) return fetchCustomCrmServiceProducts(slug);

  const existing = await fetchCustomCrmServiceProducts(slug);
  const alreadyKnown = existing.some((opt) => opt.toLowerCase() === trimmed.toLowerCase());
  if (alreadyKnown) {
    await supabase
      .from("crm_custom_service_products")
      .update({ service_product: trimmed })
      .eq("client_slug", slug)
      .ilike("service_product", trimmed);
    return mergeCrmSourceOptions([], [...existing.filter((o) => o.toLowerCase() !== trimmed.toLowerCase()), trimmed]).sort(
      (a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
    );
  }

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

  return mergeCrmSourceOptions([], [...existing, trimmed]).sort((a, b) =>
    a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
  );
}

/** Remove a product from the client's selectable library (does not clear leads). */
export async function removeCustomCrmServiceProduct(
  clientSlug: string | null | undefined,
  serviceProduct: string,
): Promise<string[]> {
  const slug = (clientSlug ?? "").trim().toLowerCase();
  const trimmed = formatCrmServiceProductLabel(primaryParsedCrmProduct(serviceProduct).name || serviceProduct);
  if (!slug || !trimmed) return fetchCustomCrmServiceProducts(slug);

  const { error } = await supabase
    .from("crm_custom_service_products")
    .delete()
    .eq("client_slug", slug)
    .ilike("service_product", trimmed);

  if (error && !isMissingRelationError(error.message)) {
    console.error("[crm] remove custom service product", error.message);
  }

  return fetchCustomCrmServiceProducts(slug);
}
