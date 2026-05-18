import type { AppUser, Client, ClientApiKey, ClientApisConfig } from "@/types";
import { CLIENT_API_KEYS } from "@/types";
import { effectiveUserClientSlug, isAgencyCompany } from "@/lib/client-utils";

export type { ClientApiKey, ClientApisConfig } from "@/types";
export { CLIENT_API_KEYS } from "@/types";

export const DEFAULT_HERO_IMAGE = "/Biotecc%20-%202026-159.jpg";

export const CLIENT_API_LABELS: Record<ClientApiKey, string> = {
  metaAds: "Meta Ads (Dashboard KPIs & campaigns)",
  metaCampaigns: "Meta Ads (Marketing campaigns list)",
  metaMonthlySpend: "Meta Ads (Marketing strategy / monthly spend)",
  metaCreatives: "Meta Ads (Dashboard creatives)",
  instagramFeed: "Instagram (Feed widget)",
  instagramInsights: "Instagram (Insights & reach)",
  instagramMonthly: "Instagram (Monthly growth)",
  ga4: "Google Analytics 4 (Dashboard)",
};

export const EMPTY_CLIENT_APIS: ClientApisConfig = {
  metaAds: false,
  metaCampaigns: false,
  metaMonthlySpend: false,
  metaCreatives: false,
  instagramFeed: false,
  instagramInsights: false,
  instagramMonthly: false,
  ga4: false,
};

export const ALL_CLIENT_APIS_ENABLED: ClientApisConfig = {
  metaAds: true,
  metaCampaigns: true,
  metaMonthlySpend: true,
  metaCreatives: true,
  instagramFeed: true,
  instagramInsights: true,
  instagramMonthly: true,
  ga4: true,
};

export function parseClientApisConfig(raw: unknown): ClientApisConfig {
  const base = { ...EMPTY_CLIENT_APIS };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  for (const key of CLIENT_API_KEYS) {
    if (o[key] === true) base[key] = true;
  }
  return base;
}

export function apisConfigHasAnyEnabled(config: ClientApisConfig): boolean {
  return CLIENT_API_KEYS.some((k) => config[k]);
}

export function clientApisFromRow(row: Record<string, unknown>): ClientApisConfig {
  const fromJson = parseClientApisConfig(row.api_config);
  if (apisConfigHasAnyEnabled(fromJson)) return fromJson;
  if (row.api_enabled === true) return { ...ALL_CLIENT_APIS_ENABLED };
  return fromJson;
}

export function resolveActiveClient(
  user: AppUser,
  clients: Client[],
  projectsClientFilter: string,
): Client | null {
  if (isAgencyCompany(user.company)) {
    if (projectsClientFilter === "all") return null;
    return clients.find((c) => c.slug === projectsClientFilter) ?? null;
  }
  const slug = effectiveUserClientSlug(user);
  if (!slug) return null;
  return clients.find((c) => c.slug === slug) ?? null;
}

/** API flags for the current session (agency “all clients” → all integrations on). */
export function resolveSessionClientApis(
  user: AppUser,
  clients: Client[],
  projectsClientFilter: string,
): ClientApisConfig {
  if (isAgencyCompany(user.company) && projectsClientFilter === "all") {
    return { ...ALL_CLIENT_APIS_ENABLED };
  }
  const client = resolveActiveClient(user, clients, projectsClientFilter);
  if (!client) return { ...EMPTY_CLIENT_APIS };
  return client.apis;
}

export function resolveHeroImageUrl(
  user: AppUser,
  clients: Client[],
  projectsClientFilter: string,
): string {
  if (isAgencyCompany(user.company) && projectsClientFilter === "all") {
    return DEFAULT_HERO_IMAGE;
  }
  const client = resolveActiveClient(user, clients, projectsClientFilter);
  const url = client?.heroImageUrl?.trim();
  return url || DEFAULT_HERO_IMAGE;
}

export function apiConfigToDb(config: ClientApisConfig): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of CLIENT_API_KEYS) {
    out[key] = config[key] === true;
  }
  return out;
}
