import { parseClientCrmIntegration } from "@/lib/client-crm-integration";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { ClientCrmIntegration } from "@/types";

const cache = new Map<string, { integration: ClientCrmIntegration; at: number }>();
const TTL_MS = 60_000;

export function invalidateClientCrmIntegrationCache(clientSlug?: string | null) {
  if (clientSlug?.trim()) {
    cache.delete(clientSlug.trim());
    return;
  }
  cache.clear();
}

export async function loadClientCrmIntegration(clientSlug: string | null): Promise<ClientCrmIntegration | null> {
  const slug = clientSlug?.trim();
  if (!slug) return null;

  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.integration;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("clients").select("crm_integration").eq("slug", slug).maybeSingle();

  if (error) {
    console.error("[clients] crm_integration load failed:", error.message);
    return null;
  }

  const integration = parseClientCrmIntegration(
    (data as { crm_integration?: unknown } | null)?.crm_integration,
  );
  cache.set(slug, { integration, at: Date.now() });
  return integration;
}
