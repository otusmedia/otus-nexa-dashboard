"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleGuard } from "@/components/layout/module-guard";
import { Modal } from "@/components/ui/modal";
import { useAppContext } from "@/components/providers/app-providers";

export default function RoadmapPage() {
  const { roadmap, availableUsers, addRoadmapItem, updateRoadmapItem, deleteRoadmapItem, t, td, ts } = useAppContext();
  const [view, setView] = useState<"timeline" | "list">("timeline");
  const [openCreate, setOpenCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    status: "planned" as "planned" | "in_progress" | "done",
    assignee: "",
    tags: "",
  });

  return (
    <ModuleGuard module="roadmap">
      <PageHeader
        title={t("roadmap")}
        subtitle={td("Weekly and monthly campaign planning linked to operation milestones.")}
        action={
          <div className="flex gap-2">
            <button onClick={() => setView("timeline")} className={`rounded-lg px-3 py-2 text-sm ${view === "timeline" ? "bg-indigo-600 text-white" : "border border-slate-200"}`}>{t("timeline")}</button>
            <button onClick={() => setView("list")} className={`rounded-lg px-3 py-2 text-sm ${view === "list" ? "bg-indigo-600 text-white" : "border border-slate-200"}`}>{t("list")}</button>
            <button onClick={() => { setEditingId(null); setOpenCreate(true); }} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">{t("createRoadmapItem")}</button>
          </div>
        }
      />
      <div className="space-y-3">
        {roadmap.map((item) => (
          <Card key={item.id} className={view === "timeline" ? "flex items-center justify-between" : ""}>
            <div>
              <p className="text-sm font-semibold">{td(item.title)}</p>
              <p className="text-xs text-slate-500">{td(item.description)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">{item.startDate} - {item.endDate}</span>
              <button onClick={() => { setEditingId(item.id); setForm({ title: item.title, description: item.description, startDate: item.startDate, endDate: item.endDate, status: item.status, assignee: item.assignee, tags: item.tags.join(", ") }); setOpenCreate(true); }} className="rounded border border-slate-200 px-2 py-1 text-xs">{t("edit")}</button>
              <button onClick={() => { if (!window.confirm(t("confirmDelete"))) return; deleteRoadmapItem(item.id); }} className="rounded bg-rose-600 px-2 py-1 text-xs text-white">{t("delete")}</button>
            </div>
          </Card>
        ))}
      </div>
      <Modal open={openCreate} title={editingId ? t("edit") : t("createRoadmapItem")} onClose={() => setOpenCreate(false)} closeLabel={t("close")}>
        <div className="space-y-3">
          <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder={t("title")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder={t("description")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input type="date" value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input type="date" value={form.endDate} onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as "planned" | "in_progress" | "done" }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="planned">{ts("planned")}</option><option value="in_progress">{ts("in progress")}</option><option value="done">{ts("done")}</option>
          </select>
          <select value={form.assignee} onChange={(event) => setForm((prev) => ({ ...prev, assignee: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("assignee")}</option>
            {availableUsers.map((user) => <option key={user.id} value={user.name}>{user.name}</option>)}
          </select>
          <input value={form.tags} onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))} placeholder={t("tags")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <button
            onClick={() => {
              if (!form.title.trim()) return;
              const payload = { title: form.title, description: form.description, startDate: form.startDate, endDate: form.endDate, status: form.status, assignee: form.assignee || availableUsers[0].name, tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean) };
              if (editingId) updateRoadmapItem(editingId, payload);
              else addRoadmapItem(payload);
              setOpenCreate(false);
            }}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white"
          >
            {t("save")}
          </button>
        </div>
      </Modal>
    </ModuleGuard>
  );
}
