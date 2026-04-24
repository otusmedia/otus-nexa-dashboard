"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { Download, Eye, File, FileImage, FileText, FileVideo, MoreHorizontal, Trash2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { ModuleGuard } from "@/components/layout/module-guard";
import { useAppContext } from "@/components/providers/app-providers";
import { Card } from "@/components/ui/card";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { PublishedToModal } from "@/components/ui/published-to-modal";
import { PageHeader } from "@/components/ui/page-header";
import { useLanguage } from "@/context/language-context";
import { supabase } from "@/lib/supabase";
import { MarketingAccessGuard } from "../_components/marketing-access-guard";
import { PublishedPlatformIconRow, TaskRowStatusBadge } from "@/app/(platform)/projects/_components/task-row-status-badge";

type MarketingColumnId = "planning" | "in_progress" | "paused" | "done" | "cancelled";
type MarketingTaskStatus = "Not Started" | "In Progress" | "Waiting for Approval" | "Done" | "Scheduled" | "Published";
type MarketingTaskPriority = "Low" | "Medium" | "High" | "Urgent";

type TaskAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  storagePath: string;
};

type MarketingTask = {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: MarketingTaskStatus;
  priority: MarketingTaskPriority;
  owner: string;
  dueDate: string | null;
  isFeatured: boolean;
  coverImage: string | null;
  shortDescription: string;
  reminderAt: string | null;
  reminderNote: string;
  attachments: TaskAttachment[];
  publishedTo: string[];
};

type MarketingProject = {
  id: string;
  name: string;
  type: string;
  status: string;
  column: MarketingColumnId;
  progress: number;
  budget: number;
  budgetUsed: number;
  results: number;
  impressions: number;
  clicks: number;
  owner: string;
  startDate: string | null;
  endDate: string | null;
  description: string;
  tags: string[];
  attachments: Array<{ id: string; name: string; size: number; type: string }>;
  metaCampaignId: string | null;
  lastSyncedAt: string | null;
};

type MetaAdsCampaignOption = {
  id: string;
  name: string;
  status?: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
};

const COLUMNS: Array<{ id: MarketingColumnId; label: string }> = [
  { id: "planning", label: "Planning" },
  { id: "in_progress", label: "In Progress" },
  { id: "paused", label: "Paused" },
  { id: "done", label: "Done" },
  { id: "cancelled", label: "Cancelled" },
];

const COLUMN_DOT_CLASS: Record<MarketingColumnId, string> = {
  planning: "bg-[#f59e0b]",
  in_progress: "bg-[#3b82f6]",
  paused: "bg-[#a855f7]",
  done: "bg-[#22c55e]",
  cancelled: "bg-[#ef4444]",
};

const STATUS_BY_COLUMN: Record<MarketingColumnId, string> = {
  planning: "Planning",
  in_progress: "In Progress",
  paused: "Paused",
  done: "Done",
  cancelled: "Cancelled",
};

const PROJECT_TYPES = ["Paid Search", "Paid Social", "Display", "Content", "Offline", "Other"] as const;
const PROJECT_OWNERS = ["Matheus Foletto", "Lucas Rocha", "David Martins", "Matheus Canci"] as const;
const TASK_STATUSES: MarketingTaskStatus[] = ["Not Started", "In Progress", "Waiting for Approval", "Done", "Scheduled", "Published"];
const TASK_PRIORITIES: MarketingTaskPriority[] = ["Low", "Medium", "High", "Urgent"];

function toColumn(status: string | null | undefined): MarketingColumnId {
  const s = String(status ?? "").toLowerCase();
  if (s === "in progress") return "in_progress";
  if (s === "paused") return "paused";
  if (s === "done") return "done";
  if (s === "cancelled") return "cancelled";
  return "planning";
}

function computeMarketingProgress(taskList: MarketingTask[]): number {
  if (taskList.length === 0) return 0;
  const completed = taskList.filter((t) => t.status === "Done" || t.status === "Published").length;
  return Math.round((completed / taskList.length) * 100);
}

function getTaskAttachmentStoragePathFromUrl(url: string): string {
  const marker = "/storage/v1/object/public/task-attachments/";
  const idx = url.indexOf(marker);
  if (idx === -1) return "";
  return decodeURIComponent(url.slice(idx + marker.length));
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

function taskAttachmentKind(attachment: TaskAttachment): "pdf" | "image" | "video" | "other" {
  const type = attachment.type.toLowerCase();
  const ext = attachment.name.split(".").pop()?.toLowerCase() ?? "";
  if (type.includes("pdf") || ext === "pdf") return "pdf";
  if (type.startsWith("image/") || ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return "image";
  if (type.startsWith("video/") || ["mp4", "mov", "webm"].includes(ext)) return "video";
  return "other";
}

function formatAttachmentSize(size: number): string {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${size} B`;
}

function marketingTaskFromRow(row: Record<string, unknown>): MarketingTask {
  return {
    id: String(row.id ?? ""),
    projectId: String(row.project_id ?? ""),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    status: TASK_STATUSES.includes(String(row.status ?? "") as MarketingTaskStatus)
      ? (String(row.status) as MarketingTaskStatus)
      : "Not Started",
    priority: TASK_PRIORITIES.includes(String(row.priority ?? "") as MarketingTaskPriority)
      ? (String(row.priority) as MarketingTaskPriority)
      : "Medium",
    owner: String(row.assigned_to ?? ""),
    dueDate: row.due_date ? String(row.due_date) : null,
    isFeatured: Boolean(row.is_featured),
    coverImage: row.cover_image ? String(row.cover_image) : null,
    shortDescription: String(row.short_description ?? ""),
    reminderAt: row.reminder_at ? String(row.reminder_at) : null,
    reminderNote: String(row.reminder_note ?? ""),
    attachments: [],
    publishedTo: Array.isArray(row.published_to) ? row.published_to.map(String) : [],
  };
}

function progressForCampaign(campaignId: string, allTasks: MarketingTask[]): number {
  return computeMarketingProgress(allTasks.filter((t) => t.projectId === campaignId));
}

function marketingTaskPatchToDb(patch: Partial<MarketingTask>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (patch.title !== undefined) o.title = patch.title;
  if (patch.description !== undefined) o.description = patch.description;
  if (patch.status !== undefined) o.status = patch.status;
  if (patch.priority !== undefined) o.priority = patch.priority;
  if (patch.owner !== undefined) o.assigned_to = patch.owner;
  if (patch.dueDate !== undefined) o.due_date = patch.dueDate;
  if (patch.isFeatured !== undefined) o.is_featured = patch.isFeatured;
  if (patch.coverImage !== undefined) o.cover_image = patch.coverImage;
  if (patch.shortDescription !== undefined) o.short_description = patch.shortDescription;
  if (patch.reminderAt !== undefined) o.reminder_at = patch.reminderAt;
  if (patch.reminderNote !== undefined) o.reminder_note = patch.reminderNote;
  if (patch.publishedTo !== undefined) o.published_to = patch.publishedTo;
  return o;
}

function marketingProjectFromRow(row: Record<string, unknown>): MarketingProject {
  const statusStr = String(row.status ?? "Planning");
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    type: String(row.type ?? "Other"),
    status: statusStr,
    column: toColumn(statusStr),
    progress: Number(row.progress ?? 0) || 0,
    budget: Number(row.budget ?? 0) || 0,
    budgetUsed: Number(row.budget_used ?? 0) || 0,
    results: Number(row.results ?? 0) || 0,
    impressions: Number(row.impressions ?? 0) || 0,
    clicks: Number(row.clicks ?? 0) || 0,
    owner: String(row.owner ?? ""),
    startDate: row.campaign_period_start ? String(row.campaign_period_start) : row.start_date ? String(row.start_date) : null,
    endDate: row.campaign_period_end ? String(row.campaign_period_end) : row.end_date ? String(row.end_date) : null,
    description: String(row.description ?? ""),
    tags: Array.isArray(row.tags) ? row.tags.map((item) => String(item)) : [],
    attachments: [],
    metaCampaignId: row.meta_campaign_id != null && String(row.meta_campaign_id) !== "" ? String(row.meta_campaign_id) : null,
    lastSyncedAt: row.last_synced_at != null ? String(row.last_synced_at) : null,
  };
}

function marketingPatchToDb(patch: Partial<MarketingProject>): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  if (patch.name !== undefined) o.name = patch.name;
  if (patch.type !== undefined) o.type = patch.type;
  if (patch.status !== undefined) o.status = patch.status;
  if (patch.owner !== undefined) o.owner = patch.owner;
  if (patch.progress !== undefined) o.progress = patch.progress;
  if (patch.budget !== undefined) o.budget = patch.budget;
  if (patch.budgetUsed !== undefined) o.budget_used = patch.budgetUsed;
  if (patch.results !== undefined) o.results = patch.results;
  if (patch.impressions !== undefined) o.impressions = patch.impressions;
  if (patch.clicks !== undefined) o.clicks = patch.clicks;
  if (patch.startDate !== undefined) {
    o.start_date = patch.startDate;
    o.campaign_period_start = patch.startDate;
  }
  if (patch.endDate !== undefined) {
    o.end_date = patch.endDate;
    o.campaign_period_end = patch.endDate;
  }
  if (patch.description !== undefined) o.description = patch.description;
  if (patch.tags !== undefined) o.tags = patch.tags;
  if (patch.metaCampaignId !== undefined) o.meta_campaign_id = patch.metaCampaignId;
  return o;
}

function formatMetaCampaignBudget(c: MetaAdsCampaignOption): string {
  const life = c.lifetime_budget != null && c.lifetime_budget !== "" ? Number(c.lifetime_budget) / 100 : NaN;
  const daily = c.daily_budget != null && c.daily_budget !== "" ? Number(c.daily_budget) / 100 : NaN;
  if (Number.isFinite(life) && life > 0) {
    return `Lifetime ${life.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`;
  }
  if (Number.isFinite(daily) && daily > 0) {
    return `Daily ${daily.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`;
  }
  return "—";
}

export default function MarketingProjectsPage() {
  const { t, currentUser, logTaskPublishedToActivity } = useAppContext();
  const { t: lt } = useLanguage();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<MarketingProject[]>([]);
  const [tasks, setTasks] = useState<MarketingTask[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [targetColumn, setTargetColumn] = useState<MarketingColumnId>("planning");
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectType, setNewProjectType] = useState<(typeof PROJECT_TYPES)[number]>("Paid Search");
  const [newProjectOwner, setNewProjectOwner] = useState<(typeof PROJECT_OWNERS)[number]>("Matheus Foletto");
  const [newProjectStartDate, setNewProjectStartDate] = useState("");
  const [newProjectEndDate, setNewProjectEndDate] = useState("");
  const [newProjectBudget, setNewProjectBudget] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectError, setNewProjectError] = useState("");
  const [newProjectSubmitError, setNewProjectSubmitError] = useState("");

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskOwner, setNewTaskOwner] = useState<(typeof PROJECT_OWNERS)[number]>("Matheus Foletto");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskStatus, setNewTaskStatus] = useState<MarketingTaskStatus>("Not Started");
  const [newTaskPriority, setNewTaskPriority] = useState<MarketingTaskPriority>("Medium");
  const [newTaskReminderEnabled, setNewTaskReminderEnabled] = useState(false);
  const [newTaskReminderDate, setNewTaskReminderDate] = useState("");
  const [newTaskReminderTime, setNewTaskReminderTime] = useState("");
  const [newTaskReminderNote, setNewTaskReminderNote] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [taskModalError, setTaskModalError] = useState("");

  const [tagInput, setTagInput] = useState("");
  const [campaignMenuOpenId, setCampaignMenuOpenId] = useState<string | null>(null);
  const campaignMenuRef = useRef<HTMLDivElement>(null);
  const [campaignDelete, setCampaignDelete] = useState<{ id: string; name: string } | null>(null);
  const [marketingTaskDelete, setMarketingTaskDelete] = useState<{ id: string; name: string } | null>(null);
  const [campaignDescriptionDraft, setCampaignDescriptionDraft] = useState("");
  const [campaignDescriptionSaved, setCampaignDescriptionSaved] = useState("");
  const [campaignDescriptionSavedHint, setCampaignDescriptionSavedHint] = useState(false);
  const [campaignDescriptionError, setCampaignDescriptionError] = useState("");
  const [campaignTitleDraft, setCampaignTitleDraft] = useState("");
  const [metaCampaignOptions, setMetaCampaignOptions] = useState<MetaAdsCampaignOption[]>([]);
  const [metaCampaignsLoading, setMetaCampaignsLoading] = useState(false);
  const [metaCampaignsError, setMetaCampaignsError] = useState("");
  const [metaSyncError, setMetaSyncError] = useState("");
  const [metaSyncing, setMetaSyncing] = useState(false);
  const [taskAttachmentError, setTaskAttachmentError] = useState("");
  const [taskAttachmentUploading, setTaskAttachmentUploading] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<TaskAttachment | null>(null);
  const [publishedToModal, setPublishedToModal] = useState<{ taskId: string; taskName: string } | null>(null);

  const persistMarketingProject = useCallback(async (projectId: string, dbPayload: Record<string, unknown>) => {
    const keys = Object.keys(dbPayload);
    if (keys.length === 0) return true;
    console.log("[marketing/campaigns] persistMarketingProject", projectId, dbPayload);
    const { data, error } = await supabase.from("marketing_projects").update(dbPayload).eq("id", projectId).select("*").single();
    if (error) {
      console.error("[marketing/campaigns] persist failed:", error.message);
      return false;
    }
    console.log("[marketing/campaigns] persist success:", data);
    const updated = marketingProjectFromRow((data as Record<string, unknown>) ?? {});
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...updated, attachments: p.attachments } : p)),
    );
    return true;
  }, []);

  useEffect(() => {
    let mounted = true;
    console.log("[marketing/campaigns] fetch start: marketing_projects + marketing_tasks");
    void Promise.all([
      supabase.from("marketing_projects").select("*").order("created_at", { ascending: false }),
      supabase.from("marketing_tasks").select("*").order("created_at", { ascending: true }),
    ])
      .then(([projectsRes, tasksRes]) => {
        if (!mounted) return;
        console.log("[marketing/campaigns] fetch result:", {
          projectsError: projectsRes.error?.message ?? null,
          tasksError: tasksRes.error?.message ?? null,
          projectsCount: projectsRes.data?.length ?? 0,
          tasksCount: tasksRes.data?.length ?? 0,
        });
        if (projectsRes.error) console.error("[supabase] marketing_projects fetch failed:", projectsRes.error.message);
        if (tasksRes.error) console.error("[supabase] marketing_tasks fetch failed:", tasksRes.error.message);
        setProjects(
          ((projectsRes.data as Array<Record<string, unknown>> | null) ?? []).map((row) => marketingProjectFromRow(row)),
        );
        setTasks(((tasksRes.data as Array<Record<string, unknown>> | null) ?? []).map((row) => marketingTaskFromRow(row)));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!campaignMenuOpenId) campaignMenuRef.current = null;
  }, [campaignMenuOpenId]);

  useEffect(() => {
    if (!campaignMenuOpenId) return;
    const onDoc = (e: MouseEvent) => {
      if (campaignMenuRef.current?.contains(e.target as Node)) return;
      setCampaignMenuOpenId(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [campaignMenuOpenId]);

  useEffect(() => {
    const campaignId = searchParams.get("campaignId");
    const taskId = searchParams.get("taskId");
    if (campaignId && projects.some((campaign) => campaign.id === campaignId)) {
      setActiveProjectId(campaignId);
    }
    if (taskId) setActiveTaskId(taskId);
  }, [searchParams, projects]);

  useEffect(() => {
    if (!activeProjectId) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("marketing_tasks")
        .select("*")
        .eq("project_id", activeProjectId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error("[marketing/campaigns] marketing_tasks panel fetch failed:", error.message);
        return;
      }
      const mapped = ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => marketingTaskFromRow(row));
      setTasks((prev) => {
        const rest = prev.filter((t) => t.projectId !== activeProjectId);
        return [...rest, ...mapped];
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  const projectsByColumn = useMemo(
    () =>
      COLUMNS.reduce(
        (acc, c) => {
          acc[c.id] = projects.filter((project) => project.column === c.id);
          return acc;
        },
        {} as Record<MarketingColumnId, MarketingProject[]>,
      ),
    [projects],
  );
  const projectCount = useMemo(
    () => Object.values(projectsByColumn).reduce((total, list) => total + list.length, 0),
    [projectsByColumn],
  );

  const kanbanCampaignProgressPct = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of projects) {
      map.set(p.id, progressForCampaign(p.id, tasks));
    }
    return map;
  }, [projects, tasks]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );
  const projectTasks = useMemo(
    () => (activeProject ? tasks.filter((task) => task.projectId === activeProject.id) : []),
    [activeProject, tasks],
  );
  const activeTask = useMemo(
    () => projectTasks.find((task) => task.id === activeTaskId) ?? null,
    [projectTasks, activeTaskId],
  );

  useEffect(() => {
    if (!activeTaskId) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("task_attachments")
        .select("*")
        .eq("task_id", activeTaskId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error("[marketing/campaigns] task_attachments fetch failed:", error.message);
        setTaskAttachmentError("Failed to load task attachments.");
        return;
      }
      setTaskAttachmentError("");
      const attachments = ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => taskAttachmentFromRow(row));
      setTasks((prev) => prev.map((task) => (task.id === activeTaskId ? { ...task, attachments } : task)));
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTaskId]);

  useEffect(() => {
    if (!previewAttachment) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewAttachment(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewAttachment]);

  useEffect(() => {
    if (!activeProject) {
      setCampaignDescriptionDraft("");
      setCampaignDescriptionSaved("");
      setCampaignDescriptionSavedHint(false);
      setCampaignDescriptionError("");
      return;
    }
    setCampaignDescriptionDraft(activeProject.description);
    setCampaignDescriptionSaved(activeProject.description);
    setCampaignDescriptionSavedHint(false);
    setCampaignDescriptionError("");
  }, [activeProject?.id, activeProject?.description]);

  const openProjectModal = (columnId: MarketingColumnId) => {
    setTargetColumn(columnId);
    setProjectModalOpen(true);
    setNewProjectName("");
    setNewProjectType("Paid Search");
    setNewProjectOwner("Matheus Foletto");
    setNewProjectStartDate("");
    setNewProjectEndDate("");
    setNewProjectBudget("");
    setNewProjectDescription("");
    setNewProjectError("");
    setNewProjectSubmitError("");
  };

  const addCampaign = async () => {
    const name = newProjectName.trim();
    if (!name) {
      setNewProjectError("Campaign name is required.");
      return false;
    }
    setNewProjectError("");
    setNewProjectSubmitError("");
    const payload = {
      id: crypto.randomUUID(),
      name,
      type: newProjectType,
      status: STATUS_BY_COLUMN[targetColumn],
      progress: 0,
      budget: Number(newProjectBudget) || 0,
      budget_used: 0,
      results: 0,
      impressions: 0,
      clicks: 0,
      owner: newProjectOwner,
      start_date: newProjectStartDate || null,
      end_date: newProjectEndDate || null,
      campaign_period_start: newProjectStartDate || null,
      campaign_period_end: newProjectEndDate || null,
      description: newProjectDescription.trim(),
      tags: [],
    };
    console.log("[marketing/campaigns] insert start:", payload);
    const { data, error } = await supabase
      .from("marketing_projects")
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[supabase] marketing_projects insert failed:", error.message);
      setNewProjectSubmitError("Failed to save campaign to Supabase. Please try again.");
      return false;
    }
    console.log("[marketing/campaigns] insert success:", data);
    const row = (data as Record<string, unknown>) ?? {};
    const nextCampaign = marketingProjectFromRow({ ...row, id: row.id ?? payload.id });
    setProjects((prev) => [nextCampaign, ...prev]);
    return true;
  };

  const createProject = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await addCampaign();
    if (ok) setProjectModalOpen(false);
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const sourceColumn = source.droppableId as MarketingColumnId;
    const destinationColumn = destination.droppableId as MarketingColumnId;
    const nextByColumn: Record<MarketingColumnId, MarketingProject[]> = {
      planning: [...projectsByColumn.planning],
      in_progress: [...projectsByColumn.in_progress],
      paused: [...projectsByColumn.paused],
      done: [...projectsByColumn.done],
      cancelled: [...projectsByColumn.cancelled],
    };
    const [movedCampaign] = nextByColumn[sourceColumn].splice(source.index, 1);
    if (!movedCampaign || movedCampaign.id !== draggableId) return;
    const newStatus = STATUS_BY_COLUMN[destinationColumn];
    console.log("[marketing/campaigns] drag-drop status update", movedCampaign.id, newStatus);
    const { error } = await supabase.from("marketing_projects").update({ status: newStatus }).eq("id", movedCampaign.id);
    if (error) {
      console.error("[marketing/campaigns] drag-drop update failed:", error.message);
      return;
    }
    console.log("[marketing/campaigns] drag-drop update success:", movedCampaign.id);
    const nextMoved = {
      ...movedCampaign,
      column: destinationColumn,
      status: newStatus,
    };
    nextByColumn[destinationColumn].splice(destination.index, 0, nextMoved);
    setProjects([
      ...nextByColumn.planning,
      ...nextByColumn.in_progress,
      ...nextByColumn.paused,
      ...nextByColumn.done,
      ...nextByColumn.cancelled,
    ]);
  };

  const updateProjectAttachments = (projectId: string, attachments: MarketingProject["attachments"]) => {
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, attachments } : p)));
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

  const openTaskAttachment = (attachment: TaskAttachment) => {
    if (taskAttachmentKind(attachment) === "other") {
      downloadTaskAttachment(attachment);
      return;
    }
    setPreviewAttachment(attachment);
  };

  const uploadTaskAttachments = async (taskId: string, files: File[]) => {
    if (files.length === 0) return;
    setTaskAttachmentUploading(true);
    setTaskAttachmentError("");
    const uploaded: TaskAttachment[] = [];
    for (const file of files) {
      const filePath = `${taskId}/${Date.now()}-${file.name}`;
      const { data: storageData, error: storageError } = await supabase.storage
        .from("task-attachments")
        .upload(filePath, file, { cacheControl: "3600", upsert: false });
      if (storageError || !storageData?.path) {
        console.error("[marketing/campaigns] task attachment upload failed:", storageError?.message);
        setTaskAttachmentError(storageError?.message || "Failed to upload attachment.");
        continue;
      }
      const { data: urlData } = supabase.storage.from("task-attachments").getPublicUrl(storageData.path);
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
      if (insertError) {
        console.error("[marketing/campaigns] task_attachments insert failed:", insertError.message);
        setTaskAttachmentError(insertError.message || "Failed to save attachment metadata.");
        await supabase.storage.from("task-attachments").remove([storageData.path]);
        continue;
      }
      uploaded.push(taskAttachmentFromRow((row as Record<string, unknown>) ?? {}));
    }
    if (uploaded.length > 0) {
      setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, attachments: [...task.attachments, ...uploaded] } : task)));
    }
    setTaskAttachmentUploading(false);
  };

  const deleteTaskAttachment = async (taskId: string, attachment: TaskAttachment) => {
    setTaskAttachmentError("");
    if (attachment.storagePath) {
      const { error: storageError } = await supabase.storage.from("task-attachments").remove([attachment.storagePath]);
      if (storageError) {
        console.error("[marketing/campaigns] task attachment storage delete failed:", storageError.message);
        setTaskAttachmentError(storageError.message || "Failed to delete attachment from storage.");
        return;
      }
    }
    const { error } = await supabase.from("task_attachments").delete().eq("id", attachment.id);
    if (error) {
      console.error("[marketing/campaigns] task_attachments delete failed:", error.message);
      setTaskAttachmentError(error.message || "Failed to delete attachment metadata.");
      return;
    }
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? { ...task, attachments: task.attachments.filter((item) => item.id !== attachment.id) } : task,
      ),
    );
  };

  const updateTask = async (taskId: string, patch: Partial<MarketingTask>) => {
    const existing = tasks.find((t) => t.id === taskId);
    if (!existing) return false;

    const dbPayload = marketingTaskPatchToDb(patch);
    if (Object.keys(dbPayload).length === 0) {
      setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...patch } : task)));
      return true;
    }

    const prevTasks = tasks;
    const merged: MarketingTask = { ...existing, ...patch };
    const nextTasks = tasks.map((t) => (t.id === taskId ? merged : t));
    setTasks(nextTasks);

    const { error } = await supabase.from("marketing_tasks").update(dbPayload).eq("id", taskId);
    if (error) {
      console.error("[marketing/campaigns] marketing_tasks update failed:", error.message);
      setTasks(prevTasks);
      return false;
    }

    if (patch.status !== undefined) {
      const prog = progressForCampaign(merged.projectId, nextTasks);
      await persistMarketingProject(merged.projectId, { progress: prog });
    }
    return true;
  };

  const handleMarketingTaskStatusSelect = async (taskId: string, next: MarketingTaskStatus) => {
    if (next === "Published") {
      const row = tasks.find((x) => x.id === taskId);
      const ok = await updateTask(taskId, { status: "Published" });
      if (!ok) return;
      setPublishedToModal({ taskId, taskName: row?.title ?? "" });
      return;
    }
    void updateTask(taskId, { status: next });
  };

  const handleMarketingPublishedToConfirm = async (platforms: string[]) => {
    if (!publishedToModal) return;
    await updateTask(publishedToModal.taskId, { publishedTo: platforms });
    if (platforms.length > 0) {
      logTaskPublishedToActivity({
        userName: currentUser.name.trim() || "User",
        taskName: publishedToModal.taskName,
        platforms,
      });
    }
    setPublishedToModal(null);
  };

  const handleMarketingPublishedToSkip = () => {
    setPublishedToModal(null);
  };

  const createTask = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeProject || !newTaskTitle.trim()) return;
    const reminderAt =
      newTaskReminderEnabled && newTaskReminderDate && newTaskReminderTime
        ? new Date(`${newTaskReminderDate}T${newTaskReminderTime}:00`).toISOString()
        : null;
    const title = newTaskTitle.trim();
    const description = newTaskDescription.trim();
    const dueDate = newTaskDueDate || null;
    const reminderNote = newTaskReminderEnabled ? newTaskReminderNote.trim() : "";

    const insertRow = {
      project_id: activeProject.id,
      title,
      status: newTaskStatus,
      assigned_to: newTaskOwner,
      due_date: dueDate,
      priority: newTaskPriority,
      description,
      is_featured: false,
      short_description: "",
      reminder_at: reminderAt,
      reminder_note: newTaskReminderEnabled ? reminderNote || null : null,
    };

    const { data, error } = await supabase.from("marketing_tasks").insert([insertRow]).select().single();
    if (error) {
      console.error("[marketing/campaigns] marketing_tasks insert failed:", error.message);
      setTaskModalError(error.message || "Failed to save task. Please try again.");
      return;
    }

    setTaskModalError("");
    const mapped = marketingTaskFromRow((data as Record<string, unknown>) ?? {});
    const nextTasks = [...tasks, mapped];
    setTasks(nextTasks);
    const prog = progressForCampaign(activeProject.id, nextTasks);
    await persistMarketingProject(activeProject.id, { progress: prog });

    setTaskModalOpen(false);
    setNewTaskTitle("");
    setNewTaskOwner("Matheus Foletto");
    setNewTaskDueDate("");
    setNewTaskStatus("Not Started");
    setNewTaskPriority("Medium");
    setNewTaskReminderEnabled(false);
    setNewTaskReminderDate("");
    setNewTaskReminderTime("");
    setNewTaskReminderNote("");
    setNewTaskDescription("");
  };

  const addTag = async () => {
    if (!activeProject) return;
    const nextTag = tagInput.trim();
    if (!nextTag) return;
    const next = Array.from(new Set([...activeProject.tags, nextTag]));
    setTagInput("");
    console.log("[marketing/campaigns] addTag save", activeProject.id, next);
    const ok = await persistMarketingProject(activeProject.id, { tags: next });
    if (!ok) console.error("[marketing/campaigns] addTag persist failed");
  };

  const removeTag = async (value: string) => {
    if (!activeProject) return;
    const next = activeProject.tags.filter((tag) => tag !== value);
    console.log("[marketing/campaigns] removeTag save", activeProject.id, next);
    const ok = await persistMarketingProject(activeProject.id, { tags: next });
    if (!ok) console.error("[marketing/campaigns] removeTag persist failed");
  };

  const saveCampaignDescription = async () => {
    if (!activeProject) return;
    setCampaignDescriptionError("");
    console.log("[marketing/campaigns] saveCampaignDescription", activeProject.id);
    const ok = await persistMarketingProject(activeProject.id, { description: campaignDescriptionDraft });
    if (!ok) {
      setCampaignDescriptionError("Failed to save. Try again.");
      return;
    }
    setCampaignDescriptionSaved(campaignDescriptionDraft);
    setCampaignDescriptionSavedHint(true);
    window.setTimeout(() => setCampaignDescriptionSavedHint(false), 2000);
  };

  const confirmDeleteCampaign = () => {
    if (!campaignDelete) return;
    const { id } = campaignDelete;
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setTasks((prev) => prev.filter((t) => t.projectId !== id));
    if (activeProjectId === id) setActiveProjectId(null);
    void supabase
      .from("marketing_projects")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.error("[supabase] marketing_projects delete failed:", error.message);
      });
    setCampaignDelete(null);
  };

  const confirmDeleteMarketingTask = async () => {
    if (!marketingTaskDelete) return;
    const { id: taskId } = marketingTaskDelete;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      setMarketingTaskDelete(null);
      return;
    }
    const projectId = task.projectId;
    const remaining = tasks.filter((t) => t.projectId === projectId && t.id !== taskId);
    const progress = computeMarketingProgress(remaining);
    const { error: delErr } = await supabase.from("marketing_tasks").delete().eq("id", taskId);
    if (delErr) {
      console.error("[marketing/campaigns] marketing_tasks delete failed:", delErr.message);
      setMarketingTaskDelete(null);
      return;
    }
    console.log("[marketing/campaigns] task deleted, updating campaign progress", projectId, progress);
    await persistMarketingProject(projectId, { progress });
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (activeTaskId === taskId) setActiveTaskId(null);
    setMarketingTaskDelete(null);
  };

  const syncMetricsFromMeta = async () => {
    if (!activeProject?.metaCampaignId) return;
    setMetaSyncError("");
    setMetaSyncing(true);
    console.log("[marketing/campaigns] sync Metrics from Meta", activeProject.metaCampaignId);
    try {
      const params = new URLSearchParams({ campaign_id: activeProject.metaCampaignId, date_preset: "last_30d" });
      const res = await fetch(`/api/meta-ads?${params.toString()}`);
      const json = (await res.json()) as {
        error?: string;
        campaigns?: Array<{
          amountSpent: number;
          impressions: number;
          clicks: number;
          results: number;
        }>;
      };
      if (!res.ok || json.error) {
        setMetaSyncError(json.error ?? `Request failed (${res.status})`);
        return;
      }
      const c = json.campaigns?.[0];
      if (!c) {
        setMetaSyncError("No insights data for this campaign in the selected period.");
        return;
      }
      const lastSyncedAt = new Date().toISOString();
      console.log("[marketing/campaigns] sync metrics payload", c);
      const ok = await persistMarketingProject(activeProject.id, {
        budget_used: c.amountSpent,
        impressions: c.impressions,
        clicks: c.clicks,
        results: c.results,
        last_synced_at: lastSyncedAt,
      });
      if (!ok) setMetaSyncError("Could not save synced metrics.");
    } catch (e) {
      console.error("[marketing/campaigns] sync metrics error:", e);
      setMetaSyncError("Failed to fetch metrics from Meta.");
    } finally {
      setMetaSyncing(false);
    }
  };

  useEffect(() => {
    if (!activeProject) {
      setCampaignTitleDraft("");
      return;
    }
    setCampaignTitleDraft(activeProject.name);
  }, [activeProject?.id, activeProject?.name]);

  useEffect(() => {
    if (!activeProjectId) {
      setMetaCampaignOptions([]);
      setMetaCampaignsError("");
      return;
    }
    let cancelled = false;
    setMetaCampaignsLoading(true);
    setMetaCampaignsError("");
    console.log("[marketing/campaigns] fetch Meta campaigns list for detail panel");
    void fetch("/api/meta-ads-campaigns")
      .then((r) => r.json())
      .then((data: { campaigns?: MetaAdsCampaignOption[]; error?: string }) => {
        if (cancelled) return;
        if (data.error) setMetaCampaignsError(data.error);
        else setMetaCampaignOptions(Array.isArray(data.campaigns) ? data.campaigns : []);
      })
      .catch(() => {
        if (!cancelled) setMetaCampaignsError("Failed to load Meta campaigns");
      })
      .finally(() => {
        if (!cancelled) setMetaCampaignsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  return (
    <ModuleGuard module="marketing">
      <MarketingAccessGuard>
        <PageHeader title={t("marketing")} subtitle={lt("Marketing campaigns board and execution tasks.")} />
        <div className="w-full min-w-0 overflow-x-auto">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="mb-3 px-1 text-xs font-light text-[rgba(255,255,255,0.4)]">
              {projectCount} {lt("campaigns")}
            </div>
            <div className="h-[80vh] w-max overflow-hidden">
              <div className="flex h-full min-h-0 w-max flex-row gap-4 px-1 pb-4">
                {COLUMNS.map((column) => (
                  <div key={column.id} className="flex h-full min-h-0 min-w-[280px] shrink-0 flex-col">
                    <div className="mb-2 flex shrink-0 items-center gap-2 px-0.5">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${COLUMN_DOT_CLASS[column.id]}`} aria-hidden />
                      <h2 className="text-[0.7rem] font-normal uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">
                        {lt(column.label)}
                      </h2>
                    </div>
                    <Droppable droppableId={column.id}>
                      {(dropProvided, dropSnapshot) => (
                        <div
                          ref={dropProvided.innerRef}
                          {...dropProvided.droppableProps}
                          className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-2 pr-1 transition-colors"
                        >
                          {projectsByColumn[column.id].map((project, index) => (
                            <Draggable key={project.id} draggableId={project.id} index={index}>
                              {(dragProvided) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                  className={dropSnapshot.isDraggingOver ? "rounded-[8px] border border-[#ff4500]/20 p-0.5" : ""}
                                >
                                  <div className="group relative w-full rounded-[8px] border border-[var(--border)] bg-[#161616]">
                                    <div
                                      className="pointer-events-none absolute right-1.5 top-1.5 z-20 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100"
                                      ref={(el) => {
                                        if (campaignMenuOpenId === project.id) campaignMenuRef.current = el;
                                      }}
                                    >
                                      <button
                                        type="button"
                                        aria-expanded={campaignMenuOpenId === project.id}
                                        aria-haspopup="menu"
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setCampaignMenuOpenId((prev) => (prev === project.id ? null : project.id));
                                        }}
                                        className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-[rgba(255,255,255,0.12)] bg-[#1a1a1a] text-[rgba(255,255,255,0.55)] transition-colors hover:border-[rgba(255,255,255,0.2)] hover:text-white"
                                      >
                                        <MoreHorizontal className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                                        <span className="sr-only">{lt("Menu")}</span>
                                      </button>
                                      {campaignMenuOpenId === project.id ? (
                                        <div
                                          className="absolute right-0 top-full z-30 mt-1 min-w-[140px] rounded-[4px] border border-[rgba(255,255,255,0.1)] bg-[#141414] py-1 shadow-lg"
                                          role="menu"
                                          onMouseDown={(e) => e.stopPropagation()}
                                        >
                                          <button
                                            type="button"
                                            role="menuitem"
                                            className="flex w-full px-3 py-2 text-left text-xs font-light text-white hover:bg-[rgba(255,255,255,0.06)]"
                                            onClick={() => {
                                              setCampaignMenuOpenId(null);
                                              setActiveProjectId(project.id);
                                            }}
                                          >
                                            {lt("Open")}
                                          </button>
                                          <button
                                            type="button"
                                            role="menuitem"
                                            className="flex w-full px-3 py-2 text-left text-xs font-light text-[#fca5a5] hover:bg-[rgba(239,68,68,0.12)]"
                                            onClick={() => {
                                              setCampaignMenuOpenId(null);
                                              setCampaignDelete({ id: project.id, name: project.name });
                                            }}
                                          >
                                            {lt("Delete")}
                                          </button>
                                        </div>
                                      ) : null}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setActiveProjectId(project.id)}
                                      className="w-full p-3 text-left"
                                    >
                                      <p className="pr-8 text-sm text-white">{project.name}</p>
                                      <p className="mt-1 text-xs text-[var(--muted)]">{project.owner}</p>
                                      <div className="mt-3 h-[2px] rounded-[2px] bg-[rgba(255,255,255,0.12)]">
                                        <div
                                          className="h-[2px] rounded-[2px] bg-[#ff4500]"
                                          style={{ width: `${Math.min(100, kanbanCampaignProgressPct.get(project.id) ?? 0)}%` }}
                                        />
                                      </div>
                                      <p className="mt-2 text-xs text-[var(--muted)]">
                                        {lt("Due")}: <span className="mono-num">{project.endDate ?? "—"}</span>
                                      </p>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {dropProvided.placeholder}
                          {loading ? (
                            <div className="h-20 animate-pulse rounded-[8px] border border-[var(--border)] bg-[#161616]" />
                          ) : null}
                        </div>
                      )}
                    </Droppable>
                    <button
                      type="button"
                      onClick={() => openProjectModal(column.id)}
                      className="mt-2 shrink-0 rounded-[8px] border border-dashed border-[var(--border-strong)] bg-transparent py-2.5 text-xs font-normal text-[rgba(255,255,255,0.4)] transition-colors hover:border-[var(--border)] hover:text-[var(--muted)]"
                    >
                      {lt("Add New Campaign")}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </DragDropContext>
        </div>

        {activeProject ? (
          <div className="fixed inset-y-0 right-0 z-[90] w-full max-w-xl overflow-y-auto border-l border-[var(--border)] bg-[#111111] p-4">
            <div className="flex items-center justify-between">
              <input
                value={campaignTitleDraft}
                onChange={(e) => setCampaignTitleDraft(e.target.value)}
                onBlur={() => {
                  if (!activeProject) return;
                  const trimmed = campaignTitleDraft.trim();
                  if (trimmed === activeProject.name) return;
                  console.log("[marketing/campaigns] campaign name save", activeProject.id, trimmed);
                  void persistMarketingProject(activeProject.id, { name: trimmed || activeProject.name });
                }}
                className="w-full bg-transparent text-xl text-white outline-none"
              />
              <button type="button" onClick={() => setActiveProjectId(null)} className="ml-2 rounded-md border border-[var(--border)] p-2 text-[var(--muted)]">
                <X className="h-4 w-4" />
              </button>
            </div>

            <Card className="mt-4">
              <h3 className="section-title">{lt("Properties")}</h3>
              <div className="mt-3 grid gap-3">
                <label className="text-xs text-[var(--muted)]">
                  {lt("Status")}
                  <select
                    value={activeProject.status}
                    onChange={async (e) => {
                      const status = e.target.value;
                      const column = toColumn(status);
                      console.log("[marketing/campaigns] status change", activeProject.id, status);
                      await persistMarketingProject(activeProject.id, marketingPatchToDb({ status }));
                    }}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  >
                    {Object.values(STATUS_BY_COLUMN).map((value) => <option key={value}>{value}</option>)}
                  </select>
                </label>
                <label className="text-xs text-[var(--muted)]">
                  {lt("Owner")}
                  <select
                    value={activeProject.owner}
                    onChange={async (e) => {
                      const owner = e.target.value;
                      console.log("[marketing/campaigns] owner change", activeProject.id, owner);
                      await persistMarketingProject(activeProject.id, marketingPatchToDb({ owner }));
                    }}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  >
                    {PROJECT_OWNERS.map((value) => <option key={value}>{value}</option>)}
                  </select>
                </label>
                <label className="text-xs text-[var(--muted)]">
                  {lt("Due date")}
                  <input
                    type="date"
                    value={activeProject.endDate ?? ""}
                    onChange={async (e) => {
                      const v = e.target.value || null;
                      if (v === (activeProject.endDate ?? null)) return;
                      console.log("[marketing/campaigns] due date save", activeProject.id, v);
                      await persistMarketingProject(activeProject.id, marketingPatchToDb({ endDate: v }));
                    }}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-[var(--muted)]">
                  {lt("Campaign type")}
                  <select
                    value={activeProject.type}
                    onChange={async (e) => {
                      const type = e.target.value;
                      console.log("[marketing/campaigns] type change", activeProject.id, type);
                      await persistMarketingProject(activeProject.id, marketingPatchToDb({ type }));
                    }}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  >
                    {PROJECT_TYPES.map((value) => <option key={value}>{value}</option>)}
                  </select>
                </label>
                <label className="text-xs text-[var(--muted)]">
                  {lt("Budget")}
                  <input
                    type="number"
                    min={0}
                    value={activeProject.budget}
                    onChange={async (e) => {
                      const v = Math.max(0, Number(e.target.value) || 0);
                      if (v === activeProject.budget) return;
                      console.log("[marketing/campaigns] budget save", activeProject.id, v);
                      await persistMarketingProject(activeProject.id, marketingPatchToDb({ budget: v }));
                    }}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-[var(--muted)]">
                  {lt("Progress")}
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={activeProject.progress}
                    onChange={async (e) => {
                      const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      if (v === activeProject.progress) return;
                      console.log("[marketing/campaigns] progress save", activeProject.id, v);
                      await persistMarketingProject(activeProject.id, marketingPatchToDb({ progress: v }));
                    }}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>
            </Card>

            <Card className="mt-4">
              <h3 className="section-title">{lt("Description")}</h3>
              <textarea
                value={campaignDescriptionDraft}
                onChange={(e) => {
                  setCampaignDescriptionDraft(e.target.value);
                  if (campaignDescriptionError) setCampaignDescriptionError("");
                }}
                rows={4}
                className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
              />
              {campaignDescriptionDraft !== campaignDescriptionSaved ? (
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void saveCampaignDescription();
                      }}
                      className="rounded-[8px] bg-[#ff4500] px-4 py-1.5 text-[0.8rem] font-light text-white transition-colors hover:bg-[#e33f00]"
                    >
                      {lt("Save")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCampaignDescriptionDraft(campaignDescriptionSaved);
                        setCampaignDescriptionError("");
                      }}
                      className="btn-ghost rounded-[8px] px-3 py-1.5 text-[0.8rem]"
                    >
                      {lt("Cancel")}
                    </button>
                    {campaignDescriptionSavedHint ? (
                      <span className="text-[0.75rem] text-[#22c55e]">{lt("Saved")}</span>
                    ) : null}
                  </div>
                  {campaignDescriptionError ? (
                    <p className="mt-1 text-[0.75rem] text-[#ef4444]">{lt(campaignDescriptionError)}</p>
                  ) : null}
                </div>
              ) : null}
            </Card>

            <Card className="mt-4">
              <h3 className="section-title">META ADS LINK</h3>
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="min-w-0 flex-1 text-xs text-[var(--muted)]">
                    Link to Meta Ads Campaign
                    <select
                      value={activeProject.metaCampaignId ?? ""}
                      disabled={metaCampaignsLoading}
                      onChange={async (e) => {
                        const v = e.target.value.trim();
                        const payload = v === "" ? { meta_campaign_id: null } : { meta_campaign_id: v };
                        console.log("[marketing/campaigns] meta campaign link", activeProject.id, payload);
                        const ok = await persistMarketingProject(activeProject.id, payload);
                        if (!ok) setMetaSyncError("Failed to link Meta campaign.");
                        else setMetaSyncError("");
                      }}
                      className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                    >
                      <option value="">— None —</option>
                      {metaCampaignOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={!activeProject.metaCampaignId || metaSyncing}
                    onClick={() => void syncMetricsFromMeta()}
                    className="shrink-0 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-elevated)] px-3 py-2 text-xs font-light text-white disabled:opacity-40"
                  >
                    {metaSyncing ? "Syncing…" : "Sync Metrics from Meta"}
                  </button>
                </div>
                {activeProject.lastSyncedAt ? (
                  <p className="text-xs text-[var(--muted)]">
                    Last synced: {new Date(activeProject.lastSyncedAt).toLocaleString()}
                  </p>
                ) : null}
                {metaCampaignsLoading ? <p className="text-xs text-[var(--muted)]">Loading Meta campaigns…</p> : null}
                {metaCampaignsError ? <p className="text-xs text-[#f87171]">{metaCampaignsError}</p> : null}
                {metaSyncError ? <p className="text-xs text-[#f87171]">{metaSyncError}</p> : null}
                {(() => {
                  const selectedMeta = metaCampaignOptions.find((c) => c.id === activeProject.metaCampaignId);
                  if (!activeProject.metaCampaignId) return null;
                  return (
                    <div className="space-y-2">
                      <span className="inline-flex max-w-full items-center rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] px-2.5 py-1 text-xs text-white">
                        {selectedMeta?.name ?? activeProject.metaCampaignId}
                      </span>
                      {selectedMeta ? (
                        <div className="grid gap-1 text-xs text-[var(--muted)]">
                          <p>
                            <span className="text-[var(--muted)]">Status: </span>
                            <span className="text-white">{selectedMeta.status ?? "—"}</span>
                          </p>
                          <p>
                            <span className="text-[var(--muted)]">Objective: </span>
                            <span className="text-white">{selectedMeta.objective ?? "—"}</span>
                          </p>
                          <p>
                            <span className="text-[var(--muted)]">Budget: </span>
                            <span className="text-white">{formatMetaCampaignBudget(selectedMeta)}</span>
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
            </Card>

            <Card className="mt-4">
              <h3 className="section-title">{lt("Metrics")}</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-xs text-[var(--muted)]">
                  {lt("Spend")}
                  <input
                    type="number"
                    min={0}
                    value={activeProject.budgetUsed}
                    onChange={async (e) => {
                      const v = Math.max(0, Number(e.target.value) || 0);
                      if (v === activeProject.budgetUsed) return;
                      console.log("[marketing/campaigns] spend save", activeProject.id, v);
                      await persistMarketingProject(activeProject.id, marketingPatchToDb({ budgetUsed: v }));
                    }}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-[var(--muted)]">
                  {lt("Impressions")}
                  <input
                    type="number"
                    min={0}
                    value={activeProject.impressions}
                    onChange={async (e) => {
                      const v = Math.max(0, Number(e.target.value) || 0);
                      if (v === activeProject.impressions) return;
                      console.log("[marketing/campaigns] impressions save", activeProject.id, v);
                      await persistMarketingProject(activeProject.id, marketingPatchToDb({ impressions: v }));
                    }}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-[var(--muted)]">
                  {lt("Clicks")}
                  <input
                    type="number"
                    min={0}
                    value={activeProject.clicks}
                    onChange={async (e) => {
                      const v = Math.max(0, Number(e.target.value) || 0);
                      if (v === activeProject.clicks) return;
                      console.log("[marketing/campaigns] clicks save", activeProject.id, v);
                      await persistMarketingProject(activeProject.id, marketingPatchToDb({ clicks: v }));
                    }}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-[var(--muted)]">
                  {lt("Results (Leads/Conversions)")}
                  <input
                    type="number"
                    min={0}
                    value={activeProject.results}
                    onChange={async (e) => {
                      const v = Math.max(0, Number(e.target.value) || 0);
                      if (v === activeProject.results) return;
                      console.log("[marketing/campaigns] results save", activeProject.id, v);
                      await persistMarketingProject(activeProject.id, marketingPatchToDb({ results: v }));
                    }}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>
            </Card>

            <Card className="mt-4">
              <h3 className="section-title">{lt("Attachments")}</h3>
              <input
                type="file"
                multiple
                className="mt-2 block w-full text-xs text-[var(--muted)]"
                onChange={(e) => {
                  const selected = Array.from(e.target.files ?? []).map((file) => ({
                    id: crypto.randomUUID(),
                    name: file.name,
                    size: file.size,
                    type: file.type,
                  }));
                  updateProjectAttachments(activeProject.id, [...activeProject.attachments, ...selected]);
                  e.target.value = "";
                }}
              />
              <div className="mt-2 space-y-1">
                {activeProject.attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between rounded border border-[var(--border)] px-2 py-1 text-xs">
                    <span>{attachment.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        updateProjectAttachments(activeProject.id, activeProject.attachments.filter((item) => item.id !== attachment.id))
                      }
                      className="text-[var(--muted)]"
                    >
                      {lt("Remove")}
                    </button>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="mt-4">
              <h3 className="section-title">{lt("Tags")}</h3>
              <div className="mt-2 flex gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
                <button type="button" onClick={addTag} className="btn-primary rounded-lg px-3 py-2 text-xs">
                  {lt("Add")}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {activeProject.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-1 text-xs">
                    {tag}
                    <button type="button" onClick={() => removeTag(tag)} aria-label={lt("Remove tag")}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </Card>

            <Card className="mt-4">
              <div className="flex items-center justify-between">
                <h3 className="section-title">{lt("Tasks")}</h3>
                <button
                  type="button"
                  onClick={() => {
                    setTaskModalError("");
                    setNewTaskDescription("");
                    setTaskModalOpen(true);
                  }}
                  className="btn-primary rounded-lg px-3 py-1.5 text-xs"
                >
                  {lt("New Task")}
                </button>
              </div>
              <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">
                      <th className="px-2 py-2">{lt("Name")}</th>
                      <th className="px-2 py-2">{lt("Owner")}</th>
                      <th className="px-2 py-2">{lt("Due date")}</th>
                      <th className="px-2 py-2">{lt("Status")}</th>
                      <th className="px-2 py-2">{lt("Priority")}</th>
                      <th className="w-10 px-2 py-2" aria-label={lt("Actions")} />
                    </tr>
                  </thead>
                  <tbody>
                    {projectTasks.map((task) => (
                      <tr key={task.id} className="group/mktrow border-b border-[var(--border)] last:border-b-0">
                        <td className="px-2 py-2">
                          <button type="button" onClick={() => setActiveTaskId(task.id)} className="text-left text-white">
                            {task.title}
                          </button>
                        </td>
                        <td className="px-2 py-2">{task.owner}</td>
                        <td className="px-2 py-2 mono-num">{task.dueDate ?? "—"}</td>
                        <td className="px-2 py-2">
                          <div className="inline-flex items-center gap-1">
                            <select
                              value={task.status}
                              onChange={(e) => void handleMarketingTaskStatusSelect(task.id, e.target.value as MarketingTaskStatus)}
                              className="rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-1.5 py-1 text-xs text-white"
                            >
                              {TASK_STATUSES.map((value) => <option key={value}>{value}</option>)}
                            </select>
                            {task.status === "Published" && task.publishedTo.length > 0 ? (
                              <PublishedPlatformIconRow platforms={task.publishedTo} />
                            ) : null}
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          <select
                            value={task.priority}
                            onChange={(e) => void updateTask(task.id, { priority: e.target.value as MarketingTaskPriority })}
                            className="rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-1.5 py-1 text-xs text-white"
                          >
                            {TASK_PRIORITIES.map((value) => <option key={value}>{value}</option>)}
                          </select>
                        </td>
                        <td className="w-10 px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMarketingTaskDelete({ id: task.id, name: task.title });
                            }}
                            className="inline-flex rounded-[6px] p-1.5 text-[rgba(255,255,255,0.3)] opacity-0 transition hover:text-[#ef4444] group-hover/mktrow:opacity-100"
                            aria-label={lt("Delete task")}
                          >
                            <Trash2 className="h-[14px] w-[14px]" strokeWidth={1.75} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {activeTask ? (
              <Card className="mt-4">
                <h3 className="section-title">{lt("Task detail")}</h3>
                {activeTask.status === "Published" ? (
                  <div className="mt-1.5">
                    <TaskRowStatusBadge status="Published" publishedTo={activeTask.publishedTo} />
                  </div>
                ) : null}
                <input
                  value={activeTask.title}
                  onChange={(e) => void updateTask(activeTask.id, { title: e.target.value })}
                  className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
                <textarea
                  value={activeTask.description}
                  onChange={(e) => void updateTask(activeTask.id, { description: e.target.value })}
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
                <textarea
                  value={activeTask.shortDescription}
                  onChange={(e) => void updateTask(activeTask.id, { shortDescription: e.target.value })}
                  rows={2}
                  placeholder={lt("Brief description of this work...")}
                  className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
                <label className="mt-2 inline-flex items-center gap-2 text-xs text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={activeTask.isFeatured}
                    onChange={(e) => void updateTask(activeTask.id, { isFeatured: e.target.checked })}
                  />
                  {lt("Is Featured")}
                </label>
                <div className="mt-2 rounded-lg border border-[var(--border)] p-3">
                  <p className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">{lt("REMINDER")}</p>
                  <label className="mt-2 inline-flex items-center gap-2 text-xs text-[var(--muted)]">
                    <input
                      type="checkbox"
                      checked={Boolean(activeTask.reminderAt)}
                      onChange={(e) =>
                        void updateTask(activeTask.id, {
                          reminderAt: e.target.checked
                            ? activeTask.reminderAt ?? new Date().toISOString()
                            : null,
                        })
                      }
                    />
                    {lt("Enable reminder")}
                  </label>
                  {activeTask.reminderAt ? (
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <input
                        type="date"
                        value={new Date(activeTask.reminderAt).toISOString().slice(0, 10)}
                        onChange={(e) => {
                          const current = new Date(activeTask.reminderAt ?? new Date().toISOString());
                          const [y, m, d] = e.target.value.split("-").map(Number);
                          current.setUTCFullYear(y, (m || 1) - 1, d || 1);
                          void updateTask(activeTask.id, { reminderAt: current.toISOString() });
                        }}
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                      />
                      <input
                        type="time"
                        value={new Date(activeTask.reminderAt).toISOString().slice(11, 16)}
                        onChange={(e) => {
                          const current = new Date(activeTask.reminderAt ?? new Date().toISOString());
                          const [hh, mm] = e.target.value.split(":").map(Number);
                          current.setUTCHours(hh || 0, mm || 0, 0, 0);
                          void updateTask(activeTask.id, { reminderAt: current.toISOString() });
                        }}
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                      />
                      <textarea
                        value={activeTask.reminderNote}
                        onChange={(e) => void updateTask(activeTask.id, { reminderNote: e.target.value })}
                        placeholder={lt("What to check or do")}
                        rows={2}
                        className="md:col-span-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                      />
                    </div>
                  ) : null}
                </div>
                <input
                  type="file"
                  multiple
                  className="mt-2 block w-full text-xs text-[var(--muted)]"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    void uploadTaskAttachments(activeTask.id, files);
                    e.target.value = "";
                  }}
                />
                {taskAttachmentUploading ? <p className="mt-2 text-xs text-[var(--muted)]">{lt("Uploading attachments...")}</p> : null}
                {taskAttachmentError ? <p className="mt-2 text-xs text-[#f87171]">{taskAttachmentError}</p> : null}
                <div className="mt-2 space-y-1">
                  {activeTask.attachments.map((attachment) => {
                    const kind = taskAttachmentKind(attachment);
                    const icon =
                      kind === "pdf" ? (
                        <FileText className="h-4 w-4 text-[var(--muted)]" />
                      ) : kind === "image" ? (
                        <FileImage className="h-4 w-4 text-[var(--muted)]" />
                      ) : kind === "video" ? (
                        <FileVideo className="h-4 w-4 text-[var(--muted)]" />
                      ) : (
                        <File className="h-4 w-4 text-[var(--muted)]" />
                      );
                    return (
                      <div key={attachment.id} className="flex items-center gap-2 rounded border border-[var(--border)] px-2 py-1.5 text-xs">
                        <span className="shrink-0">{icon}</span>
                        <button
                          type="button"
                          onClick={() => openTaskAttachment(attachment)}
                          className="min-w-0 flex-1 truncate text-left text-white hover:underline"
                          title={attachment.name}
                        >
                          {attachment.name}
                        </button>
                        <span className="mono-num shrink-0 text-[var(--muted)]">{formatAttachmentSize(attachment.size)}</span>
                        <button
                          type="button"
                          onClick={() => openTaskAttachment(attachment)}
                          className="rounded p-1 text-[var(--muted)] hover:text-white"
                          aria-label={lt("Preview")}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadTaskAttachment(attachment)}
                          className="rounded p-1 text-[var(--muted)] hover:text-white"
                          aria-label={lt("Download")}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteTaskAttachment(activeTask.id, attachment)}
                          className="rounded p-1 text-[var(--muted)] hover:text-[#ef4444]"
                          aria-label={lt("Delete attachment")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ) : null}
          </div>
        ) : null}

        {previewAttachment ? (
          <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-[rgba(0,0,0,0.9)] p-4"
            onClick={() => setPreviewAttachment(null)}
          >
            <div
              className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-lg border border-[var(--border)] bg-[#0f0f0f]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
                <p className="min-w-0 flex-1 truncate text-sm text-white">{previewAttachment.name}</p>
                <button
                  type="button"
                  onClick={() => downloadTaskAttachment(previewAttachment)}
                  className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-2 py-1 text-xs text-white hover:bg-[var(--surface-elevated)]"
                >
                  <Download className="h-3.5 w-3.5" />
                  {lt("Download")}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="rounded p-1 text-[var(--muted)] hover:text-white"
                  aria-label={lt("Close preview")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex max-h-[calc(90vh-54px)] min-h-[60vh] items-center justify-center p-4">
                {taskAttachmentKind(previewAttachment) === "pdf" ? (
                  <iframe src={previewAttachment.url} title={previewAttachment.name} className="h-[78vh] w-full rounded border border-[var(--border)]" />
                ) : null}
                {taskAttachmentKind(previewAttachment) === "image" ? (
                  <img src={previewAttachment.url} alt={previewAttachment.name} className="max-h-[78vh] max-w-full object-contain" />
                ) : null}
                {taskAttachmentKind(previewAttachment) === "video" ? (
                  <video src={previewAttachment.url} controls className="max-h-[78vh] max-w-full" />
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {projectModalOpen ? (
          <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 p-4">
            <form onSubmit={createProject} className="w-full max-w-xl rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4">
              <h3 className="text-sm uppercase tracking-[0.08em] text-white">{lt("Add New Campaign")}</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="space-y-1 md:col-span-2">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">{lt("Campaign name")}</span>
                  <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white" required />
                  {newProjectError ? <p className="text-xs text-[#f87171]">{lt(newProjectError)}</p> : null}
                  {newProjectSubmitError ? <p className="text-xs text-[#f87171]">{lt(newProjectSubmitError)}</p> : null}
                </label>
                <label className="space-y-1">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">{lt("Campaign type")}</span>
                  <select value={newProjectType} onChange={(e) => setNewProjectType(e.target.value as (typeof PROJECT_TYPES)[number])} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white">
                    {PROJECT_TYPES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">{lt("Owner")}</span>
                  <select value={newProjectOwner} onChange={(e) => setNewProjectOwner(e.target.value as (typeof PROJECT_OWNERS)[number])} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white">
                    {PROJECT_OWNERS.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">{lt("Budget")}</span>
                  <input type="number" min={0} value={newProjectBudget} onChange={(e) => setNewProjectBudget(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white" />
                </label>
                <label className="space-y-1">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">{lt("Start date")}</span>
                  <input type="date" value={newProjectStartDate} onChange={(e) => setNewProjectStartDate(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white" />
                </label>
                <label className="space-y-1">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">{lt("End date")}</span>
                  <input type="date" value={newProjectEndDate} onChange={(e) => setNewProjectEndDate(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white" />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">{lt("Description")}</span>
                  <textarea value={newProjectDescription} onChange={(e) => setNewProjectDescription(e.target.value)} rows={4} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white" />
                </label>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setProjectModalOpen(false)} className="btn-ghost rounded-lg px-3 py-1.5 text-xs">{lt("Cancel")}</button>
                <button type="submit" className="btn-primary rounded-lg px-3 py-1.5 text-xs">{lt("Save")}</button>
              </div>
            </form>
          </div>
        ) : null}

        <PublishedToModal
          open={publishedToModal !== null}
          title={lt("Where was this published?")}
          subtitle={lt("Select all platforms where this content was published")}
          addPlatformLabel={lt("+ Add platform")}
          addEntryLabel={lt("Add")}
          customPlaceholder={lt("Platform name")}
          confirmLabel={lt("Confirm")}
          skipLabel={lt("Skip — mark as published without specifying")}
          onConfirm={(payload) => {
            void handleMarketingPublishedToConfirm(payload.platforms);
          }}
          onSkip={handleMarketingPublishedToSkip}
          onClose={handleMarketingPublishedToSkip}
        />

        <DeleteConfirmModal
          open={campaignDelete !== null}
          title={lt("Delete Campaign")}
          message={
            campaignDelete
              ? lt("This will permanently delete {name} and all its tasks. This action cannot be undone.").replace(
                  "{name}",
                  campaignDelete.name,
                )
              : ""
          }
          confirmLabel={lt("Delete")}
          cancelLabel={lt("Cancel")}
          onCancel={() => setCampaignDelete(null)}
          onConfirm={confirmDeleteCampaign}
        />

        <DeleteConfirmModal
          open={marketingTaskDelete !== null}
          title={lt("Delete Task")}
          message={
            marketingTaskDelete
              ? lt("Delete {name}? This action cannot be undone.").replace("{name}", marketingTaskDelete.name)
              : ""
          }
          confirmLabel={lt("Delete")}
          cancelLabel={lt("Cancel")}
          onCancel={() => setMarketingTaskDelete(null)}
          onConfirm={() => void confirmDeleteMarketingTask()}
        />

        {taskModalOpen && activeProject ? (
          <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/70 p-4">
            <form onSubmit={(e) => void createTask(e)} className="w-full max-w-lg rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4">
              <h3 className="text-sm uppercase tracking-[0.08em] text-white">{lt("New Task")}</h3>
              {taskModalError ? <p className="mt-2 text-xs text-[#f87171]">{taskModalError}</p> : null}
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="space-y-1 md:col-span-2">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">{lt("Task name")}</span>
                  <input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white" required />
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">{lt("Description")}</span>
                  <textarea
                    value={newTaskDescription}
                    onChange={(e) => setNewTaskDescription(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">{lt("Owner")}</span>
                  <select value={newTaskOwner} onChange={(e) => setNewTaskOwner(e.target.value as (typeof PROJECT_OWNERS)[number])} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white">
                    {PROJECT_OWNERS.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">{lt("Due date")}</span>
                  <input type="date" value={newTaskDueDate} onChange={(e) => setNewTaskDueDate(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white" />
                </label>
                <label className="space-y-1">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">{lt("Status")}</span>
                  <select value={newTaskStatus} onChange={(e) => setNewTaskStatus(e.target.value as MarketingTaskStatus)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white">
                    {TASK_STATUSES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">{lt("Priority")}</span>
                  <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value as MarketingTaskPriority)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white">
                    {TASK_PRIORITIES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label className="space-y-1 md:col-span-2">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">{lt("REMINDER")}</span>
                  <label className="inline-flex items-center gap-2 text-xs text-[var(--muted)]">
                    <input type="checkbox" checked={newTaskReminderEnabled} onChange={(e) => setNewTaskReminderEnabled(e.target.checked)} />
                    {lt("Enable reminder")}
                  </label>
                  {newTaskReminderEnabled ? (
                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <input type="date" value={newTaskReminderDate} onChange={(e) => setNewTaskReminderDate(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white" />
                      <input type="time" value={newTaskReminderTime} onChange={(e) => setNewTaskReminderTime(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white" />
                      <textarea value={newTaskReminderNote} onChange={(e) => setNewTaskReminderNote(e.target.value)} placeholder={lt("What to check or do")} rows={2} className="md:col-span-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white" />
                    </div>
                  ) : null}
                </label>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setTaskModalError("");
                    setTaskModalOpen(false);
                  }}
                  className="btn-ghost rounded-lg px-3 py-1.5 text-xs"
                >
                  {lt("Cancel")}
                </button>
                <button type="submit" className="btn-primary rounded-lg px-3 py-1.5 text-xs">{lt("Save")}</button>
              </div>
            </form>
          </div>
        ) : null}
      </MarketingAccessGuard>
    </ModuleGuard>
  );
}
