export type TaskHighlightAttachment = {
  type: string;
  name: string;
  url: string;
};

function mapAttachmentRow(row: Record<string, unknown>): TaskHighlightAttachment | null {
  const url = String(row.url ?? row.file_url ?? row.public_url ?? "").trim();
  if (!url) return null;
  const name = String(row.name ?? row.file_name ?? row.filename ?? "").trim();
  const type = String(row.type ?? row.mime_type ?? row.content_type ?? "").trim();
  return { type, name, url };
}

function isDefinitelyNonImageAttachment(att: TaskHighlightAttachment): boolean {
  const type = att.type?.toLowerCase() ?? "";
  const name = att.name?.toLowerCase() ?? "";
  const url = att.url?.toLowerCase() ?? "";
  if (type.startsWith("video/") || type.includes("pdf") || type.includes("zip")) return true;
  if (/\.(pdf|mp4|mov|webm|zip|rar)(\?|#|$)/i.test(name)) return true;
  if (/\.(pdf|mp4|mov|webm|zip|rar)(\?|#|$)/i.test(url)) return true;
  return false;
}

export function isImageHighlightAttachment(att: TaskHighlightAttachment): boolean {
  if (isDefinitelyNonImageAttachment(att)) return false;

  const type = att.type?.toLowerCase() ?? "";
  const name = att.name?.toLowerCase() ?? "";
  const url = att.url?.toLowerCase() ?? "";
  if (type.startsWith("image/")) return true;
  if (/\.(jpg|jpeg|png|webp|gif|avif|heic|svg|bmp)(\?|#|$)/i.test(name)) return true;
  if (/\.(jpg|jpeg|png|webp|gif|avif|heic|svg|bmp)(\?|#|$)/i.test(url)) return true;

  // Uploads in our task-attachments bucket without a clear extension (common for design exports)
  if (url.includes("/task-attachments/")) return true;

  return false;
}

export function parseTaskAttachmentsNested(raw: unknown): TaskHighlightAttachment[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map((item) => mapAttachmentRow(item as Record<string, unknown>))
    .filter((item): item is TaskHighlightAttachment => item !== null);
}

export function mergeTaskHighlightAttachments(
  nested: unknown,
  fetched?: TaskHighlightAttachment[] | null,
): TaskHighlightAttachment[] {
  const merged = new Map<string, TaskHighlightAttachment>();
  for (const att of [...parseTaskAttachmentsNested(nested), ...(fetched ?? [])]) {
    if (att.url) merged.set(att.url, att);
  }
  return [...merged.values()];
}

export function groupTaskAttachmentsByTaskId(
  rows: Record<string, unknown>[],
): Map<string, TaskHighlightAttachment[]> {
  const byTask = new Map<string, TaskHighlightAttachment[]>();
  for (const row of rows) {
    const taskId = String(row.task_id ?? "");
    if (!taskId) continue;
    const att = mapAttachmentRow(row);
    if (!att) continue;
    const list = byTask.get(taskId) ?? [];
    list.push(att);
    byTask.set(taskId, list);
  }
  return byTask;
}

/** Cover for Dashboard Highlights: explicit cover_image, else first image attachment, else null. */
export function getTaskHighlightCoverUrl(task: {
  coverImage?: string | null;
  attachments?: TaskHighlightAttachment[] | null;
}): string | null {
  const explicit = task.coverImage?.trim();
  if (explicit) return explicit;

  const imageAttachment = (task.attachments ?? []).find(isImageHighlightAttachment);
  if (imageAttachment?.url?.trim()) return imageAttachment.url.trim();

  return null;
}

/** Safe for CSS `background-image` and HTML `src` (spaces, quotes in filenames). */
export function highlightCoverCssUrl(url: string): string {
  const escaped = url.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `url("${escaped}")`;
}
