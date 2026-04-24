export type TaskHighlightAttachment = {
  type: string;
  name: string;
  url: string;
};

export function parseTaskAttachmentsNested(raw: unknown): TaskHighlightAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const r = item as Record<string, unknown>;
    return {
      type: String(r.type ?? ""),
      name: String(r.name ?? ""),
      url: String(r.url ?? ""),
    };
  });
}

/** Cover for Dashboard Highlights: explicit cover_image, else first image attachment, else null. */
export function getTaskHighlightCoverUrl(task: {
  coverImage?: string | null;
  attachments?: TaskHighlightAttachment[] | null;
}): string | null {
  const explicit = task.coverImage?.trim();
  if (explicit) return explicit;

  const imageAttachment = (task.attachments ?? []).find(
    (att) =>
      att.type?.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(att.name ?? ""),
  );
  if (imageAttachment?.url?.trim()) return imageAttachment.url.trim();

  return null;
}
