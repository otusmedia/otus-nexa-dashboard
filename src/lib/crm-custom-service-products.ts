import { formatCrmServiceProductLabel, mergeCrmSourceOptions } from "@/lib/crm-data";
import { primaryParsedCrmProduct } from "@/lib/crm-service-product-parse";
import { supabase } from "@/lib/supabase";

export type CrmOfferingKind = "service" | "product";

export function normalizeCrmOfferingKind(raw: string | null | undefined): CrmOfferingKind | null {
  const v = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (v === "service" || v === "serviço" || v === "servico") return "service";
  if (v === "product" || v === "produto") return "product";
  return null;
}

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

function isMissingOfferingKindColumnError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    (lower.includes("offering_kind") || (lower.includes("kind") && lower.includes("crm_custom"))) &&
    lower.includes("does not exist")
  );
}

export function isCrmServiceProductSchemaError(message: string): boolean {
  return isMissingRelationError(message) || isMissingServiceProductColumnError(message);
}

export function isCrmQuantitySchemaError(message: string): boolean {
  return isMissingQuantityColumnError(message);
}

export function isCrmOfferingKindSchemaError(message: string): boolean {
  return isMissingOfferingKindColumnError(message);
}

export async function fetchCustomCrmServiceProducts(
  clientSlug: string | null | undefined,
  kind: CrmOfferingKind = "product",
): Promise<string[]> {
  const slug = (clientSlug ?? "").trim().toLowerCase();
  if (!slug) return [];

  const fromTable: string[] = [];
  let query = supabase
    .from("crm_custom_service_products")
    .select("service_product, kind")
    .eq("client_slug", slug)
    .order("service_product", { ascending: true });

  // Filter by kind when column exists; fallback without filter if migration pending.
  query = query.eq("kind", kind);

  const { data, error } = await query;

  if (error) {
    if (isMissingOfferingKindColumnError(error.message) || /kind/i.test(error.message)) {
      const fallback = await supabase
        .from("crm_custom_service_products")
        .select("service_product")
        .eq("client_slug", slug)
        .order("service_product", { ascending: true });
      if (fallback.error) {
        if (!isMissingRelationError(fallback.error.message)) {
          console.error("[crm] fetch custom service products", fallback.error.message);
        }
        return [];
      }
      // Without kind column, only return rows when asking for product (legacy).
      if (kind !== "product") return [];
      for (const row of fallback.data ?? []) {
        const s = formatCrmServiceProductLabel(String(row.service_product ?? ""));
        if (s) fromTable.push(s);
      }
      return mergeCrmSourceOptions([], fromTable).sort((a, b) =>
        a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
      );
    }
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
  kind: CrmOfferingKind = "product",
): Promise<string[]> {
  const slug = (clientSlug ?? "").trim().toLowerCase();
  const trimmed =
    kind === "product"
      ? formatCrmServiceProductLabel(primaryParsedCrmProduct(serviceProduct).name || serviceProduct)
      : formatCrmServiceProductLabel(serviceProduct);
  if (!slug || !trimmed) return fetchCustomCrmServiceProducts(slug, kind);

  const existing = await fetchCustomCrmServiceProducts(slug, kind);
  const alreadyKnown = existing.some((opt) => opt.toLowerCase() === trimmed.toLowerCase());
  if (alreadyKnown) {
    let upd = supabase
      .from("crm_custom_service_products")
      .update({ service_product: trimmed, kind })
      .eq("client_slug", slug)
      .ilike("service_product", trimmed);
    upd = upd.eq("kind", kind);
    await upd;
    return mergeCrmSourceOptions([], [...existing.filter((o) => o.toLowerCase() !== trimmed.toLowerCase()), trimmed]).sort(
      (a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }),
    );
  }

  const { error } = await supabase.from("crm_custom_service_products").insert({
    client_slug: slug,
    service_product: trimmed,
    kind,
  });

  if (error) {
    if (isMissingOfferingKindColumnError(error.message) || /kind/i.test(error.message)) {
      const { error: e2 } = await supabase.from("crm_custom_service_products").insert({
        client_slug: slug,
        service_product: trimmed,
      });
      if (e2 && !e2.message.toLowerCase().includes("duplicate") && !isMissingRelationError(e2.message)) {
        console.error("[crm] remember custom service product", e2.message);
      }
      return fetchCustomCrmServiceProducts(slug, kind);
    }
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

/** Remove from the client's selectable library for this kind (does not clear leads). */
export async function removeCustomCrmServiceProduct(
  clientSlug: string | null | undefined,
  serviceProduct: string,
  kind: CrmOfferingKind = "product",
): Promise<string[]> {
  const slug = (clientSlug ?? "").trim().toLowerCase();
  const trimmed = formatCrmServiceProductLabel(serviceProduct);
  if (!slug || !trimmed) return fetchCustomCrmServiceProducts(slug, kind);

  let del = supabase
    .from("crm_custom_service_products")
    .delete()
    .eq("client_slug", slug)
    .ilike("service_product", trimmed);
  del = del.eq("kind", kind);

  const { error } = await del;
  if (error) {
    if (isMissingOfferingKindColumnError(error.message) || /kind/i.test(error.message)) {
      await supabase
        .from("crm_custom_service_products")
        .delete()
        .eq("client_slug", slug)
        .ilike("service_product", trimmed);
    } else if (!isMissingRelationError(error.message)) {
      console.error("[crm] remove custom service product", error.message);
    }
  }

  return fetchCustomCrmServiceProducts(slug, kind);
}
