"use client";

import type { DropResult } from "@hello-pangea/dnd";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { ALL_MODULE_KEYS } from "@/lib/modules";
import {
  COLUMN_TO_STATUS,
  computeProjectProgressFromTasks,
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
import { supabase } from "@/lib/supabase";
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
  tasksLoading: boolean;
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
  filesLoading: boolean;
  uploadFile: (input: Omit<FileItem, "id" | "uploadedAt" | "attachedToTask"> & { taskId?: string }) => void;
  updateFile: (id: string, updates: Partial<FileItem>) => void;
  deleteFile: (id: string) => void;
  contracts: ContractItem[];
  contractsLoading: boolean;
  uploadContract: (input: Omit<ContractItem, "id" | "uploadDate">) => void;
  updateContract: (id: string, updates: Partial<ContractItem>) => void;
  deleteContract: (id: string) => void;
  invoices: InvoiceItem[];
  invoicesLoading: boolean;
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
  activityLoading: boolean;
  notifications: NotificationItem[];
  unreadCount: number;
  markAllAsRead: () => void;
  markNotificationRead: (id: string) => void;
  query: string;
  setQuery: (value: string) => void;
  projectsByColumn: ProjectsByColumn;
  projectsLoading: boolean;
  addProject: (input: {
    name: string;
    type: Project["type"];
    owner: string;
    startDate: string | null;
    endDate: string | null;
    description: string;
    column: KanbanColumnId;
  }) => void;
  updateBoardProjectTask: (projectId: string, taskId: string, updates: Partial<ProjectTaskRow>) => void;
  addBoardProjectTask: (projectId: string, task: ProjectTaskRow) => void;
  deleteBoardProject: (projectId: string) => void;
  deleteBoardProjectTask: (projectId: string, taskId: string) => void;
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

type DbProjectRow = {
  id: string;
  name: string;
  type: string | null;
  status: string | null;
  progress: number | null;
  owner: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
};

type DbTaskRow = {
  id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: string | null;
  priority: string | null;
  assigned_to: string | null;
  due_date: string | null;
  is_featured: boolean | null;
  cover_image: string | null;
  short_description: string | null;
};

const toTaskStatus = (status: string | null | undefined): TaskStatus =>
  status === "in_progress" || status === "in_review" || status === "completed" ? status : "backlog";

function mapDbTaskToTask(row: DbTaskRow): Task {
  return {
    id: row.id,
    title: row.title ?? "",
    description: row.description ?? "",
    status: toTaskStatus(row.status),
    assignee: row.assigned_to ?? "",
    dueDate: row.due_date ?? new Date().toISOString().slice(0, 10),
    tags: ["Social"],
    files: [],
    comments: [],
    approval: "draft",
    linkedEventIds: [],
  };
}

function statusToColumn(status: string | null | undefined): KanbanColumnId {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "in progress") return "in_progress";
  if (normalized === "paused") return "paused";
  if (normalized === "done") return "done";
  if (normalized === "cancelled") return "cancelled";
  return "planning";
}

function mapRowsToProjectsByColumn(projectRows: DbProjectRow[], taskRows: DbTaskRow[]): ProjectsByColumn {
  const projects: Project[] = projectRows.map((row) => {
    const column = statusToColumn(row.status);
    const owner = row.owner ?? "";
    const projectTasks: ProjectTaskRow[] = taskRows
      .filter((task) => task.project_id === row.id)
      .map((task) => ({
        id: task.id,
        name: task.title ?? "",
        dueDate: task.due_date,
        owner: task.assigned_to ?? "",
        status:
          task.status === "In Progress" ||
          task.status === "Waiting for Approval" ||
          task.status === "Done" ||
          task.status === "Scheduled" ||
          task.status === "Published"
            ? task.status
            : "Not Started",
        isFeatured: Boolean(task.is_featured),
        coverImage: task.cover_image,
        shortDescription: task.short_description ?? "",
      }));
    return {
      id: row.id,
      name: row.name,
      column,
      owners: owner ? [owner] : [],
      progress: computeProjectProgressFromTasks(projectTasks),
      dueDate: row.end_date,
      status: COLUMN_TO_STATUS[column],
      type: row.type === "Website" || row.type === "Monthly Content" || row.type === "Paid Traffic" ? row.type : "Website",
      startDate: row.start_date,
      teamMembers: owner ? [owner] : [],
      linkedInvoices: [],
      description: row.description ?? "",
      tasks: projectTasks,
    };
  });
  return splitProjectsByColumn(projects);
}

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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [events, setEvents] = useState<EventItem[]>(eventsSeed);
  const [ideas, setIdeas] = useState<IdeaItem[]>(ideasSeed);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [contractsLoading, setContractsLoading] = useState(true);
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>(goalsSeed);
  const [roadmap, setRoadmap] = useState<RoadmapItem[]>(roadmapSeed);
  const [activity, setActivity] = useState<ActivityLogItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [embedConfig, setEmbedConfig] = useState<EmbedConfig>({ title: "Performance Embed", url: "https://example.com" });
  const [query, setQuery] = useState("");
  const [projectsByColumn, setProjectsByColumn] = useState<ProjectsByColumn>(() => splitProjectsByColumn([]));
  const [projectsLoading, setProjectsLoading] = useState(true);

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
    void supabase
      .from("activity")
      .insert({ action, user_name: currentUser.name })
      .then(({ error }) => {
        if (error) console.error("[supabase] activity insert failed:", error.message);
      });
  };
  const createNotification = (message: string, type: NotificationItem["type"]) => {
    setNotifications((prev) => [{ id: crypto.randomUUID(), message, type, read: false }, ...prev].slice(0, 25));
  };
  const tagsFromText = (text: string) =>
    text
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

  useEffect(() => {
    let mounted = true;
    void supabase
      .from("tasks")
      .select("*")
      .is("project_id", null)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error("[supabase] tasks fetch failed:", error.message);
          setTasks([]);
        } else {
          setTasks((data as DbTaskRow[] | null)?.map(mapDbTaskToTask) ?? []);
        }
      })
      .then(
        () => {
          if (mounted) setTasksLoading(false);
        },
        () => {
          if (mounted) setTasksLoading(false);
        },
      );
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").not("project_id", "is", null).order("created_at", { ascending: false }),
    ])
      .then(([projectsRes, tasksRes]) => {
        if (!mounted) return;
        if (projectsRes.error || tasksRes.error) {
          if (projectsRes.error) console.error("[supabase] projects fetch failed:", projectsRes.error.message);
          if (tasksRes.error) console.error("[supabase] project tasks fetch failed:", tasksRes.error.message);
          setProjectsByColumn(splitProjectsByColumn([]));
          return;
        }
        setProjectsByColumn(
          mapRowsToProjectsByColumn(
            (projectsRes.data as DbProjectRow[] | null) ?? [],
            (tasksRes.data as DbTaskRow[] | null) ?? [],
          ),
        );
      })
      .then(
        () => {
          if (mounted) setProjectsLoading(false);
        },
        () => {
          if (mounted) setProjectsLoading(false);
        },
      );
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void supabase
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error("[supabase] invoices fetch failed:", error.message);
          setInvoices([]);
        } else {
          setInvoices(
            ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
              id: String(row.id ?? ""),
              amount: Number(row.amount ?? 0),
              status: row.status === "paid" || row.status === "overdue" ? row.status : "pending",
              dueDate: String(row.due_date ?? ""),
              fileName: String(row.filename ?? ""),
              description: String(row.project_name ?? ""),
            })),
          );
        }
      })
      .then(
        () => {
          if (mounted) setInvoicesLoading(false);
        },
        () => {
          if (mounted) setInvoicesLoading(false);
        },
      );
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void supabase
      .from("files")
      .select("*")
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error("[supabase] files fetch failed:", error.message);
          setFiles([]);
        } else {
          setFiles(
            ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
              id: String(row.id ?? ""),
              name: String(row.name ?? ""),
              category: "Reports",
              description: "",
              status: "draft",
              uploadedAt: String(row.created_at ?? new Date().toISOString().slice(0, 10)),
              assignee: String(row.uploaded_by ?? ""),
              tags: [],
              attachedToTask: undefined,
            })),
          );
        }
      })
      .then(
        () => {
          if (mounted) setFilesLoading(false);
        },
        () => {
          if (mounted) setFilesLoading(false);
        },
      );
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void supabase
      .from("contracts")
      .select("*")
      .order("uploaded_at", { ascending: false })
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error("[supabase] contracts fetch failed:", error.message);
          setContracts([]);
        } else {
          setContracts(
            ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
              id: String(row.id ?? ""),
              name: String(row.name ?? ""),
              uploadDate: String(row.uploaded_at ?? new Date().toISOString().slice(0, 10)),
              status: row.status === "active" || row.status === "expired" ? row.status : "draft",
              fileUrl: String(row.file_url ?? ""),
              fileSizeBytes: Number(row.file_size ?? 0) || 0,
              pageCount: Number(row.page_count ?? 0) || undefined,
            })),
          );
        }
      })
      .then(
        () => {
          if (mounted) setContractsLoading(false);
        },
        () => {
          if (mounted) setContractsLoading(false);
        },
      );
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    void supabase
      .from("activity")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error("[supabase] activity fetch failed:", error.message);
          setActivity([]);
        } else {
          setActivity(
            ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
              id: String(row.id ?? ""),
              action: String(row.action ?? ""),
              actor: String(row.user_name ?? ""),
              timestamp: String(row.created_at ?? ""),
            })),
          );
        }
      })
      .then(
        () => {
          if (mounted) setActivityLoading(false);
        },
        () => {
          if (mounted) setActivityLoading(false);
        },
      );

    const channel = supabase
      .channel("activity")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity" }, (payload) => {
        const row = payload.new as Record<string, unknown>;
        setActivity((prev) => [
          {
            id: String(row.id ?? ""),
            action: String(row.action ?? ""),
            actor: String(row.user_name ?? ""),
            timestamp: String(row.created_at ?? ""),
          },
          ...prev,
        ].slice(0, 10));
      })
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, []);

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
      tasksLoading,
      setTaskStatus: (id, status) => {
        setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, status } : task)));
        void supabase.from("tasks").update({ status }).eq("id", id).then(({ error }) => {
          if (error) console.error("[supabase] task status update failed:", error.message);
        });
        registerActivity(`Task moved to ${status}`);
        createNotification("Task status was updated.", "task");
      },
      addTask: (input) => {
        const nextId = crypto.randomUUID();
        setTasks((prev) => [
          {
            id: nextId,
            ...input,
            files: input.files ?? [],
            comments: [],
            linkedEventIds: input.linkedEventIds ?? [],
          },
          ...prev,
        ]);
        void supabase
          .from("tasks")
          .insert({
            id: nextId,
            project_id: null,
            title: input.title,
            description: input.description,
            status: input.status,
            assigned_to: input.assignee,
            due_date: input.dueDate,
          })
          .then(({ error }) => {
            if (error) console.error("[supabase] task insert failed:", error.message);
          });
        registerActivity(`Task created: ${input.title}`);
        createNotification(`New task created: ${input.title}`, "task");
      },
      updateTask: (id, updates) => {
        setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...updates } : task)));
        void supabase
          .from("tasks")
          .update({
            title: updates.title,
            description: updates.description,
            status: updates.status,
            assigned_to: updates.assignee,
            due_date: updates.dueDate,
          })
          .eq("id", id)
          .then(({ error }) => {
            if (error) console.error("[supabase] task update failed:", error.message);
          });
      },
      deleteTask: (id) => {
        setTasks((prev) => prev.filter((task) => task.id !== id));
        setEvents((prev) => prev.map((event) => ({ ...event, linkedTaskIds: event.linkedTaskIds.filter((taskId) => taskId !== id) })));
        void supabase.from("tasks").delete().eq("id", id).then(({ error }) => {
          if (error) console.error("[supabase] task delete failed:", error.message);
        });
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
      filesLoading,
      uploadFile: ({ taskId, ...input }) => {
        const id = crypto.randomUUID();
        setFiles((prev) => [{ id, ...input, uploadedAt: new Date().toISOString().slice(0, 10), attachedToTask: taskId }, ...prev]);
        void supabase
          .from("files")
          .insert({
            id,
            name: input.name,
            type: input.category,
            size: "",
            uploaded_by: input.assignee,
            url: "",
          })
          .then(({ error }) => {
            if (error) console.error("[supabase] file insert failed:", error.message);
          });
        if (taskId) {
          setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, files: [...task.files, input.name] } : task)));
        }
        registerActivity(`File uploaded: ${input.name}`);
        createNotification(`New file uploaded: ${input.name}`, "file");
      },
      updateFile: (id, updates) => {
        setFiles((prev) => prev.map((file) => (file.id === id ? { ...file, ...updates } : file)));
        void supabase
          .from("files")
          .update({
            name: updates.name,
            type: updates.category,
            uploaded_by: updates.assignee,
          })
          .eq("id", id)
          .then(({ error }) => {
            if (error) console.error("[supabase] file update failed:", error.message);
          });
      },
      deleteFile: (id) => {
        const file = files.find((item) => item.id === id);
        setFiles((prev) => prev.filter((item) => item.id !== id));
        void supabase.from("files").delete().eq("id", id).then(({ error }) => {
          if (error) console.error("[supabase] file delete failed:", error.message);
        });
        if (file?.attachedToTask) {
          setTasks((prev) =>
            prev.map((task) =>
              task.id === file.attachedToTask ? { ...task, files: task.files.filter((name) => name !== file.name) } : task,
            ),
          );
        }
      },
      contracts,
      contractsLoading,
      uploadContract: (input) => {
        const id = crypto.randomUUID();
        setContracts((prev) => [{ id, ...input, uploadDate: new Date().toISOString().slice(0, 10) }, ...prev]);
        void supabase
          .from("contracts")
          .insert({
            id,
            name: input.name,
            status: input.status,
            file_url: input.fileUrl,
            file_size: String(input.fileSizeBytes),
            page_count: input.pageCount,
          })
          .then(({ error }) => {
            if (error) console.error("[supabase] contract insert failed:", error.message);
          });
        registerActivity(`Contract uploaded: ${input.name}`);
      },
      updateContract: (id, updates) => {
        setContracts((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
        void supabase
          .from("contracts")
          .update({
            name: updates.name,
            status: updates.status,
            file_url: updates.fileUrl,
            file_size: updates.fileSizeBytes != null ? String(updates.fileSizeBytes) : undefined,
            page_count: updates.pageCount,
          })
          .eq("id", id)
          .then(({ error }) => {
            if (error) console.error("[supabase] contract update failed:", error.message);
          });
      },
      deleteContract: (id) =>
        setContracts((prev) => {
          const target = prev.find((item) => item.id === id);
          if (target?.fileUrl.startsWith("blob:")) {
            URL.revokeObjectURL(target.fileUrl);
          }
          void supabase.from("contracts").delete().eq("id", id).then(({ error }) => {
            if (error) console.error("[supabase] contract delete failed:", error.message);
          });
          return prev.filter((item) => item.id !== id);
        }),
      invoices,
      invoicesLoading,
      uploadInvoice: (input) => {
        const id = crypto.randomUUID();
        setInvoices((prev) => [{ id, ...input }, ...prev]);
        void supabase
          .from("invoices")
          .insert({
            id,
            project_name: input.description,
            filename: input.fileName,
            amount: input.amount,
            status: input.status,
            due_date: input.dueDate,
          })
          .then(({ error }) => {
            if (error) console.error("[supabase] invoice insert failed:", error.message);
          });
        registerActivity(`Invoice uploaded: ${input.fileName}`);
      },
      updateInvoice: (id, updates) => {
        setInvoices((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
        void supabase
          .from("invoices")
          .update({
            project_name: updates.description,
            filename: updates.fileName,
            amount: updates.amount,
            status: updates.status,
            due_date: updates.dueDate,
          })
          .eq("id", id)
          .then(({ error }) => {
            if (error) console.error("[supabase] invoice update failed:", error.message);
          });
      },
      deleteInvoice: (id) => {
        setInvoices((prev) => prev.filter((item) => item.id !== id));
        void supabase.from("invoices").delete().eq("id", id).then(({ error }) => {
          if (error) console.error("[supabase] invoice delete failed:", error.message);
        });
      },
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
      activityLoading,
      notifications,
      unreadCount,
      markAllAsRead: () => setNotifications((prev) => prev.map((item) => ({ ...item, read: true }))),
      markNotificationRead: (id) =>
        setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item))),
      query,
      setQuery,
      projectsByColumn,
      projectsLoading,
      addProject: ({ name, type, owner, startDate, endDate, description, column }) => {
        const id = crypto.randomUUID();
        const newProject: Project = {
          id,
          name,
          column,
          owners: owner ? [owner] : [],
          progress: 0,
          dueDate: endDate,
          status: COLUMN_TO_STATUS[column],
          type,
          startDate,
          teamMembers: owner ? [owner] : [],
          linkedInvoices: [],
          description,
          tasks: [],
        };
        setProjectsByColumn((prev) => ({
          ...prev,
          [column]: [newProject, ...prev[column]],
        }));
        void supabase
          .from("projects")
          .insert({
            id,
            name,
            type,
            status: COLUMN_TO_STATUS[column],
            progress: 0,
            owner,
            start_date: startDate,
            end_date: endDate,
            description,
          })
          .then(({ error }) => {
            if (error) console.error("[supabase] project insert failed:", error.message);
          });
        registerActivity(`New project created: ${name}`);
      },
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
      deleteBoardProject: (projectId) => {
        let deletedName = "";
        setProjectsByColumn((prev) => {
          const strip = (list: Project[]) => {
            const hit = list.find((p) => p.id === projectId);
            if (hit) deletedName = hit.name;
            return list.filter((p) => p.id !== projectId);
          };
          return {
            planning: strip(prev.planning),
            in_progress: strip(prev.in_progress),
            paused: strip(prev.paused),
            done: strip(prev.done),
            cancelled: strip(prev.cancelled),
          };
        });
        void supabase
          .from("projects")
          .delete()
          .eq("id", projectId)
          .then(({ error }) => {
            if (error) console.error("[supabase] project delete failed:", error.message);
          });
        if (deletedName) {
          registerActivity(`Project deleted: ${deletedName}`);
        }
      },
      deleteBoardProjectTask: (projectId, taskId) => {
        let progressUpdate: number | null = null;
        setProjectsByColumn((prev) => {
          const mapProject = (p: Project): Project => {
            if (p.id !== projectId) return p;
            const nextTasks = p.tasks.filter((t) => t.id !== taskId);
            progressUpdate = computeProjectProgressFromTasks(nextTasks);
            return { ...p, tasks: nextTasks, progress: progressUpdate };
          };
          return {
            planning: prev.planning.map(mapProject),
            in_progress: prev.in_progress.map(mapProject),
            paused: prev.paused.map(mapProject),
            done: prev.done.map(mapProject),
            cancelled: prev.cancelled.map(mapProject),
          };
        });
        if (progressUpdate !== null) {
          void supabase
            .from("projects")
            .update({ progress: progressUpdate })
            .eq("id", projectId)
            .then(({ error }) => {
              if (error) console.error("[supabase] project progress update failed:", error.message);
            });
        }
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
          void supabase
            .from("projects")
            .update({ status: COLUMN_TO_STATUS[destinationColumn] })
            .eq("id", movedProject.id)
            .then(({ error }) => {
              if (error) console.error("[supabase] project status update failed:", error.message);
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
      tasksLoading,
      events,
      ideas,
      files,
      filesLoading,
      contracts,
      contractsLoading,
      invoices,
      invoicesLoading,
      goals,
      roadmap,
      embedConfig,
      activity,
      activityLoading,
      notifications,
      unreadCount,
      query,
      projectsByColumn,
      projectsLoading,
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
