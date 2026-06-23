import type { ProjectTaskRow, TaskRowStatus } from "@/app/(platform)/projects/data";

export type TaskAttentionReason =
  | "waiting_client"
  | "client_changes"
  | "agency_overdue"
  | "due_soon"
  | "on_track";

const COMPLETE_STATUSES: TaskRowStatus[] = ["Done", "Published"];

export function parseYmdTime(s: string | null | undefined): number | null {
  if (!s?.trim()) return null;
  const parts = s.trim().slice(0, 10).split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m - 1, d).getTime();
}

function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function daysUntilDue(dueDate: string | null): number | null {
  const dueT = parseYmdTime(dueDate);
  if (dueT === null) return null;
  const today = startOfToday();
  return Math.round((dueT - today) / (24 * 60 * 60 * 1000));
}

export function isTaskComplete(status: TaskRowStatus): boolean {
  return COMPLETE_STATUSES.includes(status);
}

export function classifyTaskAttention(task: Pick<ProjectTaskRow, "status" | "dueDate" | "reviewStatus">): TaskAttentionReason {
  if (isTaskComplete(task.status)) return "on_track";

  const review = (task.reviewStatus ?? "").trim();
  if (review === "Needs Changes") return "client_changes";

  const days = daysUntilDue(task.dueDate);
  if (days === null) return "on_track";

  const overdue = days < 0;
  const dueSoon = days >= 0 && days <= 3;

  if (overdue && task.status === "Waiting for Approval" && review !== "Approved") {
    return "waiting_client";
  }

  if (overdue && (task.status === "Not Started" || task.status === "In Progress")) {
    return "agency_overdue";
  }

  if (overdue && task.status === "Waiting for Approval") {
    return "waiting_client";
  }

  if (overdue) return "agency_overdue";

  if (dueSoon) return "due_soon";

  return "on_track";
}

/** Higher = more urgent for sorting attention queues. */
export function attentionReasonSeverity(reason: TaskAttentionReason): number {
  switch (reason) {
    case "waiting_client":
      return 40;
    case "client_changes":
      return 35;
    case "agency_overdue":
      return 30;
    case "due_soon":
      return 10;
    default:
      return 0;
  }
}

export function isAttentionReason(reason: TaskAttentionReason): boolean {
  return reason !== "on_track" && reason !== "due_soon";
}

export function countsAsOverdue(reason: TaskAttentionReason): boolean {
  return reason === "waiting_client" || reason === "agency_overdue";
}

export function countsAsWaitingClient(reason: TaskAttentionReason): boolean {
  return reason === "waiting_client";
}
