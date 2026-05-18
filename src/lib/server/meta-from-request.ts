import { resolveMetaCredentials, type ResolvedMetaCredentials } from "@/lib/client-api-credentials";
import { loadClientApiCredentialsFromRequest } from "@/lib/server/load-client-api-credentials";

export async function metaFromRequest(request: Request): Promise<ResolvedMetaCredentials> {
  const stored = await loadClientApiCredentialsFromRequest(request);
  return resolveMetaCredentials(stored);
}

export function instagramConfigured(meta: ResolvedMetaCredentials): boolean {
  return Boolean(meta.accessToken && meta.instagramId);
}
