import type { TaskHighlightAttachment } from "@/lib/task-highlight-cover";
import {
  canonicalizeProjectStatus,
  DEFAULT_PROJECT_BOARD_STATUSES,
} from "@/lib/project-board-statuses";

/** Kanban column key = project status name (e.g. "Planning", custom names). */
export type KanbanColumnId = string;

export type ProjectStatus = string;

export type ProjectType = "Website" | "Monthly Content" | "Paid Traffic";

export type TaskRowStatus =
  | "Not Started"
  | "In Progress"
  | "Waiting for Approval"
  | "Done"
  | "Scheduled"
  | "Published";

export interface ProjectTaskRow {
  id: string;
  name: string;
  dueDate: string | null;
  owner: string;
  status: TaskRowStatus;
  isFeatured: boolean;
  coverImage: string | null;
  shortDescription: string;
  /** Latest client review outcome from `tasks.review_status` (Approved | Needs Changes | Rejected). */
  reviewStatus: string | null;
  /** Platforms selected when status is Published (`tasks.published_to`). */
  publishedTo: string[];
  /** When the task was marked published (`tasks.published_at`), ISO string. */
  publishedAt: string | null;
  /** From `task_attachments` — used for Highlights when no dedicated cover. */
  attachments: TaskHighlightAttachment[];
}

export interface TaskStatusOption {
  value: TaskRowStatus;
  group: "To-do" | "In Progress" | "Complete";
  dotClass: string;
}

export interface Project {
  id: string;
  name: string;
  column: KanbanColumnId;
  owners: string[];
  progress: number;
  dueDate: string | null;
  status: ProjectStatus;
  type: ProjectType;
  startDate: string | null;
  teamMembers: string[];
  linkedInvoices: string[];
  description: string;
  tasks: ProjectTaskRow[];
  clientSlug: string | null;
}

export type ProjectsByColumn = Record<string, Project[]>;

/** Default left→right order (Paused last). */
export const ALL_KANBAN_COLUMN_IDS: KanbanColumnId[] = DEFAULT_PROJECT_BOARD_STATUSES.map((s) => s.name);

export function emptyProjectsByColumn(columnIds: readonly string[] = ALL_KANBAN_COLUMN_IDS): ProjectsByColumn {
  const board: ProjectsByColumn = {};
  for (const id of columnIds) {
    board[id] = [];
  }
  return board;
}

export function splitProjectsByColumn(
  projects: Project[],
  columnIds: readonly string[] = ALL_KANBAN_COLUMN_IDS,
): ProjectsByColumn {
  const board = emptyProjectsByColumn(columnIds);
  const fallback = columnIds[0] ?? "Planning";
  for (const project of projects) {
    const key = columnIds.includes(project.column)
      ? project.column
      : columnIds.find((id) => id.toLowerCase() === project.column.toLowerCase()) ?? fallback;
    board[key] = board[key] ?? [];
    board[key].push({ ...project, column: key, status: key });
  }
  return board;
}

export function mergeProjectsByColumn(board: ProjectsByColumn): Project[] {
  const keys = Object.keys(board);
  const ordered = [
    ...ALL_KANBAN_COLUMN_IDS.filter((id) => keys.includes(id)),
    ...keys.filter((id) => !ALL_KANBAN_COLUMN_IDS.includes(id)),
  ];
  return ordered.flatMap((id) => board[id] ?? []);
}

export function cloneProjectsByColumn(board: ProjectsByColumn): ProjectsByColumn {
  const next: ProjectsByColumn = {};
  for (const id of Object.keys(board)) {
    next[id] = [...(board[id] ?? [])];
  }
  return next;
}

export function mapAllProjectColumns(
  board: ProjectsByColumn,
  mapProject: (project: Project) => Project,
): ProjectsByColumn {
  const next: ProjectsByColumn = {};
  for (const id of Object.keys(board)) {
    next[id] = (board[id] ?? []).map(mapProject);
  }
  return next;
}

export function mapAllProjectColumnLists(
  board: ProjectsByColumn,
  mapList: (list: Project[]) => Project[],
): ProjectsByColumn {
  const next: ProjectsByColumn = {};
  for (const id of Object.keys(board)) {
    next[id] = mapList(board[id] ?? []);
  }
  return next;
}

/** Task statuses that count as production-complete for the progress bar. */
export function isTaskCountingTowardProgress(status: TaskRowStatus | string): boolean {
  return status === "Done" || status === "Scheduled" || status === "Published";
}

/** Progress from board task rows (Done + Scheduled + Published). */
export function computeProjectProgressFromTasks(tasks: Array<{ status: TaskRowStatus | string }>): number {
  if (tasks.length === 0) return 0;
  const completed = tasks.filter((task) => isTaskCountingTowardProgress(task.status)).length;
  return Math.round((completed / tasks.length) * 100);
}

export const KANBAN_COLUMNS: Array<{
  id: KanbanColumnId;
  label: string;
  dotClass: string;
}> = DEFAULT_PROJECT_BOARD_STATUSES.map((s) => ({
  id: s.name,
  label: s.name,
  dotClass: s.dotClass,
}));

/** Identity map — column id and stored status are the same string. */
export const COLUMN_TO_STATUS: Record<string, ProjectStatus> = Object.fromEntries(
  ALL_KANBAN_COLUMN_IDS.map((id) => [id, id]),
);

export const STATUS_TO_COLUMN: Record<string, KanbanColumnId> = Object.fromEntries(
  ALL_KANBAN_COLUMN_IDS.map((id) => [id, id]),
);

export function columnIdForStatus(status: string | null | undefined): KanbanColumnId {
  return canonicalizeProjectStatus(status);
}

export function statusForColumn(columnId: string): ProjectStatus {
  return columnId;
}

/** Team members available as project owners (Properties multi-select). */
export const PROJECT_TEAM_MEMBERS = [
  "Matheus Canci",
  "David Martins",
  "Matheus Foletto",
  "Joe",
  "Karla Kachuba",
  "Luca",
] as const;

export const OWNER_OPTIONS = ["Ana Silva", "Matheus Canci", "Lucas Rocha", "Camila Manager", "David Martins"] as const;

export const TASK_STATUS_OPTIONS: TaskStatusOption[] = [
  { value: "Not Started", group: "To-do", dotClass: "bg-[#9ca3af]" },
  { value: "In Progress", group: "In Progress", dotClass: "bg-[#ff4500]" },
  { value: "Waiting for Approval", group: "In Progress", dotClass: "bg-[#9ca3af]" },
  { value: "Done", group: "Complete", dotClass: "bg-[#22c55e]" },
  { value: "Scheduled", group: "Complete", dotClass: "bg-[#06b6d4]" },
  { value: "Published", group: "Complete", dotClass: "bg-[#3b82f6]" },
];

export const MOCK_PROJECTS: Project[] = [];

export function getProjectById(id: string): Project | undefined {
  return MOCK_PROJECTS.find((p) => p.id === id);
}

export function formatDisplayDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
}

/** Date + time for publishing timestamp in task tables. */
export function formatPublishedAt(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
