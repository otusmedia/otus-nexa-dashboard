"use client";

import { useMemo, useState } from "react";
import type { CalendarEvent } from "@/types/calendar";
import { CalendarGrid, CalendarEmptyState } from "./CalendarGrid";
import { CalendarEventModal } from "./CalendarEventModal";
import { CalendarEventPopover } from "./CalendarEventPopover";
import { CalendarHeader } from "./CalendarHeader";
import { CalendarWeekView } from "./CalendarWeekView";
import { addDays, endOfDay, getMonthGridRange, startOfDay } from "./calendar-utils";
import { useCalendar } from "./useCalendar";
import { useCalendarEvents } from "./useCalendarEvents";

export function CalendarModule() {
  const { view, setView, currentDate, weekStart, goToday, goPrev, goNext } = useCalendar();

  const { rangeStart, rangeEnd } = useMemo(() => {
    let r: { rangeStart: Date; rangeEnd: Date };
    if (view === "month") r = getMonthGridRange(currentDate);
    else r = { rangeStart: startOfDay(weekStart), rangeEnd: endOfDay(addDays(weekStart, 6)) };
    return {
      rangeStart: addDays(r.rangeStart, -7),
      rangeEnd: addDays(r.rangeEnd, 7),
    };
  }, [view, currentDate, weekStart]);

  const { events, loading, createEvent, updateEvent, deleteEvent } = useCalendarEvents(rangeStart, rangeEnd);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [defaultStart, setDefaultStart] = useState<Date | null>(null);

  const [popover, setPopover] = useState<{ event: CalendarEvent; x: number; y: number } | null>(null);

  const openCreate = (d?: Date) => {
    setModalMode("create");
    setEditingEvent(null);
    setDefaultStart(d ?? null);
    setModalOpen(true);
  };

  const openEditFromPopover = (ev: CalendarEvent) => {
    if (ev.is_task_deadline || ev.source === "crm") return;
    setModalMode("edit");
    setEditingEvent(ev);
    setDefaultStart(null);
    setModalOpen(true);
  };

  const persistedCount = events.filter((e) => !e.is_task_deadline).length;

  return (
    <div className="min-h-[calc(100vh-6rem)] w-full bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-8">
        <CalendarHeader
          view={view}
          onViewChange={setView}
          currentDate={currentDate}
          weekStart={weekStart}
          onPrev={goPrev}
          onNext={goNext}
          onToday={goToday}
        />

        <div className="mt-6 transition-opacity duration-200 ease-out" key={view}>
          {view === "month" ? (
            <CalendarGrid
              anchorDate={currentDate}
              events={events}
              loading={loading}
              onDayClick={(d) => openCreate(startOfDay(d))}
              onAddOnDay={(d) => openCreate(startOfDay(d))}
              onEventClick={(ev, e) => setPopover({ event: ev, x: e.clientX, y: e.clientY })}
            />
          ) : null}
          {view === "week" ? (
            <CalendarWeekView
              weekStart={weekStart}
              events={events}
              onDayClick={(d) => openCreate(d)}
              onEventClick={(ev, e) => setPopover({ event: ev, x: e.clientX, y: e.clientY })}
            />
          ) : null}
        </div>

        <CalendarEmptyState show={!loading && persistedCount === 0} />

        <CalendarEventModal
          open={modalOpen}
          mode={modalMode}
          event={editingEvent}
          defaultStart={defaultStart}
          onClose={() => {
            setModalOpen(false);
            setEditingEvent(null);
            setDefaultStart(null);
          }}
          onSubmit={async (payload) => {
            if (modalMode === "edit" && editingEvent) {
              const r = await updateEvent(editingEvent.id, payload);
              if (!r.ok) {
                console.error(r.error);
                return false;
              }
              return true;
            }
            const r = await createEvent(payload);
            if (!r.ok) {
              console.error(r.error);
              return false;
            }
            return true;
          }}
        />

        <CalendarEventPopover
          event={popover?.event ?? null}
          anchor={popover ? { x: popover.x, y: popover.y } : null}
          onClose={() => setPopover(null)}
          onEdit={() => {
            if (popover) openEditFromPopover(popover.event);
          }}
          onDelete={() => {
            if (popover) void deleteEvent(popover.event.id);
          }}
        />
      </div>
    </div>
  );
}
