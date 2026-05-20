export type SidebarLayoutMode = "expanded" | "collapsed";

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
