"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { CheckCircle, ExternalLink, Pencil, Trash2, Video, X } from "lucide-react";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import {
  completeCrmAppointment,
  crmAppointmentCompletionErrorMessage,
  formatCrmAppointmentCompletedAt,
  isCrmAppointmentDone,
  type CrmAppointment,
} from "@/lib/crm-data";
import { dispatchCrmAppointmentCompleted } from "@/lib/crm-appointment-events";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { CalendarEvent, CalendarEventType } from "@/types/calendar";
import { eventDisplayColor } from "./calendar-utils";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function hue(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h + name.charCodeAt(i) * 17) % 360;
  return h;
}

const TYPE_LABEL: Record<CalendarEventType, string> = {
  event: "Event",
  meeting: "Meeting",
  deadline: "Task deadline",
  other: "Reminder",
};

function typeBadgeLabel(event: CalendarEvent): string {
  if (event.is_task_deadline) return "Task deadline";
  if (event.source === "crm") return "CRM";
  if (event.source === "scheduled_post" || event.is_scheduled_post) return "Publishing";
  return TYPE_LABEL[event.type];
}

export function CalendarEventPopover({
  event,
  anchor,
  onClose,
  onEdit,
  onDelete,
  publishingScheduleMode = false,
  publishingScheduledPostAllowEdit = true,
  onEditScheduledPost,
  onDeleteScheduledPost,
  onCrmAppointmentCompleted,
}: {
  event: CalendarEvent | null;
  anchor: { x: number; y: number } | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** When true, scheduled Publishing posts show Edit/Delete instead of read-only calendar messaging. */
  publishingScheduleMode?: boolean;
  /** When false (e.g. RocketRide client org), hide Edit for scheduled posts; Delete may still show if `onDeleteScheduledPost` is set. */
  publishingScheduledPostAllowEdit?: boolean;
  onEditScheduledPost?: (postId: string) => void;
  onDeleteScheduledPost?: (postId: string) => void;
  onCrmAppointmentCompleted?: () => void;
}) {
  const { currentUser, language, pushNotification } = useAppContext();
  const { t: lt } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const [crmAppt, setCrmAppt] = useState<Pick<CrmAppointment, "status" | "completed_at" | "completed_by"> | null>(
    null,
  );
  const [crmCompleting, setCrmCompleting] = useState(false);

  useEffect(() => {
    if (!event?.source_id || event.source !== "crm") {
      setCrmAppt(null);
      return;
    }
    let cancelled = false;
    void supabase
      .from("crm_appointments")
      .select("status, completed_at, completed_by")
      .eq("id", event.source_id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) {
          setCrmAppt(null);
          return;
        }
        const row = data as Record<string, unknown>;
        const statusRaw = String(row.status ?? "").trim().toLowerCase();
        setCrmAppt({
          status: statusRaw === "done" || row.completed_at != null ? "done" : "pending",
          completed_at: row.completed_at != null ? String(row.completed_at) : null,
          completed_by: row.completed_by != null ? String(row.completed_by) : null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [event?.id, event?.source, event?.source_id]);

  useEffect(() => {
    if (!event) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const t = window.setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
    };
  }, [event, onClose]);

  useLayoutEffect(() => {
    if (!anchor || !ref.current) {
      setCoords(null);
      return;
    }
    const margin = 12;
    const gap = 8;
    const rect = ref.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const halfW = rect.width / 2;

    const left = Math.min(Math.max(anchor.x, halfW + margin), vw - halfW - margin);
    const spaceBelow = vh - anchor.y - margin;
    const spaceAbove = anchor.y - margin;
    let top: number;
    if (rect.height + gap <= spaceBelow) {
      top = anchor.y + gap;
    } else if (rect.height + gap <= spaceAbove) {
      top = anchor.y - rect.height - gap;
    } else {
      top = Math.max(margin, vh - rect.height - margin);
    }

    setCoords({ left, top });
  }, [anchor, event]);

  if (!event || !anchor || typeof document === "undefined") return null;

  const left = coords?.left ?? Math.min(Math.max(anchor.x, 160), window.innerWidth - 160);
  const top = coords?.top ?? Math.max(12, anchor.y + 8);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const invitees = event.calendar_event_invitees ?? [];
  const taskReadOnly = Boolean(event.is_task_deadline);
  const crmReadOnly = event.source === "crm";
  const publishingReadOnly =
    (event.source === "scheduled_post" || event.is_scheduled_post) && !publishingScheduleMode;
  const canEdit = !taskReadOnly && !crmReadOnly && !publishingReadOnly;
  const canDelete = !taskReadOnly && !publishingReadOnly;
  const scheduledManage =
    publishingScheduleMode && (event.source === "scheduled_post" || event.is_scheduled_post) && event.source_id;
  const crmDone = crmAppt ? isCrmAppointmentDone(crmAppt) : false;
  const canMarkCrmDone = crmReadOnly && Boolean(event.source_id) && !crmDone;

  const handleMarkCrmDone = async () => {
    if (!event?.source_id) return;
    const actor = currentUser.name?.trim() || currentUser.email?.trim() || "";
    if (!actor) {
      pushNotification(crmAppointmentCompletionErrorMessage("MISSING_ACTOR", language), "task");
      return;
    }
    setCrmCompleting(true);
    const result = await completeCrmAppointment(event.source_id, actor, language);
    setCrmCompleting(false);
    if (!result.ok) {
      const msg = crmAppointmentCompletionErrorMessage(result.error, language);
      pushNotification(`${lt("Could not complete appointment")}: ${msg}`, "task");
      console.error("[calendar] complete crm appointment", result.error);
      return;
    }
    const completedAt = new Date().toISOString();
    setCrmAppt({
      status: "done",
      completed_at: completedAt,
      completed_by: actor,
    });
    pushNotification(lt("Appointment marked as done"), "task");
    dispatchCrmAppointmentCompleted(event.source_id, result.leadId ?? event.lead_id);
    onCrmAppointmentCompleted?.();
  };

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[200] flex max-h-[min(85vh,calc(100vh-24px))] w-[min(100vw-2rem,320px)] flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
      style={{ left, top, transform: "translateX(-50%)" }}
    >
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[var(--border)] p-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-medium"
              style={{
                backgroundColor: `${eventDisplayColor(event)}26`,
                color: eventDisplayColor(event),
                border: `1px solid ${eventDisplayColor(event)}55`,
              }}
            >
              {typeBadgeLabel(event)}
            </span>
          </div>
          <h3 className="mt-2 text-base font-medium text-white">{event.title}</h3>
          <p className="mt-1 text-xs font-light text-[var(--muted)]">
            {event.all_day ? "All day · " : ""}
            {fmt(event.start_at)}
            {!event.all_day ? ` – ${fmt(event.end_at)}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--surface-elevated)] hover:text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {taskReadOnly && event.task_meta ? (
          <p className="text-sm font-light text-[rgba(255,255,255,0.85)]">
            <span className="text-[var(--muted)]">Project: </span>
            {event.task_meta.projectLabel}
          </p>
        ) : null}

        {event.description ? (
          <p className="text-sm font-light leading-relaxed text-[rgba(255,255,255,0.85)]">{event.description}</p>
        ) : null}

        {event.source === "crm" && event.lead_name ? (
          <p className="text-sm">
            <span className="text-[var(--muted)]">{lt("CRM Lead")}: </span>
            <Link
              href={event.lead_id ? `/crm/pipeline?lead=${encodeURIComponent(event.lead_id)}` : "/crm/pipeline"}
              className="font-medium text-[#10b981] underline-offset-2 hover:underline"
              onClick={() => onClose()}
            >
              {event.lead_name}
            </Link>
          </p>
        ) : null}

        {crmReadOnly && crmDone && crmAppt?.completed_by ? (
          <p className="rounded-lg border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.08)] px-3 py-2 text-xs text-[#86efac]">
            {lt("Completed by")} {crmAppt.completed_by}
            {crmAppt.completed_at
              ? ` · ${formatCrmAppointmentCompletedAt(crmAppt.completed_at, language)}`
              : ""}
          </p>
        ) : null}

        {publishingReadOnly && event.publishing_platforms && event.publishing_platforms.length > 0 ? (
          <p className="text-xs text-[var(--muted)]">
            <span className="text-white/70">Platforms: </span>
            {event.publishing_platforms.join(", ")}
          </p>
        ) : null}

        {publishingScheduleMode &&
        event.scheduled_post_linked_task_id &&
        event.scheduled_post_project_id &&
        event.scheduled_post_task_name ? (
          <p className="text-sm">
            <span className="text-[var(--muted)]">Linked task: </span>
            <Link
              href={`/projects/${encodeURIComponent(event.scheduled_post_project_id)}?taskId=${encodeURIComponent(event.scheduled_post_linked_task_id)}`}
              className="font-medium text-[#10b981] underline-offset-2 hover:underline"
              onClick={() => onClose()}
            >
              {event.scheduled_post_task_name}
            </Link>
          </p>
        ) : null}

        {publishingReadOnly && event.source_id && !publishingScheduleMode ? (
          <Link
            href={`/content-management/compose?tab=schedule&post=${encodeURIComponent(event.source_id)}`}
            className="inline-flex w-full items-center justify-center rounded-lg bg-[rgba(168,85,247,0.2)] px-3 py-2 text-xs font-medium text-[#d8b4fe] transition hover:bg-[rgba(168,85,247,0.3)]"
            onClick={() => onClose()}
          >
            Open in Publishing
          </Link>
        ) : null}

        {event.type === "meeting" && event.meet_link ? (
          <a
            href={event.meet_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-[rgba(24,119,242,0.2)] px-3 py-2 text-xs font-medium text-[#93c5fd] transition hover:bg-[rgba(24,119,242,0.3)]"
          >
            <Video className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            Join Meeting
            <ExternalLink className="h-3 w-3 opacity-70" />
          </a>
        ) : null}

        {event.location ? (
          <p className="text-xs font-light text-[var(--muted)]">
            <span className="text-white/70">Location: </span>
            {event.location}
          </p>
        ) : null}

        {invitees.length > 0 ? (
          <div>
            <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-wider text-[var(--muted)]">Participants</p>
            <ul className="space-y-2">
              {invitees.map((inv) => {
                const label = inv.email || inv.user_id || "Guest";
                return (
                  <li key={inv.id} className="flex items-center gap-2">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[0.65rem] font-medium text-white"
                      style={{ backgroundColor: `hsla(${hue(label)}, 35%, 32%, 1)` }}
                    >
                      {initials(label)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-white">{label}</p>
                      <span
                        className={cn(
                          "mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium capitalize",
                          inv.status === "accepted" && "bg-[rgba(34,197,94,0.2)] text-[#86efac]",
                          inv.status === "declined" && "bg-[rgba(239,68,68,0.2)] text-[#fca5a5]",
                          inv.status === "pending" && "bg-[rgba(255,255,255,0.08)] text-[var(--muted)]",
                        )}
                      >
                        {inv.status}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>

      {taskReadOnly ? (
        <p className="shrink-0 border-t border-[var(--border)] p-3 text-center text-[0.65rem] text-[var(--muted)]">
          Task deadlines are read-only on the calendar.
        </p>
      ) : publishingReadOnly ? (
        <p className="shrink-0 border-t border-[var(--border)] p-3 text-center text-[0.65rem] text-[var(--muted)]">
          Scheduled posts are managed in Publishing.
        </p>
      ) : scheduledManage ? (
        <div className="shrink-0 space-y-2 border-t border-[var(--border)] p-3">
          <div className="flex gap-2">
            {publishingScheduledPostAllowEdit && onEditScheduledPost ? (
              <button
                type="button"
                onClick={() => {
                  if (event.source_id) onEditScheduledPost(event.source_id);
                  onClose();
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--border)] py-2 text-xs font-medium text-white transition hover:bg-[var(--surface-elevated)]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            ) : null}
            {onDeleteScheduledPost ? (
              <button
                type="button"
                onClick={() => {
                  if (
                    typeof window !== "undefined" &&
                    window.confirm("Delete this scheduled post?") &&
                    event.source_id
                  ) {
                    onDeleteScheduledPost(event.source_id);
                    onClose();
                  }
                }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border border-[rgba(239,68,68,0.35)] py-2 text-xs font-medium text-[#fca5a5] transition hover:bg-[rgba(239,68,68,0.1)]",
                  publishingScheduledPostAllowEdit && onEditScheduledPost ? "flex-1" : "w-full",
                )}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="shrink-0 space-y-2 border-t border-[var(--border)] p-3">
          {canMarkCrmDone ? (
            <button
              type="button"
              disabled={crmCompleting}
              onClick={() => void handleMarkCrmDone()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.12)] py-2.5 text-xs font-medium text-[#86efac] transition hover:bg-[rgba(34,197,94,0.2)] disabled:opacity-50"
            >
              <CheckCircle className="h-4 w-4" strokeWidth={1.5} />
              {crmCompleting ? lt("Saving…") : lt("Mark as done")}
            </button>
          ) : null}
          {crmReadOnly && !canMarkCrmDone && !crmDone ? (
            <p className="text-center text-[0.65rem] text-[var(--muted)]">
              {lt("Edit this appointment from the CRM pipeline.")}
            </p>
          ) : null}
          <div className="flex gap-2">
            {canEdit ? (
              <button
                type="button"
                onClick={() => {
                  onEdit();
                  onClose();
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--border)] py-2 text-xs font-medium text-white transition hover:bg-[var(--surface-elevated)]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined" && window.confirm("Delete this event?")) {
                    onDelete();
                    onClose();
                  }
                }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg border border-[rgba(239,68,68,0.35)] py-2 text-xs font-medium text-[#fca5a5] transition hover:bg-[rgba(239,68,68,0.1)]",
                  canEdit ? "flex-1" : "w-full",
                )}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
