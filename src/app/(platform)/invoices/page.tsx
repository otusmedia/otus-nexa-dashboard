"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleGuard } from "@/components/layout/module-guard";
import { formatCurrency } from "@/lib/utils";
import { useAppContext } from "@/components/providers/app-providers";
import { Modal } from "@/components/ui/modal";

export default function InvoicesPage() {
  const { invoices, uploadInvoice, updateInvoice, deleteInvoice, t, td, ts } = useAppContext();
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ fileName: "", description: "", amount: "", dueDate: "", status: "pending" as "paid" | "pending" | "overdue" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = invoices.find((item) => item.id === selectedId);

  return (
    <ModuleGuard module="invoices">
      <PageHeader
        title={t("invoices")}
        subtitle={td("Financial transparency with due dates, payment status and invoice files.")}
        action={<button onClick={() => { setEditingId(null); setOpenForm(true); }} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">{t("uploadInvoice")}</button>}
      />
      <div className="grid gap-4 xl:grid-cols-3">
        {invoices.map((invoice) => (
          <Card key={invoice.id}>
            <button onClick={() => setSelectedId(invoice.id)} className="text-sm font-semibold text-indigo-700">{td(invoice.fileName)}</button>
            <p className="mt-1 text-2xl font-semibold">{formatCurrency(invoice.amount)}</p>
            <p className="mt-1 text-xs text-slate-500">{td("Due")}: {invoice.dueDate}</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => { setEditingId(invoice.id); setForm({ fileName: invoice.fileName, description: invoice.description, amount: String(invoice.amount), dueDate: invoice.dueDate, status: invoice.status }); setOpenForm(true); }} className="rounded border border-slate-200 px-2 py-1 text-xs">{t("edit")}</button>
              <button onClick={() => { if (!window.confirm(t("confirmDelete"))) return; deleteInvoice(invoice.id); }} className="rounded bg-rose-600 px-2 py-1 text-xs text-white">{t("delete")}</button>
            </div>
          </Card>
        ))}
      </div>
      <Modal open={openForm} title={editingId ? t("edit") : t("uploadInvoice")} onClose={() => setOpenForm(false)} closeLabel={t("close")}>
        <div className="space-y-3">
          <input value={form.fileName} onChange={(event) => setForm((prev) => ({ ...prev, fileName: event.target.value }))} placeholder={t("title")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder={t("description")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input value={form.amount} onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))} placeholder={t("amount")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input type="date" value={form.dueDate} onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as "paid" | "pending" | "overdue" }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="paid">{ts("paid")}</option><option value="pending">{ts("pending")}</option><option value="overdue">{ts("overdue")}</option>
          </select>
          <button onClick={() => { if (!form.fileName.trim()) return; const payload = { fileName: form.fileName, description: form.description, amount: Number(form.amount || 0), dueDate: form.dueDate, status: form.status }; if (editingId) updateInvoice(editingId, payload); else uploadInvoice(payload); setOpenForm(false); }} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">{t("save")}</button>
        </div>
      </Modal>
      <Modal open={Boolean(selected)} title={selected?.fileName ?? t("invoices")} onClose={() => setSelectedId(null)} closeLabel={t("close")}>
        {selected ? <p className="text-sm text-slate-600">{td(selected.description)} | {formatCurrency(selected.amount)} | {td("Due")}: {selected.dueDate} | {t("status")}: {ts(selected.status)}</p> : null}
      </Modal>
    </ModuleGuard>
  );
}
