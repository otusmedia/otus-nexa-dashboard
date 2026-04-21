"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ExternalLink, Pencil, Trash2, Video, X } from "lucide-react";
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
  return TYPE_LABEL[event.type];
}

export function CalendarEventPopover({
  event,
  anchor,
  onClose,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent | null;
  anchor: { x: number; y: number } | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

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

  if (!event || !anchor || typeof document === "undefined") return null;

  const left = Math.min(Math.max(anchor.x, 160), window.innerWidth - 160);
  const top = Math.min(anchor.y + 8, window.innerHeight - 120);

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
  const canEdit = !taskReadOnly && !crmReadOnly;
  const canDelete = !taskReadOnly;

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[60] w-[min(100vw-2rem,320px)] rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl transition-opacity duration-200"
      style={{ left, top, transform: "translateX(-50%)" }}
    >
      <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] p-3">
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

      <div className="max-h-[50vh] space-y-3 overflow-y-auto p-3">
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
            <span className="text-[var(--muted)]">CRM Lead: </span>
            <Link
              href={event.lead_id ? `/crm/pipeline?lead=${encodeURIComponent(event.lead_id)}` : "/crm/pipeline"}
              className="font-medium text-[#10b981] underline-offset-2 hover:underline"
              onClick={() => onClose()}
            >
              {event.lead_name}
            </Link>
          </p>
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
        <p className="border-t border-[var(--border)] p-3 text-center text-[0.65rem] text-[var(--muted)]">
          Task deadlines are read-only on the calendar.
        </p>
      ) : (
        <div className="space-y-2 border-t border-[var(--border)] p-3">
          {crmReadOnly ? (
            <p className="text-center text-[0.65rem] text-[var(--muted)]">Edit this appointment from the CRM pipeline.</p>
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
