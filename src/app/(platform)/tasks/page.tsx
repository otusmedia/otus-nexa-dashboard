"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleGuard } from "@/components/layout/module-guard";
import { useAppContext } from "@/components/providers/app-providers";
import { Modal } from "@/components/ui/modal";
import type { TaskStatus } from "@/types";

const columns: Array<{ key: TaskStatus; label: string }> = [
  { key: "backlog", label: "backlog" },
  { key: "in_progress", label: "in progress" },
  { key: "in_review", label: "in review" },
  { key: "completed", label: "completed" },
];

export default function TasksPage() {
  const { query, tasks, events, files, availableUsers, setTaskStatus, addTask, updateTask, deleteTask, addTaskComment, addTaskFile, t, td, ts } = useAppContext();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"" | TaskStatus>("");
  const [tagFilter, setTagFilter] = useState<"" | "Social" | "Google Ads" | "Meta Ads">("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [attachmentInput, setAttachmentInput] = useState("");
  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    status: "backlog" as TaskStatus,
    assignee: "",
    tag: "Social" as "Social" | "Google Ads" | "Meta Ads",
    approval: "draft" as const,
  });

  const selectedTask = tasks.find((task) => task.id === selectedTaskId);

  const visibleTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const textMatch = task.title.toLowerCase().includes(query.toLowerCase()) || task.assignee.toLowerCase().includes(query.toLowerCase());
        const statusMatch = statusFilter ? task.status === statusFilter : true;
        const tagMatch = tagFilter ? task.tags.includes(tagFilter) : true;
        const dateMatch =
          (!startDateFilter || task.dueDate >= startDateFilter) && (!endDateFilter || task.dueDate <= endDateFilter);
        return textMatch && statusMatch && tagMatch && dateMatch;
      }),
    [query, tasks, statusFilter, tagFilter, startDateFilter, endDateFilter],
  );

  return (
    <ModuleGuard module="tasks">
      <PageHeader
        title={t("tasks")}
        subtitle={td("Kanban operations with approval states, comments, links and attachments.")}
        action={
          <button onClick={() => setOpenCreate(true)} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white">
            {t("createTask")}
          </button>
        }
      />
      <Card className="mb-4">
        <div className="grid gap-3 md:grid-cols-4">
          <input type="date" value={startDateFilter} onChange={(event) => setStartDateFilter(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input type="date" value={endDateFilter} onChange={(event) => setEndDateFilter(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "" | TaskStatus)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("allStatuses")}</option>
            {columns.map((column) => (
              <option key={column.key} value={column.key}>{ts(column.label)}</option>
            ))}
          </select>
          <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value as "" | "Social" | "Google Ads" | "Meta Ads")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("allTags")}</option>
            <option value="Social">Social</option>
            <option value="Google Ads">Google Ads</option>
            <option value="Meta Ads">Meta Ads</option>
          </select>
        </div>
      </Card>
      <div className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => (
          <Card
            key={column.key}
            className="min-h-[420px]"
            onDragOver={(event: React.DragEvent<HTMLDivElement>) => event.preventDefault()}
            onDrop={() => {
              if (!draggedTaskId) return;
              setTaskStatus(draggedTaskId, column.key);
              setDraggedTaskId(null);
            }}
          >
            <h2 className="mb-3 text-sm font-semibold text-slate-600">{ts(column.label)}</h2>
            <div className="space-y-3">
              {visibleTasks
                .filter((task) => task.status === column.key)
                .map((task) => (
                  <article
                    key={task.id}
                    draggable
                    onDragStart={() => setDraggedTaskId(task.id)}
                    onClick={() => setSelectedTaskId(task.id)}
                    className="cursor-grab rounded-lg border border-slate-200 bg-slate-50 p-3"
                  >
                    <h3 className="text-sm font-semibold text-slate-800">{td(task.title)}</h3>
                    <p className="mt-1 text-xs text-slate-500">{td(task.description)}</p>
                    <p className="mt-2 text-xs text-slate-500">{t("assignee")}: {td(task.assignee)} | {t("dueDate")}: {task.dueDate}</p>
                    <p className="mt-1 text-xs text-slate-500">{t("tags")}: {task.tags.join(", ")}</p>
                    <p className="mt-1 text-xs text-slate-500">{td("Files")}: {task.files.length} | {td("comments")}: {task.comments.length}</p>
                    <p className="mt-2 inline-block rounded bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                      Approval: {ts(task.approval)}
                    </p>
                  </article>
                ))}
            </div>
          </Card>
        ))}
      </div>
      <Modal open={openCreate} title={t("createTask")} onClose={() => setOpenCreate(false)} closeLabel={t("close")}>
        <div className="space-y-3">
          <input value={createForm.title} onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))} placeholder={t("title")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <textarea value={createForm.description} onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))} placeholder={t("description")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input type="date" value={createForm.dueDate} onChange={(event) => setCreateForm((prev) => ({ ...prev, dueDate: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <select value={createForm.status} onChange={(event) => setCreateForm((prev) => ({ ...prev, status: event.target.value as TaskStatus }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            {columns.map((column) => <option key={column.key} value={column.key}>{ts(column.label)}</option>)}
          </select>
          <select value={createForm.assignee} onChange={(event) => setCreateForm((prev) => ({ ...prev, assignee: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("assignee")}</option>
            {availableUsers.map((user) => <option key={user.id} value={user.name}>{user.name}</option>)}
          </select>
          <select value={createForm.tag} onChange={(event) => setCreateForm((prev) => ({ ...prev, tag: event.target.value as "Social" | "Google Ads" | "Meta Ads" }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="Social">Social</option>
            <option value="Google Ads">Google Ads</option>
            <option value="Meta Ads">Meta Ads</option>
          </select>
          <button
            onClick={() => {
              if (!createForm.title.trim()) return;
              addTask({
                title: createForm.title,
                description: createForm.description,
                dueDate: createForm.dueDate,
                status: createForm.status,
                assignee: createForm.assignee || availableUsers[0].name,
                tags: [createForm.tag],
                approval: createForm.approval,
                linkedEventIds: [],
              });
              setOpenCreate(false);
              setCreateForm({ title: "", description: "", dueDate: "", status: "backlog", assignee: "", tag: "Social", approval: "draft" });
            }}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white"
          >
            {t("save")}
          </button>
        </div>
      </Modal>
      <Modal open={Boolean(selectedTask)} title={selectedTask ? td(selectedTask.title) : t("tasks")} onClose={() => setSelectedTaskId(null)} closeLabel={t("close")}>
        {selectedTask ? (
          <div className="space-y-3">
            <input value={selectedTask.title} onChange={(event) => updateTask(selectedTask.id, { title: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <textarea value={selectedTask.description} onChange={(event) => updateTask(selectedTask.id, { description: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <select value={selectedTask.status} onChange={(event) => setTaskStatus(selectedTask.id, event.target.value as TaskStatus)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {columns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}
            </select>
            <input type="date" value={selectedTask.dueDate} onChange={(event) => updateTask(selectedTask.id, { dueDate: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <select value={selectedTask.assignee} onChange={(event) => updateTask(selectedTask.id, { assignee: event.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {availableUsers.map((user) => <option key={user.id} value={user.name}>{user.name}</option>)}
            </select>
            <select value={selectedTask.tags[0]} onChange={(event) => updateTask(selectedTask.id, { tags: [event.target.value as "Social" | "Google Ads" | "Meta Ads"] })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="Social">Social</option><option value="Google Ads">Google Ads</option><option value="Meta Ads">Meta Ads</option>
            </select>
            <select value={selectedTask.approval} onChange={(event) => updateTask(selectedTask.id, { approval: event.target.value as "draft" | "pending" | "approved" | "rejected" })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="draft">Draft</option><option value="pending">Pending Approval</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
            </select>
            <select
              value={selectedTask.linkedEventIds[0] ?? ""}
              onChange={(event) => updateTask(selectedTask.id, { linkedEventIds: event.target.value ? [event.target.value] : [] })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">No linked event</option>
              {events.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}
            </select>
            <select
              value={selectedTask.files[0] ?? ""}
              onChange={(event) => updateTask(selectedTask.id, { files: event.target.value ? [event.target.value] : [] })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">No linked file</option>
              {files.map((file) => <option key={file.id} value={file.name}>{file.name}</option>)}
            </select>
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500">{td("comments")}</p>
              <div className="space-y-2">
                {selectedTask.comments.map((comment) => (
                  <div key={comment.id} className="rounded-lg bg-slate-50 p-2 text-xs">
                    <p className="font-medium">{td(comment.author)}</p>
                    <p>{td(comment.text)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input value={commentInput} onChange={(event) => setCommentInput(event.target.value)} placeholder={td("Add comment")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <button onClick={() => { if (!commentInput.trim()) return; addTaskComment(selectedTask.id, commentInput); setCommentInput(""); }} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">{td("Post")}</button>
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-500">{td("attachments")}</p>
              <div className="flex gap-2">
                <input value={attachmentInput} onChange={(event) => setAttachmentInput(event.target.value)} placeholder={td("filename.pdf")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <button onClick={() => { if (!attachmentInput.trim()) return; addTaskFile(selectedTask.id, attachmentInput); setAttachmentInput(""); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">{td("Attach")}</button>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (!window.confirm(t("confirmDelete"))) return;
                  deleteTask(selectedTask.id);
                  setSelectedTaskId(null);
                }}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm text-white"
              >
                {t("delete")}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </ModuleGuard>
  );
}
