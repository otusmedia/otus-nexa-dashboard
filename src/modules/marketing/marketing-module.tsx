"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleGuard } from "@/components/layout/module-guard";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { supabase } from "@/lib/supabase";

type CampaignItem = { id: string; name: string; status: string };
type NoteItem = { id: string; text: string; author: string; time: string };

export function MarketingModule() {
  const { t, td, ts, currentUser } = useAppContext();
  const { t: lt } = useLanguage();
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      supabase.from("campaigns").select("*"),
      supabase.from("notes").select("*").order("created_at", { ascending: false }),
    ])
      .then(([campaignsRes, notesRes]) => {
        if (!mounted) return;
        if (campaignsRes.error) {
          console.error("[supabase] campaigns fetch failed:", campaignsRes.error.message);
          setCampaigns([]);
        } else {
          setCampaigns(
            ((campaignsRes.data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
              id: String(row.id ?? ""),
              name: String(row.name ?? ""),
              status: String(row.status ?? "backlog"),
            })),
          );
        }
        if (notesRes.error) {
          console.error("[supabase] notes fetch failed:", notesRes.error.message);
          setNotes([]);
        } else {
          setNotes(
            ((notesRes.data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
              id: String(row.id ?? ""),
              text: String(row.content ?? ""),
              author: String(row.author ?? ""),
              time: String(row.created_at ?? ""),
            })),
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const createCampaign = () => {
    const id = crypto.randomUUID();
    const next = { id, name: "New Campaign", status: "backlog" };
    setCampaigns((prev) => [next, ...prev]);
    void supabase.from("campaigns").insert({ id, name: next.name, status: next.status }).then(({ error }) => {
      if (error) console.error("[supabase] campaign insert failed:", error.message);
    });
  };

  const createNote = () => {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const next = { id, text: "New note", author: currentUser.name, time: now };
    setNotes((prev) => [next, ...prev]);
    void supabase.from("notes").insert({ id, content: next.text, author: next.author }).then(({ error }) => {
      if (error) console.error("[supabase] note insert failed:", error.message);
    });
  };

  const statusClass = (status: string) =>
    status === "completed" ? "status-completed" : status === "in_progress" || status === "in review" ? "status-progress" : "status-backlog";

  return (
    <ModuleGuard module="marketing">
      <PageHeader title={t("marketing")} subtitle={lt("Campaign tracking, notes/logs, and marketing report uploads.")} />
      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="section-title">Campaign Tracking</h2>
            <button className="btn-primary rounded-lg px-3 py-1.5 text-xs" onClick={createCampaign}>New Campaign</button>
          </div>
          <div className="mt-3 space-y-2">
            {loading ? <div className="h-20 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)]" /> : null}
            {campaigns.map((item) => (
              <div key={item.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3 text-sm">
                <p className="font-normal">{td(item.name)}</p>
                <p className="text-xs text-[var(--muted)]">
                  {lt("Status")}: <span className={`status-badge rounded-full px-2 py-0.5 ${statusClass(item.status)}`}>{ts(String(item.status))}</span>
                </p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="section-title">Notes and Logs</h2>
          <div className="mt-3 space-y-2 text-sm">
            {loading ? <div className="h-20 animate-pulse rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)]" /> : null}
            {notes.map((note) => (
              <div key={note.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
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
          <button className="btn-primary mt-4 rounded-lg px-3 py-2 text-sm" onClick={createNote}>Upload Report</button>
        </Card>
      </div>
    </ModuleGuard>
  );
}
