import type { TaskHighlightAttachment } from "@/lib/task-highlight-cover";

export type KanbanColumnId =
  | "planning"
  | "in_progress"
  | "scheduled"
  | "done"
  | "cancelled"
  | "paused";

export type ProjectStatus =
  | "Planning"
  | "In Progress"
  | "Scheduled"
  | "Done"
  | "Cancelled"
  | "Paused";

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

export type ProjectsByColumn = Record<KanbanColumnId, Project[]>;

/** Default left→right order (Paused last). Users can reorder via board prefs. */
export const ALL_KANBAN_COLUMN_IDS: KanbanColumnId[] = [
  "planning",
  "in_progress",
  "scheduled",
  "done",
  "cancelled",
  "paused",
];

export function emptyProjectsByColumn(): ProjectsByColumn {
  return {
    planning: [],
    in_progress: [],
    scheduled: [],
    done: [],
    cancelled: [],
    paused: [],
  };
}

export function splitProjectsByColumn(projects: Project[]): ProjectsByColumn {
  const board = emptyProjectsByColumn();
  for (const project of projects) {
    board[project.column].push(project);
  }
  return board;
}

export function mergeProjectsByColumn(board: ProjectsByColumn): Project[] {
  return ALL_KANBAN_COLUMN_IDS.flatMap((id) => board[id]);
}

export function cloneProjectsByColumn(board: ProjectsByColumn): ProjectsByColumn {
  const next = emptyProjectsByColumn();
  for (const id of ALL_KANBAN_COLUMN_IDS) {
    next[id] = [...(board[id] ?? [])];
  }
  return next;
}

export function mapAllProjectColumns(
  board: ProjectsByColumn,
  mapProject: (project: Project) => Project,
): ProjectsByColumn {
  const next = emptyProjectsByColumn();
  for (const id of ALL_KANBAN_COLUMN_IDS) {
    next[id] = (board[id] ?? []).map(mapProject);
  }
  return next;
}

export function mapAllProjectColumnLists(
  board: ProjectsByColumn,
  mapList: (list: Project[]) => Project[],
): ProjectsByColumn {
  const next = emptyProjectsByColumn();
  for (const id of ALL_KANBAN_COLUMN_IDS) {
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
}> = [
  { id: "planning", label: "Planning", dotClass: "bg-[#3b82f6]" },
  { id: "in_progress", label: "In Progress", dotClass: "bg-[#ff4500]" },
  { id: "scheduled", label: "Scheduled", dotClass: "bg-[#06b6d4]" },
  { id: "done", label: "Done", dotClass: "bg-[#22c55e]" },
  { id: "cancelled", label: "Cancelled", dotClass: "bg-[#ef4444]" },
  { id: "paused", label: "Paused", dotClass: "bg-[#a855f7]" },
];

export const COLUMN_TO_STATUS: Record<KanbanColumnId, ProjectStatus> = {
  planning: "Planning",
  in_progress: "In Progress",
  scheduled: "Scheduled",
  done: "Done",
  cancelled: "Cancelled",
  paused: "Paused",
};

/** Kanban column for each project status (detail panel + board moves). */
export const STATUS_TO_COLUMN: Record<ProjectStatus, KanbanColumnId> = {
  Planning: "planning",
  "In Progress": "in_progress",
  Scheduled: "scheduled",
  Done: "done",
  Cancelled: "cancelled",
  Paused: "paused",
};

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
