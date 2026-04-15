"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleGuard } from "@/components/layout/module-guard";
import { useAppContext } from "@/components/providers/app-providers";
import { Modal } from "@/components/ui/modal";

export default function DashboardPage() {
  const { query, tasks, goals, events, activity, embedConfig, setEmbedConfig, currentUser, addTask, availableUsers, t, td } = useAppContext();
  const [openTaskModal, setOpenTaskModal] = useState(false);
  const [openEmbedModal, setOpenEmbedModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    status: "backlog" as "backlog" | "in_progress" | "in_review" | "completed",
    assignee: currentUser.name,
    tags: ["Social"] as Array<"Social" | "Google Ads" | "Meta Ads">,
    approval: "draft" as "draft" | "pending" | "approved" | "rejected",
  });
  const [embedForm, setEmbedForm] = useState(embedConfig);
  const activeTasks = tasks.filter((task) => task.status !== "completed").length;
  const completedTasks = tasks.filter((task) => task.status === "completed").length;
  const leadsGoal = goals.find((goal) => goal.name.includes("Leads"));
  const revenueGoal = goals.find((goal) => goal.name === "Revenue");
  const filteredActivities = activity.filter((item) => item.action.toLowerCase().includes(query.toLowerCase()));

  return (
    <ModuleGuard module="dashboard">
      <PageHeader
        title={t("dashboard")}
        subtitle={td("Operations, performance, activity and planning snapshot in one premium workspace.")}
        action={
          <button onClick={() => setOpenTaskModal(true)} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">{t("createTask")}</button>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><p className="text-sm text-slate-500">{t("activeTasks")}</p><p className="mt-2 text-3xl font-semibold">{activeTasks}</p></Card>
        <Card><p className="text-sm text-slate-500">{t("completedTasks")}</p><p className="mt-2 text-3xl font-semibold">{completedTasks}</p></Card>
        <Card><p className="text-sm text-slate-500">{t("campaignSummary")}</p><p className="mt-2 text-3xl font-semibold">{leadsGoal?.current ?? 0} {td("leads")}</p></Card>
        <Card><p className="text-sm text-slate-500">{t("revenueProgress")}</p><p className="mt-2 text-3xl font-semibold">${revenueGoal?.current.toLocaleString() ?? 0}</p></Card>
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h2 className="text-base font-semibold">{t("activityFeed")}</h2>
          <div className="mt-4 space-y-3">
            {filteredActivities.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-sm text-slate-700">{td(item.action)}</p>
                <p className="mt-1 text-xs text-slate-500">{td(item.actor)} - {td(item.timestamp)}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-base font-semibold">{t("upcomingEvents")}</h2>
          <div className="mt-4 space-y-3">
            {events.map((event) => (
              <div key={event.id} className="rounded-lg border border-slate-100 p-3">
                <p className="text-sm font-medium text-slate-800">{td(event.title)}</p>
                <p className="text-xs text-slate-500">{event.date} {td("at")} {event.time}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card className="mt-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{embedConfig.title || t("embedSection")}</h2>
          <button
            disabled={currentUser.role !== "admin"}
            onClick={() => setOpenEmbedModal(true)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("edit")}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">{td("Admin can define an external URL to embed performance dashboards.")}</p>
        <div className="mt-4 h-64 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          <iframe title="External embed" src={embedConfig.url} className="h-full w-full" />
        </div>
      </Card>
      <Modal open={openTaskModal} title={t("createTask")} onClose={() => setOpenTaskModal(false)} closeLabel={t("close")}>
        <div className="space-y-2">
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder={t("title")} value={taskForm.title} onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))} />
          <textarea className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder={t("description")} value={taskForm.description} onChange={(event) => setTaskForm((prev) => ({ ...prev, description: event.target.value }))} />
          <input type="date" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={taskForm.dueDate} onChange={(event) => setTaskForm((prev) => ({ ...prev, dueDate: event.target.value }))} />
          <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={taskForm.status} onChange={(event) => setTaskForm((prev) => ({ ...prev, status: event.target.value as "backlog" | "in_progress" | "in_review" | "completed" }))}>
            <option value="backlog">Backlog</option><option value="in_progress">In Progress</option><option value="in_review">In Review</option><option value="completed">Completed</option>
          </select>
          <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={taskForm.assignee} onChange={(event) => setTaskForm((prev) => ({ ...prev, assignee: event.target.value }))}>
            {availableUsers.map((user) => <option key={user.id} value={user.name}>{user.name}</option>)}
          </select>
          <select className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={taskForm.tags[0]} onChange={(event) => setTaskForm((prev) => ({ ...prev, tags: [event.target.value as "Social" | "Google Ads" | "Meta Ads"] }))}>
            <option value="Social">Social</option><option value="Google Ads">Google Ads</option><option value="Meta Ads">Meta Ads</option>
          </select>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setOpenTaskModal(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">{t("cancel")}</button>
            <button
              onClick={() => {
                if (!taskForm.title.trim()) return;
                addTask({ ...taskForm, linkedEventIds: [] });
                setOpenTaskModal(false);
              }}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white"
            >
              {t("save")}
            </button>
          </div>
        </div>
      </Modal>
      <Modal open={openEmbedModal} title={t("embedSection")} onClose={() => setOpenEmbedModal(false)} closeLabel={t("close")}>
        <div className="space-y-2">
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder={t("embedTitle")} value={embedForm.title} onChange={(event) => setEmbedForm((prev) => ({ ...prev, title: event.target.value }))} />
          <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder={t("embedUrl")} value={embedForm.url} onChange={(event) => setEmbedForm((prev) => ({ ...prev, url: event.target.value }))} />
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setOpenEmbedModal(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">{t("cancel")}</button>
            <button onClick={() => { setEmbedConfig(embedForm); setOpenEmbedModal(false); }} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">{t("save")}</button>
          </div>
        </div>
      </Modal>
    </ModuleGuard>
  );
}
