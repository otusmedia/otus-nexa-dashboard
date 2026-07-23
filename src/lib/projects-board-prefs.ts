import type { KanbanColumnId } from "@/app/(platform)/projects/data";
import { ALL_KANBAN_COLUMN_IDS } from "@/app/(platform)/projects/data";

export type ProjectsBoardPrefs = {
  columnOrder: KanbanColumnId[];
  minimized: KanbanColumnId[];
};

function storageKey(userId: string): string {
  return `projects-board-prefs:${userId}`;
}

function normalizeOrder(order: unknown, allowed: readonly string[]): KanbanColumnId[] {
  const valid = new Set(allowed);
  const saved = Array.isArray(order)
    ? order.filter((k): k is KanbanColumnId => typeof k === "string" && valid.has(k))
    : [];
  const tail = allowed.filter((k) => !saved.includes(k));
  return [...saved, ...tail];
}

function normalizeMinimized(value: unknown, order: KanbanColumnId[]): KanbanColumnId[] {
  const allowed = new Set(order);
  if (!Array.isArray(value)) return [];
  return value.filter((k): k is KanbanColumnId => typeof k === "string" && allowed.has(k));
}

export function defaultProjectsBoardPrefs(
  columnIds: readonly string[] = ALL_KANBAN_COLUMN_IDS,
): ProjectsBoardPrefs {
  return {
    columnOrder: [...columnIds],
    minimized: [],
  };
}

export function readProjectsBoardPrefs(
  userId: string,
  columnIds: readonly string[] = ALL_KANBAN_COLUMN_IDS,
): ProjectsBoardPrefs {
  const fallback = defaultProjectsBoardPrefs(columnIds);
  if (typeof window === "undefined" || !userId) return fallback;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ProjectsBoardPrefs>;
    const columnOrder = normalizeOrder(parsed.columnOrder, columnIds);
    return {
      columnOrder,
      minimized: normalizeMinimized(parsed.minimized, columnOrder),
    };
  } catch {
    return fallback;
  }
}

export function writeProjectsBoardPrefs(userId: string, prefs: ProjectsBoardPrefs): void {
  if (!userId) return;
  try {
    localStorage.setItem(
      storageKey(userId),
      JSON.stringify({
        columnOrder: prefs.columnOrder,
        minimized: prefs.minimized,
      }),
    );
  } catch {
    /* ignore */
  }
}
