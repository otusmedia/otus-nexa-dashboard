import type { AppLanguage } from "@/lib/locale-types";
import type { AppUser, Client } from "@/types";
import { effectiveUserClientSlug, isAgencyAdmin } from "@/lib/client-utils";

export function resolveActiveClient(
  user: AppUser,
  clients: Client[],
  projectsClientFilter: string,
): Client | null {
  if (isAgencyAdmin(user)) {
    if (projectsClientFilter === "all") return null;
    return clients.find((c) => c.slug === projectsClientFilter) ?? null;
  }
  const slug = effectiveUserClientSlug(user);
  if (!slug) return null;
  return clients.find((c) => c.slug === slug) ?? null;
}

export function resolveActiveLocale(opts: {
  sessionOverride: AppLanguage | null;
  userPreference: AppLanguage | null;
  clientDefaultLocale: AppLanguage;
  viewingAllClients: boolean;
}): AppLanguage {
  const { sessionOverride, userPreference, clientDefaultLocale, viewingAllClients } = opts;
  if (sessionOverride) return sessionOverride;
  if (userPreference) return userPreference;
  if (viewingAllClients) return "en";
  return clientDefaultLocale;
}
