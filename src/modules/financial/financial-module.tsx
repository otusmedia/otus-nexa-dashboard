"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp, Pencil, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleGuard } from "@/components/layout/module-guard";
import { DeleteConfirmModal } from "@/components/ui/delete-confirm-modal";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { cn, formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

const DEMO_PDF_URL =
  "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

const INVOICE_COLLAPSED_KEY = "invoice-generator-collapsed";

type DbInvoice = {
  id: string;
  invoice_number: string | null;
  filename: string | null;
  amount: number;
  status: "paid" | "pending" | "overdue";
  issue_date: string | null;
  due_date: string | null;
  project_id: string | null;
  project_ids: string[];
  project_name: string | null;
  file_url: string | null;
};

type ProjectInvestRow = {
  name: string;
  total: number;
  paid: number;
  remaining: number;
  completion: number;
  projectLink: string | null;
  installmentPaid: number;
  installmentTotal: number;
};

type LineItem = {
  id: string;
  description: string;
  unitCost: number;
  qty: number;
  amount: number;
  projectId: string | null;
  projectName: string | null;
  isInstallment: boolean;
  installmentCurrent: number;
  installmentTotal: number;
};
type DbProject = { id: string; name: string };

type DbInvoiceLineItem = {
  id: string;
  invoice_id: string | null;
  description: string;
  unit_cost: number;
  qty: number;
  amount: number;
  project_id: string | null;
  project_name: string | null;
  is_installment: boolean;
  installment_current: number;
  installment_total: number;
  invoice_status: DbInvoice["status"];
};

type EditInvoiceModalState = {
  invoiceId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  billedTo: string;
  status: DbInvoice["status"];
  linkedProjectIds: string[];
  lineItems: LineItem[];
  taxRate: number;
  shipping: number;
  saving: boolean;
};

type InvoiceHtmlFormData = {
  from: string;
  invoiceNumber: string;
  dateOfIssue: string;
  dueDate: string;
  billedTo: string;
  purchaseOrder: string;
  lineItems: Array<{
    description: string;
    unitCost: number;
    qty: number;
    isInstallment: boolean;
    installmentCurrent: number;
    installmentTotal: number;
  }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  shipping: number;
  invoiceTotal: number;
};

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildInvoiceHtmlString(formData: InvoiceHtmlFormData, options?: { previewChrome?: boolean }): string {
  const fromDisplay = escapeHtml(formData.from || "Nexa Media Ltda | Otus Media");
  const lineRows = formData.lineItems
    .map(
      (item) => {
        const installmentSuffix = item.isInstallment
          ? ` — Installment ${item.installmentCurrent} of ${item.installmentTotal}`
          : "";
        return `
        <tr>
          <td>${escapeHtml(`${item.description}${installmentSuffix}`)}</td>
          <td class="text-right">$${parseFloat(String(item.unitCost || 0)).toFixed(2)}</td>
          <td class="text-right">${item.qty}</td>
          <td class="text-right">$${(parseFloat(String(item.unitCost || 0)) * parseFloat(String(item.qty || 0))).toFixed(2)}</td>
        </tr>`;
      },
    )
    .join("");
  const poBlock = formData.purchaseOrder.trim() ? `<p>PO: ${escapeHtml(formData.purchaseOrder)}</p>` : "";
  const previewChrome = options?.previewChrome
    ? `<div class="invoice-preview-toolbar" style="position:sticky;top:0;left:0;right:0;z-index:1000;background:#fff;border-bottom:1px solid #eee;padding:12px 40px;margin:-40px -40px 24px -40px;display:flex;gap:10px;align-items:center;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
  <button type="button" onclick="window.print()" style="padding:8px 16px;font-size:13px;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:#f5f5f5;">Print</button>
  <button type="button" onclick="window.print()" style="padding:8px 16px;font-size:13px;cursor:pointer;border:1px solid #222;border-radius:4px;background:#222;color:#fff;">Download</button>
</div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #000; background: #fff; padding: 40px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .title { font-size: 28px; font-weight: bold; color: #000; }
    .invoice-meta { text-align: right; }
    .invoice-meta p { margin-bottom: 4px; }
    .label { color: #666; font-size: 11px; text-transform: uppercase; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 11px; text-transform: uppercase; color: #666; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    .from-to { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 32px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { text-align: left; padding: 8px 12px; background: #f5f5f5; font-size: 11px; text-transform: uppercase; color: #666; }
    td { padding: 10px 12px; border-bottom: 1px solid #eee; }
    .text-right { text-align: right; }
    .totals { width: 300px; margin-left: auto; }
    .totals tr td { border: none; padding: 4px 12px; }
    .totals tr.total td { font-weight: bold; font-size: 14px; border-top: 2px solid #000; padding-top: 8px; }
    .bank-details { background: #f9f9f9; padding: 16px; border-radius: 4px; font-size: 11px; }
    .bank-details p { margin-bottom: 4px; }
    @media print {
      .invoice-preview-toolbar { display: none !important; }
    }
  </style>
</head>
<body>
  ${previewChrome}
  <div class="header">
    <div>
      <div class="title">INVOICE</div>
      <p style="margin-top:8px;color:#666;">From: ${fromDisplay}</p>
    </div>
    <div class="invoice-meta">
      <p><span class="label">Invoice Number</span></p>
      <p><strong>${escapeHtml(formData.invoiceNumber)}</strong></p>
      <p style="margin-top:8px;"><span class="label">Date of Issue</span></p>
      <p>${escapeHtml(formData.dateOfIssue)}</p>
      <p style="margin-top:8px;"><span class="label">Due Date</span></p>
      <p>${escapeHtml(formData.dueDate)}</p>
    </div>
  </div>

  <div class="from-to">
    <div>
      <div class="section-title">Billed To</div>
      <p><strong>${escapeHtml(formData.billedTo)}</strong></p>
      ${poBlock}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="text-right">Unit Cost</th>
        <th class="text-right">QTY</th>
        <th class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows}
    </tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotal</td><td class="text-right">$${formData.subtotal.toFixed(2)}</td></tr>
    <tr><td>Tax (${formData.taxRate}%)</td><td class="text-right">$${formData.taxAmount.toFixed(2)}</td></tr>
    <tr><td>Shipping</td><td class="text-right">$${parseFloat(String(formData.shipping || 0)).toFixed(2)}</td></tr>
    <tr class="total"><td>TOTAL</td><td class="text-right">US$ ${formData.invoiceTotal.toFixed(2)}</td></tr>
  </table>

  <div class="bank-details">
    <div class="section-title" style="margin-bottom:12px;">Bank Account Details</div>
    <p>Bank: Community Federal Savings Bank</p>
    <p>Account Number: 889037781-7</p>
    <p>ACH Routing: 026073150</p>
    <p>Wire Routing: 026073008</p>
    <p>SWIFT: CMFGUS33</p>
    <p>Account Holder: Inter & Co Global Account — Matheus Jeovane / Nexa Media Ltda.</p>
  </div>
</body>
</html>`;
}

function statusBadgeClass(status: DbInvoice["status"]) {
  if (status === "paid") return "border-[#22c55e]/35 bg-[#22c55e]/12 text-[#86efac]";
  if (status === "pending") return "border-[#f59e0b]/35 bg-[#f59e0b]/12 text-[#fcd34d]";
  return "border-[#ef4444]/35 bg-[#ef4444]/12 text-[#fca5a5]";
}

const INVOICE_STATUS_DROPDOWN_EST_HEIGHT_PX = 120;

function getInvoiceStatusDropdownPosition(triggerRect: DOMRect) {
  const gap = 6;
  let top = triggerRect.bottom + gap;
  if (top + INVOICE_STATUS_DROPDOWN_EST_HEIGHT_PX > window.innerHeight) {
    top = triggerRect.top - INVOICE_STATUS_DROPDOWN_EST_HEIGHT_PX - gap;
  }
  const minTop = gap;
  const maxTop = window.innerHeight - INVOICE_STATUS_DROPDOWN_EST_HEIGHT_PX - gap;
  const upper = Math.max(minTop, maxTop);
  top = Math.min(Math.max(top, minTop), upper);
  return { top, left: triggerRect.left };
}

const INVOICE_STATUS_OPTIONS: Array<{ value: DbInvoice["status"]; dotClass: string; label: string }> = [
  { value: "paid", dotClass: "bg-[#22c55e]", label: "paid" },
  { value: "pending", dotClass: "bg-[#eab308]", label: "pending" },
  { value: "overdue", dotClass: "bg-[#ef4444]", label: "overdue" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function invoiceUrlLooksHtml(fileName: string, url: string): boolean {
  const f = fileName.toLowerCase();
  const path = url.split("?")[0]?.toLowerCase() ?? "";
  return f.endsWith(".html") || f.endsWith(".htm") || path.endsWith(".html") || path.endsWith(".htm");
}

type InvoicePreviewModalState = {
  fileName: string;
  url: string;
  srcDoc: string | null;
  loadingPreview: boolean;
};

function normalizeInvoiceProjectIds(row: Record<string, unknown>): string[] {
  const raw = row.project_ids;
  if (Array.isArray(raw)) {
    return raw.map((id) => String(id)).filter(Boolean);
  }
  if (row.project_id != null) {
    return [String(row.project_id)];
  }
  return [];
}

export function FinancialModule() {
  const { t: lt } = useLanguage();
  const { currentUser } = useAppContext();
  const canGenerateInvoice = currentUser?.company === "nexa" || currentUser?.company === "otus";
  const [invoices, setInvoices] = useState<DbInvoice[]>([]);
  const [projects, setProjects] = useState<DbProject[]>([]);
  const [invoiceLineItems, setInvoiceLineItems] = useState<DbInvoiceLineItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingGenerated, setSavingGenerated] = useState(false);
  const [generatorCollapsed, setGeneratorCollapsed] = useState(true);
  const [deleteInvoice, setDeleteInvoice] = useState<DbInvoice | null>(null);
  const [invoiceStatusMenu, setInvoiceStatusMenu] = useState<{ invoiceId: string; top: number; left: number } | null>(
    null,
  );
  const [editModal, setEditModal] = useState<EditInvoiceModalState | null>(null);

  const [activeKpiIndex, setActiveKpiIndex] = useState(0);
  const [pdfModal, setPdfModal] = useState<InvoicePreviewModalState | null>(null);

  const totalInvested = invoices.filter((item) => item.status === "paid").reduce((acc, item) => acc + item.amount, 0);
  const paidCount = invoices.filter((i) => i.status === "paid").length;

  const [invoiceNumber, setInvoiceNumber] = useState("INV-2026-1042");
  const [issueDate, setIssueDate] = useState(todayIso);
  const [dueDateGen, setDueDateGen] = useState("2026-05-15");
  const [linkedProjectIds, setLinkedProjectIds] = useState<string[]>([]);
  const [billedTo, setBilledTo] = useState("RocketRide Inc");
  const [purchaseOrder, setPurchaseOrder] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    {
      id: "li-1",
      description: "",
      unitCost: 0,
      qty: 1,
      amount: 0,
      projectId: null,
      projectName: null,
      isInstallment: false,
      installmentCurrent: 1,
      installmentTotal: 1,
    },
  ]);
  const [taxRate, setTaxRate] = useState(0);
  const [shipping, setShipping] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(INVOICE_COLLAPSED_KEY);
      setGeneratorCollapsed(raw !== "false");
    } catch {
      setGeneratorCollapsed(true);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(INVOICE_COLLAPSED_KEY, generatorCollapsed ? "true" : "false");
    } catch {
      /* ignore */
    }
  }, [generatorCollapsed]);

  useEffect(() => {
    if (!invoiceStatusMenu) return;
    const closeMenu = () => setInvoiceStatusMenu(null);
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
  }, [invoiceStatusMenu]);

  const loadFinancialData = useCallback(async () => {
    setLoadingData(true);
    const [invRes, projRes, lineItemsRes] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("id,name"),
      supabase.from("invoice_line_items").select("*, invoice:invoices(id, status)"),
    ]);
    if (invRes.error) console.error("[financial] invoices fetch", invRes.error.message);
    if (projRes.error) console.error("[financial] projects fetch", projRes.error.message);
    if (lineItemsRes.error) console.error("[financial] invoice line items fetch", lineItemsRes.error.message);

    const mappedInvoices: DbInvoice[] = ((invRes.data as Record<string, unknown>[] | null) ?? []).map((row) => {
      const project_ids = normalizeInvoiceProjectIds(row);
      const project_id =
        row.project_id != null ? String(row.project_id) : project_ids.length > 0 ? project_ids[0] : null;
      return {
        id: String(row.id ?? ""),
        invoice_number: row.invoice_number != null ? String(row.invoice_number) : null,
        filename: row.filename != null ? String(row.filename) : row.file_name != null ? String(row.file_name) : null,
        amount: Number(row.amount ?? 0) || 0,
        status:
          row.status === "paid" || row.status === "pending" || row.status === "overdue"
            ? (row.status as DbInvoice["status"])
            : "pending",
        issue_date: row.issue_date != null ? String(row.issue_date) : row.due_date != null ? String(row.due_date) : null,
        due_date: row.due_date != null ? String(row.due_date) : null,
        project_id,
        project_ids,
        project_name: row.project_name != null ? String(row.project_name) : row.description != null ? String(row.description) : null,
        file_url: row.file_url != null ? String(row.file_url) : null,
      };
    });
    const mappedProjects: DbProject[] = ((projRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
    }));
    const mappedLineItems: DbInvoiceLineItem[] = ((lineItemsRes.data as Record<string, unknown>[] | null) ?? []).map((row) => {
      const invoiceRelation = row.invoice as Record<string, unknown> | Record<string, unknown>[] | null | undefined;
      const invoiceRow = Array.isArray(invoiceRelation) ? invoiceRelation[0] : invoiceRelation;
      const statusRaw = invoiceRow?.status;
      const invoiceStatus: DbInvoice["status"] =
        statusRaw === "paid" || statusRaw === "pending" || statusRaw === "overdue"
          ? (statusRaw as DbInvoice["status"])
          : "pending";
      return {
        id: String(row.id ?? ""),
        invoice_id: row.invoice_id != null ? String(row.invoice_id) : null,
        description: String(row.description ?? ""),
        unit_cost: Number(row.unit_cost ?? 0) || 0,
        qty: Math.max(1, Number(row.qty ?? 1) || 1),
        amount: Number(row.amount ?? 0) || 0,
        project_id: row.project_id != null ? String(row.project_id) : null,
        project_name: row.project_name != null ? String(row.project_name) : null,
        is_installment: Boolean(row.is_installment),
        installment_current: Math.max(1, Number(row.installment_current ?? 1) || 1),
        installment_total: Math.max(1, Number(row.installment_total ?? 1) || 1),
        invoice_status: invoiceStatus,
      };
    });
    setInvoices(mappedInvoices);
    setProjects(mappedProjects);
    setInvoiceLineItems(mappedLineItems);
    setLoadingData(false);
  }, []);

  useEffect(() => {
    void loadFinancialData();
  }, [loadFinancialData]);

  const applyInvoiceStatusChange = async (invoiceId: string, newStatus: DbInvoice["status"], previousStatus: DbInvoice["status"]) => {
    setInvoices((list) => list.map((inv) => (inv.id === invoiceId ? { ...inv, status: newStatus } : inv)));
    setInvoiceStatusMenu(null);
    const { error } = await supabase.from("invoices").update({ status: newStatus }).eq("id", invoiceId);
    if (error) {
      console.error("[supabase] invoice status update failed:", error.message);
      setInvoices((list) => list.map((inv) => (inv.id === invoiceId ? { ...inv, status: previousStatus } : inv)));
      return;
    }
    await loadFinancialData();
  };

  const kpiDefs = useMemo(
    () => [
      { label: "Invoices", value: String(invoices.length), fraction: `${invoices.length} total` },
      { label: "Paid", value: String(paidCount), fraction: `${paidCount} / ${invoices.length || 1}` },
      { label: "Total Invested", value: formatCurrency(totalInvested), fraction: "Paid invoices" },
    ],
    [invoices.length, paidCount, totalInvested],
  );

  const kpiProgressWidths = useMemo(() => {
    const invPct = Math.min(100, (invoices.length / 20) * 100);
    const paidPct = invoices.length ? Math.min(100, (paidCount / invoices.length) * 100) : 0;
    const investPct = invoices.length > 0 ? Math.min(100, (totalInvested / Math.max(1, invoices.reduce((a, i) => a + i.amount, 0))) * 100) : 0;
    return [invPct, paidPct, investPct];
  }, [invoices.length, paidCount, invoices, totalInvested]);

  const projectRows = useMemo(
    () => {
      const grouped = new Map<
        string,
        {
          total: number;
          paid: number;
          name: string;
          projectId: string | null;
          installmentPaid: number;
          installmentTotal: number;
          hasInstallments: boolean;
        }
      >();
      for (const item of invoiceLineItems) {
        const fallbackName = (item.project_name ?? "").trim() || "Unassigned";
        const projectById = item.project_id ? projects.find((p) => p.id === item.project_id) : null;
        const name = projectById?.name ?? fallbackName;
        const key = item.project_id ? `id:${item.project_id}` : `name:${name.toLowerCase()}`;
        const cur = grouped.get(key) ?? {
          total: 0,
          paid: 0,
          name,
          projectId: item.project_id,
          installmentPaid: 0,
          installmentTotal: 0,
          hasInstallments: false,
        };
        cur.total += item.amount;
        if (item.invoice_status === "paid") cur.paid += item.amount;
        if (item.is_installment) {
          cur.hasInstallments = true;
          cur.installmentTotal = Math.max(cur.installmentTotal, Math.max(1, Number(item.installment_total) || 1));
          if (item.invoice_status === "paid") {
            cur.installmentPaid += 1;
          }
        }
        grouped.set(key, cur);
      }
      return Array.from(grouped.values()).map((agg) => {
        const completion = agg.total > 0 ? Math.round((agg.paid / agg.total) * 100) : 0;
        return {
          name: agg.name,
          total: agg.total,
          paid: agg.paid,
          remaining: agg.total - agg.paid,
          completion,
          projectLink: agg.projectId ? `/projects/${agg.projectId}` : null,
          installmentPaid: agg.installmentPaid,
          installmentTotal: agg.hasInstallments ? agg.installmentTotal : 0,
        };
      });
    },
    [invoiceLineItems, projects],
  );

  const summaryTotals = useMemo(() => {
    const total = projectRows.reduce((a, r) => a + r.total, 0);
    const paid = projectRows.reduce((a, r) => a + r.paid, 0);
    const remaining = total - paid;
    const completion = total > 0 ? Math.round((paid / total) * 100) : 0;
    return { total, paid, remaining, completion };
  }, [projectRows]);

  const subtotal = useMemo(
    () => lineItems.reduce((acc, li) => acc + li.amount, 0),
    [lineItems],
  );
  const taxAmount = useMemo(() => (subtotal * taxRate) / 100, [subtotal, taxRate]);
  const invoiceTotal = subtotal + taxAmount + shipping;

  const updateLineItem = (id: string, patch: Partial<Omit<LineItem, "id">>) => {
    setLineItems((prev) =>
      prev.map((li) => {
        if (li.id !== id) return li;
        const merged = { ...li, ...patch };
        const normalizedQty = Math.max(1, Number(merged.qty) || 1);
        const normalizedUnitCost = Number(merged.unitCost) || 0;
        const normalizedInstallmentTotal = Math.max(1, Number(merged.installmentTotal) || 1);
        const normalizedInstallmentCurrent = Math.min(
          normalizedInstallmentTotal,
          Math.max(1, Number(merged.installmentCurrent) || 1),
        );
        return {
          ...merged,
          qty: normalizedQty,
          unitCost: normalizedUnitCost,
          amount: normalizedUnitCost * normalizedQty,
          installmentCurrent: normalizedInstallmentCurrent,
          installmentTotal: normalizedInstallmentTotal,
        };
      }),
    );
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: `li-${Date.now()}`,
        description: "",
        unitCost: 0,
        qty: 1,
        amount: 0,
        projectId: null,
        projectName: null,
        isInstallment: false,
        installmentCurrent: 1,
        installmentTotal: 1,
      },
    ]);
  };

  const removeLineItem = (id: string) => {
    setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((li) => li.id !== id)));
  };

  const openEditInvoiceModal = (invoice: DbInvoice) => {
    const modalLineItems = invoiceLineItems
      .filter((item) => item.invoice_id === invoice.id)
      .map((item) => ({
        id: item.id || `li-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        description: item.description || "",
        unitCost: Number(item.unit_cost) || 0,
        qty: Math.max(1, Number(item.qty) || 1),
        amount: Number(item.amount) || 0,
        projectId: item.project_id,
        projectName: item.project_name,
        isInstallment: Boolean(item.is_installment),
        installmentCurrent: Math.max(1, Number(item.installment_current) || 1),
        installmentTotal: Math.max(1, Number(item.installment_total) || 1),
      }));

    setEditModal({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number ?? "",
      issueDate: invoice.issue_date ?? todayIso(),
      dueDate: invoice.due_date ?? "",
      billedTo: invoice.project_name ?? "",
      status: invoice.status,
      linkedProjectIds: invoice.project_ids.length > 0 ? invoice.project_ids : invoice.project_id ? [invoice.project_id] : [],
      lineItems:
        modalLineItems.length > 0
          ? modalLineItems
          : [
              {
                id: `li-${Date.now()}`,
                description: "",
                unitCost: 0,
                qty: 1,
                amount: 0,
                projectId: null,
                projectName: null,
                isInstallment: false,
                installmentCurrent: 1,
                installmentTotal: 1,
              },
            ],
      taxRate: 0,
      shipping: 0,
      saving: false,
    });
  };

  const updateEditLineItem = (id: string, patch: Partial<Omit<LineItem, "id">>) => {
    setEditModal((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        lineItems: prev.lineItems.map((li) => {
          if (li.id !== id) return li;
          const merged = { ...li, ...patch };
          const normalizedQty = Math.max(1, Number(merged.qty) || 1);
          const normalizedUnitCost = Number(merged.unitCost) || 0;
          const normalizedInstallmentTotal = Math.max(1, Number(merged.installmentTotal) || 1);
          const normalizedInstallmentCurrent = Math.min(
            normalizedInstallmentTotal,
            Math.max(1, Number(merged.installmentCurrent) || 1),
          );
          return {
            ...merged,
            qty: normalizedQty,
            unitCost: normalizedUnitCost,
            amount: normalizedUnitCost * normalizedQty,
            installmentCurrent: normalizedInstallmentCurrent,
            installmentTotal: normalizedInstallmentTotal,
          };
        }),
      };
    });
  };

  const addEditLineItem = () => {
    setEditModal((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        lineItems: [
          ...prev.lineItems,
          {
            id: `li-${Date.now()}`,
            description: "",
            unitCost: 0,
            qty: 1,
            amount: 0,
            projectId: null,
            projectName: null,
            isInstallment: false,
            installmentCurrent: 1,
            installmentTotal: 1,
          },
        ],
      };
    });
  };

  const removeEditLineItem = (id: string) => {
    setEditModal((prev) => {
      if (!prev) return prev;
      if (prev.lineItems.length <= 1) return prev;
      return {
        ...prev,
        lineItems: prev.lineItems.filter((li) => li.id !== id),
      };
    });
  };

  const openPdfModal = (fileName: string, url?: string | null) => {
    const resolvedUrl = url || DEMO_PDF_URL;
    if (invoiceUrlLooksHtml(fileName, resolvedUrl) && resolvedUrl !== DEMO_PDF_URL) {
      setPdfModal({ fileName, url: resolvedUrl, srcDoc: null, loadingPreview: true });
      void fetch(resolvedUrl)
        .then((res) => res.text())
        .then((text) => {
          setPdfModal((prev) =>
            prev && prev.url === resolvedUrl && prev.fileName === fileName
              ? { ...prev, srcDoc: text, loadingPreview: false }
              : prev,
          );
        })
        .catch((err) => {
          console.error("[financial] invoice HTML preview fetch failed:", err);
          setPdfModal((prev) =>
            prev && prev.url === resolvedUrl ? { ...prev, srcDoc: null, loadingPreview: false } : prev,
          );
        });
      return;
    }
    setPdfModal({ fileName, url: resolvedUrl, srcDoc: null, loadingPreview: false });
  };

  const getInvoiceHtmlFormData = (): InvoiceHtmlFormData => ({
    from: "Nexa Media Ltda | Otus Media",
    invoiceNumber,
    dateOfIssue: issueDate,
    dueDate: dueDateGen,
    billedTo,
    purchaseOrder,
    lineItems: lineItems.map((li) => ({
      description: li.description,
      unitCost: li.unitCost,
      qty: li.qty,
      isInstallment: li.isInstallment,
      installmentCurrent: li.installmentCurrent,
      installmentTotal: li.installmentTotal,
    })),
    subtotal,
    taxRate,
    taxAmount,
    shipping,
    invoiceTotal,
  });

  const openInvoicePreviewWindow = () => {
    const invoiceHtml = buildInvoiceHtmlString(getInvoiceHtmlFormData(), { previewChrome: true });
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (printWindow) {
      printWindow.document.write(invoiceHtml);
      printWindow.document.close();
      printWindow.focus();
    }
  };

  const openInvoiceDownloadWindow = () => {
    const invoiceHtml = buildInvoiceHtmlString(getInvoiceHtmlFormData(), { previewChrome: false });
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (printWindow) {
      printWindow.document.write(invoiceHtml);
      printWindow.document.close();
      printWindow.focus();
      window.setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white outline-none";

  const editSubtotal = useMemo(
    () => (editModal ? editModal.lineItems.reduce((acc, li) => acc + li.amount, 0) : 0),
    [editModal],
  );
  const editTaxAmount = useMemo(
    () => (editModal ? (editSubtotal * editModal.taxRate) / 100 : 0),
    [editModal, editSubtotal],
  );
  const editInvoiceTotal = useMemo(
    () => (editModal ? editSubtotal + editTaxAmount + editModal.shipping : 0),
    [editModal, editSubtotal, editTaxAmount],
  );

  const saveEditedInvoice = async () => {
    if (!editModal) return;
    setSaveError(null);
    setSaveSuccess(null);
    setEditModal((prev) => (prev ? { ...prev, saving: true } : prev));
    const invoicePayload = {
      invoice_number: editModal.invoiceNumber.trim() || null,
      issue_date: editModal.issueDate || null,
      due_date: editModal.dueDate || null,
      project_name: editModal.billedTo.trim() || null,
      project_id: editModal.linkedProjectIds[0] ?? null,
      project_ids: editModal.linkedProjectIds.length > 0 ? editModal.linkedProjectIds : null,
      status: editModal.status,
      amount: editInvoiceTotal,
    };

    try {
      const { error: updateError } = await supabase.from("invoices").update(invoicePayload).eq("id", editModal.invoiceId);
      if (updateError) {
        setSaveError(`Could not update invoice: ${updateError.message}`);
        return;
      }

      const { error: deleteError } = await supabase
        .from("invoice_line_items")
        .delete()
        .eq("invoice_id", editModal.invoiceId);
      if (deleteError) {
        setSaveError(`Could not refresh invoice line items: ${deleteError.message}`);
        return;
      }

      const lineItemsPayload = editModal.lineItems.map((item) => ({
        invoice_id: editModal.invoiceId,
        description: item.description,
        unit_cost: item.unitCost,
        qty: item.qty,
        amount: item.amount,
        project_id: item.projectId || null,
        project_name: item.projectName || null,
        is_installment: item.isInstallment,
        installment_current: item.installmentCurrent,
        installment_total: item.installmentTotal,
      }));
      const { error: insertItemsError } = await supabase.from("invoice_line_items").insert(lineItemsPayload);
      if (insertItemsError) {
        setSaveError(`Could not save invoice line items: ${insertItemsError.message}`);
        return;
      }

      await loadFinancialData();
      setSaveSuccess("Invoice updated successfully");
      window.setTimeout(() => setSaveSuccess(null), 3000);
      setEditModal(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSaveError(`Could not update invoice: ${message}`);
    } finally {
      setEditModal((prev) => (prev ? { ...prev, saving: false } : prev));
    }
  };

  return (
    <ModuleGuard module="financial">
      <PageHeader title={lt("Financial")} subtitle={lt("Payment tracking, invoice files, and total invested per project.")} />
      {loadingData ? <p className="mb-4 text-sm text-[rgba(255,255,255,0.45)]">{lt("Loading financial data...")}</p> : null}
      {saveSuccess ? (
        <p className="mb-4 rounded-[8px] border px-3 py-2 text-sm text-[#86efac]" style={{ background: "rgba(34,197,94,0.15)", borderColor: "rgba(34,197,94,0.3)" }}>
          Invoice saved successfully
        </p>
      ) : null}
      {saveError ? (
        <p className="mb-4 rounded-[8px] border px-3 py-2 text-sm text-[#fca5a5]" style={{ background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.35)" }}>
          {saveError}
        </p>
      ) : null}

      {/* Section 1 — KPI */}
      <div className="grid gap-3 xl:grid-cols-3">
        {kpiDefs.map((kpi, index) => (
          <button
            key={kpi.label}
            type="button"
            onClick={() => setActiveKpiIndex(index)}
            className={cn(
              "rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#161616] p-4 text-left transition-colors",
              activeKpiIndex === index ? "border-l-2 border-l-[#ff4500] pl-[calc(1rem-2px)]" : "border-l-2 border-l-transparent",
            )}
          >
            <p className="text-[0.7rem] font-normal uppercase tracking-[0.1em] text-[rgba(255,255,255,0.4)]">{lt(kpi.label)}</p>
            <p className="metric-value mt-3 text-4xl font-light text-white tabular-nums">{kpi.value}</p>
            <div className="mt-3 h-[2px] rounded-[2px] bg-[rgba(255,255,255,0.06)]">
              <div
                className="h-[2px] rounded-[2px] bg-[rgba(255,255,255,0.1)]"
                style={{ width: `${kpiProgressWidths[index]}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-light text-[rgba(255,255,255,0.4)]">
              {kpi.fraction === "This month" ? lt("This month") : <span className="mono-num">{kpi.fraction}</span>}
            </p>
          </button>
        ))}
      </div>

      {/* Section 2 — Total invested table */}
      <div className="mt-6 overflow-x-auto rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#161616]">
        <h2 className="border-b border-[var(--border)] px-4 py-3 text-[0.7rem] font-normal uppercase tracking-[0.1em] text-[rgba(255,255,255,0.4)]">
          {lt("Total invested per project")}
        </h2>
        <table className="w-full bg-transparent">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">
              <th className="px-4 py-3 font-normal">{lt("Project")}</th>
              <th className="px-4 py-3 font-normal">{lt("Total")}</th>
              <th className="px-4 py-3 font-normal">{lt("Paid")}</th>
              <th className="px-4 py-3 font-normal">{lt("Remaining")}</th>
              <th className="px-4 py-3 font-normal">{lt("Completion")}</th>
              <th className="px-4 py-3 font-normal">Installments</th>
            </tr>
          </thead>
          <tbody>
            {projectRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-[rgba(255,255,255,0.5)]">
                  No invoices yet — generate your first invoice above
                </td>
              </tr>
            ) : null}
            {projectRows.map((row, i) => (
              <tr
                key={row.projectLink ? `${row.projectLink}-${i}` : `${row.name}-${i}`}
                className={cn("border-b border-[var(--border)]", i % 2 === 1 ? "bg-[rgba(255,255,255,0.02)]" : "")}
              >
                <td className="px-4 py-3 text-sm font-light text-white">
                  {row.projectLink ? (
                    <Link href={row.projectLink} className="text-[#ff9a66] hover:underline">
                      {row.name}
                    </Link>
                  ) : (
                    row.name
                  )}
                </td>
                <td className="mono-num px-4 py-3 text-sm font-light tabular-nums text-white">{formatCurrency(row.total)}</td>
                <td className="mono-num px-4 py-3 text-sm font-light tabular-nums text-white">{formatCurrency(row.paid)}</td>
                <td className="mono-num px-4 py-3 text-sm font-light tabular-nums text-[rgba(255,255,255,0.65)]">
                  {formatCurrency(row.remaining)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-[2px] min-w-[64px] flex-1 rounded-[2px] bg-[rgba(255,255,255,0.15)]">
                      <div
                        className={cn(
                          "h-[2px] rounded-[2px]",
                          row.completion > 80 ? "bg-[#ff4500]" : "bg-[rgba(255,255,255,0.35)]",
                        )}
                        style={{ width: `${Math.min(100, row.completion)}%` }}
                      />
                    </div>
                    <span className="mono-num text-xs font-light tabular-nums text-[rgba(255,255,255,0.5)]">{row.completion}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs font-light text-[rgba(255,255,255,0.65)]">
                  {row.installmentTotal > 0 ? `${row.installmentPaid} of ${row.installmentTotal} installments paid` : ""}
                </td>
              </tr>
            ))}
            <tr className="bg-[rgba(255,255,255,0.04)]">
              <td className="px-4 py-3 text-sm font-semibold text-white">{lt("Total")}</td>
              <td className="mono-num px-4 py-3 text-sm font-semibold tabular-nums text-white">{formatCurrency(summaryTotals.total)}</td>
              <td className="mono-num px-4 py-3 text-sm font-semibold tabular-nums text-white">{formatCurrency(summaryTotals.paid)}</td>
              <td className="mono-num px-4 py-3 text-sm font-semibold tabular-nums text-white">
                {formatCurrency(summaryTotals.remaining)}
              </td>
              <td className="mono-num px-4 py-3 text-sm font-semibold tabular-nums text-white">{summaryTotals.completion}%</td>
              <td className="px-4 py-3 text-sm font-semibold text-white">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 3 — Invoices list */}
      <Card className="mt-6 rounded-[8px] border-[rgba(255,255,255,0.06)] bg-[#161616]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[0.7rem] font-normal uppercase tracking-[0.1em] text-[rgba(255,255,255,0.4)]">INVOICES</h2>
        </div>
        <div className="mt-4 overflow-x-auto rounded-[8px] border border-[var(--border)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">
                <th className="px-3 py-2.5 font-normal">Filename / Invoice</th>
                <th className="px-3 py-2.5 font-normal">Project</th>
                <th className="px-3 py-2.5 font-normal">{lt("Issue date")}</th>
                <th className="px-3 py-2.5 font-normal">Amount</th>
                <th className="px-3 py-2.5 font-normal">{lt("Status")}</th>
                <th className="px-3 py-2.5 font-normal text-right">{lt("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-[rgba(255,255,255,0.5)]">No invoices yet</td>
                </tr>
              ) : null}
              {invoices.map((invoice, i) => (
                <tr key={invoice.id} className={cn("border-b border-[var(--border)]", i % 2 === 1 ? "bg-[rgba(255,255,255,0.02)]" : "")}>
                  <td className="px-3 py-2.5 text-sm font-light text-white">{invoice.invoice_number ?? invoice.filename ?? "—"}</td>
                  <td className="px-3 py-2.5 text-sm font-light text-white">
                    {(() => {
                      const ids =
                        invoice.project_ids.length > 0
                          ? invoice.project_ids
                          : invoice.project_id
                            ? [invoice.project_id]
                            : [];
                      if (ids.length === 0) return invoice.project_name ?? "—";
                      return ids.map((pid, idx) => (
                        <span key={pid}>
                          {idx > 0 ? <span className="text-[rgba(255,255,255,0.35)]">, </span> : null}
                          <Link href={`/projects/${pid}`} className="text-[#ff9a66] hover:underline">
                            {projects.find((p) => p.id === pid)?.name ?? "—"}
                          </Link>
                        </span>
                      ));
                    })()}
                  </td>
                  <td className="mono-num px-3 py-2.5 text-xs font-light tabular-nums text-[rgba(255,255,255,0.5)]">
                    {invoice.issue_date ?? "—"}
                  </td>
                  <td className="mono-num px-3 py-2.5 text-sm font-light tabular-nums text-white">{formatCurrency(invoice.amount)}</td>
                  <td className="relative px-3 py-2.5">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        const rect = event.currentTarget.getBoundingClientRect();
                        const { top, left } = getInvoiceStatusDropdownPosition(rect);
                        setInvoiceStatusMenu((prev) =>
                          prev?.invoiceId === invoice.id ? null : { invoiceId: invoice.id, top, left },
                        );
                      }}
                      className="text-left"
                      aria-haspopup="listbox"
                      aria-expanded={invoiceStatusMenu?.invoiceId === invoice.id}
                    >
                      <span
                        className={cn(
                          "inline-flex cursor-pointer rounded-full border px-2 py-0.5 text-[0.68rem] font-normal",
                          statusBadgeClass(invoice.status),
                        )}
                      >
                        {invoice.status}
                      </span>
                    </button>
                    {invoiceStatusMenu?.invoiceId === invoice.id
                      ? createPortal(
                          <div
                            className="w-44 rounded-[8px] border border-[var(--border)] bg-[#131313] p-2"
                            style={{ position: "fixed", top: invoiceStatusMenu.top, left: invoiceStatusMenu.left, zIndex: 9999 }}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => event.stopPropagation()}
                            role="listbox"
                          >
                            {INVOICE_STATUS_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                role="option"
                                aria-selected={invoice.status === option.value}
                                onClick={() => void applyInvoiceStatusChange(invoice.id, option.value, invoice.status)}
                                className={cn(
                                  "flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-sm font-light text-white hover:bg-[rgba(255,255,255,0.04)]",
                                  invoice.status === option.value && "bg-[rgba(255,255,255,0.04)]",
                                )}
                              >
                                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", option.dotClass)} aria-hidden />
                                {option.label}
                              </button>
                            ))}
                          </div>,
                          document.body,
                        )
                      : null}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" onClick={() => openPdfModal(invoice.filename ?? "Invoice", invoice.file_url)} className="rounded-lg border border-[var(--border-strong)] bg-transparent px-3 py-1 text-xs font-light text-[rgba(255,255,255,0.75)]">View</button>
                      <button
                        type="button"
                        onClick={() => openEditInvoiceModal(invoice)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-strong)] bg-transparent px-3 py-1 text-xs font-light text-[rgba(255,255,255,0.75)]"
                      >
                        <Pencil className="h-3 w-3" />
                        Edit
                      </button>
                      <a
                        href={invoice.file_url ?? DEMO_PDF_URL}
                        download
                        className="inline-flex items-center rounded-lg border border-[var(--border-strong)] bg-transparent px-3 py-1 text-xs font-light text-[rgba(255,255,255,0.75)]"
                      >
                        Download
                      </a>
                      <button type="button" onClick={() => setDeleteInvoice(invoice)} className="rounded-lg border border-[rgba(239,68,68,0.35)] px-3 py-1 text-xs text-[#fca5a5]">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Section 4 — Generator */}
      {canGenerateInvoice ? (
      <Card className="mt-6 rounded-[8px] border-[rgba(255,255,255,0.06)] bg-[#161616]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[0.7rem] font-normal uppercase tracking-[0.1em] text-[rgba(255,255,255,0.4)]">{lt("Invoice generator")}</h2>
          <button
            type="button"
            onClick={() => setGeneratorCollapsed((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2.5 py-1.5 text-xs text-[rgba(255,255,255,0.75)]"
          >
            {generatorCollapsed ? (
              <>
                Generate Invoice <ChevronDown className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Collapse <ChevronUp className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
        {!generatorCollapsed ? (
          <>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">{lt("Invoice number")}</span>
            <input className={inputClass} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">{lt("Date of issue")}</span>
            <input type="date" className={inputClass} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">{lt("Due date")}</span>
            <input type="date" className={inputClass} value={dueDateGen} onChange={(e) => setDueDateGen(e.target.value)} />
          </label>
          <label className="block space-y-1">
            <span className="text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">{lt("Billed to")}</span>
            <input className={inputClass} value={billedTo} onChange={(e) => setBilledTo(e.target.value)} placeholder={lt("Company name")} />
          </label>
          <label className="block space-y-1 md:col-span-2">
            <span className="text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">LINKED PROJECTS</span>
            <select
              className={inputClass}
              value=""
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                setLinkedProjectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
                e.target.value = "";
              }}
            >
              <option value="">{lt("Select project to add or remove")}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {linkedProjectIds.includes(p.id) ? "✓ " : ""}
                  {p.name}
                </option>
              ))}
            </select>
            <div className="mt-2 flex flex-wrap gap-2">
              {linkedProjectIds.map((id) => {
                const p = projects.find((pr) => pr.id === id);
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.06)] px-2.5 py-1 text-xs font-light text-white"
                  >
                    {p?.name ?? id.slice(0, 8)}
                    <button
                      type="button"
                      className="rounded p-0.5 text-[rgba(255,255,255,0.45)] hover:text-white"
                      aria-label={lt("Remove")}
                      onClick={() => setLinkedProjectIds((prev) => prev.filter((x) => x !== id))}
                    >
                      <X className="h-3 w-3" strokeWidth={2} />
                    </button>
                  </span>
                );
              })}
            </div>
          </label>
          <label className="block space-y-1 md:col-span-2">
            <span className="text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">{lt("Purchase order")}</span>
            <input className={inputClass} value={purchaseOrder} onChange={(e) => setPurchaseOrder(e.target.value)} />
          </label>
        </div>

        <div className="mt-6 overflow-x-auto rounded-[8px] border border-[var(--border)]">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">
                <th className="px-3 py-2 font-normal">{lt("Description")}</th>
                <th className="px-3 py-2 font-normal">{lt("Unit cost")}</th>
                <th className="px-3 py-2 font-normal">{lt("Qty")}</th>
                <th className="px-3 py-2 font-normal">{lt("Amount")}</th>
                <th className="px-3 py-2 font-normal">Linked Project</th>
                <th className="px-3 py-2 font-normal">Installment?</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li, i) => (
                <tr key={li.id} className={cn("border-b border-[var(--border)]", i % 2 === 1 ? "bg-[rgba(255,255,255,0.02)]" : "")}>
                  <td className="px-3 py-2">
                    <input
                      className={inputClass}
                      value={li.description}
                      onChange={(e) => updateLineItem(li.id, { description: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={cn(inputClass, "mono-num tabular-nums")}
                      value={li.unitCost || ""}
                      onChange={(e) => updateLineItem(li.id, { unitCost: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      className={cn(inputClass, "mono-num tabular-nums")}
                      value={li.qty}
                      onChange={(e) => updateLineItem(li.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </td>
                  <td className="mono-num px-3 py-2 text-sm font-light tabular-nums text-[rgba(255,255,255,0.75)]">
                    {formatCurrency(li.amount)}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className={cn(inputClass, "w-[180px]")}
                      value={li.projectId ?? ""}
                      onChange={(e) => {
                        const projectId = e.target.value || null;
                        const projectName = projectId ? projects.find((p) => p.id === projectId)?.name ?? null : null;
                        updateLineItem(li.id, { projectId, projectName });
                      }}
                    >
                      <option value="">No project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1 text-xs text-[rgba(255,255,255,0.75)]">
                        <input
                          type="checkbox"
                          checked={li.isInstallment}
                          onChange={(e) =>
                            updateLineItem(li.id, {
                              isInstallment: e.target.checked,
                              installmentCurrent: 1,
                              installmentTotal: 1,
                            })
                          }
                        />
                        Installment?
                      </label>
                      {li.isInstallment ? (
                        <div className="flex items-center gap-2 text-xs text-[rgba(255,255,255,0.65)]">
                          <input
                            type="number"
                            min={1}
                            className={cn(inputClass, "mono-num w-[60px] px-2 py-1 tabular-nums")}
                            value={li.installmentCurrent}
                            onChange={(e) =>
                              updateLineItem(li.id, {
                                installmentCurrent: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                          />
                          <span>of</span>
                          <input
                            type="number"
                            min={1}
                            className={cn(inputClass, "mono-num w-[60px] px-2 py-1 tabular-nums")}
                            value={li.installmentTotal}
                            onChange={(e) =>
                              updateLineItem(li.id, {
                                installmentTotal: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                          />
                          <span className="text-[rgba(255,255,255,0.55)]">
                            {`Installment ${li.installmentCurrent} of ${li.installmentTotal}`}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeLineItem(li.id)}
                      className="text-xs font-light text-[rgba(255,255,255,0.4)] hover:text-white"
                    >
                      {lt("Remove")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" onClick={addLineItem} className="mt-2 text-xs font-light text-[rgba(255,255,255,0.5)] hover:text-white">
          {lt("+ Add line")}
        </button>

        <div className="mt-6 grid gap-3 md:max-w-md md:ml-auto">
          <div className="flex justify-between text-sm font-light tabular-nums text-[rgba(255,255,255,0.75)]">
            <span>{lt("Subtotal")}</span>
            <span className="mono-num">{formatCurrency(subtotal)}</span>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm font-light text-[rgba(255,255,255,0.75)]">
            <span>{lt("Tax rate (%)")}</span>
            <input
              type="number"
              min={0}
              step="0.1"
              className={cn(inputClass, "mono-num w-28 tabular-nums")}
              value={taxRate}
              onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
            />
          </label>
          <div className="flex justify-between text-sm font-light tabular-nums text-[rgba(255,255,255,0.75)]">
            <span>{lt("Tax amount")}</span>
            <span className="mono-num">{formatCurrency(taxAmount)}</span>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm font-light text-[rgba(255,255,255,0.75)]">
            <span>{lt("Shipping")}</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className={cn(inputClass, "mono-num w-40 tabular-nums")}
              value={shipping}
              onChange={(e) => setShipping(Number(e.target.value) || 0)}
            />
          </label>
          <div className="flex justify-between border-t border-[var(--border)] pt-3 text-2xl font-light tabular-nums text-white">
            <span>{lt("Invoice total")}</span>
            <span className="mono-num">{formatCurrency(invoiceTotal)}</span>
          </div>
        </div>

        <div className="mt-8 rounded-[8px] border border-[var(--border)] bg-[#101010] p-4 text-sm font-light text-[rgba(255,255,255,0.75)]">
          <p className="text-[0.65rem] font-normal uppercase tracking-[0.1em] text-[rgba(255,255,255,0.4)]">{lt("Bank account details")}</p>
          <p className="mt-2">
            {lt("Bank:")} Community Federal Savings Bank
          </p>
          <p>
            {lt("Account Number:")} <span className="mono-num">889037781-7</span>
          </p>
          <p>
            {lt("ACH Routing:")} <span className="mono-num">026073150</span>
          </p>
          <p>
            {lt("Wire Routing:")} <span className="mono-num">026073008</span>
          </p>
          <p>
            {lt("SWIFT:")} <span className="mono-num">CMFGUS33</span>
          </p>
          <p>
            {lt("Account Holder:")} Inter &amp; Co Global Account — Matheus Jeovane / Nexa Media Ltda.
          </p>
        </div>
        <div className="mt-4 rounded-[8px] border border-[var(--border)] bg-[#101010] p-4 text-sm font-light text-[rgba(255,255,255,0.75)]">
          <p className="text-[0.65rem] font-normal uppercase tracking-[0.1em] text-[rgba(255,255,255,0.4)]">{lt("From")}</p>
          <p className="mt-2">Nexa Media Ltda | Otus Media</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={openInvoicePreviewWindow} className="btn-primary rounded-lg px-4 py-2 text-xs">
            {lt("Preview Invoice")}
          </button>
          <button type="button" onClick={openInvoiceDownloadWindow} className="btn-primary rounded-lg px-4 py-2 text-xs">
            {lt("Download Invoice")}
          </button>
          <button
            type="button"
            disabled={savingGenerated}
            onClick={async () => {
              console.log("Starting invoice save...");
              setSaveError(null);
              setSaveSuccess(null);
              setSavingGenerated(true);

              const trimmedInvoiceNumber = invoiceNumber.trim();
              const validationSnapshot = {
                invoiceNumber: trimmedInvoiceNumber || "(empty — will auto-generate)",
                issueDate,
                dueDateGen,
                billedTo,
                purchaseOrder,
                linkedProjectIds,
                lineItemsCount: lineItems.length,
                invoiceTotal,
                taxRate,
                shipping,
              };
              console.log("[financial] Save validation — fields checked:", validationSnapshot);

              const resolvedInvoiceNumber = trimmedInvoiceNumber || `INV-${Date.now()}`;
              if (!trimmedInvoiceNumber) {
                console.log("[financial] Auto-generated invoice number:", resolvedInvoiceNumber);
                setInvoiceNumber(resolvedInvoiceNumber);
              }

              const formForHtml: InvoiceHtmlFormData = {
                ...getInvoiceHtmlFormData(),
                invoiceNumber: resolvedInvoiceNumber,
              };
              const invoiceHtml = buildInvoiceHtmlString(formForHtml, { previewChrome: false });
              const blob = new Blob([invoiceHtml], { type: "text/html;charset=utf-8" });
              console.log("[financial] HTML blob size (bytes):", blob.size, "type:", blob.type);

              const storageBucket = "invoices";
              const fileName = `invoice-${resolvedInvoiceNumber.replace(/[^\w.-]+/g, "_")}-${Date.now()}.html`;

              try {
                const { data: uploadData, error: uploadError } = await supabase.storage.from(storageBucket).upload(fileName, blob, {
                  contentType: "text/html; charset=utf-8",
                  upsert: false,
                });
                console.log("Upload result:", uploadData, uploadError);

                if (uploadError) {
                  const msg = uploadError.message || String(uploadError);
                  console.error("[financial] Storage upload failed:", msg);
                  setSaveError(`Storage upload failed: ${msg}`);
                  return;
                }

                const pub = supabase.storage.from(storageBucket).getPublicUrl(fileName);
                const publicUrl = pub.data.publicUrl;
                console.log("Public URL:", publicUrl);

                const invoicePayload = {
                  filename: fileName,
                  amount: invoiceTotal,
                  status: "pending" as const,
                  issue_date: issueDate,
                  due_date: dueDateGen || null,
                  project_name: billedTo.trim() || null,
                  project_id: linkedProjectIds[0] ?? null,
                  project_ids: linkedProjectIds.length > 0 ? linkedProjectIds : null,
                  invoice_number: resolvedInvoiceNumber,
                  file_url: publicUrl,
                };
                console.log("Inserting invoice:", invoicePayload);

                const { data: insertData, error: insertError } = await supabase
                  .from("invoices")
                  .insert([invoicePayload])
                  .select("id")
                  .single();
                console.log("Insert result:", insertData, insertError);

                if (insertError) {
                  const msg = insertError.message || String(insertError);
                  console.error("[financial] Supabase insert failed:", msg, insertError);
                  setSaveError(`Could not save invoice: ${msg}`);
                  return;
                }
                const invoiceId = String(insertData?.id ?? "");
                if (!invoiceId) {
                  setSaveError("Could not save invoice line items: missing invoice ID.");
                  return;
                }
                const lineItemsPayload = lineItems.map((item) => ({
                  invoice_id: invoiceId,
                  description: item.description,
                  unit_cost: item.unitCost,
                  qty: item.qty,
                  amount: item.amount,
                  project_id: item.projectId || null,
                  project_name: item.projectName || null,
                  is_installment: item.isInstallment,
                  installment_current: item.installmentCurrent,
                  installment_total: item.installmentTotal,
                }));
                const { error: lineItemsInsertError } = await supabase.from("invoice_line_items").insert(lineItemsPayload);
                if (lineItemsInsertError) {
                  const msg = lineItemsInsertError.message || String(lineItemsInsertError);
                  console.error("[financial] invoice line items insert failed:", msg, lineItemsInsertError);
                  setSaveError(`Could not save invoice line items: ${msg}`);
                  return;
                }

                setGeneratorCollapsed(true);
                setSaveSuccess("Invoice saved successfully");
                window.setTimeout(() => setSaveSuccess(null), 3000);
                await loadFinancialData();
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                console.error("[financial] Unexpected save error:", err);
                setSaveError(`Save failed: ${msg}`);
              } finally {
                setSavingGenerated(false);
              }
            }}
            className="rounded-lg border border-[var(--border-strong)] px-4 py-2 text-xs text-white disabled:opacity-50"
          >
            {savingGenerated ? "Saving..." : "Save to Financial Records"}
          </button>
        </div>
        </>
        ) : null}
      </Card>
      ) : null}

      {editModal ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4">
          <div className="flex h-[90vh] w-full max-w-[800px] flex-col overflow-hidden rounded-[8px] border border-[var(--border)] bg-[#161616]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
              <p className="text-sm font-light text-white">Edit invoice</p>
              <button
                type="button"
                onClick={() => setEditModal(null)}
                className="rounded-lg border border-[var(--border-strong)] p-2 text-[rgba(255,255,255,0.75)]"
                aria-label={lt("Close")}
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">Invoice number</span>
                  <input
                    className={inputClass}
                    value={editModal.invoiceNumber}
                    onChange={(e) => setEditModal((prev) => (prev ? { ...prev, invoiceNumber: e.target.value } : prev))}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">Date of issue</span>
                  <input
                    type="date"
                    className={inputClass}
                    value={editModal.issueDate}
                    onChange={(e) => setEditModal((prev) => (prev ? { ...prev, issueDate: e.target.value } : prev))}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">Due date</span>
                  <input
                    type="date"
                    className={inputClass}
                    value={editModal.dueDate}
                    onChange={(e) => setEditModal((prev) => (prev ? { ...prev, dueDate: e.target.value } : prev))}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">Status</span>
                  <select
                    className={inputClass}
                    value={editModal.status}
                    onChange={(e) =>
                      setEditModal((prev) =>
                        prev
                          ? {
                              ...prev,
                              status:
                                e.target.value === "paid" || e.target.value === "pending" || e.target.value === "overdue"
                                  ? e.target.value
                                  : "pending",
                            }
                          : prev,
                      )
                    }
                  >
                    <option value="pending">pending</option>
                    <option value="paid">paid</option>
                    <option value="overdue">overdue</option>
                  </select>
                </label>
                <label className="block space-y-1 md:col-span-2">
                  <span className="text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">Billed to</span>
                  <input
                    className={inputClass}
                    value={editModal.billedTo}
                    onChange={(e) => setEditModal((prev) => (prev ? { ...prev, billedTo: e.target.value } : prev))}
                  />
                </label>
                <label className="block space-y-1 md:col-span-2">
                  <span className="text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">LINKED PROJECTS</span>
                  <select
                    className={inputClass}
                    value=""
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) return;
                      setEditModal((prev) =>
                        prev
                          ? {
                              ...prev,
                              linkedProjectIds: prev.linkedProjectIds.includes(id)
                                ? prev.linkedProjectIds.filter((x) => x !== id)
                                : [...prev.linkedProjectIds, id],
                            }
                          : prev,
                      );
                      e.target.value = "";
                    }}
                  >
                    <option value="">Select project to add or remove</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {editModal.linkedProjectIds.includes(p.id) ? "✓ " : ""}
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {editModal.linkedProjectIds.map((id) => {
                      const p = projects.find((pr) => pr.id === id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[rgba(255,255,255,0.06)] px-2.5 py-1 text-xs font-light text-white"
                        >
                          {p?.name ?? id.slice(0, 8)}
                          <button
                            type="button"
                            className="rounded p-0.5 text-[rgba(255,255,255,0.45)] hover:text-white"
                            aria-label={lt("Remove")}
                            onClick={() =>
                              setEditModal((prev) =>
                                prev ? { ...prev, linkedProjectIds: prev.linkedProjectIds.filter((x) => x !== id) } : prev,
                              )
                            }
                          >
                            <X className="h-3 w-3" strokeWidth={2} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </label>
              </div>

              <div className="mt-6 overflow-x-auto rounded-[8px] border border-[var(--border)]">
                <table className="w-full min-w-[920px]">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-left text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">
                      <th className="px-3 py-2 font-normal">Description</th>
                      <th className="px-3 py-2 font-normal">Unit cost</th>
                      <th className="px-3 py-2 font-normal">Qty</th>
                      <th className="px-3 py-2 font-normal">Amount</th>
                      <th className="px-3 py-2 font-normal">Linked Project</th>
                      <th className="px-3 py-2 font-normal">Installment?</th>
                      <th className="px-3 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {editModal.lineItems.map((li, i) => (
                      <tr key={li.id} className={cn("border-b border-[var(--border)]", i % 2 === 1 ? "bg-[rgba(255,255,255,0.02)]" : "")}>
                        <td className="px-3 py-2">
                          <input
                            className={inputClass}
                            value={li.description}
                            onChange={(e) => updateEditLineItem(li.id, { description: e.target.value })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className={cn(inputClass, "mono-num tabular-nums")}
                            value={li.unitCost || ""}
                            onChange={(e) => updateEditLineItem(li.id, { unitCost: Number(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={1}
                            className={cn(inputClass, "mono-num tabular-nums")}
                            value={li.qty}
                            onChange={(e) => updateEditLineItem(li.id, { qty: Math.max(1, Number(e.target.value) || 1) })}
                          />
                        </td>
                        <td className="mono-num px-3 py-2 text-sm font-light tabular-nums text-[rgba(255,255,255,0.75)]">
                          {formatCurrency(li.amount)}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            className={cn(inputClass, "w-[180px]")}
                            value={li.projectId ?? ""}
                            onChange={(e) => {
                              const projectId = e.target.value || null;
                              const projectName = projectId ? projects.find((p) => p.id === projectId)?.name ?? null : null;
                              updateEditLineItem(li.id, { projectId, projectName });
                            }}
                          >
                            <option value="">No project</option>
                            {projects.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <label className="inline-flex items-center gap-1 text-xs text-[rgba(255,255,255,0.75)]">
                              <input
                                type="checkbox"
                                checked={li.isInstallment}
                                onChange={(e) =>
                                  updateEditLineItem(li.id, {
                                    isInstallment: e.target.checked,
                                    installmentCurrent: 1,
                                    installmentTotal: 1,
                                  })
                                }
                              />
                              Installment?
                            </label>
                            {li.isInstallment ? (
                              <div className="flex items-center gap-2 text-xs text-[rgba(255,255,255,0.65)]">
                                <input
                                  type="number"
                                  min={1}
                                  className={cn(inputClass, "mono-num w-[60px] px-2 py-1 tabular-nums")}
                                  value={li.installmentCurrent}
                                  onChange={(e) =>
                                    updateEditLineItem(li.id, {
                                      installmentCurrent: Math.max(1, Number(e.target.value) || 1),
                                    })
                                  }
                                />
                                <span>of</span>
                                <input
                                  type="number"
                                  min={1}
                                  className={cn(inputClass, "mono-num w-[60px] px-2 py-1 tabular-nums")}
                                  value={li.installmentTotal}
                                  onChange={(e) =>
                                    updateEditLineItem(li.id, {
                                      installmentTotal: Math.max(1, Number(e.target.value) || 1),
                                    })
                                  }
                                />
                                <span className="text-[rgba(255,255,255,0.55)]">{`Installment ${li.installmentCurrent} of ${li.installmentTotal}`}</span>
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => removeEditLineItem(li.id)}
                            className="text-xs font-light text-[rgba(255,255,255,0.4)] hover:text-white"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" onClick={addEditLineItem} className="mt-2 text-xs font-light text-[rgba(255,255,255,0.5)] hover:text-white">
                + Add line
              </button>

              <div className="mt-6 grid gap-3 md:ml-auto md:max-w-md">
                <div className="flex justify-between text-sm font-light tabular-nums text-[rgba(255,255,255,0.75)]">
                  <span>Subtotal</span>
                  <span className="mono-num">{formatCurrency(editSubtotal)}</span>
                </div>
                <label className="flex items-center justify-between gap-3 text-sm font-light text-[rgba(255,255,255,0.75)]">
                  <span>Tax rate (%)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    className={cn(inputClass, "mono-num w-28 tabular-nums")}
                    value={editModal.taxRate}
                    onChange={(e) =>
                      setEditModal((prev) => (prev ? { ...prev, taxRate: Number(e.target.value) || 0 } : prev))
                    }
                  />
                </label>
                <div className="flex justify-between text-sm font-light tabular-nums text-[rgba(255,255,255,0.75)]">
                  <span>Tax amount</span>
                  <span className="mono-num">{formatCurrency(editTaxAmount)}</span>
                </div>
                <label className="flex items-center justify-between gap-3 text-sm font-light text-[rgba(255,255,255,0.75)]">
                  <span>Shipping</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={cn(inputClass, "mono-num w-40 tabular-nums")}
                    value={editModal.shipping}
                    onChange={(e) =>
                      setEditModal((prev) => (prev ? { ...prev, shipping: Number(e.target.value) || 0 } : prev))
                    }
                  />
                </label>
                <div className="flex justify-between border-t border-[var(--border)] pt-3 text-2xl font-light tabular-nums text-white">
                  <span>Invoice total</span>
                  <span className="mono-num">{formatCurrency(editInvoiceTotal)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-4 py-3">
              <button
                type="button"
                onClick={() => setEditModal(null)}
                className="rounded-lg border border-[var(--border-strong)] bg-transparent px-4 py-2 text-xs font-light text-[rgba(255,255,255,0.8)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={editModal.saving}
                onClick={() => void saveEditedInvoice()}
                className="rounded-lg border border-[var(--border-strong)] px-4 py-2 text-xs text-white disabled:opacity-50"
              >
                {editModal.saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* View PDF modal */}
      {pdfModal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
          <div className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[8px] border border-[var(--border)] bg-[#161616]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
              <p className="truncate text-sm font-light text-white">{pdfModal.fileName}</p>
              <div className="flex shrink-0 items-center gap-2">
                <a href={pdfModal.url} download className="btn-primary rounded-lg px-3 py-1.5 text-xs">
                  {lt("Download")}
                </a>
                <button
                  type="button"
                  onClick={() => setPdfModal(null)}
                  className="rounded-lg border border-[var(--border-strong)] p-2 text-[rgba(255,255,255,0.75)]"
                  aria-label={lt("Close")}
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            </div>
            {pdfModal.loadingPreview ? (
              <div className="flex min-h-0 flex-1 items-center justify-center bg-[#0a0a0a] text-sm font-light text-[rgba(255,255,255,0.45)]">
                {lt("Loading preview...")}
              </div>
            ) : pdfModal.srcDoc ? (
              <iframe
                title={lt("Invoice preview")}
                srcDoc={pdfModal.srcDoc}
                sandbox="allow-same-origin"
                className="min-h-0 flex-1 w-full bg-white"
              />
            ) : (
              <iframe title={lt("Invoice preview")} src={pdfModal.url} className="min-h-0 flex-1 w-full bg-[#0a0a0a]" />
            )}
          </div>
        </div>
      ) : null}

      <DeleteConfirmModal
        open={deleteInvoice != null}
        title="Delete Invoice"
        message="This will permanently delete the invoice record and file."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => setDeleteInvoice(null)}
        onConfirm={async () => {
          if (!deleteInvoice) return;
          const url = deleteInvoice.file_url ?? "";
          const idx = url.indexOf("/invoices/");
          if (idx >= 0) {
            const path = url.slice(idx + "/invoices/".length);
            const { error: storageErr } = await supabase.storage.from("invoices").remove([path]);
            if (storageErr) console.error("[financial] storage delete", storageErr.message);
          }
          const { error } = await supabase.from("invoices").delete().eq("id", deleteInvoice.id);
          if (error) {
            console.error("[financial] invoice delete", error.message);
            setDeleteInvoice(null);
            return;
          }
          setDeleteInvoice(null);
          setSaveSuccess("Invoice saved successfully");
          window.setTimeout(() => setSaveSuccess(null), 3000);
          await loadFinancialData();
        }}
      />
    </ModuleGuard>
  );
}
