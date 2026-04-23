"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  Eye,
  File,
  FileText,
  Film,
  Image as ImageIcon,
  Paperclip,
  Pencil,
  Pin,
  Trash2,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useAppContext } from "@/components/providers/app-providers";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const CATEGORIES = ["Meeting Notes", "Update", "Highlight", "Content Brief", "Other"] as const;
type UpdateCategory = (typeof CATEGORIES)[number];

const BUCKET = "updates-attachments";

const CATEGORY_STYLES: Record<UpdateCategory, { label: string; fg: string; bg: string; border: string }> = {
  "Meeting Notes": {
    label: "Meeting Notes",
    fg: "#1877F2",
    bg: "rgba(24, 119, 242, 0.18)",
    border: "rgba(24, 119, 242, 0.35)",
  },
  Update: { label: "Update", fg: "#FF4500", bg: "rgba(255, 69, 0, 0.18)", border: "rgba(255, 69, 0, 0.35)" },
  Highlight: { label: "Highlight", fg: "#22c55e", bg: "rgba(34, 197, 94, 0.18)", border: "rgba(34, 197, 94, 0.35)" },
  "Content Brief": {
    label: "Content Brief",
    fg: "#8b5cf6",
    bg: "rgba(139, 92, 246, 0.2)",
    border: "rgba(139, 92, 246, 0.35)",
  },
  Other: {
    label: "Other",
    fg: "rgba(255,255,255,0.65)",
    bg: "rgba(255,255,255,0.08)",
    border: "rgba(255,255,255,0.12)",
  },
};

type UpdateAttachmentRow = {
  id: string;
  update_id: string;
  name: string;
  url: string;
  type: string | null;
  size: number | null;
  created_at?: string;
};

type ClientUpdateRow = {
  id: string;
  content: string;
  category: string;
  author_name: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  update_attachments?: UpdateAttachmentRow[] | null;
};

function hueFromName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h + name.charCodeAt(i) * 17) % 360;
  return h;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
}

function normalizeCategory(raw: string): UpdateCategory {
  const c = CATEGORIES.find((x) => x === raw);
  return c ?? "Other";
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-()+ ]/g, "_").slice(0, 200);
}

function attachmentPreviewKind(att: Pick<UpdateAttachmentRow, "type" | "name">): "pdf" | "image" | "other" {
  const mime = (att.type ?? "").toLowerCase();
  const ext = att.name.split(".").pop()?.toLowerCase() ?? "";
  if (mime.includes("pdf") || ext === "pdf") return "pdf";
  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp"].includes(ext)) return "image";
  return "other";
}

function attachmentIcon(att: UpdateAttachmentRow) {
  const k = attachmentPreviewKind(att);
  if (k === "image") return ImageIcon;
  if (k === "pdf") return FileText;
  if ((att.type ?? "").startsWith("video/")) return Film;
  return File;
}

const UPDATES_STORAGE_URL_MARKER = `/storage/v1/object/public/${BUCKET}/`;

function storagePathFromAttachmentUrl(url: string): string | null {
  const i = url.indexOf(UPDATES_STORAGE_URL_MARKER);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + UPDATES_STORAGE_URL_MARKER.length));
}

function mapUpdateRow(row: Record<string, unknown>): ClientUpdateRow {
  const nested = row.update_attachments;
  const attachments = Array.isArray(nested)
    ? (nested as Record<string, unknown>[]).map((r) => ({
        id: String(r.id ?? ""),
        update_id: String(r.update_id ?? ""),
        name: String(r.name ?? ""),
        url: String(r.url ?? ""),
        type: r.type != null ? String(r.type) : null,
        size: typeof r.size === "number" ? r.size : r.size != null ? Number(r.size) : null,
        created_at: r.created_at != null ? String(r.created_at) : undefined,
      }))
    : [];
  return {
    id: String(row.id ?? ""),
    content: String(row.content ?? ""),
    category: String(row.category ?? "Other"),
    author_name: String(row.author_name ?? ""),
    is_pinned: Boolean(row.is_pinned),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? row.created_at ?? ""),
    update_attachments: attachments,
  };
}

type PendingFile = { id: string; file: File };

type PreviewTarget = {
  name: string;
  url: string;
  kind: "pdf" | "image";
};

function isNexaOtusAdmin(role: string, company: string) {
  return role === "admin" && (company === "nexa" || company === "otus");
}

export function ClientUpdatesModule() {
  const { currentUser } = useAppContext();
  const adminNexaOtus = isNexaOtusAdmin(currentUser.role, currentUser.company);
  const [updates, setUpdates] = useState<ClientUpdateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [composerContent, setComposerContent] = useState("");
  const [composerCategory, setComposerCategory] = useState<UpdateCategory>("Update");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);

  const fetchUpdates = useCallback(async () => {
    const { data, error } = await supabase
      .from("client_updates")
      .select("*, update_attachments(*)")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[client_updates] fetch:", error.message);
      setUpdates([]);
    } else {
      setUpdates(((data as Record<string, unknown>[]) ?? []).map(mapUpdateRow));
    }
    setLoading(false);
  }, []);

  const fetchUpdatesRef = useRef(fetchUpdates);
  fetchUpdatesRef.current = fetchUpdates;

  useEffect(() => {
    void fetchUpdates();
  }, [fetchUpdates]);

  useEffect(() => {
    const channel = supabase
      .channel("client-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "client_updates" }, () => {
        void fetchUpdatesRef.current();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "update_attachments" }, () => {
        void fetchUpdatesRef.current();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const pinnedList = useMemo(() => updates.filter((u) => u.is_pinned), [updates]);

  const resetComposer = () => {
    setComposerContent("");
    setComposerCategory("Update");
    setPendingFiles([]);
    setEditingId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startEdit = (u: ClientUpdateRow) => {
    setEditingId(u.id);
    setComposerContent(u.content);
    setComposerCategory(normalizeCategory(u.category));
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onPickFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const next: PendingFile[] = [...pendingFiles];
    for (const file of Array.from(list)) {
      next.push({ id: crypto.randomUUID(), file });
    }
    setPendingFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePending = (id: string) => {
    setPendingFiles((prev) => prev.filter((p) => p.id !== id));
  };

  const uploadAttachmentsForUpdate = async (updateId: string, files: File[]) => {
    for (const file of files) {
      const safe = sanitizeFileName(file.name);
      const path = `updates/${updateId}/${Date.now()}-${safe}`;
      const { data, error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: "3600", upsert: false });
      if (error || !data?.path) {
        console.error("[client_updates] storage upload:", error?.message);
        continue;
      }
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
      const publicUrl = pub.publicUrl;
      const { error: insErr } = await supabase.from("update_attachments").insert([
        {
          update_id: updateId,
          name: file.name,
          url: publicUrl,
          type: file.type,
          size: file.size,
        },
      ]);
      if (insErr) {
        console.error("[client_updates] attachment insert:", insErr.message);
        await supabase.storage.from(BUCKET).remove([data.path]);
      }
    }
  };

  const handlePost = async () => {
    const text = composerContent.trim();
    if (!text || posting) return;
    setPosting(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("client_updates")
          .update({
            content: text,
            category: composerCategory,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);
        if (error) {
          console.error("[client_updates] update:", error.message);
          return;
        }
        resetComposer();
        await fetchUpdates();
        return;
      }

      const { data: row, error } = await supabase
        .from("client_updates")
        .insert([
          {
            content: text,
            category: composerCategory,
            author_name: currentUser.name,
          },
        ])
        .select("*")
        .single();
      if (error || !row) {
        console.error("[client_updates] insert:", error?.message);
        return;
      }
      const id = String((row as Record<string, unknown>).id ?? "");
      if (pendingFiles.length && id) {
        await uploadAttachmentsForUpdate(
          id,
          pendingFiles.map((p) => p.file),
        );
      }
      resetComposer();
      await fetchUpdates();
    } finally {
      setPosting(false);
    }
  };

  const togglePin = async (u: ClientUpdateRow) => {
    if (!adminNexaOtus) return;
    const next = !u.is_pinned;
    const { error } = await supabase.from("client_updates").update({ is_pinned: next }).eq("id", u.id);
    if (error) console.error("[client_updates] pin:", error.message);
    else await fetchUpdates();
  };

  const deleteUpdate = async (u: ClientUpdateRow) => {
    if (!adminNexaOtus) return;
    if (typeof window !== "undefined" && !window.confirm("Delete this update?")) return;
    const paths = (u.update_attachments ?? []).map((a) => storagePathFromAttachmentUrl(a.url)).filter((p): p is string => Boolean(p));
    if (paths.length) {
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove(paths);
      if (rmErr) console.error("[client_updates] storage remove:", rmErr.message);
    }
    const { error } = await supabase.from("client_updates").delete().eq("id", u.id);
    if (error) console.error("[client_updates] delete:", error.message);
    else {
      if (editingId === u.id) resetComposer();
      await fetchUpdates();
    }
  };

  const downloadAttachment = (att: UpdateAttachmentRow) => {
    const a = document.createElement("a");
    a.href = att.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = att.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const openPreview = (att: UpdateAttachmentRow) => {
    const k = attachmentPreviewKind(att);
    if (k === "pdf") setPreview({ name: att.name, url: att.url, kind: "pdf" });
    else if (k === "image") setPreview({ name: att.name, url: att.url, kind: "image" });
    else downloadAttachment(att);
  };

  const canEdit = (u: ClientUpdateRow) =>
    u.author_name.trim() === currentUser.name.trim() || adminNexaOtus;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0a0a0a] px-4 py-6 text-white lg:px-8">
      <PageHeader title="Updates" subtitle="Share updates, meeting notes and highlights with the team" />

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]">
        <div className="min-w-0">
          <div
            className="mb-6 rounded-[8px] border p-4"
            style={{ backgroundColor: "#161616", borderColor: "rgba(255,255,255,0.06)" }}
          >
            <textarea
              value={composerContent}
              onChange={(e) => setComposerContent(e.target.value)}
              placeholder="Share an update, meeting note, transcript or highlight..."
              disabled={posting}
              className="min-h-[120px] w-full resize-y rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-3 py-2.5 text-sm font-light text-white placeholder:text-[rgba(255,255,255,0.35)] focus:border-[rgba(255,69,0,0.45)] focus:outline-none disabled:opacity-60"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <select
                value={composerCategory}
                onChange={(e) => setComposerCategory(normalizeCategory(e.target.value))}
                className="rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#111] px-3 py-2 text-sm text-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => onPickFiles(e.target.files)}
              />
              {!editingId ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-ghost inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                >
                  <Paperclip className="h-4 w-4" strokeWidth={1.5} />
                  Attach file
                </button>
              ) : null}
            </div>
            {pendingFiles.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {pendingFiles.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.06)] px-2.5 py-1 text-xs text-white/90"
                  >
                    <span className="max-w-[200px] truncate">{p.file.name}</span>
                    <button
                      type="button"
                      onClick={() => removePending(p.id)}
                      className="rounded p-0.5 text-[rgba(255,255,255,0.5)] hover:bg-white/10 hover:text-white"
                      aria-label="Remove file"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              {editingId ? (
                <button type="button" onClick={() => resetComposer()} className="btn-ghost rounded-lg px-4 py-2 text-sm">
                  Cancel
                </button>
              ) : null}
              <button
                type="button"
                disabled={posting || !composerContent.trim()}
                onClick={() => void handlePost()}
                className="btn-primary rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-50"
              >
                {editingId ? "Save changes" : "Post Update"}
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-[rgba(255,255,255,0.45)]">Loading…</p>
          ) : updates.length === 0 ? (
            <p className="text-sm text-[rgba(255,255,255,0.45)]">No updates yet — be the first to share an update</p>
          ) : (
            <ul className="space-y-0">
              {updates.map((u) => (
                <UpdateCard
                  key={u.id}
                  update={u}
                  adminNexaOtus={adminNexaOtus}
                  canEdit={canEdit(u)}
                  onPin={() => void togglePin(u)}
                  onEdit={() => startEdit(u)}
                  onDelete={() => void deleteUpdate(u)}
                  onDownload={downloadAttachment}
                  onPreview={openPreview}
                />
              ))}
            </ul>
          )}
        </div>

        <aside className="min-w-0">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-white">Pinned</h2>
          <p className="mt-1 text-xs font-light text-[rgba(255,255,255,0.45)]">Important updates pinned by admins</p>
          <div className="mt-4 space-y-3">
            {pinnedList.length === 0 ? (
              <p className="text-xs text-[rgba(255,255,255,0.4)]">No pinned updates yet</p>
            ) : (
              pinnedList.map((u) => <PinnedCompactCard key={u.id} update={u} onPreview={openPreview} onDownload={downloadAttachment} />)
            )}
          </div>
        </aside>
      </div>

      {preview && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(0,0,0,0.9)] p-4"
              onClick={() => setPreview(null)}
            >
              <div
                className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[#111]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
                  <p className="min-w-0 flex-1 truncate text-sm font-light text-white">{preview.name}</p>
                  <button
                    type="button"
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = preview.url;
                      a.download = preview.name;
                      a.target = "_blank";
                      a.rel = "noopener noreferrer";
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                    }}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-[6px] border border-[var(--border)] px-3 py-1.5 text-xs font-light text-white hover:bg-[rgba(255,255,255,0.06)]"
                  >
                    <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Download
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    className="shrink-0 rounded-[6px] p-1.5 text-[rgba(255,255,255,0.55)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
                    aria-label="Close preview"
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
                <div className="flex min-h-[50vh] flex-1 items-center justify-center overflow-auto p-4">
                  {preview.kind === "pdf" ? (
                    <iframe
                      title={preview.name}
                      src={preview.url}
                      className="h-[min(78vh,800px)] w-full rounded-[6px] border border-[var(--border)] bg-[#1a1a1a]"
                    />
                  ) : (
                    <img src={preview.url} alt={preview.name} className="max-h-[78vh] max-w-full object-contain" />
                  )}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function UpdateCard({
  update,
  adminNexaOtus,
  canEdit,
  onPin,
  onEdit,
  onDelete,
  onDownload,
  onPreview,
}: {
  update: ClientUpdateRow;
  adminNexaOtus: boolean;
  canEdit: boolean;
  onPin: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDownload: (a: UpdateAttachmentRow) => void;
  onPreview: (a: UpdateAttachmentRow) => void;
}) {
  const cat = normalizeCategory(update.category);
  const st = CATEGORY_STYLES[cat];
  const atts = update.update_attachments ?? [];
  const ts = update.created_at ? new Date(update.created_at).toLocaleString() : "";

  return (
    <li
      className="group/card relative mb-3 rounded-[8px] border p-4 last:mb-0"
      style={{ backgroundColor: "#161616", borderColor: "rgba(255,255,255,0.06)" }}
    >
      {update.is_pinned ? (
        <Pin className="absolute right-3 top-3 h-3.5 w-3.5 shrink-0 fill-[#FF4500] text-[#FF4500]" strokeWidth={1.5} aria-hidden />
      ) : null}
      <div className="flex items-start gap-3 pr-6">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium text-white"
          style={{ backgroundColor: `hsla(${hueFromName(update.author_name)}, 42%, 36%, 1)` }}
        >
          {initials(update.author_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-white">{update.author_name}</span>
            <span className="shrink-0 text-[0.72rem] text-[rgba(255,255,255,0.4)]">{ts}</span>
          </div>
          <span
            className="mt-2 inline-block text-[0.7rem] font-medium"
            style={{
              padding: "2px 8px",
              borderRadius: "4px",
              color: st.fg,
              backgroundColor: st.bg,
              border: `1px solid ${st.border}`,
            }}
          >
            {st.label}
          </span>
          <p className="mt-3 whitespace-pre-wrap text-sm font-light leading-relaxed text-[rgba(255,255,255,0.92)]">
            {update.content}
          </p>
          {atts.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {atts.map((att) => {
                const Icon = attachmentIcon(att);
                const pk = attachmentPreviewKind(att);
                const canPreview = pk === "image" || pk === "pdf";
                return (
                  <li
                    key={att.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.25)] px-2 py-2"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-[rgba(255,255,255,0.5)]" strokeWidth={1.5} />
                    <span className="min-w-0 flex-1 truncate text-xs font-light text-white">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => onDownload(att)}
                      className="shrink-0 rounded-md border border-[rgba(255,255,255,0.1)] px-2 py-1 text-[0.65rem] text-white/80 hover:bg-white/5"
                    >
                      Download
                    </button>
                    {canPreview ? (
                      <button
                        type="button"
                        onClick={() => onPreview(att)}
                        className="shrink-0 rounded-md p-1.5 text-[rgba(255,255,255,0.45)] hover:bg-white/10 hover:text-white"
                        aria-label="Preview"
                      >
                        <Eye className="h-4 w-4" strokeWidth={1.5} />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex justify-end opacity-0 transition-opacity group-hover/card:opacity-100">
        <div className="flex items-center gap-1">
          {adminNexaOtus ? (
            <button
              type="button"
              onClick={onPin}
              className={cn(
                "rounded-md p-2 transition-colors",
                update.is_pinned ? "text-[#FF4500]" : "text-[rgba(255,255,255,0.35)] hover:text-white",
              )}
              title={update.is_pinned ? "Unpin" : "Pin"}
              aria-label={update.is_pinned ? "Unpin" : "Pin"}
            >
              <Pin
                className={cn("h-4 w-4", update.is_pinned ? "fill-[#FF4500] text-[#FF4500]" : "fill-none text-[rgba(255,255,255,0.35)]")}
                strokeWidth={1.5}
              />
            </button>
          ) : null}
          {canEdit ? (
            <button type="button" onClick={onEdit} className="rounded-md p-2 text-[rgba(255,255,255,0.35)] hover:text-white" aria-label="Edit">
              <Pencil className="h-4 w-4" strokeWidth={1.5} />
            </button>
          ) : null}
          {adminNexaOtus ? (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md p-2 text-[rgba(255,255,255,0.35)] hover:text-red-400"
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function PinnedCompactCard({
  update,
  onPreview,
  onDownload,
}: {
  update: ClientUpdateRow;
  onPreview: (a: UpdateAttachmentRow) => void;
  onDownload: (a: UpdateAttachmentRow) => void;
}) {
  const cat = normalizeCategory(update.category);
  const st = CATEGORY_STYLES[cat];
  const atts = update.update_attachments ?? [];
  return (
    <div className="rounded-[8px] border p-3" style={{ backgroundColor: "#161616", borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-medium text-white"
            style={{ backgroundColor: `hsla(${hueFromName(update.author_name)}, 42%, 36%, 1)` }}
          >
            {initials(update.author_name)}
          </div>
          <span className="truncate text-xs font-semibold text-white">{update.author_name}</span>
        </div>
        <Pin className="h-3 w-3 shrink-0 fill-[#FF4500] text-[#FF4500]" strokeWidth={1.5} aria-hidden />
      </div>
      <span
        className="mt-2 inline-block text-[0.65rem] font-medium"
        style={{
          padding: "2px 6px",
          borderRadius: "4px",
          color: st.fg,
          backgroundColor: st.bg,
          border: `1px solid ${st.border}`,
        }}
      >
        {st.label}
      </span>
      <p className="mt-2 text-[0.8125rem] font-light leading-relaxed text-[rgba(255,255,255,0.88)]">{update.content}</p>
      {atts.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {atts.map((att) => {
            const Icon = attachmentIcon(att);
            const pk = attachmentPreviewKind(att);
            return (
              <li key={att.id} className="flex items-center gap-1.5 text-[0.7rem] text-white/70">
                <Icon className="h-3 w-3 shrink-0" strokeWidth={1.5} />
                <span className="min-w-0 flex-1 truncate">{att.name}</span>
                <button type="button" className="shrink-0 underline" onClick={() => onDownload(att)}>
                  Download
                </button>
                {pk === "image" || pk === "pdf" ? (
                  <button type="button" className="shrink-0 p-0.5" onClick={() => onPreview(att)} aria-label="Preview">
                    <Eye className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
