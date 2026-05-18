"use client";

import { useState } from "react";
import { useAppContext } from "@/components/providers/app-providers";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { Sparkles, Send, CheckCircle, XCircle, Clock, Plus } from "lucide-react";

const ROCKETRIDE_ENDPOINT = "http://localhost:63187/webhook";
const ROCKETRIDE_AUTH = "pk_f8396434aa57c3a6b9e8d61df1b800ab42c6bd511cb55cbbd1b0779f60d6f6a7";

type DraftStatus = "draft" | "pending" | "approved" | "rejected" | "needs_changes";

interface ContentDraft {
  id: string;
  title: string;
  body: string;
  platforms: string[];
  status: DraftStatus;
  created_by: string;
  created_at: string;
  reviewed_by: string | null;
  review_comment: string | null;
  linked_project_id: string | null;
}

interface Project {
  id: string;
  name: string;
}

const STATUS_CONFIG: Record<DraftStatus, { label: string; className: string }> = {
  draft:         { label: "Draft",                className: "status-badge" },
  pending:       { label: "Waiting for Approval", className: "status-badge status-pending" },
  approved:      { label: "Approved",             className: "status-badge status-completed" },
  rejected:      { label: "Rejected",             className: "status-badge status-overdue" },
  needs_changes: { label: "Needs Changes",        className: "status-badge status-progress" },
};

const PLATFORMS = ["Instagram", "LinkedIn", "X", "Blog"];

export default function AIStudioPage() {
  const { currentUser } = useAppContext();
  const isClientPortalUser =
    currentUser.company !== "nexa" &&
    currentUser.company !== "otus" &&
    (currentUser.clientSlug != null || currentUser.company === "rocketride");
  const canGenerate = !isClientPortalUser;

  const [tab, setTab] = useState<"generate" | "drafts">(isClientPortalUser ? "drafts" : "generate");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [draftTitle, setDraftTitle] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["Instagram"]);
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState("");

  const [drafts, setDrafts] = useState<ContentDraft[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftsLoaded, setDraftsLoaded] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [reviewingDraft, setReviewingDraft] = useState<ContentDraft | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [linkProjectId, setLinkProjectId] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);

  const fetchDrafts = async () => {
    setDraftsLoading(true);
    const { data } = await supabase
      .from("content_drafts")
      .select("*")
      .order("created_at", { ascending: false });
    setDrafts((data as ContentDraft[]) ?? []);
    setDraftsLoaded(true);
    setDraftsLoading(false);
  };

  const fetchProjects = async () => {
    const { data } = await supabase.from("projects").select("id, name").order("name");
    setProjects((data as Project[]) ?? []);
  };

  const handleTabChange = (t: "generate" | "drafts") => {
    setTab(t);
    if (t === "drafts" && !draftsLoaded) {
      void fetchDrafts();
      void fetchProjects();
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setGeneratedContent("");
    setSaveNote("");
    try {
      const res = await fetch(ROCKETRIDE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${ROCKETRIDE_AUTH}`,
        },
        body: JSON.stringify({ event: "message", message: prompt.trim() }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { answer?: string; response?: string; text?: string; message?: string; output?: string };
      const text = json.answer ?? json.response ?? json.output ?? json.text ?? json.message ?? JSON.stringify(json);
      setGeneratedContent(text);
      if (!draftTitle) setDraftTitle(prompt.trim().slice(0, 80));
    } catch (err) {
      setGeneratedContent(`Could not reach the RocketRide pipeline. Make sure it is running locally.\n\n${String(err)}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveDraft = async (submitForApproval: boolean) => {
    if (!generatedContent.trim() || !draftTitle.trim()) return;
    setSaving(true);
    setSaveNote("");
    const { error } = await supabase.from("content_drafts").insert([{
      title: draftTitle.trim(),
      body: generatedContent.trim(),
      platforms: selectedPlatforms,
      status: submitForApproval ? "pending" : "draft",
      created_by: currentUser.name,
    }]);
    setSaving(false);
    if (error) {
      setSaveNote("Error saving. Try again.");
    } else {
      setSaveNote(submitForApproval ? "Submitted for approval!" : "Saved as draft.");
      setDraftsLoaded(false);
    }
  };

  const handleReview = async (status: "approved" | "rejected" | "needs_changes") => {
    if (!reviewingDraft) return;
    setReviewSaving(true);
    const updates: Record<string, unknown> = {
      status,
      reviewed_by: currentUser.name,
      review_comment: reviewComment.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (status === "approved" && linkProjectId) {
      updates.linked_project_id = linkProjectId;
      await supabase.from("tasks").insert([{
        title: reviewingDraft.title,
        description: reviewingDraft.body,
        project_id: linkProjectId,
        status: "backlog",
        owner: reviewingDraft.created_by,
      }]);
    }
    await supabase.from("content_drafts").update(updates).eq("id", reviewingDraft.id);
    setReviewSaving(false);
    setReviewingDraft(null);
    setReviewComment("");
    setLinkProjectId("");
    void fetchDrafts();
  };

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p)
        ? prev.length > 1 ? prev.filter((x) => x !== p) : prev
        : [...prev, p]
    );
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--background)] px-4 py-6 text-[var(--text)] lg:px-8">
      <PageHeader
        title="Content Management"
        subtitle="Generate and manage content powered by RocketRide AI"
      />

      <div className="mb-6 inline-flex rounded-full border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-1">
        {canGenerate && (
          <button
            type="button"
            onClick={() => handleTabChange("generate")}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-medium transition",
              tab === "generate"
                ? "bg-[rgba(255,69,0,0.25)] text-[var(--primary)]"
                : "text-[var(--muted)] hover:text-[var(--text)]",
            )}
          >
            AI Studio
          </button>
        )}
        <button
          type="button"
          onClick={() => handleTabChange("drafts")}
          className={cn(
            "rounded-full px-5 py-2 text-sm font-medium transition",
            tab === "drafts"
              ? "bg-[rgba(255,69,0,0.25)] text-[var(--primary)]"
              : "text-[var(--muted)] hover:text-[var(--text)]",
          )}
        >
          {isClientPortalUser ? "Content for Review" : "Drafts"}
        </button>
      </div>

      {tab === "generate" && canGenerate && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="space-y-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--primary)]" strokeWidth={1.75} />
              <p className="section-title">RocketRide Pipeline</p>
            </div>

            <label className="block">
              <span className="section-title mb-2 block">What content do you need?</span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: Suggest 3 content ideas about RocketRide pipeline nodes for developers..."
                rows={5}
                className="w-full resize-y rounded-lg px-4 py-3 text-sm focus:border-[rgba(255,69,0,0.45)] focus:outline-none"
              />
            </label>

            <button
              type="button"
              disabled={generating || !prompt.trim()}
              onClick={() => void handleGenerate()}
              className="btn-primary inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm disabled:opacity-50"
            >
              <Send className="h-4 w-4" strokeWidth={1.75} />
              {generating ? "Generating..." : "Generate with RocketRide"}
            </button>

            {generatedContent && (
              <div className="space-y-4 border-t border-[var(--border)] pt-4">
                <label className="block">
                  <span className="section-title mb-2 block">Title</span>
                  <input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm focus:border-[rgba(255,69,0,0.45)] focus:outline-none"
                  />
                </label>

                <div>
                  <span className="section-title mb-2 block">Platforms</span>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => togglePlatform(p)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                          selectedPlatforms.includes(p)
                            ? "border-[rgba(255,69,0,0.45)] bg-[rgba(255,69,0,0.18)] text-[var(--primary)]"
                            : "border-[var(--border-strong)] bg-[var(--surface-elevated)] text-[var(--muted)] hover:text-[var(--text)]",
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleSaveDraft(false)}
                    className="btn-ghost rounded-lg px-4 py-2 text-xs disabled:opacity-50"
                  >
                    Save as Draft
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleSaveDraft(true)}
                    className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Submit for Approval
                  </button>
                </div>
                {saveNote && <p className="text-xs text-[var(--muted)]">{saveNote}</p>}
              </div>
            )}
          </Card>

          <Card>
            <p className="section-title mb-3">Generated Content</p>
            {generating && (
              <p className="animate-pulse text-sm text-[var(--muted)]">Running RocketRide pipeline...</p>
            )}
            {!generating && generatedContent && (
              <textarea
                value={generatedContent}
                onChange={(e) => setGeneratedContent(e.target.value)}
                className="min-h-[400px] w-full resize-y rounded-lg px-4 py-3 text-sm focus:border-[rgba(255,69,0,0.45)] focus:outline-none"
              />
            )}
            {!generating && !generatedContent && (
              <p className="text-sm text-[var(--muted)]">Generated content will appear here. You can edit before saving.</p>
            )}
          </Card>
        </div>
      )}

      {tab === "drafts" && (
        <div className="space-y-3">
          {draftsLoading && <p className="text-sm text-[var(--muted)]">Loading...</p>}
          {!draftsLoading && drafts.length === 0 && (
            <p className="text-sm text-[var(--muted)]">No content drafts yet.</p>
          )}
          {drafts.map((draft) => {
            const cfg = STATUS_CONFIG[draft.status] ?? STATUS_CONFIG.draft;
            return (
              <Card key={draft.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-medium text-[var(--text)]">{draft.title}</h3>
                      <span className={cn("rounded-full px-2.5 py-0.5", cfg.className)}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="kpi-label mb-2">
                      By {draft.created_by} · {new Date(draft.created_at).toLocaleDateString()} · {draft.platforms.join(", ")}
                    </p>
                    <p className="line-clamp-3 whitespace-pre-wrap text-sm text-[var(--muted)]">{draft.body}</p>
                    {draft.review_comment && (
                      <p className="mt-2 text-xs text-[var(--muted)]">Feedback: {draft.review_comment}</p>
                    )}
                  </div>
                  {isClientPortalUser && draft.status === "pending" && (
                    <button
                      type="button"
                      onClick={() => { setReviewingDraft(draft); setReviewComment(""); setLinkProjectId(""); }}
                      className="btn-ghost shrink-0 rounded-lg px-3 py-1.5 text-xs"
                    >
                      Review
                    </button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {reviewingDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-lg space-y-4">
            <h2 className="text-sm font-medium text-[var(--text)]">Review: {reviewingDraft.title}</h2>
            <p className="line-clamp-5 whitespace-pre-wrap text-sm text-[var(--muted)]">{reviewingDraft.body}</p>

            <label className="block">
              <span className="section-title mb-1.5 block">Feedback (optional)</span>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Add feedback for the creator..."
                rows={3}
                className="w-full resize-y rounded-lg px-3 py-2 text-sm focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="section-title mb-1.5 block">Link to Project (optional)</span>
              <select
                value={linkProjectId}
                onChange={(e) => setLinkProjectId(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm"
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={reviewSaving}
                onClick={() => void handleReview("approved")}
                className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs text-[#86efac] disabled:opacity-50"
              >
                <CheckCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                Approve
              </button>
              <button
                type="button"
                disabled={reviewSaving}
                onClick={() => void handleReview("needs_changes")}
                className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs text-[#fcd34d] disabled:opacity-50"
              >
                <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                Needs Changes
              </button>
              <button
                type="button"
                disabled={reviewSaving}
                onClick={() => void handleReview("rejected")}
                className="btn-ghost inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs text-[#fca5a5] disabled:opacity-50"
              >
                <XCircle className="h-3.5 w-3.5" strokeWidth={1.75} />
                Reject
              </button>
              <button
                type="button"
                onClick={() => setReviewingDraft(null)}
                className="btn-ghost ml-auto rounded-lg px-4 py-2 text-xs"
              >
                Cancel
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
