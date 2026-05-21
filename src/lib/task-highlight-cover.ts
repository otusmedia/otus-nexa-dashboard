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

export function isImageHighlightAttachment(att: TaskHighlightAttachment): boolean {
  const type = att.type?.toLowerCase() ?? "";
  const name = att.name?.toLowerCase() ?? "";
  const url = att.url?.toLowerCase() ?? "";
  return (
    type.startsWith("image/") ||
    /\.(jpg|jpeg|png|webp|gif|avif|heic|svg)(\?|#|$)/i.test(name) ||
    /\.(jpg|jpeg|png|webp|gif|avif|heic|svg)(\?|#|$)/i.test(url)
  );
}

export function parseTaskAttachmentsNested(raw: unknown): TaskHighlightAttachment[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map((item) => mapAttachmentRow(item as Record<string, unknown>))
    .filter((item): item is TaskHighlightAttachment => item !== null);
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
