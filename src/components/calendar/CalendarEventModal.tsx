"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarEvent, CalendarEventType } from "@/types/calendar";
import { CALENDAR_INVITABLE_USERS } from "./calendar-invite-users";
import { defaultColorForType, pad2, toDateInputValue } from "./calendar-utils";

type UiEventKind = "meeting" | "reminder" | "event";

function uiKindToDb(kind: UiEventKind): { type: CalendarEventType; color: string } {
  if (kind === "meeting") return { type: "meeting", color: "#1877F2" };
  if (kind === "reminder") return { type: "other", color: "#eab308" };
  return { type: "event", color: "#8b5cf6" };
}

function dbToUiKind(ev: CalendarEvent): UiEventKind {
  if (ev.type === "meeting") return "meeting";
  if (ev.type === "other" || (ev.color && ev.color.includes("eab308"))) return "reminder";
  return "event";
}

function localIsoFromDateAndTime(dateYmd: string, timeHm: string): string {
  const [yy, mm, dd] = dateYmd.split("-").map(Number);
  const [th, tm] = timeHm.split(":").map(Number);
  const d = new Date(yy, (mm ?? 1) - 1, dd ?? 1, th ?? 0, tm ?? 0, 0, 0);
  return d.toISOString();
}

export function CalendarEventModal({
  open,
  mode,
  event,
  defaultStart,
  onClose,
  onSubmit,
}: {
  open: boolean;
  mode: "create" | "edit";
  event: CalendarEvent | null;
  defaultStart: Date | null;
  onClose: () => void;
  onSubmit: (payload: {
    title: string;
    description: string;
    type: CalendarEventType;
    start_at: string;
    end_at: string;
    all_day: boolean;
    meet_link: string;
    location: string;
    color: string;
    invitees: { email: string | null; user_id: string | null }[];
  }) => Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uiKind, setUiKind] = useState<UiEventKind>("event");
  const [dateStr, setDateStr] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("");
  const [locationOrLink, setLocationOrLink] = useState("");
  const [inviteEmails, setInviteEmails] = useState<Set<string>>(new Set());
  const [externalEmails, setExternalEmails] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && event && !event.is_task_deadline) {
      setTitle(event.title);
      setDescription(event.description ?? "");
      setUiKind(dbToUiKind(event));
      const s = new Date(event.start_at);
      const e = new Date(event.end_at);
      setDateStr(toDateInputValue(s));
      setStartTime(`${pad2(s.getHours())}:${pad2(s.getMinutes())}`);
      setEndTime(`${pad2(e.getHours())}:${pad2(e.getMinutes())}`);
      setLocationOrLink(event.location || event.meet_link || "");
      const emails = new Set(
        (event.calendar_event_invitees ?? []).map((i) => i.email).filter(Boolean) as string[],
      );
      setInviteEmails(emails);
      setExternalEmails("");
      return;
    }
    const base = defaultStart ? new Date(defaultStart) : new Date();
    if (!defaultStart) {
      base.setMinutes(0, 0, 0);
      base.setHours(base.getHours() + 1);
    }
    const end = new Date(base);
    end.setHours(end.getHours() + 1);
    setTitle("");
    setDescription("");
    setUiKind("event");
    setDateStr(toDateInputValue(base));
    setStartTime(`${pad2(base.getHours())}:${pad2(base.getMinutes())}`);
    setEndTime(`${pad2(end.getHours())}:${pad2(end.getMinutes())}`);
    setLocationOrLink("");
    setInviteEmails(new Set());
    setExternalEmails("");
  }, [open, mode, event, defaultStart]);

  const toggleInvite = (email: string) => {
    setInviteEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed || !dateStr || !startTime) return;
    const { type, color } = uiKindToDb(uiKind);
    let endHm = endTime.trim();
    if (!endHm) {
      const [h, m] = startTime.split(":").map((x) => Number(x));
      const d = new Date();
      d.setHours(h || 0, (m || 0) + 60, 0, 0);
      endHm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    }
    const start_at = localIsoFromDateAndTime(dateStr, startTime);
    let end_at = localIsoFromDateAndTime(dateStr, endHm);
    if (new Date(end_at) < new Date(start_at)) {
      const next = new Date(new Date(start_at).getTime() + 60 * 60 * 1000);
      end_at = next.toISOString();
    }
    const loc = locationOrLink.trim();
    const isUrl = /^https?:\/\//i.test(loc);
    const meet_link = type === "meeting" && isUrl ? loc : "";
    const location = type === "meeting" && isUrl ? "" : loc;

    const invitees = CALENDAR_INVITABLE_USERS.filter((u) => inviteEmails.has(u.email)).map((u) => ({
      email: u.email,
      user_id: null as string | null,
    }));
    for (const raw of externalEmails.split(/[,;\n]+/)) {
      const e = raw.trim();
      if (e.includes("@")) invitees.push({ email: e, user_id: null });
    }

    setSaving(true);
    try {
      const ok = await onSubmit({
        title: trimmed,
        description: description.trim(),
        type,
        start_at,
        end_at,
        all_day: false,
        meet_link,
        location,
        color: color || defaultColorForType(type),
        invitees,
      });
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm transition-opacity duration-200">
      <div className="max-h-[92vh] w-full max-w-lg scale-100 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl transition-transform duration-200 ease-out">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <h2 className="text-lg font-normal text-white">{mode === "edit" ? "Edit event" : "New event"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--surface-elevated)] hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <div
          className="space-y-4 p-4"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              void handleSubmit();
            }
          }}
        >
          <label className="block space-y-1">
            <span className="text-xs font-medium text-[var(--muted)]">Title *</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white outline-none focus:border-[var(--primary)]"
              placeholder="Event title"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-[var(--muted)]">Type</span>
            <select
              value={uiKind}
              onChange={(e) => setUiKind(e.target.value as UiEventKind)}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white outline-none"
            >
              <option value="meeting">Meeting</option>
              <option value="reminder">Reminder</option>
              <option value="event">Event</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-[var(--muted)]">Date *</span>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="mono-num w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white [color-scheme:dark]"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-[var(--muted)]">Start time *</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mono-num w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white [color-scheme:dark]"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-[var(--muted)]">End time</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mono-num w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white [color-scheme:dark]"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-[var(--muted)]">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-y rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white outline-none"
              placeholder="Notes…"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-[var(--muted)]">Location or link</span>
            <input
              value={locationOrLink}
              onChange={(e) => setLocationOrLink(e.target.value)}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white outline-none"
              placeholder="Optional"
            />
          </label>

          <div className="space-y-2">
            <span className="text-xs font-medium text-[var(--muted)]">Participants</span>
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] p-2">
              {CALENDAR_INVITABLE_USERS.map((u) => {
                const sel = inviteEmails.has(u.email);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleInvite(u.email)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-light transition",
                      sel ? "bg-[rgba(255,69,0,0.15)] text-white" : "text-[var(--muted)] hover:bg-[rgba(255,255,255,0.04)]",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border text-[0.65rem]",
                        sel ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)]",
                      )}
                    >
                      {sel ? "✓" : ""}
                    </span>
                    {u.name}
                  </button>
                );
              })}
            </div>
            <label className="block space-y-1">
              <span className="text-[0.65rem] text-[var(--muted)]">External emails (comma-separated)</span>
              <input
                value={externalEmails}
                onChange={(e) => setExternalEmails(e.target.value)}
                className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                placeholder="guest@example.com"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs font-medium text-[var(--muted)] transition hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !title.trim() || !dateStr}
              onClick={() => void handleSubmit()}
              className="btn-primary rounded-lg px-4 py-2 text-xs disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
