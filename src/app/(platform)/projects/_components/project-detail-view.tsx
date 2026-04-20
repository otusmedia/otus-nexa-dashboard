"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FileArchive,
  FileCode,
  FileImage,
  FileText,
  FileVideo,
  Plus,
  Star,
  Target,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import type { Project, ProjectTaskRow, TaskRowStatus } from "../data";
import { formatDisplayDate, OWNER_OPTIONS, TASK_STATUS_OPTIONS } from "../data";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { Card } from "@/components/ui/card";
import { OwnerAvatars } from "./owner-avatars";
import { ProgressInline } from "./progress-inline";
import { ProjectStatusBadge } from "./project-status-badge";
import { ProjectTypeBadge } from "./project-type-badge";
import { TaskRowStatusBadge } from "./task-row-status-badge";

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
}

interface LocalTask extends ProjectTaskRow {
  description: string;
  priority: Priority;
  attachments: TaskAttachment[];
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

function attachmentKind(type: string, name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (type.startsWith("image/")) return FileImage;
  if (type.startsWith("video/")) return FileVideo;
  if (type.includes("zip") || type.includes("compressed") || ext === "zip" || ext === "rar") return FileArchive;
  if (["ts", "tsx", "js", "jsx", "json", "css", "html", "md"].includes(ext)) return FileCode;
  return FileText;
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
]);

export function ProjectDetailView({ project }: { project: Project }) {
  const searchParams = useSearchParams();
  const { updateBoardProjectTask, addBoardProjectTask } = useAppContext();
  const { t: lt } = useLanguage();
  const [description, setDescription] = useState(project.description);
  const [moreOpen, setMoreOpen] = useState(false);
  const [tasks, setTasks] = useState<LocalTask[]>(() =>
    project.tasks.map((task) => ({
      ...task,
      description: "",
      priority: "Medium",
      attachments: [],
    })),
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false); // modal menu
  const [rowStatusMenu, setRowStatusMenu] = useState<{ taskId: string; top: number; left: number } | null>(null);
  const [taskName, setTaskName] = useState("");
  const [owner, setOwner] = useState((project.owners[0] || OWNER_OPTIONS[0]) as string);
  const [dueDate, setDueDate] = useState("");
  const [taskStatus, setTaskStatus] = useState<TaskRowStatus>("Not Started");
  const [taskNameError, setTaskNameError] = useState("");
  const [editingCell, setEditingCell] = useState<{ taskId: string; field: "name" | "owner" | "dueDate" } | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [panelStatusOpen, setPanelStatusOpen] = useState(false);
  const [panelEditingName, setPanelEditingName] = useState(false);
  const [panelOwnerEditing, setPanelOwnerEditing] = useState(false);
  const [panelDueDateEditing, setPanelDueDateEditing] = useState(false);
  const [panelDescription, setPanelDescription] = useState("");
  const [panelPriority, setPanelPriority] = useState<Priority>("Medium");
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
  };

  useEffect(() => {
    setTasks((prev) =>
      project.tasks.map((row) => {
        const prevLocal = prev.find((t) => t.id === row.id);
        return {
          ...row,
          description: prevLocal?.description ?? "",
          priority: prevLocal?.priority ?? "Medium",
          attachments: prevLocal?.attachments ?? [],
        };
      }),
    );
  }, [project.tasks]);

  useEffect(() => {
    const tid = searchParams.get("taskId");
    if (!tid) return;
    if (tasks.some((t) => t.id === tid)) {
      setActiveTaskId(tid);
    }
  }, [searchParams, tasks]);

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

  const updateTask = (taskId: string, updates: Partial<LocalTask>) => {
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, ...updates } : task)));
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
  };

  const activeTask = useMemo(() => tasks.find((task) => task.id === activeTaskId) || null, [tasks, activeTaskId]);

  useEffect(() => {
    if (!activeTask) return;
    setPanelDescription(activeTask.description);
    setPanelPriority(activeTask.priority);
    setPanelStatusOpen(false);
    setPanelEditingName(false);
    setPanelOwnerEditing(false);
    setPanelDueDateEditing(false);
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

  const onRowStatusChange = (taskId: string, status: TaskRowStatus) => {
    updateTask(taskId, { status });
    setRowStatusMenu(null);
  };

  const onPanelFileUpload = (files: FileList | null) => {
    if (!files || !activeTask) return;
    const additions: TaskAttachment[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      size: file.size,
      type: file.type,
    }));
    updateTask(activeTask.id, { attachments: [...activeTask.attachments, ...additions] });
  };

  const onCoverImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeTaskId) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      event.target.value = "";
      return;
    }
    const task = tasks.find((t) => t.id === activeTaskId);
    if (!task) return;
    if (task.coverImage?.startsWith("blob:")) {
      URL.revokeObjectURL(task.coverImage);
    }
    const url = URL.createObjectURL(file);
    updateTask(activeTaskId, { coverImage: url });
    event.target.value = "";
  };

  const removeCoverImage = () => {
    if (!activeTaskId) return;
    const task = tasks.find((t) => t.id === activeTaskId);
    if (!task?.coverImage) return;
    if (task.coverImage.startsWith("blob:")) {
      URL.revokeObjectURL(task.coverImage);
    }
    updateTask(activeTaskId, { coverImage: null });
  };

  const onPanelDescriptionChange = (value: string) => {
    setPanelDescription(value);
    if (activeTask) updateTask(activeTask.id, { description: value });
  };

  const handleCreateTask = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = taskName.trim();
    if (!trimmedName) {
      setTaskNameError("Task name is required.");
      return;
    }

    const newRow: ProjectTaskRow = {
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmedName,
      owner,
      dueDate: dueDate || null,
      status: taskStatus,
      isFeatured: false,
      coverImage: null,
      shortDescription: "",
    };
    addBoardProjectTask(project.id, newRow);
    closeTaskModal();
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
            <ProjectStatusBadge status={project.status} />
          </PropRow>
          <PropRow label={lt("Owner")}>
            <OwnerAvatars names={project.owners} size="md" />
          </PropRow>
          <PropRow label={lt("Progress")}>
            <div className="max-w-md">
              <ProgressInline value={progressPercentage} />
            </div>
          </PropRow>
          <PropRow label={lt("Due date")}>
            <span className="mono-num text-[rgba(255,255,255,0.4)]">{formatDisplayDate(project.dueDate)}</span>
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
          onChange={(e) => setDescription(e.target.value)}
          placeholder={lt("Add a project description...")}
          rows={5}
          className="w-full resize-y rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white placeholder:text-[rgba(255,255,255,0.4)]"
        />
      </Card>

      <Card className="rounded-[8px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title mb-0">{lt("Project Tasks")}</h2>
          <button type="button" onClick={openTaskModal} className="btn-primary rounded-[8px] px-3 py-1.5 text-xs">
            {lt("New Task")}
          </button>
        </div>
        <div className="overflow-x-auto rounded-[8px] border border-[var(--border)]">
          <table className="bg-[#161616]">
            <thead>
              <tr className="text-[rgba(255,255,255,0.4)]">
                <th className="kpi-label border-[var(--border)] bg-[#101010] py-2.5">{lt("Task name")}</th>
                <th className="kpi-label border-[var(--border)] bg-[#101010] py-2.5">{lt("Owner")}</th>
                <th className="kpi-label border-[var(--border)] bg-[#101010] py-2.5">{lt("Due date")}</th>
                <th className="kpi-label border-[var(--border)] bg-[#101010] py-2.5">{lt("Status")}</th>
                <th className="kpi-label w-12 border-[var(--border)] bg-[#101010] py-2.5 text-center" aria-label={lt("Featured")}>
                  <Star className="mx-auto h-4 w-4 text-[rgba(255,255,255,0.35)]" strokeWidth={1.5} />
                </th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr
                  key={task.id}
                  className="cursor-pointer transition-colors hover:bg-[rgba(255,255,255,0.03)]"
                  onClick={() => openTaskPanel(task.id)}
                >
                  <td className="text-sm font-light text-white">
                    {editingCell?.taskId === task.id && editingCell.field === "name" ? (
                      <input
                        autoFocus
                        value={task.name}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => updateTask(task.id, { name: event.target.value })}
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
                    {editingCell?.taskId === task.id && editingCell.field === "owner" ? (
                      <select
                        autoFocus
                        value={task.owner}
                        onChange={(event) => updateTask(task.id, { owner: event.target.value })}
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
                    {editingCell?.taskId === task.id && editingCell.field === "dueDate" ? (
                      <input
                        type="date"
                        autoFocus
                        value={task.dueDate || ""}
                        onChange={(event) => updateTask(task.id, { dueDate: event.target.value || null })}
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
                      <TaskRowStatusBadge status={task.status} />
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
                                    onClick={() => onRowStatusChange(task.id, option.value)}
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
                  </td>
                  <td className="w-12 text-center" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => updateTask(task.id, { isFeatured: !task.isFeatured })}
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
                  </td>
                </tr>
              ))}
              <tr className="cursor-pointer border-t border-[var(--border)] transition-colors hover:bg-[rgba(255,255,255,0.03)]">
                <td colSpan={5} className="py-3">
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
            </tbody>
          </table>
        </div>
      </Card>

      {modalOpen ? (
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
                  {panelEditingName ? (
                    <input
                      autoFocus
                      value={activeTask.name}
                      onChange={(event) => updateTask(activeTask.id, { name: event.target.value })}
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
                    <button
                      type="button"
                      onClick={() => setPanelStatusOpen((prev) => !prev)}
                      className="text-left"
                    >
                      <TaskRowStatusBadge status={activeTask.status} />
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
                                onClick={() => {
                                  updateTask(activeTask.id, { status: option.value });
                                  setPanelStatusOpen(false);
                                }}
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
                    {panelOwnerEditing ? (
                      <select
                        autoFocus
                        value={activeTask.owner}
                        onChange={(event) => updateTask(activeTask.id, { owner: event.target.value })}
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
                    {panelDueDateEditing ? (
                      <input
                        type="date"
                        autoFocus
                        value={activeTask.dueDate || ""}
                        onChange={(event) => updateTask(activeTask.id, { dueDate: event.target.value || null })}
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
                  <select
                    value={panelPriority}
                    onChange={(event) => {
                      const next = event.target.value as Priority;
                      setPanelPriority(next);
                      updateTask(activeTask.id, { priority: next });
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
                </div>
              </div>

              <div>
                <p className="section-title mb-2">{lt("Description")}</p>
                <textarea
                  ref={panelDescriptionRef}
                  value={panelDescription}
                  onChange={(event) => onPanelDescriptionChange(event.target.value)}
                  rows={1}
                  placeholder={lt("Add a task description...")}
                  className="w-full resize-none overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white placeholder:text-[rgba(255,255,255,0.4)]"
                />
              </div>

              <div>
                <p className="section-title mb-2">{lt("Attachments")}</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  onChange={(event) => onPanelFileUpload(event.target.files)}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-[8px] border border-dashed border-[rgba(255,255,255,0.15)] bg-[#161616] px-4 py-6 text-sm font-light text-[rgba(255,255,255,0.5)]"
                >
                  <Upload className="h-4 w-4" />
                  {lt("Click to upload or drag and drop")}
                </button>
                <div className="mt-3 space-y-2">
                  {activeTask.attachments.map((attachment) => {
                    const Icon = attachmentKind(attachment.type, attachment.name);
                    return (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between rounded-[8px] border border-[var(--border)] bg-[#161616] px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Icon className="h-4 w-4 shrink-0 text-[rgba(255,255,255,0.55)]" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-light text-white">{attachment.name}</p>
                            <p className="text-xs font-light text-[rgba(255,255,255,0.4)]">
                              <span className="mono-num">{formatFileSize(attachment.size)}</span>
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateTask(activeTask.id, {
                              attachments: activeTask.attachments.filter((item) => item.id !== attachment.id),
                            })
                          }
                          className="rounded-[6px] border border-[var(--border)] px-2 py-1 text-xs font-light text-[rgba(255,255,255,0.5)]"
                        >
                          {lt("Remove")}
                        </button>
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
                <input
                  type="text"
                  maxLength={80}
                  value={activeTask.shortDescription}
                  onChange={(event) => updateTask(activeTask.id, { shortDescription: event.target.value.slice(0, 80) })}
                  placeholder={lt("Brief description of this work...")}
                  className="w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white placeholder:text-[rgba(255,255,255,0.4)]"
                />
              </div>

              <div className="space-y-2 border-t border-[var(--border)] pt-5">
                <p className="section-title mb-0">{lt("COVER IMAGE")}</p>
                <p className="text-xs font-light text-[rgba(255,255,255,0.4)]">{lt("Recommended 1920x1080px")}</p>
                <input
                  ref={coverImageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={onCoverImageChange}
                />
                {activeTask.coverImage ? (
                  <div className="relative w-full overflow-hidden rounded-[6px]">
                    <img src={activeTask.coverImage} alt="" className="h-[160px] w-full object-cover" />
                    <button
                      type="button"
                      onClick={removeCoverImage}
                      className="absolute right-2 top-2 rounded-[6px] border border-[var(--border)] bg-[rgba(0,0,0,0.65)] p-1.5 text-white"
                      aria-label={lt("Remove cover image")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => coverImageInputRef.current?.click()}
                    className="flex w-full items-center justify-center rounded-[8px] border border-dashed border-[rgba(255,255,255,0.15)] bg-[#161616] px-4 py-6 text-sm font-light text-[rgba(255,255,255,0.5)]"
                  >
                    {lt("Click to upload cover image")}
                  </button>
                )}
              </div>

              <div className="space-y-2 border-t border-[var(--border)] pt-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="section-title mb-0">{lt("FEATURED IN HIGHLIGHTS")}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={activeTask.isFeatured}
                    onClick={() => updateTask(activeTask.id, { isFeatured: !activeTask.isFeatured })}
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
                </div>
                {activeTask.isFeatured && !activeTask.coverImage ? (
                  <p className="text-xs text-amber-400">{lt("Add a cover image to display in Highlights")}</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
