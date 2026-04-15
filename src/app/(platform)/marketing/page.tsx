"use client";
import { useState } from "react";
import { useAppContext } from "@/components/providers/app-providers";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleGuard } from "@/components/layout/module-guard";
import { Modal } from "@/components/ui/modal";

export default function MarketingPage() {
  const { goals, tasks, availableUsers, addTask, updateTask, deleteTask, t, td, ts } = useAppContext();
  const optimizationTasks = tasks.filter((task) => task.tags.includes("Google Ads") || task.tags.includes("Meta Ads"));
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    status: "backlog" as "backlog" | "in_progress" | "in_review" | "completed",
    assignee: "",
    tag: "Google Ads" as "Google Ads" | "Meta Ads",
  });

  return (
    <ModuleGuard module="marketing">
      <PageHeader
        title={t("marketing")}
        subtitle={td("Specialized view for traffic managers and campaign optimization workflows.")}
        action={
          <button onClick={() => { setEditingId(null); setOpen(true); }} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">{t("createTask")}</button>
        }
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold">{td("Campaign performance")}</h2>
          <div className="mt-3 space-y-2">
            {goals.slice(0, 3).map((goal) => (
              <div key={goal.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                {td(goal.name)}: {goal.current}/{goal.target} {goal.unit}
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold">{td("Optimization tasks")}</h2>
          <div className="mt-3 space-y-2">
            {optimizationTasks.map((task) => (
              <div key={task.id} className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-medium">{td(task.title)}</p>
                <p className="text-xs text-slate-500">{t("status")}: {ts(task.status)} - {t("assignee")}: {td(task.assignee)}</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => { setEditingId(task.id); setForm({ title: task.title, description: task.description, dueDate: task.dueDate, status: task.status, assignee: task.assignee, tag: task.tags[0] as "Google Ads" | "Meta Ads" }); setOpen(true); }} className="rounded border border-slate-200 px-2 py-1 text-xs">{t("edit")}</button>
                  <button onClick={() => { if (!window.confirm(t("confirmDelete"))) return; deleteTask(task.id); }} className="rounded bg-rose-600 px-2 py-1 text-xs text-white">{t("delete")}</button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Modal open={open} title={editingId ? t("edit") : t("createTask")} onClose={() => setOpen(false)} closeLabel={t("close")}>
        <div className="space-y-3">
          <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder={t("title")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder={t("description")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input type="date" value={form.dueDate} onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as "backlog" | "in_progress" | "in_review" | "completed" }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="backlog">{ts("backlog")}</option><option value="in_progress">{ts("in progress")}</option><option value="in_review">{ts("in review")}</option><option value="completed">{ts("completed")}</option>
          </select>
          <select value={form.assignee} onChange={(event) => setForm((prev) => ({ ...prev, assignee: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("assignee")}</option>
            {availableUsers.map((user) => <option key={user.id} value={user.name}>{user.name}</option>)}
          </select>
          <select value={form.tag} onChange={(event) => setForm((prev) => ({ ...prev, tag: event.target.value as "Google Ads" | "Meta Ads" }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="Google Ads">Google Ads</option><option value="Meta Ads">Meta Ads</option>
          </select>
          <button onClick={() => { if (!form.title.trim()) return; const payload = { title: form.title, description: form.description, dueDate: form.dueDate, status: form.status, assignee: form.assignee || availableUsers[0].name, tags: [form.tag], approval: "draft" as const, linkedEventIds: [] }; if (editingId) updateTask(editingId, payload); else addTask(payload); setOpen(false); }} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">{t("save")}</button>
        </div>
      </Modal>
    </ModuleGuard>
  );
}
