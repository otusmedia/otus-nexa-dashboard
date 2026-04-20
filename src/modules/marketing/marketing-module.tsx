"use client";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleGuard } from "@/components/layout/module-guard";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";

export function MarketingModule() {
  const { tasks, t, td, ts } = useAppContext();
  const { t: lt } = useLanguage();
  const campaigns = tasks.filter((task) => task.tags.includes("Google Ads") || task.tags.includes("Meta Ads"));
  const statusClass = (status: string) =>
    status === "completed" ? "status-completed" : status === "in_progress" || status === "in review" ? "status-progress" : "status-backlog";
  const notes: Array<{ text: string; author: string; time: string }> = [];

  return (
    <ModuleGuard module="marketing">
      <PageHeader title={t("marketing")} subtitle={lt("Campaign tracking, notes/logs, and marketing report uploads.")} />
      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="section-title">Campaign Tracking</h2>
            <button className="btn-primary rounded-lg px-3 py-1.5 text-xs">New Campaign</button>
          </div>
          <div className="mt-3 space-y-2">
            {campaigns.map((item) => (
              <div key={item.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3 text-sm">
                <p className="font-normal">{td(item.title)}</p>
                <p className="text-xs text-[var(--muted)]">
                  {lt("Status")}: <span className={`status-badge rounded-full px-2 py-0.5 ${statusClass(item.status)}`}>{ts(item.status)}</span>
                </p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="section-title">Notes and Logs</h2>
          <div className="mt-3 space-y-2 text-sm">
            {notes.map((note) => (
              <div key={note.text} className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
                <p>{note.text}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)]/20 text-[10px] font-normal text-[var(--primary)]">
                    {note.author.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="text-xs text-[var(--muted)]">{note.author}</span>
                  <span className="text-xs text-[var(--muted)]">- {note.time}</span>
                </div>
              </div>
            ))}
          </div>
          <button className="btn-primary mt-4 rounded-lg px-3 py-2 text-sm">Upload Report</button>
        </Card>
      </div>
    </ModuleGuard>
  );
}
