import { effectiveUserClientSlug, isAgencyCompany } from "@/lib/client-utils";
import type { AppUser } from "@/types";

export type MentionableUser = {
  id: string;
  name: string;
  email: string | null;
};

/** Users mentionable / invitable in the active client context: that client + Nexa + Otus. */
export function resolveMentionableUsers(
  users: AppUser[],
  dataClientSlug: string | null,
  currentUser: AppUser,
): MentionableUser[] {
  const slug = (dataClientSlug ?? effectiveUserClientSlug(currentUser) ?? "").trim();
  if (!slug) return [];

  const seen = new Set<string>();
  const options: MentionableUser[] = [];

  for (const user of users) {
    const name = user.name.trim();
    if (!name || seen.has(name)) continue;

    if (isAgencyCompany(user.company)) {
      seen.add(name);
      options.push({ id: user.id, name, email: user.email ?? null });
      continue;
    }

    const userClient =
      user.clientSlug?.trim() ||
      (!isAgencyCompany(user.company) ? String(user.company ?? "").trim() : "") ||
      null;
    if (userClient !== slug) continue;

    seen.add(name);
    options.push({ id: user.id, name, email: user.email ?? null });
  }

  return options.sort((a, b) => a.name.localeCompare(b.name));
}

export function mentionableUserNames(users: MentionableUser[]): string[] {
  return users.map((u) => u.name);
}
