"use client";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleGuard } from "@/components/layout/module-guard";
import { useAppContext } from "@/components/providers/app-providers";
import { Modal } from "@/components/ui/modal";

export default function EventsPage() {
  const { events, availableUsers, addEvent, updateEvent, deleteEvent, createTaskFromEvent, t, td, ts } = useAppContext();
  const [view, setView] = useState<"month" | "week">("month");
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    date: "",
    time: "",
    type: "meeting" as "content" | "campaign" | "meeting" | "external",
    status: "planned" as "planned" | "confirmed" | "done",
    assignee: "",
    tags: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const days = useMemo(() => Array.from({ length: view === "month" ? 30 : 7 }, (_, i) => i + 1), [view]);
  const selectedEvent = events.find((event) => event.id === selectedEventId);

  return (
    <ModuleGuard module="events">
      <PageHeader
        title={t("events")}
        subtitle={td("Monthly and weekly planning for content, campaigns, meetings and external milestones.")}
        action={
          <div className="flex gap-2">
            <button onClick={() => setView("month")} className={`rounded-lg px-3 py-2 text-sm ${view === "month" ? "bg-indigo-600 text-white" : "border border-slate-200"}`}>{t("month")}</button>
            <button onClick={() => setView("week")} className={`rounded-lg px-3 py-2 text-sm ${view === "week" ? "bg-indigo-600 text-white" : "border border-slate-200"}`}>{t("week")}</button>
            <button onClick={() => { setEditingId(null); setOpenCreate(true); }} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">{t("createEvent")}</button>
          </div>
        }
      />
      <div className="grid gap-2 md:grid-cols-7">
        {days.map((day) => {
          const dayEvents = events.filter((event) => Number(event.date.split("-")[2]) === day);
          return (
            <Card key={day} className="p-3">
              <p className="text-xs font-semibold text-slate-500">{td("Day")} {day}</p>
              <div className="mt-2 space-y-2">
                {dayEvents.map((event) => (
                  <button key={event.id} onClick={() => setSelectedEventId(event.id)} className="block w-full rounded bg-slate-50 p-2 text-left text-xs">
                    <p className="font-medium">{td(event.title)}</p>
                    <p className="text-slate-500">{event.time}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  setEditingId(null);
                  setForm((prev) => ({ ...prev, date: `2026-04-${String(day).padStart(2, "0")}` }));
                  setOpenCreate(true);
                }}
                className="mt-2 w-full rounded border border-slate-200 px-2 py-1 text-xs"
              >
                {t("createEvent")}
              </button>
            </Card>
          );
        })}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {events.map((event) => (
          <Card key={event.id}>
            <button onClick={() => setSelectedEventId(event.id)} className="text-sm font-semibold text-indigo-700">{td(event.title)}</button>
            <p className="mt-1 text-xs text-slate-500">{td(event.description)}</p>
            <p className="mt-2 text-xs text-slate-500">{event.date} {td("at")} {event.time} | {t("type")}: {ts(event.type)}</p>
            <p className="mt-1 text-xs text-slate-500">{t("linkedTasks")}: {event.linkedTaskIds.length}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => createTaskFromEvent(event.id)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white">{t("createTaskFromEvent")}</button>
              <button
                onClick={() => {
                  setEditingId(event.id);
                  setForm({
                    title: event.title,
                    description: event.description,
                    date: event.date,
                    time: event.time,
                    type: event.type,
                  status: event.status,
                    assignee: event.assignedUsers[0] ?? "",
                    tags: event.tags.join(", "),
                  });
                  setOpenCreate(true);
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium"
              >
                {t("edit")}
              </button>
            </div>
          </Card>
        ))}
      </div>
      <Modal open={openCreate} title={editingId ? t("edit") : t("createEvent")} onClose={() => setOpenCreate(false)} closeLabel={t("close")}>
        <div className="space-y-3">
          <input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder={t("title")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} placeholder={t("description")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input type="date" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <input type="time" value={form.time} onChange={(event) => setForm((prev) => ({ ...prev, time: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as "planned" | "confirmed" | "done" }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="planned">{ts("planned")}</option><option value="confirmed">{ts("confirmed")}</option><option value="done">{ts("done")}</option>
          </select>
          <select value={form.assignee} onChange={(event) => setForm((prev) => ({ ...prev, assignee: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">{t("assignee")}</option>
            {availableUsers.map((user) => <option key={user.id} value={user.name}>{user.name}</option>)}
          </select>
          <input value={form.tags} onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))} placeholder={t("tags")} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <div className="flex justify-end gap-2">
            {editingId ? (
              <button
                onClick={() => {
                  if (!window.confirm(t("confirmDelete"))) return;
                  deleteEvent(editingId);
                  setOpenCreate(false);
                }}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm text-white"
              >
                {t("delete")}
              </button>
            ) : null}
            <button
              onClick={() => {
                if (!form.title.trim()) return;
                const payload = {
                  title: form.title,
                  description: form.description,
                  date: form.date,
                  time: form.time,
                  type: form.type,
                  status: form.status,
                  assignedUsers: [form.assignee || availableUsers[0].name],
                  tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
                };
                if (editingId) {
                  updateEvent(editingId, payload);
                } else {
                  addEvent(payload);
                }
                setOpenCreate(false);
              }}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white"
            >
              {t("save")}
            </button>
          </div>
        </div>
      </Modal>
      <Modal open={Boolean(selectedEvent)} title={selectedEvent?.title ?? t("events")} onClose={() => setSelectedEventId(null)} closeLabel={t("close")}>
        {selectedEvent ? (
          <div className="space-y-2 text-sm text-slate-600">
            <p>{td(selectedEvent.description)}</p>
            <p>{t("date")}: {selectedEvent.date} {td("at")} {selectedEvent.time}</p>
            <p>{t("type")}: {ts(selectedEvent.type)}</p>
            <p>{t("linkedTasks")}: {selectedEvent.linkedTaskIds.length}</p>
            <button
              onClick={() => {
                if (!window.confirm(t("confirmDelete"))) return;
                deleteEvent(selectedEvent.id);
                setSelectedEventId(null);
              }}
              className="rounded-lg bg-rose-600 px-3 py-2 text-sm text-white"
            >
              {t("delete")}
            </button>
          </div>
        ) : null}
      </Modal>
    </ModuleGuard>
  );
}
