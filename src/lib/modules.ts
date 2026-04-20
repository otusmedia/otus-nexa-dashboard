import type { ModuleKey } from "@/types";

export const ALL_MODULE_KEYS: ModuleKey[] = [
  "dashboard",
  "projects",
  "financial",
  "reports",
  "marketing",
  "files",
  "contracts",
];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  financial: "Financial",
  reports: "Reports",
  marketing: "Marketing",
  files: "Files",
  contracts: "Contracts",
};
