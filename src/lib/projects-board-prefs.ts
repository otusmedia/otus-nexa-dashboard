import {
  ALL_KANBAN_COLUMN_IDS,
  type KanbanColumnId,
} from "@/app/(platform)/projects/data";

export type ProjectsBoardPrefs = {
  columnOrder: KanbanColumnId[];
  minimized: KanbanColumnId[];
};

function storageKey(userId: string): string {
  return `projects-board-prefs:${userId}`;
}

function normalizeOrder(order: unknown): KanbanColumnId[] {
  const valid = new Set(ALL_KANBAN_COLUMN_IDS);
  const saved = Array.isArray(order)
    ? order.filter((k): k is KanbanColumnId => typeof k === "string" && valid.has(k as KanbanColumnId))
    : [];
  const tail = ALL_KANBAN_COLUMN_IDS.filter((k) => !saved.includes(k));
  return [...saved, ...tail];
}

function normalizeMinimized(value: unknown, order: KanbanColumnId[]): KanbanColumnId[] {
  const allowed = new Set(order);
  if (!Array.isArray(value)) return [];
  return value.filter((k): k is KanbanColumnId => typeof k === "string" && allowed.has(k as KanbanColumnId));
}

export function defaultProjectsBoardPrefs(): ProjectsBoardPrefs {
  return {
    columnOrder: [...ALL_KANBAN_COLUMN_IDS],
    minimized: [],
  };
}

export function readProjectsBoardPrefs(userId: string): ProjectsBoardPrefs {
  const fallback = defaultProjectsBoardPrefs();
  if (typeof window === "undefined" || !userId) return fallback;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ProjectsBoardPrefs>;
    const columnOrder = normalizeOrder(parsed.columnOrder);
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
    const columnOrder = normalizeOrder(prefs.columnOrder);
    localStorage.setItem(
      storageKey(userId),
      JSON.stringify({
        columnOrder,
        minimized: normalizeMinimized(prefs.minimized, columnOrder),
      }),
    );
  } catch {
    /* ignore */
  }
}
