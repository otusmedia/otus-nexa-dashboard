"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock, Heart, Instagram, Linkedin, MessageCircle, Share2, X as XIcon } from "lucide-react";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { CalendarHeader } from "@/components/calendar/CalendarHeader";
import { CalendarEventPopover } from "@/components/calendar/CalendarEventPopover";
import { CalendarWeekView } from "@/components/calendar/CalendarWeekView";
import { addDays, endOfDay, getMonthGridRange, startOfDay, startOfWeekSunday } from "@/components/calendar/calendar-utils";
import { useCalendar } from "@/components/calendar/useCalendar";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { useAppContext } from "@/components/providers/app-providers";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/types/calendar";

/** Dispatched after logging a published post so the Dashboard KPI can refetch. */
export const DASHBOARD_POSTS_PUBLISHED_KPI_EVENT = "rr:dashboard-posts-published-refresh";

type Platform = "instagram" | "linkedin" | "x";

const CHAR_LIMIT: Record<Platform, number> = {
  instagram: 2200,
  linkedin: 3000,
  x: 280,
};

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "x", label: "X" },
];

type MediaItem = { id: string; file: File; url: string };

type ScheduledPostRow = {
  id: string;
  content: string;
  platforms: string[];
  media_urls: string[];
  scheduled_at: string | null;
  status: string;
  created_by: string | null;
  published_at: string | null;
  created_at: string;
  linked_task_id?: string | null;
  media_description?: string | null;
};

type TaskLinkMeta = { title: string; projectId: string; projectName: string };

function pillColorForPlatforms(platforms: string[]): string {
  const p = (platforms[0] ?? "instagram").toLowerCase();
  if (p === "linkedin") return "#0A66C2";
  if (p === "x" || p === "twitter") return "#262626";
  return "#E1306C";
}

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function mapRowToCalendarEvent(
  row: Record<string, unknown>,
  pillColor: string,
  linkMeta: TaskLinkMeta | null,
): CalendarEvent {
  const id = String(row.id ?? "");
  const content = String(row.content ?? "");
  const status = String(row.status ?? "scheduled");
  const scheduledAt = String(row.scheduled_at ?? "");
  const publishedAt = String(row.published_at ?? "");
  const at =
    status.toLowerCase() === "published" && publishedAt.trim()
      ? publishedAt
      : scheduledAt;
  const platforms = Array.isArray(row.platforms) ? row.platforms.map(String) : [];
  const startMs = new Date(at).getTime();
  const endIso = new Date(startMs + 60 * 60 * 1000).toISOString();
  const trimmed = content.trim();
  const title =
    trimmed.length === 0
      ? status.toLowerCase() === "published"
        ? "Published post"
        : "Scheduled post"
      : trimmed.length > 44
        ? `${trimmed.slice(0, 44)}…`
        : trimmed;
  const linkedRaw = row.linked_task_id;
  const linkedId = linkedRaw != null && String(linkedRaw).trim() !== "" ? String(linkedRaw) : "";
  return {
    id: `spost-${id}`,
    title,
    description: content,
    start_at: at,
    end_at: endIso,
    all_day: false,
    type: "other",
    meet_link: null,
    location: null,
    color: pillColor,
    created_by: row.created_by != null ? String(row.created_by) : null,
    organization: null,
    created_at: String(row.created_at ?? ""),
    source: "scheduled_post",
    source_id: id,
    is_scheduled_post: true,
    publishing_platforms: platforms,
    publishing_status: status,
    scheduled_post_linked_task_id: linkedId || null,
    scheduled_post_project_id: linkMeta?.projectId ?? null,
    scheduled_post_task_name: linkMeta?.title ?? null,
  };
}

function inRange(ev: CalendarEvent, rangeStart: Date, rangeEnd: Date): boolean {
  const s = new Date(ev.start_at).getTime();
  const e = new Date(ev.end_at).getTime();
  const a = rangeStart.getTime();
  const b = rangeEnd.getTime();
  return s <= b && e >= a;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function combineLocalDateTimeToIso(dateYmd: string, timeHm: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd) || !/^\d{1,2}:\d{2}$/.test(timeHm)) return null;
  const [y, m, d] = dateYmd.split("-").map(Number);
  const [hh, mm] = timeHm.split(":").map(Number);
  if (![y, m, d, hh, mm].every((v) => Number.isFinite(v))) return null;
  const local = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0);
  if (Number.isNaN(local.getTime())) return null;
  return local.toISOString();
}

const LOG_PLATFORM_PRESETS = ["Instagram", "LinkedIn", "X", "Blog"] as const;

export function PublishingModule() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, logTaskPublishedToActivity } = useAppContext();

  const [mainTab, setMainTab] = useState<"compose" | "schedule">("compose");
  const [platforms, setPlatforms] = useState<Set<Platform>>(new Set(["instagram"]));
  const [content, setContent] = useState("");
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [scheduleLocal, setScheduleLocal] = useState("");
  const [scheduleNote, setScheduleNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewPlatform, setPreviewPlatform] = useState<Platform>("instagram");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { view, setView, currentDate, weekStart, goToday, goPrev, goNext } = useCalendar();
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleRows, setScheduleRows] = useState<ScheduledPostRow[]>([]);
  const [taskLinkById, setTaskLinkById] = useState<Record<string, TaskLinkMeta>>({});
  const [popover, setPopover] = useState<{ event: CalendarEvent; x: number; y: number } | null>(null);
  const [detailPost, setDetailPost] = useState<ScheduledPostRow | null>(null);

  const [logPastOpen, setLogPastOpen] = useState(false);
  const [logPastSaving, setLogPastSaving] = useState(false);
  const [logPastNotice, setLogPastNotice] = useState("");
  const [logPastNoticeIsError, setLogPastNoticeIsError] = useState(false);
  const [logContent, setLogContent] = useState("");
  const [logPlatforms, setLogPlatforms] = useState<Set<string>>(() => new Set(["Instagram"]));
  const [logCustomPlatform, setLogCustomPlatform] = useState("");
  const [logDate, setLogDate] = useState("");
  const [logTime, setLogTime] = useState("");
  const [logTaskId, setLogTaskId] = useState("");
  const [logMediaDescription, setLogMediaDescription] = useState("");

  const range = useMemo(() => {
    if (view === "month") {
      const r = getMonthGridRange(currentDate);
      return { rangeStart: addDays(r.rangeStart, -7), rangeEnd: addDays(r.rangeEnd, 7) };
    }
    return { rangeStart: addDays(startOfDay(weekStart), -7), rangeEnd: addDays(endOfDay(addDays(weekStart, 6)), 7) };
  }, [view, currentDate, weekStart]);

  const scheduleEvents = useMemo(() => {
    const { rangeStart, rangeEnd } = range;
    return scheduleRows
      .filter((r) => {
        if (r.status === "scheduled" && r.scheduled_at) return true;
        if (r.status === "published" && r.published_at) return true;
        return false;
      })
      .map((r) => {
        const lid = (r.linked_task_id ?? "").trim();
        const meta = lid ? taskLinkById[lid] ?? null : null;
        return mapRowToCalendarEvent(r as unknown as Record<string, unknown>, pillColorForPlatforms(r.platforms), meta);
      })
      .filter((ev) => inRange(ev, rangeStart, rangeEnd));
  }, [scheduleRows, range, taskLinkById]);

  const fetchScheduled = useCallback(async () => {
    setScheduleLoading(true);
    try {
      const [postsRes, tasksRes] = await Promise.all([
        supabase
          .from("scheduled_posts")
          .select("*")
          .order("scheduled_at", { ascending: true, nullsFirst: false }),
        supabase.from("tasks").select("id, title, project_id, projects(name)").order("title", { ascending: true }),
      ]);

      if (tasksRes.data) {
        const lookup: Record<string, TaskLinkMeta> = {};
        for (const raw of tasksRes.data as Array<Record<string, unknown>>) {
          const tid = String(raw.id ?? "");
          if (!tid) continue;
          const proj = raw.projects as { name?: string } | null | undefined;
          lookup[tid] = {
            title: String(raw.title ?? "Task"),
            projectId: String(raw.project_id ?? ""),
            projectName: proj?.name ? String(proj.name) : "Project",
          };
        }
        setTaskLinkById(lookup);
      } else {
        setTaskLinkById({});
        if (tasksRes.error) console.error("[publishing] tasks lookup:", tasksRes.error.message);
      }

      if (postsRes.error) {
        console.error("[publishing] scheduled_posts:", postsRes.error.message);
        setScheduleRows([]);
      } else {
        setScheduleRows((postsRes.data as ScheduledPostRow[]) ?? []);
      }
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchScheduled();
  }, [fetchScheduled]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "schedule") setMainTab("schedule");
    else if (tab === "compose") setMainTab("compose");
  }, [searchParams]);

  useEffect(() => {
    const edit = searchParams.get("edit");
    if (!edit) {
      setEditingId(null);
      return;
    }
    setMainTab("compose");
    void (async () => {
      const { data, error } = await supabase.from("scheduled_posts").select("*").eq("id", edit).maybeSingle();
      if (error || !data) return;
      const row = data as ScheduledPostRow;
      setEditingId(row.id);
      setContent(row.content);
      const plats = (row.platforms ?? []).filter((p): p is Platform => p === "instagram" || p === "linkedin" || p === "x");
      setPlatforms(new Set(plats.length ? plats : ["instagram"]));
      setScheduleLocal(toDatetimeLocalValue(row.scheduled_at));
      setMediaItems([]);
    })();
  }, [searchParams]);

  useEffect(() => {
    const post = searchParams.get("post");
    if (!post || mainTab !== "schedule") return;
    void (async () => {
      const { data } = await supabase.from("scheduled_posts").select("*").eq("id", post).maybeSingle();
      if (data) setDetailPost(data as ScheduledPostRow);
    })();
  }, [searchParams, mainTab]);

  const togglePlatform = (p: Platform) => {
    setPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) {
        if (next.size > 1) next.delete(p);
      } else {
        next.add(p);
      }
      return next;
    });
  };

  const overLimit = useMemo(() => {
    for (const p of platforms) {
      if (content.length > CHAR_LIMIT[p]) return true;
    }
    return false;
  }, [content, platforms]);

  const anyNearLimit = useMemo(() => {
    for (const p of platforms) {
      const lim = CHAR_LIMIT[p];
      if (content.length >= lim * 0.9 && content.length <= lim) return true;
    }
    return false;
  }, [content, platforms]);

  const onPickFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const next: MediaItem[] = [...mediaItems];
    for (let i = 0; i < files.length && next.length < 10; i += 1) {
      const f = files[i];
      if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) continue;
      next.push({ id: crypto.randomUUID(), file: f, url: URL.createObjectURL(f) });
    }
    setMediaItems(next);
  };

  const removeMedia = (id: string) => {
    setMediaItems((prev) => {
      const it = prev.find((x) => x.id === id);
      if (it) URL.revokeObjectURL(it.url);
      return prev.filter((x) => x.id !== id);
    });
  };

  const resetCompose = (opts?: { clearSuccessMessage?: boolean }) => {
    setEditingId(null);
    setContent("");
    setPlatforms(new Set(["instagram"]));
    setScheduleLocal("");
    if (opts?.clearSuccessMessage !== false) setScheduleNote("");
    mediaItems.forEach((m) => URL.revokeObjectURL(m.url));
    setMediaItems([]);
    router.replace("/publishing", { scroll: false });
  };

  const insertPost = async (payload: Record<string, unknown>) => {
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from("scheduled_posts").update(payload).eq("id", editingId);
        if (error) {
          console.error(error.message);
          return;
        }
      } else {
        const { error } = await supabase
          .from("scheduled_posts")
          .insert([{ ...payload, created_by: currentUser.name ?? null }]);
        if (error) {
          console.error(error.message);
          return;
        }
      }
      const status = String(payload.status ?? "");
      const scheduledAt = payload.scheduled_at != null ? String(payload.scheduled_at) : "";
      let note = "Saved.";
      if (status === "published") note = editingId ? "Updated and marked published." : "Published.";
      else if (status === "scheduled" && scheduledAt)
        note = `Scheduled for ${new Date(scheduledAt).toLocaleString()}`;
      else if (editingId) note = "Saved.";
      setScheduleNote(note);
      await fetchScheduled();
      resetCompose({ clearSuccessMessage: false });
      if (status === "published" && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(DASHBOARD_POSTS_PUBLISHED_KPI_EVENT));
      }
    } finally {
      setSaving(false);
    }
  };

  const handlePublishNow = async () => {
    if (!content.trim() || platforms.size === 0 || overLimit) return;
    await insertPost({
      content: content.trim(),
      platforms: [...platforms],
      media_urls: [] as string[],
      status: "published",
      published_at: new Date().toISOString(),
      scheduled_at: null,
    });
  };

  const handleScheduleLater = async () => {
    if (!content.trim() || platforms.size === 0 || !scheduleLocal || overLimit) return;
    const iso = new Date(scheduleLocal).toISOString();
    await insertPost({
      content: content.trim(),
      platforms: [...platforms],
      media_urls: [] as string[],
      status: "scheduled",
      scheduled_at: iso,
      published_at: null,
    });
  };

  const handleDeletePost = async (id: string) => {
    const { error } = await supabase.from("scheduled_posts").delete().eq("id", id);
    if (error) console.error(error.message);
    setDetailPost(null);
    await fetchScheduled();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(DASHBOARD_POSTS_PUBLISHED_KPI_EVENT));
    }
  };

  const openLogPastModal = useCallback(() => {
    setLogPastNotice("");
    setLogPastNoticeIsError(false);
    setLogContent("");
    setLogPlatforms(new Set(["Instagram"]));
    setLogCustomPlatform("");
    setLogTaskId("");
    setLogMediaDescription("");
    const now = new Date();
    setLogDate(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`);
    setLogTime(`${pad2(now.getHours())}:${pad2(now.getMinutes())}`);
    setLogPastOpen(true);
  }, []);

  const taskOptionsForLog = useMemo(
    () =>
      Object.entries(taskLinkById)
        .map(([id, m]) => ({ id, label: `${m.projectName} — ${m.title}` }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [taskLinkById],
  );

  const toggleLogPlatformPreset = (label: string) => {
    setLogPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        if (next.size > 1) next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const addLogCustomPlatform = () => {
    const t = logCustomPlatform.trim();
    if (!t) return;
    setLogPlatforms((prev) => new Set(prev).add(t));
    setLogCustomPlatform("");
  };

  const removeLogPlatform = (label: string) => {
    setLogPlatforms((prev) => {
      if (prev.size <= 1 && prev.has(label)) return prev;
      const next = new Set(prev);
      next.delete(label);
      return next;
    });
  };

  const saveLogPublishedPost = async () => {
    const contentTrim = logContent.trim();
    if (!contentTrim || logPlatforms.size === 0) return;
    const iso = combineLocalDateTimeToIso(logDate, logTime);
    if (!iso) {
      setLogPastNoticeIsError(true);
      setLogPastNotice("Invalid date or time.");
      return;
    }
    const platformsArr = [...logPlatforms];
    const linkedId = logTaskId.trim() || null;
    const mediaDesc = logMediaDescription.trim();

    setLogPastSaving(true);
    setLogPastNotice("");
    setLogPastNoticeIsError(false);
    try {
      const insertPayload: Record<string, unknown> = {
        content: contentTrim,
        platforms: platformsArr,
        media_urls: [] as string[],
        scheduled_at: iso,
        published_at: iso,
        status: "published",
        created_by: currentUser.name ?? null,
        linked_task_id: linkedId,
        ...(mediaDesc ? { media_description: mediaDesc } : { media_description: null }),
      };

      const { error: insErr } = await supabase.from("scheduled_posts").insert([insertPayload]);
      if (insErr) {
        console.error("[publishing] log past post:", insErr.message);
        setLogPastNoticeIsError(true);
        setLogPastNotice(`Could not save: ${insErr.message}`);
        return;
      }

      if (linkedId) {
        const { error: taskErr } = await supabase
          .from("tasks")
          .update({ status: "Published", published_to: platformsArr })
          .eq("id", linkedId);
        if (taskErr) {
          console.error("[publishing] task sync:", taskErr.message);
        } else {
          const taskName = taskLinkById[linkedId]?.title ?? "task";
          logTaskPublishedToActivity({
            userName: currentUser.name.trim() || "User",
            taskName,
            platforms: platformsArr,
          });
        }
      }

      setLogPastNoticeIsError(false);
      setLogPastNotice("Post logged.");
      await fetchScheduled();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(DASHBOARD_POSTS_PUBLISHED_KPI_EVENT));
      }
      window.setTimeout(() => {
        setLogPastOpen(false);
        setLogPastNotice("");
      }, 900);
    } finally {
      setLogPastSaving(false);
    }
  };

  const previewPlatforms = useMemo(() => [...platforms], [platforms]);
  useEffect(() => {
    if (previewPlatforms.length && !previewPlatforms.includes(previewPlatform)) {
      setPreviewPlatform(previewPlatforms[0]);
    }
  }, [previewPlatforms, previewPlatform]);

  const platformStyle = (p: Platform, active: boolean) => {
    if (!active) {
      return "border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.45)]";
    }
    if (p === "instagram") return "border-[#E1306C] bg-[rgba(225,48,108,0.2)] text-[#fb7185]";
    if (p === "linkedin") return "border-[#0A66C2] bg-[rgba(10,102,194,0.22)] text-[#93c5fd]";
    return "border-white bg-black text-white";
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0a0a0a] px-4 py-6 text-white lg:px-8">
      <PageHeader
        title="Publishing"
        subtitle="Create and schedule content for LinkedIn, X and Instagram"
      />

      <div className="mb-6 inline-flex rounded-full border border-[rgba(255,255,255,0.08)] bg-[#111] p-1">
        <button
          type="button"
          onClick={() => {
            setMainTab("compose");
            router.replace("/publishing?tab=compose", { scroll: false });
          }}
          className={cn(
            "rounded-full px-5 py-2 text-sm font-medium transition",
            mainTab === "compose" ? "bg-[rgba(255,69,0,0.25)] text-[#FF4500]" : "text-[rgba(255,255,255,0.45)] hover:text-white",
          )}
        >
          Compose
        </button>
        <button
          type="button"
          onClick={() => {
            setMainTab("schedule");
            router.replace("/publishing?tab=schedule", { scroll: false });
          }}
          className={cn(
            "rounded-full px-5 py-2 text-sm font-medium transition",
            mainTab === "schedule" ? "bg-[rgba(255,69,0,0.25)] text-[#FF4500]" : "text-[rgba(255,255,255,0.45)] hover:text-white",
          )}
        >
          Schedule
        </button>
      </div>

      {mainTab === "compose" ? (
        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <Card className="border-[var(--border)] bg-[#111] p-5">
            <p className="mb-3 text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Platforms</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(({ id, label }) => {
                const active = platforms.has(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => togglePlatform(id)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                      platformStyle(id, active),
                    )}
                  >
                    {id === "instagram" ? (
                      <Instagram className="h-4 w-4" strokeWidth={1.75} />
                    ) : id === "linkedin" ? (
                      <Linkedin className="h-4 w-4" strokeWidth={1.75} />
                    ) : (
                      <XIcon className="h-4 w-4" strokeWidth={1.75} />
                    )}
                    {label}
                  </button>
                );
              })}
            </div>

            <label className="mt-6 block">
              <span className="mb-2 block text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Content</span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your post content here..."
                className="min-h-[200px] w-full resize-y rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-sm text-white placeholder:text-[rgba(255,255,255,0.3)] focus:border-[rgba(255,69,0,0.45)] focus:outline-none"
              />
            </label>

            <div className="mt-2 space-y-1">
              {[...platforms].map((p) => {
                const lim = CHAR_LIMIT[p];
                const n = content.length;
                const ratio = n / lim;
                const over = n > lim;
                const warn = !over && ratio >= 0.9;
                return (
                  <p
                    key={p}
                    className={cn("text-xs", over ? "text-red-400" : warn ? "text-amber-400" : "text-[rgba(255,255,255,0.4)]")}
                  >
                    {p === "instagram" ? "Instagram" : p === "linkedin" ? "LinkedIn" : "X"}: {n.toLocaleString()} /{" "}
                    {lim.toLocaleString()}
                  </p>
                );
              })}
            </div>

            <div
              className="mt-6"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onPickFiles(e.dataTransfer.files);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => onPickFiles(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full rounded-lg border border-dashed border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.02)] px-4 py-8 text-sm text-[var(--muted)] transition hover:border-[rgba(255,69,0,0.35)] hover:text-white"
              >
                Drag and drop or click to upload images or videos (max 10)
              </button>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {mediaItems.map((m) => (
                  <div key={m.id} className="group relative aspect-square overflow-hidden rounded-lg border border-[var(--border)] bg-black">
                    {m.file.type.startsWith("video/") ? (
                      <video src={m.url} className="h-full w-full object-cover" muted playsInline />
                    ) : (
                      <img src={m.url} alt="" className="h-full w-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => removeMedia(m.id)}
                      className="absolute right-1 top-1 rounded bg-black/70 px-2 py-0.5 text-[10px] text-white opacity-0 transition group-hover:opacity-100"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end">
              <button
                type="button"
                disabled={saving || !content.trim() || platforms.size === 0 || overLimit}
                onClick={() => void handlePublishNow()}
                className="btn-primary rounded-lg px-6 py-3 text-sm font-medium disabled:opacity-50"
              >
                Publish Now
              </button>
              <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                <label className="flex flex-col text-xs text-[var(--muted)]">
                  Schedule for Later
                  <input
                    type="datetime-local"
                    value={scheduleLocal}
                    onChange={(e) => setScheduleLocal(e.target.value)}
                    className="mt-1 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-sm text-white"
                  />
                </label>
                <button
                  type="button"
                  disabled={saving || !content.trim() || !scheduleLocal || platforms.size === 0 || overLimit}
                  onClick={() => void handleScheduleLater()}
                  className="btn-ghost rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
                >
                  Save schedule
                </button>
              </div>
            </div>
            {scheduleNote ? <p className="mt-3 text-sm text-[rgba(255,255,255,0.55)]">{scheduleNote}</p> : null}
          </Card>

          <div className="rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.06)] p-4">
            <p className="mb-3 text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Preview</p>
            {previewPlatforms.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Select a platform to preview.</p>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap gap-1">
                  {previewPlatforms.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPreviewPlatform(p)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs",
                        previewPlatform === p ? "bg-[rgba(255,69,0,0.25)] text-[#FF4500]" : "text-[var(--muted)] hover:text-white",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <MockPreview
                  platform={previewPlatform}
                  content={content}
                  mediaUrl={mediaItems[0]?.url}
                  mediaIsVideo={(mediaItems[0]?.file.type ?? "").startsWith("video/")}
                />
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <CalendarHeader
            view={view}
            onViewChange={setView}
            currentDate={currentDate}
            weekStart={weekStart}
            onPrev={goPrev}
            onNext={goNext}
            onToday={goToday}
            trailingActions={
              <button
                type="button"
                onClick={openLogPastModal}
                className="btn-ghost inline-flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:border-white/35 hover:text-white"
              >
                <Clock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                Log Past Post
              </button>
            }
          />
          {view === "month" ? (
            <CalendarGrid
              anchorDate={currentDate}
              events={scheduleEvents}
              loading={scheduleLoading}
              onDayClick={() => {}}
              onAddOnDay={() => {}}
              onEventClick={(ev, e) => {
                setPopover({ event: ev, x: e.clientX, y: e.clientY });
                const id = ev.source_id;
                if (id) {
                  void supabase
                    .from("scheduled_posts")
                    .select("*")
                    .eq("id", id)
                    .maybeSingle()
                    .then(({ data }) => {
                      if (data) setDetailPost(data as ScheduledPostRow);
                    });
                }
              }}
            />
          ) : null}
          {view === "week" ? (
            <CalendarWeekView
              weekStart={weekStart}
              events={scheduleEvents}
              onDayClick={() => {}}
              onEventClick={(ev, e) => {
                setPopover({ event: ev, x: e.clientX, y: e.clientY });
                const id = ev.source_id;
                if (id) {
                  void supabase
                    .from("scheduled_posts")
                    .select("*")
                    .eq("id", id)
                    .maybeSingle()
                    .then(({ data }) => {
                      if (data) setDetailPost(data as ScheduledPostRow);
                    });
                }
              }}
            />
          ) : null}

          <CalendarEventPopover
            event={popover?.event ?? null}
            anchor={popover ? { x: popover.x, y: popover.y } : null}
            onClose={() => setPopover(null)}
            onEdit={() => {}}
            onDelete={() => {}}
            publishingScheduleMode
            onEditScheduledPost={(postId) => {
              router.replace(`/publishing?tab=compose&edit=${encodeURIComponent(postId)}`, { scroll: false });
              setMainTab("compose");
            }}
            onDeleteScheduledPost={(postId) => void handleDeletePost(postId)}
          />
        </div>
      )}

      <Modal open={logPastOpen} title="Log Published Post" onClose={() => setLogPastOpen(false)} closeLabel="Close">
        <p className="-mt-1 mb-4 text-sm text-[var(--muted)]">Record a post that was already published</p>
        <div className="max-h-[min(70vh,520px)] space-y-4 overflow-y-auto pr-1">
          <label className="block">
            <span className="mb-1.5 block text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Content</span>
            <textarea
              value={logContent}
              onChange={(e) => setLogContent(e.target.value)}
              placeholder="Post content or description..."
              className="min-h-[120px] w-full resize-y rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-sm text-white placeholder:text-[rgba(255,255,255,0.3)] focus:border-[rgba(255,69,0,0.45)] focus:outline-none"
            />
          </label>
          <div>
            <span className="mb-2 block text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Platforms</span>
            <div className="flex flex-wrap gap-2">
              {LOG_PLATFORM_PRESETS.map((label) => {
                const active = logPlatforms.has(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleLogPlatformPreset(label)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                      active
                        ? "border-[rgba(255,69,0,0.45)] bg-[rgba(255,69,0,0.18)] text-[#FF4500]"
                        : "border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] text-[var(--muted)] hover:text-white",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
              {[...logPlatforms]
                .filter((p) => !(LOG_PLATFORM_PRESETS as readonly string[]).includes(p))
                .map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => removeLogPlatform(label)}
                    className="rounded-full border border-[rgba(255,255,255,0.2)] bg-[rgba(255,255,255,0.08)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[rgba(255,255,255,0.12)]"
                    title="Click to remove"
                  >
                    {label} ×
                  </button>
                ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                type="text"
                value={logCustomPlatform}
                onChange={(e) => setLogCustomPlatform(e.target.value)}
                placeholder="Custom platform name…"
                className="min-w-[12rem] flex-1 rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-xs text-white placeholder:text-[rgba(255,255,255,0.3)]"
              />
              <button
                type="button"
                onClick={addLogCustomPlatform}
                className="btn-ghost rounded-lg border border-[var(--border)] px-3 py-2 text-xs"
              >
                Add
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-[var(--muted)]">
              Published date
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs text-[var(--muted)]">
              Published time
              <input
                type="time"
                value={logTime}
                onChange={(e) => setLogTime(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-sm text-white"
              />
            </label>
          </div>
          <label className="block text-xs text-[var(--muted)]">
            Link to Task <span className="font-normal text-[rgba(255,255,255,0.35)]">(optional)</span>
            <select
              value={logTaskId}
              onChange={(e) => setLogTaskId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-sm text-white"
            >
              <option value="">— None —</option>
              {taskOptionsForLog.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-[var(--muted)]">
            Media description <span className="font-normal text-[rgba(255,255,255,0.35)]">(optional)</span>
            <input
              type="text"
              value={logMediaDescription}
              onChange={(e) => setLogMediaDescription(e.target.value)}
              placeholder="Describe the media used..."
              className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.04)] px-3 py-2 text-sm text-white placeholder:text-[rgba(255,255,255,0.3)]"
            />
          </label>
        </div>
        {logPastNotice ? (
          <p className={cn("mt-3 text-sm", logPastNoticeIsError ? "text-red-400" : "text-[rgba(255,255,255,0.65)]")}>
            {logPastNotice}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost rounded-lg px-3 py-2 text-xs" onClick={() => setLogPastOpen(false)}>
            Cancel
          </button>
          <button
            type="button"
            disabled={logPastSaving || !logContent.trim() || logPlatforms.size === 0}
            onClick={() => void saveLogPublishedPost()}
            className="btn-primary rounded-lg px-4 py-2 text-xs disabled:opacity-50"
          >
            {logPastSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </Modal>

      <Modal
        open={detailPost !== null}
        title="Scheduled post"
        onClose={() => setDetailPost(null)}
        closeLabel="Close"
      >
        {detailPost ? (
          <div className="space-y-3 text-sm">
            <p className="text-[var(--muted)]">Content</p>
            <p className="whitespace-pre-wrap text-white">{detailPost.content}</p>
            <p className="text-[var(--muted)]">Platforms</p>
            <p>{detailPost.platforms.join(", ")}</p>
            <p className="text-[var(--muted)]">Scheduled</p>
            <p>{detailPost.scheduled_at ? new Date(detailPost.scheduled_at).toLocaleString() : "—"}</p>
            {detailPost.published_at ? (
              <>
                <p className="text-[var(--muted)]">Published</p>
                <p>{new Date(detailPost.published_at).toLocaleString()}</p>
              </>
            ) : null}
            <p className="text-[var(--muted)]">Status</p>
            <p className="capitalize">{detailPost.status}</p>
            {detailPost.media_description ? (
              <>
                <p className="text-[var(--muted)]">Media</p>
                <p className="text-white">{detailPost.media_description}</p>
              </>
            ) : null}
            {detailPost.linked_task_id && taskLinkById[detailPost.linked_task_id]?.projectId ? (
              <>
                <p className="text-[var(--muted)]">Linked task</p>
                <Link
                  href={`/projects/${encodeURIComponent(taskLinkById[detailPost.linked_task_id]!.projectId)}?taskId=${encodeURIComponent(detailPost.linked_task_id)}`}
                  className="inline-block font-medium text-[#10b981] underline-offset-2 hover:underline"
                  onClick={() => setDetailPost(null)}
                >
                  {taskLinkById[detailPost.linked_task_id]!.projectName} — {taskLinkById[detailPost.linked_task_id]!.title}
                </Link>
              </>
            ) : null}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                className="btn-primary rounded-lg px-3 py-2 text-xs"
                onClick={() => {
                  const id = detailPost.id;
                  setDetailPost(null);
                  router.replace(`/publishing?tab=compose&edit=${encodeURIComponent(id)}`, { scroll: false });
                  setMainTab("compose");
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn-ghost rounded-lg border border-[rgba(239,68,68,0.35)] px-3 py-2 text-xs text-red-300"
                onClick={() => {
                  if (typeof window !== "undefined" && window.confirm("Delete this scheduled post?")) {
                    void handleDeletePost(detailPost.id);
                  }
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function MockPreview({
  platform,
  content,
  mediaUrl,
  mediaIsVideo,
}: {
  platform: Platform;
  content: string;
  mediaUrl?: string;
  mediaIsVideo?: boolean;
}) {
  const border =
    platform === "instagram"
      ? "border-[#E1306C]/40"
      : platform === "linkedin"
        ? "border-[#0A66C2]/40"
        : "border-white/30";
  return (
    <div className={cn("rounded-xl border bg-[#0e0e0e] p-4", border)}>
      <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.06)] pb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(255,255,255,0.08)] text-xs font-medium text-white">
          RR
        </div>
        <div>
          <p className="text-sm font-medium text-white">RocketRide</p>
          <p className="text-[10px] text-[var(--muted)]">Just now</p>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[rgba(255,255,255,0.88)]">
        {content.trim() || "Your post will appear here…"}
      </p>
      {mediaUrl ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.08)]">
          {mediaIsVideo ? (
            <video src={mediaUrl} className="max-h-40 w-full object-cover" muted playsInline controls={false} />
          ) : (
            <img src={mediaUrl} alt="" className="max-h-40 w-full object-cover" />
          )}
        </div>
      ) : null}
      <div className="mt-4 flex items-center gap-5 text-[rgba(255,255,255,0.35)]">
        <Heart className="h-4 w-4" strokeWidth={1.5} />
        <MessageCircle className="h-4 w-4" strokeWidth={1.5} />
        <Share2 className="h-4 w-4" strokeWidth={1.5} />
      </div>
    </div>
  );
}
