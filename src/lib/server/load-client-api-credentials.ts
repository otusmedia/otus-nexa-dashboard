import { parseClientApiCredentials } from "@/lib/client-api-credentials";
import { supabase } from "@/lib/supabase";
import type { ClientApiCredentials } from "@/types";

const cache = new Map<string, { creds: ClientApiCredentials; at: number }>();
const TTL_MS = 60_000;

export function invalidateClientApiCredentialsCache(clientSlug?: string | null) {
  if (clientSlug?.trim()) {
    cache.delete(clientSlug.trim());
    return;
  }
  cache.clear();
}

export async function loadClientApiCredentials(clientSlug: string | null): Promise<ClientApiCredentials | null> {
  const slug = clientSlug?.trim();
  if (!slug) return null;

  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.creds;

  const { data, error } = await supabase
    .from("clients")
    .select("api_credentials")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[clients] api_credentials load failed:", error.message);
    return null;
  }

  const creds = parseClientApiCredentials(
    (data as { api_credentials?: unknown } | null)?.api_credentials,
  );
  cache.set(slug, { creds, at: Date.now() });
  return creds;
}

export function clientSlugFromRequest(request: Request): string | null {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("client_slug")?.trim();
  return slug || null;
}

export async function loadClientApiCredentialsFromRequest(
  request: Request,
): Promise<ClientApiCredentials | null> {
  return loadClientApiCredentials(clientSlugFromRequest(request));
}
