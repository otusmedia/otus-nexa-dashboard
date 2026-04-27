import type { SupabaseClient } from "@supabase/supabase-js";

type ScheduledPostRow = {
  linked_task_id?: string | null;
  published_at?: string | null;
  scheduled_at?: string | null;
  status?: string | null;
};

/** Same instant used in Publishing / calendar (`mapRowToCalendarEvent`). */
function calendarInstantForPost(r: ScheduledPostRow): string | null {
  const status = String(r.status ?? "").toLowerCase();
  const publishedAt = r.published_at != null ? String(r.published_at).trim() : "";
  const scheduledAt = r.scheduled_at != null ? String(r.scheduled_at).trim() : "";
  const at = status === "published" && publishedAt ? publishedAt : scheduledAt;
  return at || null;
}

/** Latest effective publication/calendar time per task from `scheduled_posts`. */
function latestInstantByTaskId(rows: ScheduledPostRow[]): Map<string, string> {
  const byTask = new Map<string, string>();
  for (const r of rows) {
    const id = String(r.linked_task_id ?? "").trim();
    const instant = calendarInstantForPost(r);
    if (!id || !instant) continue;
    const prev = byTask.get(id);
    if (!prev || new Date(instant) > new Date(prev)) {
      byTask.set(id, instant);
    }
  }
  return byTask;
}

/**
 * Fetches publication timestamps from `scheduled_posts` where `linked_task_id` matches.
 * Use when `tasks.published_at` is null for older rows that were linked to Publishing.
 */
export async function fetchPublishedAtByTaskIds(
  supabase: SupabaseClient,
  taskIds: string[],
): Promise<Map<string, string>> {
  const ids = taskIds.filter(Boolean);
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("scheduled_posts")
    .select("linked_task_id, published_at, scheduled_at, status")
    .in("linked_task_id", ids)
    .not("linked_task_id", "is", null);
  if (error) {
    console.error("[scheduled_posts] fetch times by task:", error.message);
    return new Map();
  }
  return latestInstantByTaskId((data as ScheduledPostRow[] | null) ?? []);
}
