import { isAgencyCompany, isClientCompany } from "@/lib/client-utils";
import type { CrmLead } from "@/lib/crm-data";
import type { AppUser } from "@/types";

/** Agency users and client admins see every lead for their client. */
export function canViewAllCrmLeads(user: AppUser): boolean {
  if (isAgencyCompany(user.company)) return true;
  if (isClientCompany(user.company) && user.role === "admin") return true;
  return false;
}

/** Agency users and client admins can create, edit, and delete custom funnels. */
export function canManageCrmFunnels(user: AppUser, dataClientSlug?: string | null): boolean {
  const hasClient = Boolean((dataClientSlug ?? "").trim());
  if (isAgencyCompany(user.company)) return hasClient;
  if (isClientCompany(user.company) && user.role === "admin") return hasClient;
  return false;
}

export function leadAssignedToUser(lead: Pick<CrmLead, "owner">, user: AppUser): boolean {
  const owner = (lead.owner ?? "").trim();
  const me = user.name.trim();
  return owner !== "" && owner === me;
}

export function filterCrmLeadsForUser(leads: CrmLead[], user: AppUser): CrmLead[] {
  if (canViewAllCrmLeads(user)) return leads;
  return leads.filter((lead) => leadAssignedToUser(lead, user));
}
