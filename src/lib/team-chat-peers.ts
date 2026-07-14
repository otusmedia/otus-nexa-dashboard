import { resolveMentionableUsers, type MentionableUser } from "@/lib/mentionable-users";
import type { AppUser } from "@/types";

export type TeamChatPeer = MentionableUser & {
  avatarUrl?: string | null;
  company?: string;
};

/** Peers available for 1:1 chat: same client team + agency, excluding self. */
export function resolveTeamChatPeers(
  users: AppUser[],
  dataClientSlug: string | null,
  currentUser: AppUser,
): TeamChatPeer[] {
  const me = currentUser.id;
  const byId = new Map(users.map((u) => [u.id, u]));

  // When agency has no client selected ("all"), still allow chatting with other agency users.
  if (!dataClientSlug && isAgencyOnlyContext(currentUser)) {
    return users
      .filter((u) => u.id !== me && (u.company === "nexa" || u.company === "otus"))
      .map((u) => ({
        id: u.id,
        name: u.name.trim(),
        email: u.email ?? null,
        avatarUrl: u.avatarUrl ?? null,
        company: String(u.company ?? ""),
      }))
      .filter((u) => u.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const base = resolveMentionableUsers(users, dataClientSlug, currentUser);
  return base
    .filter((u) => u.id !== me)
    .map((u) => {
      const full = byId.get(u.id);
      return {
        ...u,
        avatarUrl: full?.avatarUrl ?? null,
        company: full ? String(full.company ?? "") : "",
      };
    });
}

function isAgencyOnlyContext(user: AppUser): boolean {
  return user.company === "nexa" || user.company === "otus";
}

export function isPeerAllowed(
  peers: TeamChatPeer[],
  peerId: string,
): boolean {
  return peers.some((p) => p.id === peerId);
}
