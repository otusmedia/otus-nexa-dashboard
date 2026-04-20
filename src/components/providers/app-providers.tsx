"use client";

import type { DropResult } from "@hello-pangea/dnd";
import { createContext, useContext, useMemo, useState } from "react";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { ALL_MODULE_KEYS } from "@/lib/modules";
import {
  COLUMN_TO_STATUS,
  MOCK_PROJECTS,
  splitProjectsByColumn,
  type KanbanColumnId,
  type Project,
  type ProjectTaskRow,
  type ProjectsByColumn,
} from "@/app/(platform)/projects/data";
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
import { useLanguage, type AppLanguage } from "@/context/language-context";
import { dictionary, localizeDynamic, localizeStatus, type TranslationKey } from "@/services/i18n";
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
  ModuleKey,
  NotificationItem,
  RoadmapItem,
  Task,
  TaskStatus,
} from "@/types";

interface AppContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  t: (key: TranslationKey) => string;
  td: (content: string) => string;
  ts: (status: string) => string;
  currentUser: AppUser;
  availableUsers: AppUser[];
  allowedModules: ModuleKey[];
  users: AppUser[];
  setUserModules: (userId: string, modules: AppUser["modules"]) => void;
  addUser: (input: {
    name: string;
    role: AppUser["role"];
    modules: AppUser["modules"];
    company?: AppUser["company"];
  }) => void;
  updateUser: (id: string, updates: Partial<Pick<AppUser, "name" | "role" | "modules" | "company">>) => void;
  deleteUser: (id: string) => void;
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
  projectsByColumn: ProjectsByColumn;
  updateBoardProjectTask: (projectId: string, taskId: string, updates: Partial<ProjectTaskRow>) => void;
  addBoardProjectTask: (projectId: string, task: ProjectTaskRow) => void;
  moveProjectInKanban: (result: DropResult) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const GUEST_USER: AppUser = {
  id: "__guest__",
  name: "",
  role: "client",
  company: "",
  modules: [],
};

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppStateProvider>{children}</AppStateProvider>
    </AuthProvider>
  );
}

function AppStateProvider({ children }: { children: React.ReactNode }) {
  const { sessionUserId, logout } = useAuth();
  const { language, setLanguage, t: tLine } = useLanguage();
  const [users, setUsers] = useState<AppUser[]>(usersSeed);
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
  const [projectsByColumn, setProjectsByColumn] = useState<ProjectsByColumn>(() =>
    splitProjectsByColumn(JSON.parse(JSON.stringify(MOCK_PROJECTS)) as Project[]),
  );

  const currentUser =
    sessionUserId && users.some((u) => u.id === sessionUserId)
      ? (users.find((u) => u.id === sessionUserId) as AppUser)
      : GUEST_USER;

  const allowedModules: ModuleKey[] =
    !sessionUserId || currentUser.id === GUEST_USER.id ? [] : [...currentUser.modules];
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const t = (key: TranslationKey) => tLine(dictionary.en[key]);
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
      availableUsers: users,
      allowedModules,
      users,
      setUserModules: (userId, modules) =>
        setUsers((prev) =>
          prev.map((user) => {
            if (user.id !== userId) return user;
            return { ...user, modules };
          }),
        ),
      addUser: ({ name, role, modules, company = "" }) => {
        const id = crypto.randomUUID();
        const nextModules =
          role === "admin" ? (modules.length > 0 ? modules : [...ALL_MODULE_KEYS]) : modules;
        setUsers((prev) => [...prev, { id, name, role, company, modules: nextModules }]);
      },
      updateUser: (id, updates) => {
        setUsers((prev) =>
          prev.map((u) => {
            if (u.id !== id) return u;
            const merged = { ...u, ...updates };
            if (merged.role === "admin" && updates.modules !== undefined) {
              return { ...merged, modules: updates.modules };
            }
            return merged;
          }),
        );
      },
      deleteUser: (id) => {
        setUsers((prev) => prev.filter((u) => u.id !== id));
        if (sessionUserId === id) logout();
      },
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
      deleteContract: (id) =>
        setContracts((prev) => {
          const target = prev.find((item) => item.id === id);
          if (target?.fileUrl.startsWith("blob:")) {
            URL.revokeObjectURL(target.fileUrl);
          }
          return prev.filter((item) => item.id !== id);
        }),
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
      projectsByColumn,
      updateBoardProjectTask: (projectId, taskId, updates) => {
        setProjectsByColumn((prev) => {
          const mapProject = (p: Project): Project => {
            if (p.id !== projectId) return p;
            return { ...p, tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)) };
          };
          return {
            planning: prev.planning.map(mapProject),
            in_progress: prev.in_progress.map(mapProject),
            paused: prev.paused.map(mapProject),
            done: prev.done.map(mapProject),
            cancelled: prev.cancelled.map(mapProject),
          };
        });
      },
      addBoardProjectTask: (projectId, task) => {
        setProjectsByColumn((prev) => {
          const mapProject = (p: Project): Project =>
            p.id === projectId ? { ...p, tasks: [...p.tasks, task] } : p;
          return {
            planning: prev.planning.map(mapProject),
            in_progress: prev.in_progress.map(mapProject),
            paused: prev.paused.map(mapProject),
            done: prev.done.map(mapProject),
            cancelled: prev.cancelled.map(mapProject),
          };
        });
      },
      moveProjectInKanban: (result: DropResult) => {
        const { source, destination } = result;
        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;
        const sourceColumn = source.droppableId as KanbanColumnId;
        const destinationColumn = destination.droppableId as KanbanColumnId;
        setProjectsByColumn((prev) => {
          const next: ProjectsByColumn = {
            planning: [...prev.planning],
            in_progress: [...prev.in_progress],
            paused: [...prev.paused],
            done: [...prev.done],
            cancelled: [...prev.cancelled],
          };
          const [movedProject] = next[sourceColumn].splice(source.index, 1);
          if (!movedProject) return prev;
          next[destinationColumn].splice(destination.index, 0, {
            ...movedProject,
            column: destinationColumn,
            status: COLUMN_TO_STATUS[destinationColumn],
          });
          return next;
        });
      },
    }),
    [
      language,
      tLine,
      currentUser,
      sessionUserId,
      users,
      allowedModules,
      logout,
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
      projectsByColumn,
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
