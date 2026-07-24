import { platformNavigation } from "@/layout/navigation";
import { isAgencyAdmin } from "@/lib/client-utils";
import { hasModuleAccess, resolveAllowedModulesForViewer } from "@/lib/modules";
import type { AppUser, Client, ModuleKey } from "@/types";

export const AGENCY_HOME_PATH = "/home";

/** CRM submenu order — first item is the default when CRM is the landing module. */
export const CRM_MODULE_PATHS = [
  "/crm/dashboard",
  "/crm/pipeline",
  "/crm/contacts",
  "/crm/reports",
] as const;

export const MODULE_ENTRY_PATHS: Record<ModuleKey, string> = {
  dashboard: "/dashboard",
  projects: "/projects",
  financial: "/financial",
  updates: "/updates",
  marketing: "/marketing/strategy",
  publishing: "/publishing",
  "content-management": "/content-management/ai-studio",
  calendar: "/calendar",
  crm: CRM_MODULE_PATHS[0],
  files: "/files",
  contracts: "/contracts",
  portfolio: "/portfolio",
  deliveries: "/deliveries",
};

export type LandingPathOptions = {
  navOrder?: ModuleKey[] | null;
  canAccessMarketing?: boolean;
};

function moduleAccessible(
  modules: readonly ModuleKey[],
  key: ModuleKey,
  canAccessMarketing: boolean,
): boolean {
  if (key === "marketing") {
    return hasModuleAccess(modules, key) && canAccessMarketing;
  }
  return hasModuleAccess(modules, key);
}

function orderedAccessibleModules(
  modules: readonly ModuleKey[],
  opts: LandingPathOptions,
): ModuleKey[] {
  const canAccessMarketing = opts.canAccessMarketing ?? true;
  const keys = platformNavigation.map((n) => n.key);
  const saved = opts.navOrder?.filter((k) => keys.includes(k)) ?? [];
  const tail = keys.filter((k) => !saved.includes(k));
  const sequence = [...saved, ...tail];
  return sequence.filter((k) => moduleAccessible(modules, k, canAccessMarketing));
}

export function resolveDefaultLandingPath(
  modules: readonly ModuleKey[],
  opts: LandingPathOptions = {},
): string {
  const first = orderedAccessibleModules(modules, opts)[0];
  if (!first) return "/projects";
  return MODULE_ENTRY_PATHS[first] ?? platformNavigation.find((n) => n.key === first)?.href ?? "/projects";
}

export function resolveDefaultCrmPath(): string {
  return CRM_MODULE_PATHS[0];
}

export function canAccessMarketingForUser(user: AppUser): boolean {
  if (user.role === "admin" && (user.company === "nexa" || user.company === "otus")) {
    return true;
  }
  return hasModuleAccess(user.modules, "marketing");
}

export function resolveDefaultLandingPathForUser(
  user: AppUser,
  navOrder?: ModuleKey[] | null,
): string {
  if (isAgencyAdmin(user)) return AGENCY_HOME_PATH;
  return resolveDefaultLandingPath(user.modules, {
    navOrder,
    canAccessMarketing: canAccessMarketingForUser(user),
  });
}

/** First module path when an agency admin scopes the UI to one client account. */
export function resolveAgencyClientLandingPath(
  user: AppUser,
  clientSlug: string,
  ctx: { clients: Client[]; users: AppUser[] },
  opts: LandingPathOptions = {},
): string {
  const slug = clientSlug.trim();
  if (!slug || slug === "all") {
    return resolveDefaultLandingPathForUser(user, opts.navOrder);
  }

  const scoped = resolveAllowedModulesForViewer(user, slug, ctx);

  const landingOpts = {
    ...opts,
    canAccessMarketing: opts.canAccessMarketing ?? canAccessMarketingForUser(user),
  };

  if (scoped.length === 0) {
    return AGENCY_HOME_PATH;
  }

  return resolveDefaultLandingPath(scoped, landingOpts);
}

export function isAgencyHomePath(pathname: string): boolean {
  return pathname === AGENCY_HOME_PATH || pathname.startsWith(`${AGENCY_HOME_PATH}/`);
}

export function moduleKeyForPathname(pathname: string): ModuleKey | null {
  for (const { key, href } of platformNavigation) {
    if (pathname === href || pathname.startsWith(`${href}/`)) return key;
  }
  return null;
}

export function pathnameAllowedForModules(
  pathname: string,
  modules: readonly ModuleKey[],
  opts: LandingPathOptions = {},
): boolean {
  if (isAgencyHomePath(pathname)) return false;
  const key = moduleKeyForPathname(pathname);
  if (!key) return true;
  const canAccessMarketing = opts.canAccessMarketing ?? true;
  return moduleAccessible(modules, key, canAccessMarketing);
}
