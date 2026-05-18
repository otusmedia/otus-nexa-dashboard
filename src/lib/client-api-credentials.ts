import type { ClientApiCredentials } from "@/types";

export const EMPTY_CLIENT_API_CREDENTIALS: ClientApiCredentials = {
  metaAccessToken: "",
  metaAdAccountId: "",
  metaInstagramId: "",
  ga4PropertyId: "",
};

export function parseClientApiCredentials(raw: unknown): ClientApiCredentials {
  if (!raw || typeof raw !== "object") return { ...EMPTY_CLIENT_API_CREDENTIALS };
  const o = raw as Record<string, unknown>;
  return {
    metaAccessToken: o.metaAccessToken != null ? String(o.metaAccessToken) : "",
    metaAdAccountId: o.metaAdAccountId != null ? String(o.metaAdAccountId) : "",
    metaInstagramId: o.metaInstagramId != null ? String(o.metaInstagramId) : "",
    ga4PropertyId: o.ga4PropertyId != null ? String(o.ga4PropertyId) : "",
  };
}

export function clientApiCredentialsToDb(creds: ClientApiCredentials): Record<string, string> {
  return {
    metaAccessToken: creds.metaAccessToken.trim(),
    metaAdAccountId: creds.metaAdAccountId.trim(),
    metaInstagramId: creds.metaInstagramId.trim(),
    ga4PropertyId: creds.ga4PropertyId.trim(),
  };
}

export type ResolvedMetaCredentials = {
  accessToken: string;
  adAccountId: string;
  instagramId: string;
  configured: boolean;
};

export function resolveMetaCredentials(stored: ClientApiCredentials | null | undefined): ResolvedMetaCredentials {
  const accessToken =
    stored?.metaAccessToken?.trim() || process.env.META_ACCESS_TOKEN?.trim() || "";
  const adAccountRaw =
    stored?.metaAdAccountId?.trim() || process.env.META_AD_ACCOUNT_ID?.trim() || "";
  const adAccountId = adAccountRaw.replace(/^act_/i, "");
  const instagramId =
    stored?.metaInstagramId?.trim() || process.env.META_INSTAGRAM_ID?.trim() || "";
  return {
    accessToken,
    adAccountId,
    instagramId,
    configured: Boolean(accessToken && adAccountId),
  };
}

export function resolveGa4PropertyId(stored: ClientApiCredentials | null | undefined): string {
  const fromClient = stored?.ga4PropertyId?.trim();
  if (fromClient) return fromClient;
  return process.env.GA4_PROPERTY_ID?.trim() || "";
}

export function isGa4ConfiguredForClient(stored: ClientApiCredentials | null | undefined): boolean {
  const email = process.env.GOOGLE_CLIENT_EMAIL?.trim();
  const key = process.env.GOOGLE_PRIVATE_KEY?.trim();
  const property = resolveGa4PropertyId(stored);
  return Boolean(email && key && property);
}

/** Append client scope for server routes (null = use env defaults). */
export function apiUrlWithClient(path: string, clientSlug: string | null | undefined): string {
  const slug = clientSlug?.trim();
  if (!slug) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}client_slug=${encodeURIComponent(slug)}`;
}
