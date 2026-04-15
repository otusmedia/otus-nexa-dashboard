"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleGuard } from "@/components/layout/module-guard";
import { Modal } from "@/components/ui/modal";
import { useAppContext } from "@/components/providers/app-providers";

export default function ContractsPage() {
  const { contracts, availableUsers, uploadContract, updateContract, deleteContract, t, td, ts } = useAppContext();
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", status: "active" as "active" | "expired", assignee: "", tags: "" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = contracts.find((item) => item.id === selectedId);
  return (
    <ModuleGuard module="contracts">
      <PageHeader
        title={t("contracts")}
        subtitle={td("Upload and track active/expired agreements with quick compliance visibility.")}
        action={<button onClick={() => { setEditingId(null); setOpenForm(true); }} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">{t("uploadContract")}</button>}
      />
      <div className="space-y-3">
        {contracts.map((contract) => (
          <Card key={contract.id} className="flex items-center justify-between">
            <div>
              <button onClick={() => setSelectedId(contract.id)} className="text-sm font-semibold text-left text-indigo-700">{td(contract.name)}</button>
              <p className="text-xs text-slate-500">{td("Uploaded")}: {contract.uploadDate}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setEditingId(contract.id); setForm({ name: contract.name, description: contract.description, status: contract.status, assignee: contract.assignee, tags: contract.tags.join(", ") }); setOpenForm(true); }} className="rounded border border-slate-200 px-2 py-1 text-xs">{t("edit")}</button>
              <button onClick={() => { if (!window.confirm(t("confirmDelete"))) return; deleteContract(contract.id); }} className="rounded bg-rose-600 px-2 py-1 text-xs text-white">{t("delete")}</button>
            </div>
          </Card>
        ))}
      </div>
      <Modal open={openForm} title={editingId ? t("edit") : t("uploadContract")} onClose={() => setOpenForm(false)} closeLabel={t("close")}>
        <div className="space-y-3">
          <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder={t("title")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder={t("description")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as "active" | "expired" }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="active">{ts("active")}</option><option value="expired">{ts("expired")}</option></select>
          <select value={form.assignee} onChange={(event) => setForm((prev) => ({ ...prev, assignee: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("assignee")}</option>
            {availableUsers.map((user) => <option key={user.id} value={user.name}>{user.name}</option>)}
          </select>
          <input value={form.tags} onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))} placeholder={t("tags")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <button onClick={() => { if (!form.name.trim()) return; const payload = { name: form.name, description: form.description, status: form.status, assignee: form.assignee || availableUsers[0].name, tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean) }; if (editingId) updateContract(editingId, payload); else uploadContract(payload); setOpenForm(false); }} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">{t("save")}</button>
        </div>
      </Modal>
      <Modal open={Boolean(selected)} title={selected?.name ?? t("contracts")} onClose={() => setSelectedId(null)} closeLabel={t("close")}>
        {selected ? <p className="text-sm text-slate-600">{t("status")}: {ts(selected.status)} | {td("Uploaded")}: {selected.uploadDate}</p> : null}
      </Modal>
    </ModuleGuard>
  );
}
