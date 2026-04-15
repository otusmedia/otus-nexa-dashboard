export type Role = "admin" | "team" | "client" | "traffic_manager" | "assistant";

export type ModuleKey =
  | "dashboard"
  | "tasks"
  | "goals"
  | "roadmap"
  | "events"
  | "ideas"
  | "files"
  | "contracts"
  | "invoices"
  | "marketing"
  | "users";

export type ApprovalStatus = "draft" | "pending" | "approved" | "rejected";
export type TaskStatus = "backlog" | "in_progress" | "in_review" | "completed";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignee: string;
  dueDate: string;
  tags: Array<"Social" | "Google Ads" | "Meta Ads">;
  files: string[];
  comments: TaskComment[];
  approval: ApprovalStatus;
  linkedEventIds: string[];
}

export interface TaskComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  unit: string;
  status: "on_track" | "at_risk" | "off_track";
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  type: "content" | "campaign" | "meeting" | "external";
  assignedUsers: string[];
  linkedTaskIds: string[];
  status: "planned" | "confirmed" | "done";
  tags: string[];
}

export interface FileItem {
  id: string;
  name: string;
  category: "Creatives" | "Videos" | "Reports";
  description: string;
  status: "draft" | "approved" | "archived";
  uploadedAt: string;
  assignee: string;
  tags: string[];
  attachedToTask?: string;
}

export interface ContractItem {
  id: string;
  name: string;
  description: string;
  uploadDate: string;
  status: "active" | "expired";
  assignee: string;
  tags: string[];
}

export interface InvoiceItem {
  id: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  dueDate: string;
  fileName: string;
  description: string;
}

export interface ActivityLogItem {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  message: string;
  type: "task" | "comment" | "file" | "invoice" | "event";
  read: boolean;
}

export interface AppUser {
  id: string;
  name: string;
  role: Role;
  modules: ModuleKey[];
}

export interface IdeaItem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  status: "new" | "validated" | "converted";
  assignee: string;
  tags: string[];
}

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: "planned" | "in_progress" | "done";
  assignee: string;
  tags: string[];
}

export interface EmbedConfig {
  title: string;
  url: string;
}
