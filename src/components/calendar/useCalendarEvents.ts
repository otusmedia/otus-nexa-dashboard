"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { CalendarEvent, CalendarEventInvitee, CalendarEventType } from "@/types/calendar";
import { defaultColorForType } from "./calendar-utils";

type InviteRow = { email: string | null; user_id?: string | null };

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
  };
}

export function useCalendarEvents(rangeStart: Date, rangeEnd: Date) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const startIso = rangeStart.toISOString();
  const endIso = rangeEnd.toISOString();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from("calendar_events")
      .select("*, calendar_event_invitees (*)")
      .gte("end_at", startIso)
      .lte("start_at", endIso);

    if (fetchError) {
      console.error("[calendar] fetch failed:", fetchError.message);
      setError(fetchError.message);
      setEvents([]);
      setLoading(false);
      return;
    }

    setEvents(((data as Record<string, unknown>[]) ?? []).map(mapRow));
    setLoading(false);
  }, [startIso, endIso]);

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

  const value = useMemo(
    () => ({ events, loading, error, refetch: fetchEvents, createEvent, updateEvent, deleteEvent }),
    [events, loading, error, fetchEvents, createEvent, updateEvent, deleteEvent],
  );

  return value;
}
