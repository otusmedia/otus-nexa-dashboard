import type { ModuleKey } from "@/types";

export const ALL_MODULE_KEYS: ModuleKey[] = [
  "dashboard",
  "projects",
  "financial",
  "updates",
  "marketing",
  "publishing",
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
  "content-management": "Content Management",
  calendar: "Calendar",
  crm: "CRM",
  files: "Files",
  contracts: "Contracts",
};
