"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleGuard } from "@/components/layout/module-guard";
import { useLanguage } from "@/context/language-context";
import { cn, formatCurrency } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import "./invoice-print.css";

const DEMO_PDF_URL =
  "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

const INVOICE_COLLAPSED_KEY = "invoice-generator-collapsed";

type DbInvoice = {
  id: string;
  filename: string | null;
  amount: number;
  status: "paid" | "pending" | "overdue";
  issue_date: string | null;
  project_name: string | null;
  file_url: string | null;
};

type ProjectInvestRow = {
  name: string;
  total: number;
  paid: number;
  completion: number;
  projectLink: string | null;
};

type LineItem = { id: string; description: string; unitCost: number; qty: number };
type DbProject = { id: string; name: string };

function statusBadgeClass(status: DbInvoice["status"]) {
  if (status === "paid") return "border-[#22c55e]/35 bg-[#22c55e]/12 text-[#86efac]";
  if (status === "pending") return "border-[#f59e0b]/35 bg-[#f59e0b]/12 text-[#fcd34d]";
  return "border-[#ef4444]/35 bg-[#ef4444]/12 text-[#fca5a5]";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function FinancialModule() {
  const { t: lt } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [invoices, setInvoices] = useState<DbInvoice[]>([]);
  const [projects, setProjects] = useState<DbProject[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [savingGenerated, setSavingGenerated] = useState(false);
  const [generatorCollapsed, setGeneratorCollapsed] = useState(true);

  const [activeKpiIndex, setActiveKpiIndex] = useState(0);
  const [pdfModal, setPdfModal] = useState<{ fileName: string; url: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [printMode, setPrintMode] = useState(false);

  const totalInvested = invoices.filter((item) => item.status === "paid").reduce((acc, item) => acc + item.amount, 0);
  const paidCount = invoices.filter((i) => i.status === "paid").length;

  const [invoiceNumber, setInvoiceNumber] = useState("INV-2026-1042");
  const [issueDate, setIssueDate] = useState(todayIso);
  const [dueDateGen, setDueDateGen] = useState("2026-05-15");
  const [billedTo, setBilledTo] = useState("");
  const [purchaseOrder, setPurchaseOrder] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: "li-1", description: "", unitCost: 0, qty: 1 },
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

  const loadFinancialData = useCallback(async () => {
    setLoadingData(true);
    const [invRes, projRes] = await Promise.all([
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("projects").select("id,name"),
    ]);
    if (invRes.error) console.error("[financial] invoices fetch", invRes.error.message);
    if (projRes.error) console.error("[financial] projects fetch", projRes.error.message);

    const mappedInvoices: DbInvoice[] = ((invRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
      id: String(row.id ?? ""),
      filename: row.filename != null ? String(row.filename) : row.file_name != null ? String(row.file_name) : null,
      amount: Number(row.amount ?? 0) || 0,
      status:
        row.status === "paid" || row.status === "pending" || row.status === "overdue"
          ? (row.status as DbInvoice["status"])
          : "pending",
      issue_date: row.issue_date != null ? String(row.issue_date) : row.due_date != null ? String(row.due_date) : null,
      project_name: row.project_name != null ? String(row.project_name) : row.description != null ? String(row.description) : null,
      file_url: row.file_url != null ? String(row.file_url) : null,
    }));
    const mappedProjects: DbProject[] = ((projRes.data as Record<string, unknown>[] | null) ?? []).map((row) => ({
      id: String(row.id ?? ""),
      name: String(row.name ?? ""),
    }));
    setInvoices(mappedInvoices);
    setProjects(mappedProjects);
    setLoadingData(false);
  }, []);

  useEffect(() => {
    void loadFinancialData();
  }, [loadFinancialData]);

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
      const grouped = new Map<string, { total: number; paid: number }>();
      for (const inv of invoices) {
        const key = (inv.project_name ?? "").trim() || "Unassigned";
        const cur = grouped.get(key) ?? { total: 0, paid: 0 };
        cur.total += inv.amount;
        if (inv.status === "paid") cur.paid += inv.amount;
        grouped.set(key, cur);
      }
      return Array.from(grouped.entries()).map(([name, agg]) => {
        const completion = agg.total > 0 ? Math.round((agg.paid / agg.total) * 100) : 0;
        const project = projects.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
        return {
          name,
          total: agg.total,
          paid: agg.paid,
          completion,
          projectLink: project ? `/projects/${project.id}` : null,
        };
      });
    },
    [invoices, projects],
  );

  const summaryTotals = useMemo(() => {
    const total = projectRows.reduce((a, r) => a + r.total, 0);
    const paid = projectRows.reduce((a, r) => a + r.paid, 0);
    const remaining = total - paid;
    const completion = total > 0 ? Math.round((paid / total) * 100) : 0;
    return { total, paid, remaining, completion };
  }, [projectRows]);

  const subtotal = useMemo(
    () => lineItems.reduce((acc, li) => acc + li.unitCost * li.qty, 0),
    [lineItems],
  );
  const taxAmount = useMemo(() => (subtotal * taxRate) / 100, [subtotal, taxRate]);
  const invoiceTotal = subtotal + taxAmount + shipping;

  const updateLineItem = (id: string, patch: Partial<Pick<LineItem, "description" | "unitCost" | "qty">>) => {
    setLineItems((prev) => prev.map((li) => (li.id === id ? { ...li, ...patch } : li)));
  };

  const addLineItem = () => {
    setLineItems((prev) => [...prev, { id: `li-${Date.now()}`, description: "", unitCost: 0, qty: 1 }]);
  };

  const removeLineItem = (id: string) => {
    setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((li) => li.id !== id)));
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleUploadFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    Array.from(files).forEach((file) => {
      console.log("[financial] uploaded file selected:", file.name);
    });
    e.target.value = "";
  };

  const openPdfModal = (fileName: string) => {
    setPdfModal({ fileName, url: DEMO_PDF_URL });
  };

  const triggerPrintInvoice = useCallback(() => {
    setPrintMode(true);
    window.setTimeout(() => {
      window.print();
      setPrintMode(false);
    }, 80);
  }, []);

  const invoicePrintBody = (
    <div className="financial-invoice-print">
    <div className="inv">
      <p className="muted">{lt("Invoice")}</p>
      <h1>{invoiceNumber}</h1>
      <div className="meta-grid">
        <div>
          <p className="muted">{lt("Date of issue")}</p>
          <p className="mono-num">{issueDate}</p>
        </div>
        <div>
          <p className="muted">{lt("Due date")}</p>
          <p className="mono-num">{dueDateGen}</p>
        </div>
        <div>
          <p className="muted">{lt("Billed to")}</p>
          <p>{billedTo || "—"}</p>
        </div>
        <div>
          <p className="muted">{lt("Purchase order")}</p>
          <p>{purchaseOrder || "—"}</p>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>{lt("Description")}</th>
            <th className="num">{lt("Unit cost")}</th>
            <th className="num">{lt("Qty")}</th>
            <th className="num">{lt("Amount")}</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((li) => (
            <tr key={li.id}>
              <td>{li.description || "—"}</td>
              <td className="num">{formatCurrency(li.unitCost)}</td>
              <td className="num">{li.qty}</td>
              <td className="num">{formatCurrency(li.unitCost * li.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="totals">
        <div className="totals-row">
          <span>{lt("Subtotal")}</span>
          <span className="tnum">{formatCurrency(subtotal)}</span>
        </div>
        <div className="totals-row">
          <span>
            {lt("Tax")} (<span className="mono-num">{taxRate}%</span>)
          </span>
          <span className="tnum">{formatCurrency(taxAmount)}</span>
        </div>
        <div className="totals-row">
          <span>{lt("Shipping")}</span>
          <span className="tnum">{formatCurrency(shipping)}</span>
        </div>
        <div className="totals-row grand">
          <span>{lt("Total")}</span>
          <span className="tnum">{formatCurrency(invoiceTotal)}</span>
        </div>
      </div>
      <div className="bank">
        <p className="muted">{lt("Bank details")}</p>
        <p>
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
      <p className="from-line">
        {lt("From:")} Nexa Media Ltda | Otus Media
      </p>
    </div>
    </div>
  );

  const inputClass =
    "w-full rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white outline-none";

  return (
    <ModuleGuard module="financial">
      <PageHeader title={lt("Financial")} subtitle={lt("Payment tracking, invoice files, and total invested per project.")} />
      {loadingData ? <p className="mb-4 text-sm text-[rgba(255,255,255,0.45)]">{lt("Loading financial data...")}</p> : null}
      {saveSuccess ? (
        <p className="mb-4 rounded-[8px] border border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.1)] px-3 py-2 text-sm text-[#86efac]">
          {saveSuccess}
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
            </tr>
          </thead>
          <tbody>
            {projectRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-[rgba(255,255,255,0.5)]">
                  No invoices yet — generate your first invoice above
                </td>
              </tr>
            ) : null}
            {projectRows.map((row, i) => (
              <tr
                key={row.name}
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
                  {formatCurrency(row.total - row.paid)}
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
            </tr>
          </tbody>
        </table>
      </div>

      {/* Section 3 — Upload / list */}
      <Card className="mt-6 rounded-[8px] border-[rgba(255,255,255,0.06)] bg-[#161616]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[0.7rem] font-normal uppercase tracking-[0.1em] text-[rgba(255,255,255,0.4)]">
            {lt("Invoice upload / download")}
          </h2>
          <div>
            <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="hidden" multiple onChange={handleUploadFiles} />
            <button type="button" onClick={handleUploadClick} className="btn-primary rounded-lg px-3 py-1.5 text-xs">
              {lt("Upload Invoice")}
            </button>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto rounded-[8px] border border-[var(--border)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">
                <th className="px-3 py-2.5 font-normal">{lt("Filename")}</th>
                <th className="px-3 py-2.5 font-normal">{lt("Issue date")}</th>
                <th className="px-3 py-2.5 font-normal">{lt("Status")}</th>
                <th className="px-3 py-2.5 font-normal text-right">{lt("Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice, i) => (
                <tr key={invoice.id} className={cn("border-b border-[var(--border)]", i % 2 === 1 ? "bg-[rgba(255,255,255,0.02)]" : "")}>
                  <td className="px-3 py-2.5 text-sm font-light text-white">{invoice.filename ?? "—"}</td>
                  <td className="mono-num px-3 py-2.5 text-xs font-light tabular-nums text-[rgba(255,255,255,0.5)]">
                    {invoice.issue_date ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2 py-0.5 text-[0.68rem] font-normal",
                        statusBadgeClass(invoice.status),
                      )}
                    >
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openPdfModal(invoice.filename ?? "Invoice")}
                        className="rounded-lg border border-[var(--border-strong)] bg-transparent px-3 py-1 text-xs font-light text-[rgba(255,255,255,0.75)]"
                      >
                        {lt("View PDF")}
                      </button>
                      <a
                        href={invoice.file_url ?? DEMO_PDF_URL}
                        download
                        className="inline-flex items-center rounded-lg border border-[var(--border-strong)] bg-transparent px-3 py-1 text-xs font-light text-[rgba(255,255,255,0.75)]"
                      >
                        {lt("Download PDF")}
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Section 4 — Generator */}
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
            <span className="text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">{lt("Purchase order")}</span>
            <input className={inputClass} value={purchaseOrder} onChange={(e) => setPurchaseOrder(e.target.value)} />
          </label>
        </div>

        <div className="mt-6 overflow-x-auto rounded-[8px] border border-[var(--border)]">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-[0.65rem] font-light uppercase tracking-[0.08em] text-[rgba(255,255,255,0.4)]">
                <th className="px-3 py-2 font-normal">{lt("Description")}</th>
                <th className="px-3 py-2 font-normal">{lt("Unit cost")}</th>
                <th className="px-3 py-2 font-normal">{lt("Qty")}</th>
                <th className="px-3 py-2 font-normal">{lt("Amount")}</th>
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
                    {formatCurrency(li.unitCost * li.qty)}
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
          <button type="button" onClick={() => setPreviewOpen(true)} className="btn-primary rounded-lg px-4 py-2 text-xs">
            {lt("Preview Invoice")}
          </button>
          <button type="button" onClick={triggerPrintInvoice} className="btn-primary rounded-lg px-4 py-2 text-xs">
            {lt("Download Invoice")}
          </button>
          <button
            type="button"
            disabled={savingGenerated}
            onClick={async () => {
              const htmlSource = printRef.current?.innerHTML ?? "";
              const blob = new Blob([htmlSource], { type: "text/html" });
              const fileName = `invoice-${invoiceNumber}-${Date.now()}.html`;
              setSavingGenerated(true);
              const uploadRes = await supabase.storage.from("invoices").upload(fileName, blob);
              if (uploadRes.error) {
                console.error("[financial] upload generated invoice", uploadRes.error.message);
                setSavingGenerated(false);
                return;
              }
              const pub = supabase.storage.from("invoices").getPublicUrl(fileName);
              const publicUrl = pub.data.publicUrl;
              const insRes = await supabase.from("invoices").insert([
                {
                  filename: fileName,
                  amount: invoiceTotal,
                  status: "pending",
                  issue_date: issueDate,
                  project_name: billedTo || null,
                  file_url: publicUrl,
                },
              ]);
              setSavingGenerated(false);
              if (insRes.error) {
                console.error("[financial] insert generated invoice", insRes.error.message);
                return;
              }
              setSaveSuccess("Invoice saved to Financial Records.");
              window.setTimeout(() => setSaveSuccess(null), 2500);
              await loadFinancialData();
            }}
            className="rounded-lg border border-[var(--border-strong)] px-4 py-2 text-xs text-white disabled:opacity-50"
          >
            {savingGenerated ? "Saving..." : "Save to Financial Records"}
          </button>
        </div>
        </>
        ) : null}
      </Card>

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
            <iframe title={lt("PDF preview")} src={pdfModal.url} className="min-h-0 flex-1 w-full bg-[#0a0a0a]" />
          </div>
        </div>
      ) : null}

      {/* Preview modal — print uses ref duplicate */}
      {previewOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[8px] border border-[var(--border)] bg-[#161616]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
              <p className="text-sm font-light text-white">{lt("Invoice preview")}</p>
              <div className="flex gap-2">
                <button type="button" onClick={triggerPrintInvoice} className="btn-primary rounded-lg px-3 py-1.5 text-xs">
                  {lt("Print / Save PDF")}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-xs font-light text-[rgba(255,255,255,0.75)]"
                >
                  {lt("Close")}
                </button>
              </div>
            </div>
            <div className="overflow-auto bg-white p-6">
              <div>{invoicePrintBody}</div>
            </div>
          </div>
        </div>
      ) : null}

      <div ref={printRef} className="sr-only" aria-hidden>
        {invoicePrintBody}
      </div>
      <style media="print">{`
        body * { visibility: hidden !important; }
        #financial-print-root, #financial-print-root * { visibility: visible !important; }
        #financial-print-root {
          display: block !important;
          position: fixed !important;
          inset: 0 !important;
          background: #fff !important;
          color: #000 !important;
          padding: 24px !important;
          z-index: 999999 !important;
        }
      `}</style>
      {printMode ? (
        <div id="financial-print-root">
          <div className="financial-invoice-print">{invoicePrintBody}</div>
        </div>
      ) : null}
      <p className="mt-3 text-xs text-[rgba(255,255,255,0.35)]">-- Create a public bucket called 'invoices' in Supabase Storage</p>
    </ModuleGuard>
  );
}
