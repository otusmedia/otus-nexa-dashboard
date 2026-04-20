"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleGuard } from "@/components/layout/module-guard";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { cn, formatCurrency } from "@/lib/utils";
import type { InvoiceItem } from "@/types";
import "./invoice-print.css";

const DEMO_PDF_URL =
  "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

const invoiceIssueDate: Record<string, string> = {
  i1: "2026-04-01",
  i2: "2026-05-01",
  i3: "2026-03-15",
};

type ProjectInvestRow = {
  name: string;
  total: number;
  paid: number;
  monthlySpend: number[];
};

const projectInvestData: ProjectInvestRow[] = [];

type LineItem = { id: string; description: string; unitCost: number; qty: number };

function MiniSpendSparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-8 items-end gap-px" aria-hidden>
      {values.map((v, i) => (
        <div
          key={i}
          className="w-1.5 min-w-[4px] rounded-[1px] bg-[rgba(255,255,255,0.22)]"
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function statusBadgeClass(status: InvoiceItem["status"]) {
  if (status === "paid") return "border-[#22c55e]/35 bg-[#22c55e]/12 text-[#86efac]";
  if (status === "pending") return "border-[#f59e0b]/35 bg-[#f59e0b]/12 text-[#fcd34d]";
  return "border-[#ef4444]/35 bg-[#ef4444]/12 text-[#fca5a5]";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function FinancialModule() {
  const { invoices, t, td, ts, uploadInvoice } = useAppContext();
  const { t: lt } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const [activeKpiIndex, setActiveKpiIndex] = useState(0);
  const [pdfModal, setPdfModal] = useState<{ fileName: string; url: string } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const totalInvested = invoices.reduce((acc, item) => acc + item.amount, 0);
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

  const kpiDefs = useMemo(
    () => [
      { label: "Invoices", value: String(invoices.length), fraction: `${invoices.length} / 20` },
      { label: "Paid", value: String(paidCount), fraction: `${paidCount} / ${invoices.length || 1}` },
      { label: "Total Invested", value: formatCurrency(totalInvested), fraction: "This month" },
    ],
    [invoices.length, paidCount, totalInvested],
  );

  const kpiProgressWidths = useMemo(() => {
    const invPct = Math.min(100, (invoices.length / 20) * 100);
    const paidPct = invoices.length ? Math.min(100, (paidCount / invoices.length) * 100) : 0;
    const investPct = 62;
    return [invPct, paidPct, investPct];
  }, [invoices.length, paidCount]);

  const projectRows = useMemo(
    () =>
      projectInvestData.map((row) => {
        const remaining = row.total - row.paid;
        const completion = row.total > 0 ? Math.round((row.paid / row.total) * 100) : 0;
        return { ...row, remaining, completion };
      }),
    [],
  );

  const summaryTotals = useMemo(() => {
    const total = projectRows.reduce((a, r) => a + r.total, 0);
    const paid = projectRows.reduce((a, r) => a + r.paid, 0);
    const remaining = projectRows.reduce((a, r) => a + r.remaining, 0);
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
      uploadInvoice({
        amount: 0,
        status: "pending",
        dueDate: todayIso(),
        fileName: file.name,
        description: "Uploaded invoice",
      });
    });
    e.target.value = "";
  };

  const openPdfModal = (fileName: string) => {
    setPdfModal({ fileName, url: DEMO_PDF_URL });
  };

  const triggerPrintInvoice = useCallback(() => {
    const el = printRef.current;
    if (!el) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Invoice ${invoiceNumber}</title>`);
    w.document.write(
      '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    );
    w.document.write(
      '<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">',
    );
    w.document.write(`<style>
      @page { margin: 16mm; }
      body { margin:0; font-family: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif; background:#fff; color:#111; font-weight:300; }
      .mono-num, .num, .tnum { font-family: "JetBrains Mono", ui-monospace, monospace; font-variant-numeric: tabular-nums; }
      .inv { max-width: 720px; margin: 0 auto; padding: 24px; text-align: left; color: #111; }
      h1 { font-size: 1.5rem; font-weight: 300; margin: 0 0 8px; }
      .muted { color: #555; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em; }
      .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; font-size: 0.875rem; font-weight: 300; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 0.85rem; }
      th, td { border-bottom: 1px solid #e5e5e5; padding: 8px 6px; text-align: left; }
      th { font-weight: 500; }
      .num { text-align: right; }
      .totals { margin-top: 16px; width: 280px; margin-left: auto; font-size: 0.9rem; }
      .totals-row { display: flex; justify-content: space-between; padding: 4px 0; }
      .grand { font-size: 1.25rem; font-weight: 400; border-top: 1px solid #ccc; margin-top: 8px; padding-top: 8px; }
      .bank { margin-top: 24px; padding: 12px; background: #f6f6f6; font-size: 0.8rem; }
      .bank .muted { display: block; margin-bottom: 8px; }
      .from-line { margin-top: 24px; font-size: 0.875rem; color: #555; font-weight: 300; }
    </style></head><body>`);
    w.document.write(el.innerHTML);
    w.document.write("</body></html>");
    w.document.close();
    w.focus();
    w.print();
    w.close();
  }, [invoiceNumber]);

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
      <PageHeader title={t("financial")} subtitle={lt("Payment tracking, invoice files, and total invested per project.")} />

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
              <th className="px-4 py-3 font-normal">{lt("6-mo trend")}</th>
              <th className="px-4 py-3 font-normal">{lt("Total")}</th>
              <th className="px-4 py-3 font-normal">{lt("Paid")}</th>
              <th className="px-4 py-3 font-normal">{lt("Remaining")}</th>
              <th className="px-4 py-3 font-normal">{lt("Completion")}</th>
            </tr>
          </thead>
          <tbody>
            {projectRows.map((row, i) => (
              <tr
                key={row.name}
                className={cn("border-b border-[var(--border)]", i % 2 === 1 ? "bg-[rgba(255,255,255,0.02)]" : "")}
              >
                <td className="px-4 py-3 text-sm font-light text-white">{row.name}</td>
                <td className="px-4 py-3">
                  <MiniSpendSparkline values={row.monthlySpend} />
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
              </tr>
            ))}
            <tr className="bg-[rgba(255,255,255,0.04)]">
              <td className="px-4 py-3 text-sm font-semibold text-white">{lt("Total")}</td>
              <td className="px-4 py-3" />
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
                  <td className="px-3 py-2.5 text-sm font-light text-white">{td(invoice.fileName)}</td>
                  <td className="mono-num px-3 py-2.5 text-xs font-light tabular-nums text-[rgba(255,255,255,0.5)]">
                    {invoiceIssueDate[invoice.id] ?? invoice.dueDate}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2 py-0.5 text-[0.68rem] font-normal",
                        statusBadgeClass(invoice.status),
                      )}
                    >
                      {ts(invoice.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openPdfModal(td(invoice.fileName))}
                        className="rounded-lg border border-[var(--border-strong)] bg-transparent px-3 py-1 text-xs font-light text-[rgba(255,255,255,0.75)]"
                      >
                        {lt("View PDF")}
                      </button>
                      <a
                        href={DEMO_PDF_URL}
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
        <h2 className="text-[0.7rem] font-normal uppercase tracking-[0.1em] text-[rgba(255,255,255,0.4)]">{lt("Invoice generator")}</h2>
        <p className="mt-2 text-xs font-light text-[rgba(255,255,255,0.35)]">
          {lt("Only available to users with invoice permissions.")}
        </p>

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
        </div>
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
    </ModuleGuard>
  );
}
