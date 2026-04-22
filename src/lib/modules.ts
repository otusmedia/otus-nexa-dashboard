import type { ModuleKey } from "@/types";

export const ALL_MODULE_KEYS: ModuleKey[] = [
  "dashboard",
  "projects",
  "financial",
  "marketing",
  "calendar",
  "crm",
  "files",
  "contracts",
];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  financial: "Financial",
  marketing: "Marketing",
  calendar: "Calendar",
  crm: "CRM",
  files: "Files",
  contracts: "Contracts",
};
