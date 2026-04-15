"use client";

import { createContext, useContext, useMemo, useState } from "react";
import {
  activityLog as activitySeed,
  contracts as contractsSeed,
  events as eventsSeed,
  fileItems as filesSeed,
  goals as goalsSeed,
  ideasSeed,
  invoices as invoicesSeed,
  notificationsSeed,
  roadmapSeed,
  tasks as tasksSeed,
  users as usersSeed,
} from "@/services/mock-data";
import { localizeDynamic, localizeStatus, translate, type TranslationKey } from "@/services/i18n";
import type {
  ActivityLogItem,
  AppUser,
  ContractItem,
  EmbedConfig,
  EventItem,
  FileItem,
  Goal,
  IdeaItem,
  InvoiceItem,
  NotificationItem,
  RoadmapItem,
  Task,
  TaskStatus,
} from "@/types";

type Language = "en" | "pt-BR";

interface AppContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  td: (content: string) => string;
  ts: (status: string) => string;
  currentUser: AppUser;
  setCurrentUserById: (id: string) => void;
  availableUsers: AppUser[];
  allowedModules: AppUser["modules"];
  users: AppUser[];
  setUserModules: (userId: string, modules: AppUser["modules"]) => void;
  tasks: Task[];
  setTaskStatus: (id: string, status: TaskStatus) => void;
  addTask: (input: Omit<Task, "id" | "comments" | "files"> & { files?: string[] }) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  addTaskComment: (taskId: string, text: string) => void;
  addTaskFile: (taskId: string, fileName: string) => void;
  events: EventItem[];
  addEvent: (input: Omit<EventItem, "id" | "linkedTaskIds"> & { linkedTaskIds?: string[] }) => void;
  updateEvent: (id: string, updates: Partial<EventItem>) => void;
  deleteEvent: (id: string) => void;
  createTaskFromEvent: (eventId: string) => void;
  ideas: IdeaItem[];
  addIdea: (input: Omit<IdeaItem, "id" | "createdAt">) => void;
  updateIdea: (id: string, updates: Partial<IdeaItem>) => void;
  deleteIdea: (id: string) => void;
  convertIdeaToTask: (ideaId: string) => void;
  files: FileItem[];
  uploadFile: (input: Omit<FileItem, "id" | "uploadedAt" | "attachedToTask"> & { taskId?: string }) => void;
  updateFile: (id: string, updates: Partial<FileItem>) => void;
  deleteFile: (id: string) => void;
  contracts: ContractItem[];
  uploadContract: (input: Omit<ContractItem, "id" | "uploadDate">) => void;
  updateContract: (id: string, updates: Partial<ContractItem>) => void;
  deleteContract: (id: string) => void;
  invoices: InvoiceItem[];
  uploadInvoice: (input: Omit<InvoiceItem, "id">) => void;
  updateInvoice: (id: string, updates: Partial<InvoiceItem>) => void;
  deleteInvoice: (id: string) => void;
  goals: Goal[];
  addGoal: (input: { name: string; target: number; current: number; unit: string }) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  roadmap: RoadmapItem[];
  addRoadmapItem: (input: Omit<RoadmapItem, "id">) => void;
  updateRoadmapItem: (id: string, updates: Partial<RoadmapItem>) => void;
  deleteRoadmapItem: (id: string) => void;
  embedConfig: EmbedConfig;
  setEmbedConfig: (config: EmbedConfig) => void;
  activity: ActivityLogItem[];
  notifications: NotificationItem[];
  unreadCount: number;
  markAllAsRead: () => void;
  markNotificationRead: (id: string) => void;
  query: string;
  setQuery: (value: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");
  const [users, setUsers] = useState<AppUser[]>(usersSeed);
  const [currentUserId, setCurrentUserId] = useState<string>(usersSeed[0].id);
  const [notifications, setNotifications] = useState<NotificationItem[]>(notificationsSeed);
  const [tasks, setTasks] = useState<Task[]>(tasksSeed);
  const [events, setEvents] = useState<EventItem[]>(eventsSeed);
  const [ideas, setIdeas] = useState<IdeaItem[]>(ideasSeed);
  const [files, setFiles] = useState<FileItem[]>(filesSeed);
  const [contracts, setContracts] = useState<ContractItem[]>(contractsSeed);
  const [invoices, setInvoices] = useState<InvoiceItem[]>(invoicesSeed);
  const [goals, setGoals] = useState<Goal[]>(goalsSeed);
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>(roadmapSeed);
  const [activity, setActivity] = useState<ActivityLogItem[]>(activitySeed);
  const [embedConfig, setEmbedConfig] = useState<EmbedConfig>({ title: "Performance Embed", url: "https://example.com" });
  const [query, setQuery] = useState("");

  const currentUser = users.find((user) => user.id === currentUserId) ?? users[0];
  const normalizedRole = currentUser.role === "client" ? "client" : currentUser.role === "admin" ? "admin" : "team";
  const roleModules: Record<"admin" | "team" | "client", AppUser["modules"]> = {
    admin: ["dashboard", "tasks", "goals", "roadmap", "events", "ideas", "files", "contracts", "invoices", "marketing", "users"],
    team: ["dashboard", "tasks", "goals", "roadmap", "events", "ideas", "files", "marketing"],
    client: ["dashboard", "goals", "files", "invoices"],
  };
  const allowedModules = roleModules[normalizedRole].filter((module) => currentUser.modules.includes(module));
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const t = (key: TranslationKey) => translate(language, key);
  const td = (content: string) => localizeDynamic(language, content);
  const ts = (status: string) => localizeStatus(language, status);

  const registerActivity = (action: string) => {
    setActivity((prev) => [{ id: crypto.randomUUID(), action, actor: currentUser.name, timestamp: "Just now" }, ...prev].slice(0, 25));
  };
  const createNotification = (message: string, type: NotificationItem["type"]) => {
    setNotifications((prev) => [{ id: crypto.randomUUID(), message, type, read: false }, ...prev].slice(0, 25));
  };
  const tagsFromText = (text: string) =>
    text
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

  const value = useMemo<AppContextValue>(
    () => ({
      language,
      setLanguage,
      t,
      td,
      ts,
      currentUser,
      setCurrentUserById: setCurrentUserId,
      availableUsers: users,
      allowedModules,
      users,
      setUserModules: (userId, modules) =>
        setUsers((prev) => prev.map((user) => (user.id === userId ? { ...user, modules } : user))),
      tasks,
      setTaskStatus: (id, status) => {
        setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, status } : task)));
        registerActivity(`Task moved to ${status}`);
        createNotification("Task status was updated.", "task");
      },
      addTask: (input) => {
        setTasks((prev) => [
          {
            id: crypto.randomUUID(),
            ...input,
            files: input.files ?? [],
            comments: [],
            linkedEventIds: input.linkedEventIds ?? [],
          },
          ...prev,
        ]);
        registerActivity(`Task created: ${input.title}`);
        createNotification(`New task created: ${input.title}`, "task");
      },
      updateTask: (id, updates) => setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...updates } : task))),
      deleteTask: (id) => {
        setTasks((prev) => prev.filter((task) => task.id !== id));
        setEvents((prev) => prev.map((event) => ({ ...event, linkedTaskIds: event.linkedTaskIds.filter((taskId) => taskId !== id) })));
      },
      addTaskComment: (taskId, text) => {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === taskId
              ? { ...task, comments: [...task.comments, { id: crypto.randomUUID(), text, author: currentUser.name, createdAt: new Date().toISOString() }] }
              : task,
          ),
        );
        registerActivity("Comment added to task");
        createNotification("A task received a new comment.", "comment");
      },
      addTaskFile: (taskId, fileName) => {
        setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, files: [...task.files, fileName] } : task)));
        registerActivity(`File attached to task: ${fileName}`);
      },
      events,
      addEvent: (input) => {
        setEvents((prev) => [
          { id: crypto.randomUUID(), ...input, linkedTaskIds: input.linkedTaskIds ?? [] },
          ...prev,
        ]);
        registerActivity(`Event created: ${input.title}`);
        createNotification(`New event: ${input.title}`, "event");
      },
      updateEvent: (id, updates) => setEvents((prev) => prev.map((event) => (event.id === id ? { ...event, ...updates } : event))),
      deleteEvent: (id) => {
        setEvents((prev) => prev.filter((event) => event.id !== id));
        setTasks((prev) => prev.map((task) => ({ ...task, linkedEventIds: task.linkedEventIds.filter((eventId) => eventId !== id) })));
      },
      createTaskFromEvent: (eventId) => {
        const event = events.find((item) => item.id === eventId);
        if (!event) return;
        const taskId = crypto.randomUUID();
        setTasks((prev) => [
          {
            id: taskId,
            title: `From event: ${event.title}`,
            description: event.description,
            dueDate: event.date,
            status: "backlog",
            assignee: currentUser.name,
            tags: ["Social"],
            files: [],
            comments: [],
            approval: "draft",
            linkedEventIds: [eventId],
          },
          ...prev,
        ]);
        setEvents((prev) => prev.map((item) => (item.id === eventId ? { ...item, linkedTaskIds: [...item.linkedTaskIds, taskId] } : item)));
        registerActivity(`Task created from event: ${event.title}`);
        createNotification(`Task created from event: ${event.title}`, "task");
      },
      ideas,
      addIdea: (input) => {
        setIdeas((prev) => [{ id: crypto.randomUUID(), ...input, createdAt: new Date().toISOString().slice(0, 10) }, ...prev]);
        registerActivity(`Idea added: ${input.title}`);
      },
      updateIdea: (id, updates) => setIdeas((prev) => prev.map((idea) => (idea.id === id ? { ...idea, ...updates } : idea))),
      deleteIdea: (id) => setIdeas((prev) => prev.filter((idea) => idea.id !== id)),
      convertIdeaToTask: (ideaId) => {
        const idea = ideas.find((item) => item.id === ideaId);
        if (!idea) return;
        setTasks((prev) => [
          {
            id: crypto.randomUUID(),
            title: idea.title,
            description: idea.description,
            dueDate: new Date().toISOString().slice(0, 10),
            status: "backlog",
            assignee: currentUser.name,
            tags: idea.tags.length ? (idea.tags as Array<"Social" | "Google Ads" | "Meta Ads">) : ["Social"],
            files: [],
            comments: [],
            approval: "draft",
            linkedEventIds: [],
          },
          ...prev,
        ]);
        setIdeas((prev) => prev.filter((item) => item.id !== ideaId));
        registerActivity(`Idea converted to task: ${idea.title}`);
      },
      files,
      uploadFile: ({ taskId, ...input }) => {
        setFiles((prev) => [{ id: crypto.randomUUID(), ...input, uploadedAt: new Date().toISOString().slice(0, 10), attachedToTask: taskId }, ...prev]);
        if (taskId) {
          setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, files: [...task.files, input.name] } : task)));
        }
        registerActivity(`File uploaded: ${input.name}`);
        createNotification(`New file uploaded: ${input.name}`, "file");
      },
      updateFile: (id, updates) => setFiles((prev) => prev.map((file) => (file.id === id ? { ...file, ...updates } : file))),
      deleteFile: (id) => {
        const file = files.find((item) => item.id === id);
        setFiles((prev) => prev.filter((item) => item.id !== id));
        if (file?.attachedToTask) {
          setTasks((prev) =>
            prev.map((task) =>
              task.id === file.attachedToTask ? { ...task, files: task.files.filter((name) => name !== file.name) } : task,
            ),
          );
        }
      },
      contracts,
      uploadContract: (input) => {
        setContracts((prev) => [{ id: crypto.randomUUID(), ...input, uploadDate: new Date().toISOString().slice(0, 10) }, ...prev]);
        registerActivity(`Contract uploaded: ${input.name}`);
      },
      updateContract: (id, updates) => setContracts((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item))),
      deleteContract: (id) => setContracts((prev) => prev.filter((item) => item.id !== id)),
      invoices,
      uploadInvoice: (input) => {
        setInvoices((prev) => [{ id: crypto.randomUUID(), ...input }, ...prev]);
        registerActivity(`Invoice uploaded: ${input.fileName}`);
      },
      updateInvoice: (id, updates) => setInvoices((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item))),
      deleteInvoice: (id) => setInvoices((prev) => prev.filter((item) => item.id !== id)),
      goals,
      addGoal: ({ name, target, current, unit }) => {
        setGoals((prev) => [
          { id: crypto.randomUUID(), name, target, current, unit, status: current >= target ? "on_track" : "at_risk" },
          ...prev,
        ]);
        registerActivity(`Goal created: ${name}`);
      },
      updateGoal: (id, updates) => setGoals((prev) => prev.map((goal) => (goal.id === id ? { ...goal, ...updates } : goal))),
      deleteGoal: (id) => setGoals((prev) => prev.filter((goal) => goal.id !== id)),
      roadmap,
      addRoadmapItem: (input) => {
        setRoadmap((prev) => [{ id: crypto.randomUUID(), ...input }, ...prev]);
        registerActivity(`Roadmap item created: ${input.title}`);
      },
      updateRoadmapItem: (id, updates) => setRoadmap((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item))),
      deleteRoadmapItem: (id) => setRoadmap((prev) => prev.filter((item) => item.id !== id)),
      embedConfig,
      setEmbedConfig: (config) => {
        setEmbedConfig(config);
        registerActivity("Dashboard embed URL updated");
      },
      activity,
      notifications,
      unreadCount,
      markAllAsRead: () => setNotifications((prev) => prev.map((item) => ({ ...item, read: true }))),
      markNotificationRead: (id) =>
        setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item))),
      query,
      setQuery,
    }),
    [
      language,
      currentUser,
      users,
      allowedModules,
      tasks,
      events,
      ideas,
      files,
      contracts,
      invoices,
      goals,
      roadmap,
      embedConfig,
      activity,
      notifications,
      unreadCount,
      query,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useAppContext must be used within AppProviders");
  }

  return context;
}
