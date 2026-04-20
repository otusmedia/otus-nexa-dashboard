import type { CalendarInvitableUser } from "@/types/calendar";

/** Fallback list when no profiles table; aligns with platform mock users. */
export const CALENDAR_INVITABLE_USERS: CalendarInvitableUser[] = [
  { id: "u-admin-mc", name: "Matheus Canci", email: "matheus.canci@rocketride.com" },
  { id: "u-admin-dm", name: "David Martins", email: "david.martins@rocketride.com" },
  { id: "u-admin-mf", name: "Matheus Foletto", email: "matheus.foletto@rocketride.com" },
  { id: "u-admin-joe", name: "Joe", email: "joe@rocketride.com" },
  { id: "u-mgr-kk", name: "Karla Kachuba", email: "karla.kachuba@rocketride.com" },
  { id: "u-mgr-luca", name: "Luca", email: "luca@rocketride.com" },
];
