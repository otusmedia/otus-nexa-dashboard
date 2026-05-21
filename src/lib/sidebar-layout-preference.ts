export type SidebarLayoutMode = "expanded" | "collapsed";

/** Gutter width when sidebar is collapsed (rail 52px + left offset 12px + spacing). */
export const SIDEBAR_RAIL_LAYOUT_WIDTH = 72;

function storageKey(userId: string): string {
  return `sidebar-layout:${userId}`;
}

export function readSidebarLayout(userId: string): SidebarLayoutMode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (raw === "expanded" || raw === "collapsed") return raw;
    return null;
  } catch {
    return null;
  }
}

export function writeSidebarLayout(userId: string, mode: SidebarLayoutMode): void {
  try {
    localStorage.setItem(storageKey(userId), mode);
  } catch {
    /* ignore */
  }
}

export function isSidebarExpanded(userId: string): boolean {
  const stored = readSidebarLayout(userId);
  return stored !== "collapsed";
}
