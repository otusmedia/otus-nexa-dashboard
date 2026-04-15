"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleGuard } from "@/components/layout/module-guard";
import { Modal } from "@/components/ui/modal";
import { useAppContext } from "@/components/providers/app-providers";

export default function IdeasPage() {
  const { ideas, availableUsers, addIdea, updateIdea, deleteIdea, convertIdeaToTask, t, td, ts } = useAppContext();
  const [openCreate, setOpenCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", description: "", status: "new" as "new" | "validated" | "converted", assignee: "", tags: "" });
  return (
    <ModuleGuard module="ideas">
      <PageHeader
        title={t("ideas")}
        subtitle={td("Capture campaign concepts and convert validated ideas into execution tasks.")}
        action={<button onClick={() => { setEditingId(null); setOpenCreate(true); }} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">{t("createIdea")}</button>}
      />
      <div className="space-y-3">
        {ideas.map((idea) => (
          <Card key={idea.id} className="flex items-center justify-between">
            <div>
              <p className="text-sm">{td(idea.title)}</p>
              <p className="text-xs text-slate-500">{td(idea.description)}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => convertIdeaToTask(idea.id)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white">{t("convertToTask")}</button>
              <button onClick={() => { setEditingId(idea.id); setForm({ title: idea.title, description: idea.description, status: idea.status, assignee: idea.assignee, tags: idea.tags.join(", ") }); setOpenCreate(true); }} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">{t("edit")}</button>
              <button onClick={() => { if (!window.confirm(t("confirmDelete"))) return; deleteIdea(idea.id); }} className="rounded-lg bg-rose-600 px-3 py-2 text-xs text-white">{t("delete")}</button>
            </div>
          </Card>
        ))}
      </div>
      <Modal open={openCreate} title={editingId ? t("edit") : t("createIdea")} onClose={() => setOpenCreate(false)} closeLabel={t("close")}>
        <div className="space-y-3">
          <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder={t("title")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder={t("description")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as "new" | "validated" | "converted" }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="new">{ts("new")}</option><option value="validated">{ts("validated")}</option><option value="converted">{ts("converted")}</option>
          </select>
          <select value={form.assignee} onChange={(event) => setForm((prev) => ({ ...prev, assignee: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("assignee")}</option>
            {availableUsers.map((user) => <option key={user.id} value={user.name}>{user.name}</option>)}
          </select>
          <input value={form.tags} onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))} placeholder={t("tags")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <button onClick={() => { if (!form.title.trim()) return; const payload = { title: form.title, description: form.description, status: form.status, assignee: form.assignee || availableUsers[0].name, tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean) }; if (editingId) updateIdea(editingId, payload); else addIdea(payload); setOpenCreate(false); }} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">{t("save")}</button>
        </div>
      </Modal>
    </ModuleGuard>
  );
}
