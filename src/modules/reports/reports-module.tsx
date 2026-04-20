"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleGuard } from "@/components/layout/module-guard";
import { useLanguage } from "@/context/language-context";

export function ReportsModule() {
  const { t: lt } = useLanguage();
  const [view, setView] = useState<"dashboard" | "pdf">("dashboard");

  const kpiRows = [
    { label: "Social Performance", value: "+18.4%", fraction: "18.4 / 25.0" },
    { label: "Traffic", value: "42,800 visits", fraction: "42.8 / 55.0" },
    { label: "Website Analytics", value: "3.9% conversion", fraction: "3.9 / 5.0" },
  ] as const;

  const summaryBySection: Record<string, string> = {
    Social: "Summary widgets and trends for social.",
    Traffic: "Summary widgets and trends for traffic.",
    Website: "Summary widgets and trends for website.",
  };

  return (
    <ModuleGuard module="reports">
      <PageHeader
        title={lt("Reports")}
        subtitle={lt("Social performance, traffic, and website analytics in dashboard/PDF views.")}
        action={
          <div className="flex gap-2">
            <button className="btn-primary rounded-lg px-3 py-2 text-sm">{lt("Upload Report")}</button>
            <button
              type="button"
              onClick={() => setView("dashboard")}
              className={`rounded-lg px-3 py-2 text-sm ${view === "dashboard" ? "btn-primary" : "btn-ghost"}`}
            >
              {lt("Dashboard")}
            </button>
            <button
              type="button"
              onClick={() => setView("pdf")}
              className={`rounded-lg px-3 py-2 text-sm ${view === "pdf" ? "btn-primary" : "btn-ghost"}`}
            >
              {lt("PDF")}
            </button>
          </div>
        }
      />
      <div className="grid gap-3 xl:grid-cols-3">
        {kpiRows.map((kpi, index) => (
          <Card key={kpi.label} className={index === 0 ? "kpi-active" : ""}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--muted)]">{lt(kpi.label)}</p>
              <MoreHorizontal className="h-4 w-4 text-[var(--muted)]" />
            </div>
            <p
              className={
                kpi.value.trim().startsWith("-")
                  ? "metric-value mt-2 text-2xl text-[#ef4444]"
                  : kpi.value.trim().startsWith("+")
                    ? "metric-value mt-2 text-2xl text-[#379136]"
                    : "metric-value mt-2 text-2xl"
              }
            >
              {lt(kpi.value)}
            </p>
            <div className="mt-3 h-[2px] rounded-[2px] bg-[rgba(255,255,255,0.08)]">
              <div className="h-[2px] rounded-[2px] bg-[#FF4500]" style={{ width: "58%" }} />
            </div>
            <p className="kpi-fraction mt-1 text-xs">{kpi.fraction}</p>
          </Card>
        ))}
      </div>
      <Card className="mt-5">
        <h2 className="section-title">{view === "dashboard" ? lt("Dashboard View") : lt("PDF View")}</h2>
        {view === "dashboard" ? (
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {(["Social", "Traffic", "Website"] as const).map((section) => (
              <div
                key={section}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4 text-sm text-[var(--muted)]"
              >
                <p className="font-medium text-white">{lt(section)}</p>
                <p className="mt-1">{lt(summaryBySection[section])}</p>
                <button type="button" className="btn-ghost mt-3 rounded-lg px-3 py-1.5 text-xs">
                  {lt("View Full Report")}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4 text-sm text-[var(--muted)]">
            {lt("Download-ready monthly performance report in PDF format.")}
          </div>
        )}
      </Card>
    </ModuleGuard>
  );
}
