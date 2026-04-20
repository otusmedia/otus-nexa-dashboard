import type { ModuleKey } from "@/types";

export const platformNavigation: Array<{ key: ModuleKey; href: string }> = [
  { key: "dashboard", href: "/dashboard" },
  { key: "projects", href: "/projects" },
  { key: "financial", href: "/financial" },
  { key: "reports", href: "/reports" },
  { key: "marketing", href: "/marketing" },
  { key: "files", href: "/files" },
  { key: "contracts", href: "/contracts" },
];
