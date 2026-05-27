import type { ModuleKey } from "@/types";

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
};

/** Legacy `publishing` module access maps to Studio → Compose. */
export function hasModuleAccess(userModules: readonly ModuleKey[], module: ModuleKey): boolean {
  if (userModules.includes(module)) return true;
  if (module === "content-management" && userModules.includes("publishing")) return true;
  return false;
}
