"use client";

import { useEffect, useState } from "react";
import { Video, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarEvent, CalendarEventType } from "@/types/calendar";
import { CALENDAR_INVITABLE_USERS } from "./calendar-invite-users";
import {
  defaultColorForType,
  fromDateInputAtEndOfDay,
  fromDateInputAtStartOfDay,
  fromDatetimeLocalValue,
  toDateInputValue,
  toDatetimeLocalValue,
} from "./calendar-utils";

const PRESET_COLORS = ["#ef4444", "#3b82f6", "#f97316", "#22c55e", "#a855f7", "#eab308"];

const TYPES: CalendarEventType[] = ["event", "meeting", "deadline", "other"];

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
  const [type, setType] = useState<CalendarEventType>("event");
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startDt, setStartDt] = useState("");
  const [endDt, setEndDt] = useState("");
  const [meetLink, setMeetLink] = useState("");
  const [location, setLocation] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [inviteEmails, setInviteEmails] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && event) {
      setTitle(event.title);
      setDescription(event.description ?? "");
      setType(event.type);
      setAllDay(event.all_day);
      setMeetLink(event.meet_link ?? "");
      setLocation(event.location ?? "");
      setColor(event.color || defaultColorForType(event.type));
      const s = new Date(event.start_at);
      const e = new Date(event.end_at);
      if (event.all_day) {
        setStartDate(toDateInputValue(s));
        setEndDate(toDateInputValue(e));
      } else {
        setStartDt(toDatetimeLocalValue(event.start_at));
        setEndDt(toDatetimeLocalValue(event.end_at));
      }
      const emails = new Set(
        (event.calendar_event_invitees ?? []).map((i) => i.email).filter(Boolean) as string[],
      );
      setInviteEmails(emails);
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
    setType("event");
    setAllDay(false);
    setStartDt(toDatetimeLocalValue(base.toISOString()));
    setEndDt(toDatetimeLocalValue(end.toISOString()));
    setStartDate(toDateInputValue(base));
    setEndDate(toDateInputValue(base));
    setMeetLink("");
    setLocation("");
    setColor(defaultColorForType("event"));
    setInviteEmails(new Set());
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
    if (!trimmed) return;
    let start_at: string;
    let end_at: string;
    if (allDay) {
      if (!startDate || !endDate) return;
      start_at = fromDateInputAtStartOfDay(startDate);
      end_at = fromDateInputAtEndOfDay(endDate);
    } else {
      if (!startDt || !endDt) return;
      start_at = fromDatetimeLocalValue(startDt);
      end_at = fromDatetimeLocalValue(endDt);
    }
    if (new Date(end_at) < new Date(start_at)) {
      end_at = start_at;
    }
    const invitees = CALENDAR_INVITABLE_USERS.filter((u) => inviteEmails.has(u.email)).map((u) => ({
      email: u.email,
      user_id: null as string | null,
    }));
    setSaving(true);
    try {
      const ok = await onSubmit({
        title: trimmed,
        description: description.trim(),
        type,
        start_at,
        end_at,
        all_day: allDay,
        meet_link: meetLink.trim(),
        location: location.trim(),
        color,
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
              value={type}
              onChange={(e) => {
                const t = e.target.value as CalendarEventType;
                setType(t);
                setColor((c) => ((PRESET_COLORS as readonly string[]).includes(c) ? c : defaultColorForType(t)));
              }}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white outline-none"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border)]"
            />
            <span className="text-sm font-light text-white">All day</span>
          </label>

          {allDay ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-[var(--muted)]">Start date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mono-num w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-[var(--muted)]">End date</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mono-num w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-[var(--muted)]">Start</span>
                <input
                  type="datetime-local"
                  value={startDt}
                  onChange={(e) => setStartDt(e.target.value)}
                  className="mono-num w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-[var(--muted)]">End</span>
                <input
                  type="datetime-local"
                  value={endDt}
                  onChange={(e) => setEndDt(e.target.value)}
                  className="mono-num w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm text-white"
                />
              </label>
            </div>
          )}

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

          {type === "meeting" ? (
            <label className="block space-y-1">
              <span className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
                <Video className="h-3.5 w-3.5" strokeWidth={1.5} />
                Meet link
              </span>
              <input
                type="url"
                value={meetLink}
                onChange={(e) => setMeetLink(e.target.value)}
                className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white outline-none"
                placeholder="https://meet.google.com/..."
              />
            </label>
          ) : null}

          <label className="block space-y-1">
            <span className="text-xs font-medium text-[var(--muted)]">Location</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-light text-white outline-none"
              placeholder="Optional"
            />
          </label>

          <div className="space-y-2">
            <span className="text-xs font-medium text-[var(--muted)]">Invite</span>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-[6px] border border-[var(--border)] bg-[var(--surface-elevated)] p-2">
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
                    <span className={cn("flex h-4 w-4 items-center justify-center rounded border text-[0.65rem]", sel ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)]")}>
                      {sel ? "✓" : ""}
                    </span>
                    {u.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-[var(--muted)]">Color</span>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition",
                    color === c ? "border-white scale-110" : "border-transparent opacity-80 hover:opacity-100",
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
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
              disabled={saving || !title.trim()}
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
