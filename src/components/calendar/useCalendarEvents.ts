"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "@/components/providers/app-providers";
import { CALENDAR_INVITABLE_USERS } from "@/components/calendar/calendar-invite-users";
import { supabase } from "@/lib/supabase";
import type { CalendarEvent, CalendarEventInvitee, CalendarEventType } from "@/types/calendar";
import { defaultColorForType } from "./calendar-utils";

type InviteRow = { email: string | null; user_id?: string | null };

const EXCLUDED_TASK_STATUSES = new Set(["Done", "Published"]);

function mapRow(row: Record<string, unknown>): CalendarEvent {
  const inviteesRaw = row.calendar_event_invitees;
  const invitees = Array.isArray(inviteesRaw)
    ? (inviteesRaw as Record<string, unknown>[]).map((r) => ({
        id: String(r.id ?? ""),
        event_id: String(r.event_id ?? ""),
        user_id: r.user_id != null ? String(r.user_id) : null,
        email: r.email != null ? String(r.email) : null,
        status: (r.status as CalendarEventInvitee["status"]) ?? "pending",
        created_at: String(r.created_at ?? ""),
      }))
    : undefined;

  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    description: row.description != null ? String(row.description) : null,
    start_at: String(row.start_at ?? ""),
    end_at: String(row.end_at ?? ""),
    all_day: Boolean(row.all_day),
    type: (row.type as CalendarEventType) || "event",
    meet_link: row.meet_link != null ? String(row.meet_link) : null,
    location: row.location != null ? String(row.location) : null,
    color: row.color != null ? String(row.color) : null,
    created_by: row.created_by != null ? String(row.created_by) : null,
    organization: null,
    created_at: String(row.created_at ?? ""),
    calendar_event_invitees: invitees,
    source: row.source != null ? String(row.source) : null,
    source_id: row.source_id != null ? String(row.source_id) : null,
    lead_id: row.lead_id != null ? String(row.lead_id) : null,
    lead_name: row.lead_name != null ? String(row.lead_name) : null,
  };
}

/** Stable id for virtual task events */
function taskDeadlineToEventStable(
  idPrefix: string,
  taskId: string,
  title: string,
  dueYmd: string,
  projectLabel: string,
  source: "project" | "marketing",
): CalendarEvent {
  const start = new Date(`${dueYmd}T09:00:00`);
  const end = new Date(`${dueYmd}T10:00:00`);
  return {
    id: `${idPrefix}${taskId}`,
    title,
    description: projectLabel ? `Project: ${projectLabel}` : null,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    all_day: false,
    type: "deadline",
    meet_link: null,
    location: null,
    color: "#FF4500",
    created_by: null,
    organization: null,
    created_at: "",
    is_task_deadline: true,
    task_meta: { projectLabel, source },
  };
}

function inRange(ev: CalendarEvent, rangeStart: Date, rangeEnd: Date): boolean {
  const s = new Date(ev.start_at).getTime();
  const e = new Date(ev.end_at).getTime();
  const a = rangeStart.getTime();
  const b = rangeEnd.getTime();
  return s <= b && e >= a;
}

function scheduledPostToCalendarEvent(row: Record<string, unknown>): CalendarEvent {
  const id = String(row.id ?? "");
  const content = String(row.content ?? "");
  const scheduledAt = String(row.scheduled_at ?? "");
  const platforms = Array.isArray(row.platforms) ? row.platforms.map(String) : [];
  const startMs = new Date(scheduledAt).getTime();
  const endIso = new Date(startMs + 60 * 60 * 1000).toISOString();
  const trimmed = content.trim();
  const title =
    trimmed.length === 0 ? "Scheduled post" : trimmed.length > 44 ? `${trimmed.slice(0, 44)}…` : trimmed;
  return {
    id: `spost-${id}`,
    title,
    description: content,
    start_at: scheduledAt,
    end_at: endIso,
    all_day: false,
    type: "other",
    meet_link: null,
    location: null,
    color: "#a855f7",
    created_by: row.created_by != null ? String(row.created_by) : null,
    organization: null,
    created_at: String(row.created_at ?? ""),
    source: "scheduled_post",
    source_id: id,
    is_scheduled_post: true,
    publishing_platforms: platforms,
    publishing_status: String(row.status ?? "scheduled"),
  };
}

export function useCalendarEvents(rangeStart: Date, rangeEnd: Date) {
  const { currentUser } = useAppContext();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  const startIso = rangeStart.toISOString();
  const endIso = rangeEnd.toISOString();

  const currentEmail = useMemo(() => {
    const byName = CALENDAR_INVITABLE_USERS.find((u) => u.name === currentUser.name);
    if (byName) return byName.email.toLowerCase();
    return "";
  }, [currentUser.name]);

  const canSeeEvent = useCallback(
    (event: CalendarEvent): boolean => {
      if (event.is_task_deadline) return true;
      if (event.source === "crm") {
        if (currentUser.role === "admin") return true;
        const invitees = (event.calendar_event_invitees ?? []).map((i) => (i.email ?? "").toLowerCase());
        if (currentEmail && invitees.includes(currentEmail)) return true;
        // Fallback when owner->email mapping fails: read owner name persisted in CRM description line.
        const ownerMatch = /(?:^|\n)Owner:\s*(.+?)(?:\n|$)/i.exec(event.description ?? "");
        const ownerName = ownerMatch?.[1]?.trim().toLowerCase() ?? "";
        return ownerName !== "" && ownerName === currentUser.name.trim().toLowerCase();
      }
      if (event.type === "meeting") {
        const invitees = (event.calendar_event_invitees ?? []).map((i) => (i.email ?? "").toLowerCase());
        if (currentEmail && invitees.includes(currentEmail)) return true;
        const createdBy = (event.created_by ?? "").toLowerCase();
        if (!createdBy) return false;
        return createdBy === currentUser.id.toLowerCase() || createdBy === currentUser.name.toLowerCase();
      }
      return true;
    },
    [currentEmail, currentUser.id, currentUser.name, currentUser.role],
  );

  const fetchEvents = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const [calRes, projTasksRes, mktTasksRes, scheduledRes] = await Promise.all([
        supabase
          .from("calendar_events")
          .select("*, calendar_event_invitees (*)")
          .gte("end_at", startIso)
          .lte("start_at", endIso),
        supabase
          .from("tasks")
          .select("id, title, due_date, status, assigned_to, projects(name)")
          .not("due_date", "is", null),
        supabase
          .from("marketing_tasks")
          .select("id, title, due_date, status, assigned_to, project_id")
          .not("due_date", "is", null),
        supabase
          .from("scheduled_posts")
          .select("*")
          .eq("status", "scheduled")
          .not("scheduled_at", "is", null)
          .gte("scheduled_at", startIso)
          .lte("scheduled_at", endIso),
      ]);

      if (calRes.error) {
        console.error("[calendar] fetch failed:", calRes.error.message);
        setError(calRes.error.message);
        setEvents([]);
        return;
      }

      if (projTasksRes.error) console.error("[calendar] project tasks:", projTasksRes.error.message);
      if (mktTasksRes.error) console.error("[calendar] marketing_tasks:", mktTasksRes.error.message);
      if (scheduledRes.error) console.error("[calendar] scheduled_posts:", scheduledRes.error.message);

      const mappedEvents = ((calRes.data as Record<string, unknown>[]) ?? []).map(mapRow);
      const crmEvents = mappedEvents.filter((e) => e.source === "crm");
      console.log("CRM events found:", crmEvents);
      const calEvents = mappedEvents.filter(canSeeEvent);

      const virtual: CalendarEvent[] = [];

      const projRows = (projTasksRes.data as Record<string, unknown>[] | null) ?? [];
      for (const row of projRows) {
        const status = String(row.status ?? "");
        if (EXCLUDED_TASK_STATUSES.has(status)) continue;
        const assignedTo = String(row.assigned_to ?? "").trim();
        if (!assignedTo || assignedTo !== currentUser.name) continue;
        const due = row.due_date != null ? String(row.due_date).slice(0, 10) : "";
        if (!due) continue;
        const proj = row.projects as { name?: string } | null | undefined;
        const projectLabel = proj?.name ? String(proj.name) : "Project";
        const ev = taskDeadlineToEventStable(
          "ptask-",
          String(row.id ?? ""),
          String(row.title ?? "Task"),
          due,
          projectLabel,
          "project",
        );
        if (inRange(ev, rangeStart, rangeEnd)) virtual.push(ev);
      }

      const mktRows = (mktTasksRes.data as Record<string, unknown>[] | null) ?? [];
      for (const row of mktRows) {
        const status = String(row.status ?? "");
        if (EXCLUDED_TASK_STATUSES.has(status)) continue;
        const assignedTo = String(row.assigned_to ?? "").trim();
        if (!assignedTo || assignedTo !== currentUser.name) continue;
        const due = row.due_date != null ? String(row.due_date).slice(0, 10) : "";
        if (!due) continue;
        const projectLabel = "Marketing";
        const ev = taskDeadlineToEventStable(
          "mtask-",
          String(row.id ?? ""),
          String(row.title ?? "Task"),
          due,
          projectLabel,
          "marketing",
        );
        if (inRange(ev, rangeStart, rangeEnd)) virtual.push(ev);
      }

      const scheduledRows = (scheduledRes.data as Record<string, unknown>[] | null) ?? [];
      const scheduledEvents = scheduledRows.map(scheduledPostToCalendarEvent).filter((ev) => inRange(ev, rangeStart, rangeEnd));

      setEvents([...calEvents, ...virtual, ...scheduledEvents]);
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [startIso, endIso, canSeeEvent, currentUser.name, rangeStart.getTime(), rangeEnd.getTime()]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const createEvent = useCallback(
    async (input: {
      title: string;
      description: string;
      type: CalendarEventType;
      start_at: string;
      end_at: string;
      all_day: boolean;
      meet_link: string;
      location: string;
      color: string;
      invitees: InviteRow[];
    }) => {
      const color = input.color || defaultColorForType(input.type);
      const { data: row, error: insErr } = await supabase
        .from("calendar_events")
        .insert([
          {
            title: input.title,
            description: input.description || null,
            type: input.type,
            start_at: input.start_at,
            end_at: input.end_at,
            all_day: input.all_day,
            meet_link: input.type === "meeting" && input.meet_link ? input.meet_link : null,
            location: input.location || null,
            color,
          },
        ])
        .select()
        .single();

      if (insErr || !row) {
        console.error("[calendar] insert failed:", insErr?.message);
        return { ok: false as const, error: insErr?.message ?? "Insert failed" };
      }

      const eventId = String((row as Record<string, unknown>).id ?? "");
      if (input.invitees.length > 0) {
        const { error: invErr } = await supabase.from("calendar_event_invitees").insert(
          input.invitees.map((inv) => ({
            event_id: eventId,
            email: inv.email,
            user_id: inv.user_id ?? null,
            status: "pending" as const,
          })),
        );
        if (invErr) {
          console.error("[calendar] invitees insert failed:", invErr.message);
        }
      }

      await fetchEvents();
      return { ok: true as const, id: eventId };
    },
    [fetchEvents],
  );

  const updateEvent = useCallback(
    async (
      id: string,
      input: {
        title: string;
        description: string;
        type: CalendarEventType;
        start_at: string;
        end_at: string;
        all_day: boolean;
        meet_link: string;
        location: string;
        color: string;
        invitees: InviteRow[];
      },
    ) => {
      const color = input.color || defaultColorForType(input.type);
      const { error: upErr } = await supabase
        .from("calendar_events")
        .update({
          title: input.title,
          description: input.description || null,
          type: input.type,
          start_at: input.start_at,
          end_at: input.end_at,
          all_day: input.all_day,
          meet_link: input.type === "meeting" && input.meet_link ? input.meet_link : null,
          location: input.location || null,
          color,
        })
        .eq("id", id);

      if (upErr) {
        console.error("[calendar] update failed:", upErr.message);
        return { ok: false as const, error: upErr.message };
      }

      await supabase.from("calendar_event_invitees").delete().eq("event_id", id);
      if (input.invitees.length > 0) {
        await supabase.from("calendar_event_invitees").insert(
          input.invitees.map((inv) => ({
            event_id: id,
            email: inv.email,
            user_id: inv.user_id ?? null,
            status: "pending" as const,
          })),
        );
      }

      await fetchEvents();
      return { ok: true as const };
    },
    [fetchEvents],
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      const { error: delErr } = await supabase.from("calendar_events").delete().eq("id", id);
      if (delErr) {
        console.error("[calendar] delete failed:", delErr.message);
        return { ok: false as const, error: delErr.message };
      }
      await fetchEvents();
      return { ok: true as const };
    },
    [fetchEvents],
  );

  const value = useMemo(() => ({ events, loading, error, refetch: fetchEvents, createEvent, updateEvent, deleteEvent }), [events, loading, error, fetchEvents, createEvent, updateEvent, deleteEvent]);

  return value;
}
