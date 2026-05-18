import type { AppUser, Client, UserCompany } from "@/types";

export function isAgencyCompany(company: UserCompany): boolean {
  return company === "nexa" || company === "otus";
}

export function isClientCompany(company: UserCompany): boolean {
  const s = String(company ?? "").trim();
  return s !== "" && !isAgencyCompany(s);
}

export function isRocketRideCompany(company: UserCompany): boolean {
  return company === "rocketride";
}

export function isAgencyAdmin(user: AppUser): boolean {
  return isAgencyCompany(user.company) && user.role === "admin";
}

export function effectiveUserClientSlug(user: AppUser): string | null {
  if (user.clientSlug) return user.clientSlug;
  if (user.company === "rocketride") return "rocketride";
  if (user.company && !isAgencyCompany(user.company)) return user.company;
  return null;
}

export function clientHasLiveApis(client: Client | null | undefined): boolean {
  return client?.apiEnabled === true;
}

/** Agency dashboards use integrations; client portals only when `api_enabled` on their client row. */
export function userHasLiveApis(user: AppUser, clients: Client[]): boolean {
  if (isAgencyCompany(user.company)) return true;
  const slug = effectiveUserClientSlug(user);
  if (!slug) return false;
  const client = clients.find((c) => c.slug === slug);
  return clientHasLiveApis(client);
}

/** Slug used to scope Supabase reads/writes for the active session (null = agency viewing all clients). */
export function resolveDataClientSlug(
  user: AppUser,
  projectsClientFilter: string,
): string | null {
  if (isAgencyCompany(user.company)) {
    return projectsClientFilter === "all" ? null : projectsClientFilter;
  }
  return effectiveUserClientSlug(user);
}

export function rowMatchesDataClient(
  rowSlug: string | null | undefined,
  dataClientSlug: string | null,
): boolean {
  if (!dataClientSlug) return true;
  const slug = (rowSlug ?? "").trim();
  if (!slug) return dataClientSlug === "rocketride";
  return slug === dataClientSlug;
}

export function filterRowsByDataClient<T>(
  rows: T[],
  dataClientSlug: string | null,
  getSlug: (row: T) => string | null | undefined,
): T[] {
  if (!dataClientSlug) return rows;
  return rows.filter((row) => rowMatchesDataClient(getSlug(row), dataClientSlug));
}

export function slugFromClientName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
