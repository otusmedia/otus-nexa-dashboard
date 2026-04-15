"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleGuard } from "@/components/layout/module-guard";
import { Modal } from "@/components/ui/modal";
import { useAppContext } from "@/components/providers/app-providers";

export default function GoalsPage() {
  const { goals, addGoal, updateGoal, deleteGoal, t, td, ts } = useAppContext();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", target: "", current: "", unit: "USD" });
  return (
    <ModuleGuard module="goals">
      <PageHeader
        title={t("goals")}
        subtitle={td("Track leads, CPL, revenue and content output with progress states.")}
        action={<button onClick={() => { setEditingId(null); setOpen(true); }} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">{t("createGoal")}</button>}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {goals.map((goal) => {
          const percent = Math.min(100, Math.round((goal.current / goal.target) * 100));
          return (
            <Card key={goal.id}>
              <p className="text-sm font-semibold text-slate-800">{td(goal.name)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {t("target")}: {goal.target} {goal.unit} - {t("current")}: {goal.current} {goal.unit}
              </p>
              <div className="mt-3 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${percent}%` }} />
              </div>
              <p className="mt-2 text-xs uppercase text-slate-500">{t("status")}: {ts(goal.status)}</p>
              <div className="mt-2 flex gap-2">
                <button onClick={() => { setEditingId(goal.id); setForm({ name: goal.name, target: String(goal.target), current: String(goal.current), unit: goal.unit }); setOpen(true); }} className="rounded border border-slate-200 px-2 py-1 text-xs">{t("edit")}</button>
                <button onClick={() => { if (!window.confirm(t("confirmDelete"))) return; deleteGoal(goal.id); }} className="rounded bg-rose-600 px-2 py-1 text-xs text-white">{t("delete")}</button>
              </div>
            </Card>
          );
        })}
      </div>
      <Modal open={open} title={editingId ? t("edit") : t("createGoal")} onClose={() => setOpen(false)} closeLabel={t("close")}>
        <div className="space-y-3">
          <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder={t("title")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input value={form.target} onChange={(event) => setForm((prev) => ({ ...prev, target: event.target.value }))} placeholder={t("target")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input value={form.current} onChange={(event) => setForm((prev) => ({ ...prev, current: event.target.value }))} placeholder={t("current")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input value={form.unit} onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))} placeholder={t("unit")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <button onClick={() => { if (!form.name.trim()) return; const payload = { name: form.name, target: Number(form.target || 0), current: Number(form.current || 0), unit: form.unit }; if (editingId) updateGoal(editingId, payload); else addGoal(payload); setOpen(false); }} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">{t("save")}</button>
        </div>
      </Modal>
    </ModuleGuard>
  );
}
