import type { ModuleKey } from "@/types";
import { platformNavigation } from "@/layout/navigation";

export function getSidebarLinks(enabledModules: ModuleKey[]) {
  return platformNavigation.filter((item) => enabledModules.includes(item.key));
}
