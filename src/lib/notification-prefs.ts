import type { NotificationItem } from "@/types";

export type NotificationPrefs = {
  readIds: string[];
  dismissedIds: string[];
};

const emptyPrefs = (): NotificationPrefs => ({ readIds: [], dismissedIds: [] });

function storageKey(userId: string): string {
  return `notifications-prefs:${userId}`;
}

export function loadNotificationPrefs(userId: string | null | undefined): NotificationPrefs {
  if (!userId || typeof window === "undefined") return emptyPrefs();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return emptyPrefs();
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    const readIds = Array.isArray(parsed.readIds) ? parsed.readIds.filter((id) => typeof id === "string") : [];
    const dismissedIds = Array.isArray(parsed.dismissedIds)
      ? parsed.dismissedIds.filter((id) => typeof id === "string")
      : [];
    return { readIds, dismissedIds };
  } catch {
    return emptyPrefs();
  }
}

export function saveNotificationPrefs(userId: string | null | undefined, prefs: NotificationPrefs): void {
  if (!userId || typeof window === "undefined") return;
  try {
    // Cap growth — keep most recent ids.
    const readIds = [...new Set(prefs.readIds)].slice(-400);
    const dismissedIds = [...new Set(prefs.dismissedIds)].slice(-400);
    localStorage.setItem(storageKey(userId), JSON.stringify({ readIds, dismissedIds }));
  } catch {
    /* ignore quota */
  }
}

export function isNotificationDismissed(prefs: NotificationPrefs, id: string): boolean {
  return prefs.dismissedIds.includes(id);
}

export function isNotificationRead(prefs: NotificationPrefs, id: string): boolean {
  return prefs.readIds.includes(id);
}

export function withPersistedReadState(
  item: NotificationItem,
  prefs: NotificationPrefs,
): NotificationItem | null {
  if (isNotificationDismissed(prefs, item.id)) return null;
  return {
    ...item,
    read: item.read || isNotificationRead(prefs, item.id),
  };
}

export function markIdsRead(prefs: NotificationPrefs, ids: string[]): NotificationPrefs {
  return {
    ...prefs,
    readIds: [...new Set([...prefs.readIds, ...ids])],
  };
}

export function dismissId(prefs: NotificationPrefs, id: string): NotificationPrefs {
  return {
    readIds: prefs.readIds.filter((x) => x !== id),
    dismissedIds: [...new Set([...prefs.dismissedIds, id])],
  };
}
