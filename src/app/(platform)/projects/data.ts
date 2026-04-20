export type KanbanColumnId = "planning" | "in_progress" | "paused" | "done" | "cancelled";

export type ProjectStatus = "Planning" | "In Progress" | "Paused" | "Done" | "Cancelled";

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
}

export type ProjectsByColumn = Record<KanbanColumnId, Project[]>;

export function splitProjectsByColumn(projects: Project[]): ProjectsByColumn {
  return {
    planning: projects.filter((project) => project.column === "planning"),
    in_progress: projects.filter((project) => project.column === "in_progress"),
    paused: projects.filter((project) => project.column === "paused"),
    done: projects.filter((project) => project.column === "done"),
    cancelled: projects.filter((project) => project.column === "cancelled"),
  };
}

export function mergeProjectsByColumn(board: ProjectsByColumn): Project[] {
  return [
    ...board.planning,
    ...board.in_progress,
    ...board.paused,
    ...board.done,
    ...board.cancelled,
  ];
}

/** Progress from board task rows (Done + Published), matching project detail view. */
export function computeProjectProgressFromTasks(tasks: ProjectTaskRow[]): number {
  if (tasks.length === 0) return 0;
  const completed = tasks.filter((task) => task.status === "Done" || task.status === "Published").length;
  return Math.round((completed / tasks.length) * 100);
}

export const KANBAN_COLUMNS: Array<{
  id: KanbanColumnId;
  label: string;
  dotClass: string;
}> = [
  { id: "planning", label: "Planning", dotClass: "bg-[#3b82f6]" },
  { id: "in_progress", label: "In Progress", dotClass: "bg-[#ff4500]" },
  { id: "paused", label: "Paused", dotClass: "bg-[#a855f7]" },
  { id: "done", label: "Done", dotClass: "bg-[#22c55e]" },
  { id: "cancelled", label: "Cancelled", dotClass: "bg-[#ef4444]" },
];

export const COLUMN_TO_STATUS: Record<KanbanColumnId, ProjectStatus> = {
  planning: "Planning",
  in_progress: "In Progress",
  paused: "Paused",
  done: "Done",
  cancelled: "Cancelled",
};

export const OWNER_OPTIONS = ["Ana Silva", "Matheus Canci", "Lucas Rocha", "Camila Manager", "David Martins"] as const;

export const TASK_STATUS_OPTIONS: TaskStatusOption[] = [
  { value: "Not Started", group: "To-do", dotClass: "bg-[#9ca3af]" },
  { value: "In Progress", group: "In Progress", dotClass: "bg-[#ff4500]" },
  { value: "Waiting for Approval", group: "In Progress", dotClass: "bg-[#9ca3af]" },
  { value: "Done", group: "Complete", dotClass: "bg-[#22c55e]" },
  { value: "Scheduled", group: "Complete", dotClass: "bg-[#9ca3af]" },
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
