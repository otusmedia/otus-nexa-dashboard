import type { AppUser } from "@/types";

/** Only Nexa or Otus company admins may import Meta Ads CSV (not managers, not RocketRide). */
export function canImportData(user: AppUser): boolean {
  if (user.role !== "admin") return false;
  return user.company === "nexa" || user.company === "otus";
}
