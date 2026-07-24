import type { AppUser, Client, ModuleKey } from "@/types";
import {
  effectiveUserClientSlug,
  isAgencyCompany,
  isClientCompany,
  isRocketRideCompany,
} from "@/lib/client-utils";

/** Modules shown in user access checkboxes (excludes legacy publishing). */
export const ASSIGNABLE_MODULE_KEYS: ModuleKey[] = [
  "dashboard",
  "projects",
  "financial",
  "updates",
  "marketing",
  "content-management",
  "calendar",
  "crm",
  "files",
  "contracts",
  "portfolio",
  "deliveries",
];

export const ALL_MODULE_KEYS: ModuleKey[] = [
  "dashboard",
  "projects",
  "financial",
  "updates",
  "marketing",
  "content-management",
  "calendar",
  "crm",
  "files",
  "contracts",
  "portfolio",
  "deliveries",
];

/** Modules RocketRide admins may assign (Dashboard, Projects, Financial, Files, Contracts). */
export const ROCKETRIDE_ALLOWED_MODULE_KEYS: ModuleKey[] = [
  "dashboard",
  "projects",
  "financial",
  "files",
  "contracts",
];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  financial: "Financial",
  updates: "Updates",
  marketing: "Marketing",
  publishing: "Publishing",
  "content-management": "Studio",
  calendar: "Calendar",
  crm: "CRM",
  files: "Files",
  contracts: "Contracts",
  portfolio: "Portfolio",
  deliveries: "Deliveries",
};

/** Legacy `publishing` module access maps to Studio → Compose. */
export function hasModuleAccess(userModules: readonly ModuleKey[], module: ModuleKey): boolean {
  if (userModules.includes(module)) return true;
  if (module === "content-management" && userModules.includes("publishing")) return true;
  return false;
}

export type ModuleAssignmentContext = {
  users: AppUser[];
  clients: Client[];
};

export function isExternalClientCompany(company: AppUser["company"]): boolean {
  return isClientCompany(company) && !isRocketRideCompany(company);
}

function modulesFromExplicitList(modules: readonly ModuleKey[]): ModuleKey[] {
  return ASSIGNABLE_MODULE_KEYS.filter((k) => modules.some((m) => hasModuleAccess([m], k) || m === k));
}

/**
 * Modules Nexa provisioned for a client account (`clients.enabled_modules`).
 * Falls back to the union of modules held by users in that org when unset.
 */
export function resolveProvisionedModulesForClient(
  clientSlug: string,
  ctx: ModuleAssignmentContext,
): ModuleKey[] {
  const slug = clientSlug.trim();
  if (!slug) return [];

  const client = ctx.clients.find((c) => c.slug === slug);
  if (client?.enabledModules && client.enabledModules.length > 0) {
    return modulesFromExplicitList(client.enabledModules);
  }

  const orgUsers = ctx.users.filter((u) => effectiveUserClientSlug(u) === slug);
  if (orgUsers.length === 0) return [];

  return ASSIGNABLE_MODULE_KEYS.filter((k) => orgUsers.some((u) => hasModuleAccess(u.modules, k)));
}

/**
 * Modules visible in the shell (sidebar + ModuleGuard) for the current session.
 * When an agency user scopes the UI to one client, only that client's provisioned
 * modules are shown (intersected with the viewer's own access) — even for admins.
 * "All clients" keeps the full agency catalog.
 */
export function resolveAllowedModulesForViewer(
  user: AppUser,
  projectsClientFilter: string,
  ctx: ModuleAssignmentContext,
): ModuleKey[] {
  const base = [...user.modules];
  if (base.length === 0) return [];

  if (!isAgencyCompany(user.company)) {
    return base;
  }

  const slug = projectsClientFilter.trim();
  if (!slug || slug === "all") {
    return base;
  }

  const client = ctx.clients.find((c) => c.slug === slug);
  if (!client) {
    return base;
  }

  if (client.enabledModules && client.enabledModules.length > 0) {
    return modulesFromExplicitList(client.enabledModules).filter((m) => hasModuleAccess(base, m));
  }

  const provisioned = resolveProvisionedModulesForClient(slug, ctx);
  if (provisioned.length > 0) {
    return provisioned.filter((m) => hasModuleAccess(base, m));
  }

  // Client selected but nothing provisioned — do not dump the full agency catalog.
  return [];
}

/**
 * Modules a viewer may grant to other users.
 * Agency: full assignable set. RocketRide: fixed allow-list.
 * External client accounts: panels provisioned for that client (not tied to one admin user).
 */
export function modulesAssignableByViewer(
  viewer: AppUser,
  ctx?: ModuleAssignmentContext,
): ModuleKey[] {
  if (isAgencyCompany(viewer.company) && (viewer.role === "admin" || viewer.role === "manager")) {
    return [...ASSIGNABLE_MODULE_KEYS];
  }
  if (isRocketRideCompany(viewer.company) && viewer.role === "admin") {
    return [...ROCKETRIDE_ALLOWED_MODULE_KEYS];
  }
  if (isRocketRideCompany(viewer.company) && viewer.role === "manager") {
    return ROCKETRIDE_ALLOWED_MODULE_KEYS.filter((k) => hasModuleAccess(viewer.modules, k));
  }
  if (isExternalClientCompany(viewer.company) && (viewer.role === "admin" || viewer.role === "manager")) {
    const slug = effectiveUserClientSlug(viewer);
    if (slug && ctx) {
      return resolveProvisionedModulesForClient(slug, ctx);
    }
    return ASSIGNABLE_MODULE_KEYS.filter((k) => hasModuleAccess(viewer.modules, k));
  }
  return [...ASSIGNABLE_MODULE_KEYS];
}

export function viewerCanAssignModule(
  viewer: AppUser,
  key: ModuleKey,
  ctx?: ModuleAssignmentContext,
): boolean {
  return modulesAssignableByViewer(viewer, ctx).includes(key);
}

/** Default modules for a new admin user in a client account. */
export function defaultAdminModulesForClientCompany(
  company: AppUser["company"],
  ctx: ModuleAssignmentContext,
): ModuleKey[] {
  if (!isClientCompany(company) || isRocketRideCompany(company)) {
    return [...ROCKETRIDE_ALLOWED_MODULE_KEYS];
  }
  return resolveProvisionedModulesForClient(String(company), ctx);
}
