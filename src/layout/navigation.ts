import type { ModuleKey } from "@/types";

export const platformNavigation: Array<{ key: ModuleKey; href: string }> = [
  { key: "dashboard", href: "/dashboard" },
  { key: "projects", href: "/projects" },
  { key: "financial", href: "/financial" },
  { key: "updates", href: "/updates" },
  { key: "marketing", href: "/marketing" },
  { key: "publishing", href: "/publishing" },
  { key: "calendar", href: "/calendar" },
  { key: "crm", href: "/crm" },
  { key: "files", href: "/files" },
  { key: "contracts", href: "/contracts" },
];
