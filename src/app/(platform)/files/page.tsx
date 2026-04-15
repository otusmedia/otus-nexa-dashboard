"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleGuard } from "@/components/layout/module-guard";
import { useAppContext } from "@/components/providers/app-providers";
import { Modal } from "@/components/ui/modal";

export default function FilesPage() {
  const { files, tasks, availableUsers, uploadFile, updateFile, deleteFile, t, td, ts } = useAppContext();
  const [openUpload, setOpenUpload] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    category: "Creatives" as "Creatives" | "Videos" | "Reports",
    status: "draft" as "draft" | "approved" | "archived",
    assignee: "",
    tags: "",
    taskId: "",
  });
  const selectedFile = files.find((item) => item.id === selectedFileId);

  return (
    <ModuleGuard module="files">
      <PageHeader
        title={t("files")}
        subtitle={td("Manage creatives, videos and reports linked to tasks and communication threads.")}
        action={<button onClick={() => { setEditingId(null); setOpenUpload(true); }} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">{t("uploadFile")}</button>}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {files.map((file) => (
          <Card key={file.id}>
            <p className="text-sm font-semibold">{td(file.name)}</p>
            <p className="mt-1 text-xs text-slate-500">{td("Category")}: {td(file.category)}</p>
            <p className="text-xs text-slate-500">{td("Uploaded")}: {file.uploadedAt}</p>
            <p className="mt-1 text-xs text-slate-500">{t("linkedTask")}: {file.attachedToTask ?? td("None")}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setSelectedFileId(file.id)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">{t("details")}</button>
              <button
                onClick={() => {
                  setEditingId(file.id);
                  setForm({ name: file.name, description: file.description, category: file.category, status: file.status, assignee: file.assignee, tags: file.tags.join(", "), taskId: file.attachedToTask ?? "" });
                  setOpenUpload(true);
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
              >
                {t("edit")}
              </button>
              <button onClick={() => { if (!window.confirm(t("confirmDelete"))) return; deleteFile(file.id); }} className="rounded-lg bg-rose-600 px-3 py-2 text-xs text-white">{t("delete")}</button>
            </div>
          </Card>
        ))}
      </div>
      <Modal open={openUpload} title={editingId ? t("edit") : t("uploadFile")} onClose={() => setOpenUpload(false)} closeLabel={t("close")}>
        <div className="space-y-3">
          <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder={t("title")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder={t("description")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <select value={form.category} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value as "Creatives" | "Videos" | "Reports" }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="Creatives">Creatives</option>
            <option value="Videos">Videos</option>
            <option value="Reports">Reports</option>
          </select>
          <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as "draft" | "approved" | "archived" }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="draft">{ts("draft")}</option><option value="approved">{ts("approved")}</option><option value="archived">{ts("archived")}</option>
          </select>
          <select value={form.assignee} onChange={(event) => setForm((prev) => ({ ...prev, assignee: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("assignee")}</option>
            {availableUsers.map((user) => <option key={user.id} value={user.name}>{user.name}</option>)}
          </select>
          <input value={form.tags} onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))} placeholder={t("tags")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <select value={form.taskId} onChange={(event) => setForm((prev) => ({ ...prev, taskId: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("noTaskLink")}</option>
            {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
          </select>
          <button
            onClick={() => {
              if (!form.name.trim()) return;
              const payload = { name: form.name, description: form.description, category: form.category, status: form.status, assignee: form.assignee || availableUsers[0].name, tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean), taskId: form.taskId || undefined };
              if (editingId) updateFile(editingId, { ...payload, attachedToTask: payload.taskId });
              else uploadFile(payload);
              setOpenUpload(false);
            }}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white"
          >
            {t("save")}
          </button>
        </div>
      </Modal>
      <Modal open={Boolean(selectedFile)} title={selectedFile?.name ?? t("files")} onClose={() => setSelectedFileId(null)} closeLabel={t("close")}>
        {selectedFile ? (
          <div className="space-y-2 text-sm text-slate-600">
            <p>{td("Category")}: {td(selectedFile.category)}</p>
            <p>{td("Uploaded")}: {selectedFile.uploadedAt}</p>
            <p>{t("linkedTask")}: {selectedFile.attachedToTask ?? td("None")}</p>
          </div>
        ) : null}
      </Modal>
    </ModuleGuard>
  );
}
