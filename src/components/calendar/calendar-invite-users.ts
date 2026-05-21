import type { CalendarInvitableUser } from "@/types/calendar";
import type { MentionableUser } from "@/lib/mentionable-users";

/** @deprecated Use mentionableUsers from AppContext instead. */
export function mentionableToCalendarInvitable(users: MentionableUser[]): CalendarInvitableUser[] {
  return users
    .filter((u) => u.email?.trim())
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email!.trim(),
    }));
}
