"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { MoreHorizontal, Trash2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { ModuleGuard } from "@/components/layout/module-guard";
import { useAppContext } from "@/components/providers/app-providers";
import { Card } from "@/components/ui/card";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { PageHeader } from "@/components/ui/page-header";
import { useLanguage } from "@/context/language-context";
import { supabase } from "@/lib/supabase";
import { MarketingAccessGuard } from "../_components/marketing-access-guard";

type MarketingColumnId = "planning" | "in_progress" | "paused" | "done" | "cancelled";
type MarketingTaskStatus = "Not Started" | "In Progress" | "Waiting for Approval" | "Done" | "Scheduled" | "Published";
type MarketingTaskPriority = "Low" | "Medium" | "High" | "Urgent";

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
  attachments: Array<{ id: string; name: string; size: number; type: string }>;
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

export default function MarketingProjectsPage() {
  const { t } = useAppContext();
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

  const [tagInput, setTagInput] = useState("");
  const [campaignMenuOpenId, setCampaignMenuOpenId] = useState<string | null>(null);
  const campaignMenuRef = useRef<HTMLDivElement>(null);
  const [campaignDelete, setCampaignDelete] = useState<{ id: string; name: string } | null>(null);
  const [marketingTaskDelete, setMarketingTaskDelete] = useState<{ id: string; name: string } | null>(null);
  const [campaignDescriptionDraft, setCampaignDescriptionDraft] = useState("");
  const [campaignDescriptionSaved, setCampaignDescriptionSaved] = useState("");
  const [campaignDescriptionSavedHint, setCampaignDescriptionSavedHint] = useState(false);
  const [campaignDescriptionError, setCampaignDescriptionError] = useState("");

  useEffect(() => {
    let mounted = true;
    console.log("[marketing/campaigns] fetch start: marketing_projects + marketing_tasks");
    void Promise.all([
      supabase.from("marketing_projects").select("*").order("created_at", { ascending: false }),
      supabase.from("marketing_tasks").select("*").order("created_at", { ascending: false }),
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
          ((projectsRes.data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
            id: String(row.id ?? ""),
            name: String(row.name ?? ""),
            type: String(row.type ?? "Other"),
            status: String(row.status ?? "Planning"),
            column: toColumn(String(row.status ?? "Planning")),
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
          })),
        );
        setTasks(
          ((tasksRes.data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
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
          })),
        );
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
    const nextCampaign: MarketingProject = {
      id: String(row.id ?? payload.id),
      name: String(row.name ?? payload.name),
      type: String(row.type ?? payload.type),
      status: String(row.status ?? payload.status),
      column: toColumn(String(row.status ?? payload.status)),
      progress: Number(row.progress ?? payload.progress) || 0,
      budget: Number(row.budget ?? payload.budget) || 0,
      budgetUsed: Number(row.budget_used ?? payload.budget_used) || 0,
      results: Number(row.results ?? payload.results) || 0,
      impressions: Number(row.impressions ?? payload.impressions) || 0,
      clicks: Number(row.clicks ?? payload.clicks) || 0,
      owner: String(row.owner ?? payload.owner),
      startDate: row.campaign_period_start ? String(row.campaign_period_start) : row.start_date ? String(row.start_date) : null,
      endDate: row.campaign_period_end ? String(row.campaign_period_end) : row.end_date ? String(row.end_date) : null,
      description: String(row.description ?? payload.description),
      tags: Array.isArray(row.tags) ? row.tags.map((item) => String(item)) : [],
      attachments: [],
    };
    setProjects((prev) => [nextCampaign, ...prev]);
    return true;
  };

  const createProject = async (event: React.FormEvent) => {
    event.preventDefault();
    const ok = await addCampaign();
    if (ok) setProjectModalOpen(false);
  };

  const onDragEnd = (result: DropResult) => {
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
    const nextMoved = {
      ...movedCampaign,
      column: destinationColumn,
      status: STATUS_BY_COLUMN[destinationColumn],
    };
    nextByColumn[destinationColumn].splice(destination.index, 0, nextMoved);
    setProjects([
      ...nextByColumn.planning,
      ...nextByColumn.in_progress,
      ...nextByColumn.paused,
      ...nextByColumn.done,
      ...nextByColumn.cancelled,
    ]);
    void supabase
      .from("marketing_projects")
      .update({ status: STATUS_BY_COLUMN[destinationColumn] })
      .eq("id", movedCampaign.id);
  };

  const updateProject = (projectId: string, patch: Partial<MarketingProject>) => {
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, ...patch } : p)));
    void supabase
      .from("marketing_projects")
      .update({
        name: patch.name,
        type: patch.type,
        owner: patch.owner,
        end_date: patch.endDate,
        start_date: patch.startDate,
        description: patch.description,
        progress: patch.progress,
        budget: patch.budget,
        budget_used: patch.budgetUsed,
        results: patch.results,
        impressions: patch.impressions,
        clicks: patch.clicks,
        status: patch.status,
        tags: patch.tags,
        campaign_period_start: patch.startDate,
        campaign_period_end: patch.endDate,
      })
      .eq("id", projectId);
  };

  const updateTask = (taskId: string, patch: Partial<MarketingTask>) => {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...patch } : task)));
    void supabase
      .from("marketing_tasks")
      .update({
        title: patch.title,
        description: patch.description,
        status: patch.status,
        priority: patch.priority,
        assigned_to: patch.owner,
        due_date: patch.dueDate,
        is_featured: patch.isFeatured,
        cover_image: patch.coverImage,
        short_description: patch.shortDescription,
        reminder_at: patch.reminderAt,
        reminder_note: patch.reminderNote,
      })
      .eq("id", taskId);
  };

  const createTask = (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeProject || !newTaskTitle.trim()) return;
    const id = crypto.randomUUID();
    const reminderAt =
      newTaskReminderEnabled && newTaskReminderDate && newTaskReminderTime
        ? new Date(`${newTaskReminderDate}T${newTaskReminderTime}:00`).toISOString()
        : null;
    const next: MarketingTask = {
      id,
      projectId: activeProject.id,
      title: newTaskTitle.trim(),
      description: "",
      status: newTaskStatus,
      priority: newTaskPriority,
      owner: newTaskOwner,
      dueDate: newTaskDueDate || null,
      isFeatured: false,
      coverImage: null,
      shortDescription: "",
      reminderAt,
      reminderNote: newTaskReminderEnabled ? newTaskReminderNote.trim() : "",
      attachments: [],
    };
    setTasks((prev) => [next, ...prev]);
    void supabase.from("marketing_tasks").insert({
      id,
      project_id: activeProject.id,
      title: next.title,
      status: next.status,
      priority: next.priority,
      assigned_to: next.owner,
      due_date: next.dueDate,
      is_featured: false,
      short_description: "",
      reminder_at: reminderAt,
      reminder_note: newTaskReminderEnabled ? newTaskReminderNote.trim() : null,
    });
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
  };

  const addTag = () => {
    if (!activeProject) return;
    const nextTag = tagInput.trim();
    if (!nextTag) return;
    const next = Array.from(new Set([...activeProject.tags, nextTag]));
    setTagInput("");
    updateProject(activeProject.id, { tags: next });
  };

  const removeTag = (value: string) => {
    if (!activeProject) return;
    updateProject(
      activeProject.id,
      { tags: activeProject.tags.filter((tag) => tag !== value) },
    );
  };

  const saveCampaignDescription = async () => {
    if (!activeProject) return;
    setCampaignDescriptionError("");
    const { error } = await supabase
      .from("marketing_projects")
      .update({ description: campaignDescriptionDraft })
      .eq("id", activeProject.id);
    if (error) {
      console.error("[supabase] marketing campaign description update failed:", error.message);
      setCampaignDescriptionError("Failed to save. Try again.");
      return;
    }
    setProjects((prev) =>
      prev.map((project) =>
        project.id === activeProject.id ? { ...project, description: campaignDescriptionDraft } : project,
      ),
    );
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

  const confirmDeleteMarketingTask = () => {
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
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, progress } : p)));
    void supabase
      .from("marketing_tasks")
      .delete()
      .eq("id", taskId)
      .then(({ error }) => {
        if (error) console.error("[supabase] marketing_tasks delete failed:", error.message);
      });
    void supabase
      .from("marketing_projects")
      .update({ progress })
      .eq("id", projectId)
      .then(({ error }) => {
        if (error) console.error("[supabase] marketing campaign progress update failed:", error.message);
      });
    if (activeTaskId === taskId) setActiveTaskId(null);
    setMarketingTaskDelete(null);
  };

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
                                        <div className="h-[2px] rounded-[2px] bg-[#ff4500]" style={{ width: `${project.progress}%` }} />
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
                value={activeProject.name}
                onChange={(e) => updateProject(activeProject.id, { name: e.target.value })}
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
                    onChange={(e) =>
                      updateProject(activeProject.id, { status: e.target.value, column: toColumn(e.target.value) })
                    }
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  >
                    {Object.values(STATUS_BY_COLUMN).map((value) => <option key={value}>{value}</option>)}
                  </select>
                </label>
                <label className="text-xs text-[var(--muted)]">
                  {lt("Owner")}
                  <select
                    value={activeProject.owner}
                    onChange={(e) => updateProject(activeProject.id, { owner: e.target.value })}
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
                    onChange={(e) => updateProject(activeProject.id, { endDate: e.target.value || null })}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-[var(--muted)]">
                  {lt("Campaign type")}
                  <select
                    value={activeProject.type}
                    onChange={(e) => updateProject(activeProject.id, { type: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  >
                    {PROJECT_TYPES.map((value) => <option key={value}>{value}</option>)}
                  </select>
                </label>
                <label className="text-xs text-[var(--muted)]">
                  {lt("Progress")}
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={activeProject.progress}
                    onChange={(e) => updateProject(activeProject.id, { progress: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
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
              <h3 className="section-title">{lt("Metrics")}</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-xs text-[var(--muted)]">
                  {lt("Spend")}
                  <input
                    type="number"
                    min={0}
                    value={activeProject.budgetUsed}
                    onChange={(e) => updateProject(activeProject.id, { budgetUsed: Number(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-[var(--muted)]">
                  {lt("Impressions")}
                  <input
                    type="number"
                    min={0}
                    value={activeProject.impressions}
                    onChange={(e) => updateProject(activeProject.id, { impressions: Number(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-[var(--muted)]">
                  {lt("Clicks")}
                  <input
                    type="number"
                    min={0}
                    value={activeProject.clicks}
                    onChange={(e) => updateProject(activeProject.id, { clicks: Number(e.target.value) || 0 })}
                    className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-[var(--muted)]">
                  {lt("Results (Leads/Conversions)")}
                  <input
                    type="number"
                    min={0}
                    value={activeProject.results}
                    onChange={(e) => updateProject(activeProject.id, { results: Number(e.target.value) || 0 })}
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
                  updateProject(activeProject.id, { attachments: [...activeProject.attachments, ...selected] });
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
                        updateProject(activeProject.id, {
                          attachments: activeProject.attachments.filter((item) => item.id !== attachment.id),
                        })
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
                <button type="button" onClick={() => setTaskModalOpen(true)} className="btn-primary rounded-lg px-3 py-1.5 text-xs">
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
                          <select
                            value={task.status}
                            onChange={(e) => updateTask(task.id, { status: e.target.value as MarketingTaskStatus })}
                            className="rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-1.5 py-1 text-xs text-white"
                          >
                            {TASK_STATUSES.map((value) => <option key={value}>{value}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <select
                            value={task.priority}
                            onChange={(e) => updateTask(task.id, { priority: e.target.value as MarketingTaskPriority })}
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
                <input
                  value={activeTask.title}
                  onChange={(e) => updateTask(activeTask.id, { title: e.target.value })}
                  className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
                <textarea
                  value={activeTask.description}
                  onChange={(e) => updateTask(activeTask.id, { description: e.target.value })}
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
                <textarea
                  value={activeTask.shortDescription}
                  onChange={(e) => updateTask(activeTask.id, { shortDescription: e.target.value })}
                  rows={2}
                  placeholder={lt("Brief description of this work...")}
                  className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
                <label className="mt-2 inline-flex items-center gap-2 text-xs text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={activeTask.isFeatured}
                    onChange={(e) => updateTask(activeTask.id, { isFeatured: e.target.checked })}
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
                        updateTask(activeTask.id, {
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
                          updateTask(activeTask.id, { reminderAt: current.toISOString() });
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
                          updateTask(activeTask.id, { reminderAt: current.toISOString() });
                        }}
                        className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                      />
                      <textarea
                        value={activeTask.reminderNote}
                        onChange={(e) => updateTask(activeTask.id, { reminderNote: e.target.value })}
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
                    const selected = Array.from(e.target.files ?? []).map((file) => ({
                      id: crypto.randomUUID(),
                      name: file.name,
                      size: file.size,
                      type: file.type,
                    }));
                    updateTask(activeTask.id, { attachments: [...activeTask.attachments, ...selected] });
                    e.target.value = "";
                  }}
                />
              </Card>
            ) : null}
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
          onConfirm={confirmDeleteMarketingTask}
        />

        {taskModalOpen && activeProject ? (
          <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/70 p-4">
            <form onSubmit={createTask} className="w-full max-w-lg rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4">
              <h3 className="text-sm uppercase tracking-[0.08em] text-white">{lt("New Task")}</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="space-y-1 md:col-span-2">
                  <span className="text-[0.65rem] uppercase tracking-[0.08em] text-[var(--muted)]">{lt("Task name")}</span>
                  <input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white" required />
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
                <button type="button" onClick={() => setTaskModalOpen(false)} className="btn-ghost rounded-lg px-3 py-1.5 text-xs">{lt("Cancel")}</button>
                <button type="submit" className="btn-primary rounded-lg px-3 py-1.5 text-xs">{lt("Save")}</button>
              </div>
            </form>
          </div>
        ) : null}
      </MarketingAccessGuard>
    </ModuleGuard>
  );
}
