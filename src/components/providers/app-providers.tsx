"use client";

import type { DropResult } from "@hello-pangea/dnd";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DocumentHead } from "@/components/layout/document-head";
import { AuthProvider, useAuth } from "@/context/auth-context";
import {
  ALL_MODULE_KEYS,
  ASSIGNABLE_MODULE_KEYS,
  defaultAdminModulesForClientCompany,
  isExternalClientCompany,
  modulesAssignableByViewer,
  ROCKETRIDE_ALLOWED_MODULE_KEYS,
} from "@/lib/modules";
import {
  COLUMN_TO_STATUS,
  computeProjectProgressFromTasks,
  splitProjectsByColumn,
  STATUS_TO_COLUMN,
  type KanbanColumnId,
  type Project,
  type ProjectStatus,
  type ProjectTaskRow,
  type ProjectsByColumn,
} from "@/app/(platform)/projects/data";
import {
  groupTaskAttachmentsByTaskId,
  mergeTaskHighlightAttachments,
  parseTaskAttachmentsNested,
} from "@/lib/task-highlight-cover";
import { fetchPublishedAtByTaskIds } from "@/lib/task-published-at-from-scheduled-posts";
import {
  activityLog as activitySeed,
  contracts as contractsSeed,
  events as eventsSeed,
  fileItems as filesSeed,
  goals as goalsSeed,
  ideasSeed,
  invoices as invoicesSeed,
  roadmapSeed,
  tasks as tasksSeed,
} from "@/services/mock-data";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/context/language-context";
import { normalizeAppLanguage, type AppLanguage } from "@/lib/locale-types";
import { resolveActiveClient, resolveActiveLocale } from "@/lib/resolve-locale";
import { mentionableUserNames, resolveMentionableUsers, type MentionableUser } from "@/lib/mentionable-users";
import { dictionary, localizeDynamic, localizeStatus, translate, type TranslationKey } from "@/services/i18n";
import type {
  ActivityLogItem,
  AppUser,
  Client,
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
  Role,
  Task,
  TaskStatus,
  UserCompany,
} from "@/types";

import {
  effectiveUserClientSlug,
  isAgencyAdmin,
  isAgencyCompany,
  isClientCompany,
  isRocketRideCompany,
  resolveDataClientSlug,
  rowMatchesDataClient,
  userHasLiveApis,
} from "@/lib/client-utils";
import {
  apiConfigToDb,
  apisConfigHasAnyEnabled,
  clientApisFromRow,
  EMPTY_CLIENT_APIS,
  resolveHeroImageUrl,
  resolveSessionClientApis,
} from "@/lib/client-apis";
import {
  clientApiCredentialsToDb,
  EMPTY_CLIENT_API_CREDENTIALS,
  parseClientApiCredentials,
} from "@/lib/client-api-credentials";
import {
  clientCrmIntegrationToDb,
  EMPTY_CLIENT_CRM_INTEGRATION,
  parseClientCrmIntegration,
} from "@/lib/client-crm-integration";
import {
  clientWhatsAppConfigToDb,
  EMPTY_CLIENT_WHATSAPP_CONFIG,
  parseClientWhatsAppConfig,
} from "@/lib/client-whatsapp-config";
import {
  clientDashboardCardsToDb,
  DEFAULT_CLIENT_DASHBOARD_CARDS,
  parseClientDashboardCards,
} from "@/lib/client-dashboard-cards";
import { heroClocksToDb, parseHeroClocks } from "@/lib/hero-clocks";

function filterProjectsByColumn(
  board: ProjectsByColumn,
  opts: { agencyAdmin: boolean; clientFilter: string; userClientSlug: string | null },
): ProjectsByColumn {
  const matchSlug = (slug: string | null | undefined) => {
    if (opts.agencyAdmin) {
      if (opts.clientFilter === "all") return true;
      return (slug ?? "") === opts.clientFilter;
    }
    if (!opts.userClientSlug) return true;
    return (slug ?? "") === opts.userClientSlug;
  };
  const filterList = (list: Project[]) => list.filter((p) => matchSlug(p.clientSlug));
  return {
    planning: filterList(board.planning),
    in_progress: filterList(board.in_progress),
    paused: filterList(board.paused),
    done: filterList(board.done),
    cancelled: filterList(board.cancelled),
  };
}

interface AppContextValue {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  saveLocalePreference: (lang: AppLanguage | null) => Promise<void>;
  saveHeroClocks: (pref: AppUser["heroClocks"]) => Promise<void>;
  t: (key: TranslationKey) => string;
  td: (content: string) => string;
  ts: (status: string) => string;
  currentUser: AppUser;
  availableUsers: AppUser[];
  allowedModules: ModuleKey[];
  users: AppUser[];
  mentionableUsers: MentionableUser[];
  mentionOptions: string[];
  /** `true` after the initial `app_users` fetch from Supabase finishes (success or error). */
  appUsersReady: boolean;
  setUserModules: (userId: string, modules: AppUser["modules"]) => void;
  addUser: (input: {
    name: string;
    email?: string | null;
    role: AppUser["role"];
    modules: AppUser["modules"];
    company?: AppUser["company"];
    clientSlug?: string | null;
  }) => void;
  updateUser: (
    id: string,
    updates: Partial<Pick<AppUser, "name" | "role" | "modules" | "company" | "email" | "clientSlug" | "localePreference">> & {
      password?: string;
    },
  ) => void;
  clients: Client[];
  clientsLoading: boolean;
  projectsClientFilter: string;
  setProjectsClientFilter: (slug: string) => void;
  addClient: (input: {
    name: string;
    slug: string;
    primaryColor: string;
    active: boolean;
    logoUrl?: string | null;
    logoLightUrl?: string | null;
    heroImageUrl?: string | null;
    apis?: Client["apis"];
    apiCredentials?: Client["apiCredentials"];
    crmIntegration?: Client["crmIntegration"];
    whatsappConfig?: Client["whatsappConfig"];
    dashboardCards?: Client["dashboardCards"];
    defaultLocale?: AppLanguage;
    enabledModules?: ModuleKey[] | null;
  }) => Promise<{ ok: boolean; error?: string }>;
  updateClient: (
    id: string,
    updates: Partial<
      Pick<
        Client,
        | "name"
        | "slug"
        | "primaryColor"
        | "active"
        | "logoUrl"
        | "logoLightUrl"
        | "heroImageUrl"
        | "apis"
        | "apiCredentials"
        | "crmIntegration"
        | "whatsappConfig"
        | "dashboardCards"
        | "defaultLocale"
        | "enabledModules"
      >
    >,
  ) => Promise<{ ok: boolean; error?: string }>;
  refreshClients: () => void;
  /** Per-integration flags for the active session (agency “all” → all on). */
  clientApis: Client["apis"];
  /** True if any integration is enabled for the session. */
  clientApisEnabled: boolean;
  heroImageUrl: string;
  /** When set, module data (financial, calendar, marketing, etc.) is limited to this client. */
  dataClientSlug: string | null;
  deleteUser: (id: string) => void;
  setProfileAvatarUrl: (url: string) => Promise<void>;
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
  dismissNotification: (id: string) => void;
  pushNotification: (message: string, type: NotificationItem["type"], stableId?: string) => void;
  notifyProjectComment: (input: {
    commentId: string;
    authorName: string;
    projectName: string;
    ownerNames: string[];
  }) => void;
  /** Inserts dashboard Activity Summary row (nexa/otus) when a client submits a task review. */
  logTaskReviewActivity: (input: { reviewerName: string; taskName: string; reviewStatusLabel: string }) => void;
  /** Activity when a task is published with one or more platforms selected. */
  logTaskPublishedToActivity: (input: { userName: string; taskName: string; platforms: string[] }) => void;
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
  updateBoardProject: (
    projectId: string,
    patch: Partial<{
      name: string;
      status: ProjectStatus;
      owners: string[];
      dueDate: string | null;
      startDate: string | null;
      type: Project["type"];
      description: string;
    }>,
  ) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const GUEST_USER: AppUser = {
  id: "__guest__",
  name: "",
  role: "client",
  company: "",
  modules: [],
  clientSlug: null,
  localePreference: null,
  avatarUrl: null,
  heroClocks: { cityIds: ["san-francisco", "curitiba"] },
};

const APP_USERS_SEED: Array<{
  name: string;
  email: string | null;
  company: UserCompany;
  role: Role;
  modules: ModuleKey[];
}> = [
  {
    name: "Matheus Canci",
    email: "matheuscancci@gmail.com",
    company: "nexa",
    role: "admin",
    modules: [...ALL_MODULE_KEYS],
  },
  {
    name: "David Martins",
    email: "david@nexamedia.com",
    company: "nexa",
    role: "admin",
    modules: [...ALL_MODULE_KEYS],
  },
  {
    name: "Matheus Foletto",
    email: "foletto@otusmedia.com",
    company: "otus",
    role: "admin",
    modules: [...ALL_MODULE_KEYS],
  },
  {
    name: "Joe Maiochi",
    email: "joe.maionchi@rocketride.ai",
    company: "rocketride",
    role: "admin",
    modules: [...ROCKETRIDE_ALLOWED_MODULE_KEYS],
  },
  {
    name: "Karla Kachuba",
    email: "karla@nexamedia.com",
    company: "nexa",
    role: "manager",
    modules: ["projects", "updates", "marketing", "content-management", "files"],
  },
  {
    name: "Luca",
    email: "luca@otusmedia.com",
    company: "otus",
    role: "manager",
    modules: ["projects", "updates", "marketing", "content-management", "files"],
  },
  {
    name: "Aaron Jimenez",
    email: "aaron.jimenez@rocketride.ai",
    company: "rocketride",
    role: "manager",
    modules: ["projects", "files", "contracts"],
  },
];

function normalizeUserCompany(value: unknown): UserCompany {
  const s = String(value ?? "").toLowerCase().trim();
  if (!s) return "";
  return s;
}

function normalizeUserRole(value: unknown): Role {
  return value === "admin" || value === "manager" ? value : "manager";
}

function normalizeUserModules(value: unknown): ModuleKey[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter((m): m is ModuleKey => ALL_MODULE_KEYS.includes(m as ModuleKey));
}

function hashAppPassword(password: string): string {
  return btoa(unescape(encodeURIComponent(password)));
}

function appUserFromAppUsersRow(row: Record<string, unknown>): AppUser {
  const emailRaw = row.email;
  const company = normalizeUserCompany(row.company);
  const role = normalizeUserRole(row.role);
  let modules = normalizeUserModules(row.modules);
  if (role === "admin" && (company === "nexa" || company === "otus")) {
    modules = [...ALL_MODULE_KEYS];
  }
  const clientSlugRaw = row.client_slug;
  const clientSlug =
    clientSlugRaw != null && String(clientSlugRaw).trim() !== "" ? String(clientSlugRaw).trim() : null;
  const localePrefRaw = row.locale_preference;
  const localePreference =
    localePrefRaw === "pt-BR" || localePrefRaw === "en" ? localePrefRaw : null;
  const avatarRaw = row.avatar_url;
  const avatarUrl =
    avatarRaw != null && String(avatarRaw).trim() !== "" ? String(avatarRaw).trim() : null;
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    email: emailRaw != null && String(emailRaw).trim() !== "" ? String(emailRaw).trim() : null,
    role,
    company,
    modules,
    clientSlug,
    localePreference,
    avatarUrl,
    heroClocks: parseHeroClocks(row.hero_clocks),
  };
}

function parseClientEnabledModules(row: Record<string, unknown>): ModuleKey[] | null {
  const raw = row.enabled_modules;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const keys = raw.filter(
    (m): m is ModuleKey => typeof m === "string" && ASSIGNABLE_MODULE_KEYS.includes(m as ModuleKey),
  );
  return keys.length > 0 ? keys : null;
}

function clientFromRow(row: Record<string, unknown>): Client {
  const apis = clientApisFromRow(row);
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    logoUrl: row.logo_url != null && String(row.logo_url).trim() !== "" ? String(row.logo_url) : null,
    logoLightUrl:
      row.logo_light_url != null && String(row.logo_light_url).trim() !== ""
        ? String(row.logo_light_url)
        : null,
    heroImageUrl:
      row.hero_image_url != null && String(row.hero_image_url).trim() !== "" ? String(row.hero_image_url) : null,
    primaryColor: String(row.primary_color ?? "#FF4500"),
    active: row.active !== false,
    defaultLocale: normalizeAppLanguage(row.default_locale),
    apiEnabled: row.api_enabled === true || apisConfigHasAnyEnabled(apis),
    apis,
    apiCredentials: parseClientApiCredentials(row.api_credentials),
    crmIntegration: parseClientCrmIntegration(row.crm_integration),
    whatsappConfig: parseClientWhatsAppConfig(row.whatsapp_config),
    dashboardCards: parseClientDashboardCards(row.dashboard_cards),
    enabledModules: parseClientEnabledModules(row),
    createdAt: String(row.created_at ?? ""),
  };
}

type DbProjectRow = {
  id: string;
  name: string;
  type: string | null;
  status: string | null;
  progress: number | null;
  owner: string | null;
  owners?: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  client_slug?: string | null;
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
  review_status: string | null;
  published_to: string[] | null;
  published_at: string | null;
  task_attachments?: unknown;
};

type TaskReviewNotificationRow = {
  id: string;
  task_id: string | null;
  reviewer_name: string | null;
  status: string | null;
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

async function enrichFeaturedTasksWithAttachments(taskRows: DbTaskRow[]): Promise<DbTaskRow[]> {
  const featuredIds = taskRows.filter((t) => t.is_featured).map((t) => t.id);
  if (featuredIds.length === 0) return taskRows;

  const { data, error } = await supabase
    .from("task_attachments")
    .select("*")
    .in("task_id", featuredIds);

  if (error) {
    console.error("[supabase] featured task_attachments fetch failed:", error.message);
    return taskRows;
  }

  const byTask = groupTaskAttachmentsByTaskId((data as Record<string, unknown>[]) ?? []);
  return taskRows.map((task) => {
    if (!task.is_featured) return task;
    const fetched = byTask.get(task.id);
    if (!fetched?.length) return task;
    return {
      ...task,
      task_attachments: mergeTaskHighlightAttachments(task.task_attachments, fetched),
    };
  });
}

function mapRowsToProjectsByColumn(projectRows: DbProjectRow[], taskRows: DbTaskRow[]): ProjectsByColumn {
  const projects: Project[] = projectRows.map((row) => {
    const column = statusToColumn(row.status);
    const ownersStr = (row.owners?.trim() || row.owner?.trim() || "") as string;
    const ownersList = ownersStr ? ownersStr.split(",").map((s) => s.trim()).filter(Boolean) : [];
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
        reviewStatus: task.review_status?.trim() ? String(task.review_status) : null,
        publishedTo: Array.isArray(task.published_to) ? task.published_to.map(String) : [],
        publishedAt: task.published_at?.trim() ? String(task.published_at) : null,
        attachments: mergeTaskHighlightAttachments(task.task_attachments),
      }));
    return {
      id: row.id,
      name: row.name,
      column,
      owners: ownersList,
      progress: computeProjectProgressFromTasks(projectTasks),
      dueDate: row.end_date,
      status: COLUMN_TO_STATUS[column],
      type: row.type === "Website" || row.type === "Monthly Content" || row.type === "Paid Traffic" ? row.type : "Website",
      startDate: row.start_date,
      teamMembers: ownersList,
      linkedInvoices: [],
      description: row.description ?? "",
      tasks: projectTasks,
      clientSlug: row.client_slug?.trim() ? String(row.client_slug).trim() : null,
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
  const { sessionUserId, persistedUser, logout } = useAuth();
  const { setLanguage: setLanguageRaw, t: tLine } = useLanguage();
  const [localeSessionOverride, setLocaleSessionOverride] = useState<AppLanguage | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [appUsersReady, setAppUsersReady] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
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
  const [allProjectsByColumn, setAllProjectsByColumn] = useState<ProjectsByColumn>(() => splitProjectsByColumn([]));
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsClientFilter, setProjectsClientFilterState] = useState("all");

  const setProjectsClientFilter = useCallback(
    (slug: string) => {
      setProjectsClientFilterState(slug);
      if (!sessionUserId) return;
      try {
        localStorage.setItem(`projects-client-filter:${sessionUserId}`, slug);
      } catch {
        /* ignore */
      }
    },
    [sessionUserId],
  );

  useEffect(() => {
    if (!sessionUserId) return;
    try {
      const saved = localStorage.getItem(`projects-client-filter:${sessionUserId}`);
      if (saved) setProjectsClientFilterState(saved);
    } catch {
      /* ignore */
    }
  }, [sessionUserId]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);

  const fetchClients = useCallback(() => {
    void supabase
      .from("clients")
      .select("*")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("[supabase] clients fetch failed:", error.message);
          setClients([]);
          return;
        }
        setClients(((data as Array<Record<string, unknown>> | null) ?? []).map((row) => clientFromRow(row)));
      })
      .then(
        () => setClientsLoading(false),
        () => setClientsLoading(false),
      );
  }, []);

  useEffect(() => {
    let mounted = true;
    setClientsLoading(true);
    void supabase
      .from("clients")
      .select("*")
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error("[supabase] clients fetch failed:", error.message);
          setClients([]);
        } else {
          setClients(((data as Array<Record<string, unknown>> | null) ?? []).map((row) => clientFromRow(row)));
        }
      })
      .then(
        () => {
          if (mounted) setClientsLoading(false);
        },
        () => {
          if (mounted) setClientsLoading(false);
        },
      );
    return () => {
      mounted = false;
    };
  }, []);

  const currentUser = useMemo((): AppUser => {
    if (!sessionUserId) return GUEST_USER;
    const fromList = users.find((u) => u.id === sessionUserId);
    if (fromList) return fromList;
    if (persistedUser?.id === sessionUserId) return persistedUser;
    return GUEST_USER;
  }, [sessionUserId, users, persistedUser]);

  const projectsByColumn = useMemo(
    () =>
      filterProjectsByColumn(allProjectsByColumn, {
        agencyAdmin: isAgencyCompany(currentUser.company),
        clientFilter: projectsClientFilter,
        userClientSlug: effectiveUserClientSlug(currentUser),
      }),
    [allProjectsByColumn, currentUser, projectsClientFilter],
  );

  const clientApis = useMemo(
    () => resolveSessionClientApis(currentUser, clients, projectsClientFilter),
    [currentUser, clients, projectsClientFilter],
  );

  const clientApisEnabled = useMemo(
    () => isAgencyCompany(currentUser.company) || apisConfigHasAnyEnabled(clientApis),
    [currentUser.company, clientApis],
  );

  const heroImageUrl = useMemo(
    () => resolveHeroImageUrl(currentUser, clients, projectsClientFilter),
    [currentUser, clients, projectsClientFilter],
  );

  const dataClientSlug = useMemo(
    () => resolveDataClientSlug(currentUser, projectsClientFilter),
    [currentUser, projectsClientFilter],
  );

  const activeClient = useMemo(
    () => resolveActiveClient(currentUser, clients, projectsClientFilter),
    [currentUser, clients, projectsClientFilter],
  );

  const viewingAllClients = isAgencyAdmin(currentUser) && projectsClientFilter === "all";

  const language = useMemo(
    () =>
      resolveActiveLocale({
        sessionOverride: localeSessionOverride,
        userPreference: currentUser.localePreference,
        clientDefaultLocale: activeClient?.defaultLocale ?? "en",
        viewingAllClients,
      }),
    [
      localeSessionOverride,
      currentUser.localePreference,
      activeClient?.defaultLocale,
      viewingAllClients,
    ],
  );

  const prevClientFilterRef = useRef(projectsClientFilter);

  useEffect(() => {
    if (!sessionUserId) return;
    try {
      const raw = localStorage.getItem(`locale-session:${sessionUserId}`);
      if (raw === "pt-BR" || raw === "en") {
        setLocaleSessionOverride(raw);
      }
    } catch {
      /* ignore */
    }
  }, [sessionUserId]);

  useEffect(() => {
    setLanguageRaw(language);
    try {
      localStorage.setItem("app-language", language);
    } catch {
      /* ignore */
    }
  }, [language, setLanguageRaw]);

  useEffect(() => {
    if (prevClientFilterRef.current === projectsClientFilter) return;
    prevClientFilterRef.current = projectsClientFilter;
    if (currentUser.localePreference) return;
    setLocaleSessionOverride(null);
    try {
      if (sessionUserId) localStorage.removeItem(`locale-session:${sessionUserId}`);
    } catch {
      /* ignore */
    }
  }, [projectsClientFilter, currentUser.localePreference, sessionUserId]);

  const setLanguage = useCallback(
    (lang: AppLanguage) => {
      setLocaleSessionOverride(lang);
      setLanguageRaw(lang);
      try {
        if (sessionUserId) localStorage.setItem(`locale-session:${sessionUserId}`, lang);
        localStorage.setItem("app-language", lang);
      } catch {
        /* ignore */
      }
    },
    [sessionUserId, setLanguageRaw],
  );

  const saveLocalePreference = useCallback(
    async (lang: AppLanguage | null) => {
      if (!sessionUserId || currentUser.id === GUEST_USER.id) return;
      const dbVal = lang;
      const { error } = await supabase
        .from("app_users")
        .update({ locale_preference: dbVal })
        .eq("id", sessionUserId);
      if (error) {
        console.error("[supabase] locale_preference update failed:", error.message);
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === sessionUserId ? { ...u, localePreference: lang } : u)),
      );
      setLocaleSessionOverride(null);
      try {
        if (sessionUserId) localStorage.removeItem(`locale-session:${sessionUserId}`);
      } catch {
        /* ignore */
      }
    },
    [sessionUserId, currentUser.id],
  );

  const saveHeroClocks = useCallback(
    async (pref: AppUser["heroClocks"]) => {
      if (!sessionUserId || currentUser.id === GUEST_USER.id) return;
      const next = heroClocksToDb(pref);
      const { error } = await supabase
        .from("app_users")
        .update({ hero_clocks: next })
        .eq("id", sessionUserId);
      if (error) {
        console.error("[supabase] hero_clocks update failed:", error.message);
        if (error.message.includes("hero_clocks")) {
          console.error(
            "[supabase] Run supabase/app-users-hero-clocks.sql in Supabase SQL Editor to add the column.",
          );
        }
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === sessionUserId ? { ...u, heroClocks: next } : u)),
      );
    },
    [sessionUserId, currentUser.id],
  );

  const allowedModules: ModuleKey[] =
    !sessionUserId || currentUser.id === GUEST_USER.id ? [] : [...currentUser.modules];
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const t = (key: TranslationKey) => translate(language, key);
  const td = (content: string) => localizeDynamic(language, content);
  const ts = (status: string) => localizeStatus(language, status);

  const mentionableUsers = useMemo(
    () => resolveMentionableUsers(users, dataClientSlug, currentUser),
    [users, dataClientSlug, currentUser],
  );
  const mentionOptions = useMemo(() => mentionableUserNames(mentionableUsers), [mentionableUsers]);

  const setProfileAvatarUrl = useCallback(
    async (url: string) => {
      if (!sessionUserId || currentUser.id === GUEST_USER.id) return;
      const { error } = await supabase.from("app_users").update({ avatar_url: url }).eq("id", sessionUserId);
      if (error) {
        console.error("[supabase] avatar_url update failed:", error.message);
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === sessionUserId ? { ...u, avatarUrl: url } : u)),
      );
    },
    [sessionUserId, currentUser.id],
  );

  const registerActivity = (action: string) => {
    void supabase
      .from("activity")
      .insert({ action, user_name: currentUser.name })
      .then(({ error }) => {
        if (error) console.error("[supabase] activity insert failed:", error.message);
      });
  };
  const pushNotification = useCallback((message: string, type: NotificationItem["type"], stableId?: string) => {
    setNotifications((prev) => {
      if (stableId && prev.some((n) => n.id === stableId)) return prev;
      const id = stableId ?? crypto.randomUUID();
      return [{ id, message, type, read: false }, ...prev].slice(0, 50);
    });
  }, []);
  const notifyProjectComment = useCallback(
    (input: { commentId: string; authorName: string; projectName: string; ownerNames: string[] }) => {
      if (!sessionUserId || currentUser.id === GUEST_USER.id) return;
      const me = currentUser.name.trim();
      if (!me) return;
      if (!input.ownerNames.some((o) => String(o).trim() === me)) return;
      if (input.authorName.trim() === me) return;
      pushNotification(`${input.authorName} commented on ${input.projectName}`, "comment", `proj-comment:${input.commentId}`);
    },
    [sessionUserId, currentUser.id, currentUser.name, pushNotification],
  );

  const logTaskReviewActivity = useCallback((input: { reviewerName: string; taskName: string; reviewStatusLabel: string }) => {
    const actor = input.reviewerName.trim() || "Client";
    const action = `${actor} reviewed task: ${input.taskName} — ${input.reviewStatusLabel}`;
    void supabase.from("activity").insert({ action, user_name: actor }).then(({ error }) => {
      if (error) console.error("[supabase] task review activity insert failed:", error.message);
    });
  }, []);

  const logTaskPublishedToActivity = useCallback((input: { userName: string; taskName: string; platforms: string[] }) => {
    if (!input.platforms.length) return;
    const actor = input.userName.trim() || "User";
    const action = `${actor} published ${input.taskName} to ${input.platforms.join(", ")}`;
    void supabase.from("activity").insert({ action, user_name: actor }).then(({ error }) => {
      if (error) console.error("[supabase] task published activity insert failed:", error.message);
    });
  }, []);
  const tagsFromText = (text: string) =>
    text
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const { count, error: countError } = await supabase.from("app_users").select("*", { count: "exact", head: true });
        if (!mounted) return;
        if (countError) {
          console.error("[supabase] app_users count failed:", countError.message);
        }
        if (count === 0) {
          const { error: seedError } = await supabase.from("app_users").insert(
            APP_USERS_SEED.map((u) => ({
              name: u.name,
              email: u.email,
              company: u.company,
              role: u.role,
              modules: u.modules,
            })),
          );
          if (seedError) {
            console.error("[supabase] app_users seed failed:", seedError.message);
          }
        }
        const { data, error } = await supabase.from("app_users").select("*").order("name", { ascending: true });
        if (!mounted) return;
        if (error) {
          console.error("[supabase] app_users fetch failed:", error.message);
          setUsers([]);
          return;
        }
        setUsers(((data as Array<Record<string, unknown>> | null) ?? []).map((row) => appUserFromAppUsersRow(row)));
      } finally {
        if (mounted) setAppUsersReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionUserId) {
      setNotifications([]);
    }
  }, [sessionUserId]);

  useEffect(() => {
    if (!sessionUserId || currentUser.id === GUEST_USER.id || !currentUser.name.trim()) {
      return;
    }
    if (projectsLoading || tasksLoading) return;

    const me = currentUser.name.trim();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const parseYmdTime = (s: string | null | undefined): number | null => {
      if (!s) return null;
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
      if (!m) return null;
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
    };

    const desired = new Map<string, { message: string }>();

    const cols: KanbanColumnId[] = ["planning", "in_progress", "paused", "done", "cancelled"];
    for (const col of cols) {
      for (const p of projectsByColumn[col]) {
        for (const task of p.tasks) {
          if ((task.owner ?? "").trim() !== me) continue;
          if (task.status === "Done" || task.status === "Published") continue;
          const dueT = parseYmdTime(task.dueDate);
          if (dueT === null) continue;
          if (dueT > todayStart) continue;
          const id = `board-due:${task.id}`;
          desired.set(id, {
            message: dueT === todayStart ? `Task due today: ${task.name}` : `Overdue task: ${task.name}`,
          });
        }
      }
    }

    for (const task of tasks) {
      if ((task.assignee ?? "").trim() !== me) continue;
      if (task.status === "completed") continue;
      const dueT = parseYmdTime(task.dueDate);
      if (dueT === null) continue;
      if (dueT > todayStart) continue;
      const id = `platform-due:${task.id}`;
      desired.set(id, {
        message: dueT === todayStart ? `Task due today: ${task.title}` : `Overdue task: ${task.title}`,
      });
    }

    setNotifications((prev) => {
      const withoutDue = prev.filter(
        (n) => !n.id.startsWith("board-due:") && !n.id.startsWith("platform-due:"),
      );
      const dueItems: NotificationItem[] = [];
      for (const [id, { message }] of desired) {
        const prevMatch = prev.find((x) => x.id === id);
        dueItems.push({
          id,
          message,
          type: "task",
          read: prevMatch?.read ?? false,
        });
      }
      return [...dueItems, ...withoutDue].slice(0, 50);
    });
  }, [
    projectsLoading,
    tasksLoading,
    projectsByColumn,
    tasks,
    currentUser.name,
    currentUser.id,
    sessionUserId,
  ]);

  useEffect(() => {
    if (!sessionUserId || currentUser.id === GUEST_USER.id) return;
    if (currentUser.role !== "admin") return;
    if (currentUser.company !== "nexa" && currentUser.company !== "otus") return;
    let cancelled = false;

    const syncTaskReviewNotifications = async () => {
      const { data: reviewData, error: reviewError } = await supabase
        .from("task_reviews")
        .select("id,task_id,reviewer_name,status")
        .order("created_at", { ascending: false })
        .limit(25);
      if (cancelled || reviewError) return;

      const rows = (reviewData as TaskReviewNotificationRow[] | null) ?? [];
      const taskIds = Array.from(new Set(rows.map((row) => String(row.task_id ?? "")).filter(Boolean)));
      const taskNameById = new Map<string, string>();
      if (taskIds.length > 0) {
        const { data: taskData, error: taskError } = await supabase.from("tasks").select("id,title").in("id", taskIds);
        if (!cancelled && !taskError) {
          for (const taskRow of (taskData as Array<{ id?: string; title?: string | null }> | null) ?? []) {
            const id = String(taskRow.id ?? "");
            if (!id) continue;
            taskNameById.set(id, String(taskRow.title ?? "").trim());
          }
        }
      }

      if (cancelled) return;
      setNotifications((prev) => {
        const desiredById = new Map<string, NotificationItem>();
        for (const row of rows) {
          const reviewId = String(row.id ?? "");
          if (!reviewId) continue;
          const reviewer = String(row.reviewer_name ?? "").trim() || "A RocketRide reviewer";
          const taskName = taskNameById.get(String(row.task_id ?? "")) || "a task";
          const status = String(row.status ?? "").trim() || "Updated";
          const id = `task-review:${reviewId}`;
          const prior = prev.find((item) => item.id === id);
          desiredById.set(id, {
            id,
            type: "task",
            message: `${reviewer} left feedback on ${taskName}: ${status}`,
            read: prior?.read ?? false,
          });
        }
        const withoutTaskReviews = prev.filter((item) => !item.id.startsWith("task-review:"));
        return [...desiredById.values(), ...withoutTaskReviews].slice(0, 50);
      });
    };

    void syncTaskReviewNotifications();
    const interval = window.setInterval(() => void syncTaskReviewNotifications(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [sessionUserId, currentUser.id, currentUser.role, currentUser.company]);

  useEffect(() => {
    if (!sessionUserId || currentUser.id === GUEST_USER.id || !currentUser.name.trim()) return;
    let cancelled = false;
    const syncMarketingReminders = () => {
      const nowIso = new Date().toISOString();
      void supabase
        .from("marketing_tasks")
        .select("id,title,reminder_note,assigned_to")
        .not("reminder_at", "is", null)
        .lte("reminder_at", nowIso)
        .eq("assigned_to", currentUser.name.trim())
        .then(({ data, error }) => {
          if (cancelled || error) return;
          const rows =
            (data as Array<{ id?: string; title?: string | null; reminder_note?: string | null }> | null) ?? [];
          setNotifications((prev) => {
            const wantIds = new Set(
              rows
                .map((r) => `mkt-reminder:${String(r.id ?? "")}`)
                .filter((id) => id !== "mkt-reminder:"),
            );
            const base = prev.filter((n) => {
              if (!n.id.startsWith("mkt-reminder:")) return true;
              return wantIds.has(n.id);
            });
            const existing = new Set(base.map((n) => n.id));
            const additions: NotificationItem[] = [];
            for (const row of rows) {
              const id = `mkt-reminder:${String(row.id ?? "")}`;
              if (id === "mkt-reminder:" || existing.has(id)) continue;
              const title = String(row.title ?? "");
              const note = String(row.reminder_note ?? "");
              additions.push({
                id,
                message: `Reminder: ${title} — ${note}`,
                type: "task",
                read: false,
              });
            }
            return [...additions, ...base].slice(0, 50);
          });
        });
    };
    syncMarketingReminders();
    const interval = window.setInterval(syncMarketingReminders, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [sessionUserId, currentUser.id, currentUser.name]);

  useEffect(() => {
    let mounted = true;
    const userSlug = effectiveUserClientSlug(currentUser);
    let query = supabase
      .from("tasks")
      .select("*")
      .is("project_id", null)
      .order("created_at", { ascending: false });
    if (userSlug && !isAgencyCompany(currentUser.company)) {
      query = query.eq("client_slug", userSlug);
    }
    void query.then(({ data, error }) => {
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
  }, [currentUser.company, currentUser.clientSlug]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      let projectsQuery = supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (dataClientSlug) {
        projectsQuery = projectsQuery.eq("client_slug", dataClientSlug);
      }
      const projectsRes = await projectsQuery;
      if (!mounted) return;
      if (projectsRes.error) {
        console.error("[supabase] projects fetch failed:", projectsRes.error.message);
        setAllProjectsByColumn(splitProjectsByColumn([]));
        if (mounted) setProjectsLoading(false);
        return;
      }
      const projectRows = (projectsRes.data as DbProjectRow[] | null) ?? [];
      const projectIds = projectRows.map((p) => p.id).filter(Boolean);
      let taskRows: DbTaskRow[] = [];
      if (projectIds.length > 0) {
        const { data: tasksData, error: tasksError } = await supabase
          .from("tasks")
          .select("*, task_attachments(*)")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false });
        if (!mounted) return;
        if (tasksError) {
          console.error("[supabase] project tasks fetch failed:", tasksError.message);
          setAllProjectsByColumn(splitProjectsByColumn([]));
          if (mounted) setProjectsLoading(false);
          return;
        }
        taskRows = (tasksData as DbTaskRow[] | null) ?? [];
      } else if (!dataClientSlug) {
        const { data: tasksData, error: tasksError } = await supabase
          .from("tasks")
          .select("*, task_attachments(*)")
          .not("project_id", "is", null)
          .order("created_at", { ascending: false });
        if (!mounted) return;
        if (tasksError) {
          console.error("[supabase] project tasks fetch failed:", tasksError.message);
          setAllProjectsByColumn(splitProjectsByColumn([]));
          if (mounted) setProjectsLoading(false);
          return;
        }
        taskRows = (tasksData as DbTaskRow[] | null) ?? [];
      }
      const needFromPublishing = taskRows.filter(
        (t) => t.status === "Published" && !String(t.published_at ?? "").trim(),
      );
      if (needFromPublishing.length > 0) {
        const fromPosts = await fetchPublishedAtByTaskIds(
          supabase,
          needFromPublishing.map((t) => t.id),
        );
        taskRows = taskRows.map((t) => {
          if (t.status !== "Published" || String(t.published_at ?? "").trim()) return t;
          const iso = fromPosts.get(t.id);
          if (!iso) return t;
          return { ...t, published_at: iso };
        });
      }
      const enrichedTasks = await enrichFeaturedTasksWithAttachments(taskRows);
      if (!mounted) return;
      setAllProjectsByColumn(mapRowsToProjectsByColumn(projectRows, enrichedTasks));
      if (mounted) setProjectsLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [dataClientSlug]);

  useEffect(() => {
    let mounted = true;
    let invoicesQuery = supabase.from("invoices").select("*").order("created_at", { ascending: false });
    if (dataClientSlug) {
      invoicesQuery = invoicesQuery.eq("client_slug", dataClientSlug);
    }
    void invoicesQuery.then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error("[supabase] invoices fetch failed:", error.message);
          setInvoices([]);
        } else {
          const rows = ((data as Array<Record<string, unknown>> | null) ?? []).filter((row) =>
            rowMatchesDataClient(row.client_slug != null ? String(row.client_slug) : null, dataClientSlug),
          );
          setInvoices(
            rows.map((row) => ({
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
  }, [dataClientSlug]);

  useEffect(() => {
    let mounted = true;
    let filesQuery = supabase.from("files").select("*");
    if (dataClientSlug) {
      filesQuery = filesQuery.eq("client_slug", dataClientSlug);
    }
    void filesQuery.then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error("[supabase] files fetch failed:", error.message);
          setFiles([]);
        } else {
          const rows = ((data as Array<Record<string, unknown>> | null) ?? []).filter((row) =>
            rowMatchesDataClient(row.client_slug != null ? String(row.client_slug) : null, dataClientSlug),
          );
          setFiles(
            rows.map((row) => ({
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
  }, [dataClientSlug]);

  useEffect(() => {
    let mounted = true;
    let contractsQuery = supabase.from("contracts").select("*").order("uploaded_at", { ascending: false });
    if (dataClientSlug) {
      contractsQuery = contractsQuery.eq("client_slug", dataClientSlug);
    }
    void contractsQuery.then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error("[supabase] contracts fetch failed:", error.message);
          setContracts([]);
        } else {
          const rows = ((data as Array<Record<string, unknown>> | null) ?? []).filter((row) =>
            rowMatchesDataClient(row.client_slug != null ? String(row.client_slug) : null, dataClientSlug),
          );
          setContracts(
            rows.map((row) => ({
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
  }, [dataClientSlug]);

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
      saveLocalePreference,
      saveHeroClocks,
      t,
      td,
      ts,
      currentUser,
      availableUsers: users,
      allowedModules,
      users,
      mentionableUsers,
      mentionOptions,
      appUsersReady,
      setUserModules: (userId, modules) => {
        setUsers((prev) =>
          prev.map((user) => {
            if (user.id !== userId) return user;
            return { ...user, modules };
          }),
        );
        void supabase
          .from("app_users")
          .update({ modules })
          .eq("id", userId)
          .then(({ error }) => {
            if (error) console.error("[supabase] app_users modules update failed:", error.message);
          });
      },
      addUser: ({ name, email: emailInput, role, modules, company = "", clientSlug: clientSlugInput }) => {
        const elevatedCompany = isAgencyCompany(currentUser.company);
        const rocketRideViewer = isRocketRideCompany(currentUser.company);
        const externalClientViewer = isExternalClientCompany(currentUser.company);
        const nexaOtusAdmin = elevatedCompany && currentUser.role === "admin";
        const rrAdmin = rocketRideViewer && currentUser.role === "admin";
        const externalClientAdmin = externalClientViewer && currentUser.role === "admin";
        const moduleCtx = { users, clients };
        const viewerScopeModuleKeys = modulesAssignableByViewer(currentUser, moduleCtx);
        const companyResolved: UserCompany = rocketRideViewer ? "rocketride" : company || "nexa";
        let modulesToStore: ModuleKey[];
        if (role === "admin") {
          if (nexaOtusAdmin) {
            modulesToStore = isExternalClientCompany(companyResolved)
              ? defaultAdminModulesForClientCompany(companyResolved, moduleCtx)
              : isRocketRideCompany(companyResolved)
                ? [...ROCKETRIDE_ALLOWED_MODULE_KEYS]
                : [...ALL_MODULE_KEYS];
          } else if (rrAdmin) {
            modulesToStore = [...ROCKETRIDE_ALLOWED_MODULE_KEYS];
          } else if (elevatedCompany) {
            modulesToStore = [...ALL_MODULE_KEYS];
          } else if (externalClientAdmin) {
            modulesToStore = defaultAdminModulesForClientCompany(companyResolved, moduleCtx);
          } else {
            modulesToStore = [...ROCKETRIDE_ALLOWED_MODULE_KEYS];
          }
        } else {
          modulesToStore = modules.filter((m) => viewerScopeModuleKeys.includes(m));
        }
        const emailTrimmed = emailInput != null && String(emailInput).trim() !== "" ? String(emailInput).trim() : null;
        let clientSlugToStore: string | null = null;
        if (!isAgencyCompany(companyResolved)) {
          if (clientSlugInput != null && String(clientSlugInput).trim() !== "") {
            clientSlugToStore = String(clientSlugInput).trim();
          } else {
            clientSlugToStore = String(companyResolved).trim() || null;
          }
        }
        void supabase
          .from("app_users")
          .insert({
            name: name.trim(),
            email: emailTrimmed,
            company: companyResolved,
            role,
            modules: modulesToStore,
            client_slug: clientSlugToStore,
          })
          .select("*")
          .single()
          .then(({ data, error }) => {
            if (error) {
              console.error("[supabase] app_users insert failed:", error.message);
              return;
            }
            const row = (data as Record<string, unknown>) ?? {};
            const created = appUserFromAppUsersRow(row);
            setUsers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
          });
      },
      updateUser: (id, updates) => {
        const { password: passwordUpdate, ...rest } = updates;
        setUsers((prev) =>
          prev.map((u) => {
            if (u.id !== id) return u;
            const merged = { ...u, ...rest };
            if (merged.role === "admin" && rest.modules !== undefined) {
              return { ...merged, modules: rest.modules };
            }
            return merged;
          }),
        );
        const dbPatch: Record<string, unknown> = {};
        if (rest.name !== undefined) dbPatch.name = typeof rest.name === "string" ? rest.name.trim() : rest.name;
        if (rest.email !== undefined) dbPatch.email = rest.email != null && String(rest.email).trim() !== "" ? String(rest.email).trim() : null;
        if (rest.role !== undefined) dbPatch.role = rest.role;
        if (rest.company !== undefined) dbPatch.company = rest.company;
        if (rest.clientSlug !== undefined) dbPatch.client_slug = rest.clientSlug;
        if (rest.localePreference !== undefined) dbPatch.locale_preference = rest.localePreference;
        if (rest.modules !== undefined) dbPatch.modules = rest.modules;
        if (passwordUpdate !== undefined && String(passwordUpdate).trim() !== "") {
          dbPatch.password_hash = hashAppPassword(String(passwordUpdate).trim());
        }
        if (Object.keys(dbPatch).length === 0) return;
        void supabase
          .from("app_users")
          .update(dbPatch)
          .eq("id", id)
          .select("*")
          .single()
          .then(({ data, error }) => {
            if (error) {
              console.error("[supabase] app_users update failed:", error.message);
              return;
            }
            if (data) {
              const next = appUserFromAppUsersRow(data as Record<string, unknown>);
              setUsers((prev) => prev.map((u) => (u.id === id ? next : u)).sort((a, b) => a.name.localeCompare(b.name)));
            }
          });
      },
      setProfileAvatarUrl,
      deleteUser: (id) => {
        setUsers((prev) => prev.filter((u) => u.id !== id));
        if (sessionUserId === id) logout();
        void supabase
          .from("app_users")
          .delete()
          .eq("id", id)
          .then(({ error }) => {
            if (error) console.error("[supabase] app_users delete failed:", error.message);
          });
      },
      tasks,
      tasksLoading,
      setTaskStatus: (id, status) => {
        setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, status } : task)));
        void supabase.from("tasks").update({ status }).eq("id", id).then(({ error }) => {
          if (error) console.error("[supabase] task status update failed:", error.message);
        });
        registerActivity(`Task moved to ${status}`);
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
        if (currentUser.name && (input.assignee ?? "").trim() === currentUser.name.trim()) {
          pushNotification(`You were assigned to task: ${input.title}`, "task");
        }
      },
      updateTask: (id, updates) => {
        let assignedTitle: string | null = null;
        setTasks((prev) => {
          const prevTask = prev.find((task) => task.id === id);
          if (!prevTask) return prev;
          const nextAssignee = updates.assignee !== undefined ? updates.assignee : prevTask.assignee;
          const title = updates.title !== undefined ? updates.title : prevTask.title;
          if (
            currentUser.name &&
            nextAssignee.trim() === currentUser.name.trim() &&
            (prevTask.assignee ?? "").trim() !== nextAssignee.trim()
          ) {
            assignedTitle = title;
          }
          return prev.map((task) => (task.id === id ? { ...task, ...updates } : task));
        });
        if (assignedTitle) {
          pushNotification(`You were assigned to task: ${assignedTitle}`, "task");
        }
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
        if (currentUser.name) {
          pushNotification(`You were assigned to task: From event: ${event.title}`, "task");
        }
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
        if (currentUser.name) {
          pushNotification(`You were assigned to task: ${idea.title}`, "task");
        }
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
      dismissNotification: (id) => setNotifications((prev) => prev.filter((item) => item.id !== id)),
      pushNotification,
      notifyProjectComment,
      logTaskReviewActivity,
      logTaskPublishedToActivity,
      query,
      setQuery,
      projectsByColumn,
      projectsLoading,
      projectsClientFilter,
      setProjectsClientFilter,
      clients,
      clientsLoading,
      refreshClients: fetchClients,
      clientApis,
      clientApisEnabled,
      heroImageUrl,
      dataClientSlug,
      addClient: async ({
        name,
        slug,
        primaryColor,
        active,
        logoUrl,
        logoLightUrl,
        heroImageUrl: heroUrl,
        apis,
        apiCredentials,
        crmIntegration,
        whatsappConfig,
        dashboardCards,
        defaultLocale,
        enabledModules,
      }) => {
        const trimmedName = name.trim();
        const trimmedSlug = slug.trim().toLowerCase();
        if (!trimmedName || !trimmedSlug) {
          return { ok: false, error: "Name and slug are required." };
        }
        const apisConfig = apis ?? { ...EMPTY_CLIENT_APIS };
        const anyApi = apisConfigHasAnyEnabled(apisConfig);
        const { data: inserted, error } = await supabase
          .from("clients")
          .insert({
            name: trimmedName,
            slug: trimmedSlug,
            primary_color: primaryColor || "#FF4500",
            active,
            default_locale: defaultLocale ?? "en",
            api_enabled: anyApi,
            logo_url: logoUrl ?? null,
            logo_light_url: logoLightUrl ?? null,
            hero_image_url: heroUrl ?? null,
            api_config: apiConfigToDb(apisConfig),
            api_credentials: clientApiCredentialsToDb(apiCredentials ?? { ...EMPTY_CLIENT_API_CREDENTIALS }),
            crm_integration: clientCrmIntegrationToDb(crmIntegration ?? { ...EMPTY_CLIENT_CRM_INTEGRATION }),
            whatsapp_config: clientWhatsAppConfigToDb(whatsappConfig ?? { ...EMPTY_CLIENT_WHATSAPP_CONFIG }),
            dashboard_cards: clientDashboardCardsToDb(dashboardCards ?? { ...DEFAULT_CLIENT_DASHBOARD_CARDS }),
            enabled_modules:
              enabledModules && enabledModules.length > 0 ? enabledModules : null,
          })
          .select("*")
          .single();
        if (error) {
          console.error("[supabase] clients insert failed:", error.message);
          return { ok: false, error: error.message };
        }
        const client = clientFromRow((inserted as Record<string, unknown>) ?? {});
        setClients((prev) => [...prev, client].sort((a, b) => a.name.localeCompare(b.name)));

        const projectId = crypto.randomUUID();
        const welcomeName = `Welcome — ${trimmedName}`;
        const welcomeProject: Project = {
          id: projectId,
          name: welcomeName,
          column: "planning",
          owners: [],
          progress: 0,
          dueDate: null,
          status: "Planning",
          type: "Website",
          startDate: null,
          teamMembers: [],
          linkedInvoices: [],
          description: "",
          tasks: [],
          clientSlug: trimmedSlug,
        };
        setAllProjectsByColumn((prev) => ({
          ...prev,
          planning: [welcomeProject, ...prev.planning],
        }));
        void supabase
          .from("projects")
          .insert({
            id: projectId,
            name: welcomeName,
            type: "Website",
            status: "Planning",
            progress: 0,
            client_slug: trimmedSlug,
          })
          .then(({ error: projectError }) => {
            if (projectError) console.error("[supabase] welcome project insert failed:", projectError.message);
          });

        const onboardAction = `New client onboarded: ${trimmedName}`;
        void supabase.from("activity").insert({ action: onboardAction, user_name: currentUser.name }).then(({ error: actError }) => {
          if (actError) console.error("[supabase] client onboard activity failed:", actError.message);
        });
        setActivity((prev) => [
          {
            id: crypto.randomUUID(),
            action: onboardAction,
            actor: currentUser.name,
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 10));

        return { ok: true };
      },
      updateClient: async (id, updates) => {
        const dbPatch: Record<string, unknown> = {};
        if (updates.name !== undefined) dbPatch.name = updates.name.trim();
        if (updates.slug !== undefined) dbPatch.slug = updates.slug.trim().toLowerCase();
        if (updates.primaryColor !== undefined) dbPatch.primary_color = updates.primaryColor;
        if (updates.active !== undefined) dbPatch.active = updates.active;
        if (updates.logoUrl !== undefined) dbPatch.logo_url = updates.logoUrl;
        if (updates.logoLightUrl !== undefined) dbPatch.logo_light_url = updates.logoLightUrl;
        if (updates.heroImageUrl !== undefined) dbPatch.hero_image_url = updates.heroImageUrl;
        if (updates.apis !== undefined) {
          dbPatch.api_config = apiConfigToDb(updates.apis);
          dbPatch.api_enabled = apisConfigHasAnyEnabled(updates.apis);
        }
        if (updates.apiCredentials !== undefined) {
          dbPatch.api_credentials = clientApiCredentialsToDb(updates.apiCredentials);
        }
        if (updates.crmIntegration !== undefined) {
          dbPatch.crm_integration = clientCrmIntegrationToDb(updates.crmIntegration);
        }
        if (updates.whatsappConfig !== undefined) {
          dbPatch.whatsapp_config = clientWhatsAppConfigToDb(updates.whatsappConfig);
        }
        if (updates.dashboardCards !== undefined) {
          dbPatch.dashboard_cards = clientDashboardCardsToDb(updates.dashboardCards);
        }
        if (updates.defaultLocale !== undefined) {
          dbPatch.default_locale = updates.defaultLocale;
        }
        if (updates.enabledModules !== undefined) {
          dbPatch.enabled_modules =
            updates.enabledModules && updates.enabledModules.length > 0 ? updates.enabledModules : null;
        }
        if (Object.keys(dbPatch).length === 0) return { ok: true };
        const { data, error } = await supabase.from("clients").update(dbPatch).eq("id", id).select("*").single();
        if (error) {
          console.error("[supabase] clients update failed:", error.message);
          if (error.message.includes("dashboard_cards")) {
            return {
              ok: false,
              error:
                "Client dashboard cards migration required. Run supabase/client-dashboard-cards.sql in Supabase SQL Editor.",
            };
          }
          return { ok: false, error: error.message };
        }
        if (data) {
          const next = clientFromRow(data as Record<string, unknown>);
          setClients((prev) => prev.map((c) => (c.id === id ? next : c)).sort((a, b) => a.name.localeCompare(b.name)));
        }
        return { ok: true };
      },
      addProject: ({ name, type, owner, startDate, endDate, description, column }) => {
        const id = crypto.randomUUID();
        const projectClientSlug = isAgencyCompany(currentUser.company)
          ? projectsClientFilter !== "all"
            ? projectsClientFilter
            : null
          : effectiveUserClientSlug(currentUser);
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
          clientSlug: projectClientSlug,
        };
        setAllProjectsByColumn((prev) => ({
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
            client_slug: projectClientSlug,
          })
          .then(({ error }) => {
            if (error) console.error("[supabase] project insert failed:", error.message);
          });
        registerActivity(`New project created: ${name}`);
      },
      updateBoardProjectTask: (projectId, taskId, updates) => {
        const cols: KanbanColumnId[] = ["planning", "in_progress", "paused", "done", "cancelled"];
        let prevTask: ProjectTaskRow | undefined;
        outer: for (const col of cols) {
          for (const p of allProjectsByColumn[col]) {
            if (p.id === projectId) {
              prevTask = p.tasks.find((t) => t.id === taskId);
              break outer;
            }
          }
        }
        const nextOwner = updates.owner !== undefined ? updates.owner : (prevTask?.owner ?? "");
        const prevOwner = prevTask?.owner ?? "";
        const taskTitle = updates.name !== undefined ? updates.name : (prevTask?.name ?? "");
        if (
          currentUser.name &&
          taskTitle &&
          nextOwner.trim() === currentUser.name.trim() &&
          prevOwner.trim() !== nextOwner.trim()
        ) {
          pushNotification(`You were assigned to task: ${taskTitle}`, "task");
        }
        setAllProjectsByColumn((prev) => {
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

        const needsAttachmentSync =
          updates.isFeatured === true &&
          (!updates.attachments || updates.attachments.length === 0) &&
          !(prevTask?.attachments?.length);
        if (needsAttachmentSync) {
          void supabase
            .from("task_attachments")
            .select("*")
            .eq("task_id", taskId)
            .then(({ data, error }) => {
              if (error || !data?.length) return;
              const byTask = groupTaskAttachmentsByTaskId((data as Record<string, unknown>[]) ?? []);
              const attachments = byTask.get(taskId);
              if (!attachments?.length) return;
              setAllProjectsByColumn((prev) => {
                const mapProject = (p: Project): Project => {
                  if (p.id !== projectId) return p;
                  return {
                    ...p,
                    tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, attachments } : t)),
                  };
                };
                return {
                  planning: prev.planning.map(mapProject),
                  in_progress: prev.in_progress.map(mapProject),
                  paused: prev.paused.map(mapProject),
                  done: prev.done.map(mapProject),
                  cancelled: prev.cancelled.map(mapProject),
                };
              });
            });
        }
      },
      deleteBoardProject: (projectId) => {
        let deletedName = "";
        setAllProjectsByColumn((prev) => {
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
        setAllProjectsByColumn((prev) => {
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
        if (currentUser.name && task.owner.trim() === currentUser.name.trim()) {
          pushNotification(`You were assigned to task: ${task.name}`, "task");
        }
        setAllProjectsByColumn((prev) => {
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
        setAllProjectsByColumn((prev) => {
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
      updateBoardProject: (projectId, patch) => {
        const cols: KanbanColumnId[] = ["planning", "in_progress", "paused", "done", "cancelled"];
        setAllProjectsByColumn((prev) => {
          let sourceCol: KanbanColumnId | null = null;
          let sourceIdx = -1;
          let base: Project | null = null;
          for (const col of cols) {
            const i = prev[col].findIndex((p) => p.id === projectId);
            if (i !== -1) {
              sourceCol = col;
              sourceIdx = i;
              base = prev[col][i];
              break;
            }
          }
          if (!base || sourceCol === null) return prev;

          let nextProject: Project = { ...base };
          if (patch.name !== undefined) {
            nextProject = { ...nextProject, name: patch.name };
          }
          if (patch.owners !== undefined) {
            nextProject = { ...nextProject, owners: [...patch.owners], teamMembers: [...patch.owners] };
          }
          if (patch.dueDate !== undefined) {
            nextProject = { ...nextProject, dueDate: patch.dueDate };
          }
          if (patch.startDate !== undefined) {
            nextProject = { ...nextProject, startDate: patch.startDate };
          }
          if (patch.type !== undefined) {
            nextProject = { ...nextProject, type: patch.type };
          }
          if (patch.description !== undefined) {
            nextProject = { ...nextProject, description: patch.description };
          }
          if (patch.status !== undefined) {
            const destCol = STATUS_TO_COLUMN[patch.status];
            nextProject = { ...nextProject, status: patch.status, column: destCol };
          }

          const destCol = nextProject.column;
          if (destCol !== sourceCol) {
            const next: ProjectsByColumn = {
              planning: [...prev.planning],
              in_progress: [...prev.in_progress],
              paused: [...prev.paused],
              done: [...prev.done],
              cancelled: [...prev.cancelled],
            };
            next[sourceCol].splice(sourceIdx, 1);
            next[destCol].unshift(nextProject);
            return next;
          }
          return {
            ...prev,
            [sourceCol]: prev[sourceCol].map((p, i) => (i === sourceIdx ? nextProject : p)),
          };
        });

        const dbPayload: Record<string, unknown> = {};
        if (patch.name !== undefined) dbPayload.name = patch.name;
        if (patch.status !== undefined) dbPayload.status = patch.status;
        if (patch.owners !== undefined) {
          const joined = patch.owners.join(",");
          dbPayload.owner = joined;
          dbPayload.owners = joined;
        }
        if (patch.dueDate !== undefined) dbPayload.end_date = patch.dueDate;
        if (patch.startDate !== undefined) dbPayload.start_date = patch.startDate;
        if (patch.type !== undefined) dbPayload.type = patch.type;
        if (patch.description !== undefined) dbPayload.description = patch.description;
        if (Object.keys(dbPayload).length === 0) return;
        void supabase
          .from("projects")
          .update(dbPayload)
          .eq("id", projectId)
          .then(({ error }) => {
            if (error) console.error("[supabase] project fields update failed:", error.message);
          });
      },
    }),
    [
      language,
      setLanguage,
      saveLocalePreference,
      saveHeroClocks,
      tLine,
      currentUser,
      localeSessionOverride,
      activeClient?.defaultLocale,
      viewingAllClients,
      sessionUserId,
      users,
      mentionableUsers,
      mentionOptions,
      appUsersReady,
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
      pushNotification,
      notifyProjectComment,
      logTaskReviewActivity,
      logTaskPublishedToActivity,
      query,
      projectsByColumn,
      allProjectsByColumn,
      projectsLoading,
      projectsClientFilter,
      clients,
      clientsLoading,
      fetchClients,
      clientApis,
      clientApisEnabled,
      heroImageUrl,
      dataClientSlug,
      setProfileAvatarUrl,
      mentionableUsers,
      mentionOptions,
    ],
  );

  return (
    <AppContext.Provider value={value}>
      <DocumentHead />
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useAppContext must be used within AppProviders");
  }

  return context;
}
