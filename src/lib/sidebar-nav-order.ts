import type { ModuleKey } from "@/types";

function storageKey(userId: string): string {
  return `sidebar-nav-order:${userId}`;
}

export function readSidebarNavOrder(userId: string): ModuleKey[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((k): k is ModuleKey => typeof k === "string");
  } catch {
    return null;
  }
}

export function writeSidebarNavOrder(userId: string, order: ModuleKey[]): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(order));
  } catch {
    /* ignore */
  }
}

export function orderSidebarLinks<T extends { key: ModuleKey }>(items: T[], saved: ModuleKey[] | null): T[] {
  if (!saved?.length) return items;
  const keys = items.map((i) => i.key);
  const ranked = saved.filter((k) => keys.includes(k));
  const tail = keys.filter((k) => !ranked.includes(k));
  const sequence = [...ranked, ...tail];
  return [...items].sort((a, b) => sequence.indexOf(a.key) - sequence.indexOf(b.key));
}
