"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  FileArchive,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Star,
  Target,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import type { Project, ProjectStatus, ProjectTaskRow, TaskRowStatus } from "../data";
import {
  COLUMN_TO_STATUS,
  formatDisplayDate,
  KANBAN_COLUMNS,
  OWNER_OPTIONS,
  PROJECT_TEAM_MEMBERS,
  TASK_STATUS_OPTIONS,
} from "../data";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { Card } from "@/components/ui/card";
import { PublishedToModal } from "@/components/ui/published-to-modal";
import { supabase } from "@/lib/supabase";
import { getTaskHighlightCoverUrl } from "@/lib/task-highlight-cover";
import { OwnerAvatars } from "./owner-avatars";
import { ProgressInline } from "./progress-inline";
import { ProjectStatusBadge } from "./project-status-badge";
import { ProjectTypeBadge } from "./project-type-badge";
import { TaskRowStatusBadge } from "./task-row-status-badge";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,140px)_1fr] items-start gap-x-6 gap-y-1 border-b border-[var(--border)] py-3 last:border-b-0">
      <span className="text-xs font-light text-[rgba(255,255,255,0.4)]">{label}</span>
      <div className="min-w-0 text-sm font-light text-white">{children}</div>
    </div>
  );
}

type Priority = "Low" | "Medium" | "High" | "Urgent";

interface TaskAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  storagePath: string;
}

interface LocalTask extends ProjectTaskRow {
  description: string;
  priority: Priority;
  attachments: TaskAttachment[];
}

type DbProjectTaskRow = {
  id: string;
  title: string;
  due_date: string | null;
  assigned_to: string | null;
  status: string | null;
  is_featured: boolean | null;
  cover_image: string | null;
  short_description: string | null;
  description: string | null;
  priority: string | null;
  review_status: string | null;
  published_to: string[] | null;
};

type ClientReviewDecision = "Approved" | "Needs Changes" | "Rejected";

type TaskReviewAttachmentRow = {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
};

type TaskReviewRow = {
  id: string;
  task_id: string;
  reviewer_name: string;
  status: string;
  comment: string | null;
  created_at: string;
  task_review_attachments?: TaskReviewAttachmentRow[] | null;
};

function normalizeClientReviewDecision(value: string | null | undefined): ClientReviewDecision | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (s === "Approved") return "Approved";
  if (s === "Needs Changes") return "Needs Changes";
  if (s === "Rejected") return "Rejected";
  const lower = s.toLowerCase();
  if (lower === "approved") return "Approved";
  if (lower === "needs changes" || lower === "needs_changes") return "Needs Changes";
  if (lower === "rejected") return "Rejected";
  return null;
}

function reviewAttachmentRowToTaskAttachment(row: TaskReviewAttachmentRow): TaskAttachment {
  const url = row.url;
  return {
    id: row.id,
    name: row.name,
    size: Number(row.size) || 0,
    type: row.type ?? "",
    url,
    storagePath: getTaskReviewAttachmentStoragePathFromUrl(url),
  };
}

function TaskReviewColumnBadge({ status, lt }: { status: string | null | undefined; lt: (k: string) => string }) {
  const d = normalizeClientReviewDecision(status);
  if (!d) return null;
  const cfg =
    d === "Approved"
      ? { dot: "bg-emerald-400", label: lt("Approved"), cls: "text-emerald-200/95" }
      : d === "Needs Changes"
        ? { dot: "bg-amber-400", label: lt("Needs Changes"), cls: "text-amber-200/95" }
        : { dot: "bg-red-400", label: lt("Rejected"), cls: "text-red-200/95" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-light", cfg.cls)}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", cfg.dot)} aria-hidden />
      {cfg.label}
    </span>
  );
}

function reviewHistoryStatusBadge(status: string, lt: (k: string) => string) {
  const d = normalizeClientReviewDecision(status);
  const label = d === "Approved" ? lt("Approved") : d === "Needs Changes" ? lt("Needs Changes") : lt("Rejected");
  const cls =
    d === "Approved"
      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
      : d === "Needs Changes"
        ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
        : "border-red-500/40 bg-red-500/15 text-red-200";
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide", cls)}>
      {label}
    </span>
  );
}

const PRIORITY_OPTIONS: Array<{ value: Priority; textClass: string; dotClass: string }> = [
  { value: "Low", textClass: "text-[#9ca3af]", dotClass: "bg-[#9ca3af]" },
  { value: "Medium", textClass: "text-[#60a5fa]", dotClass: "bg-[#3b82f6]" },
  { value: "High", textClass: "text-[#fb923c]", dotClass: "bg-[#f97316]" },
  { value: "Urgent", textClass: "text-[#f87171]", dotClass: "bg-[#ef4444]" },
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function commentAuthorHue(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h + name.charCodeAt(i) * 17) % 360;
  return h;
}

function commentAuthorInitials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatCommentTimestamp(iso: string) {
  const d = new Date(iso);
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate();
  const year = d.getFullYear();
  const hour = d.getHours();
  const minute = d.getMinutes().toString().padStart(2, "0");
  return `${month} ${day}, ${year} at ${hour}:${minute}`;
}

type ProjectComment = {
  id: string;
  project_id: string;
  user_name: string;
  content: string;
  created_at: string;
};

function attachmentKind(type: string, name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (type.includes("pdf") || ext === "pdf") return FileText;
  if (type.startsWith("image/")) return FileImage;
  if (type.startsWith("video/")) return FileVideo;
  if (type.includes("zip") || type.includes("compressed") || ext === "zip" || ext === "rar") return FileArchive;
  if (["ts", "tsx", "js", "jsx", "json", "css", "html", "md"].includes(ext)) return FileCode;
  return FileText;
}

function getTaskAttachmentStoragePathFromUrl(url: string): string {
  const marker = "/storage/v1/object/public/task-attachments/";
  const idx = url.indexOf(marker);
  if (idx === -1) return "";
  return decodeURIComponent(url.slice(idx + marker.length));
}

function getTaskReviewAttachmentStoragePathFromUrl(url: string): string {
  const marker = "/storage/v1/object/public/task-reviews/";
  const idx = url.indexOf(marker);
  if (idx === -1) return "";
  return decodeURIComponent(url.slice(idx + marker.length));
}

function clientReviewAuthorMatches(reviewerName: string, currentUserName: string): boolean {
  return reviewerName.trim().toLowerCase() === currentUserName.trim().toLowerCase();
}

function taskAttachmentFromRow(row: Record<string, unknown>): TaskAttachment {
  const url = String(row.url ?? "");
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    size: Number(row.size ?? 0) || 0,
    type: String(row.type ?? ""),
    url,
    storagePath: getTaskAttachmentStoragePathFromUrl(url),
  };
}

function attachmentPreviewKind(attachment: TaskAttachment): "pdf" | "image" | "video" | "other" {
  const type = attachment.type.toLowerCase();
  const ext = attachment.name.split(".").pop()?.toLowerCase() ?? "";
  if (type.includes("pdf") || ext === "pdf") return "pdf";
  if (type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "image";
  if (type.startsWith("video/") || ["mp4", "mov", "webm"].includes(ext)) return "video";
  return "other";
}

function TaskAttachmentImageStrip({
  attachment,
  onExpand,
  expandHint,
}: {
  attachment: TaskAttachment;
  onExpand: () => void;
  expandHint: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <button
      type="button"
      onClick={onExpand}
      className="relative block w-full border-b border-[var(--border)] bg-[#0a0a0a] text-left outline-none ring-inset focus-visible:ring-2 focus-visible:ring-[rgba(255,69,0,0.45)]"
    >
      <img
        src={attachment.url}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="mx-auto max-h-[min(280px,42vh)] w-full object-contain"
      />
      <span className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-black/75 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white/90">
        {expandHint}
      </span>
    </button>
  );
}

function TaskAttachmentInlineVisual({
  attachment,
  onExpand,
  expandHint,
}: {
  attachment: TaskAttachment;
  onExpand: () => void;
  expandHint: string;
}) {
  const pk = attachmentPreviewKind(attachment);
  if (pk === "image") {
    return <TaskAttachmentImageStrip attachment={attachment} onExpand={onExpand} expandHint={expandHint} />;
  }
  if (pk === "video") {
    return (
      <div className="border-b border-[var(--border)] bg-[#0a0a0a]">
        <video
          src={attachment.url}
          controls
          playsInline
          preload="metadata"
          className="max-h-[min(280px,42vh)] w-full object-contain"
        />
        <div className="flex justify-end border-t border-[var(--border)] bg-[#141414] px-2 py-1.5">
          <button
            type="button"
            onClick={onExpand}
            className="rounded-[6px] px-2 py-1 text-[11px] font-light text-[rgba(255,255,255,0.65)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
          >
            {expandHint}
          </button>
        </div>
      </div>
    );
  }
  if (pk === "pdf") {
    return (
      <div className="border-b border-[var(--border)] bg-[#0a0a0a]">
        <iframe
          title={attachment.name}
          src={attachment.url}
          className="h-[min(240px,38vh)] w-full border-0 bg-[#1a1a1a]"
        />
        <div className="flex justify-end border-t border-[var(--border)] bg-[#141414] px-2 py-1.5">
          <button
            type="button"
            onClick={onExpand}
            className="rounded-[6px] px-2 py-1 text-[11px] font-light text-[rgba(255,255,255,0.65)] transition-colors hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
          >
            {expandHint}
          </button>
        </div>
      </div>
    );
  }
  return null;
}

/** Fixed estimate for row status portal menu height (see viewport flip logic). */
const STATUS_DROPDOWN_EST_HEIGHT_PX = 220;

function getRowStatusDropdownPosition(triggerRect: DOMRect) {
  const gap = 6;
  let top = triggerRect.bottom + gap;
  if (top + STATUS_DROPDOWN_EST_HEIGHT_PX > window.innerHeight) {
    top = triggerRect.top - STATUS_DROPDOWN_EST_HEIGHT_PX - gap;
  }
  const minTop = gap;
  const maxTop = window.innerHeight - STATUS_DROPDOWN_EST_HEIGHT_PX - gap;
  const upper = Math.max(minTop, maxTop);
  top = Math.min(Math.max(top, minTop), upper);
  return { top, left: triggerRect.left };
}

const BOARD_TASK_KEYS = new Set<keyof ProjectTaskRow>([
  "name",
  "dueDate",
  "owner",
  "status",
  "isFeatured",
  "coverImage",
  "shortDescription",
  "reviewStatus",
  "publishedTo",
]);

export function ProjectDetailView({ project }: { project: Project }) {
  const searchParams = useSearchParams();
  const {
    updateBoardProjectTask,
    addBoardProjectTask,
    deleteBoardProjectTask,
    updateBoardProject,
    currentUser,
    notifyProjectComment,
    logTaskReviewActivity,
    logTaskPublishedToActivity,
  } = useAppContext();
  const { t: lt } = useLanguage();
  const isRocketRideClient = currentUser.company === "rocketride";
  const [description, setDescription] = useState(project.description);
  const [savedDescription, setSavedDescription] = useState(project.description);
  const [projectDescriptionSavedHint, setProjectDescriptionSavedHint] = useState(false);
  const [projectDescriptionError, setProjectDescriptionError] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false); // modal menu
  const [rowStatusMenu, setRowStatusMenu] = useState<{ taskId: string; top: number; left: number } | null>(null);
  const [taskName, setTaskName] = useState("");
  const [owner, setOwner] = useState((project.owners[0] || OWNER_OPTIONS[0]) as string);
  const [dueDate, setDueDate] = useState("");
  const [taskStatus, setTaskStatus] = useState<TaskRowStatus>("Not Started");
  const [taskNameError, setTaskNameError] = useState("");
  const [taskSubmitError, setTaskSubmitError] = useState("");
  const [editingCell, setEditingCell] = useState<{ taskId: string; field: "name" | "owner" | "dueDate" } | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [panelStatusOpen, setPanelStatusOpen] = useState(false);
  const [panelEditingName, setPanelEditingName] = useState(false);
  const [panelOwnerEditing, setPanelOwnerEditing] = useState(false);
  const [panelDueDateEditing, setPanelDueDateEditing] = useState(false);
  const [panelDescription, setPanelDescription] = useState("");
  const [panelSavedDescription, setPanelSavedDescription] = useState("");
  const [taskDescriptionSavedHint, setTaskDescriptionSavedHint] = useState(false);
  const [taskDescriptionError, setTaskDescriptionError] = useState("");
  const [panelPriority, setPanelPriority] = useState<Priority>("Medium");
  const [taskDeleteDialog, setTaskDeleteDialog] = useState<{ id: string; name: string } | null>(null);
  const [coverUploadLoading, setCoverUploadLoading] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState("");
  const [taskAttachmentUploading, setTaskAttachmentUploading] = useState(false);
  const [taskAttachmentError, setTaskAttachmentError] = useState("");
  const [previewAttachment, setPreviewAttachment] = useState<TaskAttachment | null>(null);
  const [taskReviews, setTaskReviews] = useState<TaskReviewRow[]>([]);
  const [taskReviewsLoading, setTaskReviewsLoading] = useState(false);
  const [reviewPendingStatus, setReviewPendingStatus] = useState<ClientReviewDecision | null>(null);
  const [reviewCommentDraft, setReviewCommentDraft] = useState("");
  const [reviewDraftFiles, setReviewDraftFiles] = useState<File[]>([]);
  const [reviewSubmitError, setReviewSubmitError] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editReviewStatus, setEditReviewStatus] = useState<ClientReviewDecision | null>(null);
  const [editReviewComment, setEditReviewComment] = useState("");
  const [editReviewNewFiles, setEditReviewNewFiles] = useState<File[]>([]);
  const [editReviewRemovedAttachmentIds, setEditReviewRemovedAttachmentIds] = useState<string[]>([]);
  const [editReviewError, setEditReviewError] = useState("");
  const [editReviewSubmitting, setEditReviewSubmitting] = useState(false);
  const [reviewDeleteDialog, setReviewDeleteDialog] = useState<{ id: string } | null>(null);
  const reviewComposerFileRef = useRef<HTMLInputElement>(null);
  const editReviewFileRef = useRef<HTMLInputElement>(null);
  const [publishedToModal, setPublishedToModal] = useState<{ taskId: string; taskName: string } | null>(null);
  const [projectStatusDropdownOpen, setProjectStatusDropdownOpen] = useState(false);
  const [projectOwnersDropdownOpen, setProjectOwnersDropdownOpen] = useState(false);
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const projectPropsStatusRef = useRef<HTMLDivElement>(null);
  const projectPropsOwnersRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const coverImageInputRef = useRef<HTMLInputElement | null>(null);
  const panelDescriptionRef = useRef<HTMLTextAreaElement | null>(null);

  const groupedStatuses = [
    { group: "To-do", options: TASK_STATUS_OPTIONS.filter((option) => option.group === "To-do") },
    { group: "In Progress", options: TASK_STATUS_OPTIONS.filter((option) => option.group === "In Progress") },
    { group: "Complete", options: TASK_STATUS_OPTIONS.filter((option) => option.group === "Complete") },
  ] as const;
  const completedStatuses = new Set<TaskRowStatus>(["Done", "Published"]);
  const progressPercentage = useMemo(() => {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter((task) => completedStatuses.has(task.status)).length;
    return Math.round((completed / tasks.length) * 100);
  }, [tasks]);

  const selectedStatusOption = TASK_STATUS_OPTIONS.find((option) => option.value === taskStatus) || TASK_STATUS_OPTIONS[0];

  const resetTaskForm = () => {
    setTaskName("");
    setOwner((project.owners[0] || OWNER_OPTIONS[0]) as string);
    setDueDate("");
    setTaskStatus("Not Started");
    setTaskNameError("");
    setTaskSubmitError("");
    setStatusMenuOpen(false);
  };

  const openTaskModal = () => {
    resetTaskForm();
    setModalOpen(true);
  };

  const closeTaskModal = () => {
    setModalOpen(false);
    setStatusMenuOpen(false);
    setTaskNameError("");
    setTaskSubmitError("");
  };

  useEffect(() => {
    setDescription(project.description);
    setSavedDescription(project.description);
    setProjectDescriptionSavedHint(false);
    setProjectDescriptionError("");
  }, [project.id, project.description]);

  useEffect(() => {
    let mounted = true;
    void supabase
      .from("tasks")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error("[supabase] project tasks fetch failed:", error.message);
          setTasks([]);
          return;
        }
        const mapped = ((data as DbProjectTaskRow[] | null) ?? []).map((row) => {
          const status: TaskRowStatus =
            row.status === "In Progress" ||
            row.status === "Waiting for Approval" ||
            row.status === "Done" ||
            row.status === "Scheduled" ||
            row.status === "Published"
              ? row.status
              : "Not Started";
          const priority: Priority =
            row.priority === "Low" || row.priority === "Medium" || row.priority === "High" || row.priority === "Urgent"
              ? row.priority
              : "Medium";
          return {
            id: row.id,
            name: row.title ?? "",
            dueDate: row.due_date,
            owner: row.assigned_to ?? "",
            status,
            isFeatured: Boolean(row.is_featured),
            coverImage: row.cover_image,
            shortDescription: row.short_description ?? "",
            description: row.description ?? "",
            priority,
            reviewStatus: row.review_status?.trim() ? String(row.review_status) : null,
            publishedTo: Array.isArray(row.published_to) ? row.published_to.map(String) : [],
            attachments: [],
          } satisfies LocalTask;
        });
        setTasks(mapped);
      });
    return () => {
      mounted = false;
    };
  }, [project.id]);

  useEffect(() => {
    const tid = searchParams.get("taskId");
    if (!tid) return;
    if (tasks.some((t) => t.id === tid)) {
      setActiveTaskId(tid);
    }
  }, [searchParams, tasks]);

  useEffect(() => {
    if (!activeTaskId) {
      setPreviewAttachment(null);
      setTaskAttachmentError("");
      return;
    }
    setPreviewAttachment(null);
    setTaskAttachmentError("");
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("task_attachments")
        .select("*")
        .eq("task_id", activeTaskId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error("[supabase] task_attachments fetch failed:", error.message);
        setTaskAttachmentError(error.message || "Failed to load attachments.");
        return;
      }
      const list = ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => taskAttachmentFromRow(row));
      setTasks((prev) => {
        if (!prev.some((t) => t.id === activeTaskId)) return prev;
        return prev.map((t) => (t.id === activeTaskId ? { ...t, attachments: list } : t));
      });
      if (!isRocketRideClient) {
        updateBoardProjectTask(project.id, activeTaskId, {
          attachments: list.map((a) => ({ type: a.type, name: a.name, url: a.url })),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTaskId, isRocketRideClient, project.id, updateBoardProjectTask]);

  useEffect(() => {
    if (!activeTaskId || !isRocketRideClient) {
      setTaskReviews([]);
      setTaskReviewsLoading(false);
      setReviewPendingStatus(null);
      setReviewCommentDraft("");
      setReviewDraftFiles([]);
      setReviewSubmitError("");
      setEditingReviewId(null);
      setEditReviewStatus(null);
      setEditReviewComment("");
      setEditReviewNewFiles([]);
      setEditReviewRemovedAttachmentIds([]);
      setEditReviewError("");
      setReviewDeleteDialog(null);
      return;
    }
    setReviewPendingStatus(null);
    setReviewCommentDraft("");
    setReviewDraftFiles([]);
    setReviewSubmitError("");
    setEditingReviewId(null);
    setEditReviewStatus(null);
    setEditReviewComment("");
    setEditReviewNewFiles([]);
    setEditReviewRemovedAttachmentIds([]);
    setEditReviewError("");
    setReviewDeleteDialog(null);
    let cancelled = false;
    setTaskReviewsLoading(true);
    void supabase
      .from("task_reviews")
      .select("*, task_review_attachments(*)")
      .eq("task_id", activeTaskId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        setTaskReviewsLoading(false);
        if (error) {
          console.error("[supabase] task_reviews fetch failed:", error.message);
          setTaskReviews([]);
          return;
        }
        const rows = (data as TaskReviewRow[] | null) ?? [];
        setTaskReviews(rows);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTaskId, isRocketRideClient]);

  useEffect(() => {
    if (!previewAttachment) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewAttachment(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewAttachment]);

  useEffect(() => {
    if (!rowStatusMenu) return;
    const closeMenu = () => setRowStatusMenu(null);
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", onEsc);
    };
  }, [rowStatusMenu]);

  useEffect(() => {
    if (!projectStatusDropdownOpen && !projectOwnersDropdownOpen) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        projectStatusDropdownOpen &&
        projectPropsStatusRef.current &&
        !projectPropsStatusRef.current.contains(target)
      ) {
        setProjectStatusDropdownOpen(false);
      }
      if (
        projectOwnersDropdownOpen &&
        projectPropsOwnersRef.current &&
        !projectPropsOwnersRef.current.contains(target)
      ) {
        setProjectOwnersDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [projectStatusDropdownOpen, projectOwnersDropdownOpen]);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("project_comments")
      .select("*")
      .eq("project_id", project.id)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[supabase] project comments fetch failed:", error.message);
          return;
        }
        setComments((data as ProjectComment[] | null) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`project_comments:${project.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "project_comments",
          filter: `project_id=eq.${project.id}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const comment: ProjectComment = {
            id: String(row.id ?? ""),
            project_id: String(row.project_id ?? ""),
            user_name: String(row.user_name ?? ""),
            content: String(row.content ?? ""),
            created_at: String(row.created_at ?? ""),
          };
          if (!comment.id) return;
          setComments((prev) => {
            if (prev.some((c) => c.id === comment.id)) return prev;
            return [comment, ...prev];
          });
          notifyProjectComment({
            commentId: comment.id,
            authorName: comment.user_name,
            projectName: project.name,
            ownerNames: project.owners,
          });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [project.id, project.name, project.owners.join("|"), notifyProjectComment]);

  const updateTask = async (taskId: string, updates: Partial<LocalTask>) => {
    if (isRocketRideClient) return false;
    const dbPatch: Record<string, unknown> = {};
    if (updates.name !== undefined) dbPatch.title = updates.name;
    if (updates.dueDate !== undefined) dbPatch.due_date = updates.dueDate;
    if (updates.owner !== undefined) dbPatch.assigned_to = updates.owner;
    if (updates.status !== undefined) dbPatch.status = updates.status;
    if (updates.isFeatured !== undefined) dbPatch.is_featured = updates.isFeatured;
    if (updates.coverImage !== undefined) dbPatch.cover_image = updates.coverImage;
    if (updates.shortDescription !== undefined) dbPatch.short_description = updates.shortDescription;
    if (updates.description !== undefined) dbPatch.description = updates.description;
    if (updates.priority !== undefined) dbPatch.priority = updates.priority;
    if (updates.reviewStatus !== undefined) dbPatch.review_status = updates.reviewStatus;
    if (updates.publishedTo !== undefined) dbPatch.published_to = updates.publishedTo;

    if (Object.keys(dbPatch).length === 0) {
      setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task)));
      return true;
    }

    const { error } = await supabase.from("tasks").update(dbPatch).eq("id", taskId).eq("project_id", project.id);
    if (error) {
      console.error("[supabase] board task update failed:", error.message);
      return false;
    }

    const nextTasks = tasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task));
    setTasks(nextTasks);
    const rowPatch: Partial<ProjectTaskRow> = {};
    (Object.keys(updates) as (keyof LocalTask)[]).forEach((key) => {
      if (BOARD_TASK_KEYS.has(key as keyof ProjectTaskRow)) {
        const k = key as keyof ProjectTaskRow;
        const v = updates[k as keyof Partial<LocalTask>] as ProjectTaskRow[typeof k] | undefined;
        if (v !== undefined) {
          (rowPatch as Record<string, unknown>)[k] = v;
        }
      }
    });
    if (Object.keys(rowPatch).length > 0) {
      updateBoardProjectTask(project.id, taskId, rowPatch);
    }
    if (updates.status !== undefined) {
      void syncProjectProgressFromLocalTasks(nextTasks);
    }
    return true;
  };

  const activeTask = useMemo(() => tasks.find((task) => task.id === activeTaskId) || null, [tasks, activeTaskId]);

  useEffect(() => {
    if (!activeTask) {
      setCoverUploadLoading(false);
      setCoverUploadError("");
      return;
    }
    setPanelDescription(activeTask.description);
    setPanelSavedDescription(activeTask.description);
    setTaskDescriptionSavedHint(false);
    setTaskDescriptionError("");
    setPanelPriority(activeTask.priority);
    setPanelStatusOpen(false);
    setPanelEditingName(false);
    setPanelOwnerEditing(false);
    setPanelDueDateEditing(false);
    setCoverUploadError("");
    setCoverUploadLoading(false);
  }, [activeTask]);

  useEffect(() => {
    if (!panelDescriptionRef.current) return;
    panelDescriptionRef.current.style.height = "auto";
    panelDescriptionRef.current.style.height = `${panelDescriptionRef.current.scrollHeight}px`;
  }, [panelDescription, activeTaskId]);

  const closeTaskPanel = () => {
    setActiveTaskId(null);
    setPanelStatusOpen(false);
    setPanelEditingName(false);
    setPanelOwnerEditing(false);
    setPanelDueDateEditing(false);
  };

  const openTaskPanel = (taskId: string) => {
    setActiveTaskId(taskId);
  };

  const confirmDeleteTask = async () => {
    if (isRocketRideClient) return;
    if (!taskDeleteDialog) return;
    const targetTaskId = taskDeleteDialog.id;
    const { error } = await supabase.from("tasks").delete().eq("id", targetTaskId);
    if (error) {
      console.error("[supabase] board task delete failed:", error.message);
      return;
    }
    const nextTasks = tasks.filter((task) => task.id !== targetTaskId);
    setTasks(nextTasks);
    deleteBoardProjectTask(project.id, taskDeleteDialog.id);
    void syncProjectProgressFromLocalTasks(nextTasks);
    if (activeTaskId === targetTaskId) closeTaskPanel();
    setTaskDeleteDialog(null);
  };

  const syncProjectProgressFromLocalTasks = async (nextTasks: LocalTask[]) => {
    const nextProgress = Math.round(
      nextTasks.length === 0
        ? 0
        : (nextTasks.filter((task) => task.status === "Done" || task.status === "Published").length / nextTasks.length) *
            100,
    );
    const { error } = await supabase.from("projects").update({ progress: nextProgress }).eq("id", project.id);
    if (error) {
      console.error("[supabase] project progress update failed:", error.message);
    }
  };

  const handleTaskStatusSelect = async (taskId: string, status: TaskRowStatus) => {
    if (status === "Published") {
      const name = tasks.find((t) => t.id === taskId)?.name ?? "";
      const ok = await updateTask(taskId, { status: "Published" });
      if (!ok) return;
      setPublishedToModal({ taskId, taskName: name });
      setRowStatusMenu(null);
      setPanelStatusOpen(false);
      return;
    }
    void updateTask(taskId, { status });
    setRowStatusMenu(null);
    setPanelStatusOpen(false);
  };

  const handlePublishedToConfirm = async ({ platforms, publishedAt }: { platforms: string[]; publishedAt: string }) => {
    if (!publishedToModal) return;
    const ok = await updateTask(publishedToModal.taskId, { publishedTo: platforms });
    if (!ok) return;
    if (platforms.length > 0) {
      logTaskPublishedToActivity({
        userName: currentUser.name.trim() || "User",
        taskName: publishedToModal.taskName,
        platforms,
      });
    }
    const task = tasks.find((t) => t.id === publishedToModal.taskId);
    if (task) {
      const content = task.name + (task.shortDescription?.trim() ? ` — ${task.shortDescription}` : "");
      const { error: postErr } = await supabase.from("scheduled_posts").insert([
        {
          content,
          platforms,
          media_urls: [] as string[],
          scheduled_at: publishedAt,
          published_at: publishedAt,
          status: "published",
          created_by: currentUser.name ?? null,
          linked_task_id: task.id,
          media_description: task.description ?? "",
        },
      ]);
      if (postErr) {
        console.error("[supabase] scheduled_posts insert from Published task:", postErr.message);
      }
    }
    setPublishedToModal(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("rr:dashboard-posts-published-refresh"));
    }
  };

  const handlePublishedToSkip = () => {
    setPublishedToModal(null);
  };

  const downloadTaskAttachment = (attachment: TaskAttachment) => {
    const a = document.createElement("a");
    a.href = attachment.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = attachment.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const openTaskAttachmentPreview = (attachment: TaskAttachment) => {
    if (attachmentPreviewKind(attachment) === "other") {
      downloadTaskAttachment(attachment);
      return;
    }
    setPreviewAttachment(attachment);
  };

  const deleteTaskAttachment = async (taskId: string, attachment: TaskAttachment) => {
    if (isRocketRideClient) return;
    setTaskAttachmentError("");
    const storagePath = attachment.storagePath || getTaskAttachmentStoragePathFromUrl(attachment.url);
    if (storagePath) {
      const { error: storageError } = await supabase.storage.from("task-attachments").remove([storagePath]);
      if (storageError) {
        console.error("[supabase] task attachment storage delete failed:", storageError.message);
        setTaskAttachmentError(storageError.message || "Failed to delete file from storage.");
        return;
      }
    }
    const { error } = await supabase.from("task_attachments").delete().eq("id", attachment.id);
    if (error) {
      console.error("[supabase] task_attachments delete failed:", error.message);
      setTaskAttachmentError(error.message || "Failed to delete attachment.");
      return;
    }
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const nextAtts = t.attachments.filter((item) => item.id !== attachment.id);
        updateBoardProjectTask(project.id, taskId, {
          attachments: nextAtts.map((a) => ({ type: a.type, name: a.name, url: a.url })),
        });
        return { ...t, attachments: nextAtts };
      }),
    );
    setPreviewAttachment((prev) => (prev?.id === attachment.id ? null : prev));
  };

  const onPanelFileUpload = async (files: FileList | null) => {
    if (isRocketRideClient) return;
    if (!files?.length || !activeTask) return;
    const taskId = activeTask.id;
    setTaskAttachmentUploading(true);
    setTaskAttachmentError("");
    try {
      for (const file of Array.from(files)) {
        const fileName = `${taskId}/${Date.now()}-${file.name}`;
        const { data, error } = await supabase.storage
          .from("task-attachments")
          .upload(fileName, file, { cacheControl: "3600", upsert: false });
        if (error || !data?.path) {
          console.error("[supabase] task attachment upload failed:", error?.message ?? "No path");
          setTaskAttachmentError(error?.message || "Upload failed.");
          continue;
        }
        const { data: urlData } = supabase.storage.from("task-attachments").getPublicUrl(data.path);
        const { data: row, error: insertError } = await supabase
          .from("task_attachments")
          .insert([
            {
              task_id: taskId,
              name: file.name,
              url: urlData.publicUrl,
              type: file.type,
              size: file.size,
            },
          ])
          .select("*")
          .single();
        if (insertError || !row) {
          console.error("[supabase] task_attachments insert failed:", insertError?.message);
          setTaskAttachmentError(insertError?.message || "Failed to save attachment.");
          await supabase.storage.from("task-attachments").remove([data.path]);
          continue;
        }
        const att = taskAttachmentFromRow(row as Record<string, unknown>);
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id !== taskId) return t;
            const merged = [...t.attachments, att];
            updateBoardProjectTask(project.id, taskId, {
              attachments: merged.map((a) => ({ type: a.type, name: a.name, url: a.url })),
            });
            return { ...t, attachments: merged };
          }),
        );
      }
    } finally {
      setTaskAttachmentUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // -- Run in Supabase Dashboard > Storage: create a public bucket called 'task-covers'
  const onCoverImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isRocketRideClient) return;
    const inputEl = event.target;
    const file = inputEl.files?.[0];
    const resetInput = () => {
      inputEl.value = "";
    };

    if (!file || !activeTaskId) {
      resetInput();
      return;
    }

    const looksLikeImage =
      (Boolean(file.type) && file.type.startsWith("image/")) ||
      /\.(jpe?g|png|gif|webp|bmp|svg|heic|heif|avif)$/i.test(file.name);
    if (!looksLikeImage) {
      setCoverUploadError(lt("Upload failed. Try again."));
      resetInput();
      return;
    }

    const taskId = activeTaskId;
    setCoverUploadLoading(true);
    setCoverUploadError("");

    const fileExt = file.name.split(".").pop() || "jpg";
    const fileName = `${taskId}-${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage.from("task-covers").upload(fileName, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (error || !data?.path) {
      console.error("[supabase] task cover upload failed:", error?.message ?? "No upload path");
      setCoverUploadLoading(false);
      setCoverUploadError(lt("Upload failed. Try again."));
      resetInput();
      return;
    }

    const { data: urlData } = supabase.storage.from("task-covers").getPublicUrl(data.path);
    const publicUrl = urlData.publicUrl;

    const { error: dbError } = await supabase
      .from("tasks")
      .update({ cover_image: publicUrl })
      .eq("id", taskId)
      .eq("project_id", project.id);

    if (dbError) {
      console.error("[supabase] task cover_image update failed:", dbError.message);
      setCoverUploadLoading(false);
      setCoverUploadError(lt("Upload failed. Try again."));
      resetInput();
      return;
    }

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, coverImage: publicUrl } : t)));
    updateBoardProjectTask(project.id, taskId, { coverImage: publicUrl });
    setCoverUploadLoading(false);
    resetInput();
  };

  const triggerCoverImageFilePicker = () => {
    if (coverUploadLoading) return;
    coverImageInputRef.current?.click();
  };

  const removeCoverImage = () => {
    if (isRocketRideClient) return;
    if (!activeTaskId) return;
    const task = tasks.find((t) => t.id === activeTaskId);
    if (!task?.coverImage) return;
    setCoverUploadError("");
    void updateTask(activeTaskId, { coverImage: null });
  };

  const onPanelDescriptionChange = (value: string) => {
    setPanelDescription(value);
  };

  const saveProjectDescription = async () => {
    setProjectDescriptionError("");
    const { error } = await supabase
      .from("projects")
      .update({ description })
      .eq("id", project.id);
    if (error) {
      console.error("[supabase] project description update failed:", error.message);
      setProjectDescriptionError("Failed to save. Try again.");
      return;
    }
    setSavedDescription(description);
    setProjectDescriptionSavedHint(true);
    window.setTimeout(() => setProjectDescriptionSavedHint(false), 2000);
  };

  const saveTaskDescription = async () => {
    if (!activeTask) return;
    setTaskDescriptionError("");
    const ok = await updateTask(activeTask.id, { description: panelDescription });
    if (!ok) {
      setTaskDescriptionError("Failed to save. Try again.");
      return;
    }
    setPanelSavedDescription(panelDescription);
    setTaskDescriptionSavedHint(true);
    window.setTimeout(() => setTaskDescriptionSavedHint(false), 2000);
  };

  const handleCreateTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isRocketRideClient) return;
    const trimmedName = taskName.trim();
    if (!trimmedName) {
      setTaskNameError("Task name is required.");
      return;
    }
    setTaskSubmitError("");
    const { data, error } = await supabase
      .from("tasks")
      .insert([
        {
          project_id: project.id,
          title: trimmedName,
          status: taskStatus,
          assigned_to: owner,
          due_date: dueDate || null,
          priority: "Medium",
          description: "",
        },
      ])
      .select()
      .single();
    if (error || !data) {
      console.error("[supabase] board task insert failed:", error?.message ?? "Unknown error");
      setTaskSubmitError("Failed to create task. Please try again.");
      return;
    }
    const row = data as DbProjectTaskRow;
    const createdStatus: TaskRowStatus =
      row.status === "In Progress" ||
      row.status === "Waiting for Approval" ||
      row.status === "Done" ||
      row.status === "Scheduled" ||
      row.status === "Published"
        ? row.status
        : "Not Started";
    const createdTask: LocalTask = {
      id: row.id,
      name: row.title ?? trimmedName,
      owner: row.assigned_to ?? owner,
      dueDate: row.due_date,
      status: createdStatus,
      isFeatured: Boolean(row.is_featured),
      coverImage: row.cover_image,
      shortDescription: row.short_description ?? "",
      description: row.description ?? "",
      priority: row.priority === "Low" || row.priority === "Medium" || row.priority === "High" || row.priority === "Urgent" ? row.priority : "Medium",
      reviewStatus: row.review_status?.trim() ? String(row.review_status) : null,
      publishedTo: Array.isArray(row.published_to) ? row.published_to.map(String) : [],
      attachments: [],
    };
    const nextTasks = [...tasks, createdTask];
    setTasks(nextTasks);
    const boardRow: ProjectTaskRow = {
      id: createdTask.id,
      name: createdTask.name,
      owner: createdTask.owner,
      dueDate: createdTask.dueDate,
      status: createdTask.status,
      isFeatured: createdTask.isFeatured,
      coverImage: createdTask.coverImage,
      shortDescription: createdTask.shortDescription,
      reviewStatus: createdTask.reviewStatus,
      publishedTo: createdTask.publishedTo,
      attachments: [],
    };
    addBoardProjectTask(project.id, boardRow);
    void syncProjectProgressFromLocalTasks(nextTasks);
    closeTaskModal();
  };

  const toggleProjectOwner = (member: (typeof PROJECT_TEAM_MEMBERS)[number]) => {
    const selected = new Set(project.owners);
    if (selected.has(member)) selected.delete(member);
    else selected.add(member);
    const nextOwners = PROJECT_TEAM_MEMBERS.filter((m) => selected.has(m));
    updateBoardProject(project.id, { owners: nextOwners });
  };

  const selectProjectStatus = (status: ProjectStatus) => {
    updateBoardProject(project.id, { status });
    setProjectStatusDropdownOpen(false);
  };

  const postComment = async () => {
    const content = commentDraft.trim();
    if (!content) return;
    const userName = currentUser.name.trim() || "User";
    const { data, error } = await supabase
      .from("project_comments")
      .insert([{ project_id: project.id, user_name: userName, content }])
      .select()
      .single();
    if (error) {
      console.error("[supabase] project comment insert failed:", error.message);
      return;
    }
    const row = data as ProjectComment;
    setComments((prev) => {
      if (prev.some((c) => c.id === row.id)) return prev;
      return [row, ...prev];
    });
    setCommentDraft("");
  };

  const reloadTaskReviews = useCallback(async () => {
    if (!activeTaskId) return;
    const { data, error } = await supabase
      .from("task_reviews")
      .select("*, task_review_attachments(*)")
      .eq("task_id", activeTaskId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[supabase] task_reviews refresh failed:", error.message);
      return;
    }
    setTaskReviews((data as TaskReviewRow[]) ?? []);
  }, [activeTaskId]);

  const syncTaskReviewStatusFromDb = useCallback(
    async (taskId: string) => {
      const { data, error } = await supabase
        .from("task_reviews")
        .select("status")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) {
        console.error("[supabase] task_reviews latest status fetch failed:", error.message);
        return;
      }
      const first = Array.isArray(data) && data.length > 0 ? (data[0] as { status?: unknown }) : null;
      const raw = first?.status != null ? String(first.status) : "";
      const nextStatus = raw.trim() ? raw : null;
      const { error: upErr } = await supabase
        .from("tasks")
        .update({ review_status: nextStatus })
        .eq("id", taskId)
        .eq("project_id", project.id);
      if (upErr) {
        console.error("[supabase] tasks review_status sync failed:", upErr.message);
        return;
      }
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, reviewStatus: nextStatus } : t)));
      updateBoardProjectTask(project.id, taskId, { reviewStatus: nextStatus });
    },
    [project.id, updateBoardProjectTask],
  );

  const cancelEditReview = () => {
    setEditingReviewId(null);
    setEditReviewStatus(null);
    setEditReviewComment("");
    setEditReviewNewFiles([]);
    setEditReviewRemovedAttachmentIds([]);
    setEditReviewError("");
    if (editReviewFileRef.current) editReviewFileRef.current.value = "";
  };

  const saveEditedReview = async () => {
    if (!isRocketRideClient || !activeTask || !editingReviewId) return;
    const rev = taskReviews.find((r) => r.id === editingReviewId);
    if (!rev || !clientReviewAuthorMatches(rev.reviewer_name, currentUser.name)) return;
    if (!editReviewStatus) {
      setEditReviewError(lt("Select a review status before submitting."));
      return;
    }
    setEditReviewSubmitting(true);
    setEditReviewError("");
    try {
      const { error: rowErr } = await supabase
        .from("task_reviews")
        .update({
          status: editReviewStatus,
          comment: editReviewComment.trim() || null,
        })
        .eq("id", editingReviewId);
      if (rowErr) {
        console.error("[supabase] task_reviews update failed:", rowErr.message);
        setEditReviewError(rowErr.message || "Failed to update review.");
        return;
      }

      const existingAtts = Array.isArray(rev.task_review_attachments) ? rev.task_review_attachments : [];
      for (const attId of editReviewRemovedAttachmentIds) {
        const att = existingAtts.find((a) => a.id === attId);
        const path = att?.url ? getTaskReviewAttachmentStoragePathFromUrl(att.url) : "";
        if (path) {
          const { error: stErr } = await supabase.storage.from("task-reviews").remove([path]);
          if (stErr) console.error("[supabase] task-reviews storage remove:", stErr.message);
        }
        const { error: delAttErr } = await supabase.from("task_review_attachments").delete().eq("id", attId);
        if (delAttErr) {
          console.error("[supabase] task_review_attachments delete failed:", delAttErr.message);
          setEditReviewError(delAttErr.message || "Failed to remove an attachment.");
          return;
        }
      }

      for (const file of editReviewNewFiles) {
        const path = `${editingReviewId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
        const { data: upData, error: upErr } = await supabase.storage.from("task-reviews").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
        if (upErr || !upData?.path) {
          console.error("[supabase] task-reviews upload failed:", upErr?.message ?? "no path");
          setEditReviewError(upErr?.message || "Failed to upload an attachment.");
          return;
        }
        const { data: urlData } = supabase.storage.from("task-reviews").getPublicUrl(upData.path);
        const { error: insAttErr } = await supabase.from("task_review_attachments").insert({
          review_id: editingReviewId,
          name: file.name,
          url: urlData.publicUrl,
          type: file.type || "application/octet-stream",
          size: file.size,
        });
        if (insAttErr) {
          console.error("[supabase] task_review_attachments insert failed:", insAttErr.message);
          setEditReviewError(insAttErr.message || "Failed to save attachment.");
          return;
        }
      }

      await syncTaskReviewStatusFromDb(activeTask.id);
      await reloadTaskReviews();
      cancelEditReview();
    } finally {
      setEditReviewSubmitting(false);
    }
  };

  const confirmDeleteClientReview = async () => {
    if (!isRocketRideClient || !activeTask || !reviewDeleteDialog) return;
    const reviewId = reviewDeleteDialog.id;
    const rev = taskReviews.find((r) => r.id === reviewId);
    if (!rev || !clientReviewAuthorMatches(rev.reviewer_name, currentUser.name)) {
      setReviewDeleteDialog(null);
      return;
    }
    const atts = Array.isArray(rev.task_review_attachments) ? rev.task_review_attachments : [];
    for (const att of atts) {
      const path = att.url ? getTaskReviewAttachmentStoragePathFromUrl(att.url) : "";
      if (path) {
        const { error: stErr } = await supabase.storage.from("task-reviews").remove([path]);
        if (stErr) console.error("[supabase] task-reviews storage remove:", stErr.message);
      }
    }
    const { error } = await supabase.from("task_reviews").delete().eq("id", reviewId);
    if (error) {
      console.error("[supabase] task_reviews delete failed:", error.message);
      setReviewDeleteDialog(null);
      return;
    }
    if (editingReviewId === reviewId) cancelEditReview();
    setReviewDeleteDialog(null);
    await syncTaskReviewStatusFromDb(activeTask.id);
    await reloadTaskReviews();
  };

  const submitClientReview = async () => {
    if (!isRocketRideClient || !activeTask) return;
    if (editingReviewId) return;
    if (!reviewPendingStatus) {
      setReviewSubmitError(lt("Select a review status before submitting."));
      return;
    }
    setReviewSubmitting(true);
    setReviewSubmitError("");
    const reviewerName = currentUser.name.trim() || "Client";
    try {
      const { data: inserted, error: reviewErr } = await supabase
        .from("task_reviews")
        .insert({
          task_id: activeTask.id,
          reviewer_name: reviewerName,
          status: reviewPendingStatus,
          comment: reviewCommentDraft.trim() || null,
        })
        .select("*")
        .single();
      if (reviewErr || !inserted) {
        console.error("[supabase] task_reviews insert failed:", reviewErr?.message ?? "unknown");
        setReviewSubmitError(reviewErr?.message || "Failed to submit review.");
        return;
      }
      const reviewId = String((inserted as Record<string, unknown>).id ?? "");
      for (const file of reviewDraftFiles) {
        const path = `${reviewId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
        const { data: upData, error: upErr } = await supabase.storage.from("task-reviews").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
        if (upErr || !upData?.path) {
          console.error("[supabase] task-reviews upload failed:", upErr?.message ?? "no path");
          setReviewSubmitError(upErr?.message || "Failed to upload an attachment.");
          return;
        }
        const { data: urlData } = supabase.storage.from("task-reviews").getPublicUrl(upData.path);
        const { error: attErr } = await supabase.from("task_review_attachments").insert({
          review_id: reviewId,
          name: file.name,
          url: urlData.publicUrl,
          type: file.type || "application/octet-stream",
          size: file.size,
        });
        if (attErr) {
          console.error("[supabase] task_review_attachments insert failed:", attErr.message);
          setReviewSubmitError(attErr.message || "Failed to save attachment.");
          return;
        }
      }

      const statusLabel = reviewPendingStatus;
      await syncTaskReviewStatusFromDb(activeTask.id);
      logTaskReviewActivity({
        reviewerName,
        taskName: activeTask.name,
        reviewStatusLabel: statusLabel,
      });
      await reloadTaskReviews();
      setReviewCommentDraft("");
      setReviewDraftFiles([]);
      setReviewPendingStatus(null);
      if (reviewComposerFileRef.current) reviewComposerFileRef.current.value = "";
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-xs font-light text-[rgba(255,255,255,0.4)] transition-colors hover:text-[var(--muted)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {lt("Projects")}
      </Link>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-elevated)]">
          <Target className="h-6 w-6 text-[var(--muted)]" strokeWidth={1.25} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-light tracking-tight text-white md:text-4xl">{project.name}</h1>
          <div className="mt-2">
            <ProjectStatusBadge status={project.status} />
          </div>
        </div>
      </div>

      <Card className="rounded-[8px]">
        <h2 className="section-title mb-1">{lt("Properties")}</h2>
        <div>
          <PropRow label={lt("Status")}>
            <div className="relative" ref={projectPropsStatusRef}>
              <button
                type="button"
                onClick={() => setProjectStatusDropdownOpen((v) => !v)}
                className="inline-flex items-center gap-2 rounded-[6px] text-left transition hover:bg-[rgba(255,255,255,0.04)]"
              >
                <ProjectStatusBadge status={project.status} />
                <ChevronDown className="h-4 w-4 shrink-0 text-[rgba(255,255,255,0.35)]" strokeWidth={1.5} />
              </button>
              {projectStatusDropdownOpen ? (
                <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-[8px] border border-[var(--border)] bg-[#131313] p-2 shadow-lg">
                  {KANBAN_COLUMNS.map((col) => {
                    const status = COLUMN_TO_STATUS[col.id];
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => selectProjectStatus(status)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-sm font-light text-white hover:bg-[rgba(255,255,255,0.04)]",
                          project.status === status && "bg-[rgba(255,255,255,0.04)]",
                        )}
                      >
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", col.dotClass)} aria-hidden />
                        {lt(status)}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </PropRow>
          <PropRow label={lt("Owner")}>
            <div className="relative" ref={projectPropsOwnersRef}>
              <button
                type="button"
                onClick={() => setProjectOwnersDropdownOpen((v) => !v)}
                className="flex max-w-full flex-wrap items-center gap-2 rounded-[6px] text-left transition hover:bg-[rgba(255,255,255,0.04)]"
              >
                {project.owners.length === 0 ? (
                  <span className="text-xs font-light text-[rgba(255,255,255,0.4)]">—</span>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {project.owners.map((name) => (
                      <div
                        key={name}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[0.7rem] font-light text-white"
                        style={{ backgroundColor: `hsla(${commentAuthorHue(name)}, 35%, 32%, 1)` }}
                        title={name}
                      >
                        {commentAuthorInitials(name)}
                      </div>
                    ))}
                  </div>
                )}
                <ChevronDown className="h-4 w-4 shrink-0 text-[rgba(255,255,255,0.35)]" strokeWidth={1.5} />
              </button>
              {projectOwnersDropdownOpen ? (
                <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-full min-w-[260px] overflow-y-auto rounded-[8px] border border-[var(--border)] bg-[#131313] p-2 shadow-lg">
                  {PROJECT_TEAM_MEMBERS.map((member) => {
                    const sel = project.owners.includes(member);
                    return (
                      <button
                        key={member}
                        type="button"
                        onClick={() => toggleProjectOwner(member)}
                        className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-sm font-light text-white hover:bg-[rgba(255,255,255,0.04)]"
                      >
                        {sel ? (
                          <Check className="h-4 w-4 shrink-0 text-[#22c55e]" strokeWidth={2} />
                        ) : (
                          <span className="inline-flex h-4 w-4 shrink-0" aria-hidden />
                        )}
                        {member}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </PropRow>
          <PropRow label={lt("Progress")}>
            <div className="max-w-md">
              <ProgressInline value={progressPercentage} />
            </div>
          </PropRow>
          <PropRow label={lt("Due date")}>
            <input
              type="date"
              value={project.dueDate ?? ""}
              onChange={(event) =>
                updateBoardProject(project.id, { dueDate: event.target.value || null })
              }
              className="mono-num max-w-[12rem] rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-sm font-light text-white outline-none"
            />
          </PropRow>
          <PropRow label={lt("Project type")}>
            <ProjectTypeBadge type={project.type} />
          </PropRow>
        </div>

        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className="mt-4 flex w-full items-center justify-between rounded-[8px] border border-[var(--border)] bg-[#101010] px-3 py-2 text-left text-xs font-light text-[rgba(255,255,255,0.4)] transition-colors hover:border-[var(--border-strong)]"
        >
          <span>{lt("More properties")}</span>
          {moreOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {moreOpen ? (
          <div className="mt-3 rounded-[8px] border border-[var(--border)] bg-[#101010] px-3 py-2">
            <PropRow label={lt("Start date")}>
              <span className="mono-num text-[rgba(255,255,255,0.4)]">{formatDisplayDate(project.startDate)}</span>
            </PropRow>
            <PropRow label={lt("Team members")}>
              {project.teamMembers.length ? (
                <span className="text-[rgba(255,255,255,0.4)]">{project.teamMembers.join(", ")}</span>
              ) : (
                <span className="text-[rgba(255,255,255,0.4)]">—</span>
              )}
            </PropRow>
            <PropRow label={lt("Linked invoices")}>
              {project.linkedInvoices.length ? (
                <ul className="list-inside list-disc text-[rgba(255,255,255,0.4)]">
                  {project.linkedInvoices.map((inv) => (
                    <li key={inv}>{inv}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-[rgba(255,255,255,0.4)]">—</span>
              )}
            </PropRow>
          </div>
        ) : null}
      </Card>

      <Card className="rounded-[8px]">
        <h2 className="section-title mb-3">{lt("About this project")}</h2>
        <textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            if (projectDescriptionError) setProjectDescriptionError("");
          }}
          placeholder={lt("Add a project description...")}
          rows={5}
          className="w-full resize-y rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white placeholder:text-[rgba(255,255,255,0.4)]"
        />
        {description !== savedDescription ? (
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void saveProjectDescription();
                }}
                className="rounded-[8px] bg-[#ff4500] px-4 py-1.5 text-[0.8rem] font-light text-white transition-colors hover:bg-[#e33f00]"
              >
                {lt("Save")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDescription(savedDescription);
                  setProjectDescriptionError("");
                }}
                className="btn-ghost rounded-[8px] px-3 py-1.5 text-[0.8rem]"
              >
                {lt("Cancel")}
              </button>
              {projectDescriptionSavedHint ? <span className="text-[0.75rem] text-[#22c55e]">{lt("Saved")}</span> : null}
            </div>
            {projectDescriptionError ? (
              <p className="mt-1 text-[0.75rem] text-[#ef4444]">{lt(projectDescriptionError)}</p>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Card className="rounded-[8px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title mb-0">{lt("Project Tasks")}</h2>
          {!isRocketRideClient ? (
            <button type="button" onClick={openTaskModal} className="btn-primary rounded-[8px] px-3 py-1.5 text-xs">
              {lt("New Task")}
            </button>
          ) : null}
        </div>
        <div className="overflow-x-auto rounded-[8px] border border-[var(--border)]">
          <table className="bg-[#161616]">
            <thead>
              <tr className="text-[rgba(255,255,255,0.4)]">
                <th className="kpi-label border-[var(--border)] bg-[#101010] py-2.5">{lt("Task name")}</th>
                <th className="kpi-label border-[var(--border)] bg-[#101010] py-2.5">{lt("Owner")}</th>
                <th className="kpi-label border-[var(--border)] bg-[#101010] py-2.5">{lt("Due date")}</th>
                <th className="kpi-label border-[var(--border)] bg-[#101010] py-2.5">{lt("Status")}</th>
                <th className="kpi-label border-[var(--border)] bg-[#101010] py-2.5">{lt("Review")}</th>
                <th className="kpi-label w-12 border-[var(--border)] bg-[#101010] py-2.5 text-center" aria-label={lt("Featured")}>
                  <Star className="mx-auto h-4 w-4 text-[rgba(255,255,255,0.35)]" strokeWidth={1.5} />
                </th>
                <th className="kpi-label w-10 border-[var(--border)] bg-[#101010] py-2.5" aria-label={lt("Actions")} />
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr
                  key={task.id}
                  className="group/row cursor-pointer transition-colors hover:bg-[rgba(255,255,255,0.03)]"
                  onClick={() => openTaskPanel(task.id)}
                >
                  <td className="text-sm font-light text-white">
                    {isRocketRideClient ? (
                      <span className="block px-2 py-1 text-sm font-light text-white">{task.name}</span>
                    ) : editingCell?.taskId === task.id && editingCell.field === "name" ? (
                      <input
                        autoFocus
                        value={task.name}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => void updateTask(task.id, { name: event.target.value })}
                        onBlur={() => setEditingCell(null)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            (event.currentTarget as HTMLInputElement).blur();
                          }
                        }}
                        className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-sm font-light text-white outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setEditingCell({ taskId: task.id, field: "name" });
                        }}
                        className="text-left text-sm font-light text-white"
                      >
                        {task.name}
                      </button>
                    )}
                  </td>
                  <td onClick={(event) => event.stopPropagation()}>
                    {isRocketRideClient ? (
                      <div className="px-2 py-1">
                        <OwnerAvatars names={[task.owner]} />
                      </div>
                    ) : editingCell?.taskId === task.id && editingCell.field === "owner" ? (
                      <select
                        autoFocus
                        value={task.owner}
                        onChange={(event) => void updateTask(task.id, { owner: event.target.value })}
                        onBlur={() => setEditingCell(null)}
                        className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-xs font-light text-white outline-none"
                      >
                        {OWNER_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingCell({ taskId: task.id, field: "owner" })}
                        className="w-full text-left"
                      >
                        <OwnerAvatars names={[task.owner]} />
                      </button>
                    )}
                  </td>
                  <td className="text-xs font-light text-[rgba(255,255,255,0.4)]" onClick={(event) => event.stopPropagation()}>
                    {isRocketRideClient ? (
                      <span className="mono-num px-2 py-1">
                        {task.dueDate ? formatDisplayDate(task.dueDate) : "—"}
                      </span>
                    ) : editingCell?.taskId === task.id && editingCell.field === "dueDate" ? (
                      <input
                        type="date"
                        autoFocus
                        value={task.dueDate || ""}
                        onChange={(event) => void updateTask(task.id, { dueDate: event.target.value || null })}
                        onBlur={() => setEditingCell(null)}
                        className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-xs font-light text-white outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingCell({ taskId: task.id, field: "dueDate" })}
                        className="text-left text-xs font-light text-[rgba(255,255,255,0.4)]"
                      >
                        {task.dueDate ? (
                          <span className="mono-num">{formatDisplayDate(task.dueDate)}</span>
                        ) : (
                          "—"
                        )}
                      </button>
                    )}
                  </td>
                  <td className="relative" onClick={(event) => event.stopPropagation()}>
                    {isRocketRideClient ? (
                      <div className="px-2 py-1">
                        <TaskRowStatusBadge status={task.status} publishedTo={task.publishedTo} />
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            const rect = event.currentTarget.getBoundingClientRect();
                            const { top, left } = getRowStatusDropdownPosition(rect);
                            setRowStatusMenu((prev) =>
                              prev?.taskId === task.id ? null : { taskId: task.id, top, left },
                            );
                          }}
                          className="text-left"
                        >
                          <TaskRowStatusBadge status={task.status} publishedTo={task.publishedTo} />
                        </button>
                        {rowStatusMenu?.taskId === task.id
                          ? createPortal(
                              <div
                                className="w-56 rounded-[8px] border border-[var(--border)] bg-[#131313] p-2"
                                style={{ position: "fixed", top: rowStatusMenu.top, left: rowStatusMenu.left, zIndex: 9999 }}
                                onMouseDown={(event) => event.stopPropagation()}
                                onClick={(event) => event.stopPropagation()}
                              >
                                {groupedStatuses.map((group) => (
                                  <div key={group.group} className="mb-2 last:mb-0">
                                    <p className="px-2 py-1 text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">
                                      {group.group}
                                    </p>
                                    {group.options.map((option) => (
                                      <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => void handleTaskStatusSelect(task.id, option.value)}
                                        className={cn(
                                          "flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-sm font-light text-white hover:bg-[rgba(255,255,255,0.04)]",
                                          task.status === option.value && "bg-[rgba(255,255,255,0.04)]",
                                        )}
                                      >
                                        <span className={cn("h-1.5 w-1.5 rounded-full", option.dotClass)} aria-hidden />
                                        {option.value}
                                      </button>
                                    ))}
                                  </div>
                                ))}
                              </div>,
                              document.body,
                            )
                          : null}
                      </>
                    )}
                  </td>
                  <td className="text-xs font-light text-[rgba(255,255,255,0.55)]" onClick={(event) => event.stopPropagation()}>
                    <div className="px-2 py-1">
                      <TaskReviewColumnBadge status={task.reviewStatus} lt={lt} />
                    </div>
                  </td>
                  <td className="w-12 text-center" onClick={(event) => event.stopPropagation()}>
                    {isRocketRideClient ? (
                      <span className="inline-flex justify-center p-1.5 text-[rgba(255,255,255,0.35)]" aria-hidden>
                        <Star
                          className={cn(
                            "h-4 w-4",
                            task.isFeatured ? "fill-[var(--primary)] text-[var(--primary)]" : "",
                          )}
                          strokeWidth={1.5}
                        />
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void updateTask(task.id, { isFeatured: !task.isFeatured })}
                        className="inline-flex rounded-[6px] p-1.5 text-[rgba(255,255,255,0.35)] transition hover:bg-[rgba(255,255,255,0.06)]"
                        aria-label={task.isFeatured ? lt("Unfeature task") : lt("Feature task in highlights")}
                      >
                        <Star
                          className={cn(
                            "h-4 w-4",
                            task.isFeatured ? "fill-[var(--primary)] text-[var(--primary)]" : "",
                          )}
                          strokeWidth={1.5}
                        />
                      </button>
                    )}
                  </td>
                  <td className="w-10 text-center" onClick={(event) => event.stopPropagation()}>
                    {!isRocketRideClient ? (
                      <button
                        type="button"
                        onClick={() => setTaskDeleteDialog({ id: task.id, name: task.name })}
                        className="inline-flex rounded-[6px] p-1.5 text-[rgba(255,255,255,0.3)] opacity-0 transition hover:text-[#ef4444] group-hover/row:opacity-100"
                        aria-label={lt("Delete task")}
                      >
                        <Trash2 className="h-[14px] w-[14px]" strokeWidth={1.75} />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!isRocketRideClient ? (
                <tr className="cursor-pointer border-t border-[var(--border)] transition-colors hover:bg-[rgba(255,255,255,0.03)]">
                  <td colSpan={7} className="py-3">
                    <button
                      type="button"
                      onClick={openTaskModal}
                      className="flex w-full items-center justify-center gap-2 text-xs font-light text-[rgba(255,255,255,0.4)] hover:text-[var(--muted)]"
                    >
                      <Plus className="h-4 w-4" strokeWidth={1.5} />
                      {lt("Add task")}
                    </button>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="rounded-[8px]">
        <h2 className="section-title mb-3">{lt("COMMENTS")}</h2>
        <div className="space-y-3">
          <div>
            <textarea
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void postComment();
                }
              }}
              placeholder={lt("Add a comment...")}
              rows={3}
              className="w-full resize-y rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white placeholder:text-[rgba(255,255,255,0.4)]"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => void postComment()}
                className="rounded-[6px] bg-[#ff4500] px-3 py-1.5 text-xs font-light text-white transition-colors hover:bg-[#e33f00]"
              >
                {lt("Post")}
              </button>
            </div>
          </div>
          {comments.length === 0 ? (
            <p className="text-sm font-light text-[rgba(255,255,255,0.4)]">
              {lt("No comments yet — be the first to comment")}
            </p>
          ) : (
            <ul className="space-y-0 divide-y divide-[var(--border)]">
              {comments.map((comment) => (
                <li key={comment.id} className="flex gap-3 py-3 first:pt-0">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[0.65rem] font-light text-white"
                    style={{ backgroundColor: `hsla(${commentAuthorHue(comment.user_name)}, 35%, 32%, 1)` }}
                  >
                    {commentAuthorInitials(comment.user_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">{comment.user_name}</p>
                    <p className="mt-1 text-sm font-light text-[rgba(255,255,255,0.85)]">{comment.content}</p>
                    <p className="mt-1 text-[0.72rem] font-light text-[rgba(255,255,255,0.4)]">
                      {formatCommentTimestamp(comment.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {modalOpen && !isRocketRideClient ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="w-full max-w-xl rounded-[8px] border border-[var(--border)] bg-[#161616] p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="section-title">{lt("New Task")}</p>
                <p className="mt-1 text-xs font-light text-[rgba(255,255,255,0.4)]">{lt("Create a task for this project.")}</p>
              </div>
              <button
                type="button"
                onClick={closeTaskModal}
                className="rounded-[8px] border border-[var(--border)] px-2 py-1 text-xs font-light text-[rgba(255,255,255,0.4)] hover:border-[var(--border-strong)]"
              >
                {lt("Close")}
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleCreateTask}>
              <label className="block space-y-1">
                <span className="text-xs font-light text-[rgba(255,255,255,0.4)]">{lt("Task name")}</span>
                <input
                  value={taskName}
                  onChange={(event) => {
                    setTaskName(event.target.value);
                    if (taskNameError) setTaskNameError("");
                  }}
                  placeholder={lt("Design Services Page")}
                  className={cn(
                    "w-full rounded-[8px] border bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white outline-none transition-colors",
                    taskNameError ? "border-[#ef4444]/40" : "border-[var(--border)] focus:border-[var(--border-strong)]",
                  )}
                  required
                />
                {taskNameError ? <span className="text-xs font-light text-[#fca5a5]">{lt(taskNameError)}</span> : null}
                {taskSubmitError ? <span className="text-xs font-light text-[#fca5a5]">{lt(taskSubmitError)}</span> : null}
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-xs font-light text-[rgba(255,255,255,0.4)]">{lt("Owner")}</span>
                  <select
                    value={owner}
                    onChange={(event) => setOwner(event.target.value)}
                    className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white outline-none transition-colors focus:border-[var(--border-strong)]"
                  >
                    {OWNER_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-light text-[rgba(255,255,255,0.4)]">{lt("Due date")}</span>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                    className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white outline-none transition-colors focus:border-[var(--border-strong)]"
                  />
                </label>
              </div>

              <div className="relative">
                <span className="mb-1 block text-xs font-light text-[rgba(255,255,255,0.4)]">{lt("Status")}</span>
                <button
                  type="button"
                  onClick={() => setStatusMenuOpen((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white"
                >
                  <span className="inline-flex items-center gap-2">
                    <span className={cn("h-1.5 w-1.5 rounded-full", selectedStatusOption.dotClass)} aria-hidden />
                    {lt(selectedStatusOption.value)}
                  </span>
                  {statusMenuOpen ? <ChevronDown className="h-4 w-4 text-[rgba(255,255,255,0.4)]" /> : <ChevronRight className="h-4 w-4 text-[rgba(255,255,255,0.4)]" />}
                </button>
                {statusMenuOpen ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-10 rounded-[8px] border border-[var(--border)] bg-[#131313] p-2">
                    {groupedStatuses.map((group) => (
                      <div key={group.group} className="mb-2 last:mb-0">
                        <p className="px-2 py-1 text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">
                          {lt(group.group)}
                        </p>
                        {group.options.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setTaskStatus(option.value);
                              setStatusMenuOpen(false);
                            }}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-sm font-light text-white transition-colors hover:bg-[rgba(255,255,255,0.04)]",
                              taskStatus === option.value && "bg-[rgba(255,255,255,0.04)]",
                            )}
                          >
                            <span className={cn("h-1.5 w-1.5 rounded-full", option.dotClass)} aria-hidden />
                            {lt(option.value)}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeTaskModal}
                  className="rounded-[8px] border border-[var(--border)] bg-transparent px-3 py-1.5 text-xs font-light text-[rgba(255,255,255,0.4)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--muted)]"
                >
                  {lt("Cancel")}
                </button>
                <button type="submit" className="btn-primary rounded-[8px] px-3 py-1.5 text-xs">
                  {lt("Create Task")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className={cn("fixed inset-0 z-40 transition-opacity", activeTask ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0")}>
        <button
          type="button"
          className="absolute inset-0 bg-black/30"
          onClick={closeTaskPanel}
          aria-label={lt("Close task panel")}
        />
        <aside
          className={cn(
            "absolute right-0 top-0 h-full w-full max-w-[480px] transform overflow-y-auto border-l border-[rgba(255,255,255,0.08)] bg-[#1a1a1a] p-5 transition-transform duration-200",
            activeTask ? "translate-x-0" : "translate-x-full",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          {activeTask ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {isRocketRideClient ? (
                    <h2 className="text-2xl font-light text-white">{activeTask.name}</h2>
                  ) : panelEditingName ? (
                    <input
                      autoFocus
                      value={activeTask.name}
                      onChange={(event) => void updateTask(activeTask.id, { name: event.target.value })}
                      onBlur={() => setPanelEditingName(false)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          (event.currentTarget as HTMLInputElement).blur();
                        }
                      }}
                      className="w-full border-none bg-transparent p-0 text-2xl font-light text-white outline-none"
                    />
                  ) : (
                    <button type="button" onClick={() => setPanelEditingName(true)} className="w-full text-left">
                      <h2 className="text-2xl font-light text-white">{activeTask.name}</h2>
                    </button>
                  )}
                  <div className="relative mt-3 inline-block">
                    {isRocketRideClient ? (
                      <TaskRowStatusBadge status={activeTask.status} publishedTo={activeTask.publishedTo} />
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setPanelStatusOpen((prev) => !prev)}
                          className="text-left"
                        >
                          <TaskRowStatusBadge status={activeTask.status} publishedTo={activeTask.publishedTo} />
                        </button>
                        {panelStatusOpen ? (
                          <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-56 rounded-[8px] border border-[var(--border)] bg-[#131313] p-2">
                            {groupedStatuses.map((group) => (
                              <div key={group.group} className="mb-2 last:mb-0">
                                <p className="px-2 py-1 text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">
                                  {lt(group.group)}
                                </p>
                                {group.options.map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => void handleTaskStatusSelect(activeTask.id, option.value)}
                                    className={cn(
                                      "flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-sm font-light text-white hover:bg-[rgba(255,255,255,0.04)]",
                                      activeTask.status === option.value && "bg-[rgba(255,255,255,0.04)]",
                                    )}
                                  >
                                    <span className={cn("h-1.5 w-1.5 rounded-full", option.dotClass)} aria-hidden />
                                    {lt(option.value)}
                                  </button>
                                ))}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeTaskPanel}
                  className="rounded-[8px] border border-[var(--border)] p-1.5 text-[rgba(255,255,255,0.6)] hover:border-[var(--border-strong)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="rounded-[8px] border border-[var(--border)] bg-[#161616] p-3">
                <div className="grid grid-cols-[120px_1fr] gap-y-3">
                  <span className="text-xs font-light text-[rgba(255,255,255,0.4)]">{lt("Owner")}</span>
                  <div>
                    {isRocketRideClient ? (
                      <OwnerAvatars names={[activeTask.owner]} />
                    ) : panelOwnerEditing ? (
                      <select
                        autoFocus
                        value={activeTask.owner}
                        onChange={(event) => void updateTask(activeTask.id, { owner: event.target.value })}
                        onBlur={() => setPanelOwnerEditing(false)}
                        className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-sm font-light text-white outline-none"
                      >
                        {OWNER_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button type="button" onClick={() => setPanelOwnerEditing(true)} className="text-left">
                        <OwnerAvatars names={[activeTask.owner]} />
                      </button>
                    )}
                  </div>

                  <span className="text-xs font-light text-[rgba(255,255,255,0.4)]">{lt("Due date")}</span>
                  <div>
                    {isRocketRideClient ? (
                      <span className="text-sm font-light text-[rgba(255,255,255,0.7)]">
                        {activeTask.dueDate ? (
                          <span className="mono-num">{formatDisplayDate(activeTask.dueDate)}</span>
                        ) : (
                          "—"
                        )}
                      </span>
                    ) : panelDueDateEditing ? (
                      <input
                        type="date"
                        autoFocus
                        value={activeTask.dueDate || ""}
                        onChange={(event) => void updateTask(activeTask.id, { dueDate: event.target.value || null })}
                        onBlur={() => setPanelDueDateEditing(false)}
                        className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-sm font-light text-white outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPanelDueDateEditing(true)}
                        className="text-sm font-light text-[rgba(255,255,255,0.7)]"
                      >
                        {activeTask.dueDate ? (
                          <span className="mono-num">{formatDisplayDate(activeTask.dueDate)}</span>
                        ) : (
                          "—"
                        )}
                      </button>
                    )}
                  </div>

                  <span className="text-xs font-light text-[rgba(255,255,255,0.4)]">{lt("Project")}</span>
                  <span className="text-sm font-light text-[rgba(255,255,255,0.7)]">{project.name}</span>

                  <span className="text-xs font-light text-[rgba(255,255,255,0.4)]">{lt("Priority")}</span>
                  {isRocketRideClient ? (
                    <span
                      className={cn(
                        "text-sm font-light",
                        PRIORITY_OPTIONS.find((option) => option.value === panelPriority)?.textClass,
                      )}
                    >
                      {lt(panelPriority)}
                    </span>
                  ) : (
                    <select
                      value={panelPriority}
                      onChange={(event) => {
                        const next = event.target.value as Priority;
                        setPanelPriority(next);
                        void updateTask(activeTask.id, { priority: next });
                      }}
                      className={cn(
                        "w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1.5 text-sm font-light outline-none",
                        PRIORITY_OPTIONS.find((option) => option.value === panelPriority)?.textClass,
                      )}
                    >
                      {PRIORITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {lt(option.value)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <p className="section-title mb-2">{lt("Description")}</p>
                {isRocketRideClient ? (
                  <p className="whitespace-pre-wrap rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-[rgba(255,255,255,0.85)]">
                    {panelDescription.trim() ? panelDescription : "—"}
                  </p>
                ) : (
                  <>
                    <textarea
                      ref={panelDescriptionRef}
                      value={panelDescription}
                      onChange={(event) => {
                        onPanelDescriptionChange(event.target.value);
                        if (taskDescriptionError) setTaskDescriptionError("");
                      }}
                      rows={1}
                      placeholder={lt("Add a task description...")}
                      className="w-full resize-none overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white placeholder:text-[rgba(255,255,255,0.4)]"
                    />
                    {panelDescription !== panelSavedDescription ? (
                      <div className="mt-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              void saveTaskDescription();
                            }}
                            className="rounded-[8px] bg-[#ff4500] px-4 py-1.5 text-[0.8rem] font-light text-white transition-colors hover:bg-[#e33f00]"
                          >
                            {lt("Save")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPanelDescription(panelSavedDescription);
                              setTaskDescriptionError("");
                            }}
                            className="btn-ghost rounded-[8px] px-3 py-1.5 text-[0.8rem]"
                          >
                            {lt("Cancel")}
                          </button>
                          {taskDescriptionSavedHint ? <span className="text-[0.75rem] text-[#22c55e]">{lt("Saved")}</span> : null}
                        </div>
                        {taskDescriptionError ? (
                          <p className="mt-1 text-[0.75rem] text-[#ef4444]">{lt(taskDescriptionError)}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              <div>
                <p className="section-title mb-2">{lt("Attachments")}</p>
                {!isRocketRideClient ? (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      multiple
                      onChange={(event) => void onPanelFileUpload(event.target.files)}
                    />
                    <div
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          if (!taskAttachmentUploading) fileInputRef.current?.click();
                        }
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (!taskAttachmentUploading) void onPanelFileUpload(event.dataTransfer.files);
                      }}
                      className="w-full"
                    >
                      <button
                        type="button"
                        disabled={taskAttachmentUploading}
                        onClick={() => fileInputRef.current?.click()}
                        className="flex w-full items-center justify-center gap-2 rounded-[8px] border border-dashed border-[rgba(255,255,255,0.15)] bg-[#161616] px-4 py-6 text-sm font-light text-[rgba(255,255,255,0.5)] disabled:opacity-60"
                      >
                        {taskAttachmentUploading ? (
                          <>
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin" strokeWidth={1.5} />
                            {lt("Uploading…")}
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4" />
                            {lt("Click to upload or drag and drop")}
                          </>
                        )}
                      </button>
                    </div>
                  </>
                ) : null}
                {taskAttachmentError ? (
                  <p className="mt-2 text-[0.75rem] text-[#ef4444]">{taskAttachmentError}</p>
                ) : null}
                <div className="mt-3 space-y-3">
                  {activeTask.attachments.map((attachment) => {
                    const Icon = attachmentKind(attachment.type, attachment.name);
                    const pk = attachmentPreviewKind(attachment);
                    const expandHint = lt("Click for full view");
                    return (
                      <div
                        key={attachment.id}
                        className="overflow-hidden rounded-[8px] border border-[var(--border)] bg-[#161616]"
                      >
                        {pk !== "other" ? (
                          <TaskAttachmentInlineVisual
                            attachment={attachment}
                            onExpand={() => openTaskAttachmentPreview(attachment)}
                            expandHint={expandHint}
                          />
                        ) : null}
                        <div className="flex items-center gap-2 px-2 py-2">
                          <Icon className="h-4 w-4 shrink-0 text-[rgba(255,255,255,0.55)]" />
                          <button
                            type="button"
                            onClick={() => openTaskAttachmentPreview(attachment)}
                            className="min-w-0 flex-1 truncate text-left text-sm font-light text-white hover:underline"
                            title={attachment.name}
                          >
                            {attachment.name}
                          </button>
                          <span className="mono-num shrink-0 text-xs font-light text-[rgba(255,255,255,0.4)]">
                            {formatFileSize(attachment.size)}
                          </span>
                          <button
                            type="button"
                            onClick={() => openTaskAttachmentPreview(attachment)}
                            className="shrink-0 rounded-[6px] p-1.5 text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
                            aria-label={lt("Preview")}
                          >
                            <Eye className="h-4 w-4" strokeWidth={1.5} />
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadTaskAttachment(attachment)}
                            className="shrink-0 rounded-[6px] p-1.5 text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
                            aria-label={lt("Download")}
                          >
                            <Download className="h-4 w-4" strokeWidth={1.5} />
                          </button>
                          {!isRocketRideClient ? (
                            <button
                              type="button"
                              onClick={() => void deleteTaskAttachment(activeTask.id, attachment)}
                              className="shrink-0 rounded-[6px] p-1.5 text-[rgba(255,255,255,0.45)] transition-colors hover:bg-[rgba(239,68,68,0.12)] hover:text-[#ef4444]"
                              aria-label={lt("Delete attachment")}
                            >
                              <X className="h-4 w-4" strokeWidth={1.5} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 border-t border-[var(--border)] pt-5">
                <p className="section-title mb-0">{lt("SHORT DESCRIPTION")}</p>
                <p className="text-xs font-light text-[rgba(255,255,255,0.4)]">
                  {lt("Shown in Dashboard Highlights when featured")}
                </p>
                {isRocketRideClient ? (
                  <p className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-[rgba(255,255,255,0.85)]">
                    {activeTask.shortDescription.trim() ? activeTask.shortDescription : "—"}
                  </p>
                ) : (
                  <input
                    type="text"
                    maxLength={200}
                    value={activeTask.shortDescription}
                    onChange={(event) => void updateTask(activeTask.id, { shortDescription: event.target.value.slice(0, 200) })}
                    placeholder={lt("Brief description of this work...")}
                    className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white placeholder:text-[rgba(255,255,255,0.4)]"
                  />
                )}
              </div>

              <div className="space-y-2 border-t border-[var(--border)] pt-5">
                <p className="section-title mb-0">{lt("COVER IMAGE")}</p>
                {!isRocketRideClient ? (
                  <input
                    ref={coverImageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/*"
                    className="sr-only"
                    aria-hidden
                    tabIndex={-1}
                    onChange={onCoverImageChange}
                  />
                ) : null}
                {activeTask.coverImage ? (
                  <div className="relative w-full overflow-hidden rounded-[6px]">
                    <img src={activeTask.coverImage} alt="" className="h-[160px] w-full object-cover" />
                    {!isRocketRideClient ? (
                      <button
                        type="button"
                        onClick={removeCoverImage}
                        className="absolute right-2 top-2 rounded-[6px] border border-[var(--border)] bg-[rgba(0,0,0,0.65)] p-1.5 text-white"
                        aria-label={lt("Remove cover image")}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                ) : isRocketRideClient ? (
                  <p className="text-sm font-light text-[rgba(255,255,255,0.35)]">—</p>
                ) : (
                  <button
                    type="button"
                    onClick={triggerCoverImageFilePicker}
                    disabled={coverUploadLoading}
                    className="relative flex w-full items-center justify-center rounded-[8px] border border-dashed border-[rgba(255,255,255,0.15)] bg-[#161616] px-4 py-6 text-sm font-light text-[rgba(255,255,255,0.5)] disabled:opacity-60"
                  >
                    {coverUploadLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" strokeWidth={1.5} />
                        {lt("Uploading…")}
                      </>
                    ) : (
                      lt("Click to upload cover image")
                    )}
                  </button>
                )}
                {coverUploadError ? (
                  <p className="text-[0.75rem] text-[#ef4444]">{coverUploadError}</p>
                ) : null}
                {!isRocketRideClient ? (
                  <p className="text-[0.72rem] font-light text-[rgba(255,255,255,0.3)]">
                    {lt("Recommended: 1920×1080px — any size accepted")}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2 border-t border-[var(--border)] pt-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="section-title mb-0">{lt("FEATURED IN HIGHLIGHTS")}</span>
                  {isRocketRideClient ? (
                    <span className="text-xs font-light text-[rgba(255,255,255,0.55)]">
                      {activeTask.isFeatured ? lt("Yes") : lt("No")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={activeTask.isFeatured}
                      onClick={() => void updateTask(activeTask.id, { isFeatured: !activeTask.isFeatured })}
                      className={cn(
                        "relative h-7 w-12 shrink-0 rounded-full transition-colors",
                        activeTask.isFeatured ? "bg-[var(--primary)]" : "bg-[rgba(255,255,255,0.15)]",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-[left] duration-200 ease-out",
                          activeTask.isFeatured ? "left-[calc(100%-1.375rem)]" : "left-1",
                        )}
                      />
                    </button>
                  )}
                </div>
                {!isRocketRideClient && activeTask.isFeatured && !activeTask.coverImage ? (
                  getTaskHighlightCoverUrl({ coverImage: null, attachments: activeTask.attachments }) ? (
                    <p className="text-[0.72rem] font-light text-[rgba(255,255,255,0.4)]">
                      {lt("Using first image attachment as cover — or upload a dedicated cover image")}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-400">{lt("Add a cover image to display in Highlights")}</p>
                  )
                ) : null}
              </div>

              {!isRocketRideClient ? (
                <div className="border-t border-[var(--border)] pt-5">
                  <button
                    type="button"
                    onClick={() => setTaskDeleteDialog({ id: activeTask.id, name: activeTask.name })}
                    className="w-full rounded-[8px] border border-[rgba(239,68,68,0.35)] bg-transparent py-2.5 text-xs font-light text-[#fca5a5] transition-colors hover:bg-[rgba(239,68,68,0.08)]"
                  >
                    {lt("Delete task")}
                  </button>
                </div>
              ) : null}

              {isRocketRideClient ? (
                <div className="border-t border-[var(--border)] pt-6">
                  <p className="section-title mb-1">{lt("CLIENT REVIEW")}</p>
                  <p className="mb-4 text-xs font-light text-[rgba(255,255,255,0.45)]">
                    {lt("Leave feedback, approvals or notes for the team")}
                  </p>

                  {editingReviewId ? (
                    <p className="mb-3 text-[0.75rem] font-light text-amber-200/90">{lt("Finish or cancel your edit before submitting a new review.")}</p>
                  ) : null}
                  <div className={cn(editingReviewId ? "pointer-events-none opacity-40" : undefined)}>
                  <p className="mb-2 text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">
                    {lt("Review status")}
                  </p>
                  <div className="mb-4 grid gap-2 sm:grid-cols-3">
                    {(
                      [
                        { value: "Approved" as const, icon: Check, activeClass: "border-emerald-500/50 bg-emerald-600/25 text-emerald-100" },
                        { value: "Needs Changes" as const, icon: AlertCircle, activeClass: "border-amber-500/50 bg-amber-600/20 text-amber-100" },
                        { value: "Rejected" as const, icon: X, activeClass: "border-red-500/50 bg-red-600/25 text-red-100" },
                      ] as const
                    ).map(({ value, icon: ChipIcon, activeClass }) => {
                      const selected = reviewPendingStatus === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setReviewPendingStatus(value);
                            setReviewSubmitError("");
                          }}
                          className={cn(
                            "flex flex-col items-center gap-2 rounded-[10px] border px-3 py-4 text-center text-sm font-light transition-colors",
                            selected
                              ? activeClass
                              : "border-[var(--border)] bg-[#161616] text-[rgba(255,255,255,0.55)] hover:border-[rgba(255,255,255,0.2)]",
                          )}
                        >
                          <ChipIcon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                          {value === "Approved"
                            ? lt("Approved")
                            : value === "Needs Changes"
                              ? lt("Needs Changes")
                              : lt("Rejected")}
                        </button>
                      );
                    })}
                  </div>

                  <textarea
                    value={reviewCommentDraft}
                    onChange={(event) => setReviewCommentDraft(event.target.value)}
                    rows={4}
                    placeholder={lt("Add your review comment, feedback or meeting notes...")}
                    className="mb-3 w-full resize-y rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white placeholder:text-[rgba(255,255,255,0.4)]"
                  />

                  <input
                    ref={reviewComposerFileRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={(event) => {
                      const list = event.target.files;
                      if (!list?.length) return;
                      setReviewDraftFiles((prev) => [...prev, ...Array.from(list)]);
                      event.target.value = "";
                    }}
                  />
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => reviewComposerFileRef.current?.click()}
                      disabled={reviewSubmitting}
                      className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[#161616] px-3 py-2 text-xs font-light text-white transition-colors hover:bg-[rgba(255,255,255,0.06)] disabled:opacity-50"
                    >
                      <Paperclip className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      {lt("Attach file")}
                    </button>
                    {reviewDraftFiles.map((file, idx) => (
                      <span
                        key={`${file.name}-${idx}`}
                        className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--border)] bg-[#141414] py-1 pl-2.5 pr-1 text-[11px] font-light text-[rgba(255,255,255,0.85)]"
                      >
                        <span className="max-w-[200px] truncate">{file.name}</span>
                        <button
                          type="button"
                          disabled={reviewSubmitting}
                          onClick={() => setReviewDraftFiles((prev) => prev.filter((_, i) => i !== idx))}
                          className="rounded-full p-0.5 text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
                          aria-label={lt("Remove")}
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      </span>
                    ))}
                  </div>

                  {reviewSubmitError ? (
                    <p className="mb-2 text-[0.75rem] text-[#ef4444]">{reviewSubmitError}</p>
                  ) : null}

                  <button
                    type="button"
                    disabled={reviewSubmitting || Boolean(editingReviewId)}
                    onClick={() => void submitClientReview()}
                    className="btn-primary mb-6 w-full rounded-[8px] py-2.5 text-sm font-light disabled:opacity-60"
                  >
                    {reviewSubmitting ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} aria-hidden />
                        {lt("Submitting…")}
                      </span>
                    ) : (
                      lt("Submit Review")
                    )}
                  </button>
                  </div>

                  <p className="section-title mb-2">{lt("Review history")}</p>
                  {taskReviewsLoading ? (
                    <p className="text-xs font-light text-[rgba(255,255,255,0.4)]">{lt("Loading")}</p>
                  ) : taskReviews.length === 0 ? (
                    <p className="text-xs font-light text-[rgba(255,255,255,0.4)]">{lt("No reviews yet")}</p>
                  ) : (
                    <ul className="space-y-4">
                      {taskReviews.map((rev) => {
                        const atts = Array.isArray(rev.task_review_attachments) ? rev.task_review_attachments : [];
                        const isMine = clientReviewAuthorMatches(rev.reviewer_name, currentUser.name || "");
                        const isEditing = editingReviewId === rev.id;
                        const visibleAtts = atts.filter((a) => !editReviewRemovedAttachmentIds.includes(a.id));
                        return (
                          <li
                            key={rev.id}
                            className="rounded-[8px] border border-[var(--border)] bg-[#161616] p-3"
                          >
                            <div className="flex w-full flex-wrap items-center gap-2">
                              <div
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[0.65rem] font-light text-white"
                                style={{ backgroundColor: `hsla(${commentAuthorHue(rev.reviewer_name)}, 35%, 32%, 1)` }}
                              >
                                {commentAuthorInitials(rev.reviewer_name)}
                              </div>
                              <span className="text-sm font-medium text-white">{rev.reviewer_name}</span>
                              {!isEditing ? reviewHistoryStatusBadge(rev.status, lt) : null}
                              <span className="mono-num text-[0.72rem] font-light text-[rgba(255,255,255,0.4)]">
                                {formatCommentTimestamp(rev.created_at)}
                              </span>
                              {isMine && !isEditing ? (
                                <div className="ml-auto flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingReviewId(rev.id);
                                      setEditReviewStatus(normalizeClientReviewDecision(rev.status) ?? "Approved");
                                      setEditReviewComment(rev.comment ?? "");
                                      setEditReviewNewFiles([]);
                                      setEditReviewRemovedAttachmentIds([]);
                                      setEditReviewError("");
                                      if (editReviewFileRef.current) editReviewFileRef.current.value = "";
                                    }}
                                    className="inline-flex items-center gap-1 rounded-[6px] border border-[var(--border)] px-2 py-1 text-[11px] font-light text-[rgba(255,255,255,0.75)] transition-colors hover:bg-[rgba(255,255,255,0.06)]"
                                  >
                                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                                    {lt("Edit")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setReviewDeleteDialog({ id: rev.id })}
                                    className="inline-flex items-center gap-1 rounded-[6px] border border-[rgba(239,68,68,0.35)] px-2 py-1 text-[11px] font-light text-[#fca5a5] transition-colors hover:bg-[rgba(239,68,68,0.1)]"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                                    {lt("Delete review")}
                                  </button>
                                </div>
                              ) : null}
                            </div>

                            {isEditing ? (
                              <div className="mt-4 border-t border-[var(--border)] pt-4">
                                <p className="mb-2 text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">
                                  {lt("Review status")}
                                </p>
                                <div className="mb-3 grid gap-2 sm:grid-cols-3">
                                  {(
                                    [
                                      { value: "Approved" as const, icon: Check, activeClass: "border-emerald-500/50 bg-emerald-600/25 text-emerald-100" },
                                      { value: "Needs Changes" as const, icon: AlertCircle, activeClass: "border-amber-500/50 bg-amber-600/20 text-amber-100" },
                                      { value: "Rejected" as const, icon: X, activeClass: "border-red-500/50 bg-red-600/25 text-red-100" },
                                    ] as const
                                  ).map(({ value, icon: ChipIcon, activeClass }) => {
                                    const selected = editReviewStatus === value;
                                    return (
                                      <button
                                        key={value}
                                        type="button"
                                        disabled={editReviewSubmitting}
                                        onClick={() => {
                                          setEditReviewStatus(value);
                                          setEditReviewError("");
                                        }}
                                        className={cn(
                                          "flex flex-col items-center gap-2 rounded-[10px] border px-3 py-3 text-center text-sm font-light transition-colors disabled:opacity-50",
                                          selected
                                            ? activeClass
                                            : "border-[var(--border)] bg-[#141414] text-[rgba(255,255,255,0.55)] hover:border-[rgba(255,255,255,0.2)]",
                                        )}
                                      >
                                        <ChipIcon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                                        {value === "Approved"
                                          ? lt("Approved")
                                          : value === "Needs Changes"
                                            ? lt("Needs Changes")
                                            : lt("Rejected")}
                                      </button>
                                    );
                                  })}
                                </div>
                                <textarea
                                  value={editReviewComment}
                                  onChange={(event) => setEditReviewComment(event.target.value)}
                                  rows={4}
                                  disabled={editReviewSubmitting}
                                  placeholder={lt("Add your review comment, feedback or meeting notes...")}
                                  className="mb-3 w-full resize-y rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white placeholder:text-[rgba(255,255,255,0.4)] disabled:opacity-50"
                                />
                                <input
                                  ref={editReviewFileRef}
                                  type="file"
                                  className="hidden"
                                  multiple
                                  disabled={editReviewSubmitting}
                                  onChange={(event) => {
                                    const list = event.target.files;
                                    if (!list?.length) return;
                                    setEditReviewNewFiles((prev) => [...prev, ...Array.from(list)]);
                                    event.target.value = "";
                                  }}
                                />
                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={editReviewSubmitting}
                                    onClick={() => editReviewFileRef.current?.click()}
                                    className="inline-flex items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[#141414] px-3 py-2 text-xs font-light text-white transition-colors hover:bg-[rgba(255,255,255,0.06)] disabled:opacity-50"
                                  >
                                    <Paperclip className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                                    {lt("Attach file")}
                                  </button>
                                  {editReviewNewFiles.map((file, idx) => (
                                    <span
                                      key={`${file.name}-e-${idx}`}
                                      className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--border)] bg-[#141414] py-1 pl-2.5 pr-1 text-[11px] font-light text-[rgba(255,255,255,0.85)]"
                                    >
                                      <span className="max-w-[160px] truncate">{file.name}</span>
                                      <button
                                        type="button"
                                        disabled={editReviewSubmitting}
                                        onClick={() => setEditReviewNewFiles((prev) => prev.filter((_, i) => i !== idx))}
                                        className="rounded-full p-0.5 text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
                                        aria-label={lt("Remove")}
                                      >
                                        <X className="h-3.5 w-3.5" strokeWidth={2} />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                                {visibleAtts.length > 0 ? (
                                  <div className="mb-3 space-y-2">
                                    {visibleAtts.map((att) => {
                                      const ta = reviewAttachmentRowToTaskAttachment(att);
                                      const Icon = attachmentKind(ta.type, ta.name);
                                      const pk = attachmentPreviewKind(ta);
                                      const expandHint = lt("Click for full view");
                                      return (
                                        <div
                                          key={att.id}
                                          className="overflow-hidden rounded-[8px] border border-[var(--border)] bg-[#141414]"
                                        >
                                          {pk !== "other" ? (
                                            <TaskAttachmentInlineVisual
                                              attachment={ta}
                                              onExpand={() => openTaskAttachmentPreview(ta)}
                                              expandHint={expandHint}
                                            />
                                          ) : null}
                                          <div className="flex items-center gap-2 px-2 py-2">
                                            <Icon className="h-4 w-4 shrink-0 text-[rgba(255,255,255,0.55)]" />
                                            <span className="min-w-0 flex-1 truncate text-sm font-light text-white" title={ta.name}>
                                              {ta.name}
                                            </span>
                                            <button
                                              type="button"
                                              disabled={editReviewSubmitting}
                                              onClick={() => openTaskAttachmentPreview(ta)}
                                              className="shrink-0 rounded-[6px] p-1.5 text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white disabled:opacity-50"
                                              aria-label={lt("Preview")}
                                            >
                                              <Eye className="h-4 w-4" strokeWidth={1.5} />
                                            </button>
                                            <button
                                              type="button"
                                              disabled={editReviewSubmitting}
                                              onClick={() => downloadTaskAttachment(ta)}
                                              className="shrink-0 rounded-[6px] p-1.5 text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white disabled:opacity-50"
                                              aria-label={lt("Download")}
                                            >
                                              <Download className="h-4 w-4" strokeWidth={1.5} />
                                            </button>
                                            <button
                                              type="button"
                                              disabled={editReviewSubmitting}
                                              onClick={() =>
                                                setEditReviewRemovedAttachmentIds((prev) =>
                                                  prev.includes(att.id) ? prev : [...prev, att.id],
                                                )
                                              }
                                              className="shrink-0 rounded-[6px] p-1.5 text-[rgba(255,255,255,0.45)] transition-colors hover:bg-[rgba(239,68,68,0.12)] hover:text-[#ef4444] disabled:opacity-50"
                                              aria-label={lt("Remove")}
                                            >
                                              <X className="h-4 w-4" strokeWidth={1.5} />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null}
                                {editReviewError ? (
                                  <p className="mb-2 text-[0.75rem] text-[#ef4444]">{editReviewError}</p>
                                ) : null}
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={editReviewSubmitting}
                                    onClick={() => void saveEditedReview()}
                                    className="btn-primary rounded-[8px] px-4 py-2 text-xs font-light disabled:opacity-60"
                                  >
                                    {editReviewSubmitting ? (
                                      <span className="inline-flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} aria-hidden />
                                        {lt("Submitting…")}
                                      </span>
                                    ) : (
                                      lt("Save changes")
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={editReviewSubmitting}
                                    onClick={cancelEditReview}
                                    className="rounded-[8px] border border-[var(--border)] bg-transparent px-4 py-2 text-xs font-light text-[rgba(255,255,255,0.65)] transition-colors hover:bg-[rgba(255,255,255,0.04)] disabled:opacity-50"
                                  >
                                    {lt("Cancel")}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {rev.comment?.trim() ? (
                                  <p className="mt-2 whitespace-pre-wrap text-sm font-light text-[rgba(255,255,255,0.85)]">
                                    {rev.comment}
                                  </p>
                                ) : null}
                                {atts.length > 0 ? (
                                  <div className="mt-3 space-y-2 border-t border-[var(--border)] pt-3">
                                    {atts.map((att) => {
                                      const ta = reviewAttachmentRowToTaskAttachment(att);
                                      const Icon = attachmentKind(ta.type, ta.name);
                                      const pk = attachmentPreviewKind(ta);
                                      const expandHint = lt("Click for full view");
                                      return (
                                        <div
                                          key={att.id}
                                          className="overflow-hidden rounded-[8px] border border-[var(--border)] bg-[#141414]"
                                        >
                                          {pk !== "other" ? (
                                            <TaskAttachmentInlineVisual
                                              attachment={ta}
                                              onExpand={() => openTaskAttachmentPreview(ta)}
                                              expandHint={expandHint}
                                            />
                                          ) : null}
                                          <div className="flex items-center gap-2 px-2 py-2">
                                            <Icon className="h-4 w-4 shrink-0 text-[rgba(255,255,255,0.55)]" />
                                            <span className="min-w-0 flex-1 truncate text-sm font-light text-white" title={ta.name}>
                                              {ta.name}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => openTaskAttachmentPreview(ta)}
                                              className="shrink-0 rounded-[6px] p-1.5 text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
                                              aria-label={lt("Preview")}
                                            >
                                              <Eye className="h-4 w-4" strokeWidth={1.5} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => downloadTaskAttachment(ta)}
                                              className="shrink-0 rounded-[6px] p-1.5 text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
                                              aria-label={lt("Download")}
                                            >
                                              <Download className="h-4 w-4" strokeWidth={1.5} />
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>

      {previewAttachment
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(0,0,0,0.9)] p-4"
              onClick={() => setPreviewAttachment(null)}
            >
              <div
                className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[#111]"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
                  <p className="min-w-0 flex-1 truncate text-sm font-light text-white">{previewAttachment.name}</p>
                  <button
                    type="button"
                    onClick={() => downloadTaskAttachment(previewAttachment)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-[6px] border border-[var(--border)] px-3 py-1.5 text-xs font-light text-white hover:bg-[rgba(255,255,255,0.06)]"
                  >
                    <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {lt("Download")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewAttachment(null)}
                    className="shrink-0 rounded-[6px] p-1.5 text-[rgba(255,255,255,0.55)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
                    aria-label={lt("Close preview")}
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
                <div className="flex min-h-[50vh] flex-1 items-center justify-center overflow-auto p-4">
                  {attachmentPreviewKind(previewAttachment) === "pdf" ? (
                    <iframe
                      title={previewAttachment.name}
                      src={previewAttachment.url}
                      className="h-[min(78vh,800px)] w-full rounded-[6px] border border-[var(--border)] bg-[#1a1a1a]"
                    />
                  ) : null}
                  {attachmentPreviewKind(previewAttachment) === "image" ? (
                    <img
                      src={previewAttachment.url}
                      alt={previewAttachment.name}
                      className="max-h-[78vh] max-w-full object-contain"
                    />
                  ) : null}
                  {attachmentPreviewKind(previewAttachment) === "video" ? (
                    <video src={previewAttachment.url} controls className="max-h-[78vh] max-w-full" />
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <PublishedToModal
        open={publishedToModal !== null}
        title={lt("Where was this published?")}
        subtitle={lt("Select all platforms where this content was published")}
        addPlatformLabel={lt("+ Add platform")}
        addEntryLabel={lt("Add")}
        customPlaceholder={lt("Platform name")}
        confirmLabel={lt("Confirm")}
        skipLabel={lt("Skip — mark as published without specifying")}
        collectPublishedTimestamp
        onConfirm={(payload) => {
          void handlePublishedToConfirm(payload);
        }}
        onSkip={handlePublishedToSkip}
        onClose={handlePublishedToSkip}
      />

      <DeleteConfirmModal
        open={taskDeleteDialog !== null}
        title={lt("Delete Task")}
        message={
          taskDeleteDialog
            ? lt("Delete {name}? This action cannot be undone.").replace("{name}", taskDeleteDialog.name)
            : ""
        }
        confirmLabel={lt("Delete")}
        cancelLabel={lt("Cancel")}
        onCancel={() => setTaskDeleteDialog(null)}
        onConfirm={() => {
          void confirmDeleteTask();
        }}
      />

      <DeleteConfirmModal
        open={reviewDeleteDialog !== null}
        title={lt("Delete review")}
        message={lt("Delete this review? This cannot be undone.")}
        confirmLabel={lt("Delete")}
        cancelLabel={lt("Cancel")}
        onCancel={() => setReviewDeleteDialog(null)}
        onConfirm={() => {
          void confirmDeleteClientReview();
        }}
      />
    </div>
  );
}
