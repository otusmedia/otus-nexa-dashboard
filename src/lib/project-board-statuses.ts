import { supabase } from "@/lib/supabase";

export type ProjectBoardStatusDef = {
  id: string;
  name: string;
  dotClass: string;
  sortOrder: number;
};

export const PROJECT_STATUS_DOT_CLASSES = [
  "bg-[#3b82f6]",
  "bg-[#ff4500]",
  "bg-[#06b6d4]",
  "bg-[#22c55e]",
  "bg-[#ef4444]",
  "bg-[#a855f7]",
  "bg-[#eab308]",
  "bg-[#9ca3af]",
] as const;

export const DEFAULT_PROJECT_BOARD_STATUSES: Array<{ name: string; dotClass: string }> = [
  { name: "Planning", dotClass: "bg-[#3b82f6]" },
  { name: "In Progress", dotClass: "bg-[#ff4500]" },
  { name: "Scheduled", dotClass: "bg-[#06b6d4]" },
  { name: "Done", dotClass: "bg-[#22c55e]" },
  { name: "Cancelled", dotClass: "bg-[#ef4444]" },
  { name: "Paused", dotClass: "bg-[#a855f7]" },
];

export function nextProjectStatusDotClass(index: number): string {
  return PROJECT_STATUS_DOT_CLASSES[index % PROJECT_STATUS_DOT_CLASSES.length] ?? "bg-[#3b82f6]";
}

export function defaultProjectBoardStatuses(): ProjectBoardStatusDef[] {
  return DEFAULT_PROJECT_BOARD_STATUSES.map((s, index) => ({
    id: `default:${s.name}`,
    name: s.name,
    dotClass: s.dotClass,
    sortOrder: index,
  }));
}

/** Map legacy snake_case / casing variants to canonical default names. */
export function canonicalizeProjectStatus(status: string | null | undefined): string {
  const raw = String(status ?? "").trim();
  if (!raw) return "Planning";
  const lower = raw.toLowerCase().replace(/_/g, " ");
  const legacy: Record<string, string> = {
    planning: "Planning",
    "in progress": "In Progress",
    scheduled: "Scheduled",
    done: "Done",
    cancelled: "Cancelled",
    paused: "Paused",
  };
  return legacy[lower] ?? raw;
}

export function matchStatusToBoard(
  status: string | null | undefined,
  statuses: Array<{ name: string }>,
): string {
  const canonical = canonicalizeProjectStatus(status);
  if (!statuses.length) return canonical;
  const hit = statuses.find((s) => s.name.toLowerCase() === canonical.toLowerCase());
  return hit?.name ?? statuses[0]!.name;
}

export async function fetchProjectBoardStatuses(clientSlug: string): Promise<ProjectBoardStatusDef[]> {
  const slug = clientSlug.trim().toLowerCase();
  if (!slug || slug === "all") return defaultProjectBoardStatuses();

  const { data, error } = await supabase
    .from("project_board_statuses")
    .select("id, name, sort_order, dot_class")
    .eq("client_slug", slug)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[projects] board statuses fetch failed:", error.message);
    return defaultProjectBoardStatuses();
  }

  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  if (rows.length === 0) return defaultProjectBoardStatuses();

  return rows.map((row, index) => ({
    id: String(row.id ?? `row:${index}`),
    name: String(row.name ?? "").trim() || `Status ${index + 1}`,
    dotClass: String(row.dot_class ?? nextProjectStatusDotClass(index)),
    sortOrder: Number(row.sort_order ?? index) || index,
  }));
}

export type SaveProjectBoardStatusesInput = {
  statuses: Array<{ name: string; dotClass: string }>;
};

/**
 * Replace board statuses for a client and remap `projects.status` (rename by index;
 * deleted statuses → first status), mirroring CRM funnel stage updates.
 */
export async function saveProjectBoardStatuses(
  clientSlug: string,
  input: SaveProjectBoardStatusesInput,
): Promise<ProjectBoardStatusDef[] | null> {
  const slug = clientSlug.trim().toLowerCase();
  if (!slug || slug === "all") return null;

  const statuses = input.statuses
    .map((s) => ({ name: s.name.trim(), dotClass: s.dotClass.trim() || nextProjectStatusDotClass(0) }))
    .filter((s) => s.name);

  if (!statuses.length) return null;

  // Deduplicate names (case-insensitive), keep first
  const seen = new Set<string>();
  const unique = statuses.filter((s) => {
    const key = s.name.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const { data: oldRows, error: oldErr } = await supabase
    .from("project_board_statuses")
    .select("name, sort_order")
    .eq("client_slug", slug)
    .order("sort_order", { ascending: true });

  if (oldErr) {
    console.error("[projects] board statuses read failed:", oldErr.message);
    // Table may not exist yet — still try write path below
  }

  const oldOrdered =
    oldRows && oldRows.length > 0
      ? [...oldRows]
          .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
          .map((s) => String(s.name ?? ""))
      : DEFAULT_PROJECT_BOARD_STATUSES.map((s) => s.name);

  const newNamesLower = new Set(unique.map((s) => s.name.toLowerCase()));
  const fallbackStatus = unique[0]!.name;

  const renameByIndex = new Map<string, string>();
  for (let i = 0; i < oldOrdered.length; i++) {
    const oldName = oldOrdered[i];
    const newName = unique[i]?.name;
    if (!oldName || !newName) continue;
    if (oldName.toLowerCase() !== newName.toLowerCase()) {
      renameByIndex.set(oldName.toLowerCase(), newName);
    }
  }

  const { data: projects, error: projectsErr } = await supabase
    .from("projects")
    .select("id, status")
    .eq("client_slug", slug);

  if (projectsErr) {
    console.error("[projects] status remap fetch failed:", projectsErr.message);
  }

  for (const project of projects ?? []) {
    let nextStatus = canonicalizeProjectStatus(project.status != null ? String(project.status) : null);
    const renamed = renameByIndex.get(nextStatus.toLowerCase());
    if (renamed) nextStatus = renamed;
    if (!newNamesLower.has(nextStatus.toLowerCase())) nextStatus = fallbackStatus;
    if (nextStatus === String(project.status ?? "")) continue;
    const { error } = await supabase.from("projects").update({ status: nextStatus }).eq("id", project.id);
    if (error) console.error("[projects] status remap update failed:", error.message);
  }

  const { error: delErr } = await supabase.from("project_board_statuses").delete().eq("client_slug", slug);
  if (delErr) {
    console.error("[projects] board statuses delete failed:", delErr.message);
    return null;
  }

  const { data: inserted, error: insErr } = await supabase
    .from("project_board_statuses")
    .insert(
      unique.map((stage, index) => ({
        client_slug: slug,
        name: stage.name,
        sort_order: index,
        dot_class: stage.dotClass,
      })),
    )
    .select("id, name, sort_order, dot_class");

  if (insErr) {
    console.error("[projects] board statuses insert failed:", insErr.message);
    return null;
  }

  const rows = (inserted as Array<Record<string, unknown>> | null) ?? [];
  return rows.map((row, index) => ({
    id: String(row.id ?? `row:${index}`),
    name: String(row.name ?? ""),
    dotClass: String(row.dot_class ?? nextProjectStatusDotClass(index)),
    sortOrder: Number(row.sort_order ?? index) || index,
  }));
}

export function canManageProjectBoardStatuses(
  user: { company: string; role: string },
  boardClientSlug: string | null | undefined,
): boolean {
  const slug = (boardClientSlug ?? "").trim().toLowerCase();
  if (!slug || slug === "all") return false;
  const company = String(user.company);
  if (company === "nexa" || company === "otus") return true;
  if (user.role === "admin" && company === slug) return true;
  return false;
}
