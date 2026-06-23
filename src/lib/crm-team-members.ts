import { effectiveUserClientSlug, isAgencyCompany } from "@/lib/client-utils";
import type { AppUser } from "@/types";

export type CrmOwnerOption = {
  id: string;
  name: string;
  email: string | null;
};

export function findCrmOwnerUser(users: AppUser[], ownerName: string): AppUser | null {
  const name = ownerName.trim();
  if (!name) return null;
  return users.find((user) => user.name.trim() === name) ?? null;
}

/** Users who can be assigned as CRM lead/appointment owners for the active client. */
export function resolveCrmOwnerOptions(
  users: AppUser[],
  dataClientSlug: string | null,
  currentUser: AppUser,
): CrmOwnerOption[] {
  const slug = (dataClientSlug ?? effectiveUserClientSlug(currentUser) ?? "").trim();
  if (!slug) return [];

  const seen = new Set<string>();
  const options: CrmOwnerOption[] = [];

  for (const user of users) {
    const name = user.name.trim();
    if (!name || seen.has(name)) continue;
    if (isAgencyCompany(user.company)) continue;

    const userClient =
      user.clientSlug?.trim() ||
      (!isAgencyCompany(user.company) ? String(user.company ?? "").trim() : "") ||
      null;
    if (userClient !== slug) continue;

    seen.add(name);
    options.push({
      id: user.id,
      name,
      email: user.email ?? null,
    });
  }

  return options.sort((a, b) => a.name.localeCompare(b.name));
}
