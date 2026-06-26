export type Role = "admin" | "manager" | "contributor" | "client";

/** Agency team or client slug (e.g. nexa, otus, rocketride, grupo-elo). */
export type UserCompany = "nexa" | "otus" | "rocketride" | (string & {});

export type ModuleKey =
  | "dashboard"
  | "projects"
  | "financial"
  | "updates"
  | "marketing"
  | "publishing"
  | "content-management"
  | "calendar"
  | "crm"
  | "files"
  | "contracts";

export type ApprovalStatus = "draft" | "pending" | "approved" | "rejected";
export type TaskStatus = "backlog" | "in_progress" | "in_review" | "completed";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignee: string;
  dueDate: string;
  tags: Array<"Social" | "Google Ads" | "Meta Ads">;
  files: string[];
  comments: TaskComment[];
  approval: ApprovalStatus;
  linkedEventIds: string[];
}

export interface TaskComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  unit: string;
  status: "on_track" | "at_risk" | "off_track";
}

export interface EventItem {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  type: "content" | "campaign" | "meeting" | "external";
  assignedUsers: string[];
  linkedTaskIds: string[];
  status: "planned" | "confirmed" | "done";
  tags: string[];
}

export interface FileItem {
  id: string;
  name: string;
  category: "Creatives" | "Videos" | "Reports";
  description: string;
  status: "draft" | "approved" | "archived";
  uploadedAt: string;
  assignee: string;
  tags: string[];
  attachedToTask?: string;
}

export interface ContractItem {
  id: string;
  name: string;
  uploadDate: string;
  status: "active" | "draft" | "expired";
  fileUrl: string;
  fileSizeBytes: number;
  pageCount?: number;
}

export interface InvoiceItem {
  id: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  dueDate: string;
  fileName: string;
  description: string;
}

export interface ActivityLogItem {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  message: string;
  type: "task" | "comment" | "file" | "invoice" | "event";
  read: boolean;
}

export const CLIENT_API_KEYS = [
  "metaAds",
  "metaCampaigns",
  "metaMonthlySpend",
  "metaCreatives",
  "instagramFeed",
  "instagramInsights",
  "instagramMonthly",
  "ga4",
] as const;

export type ClientApiKey = (typeof CLIENT_API_KEYS)[number];

export type ClientApisConfig = Record<ClientApiKey, boolean>;

/** Stored in `clients.api_credentials` (per-client tokens / account IDs). */
export type ClientApiCredentials = {
  metaAccessToken: string;
  metaAdAccountId: string;
  metaInstagramId: string;
  ga4PropertyId: string;
};

export type CrmIntegrationProvider = "nexa" | "webhook" | "hubspot" | "pipedrive" | "rdstation";

/** Stored in `clients.crm_integration` — website form → external CRM. */
export type ClientCrmIntegration = {
  enabled: boolean;
  provider: CrmIntegrationProvider;
  ingestSecret: string;
  allowedOrigins: string[];
  webhookUrl: string;
  hubspotAccessToken: string;
  hubspotPipelineId: string;
  hubspotDealStageId: string;
  pipedriveApiToken: string;
  pipedrivePipelineId: string;
  pipedriveStageId: string;
  rdStationToken: string;
  rdStationConversionIdentifier: string;
  /** CRM funnel slug for website form leads (e.g. site, sales). */
  defaultFunnelSlug: string;
  /** Default lead source when the form does not send one (e.g. Site, Website). */
  defaultSource: string;
  /** When true, also insert a row in crm_leads for agency audit. */
  mirrorToInternalCrm: boolean;
  /** When false, hides the Resumes funnel and "mark as resume" for this client. */
  resumesEnabled: boolean;
};

/** Stored in `clients.whatsapp_config` — floating chat widget → WhatsApp group. */
export type ClientWhatsAppConfig = {
  enabled: boolean;
  groupInviteUrl: string;
  displayName: string;
  subtitle: string;
  greeting: string;
  includeUserName: boolean;
};

export type AppLanguage = "en" | "pt-BR";

export interface Client {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  heroImageUrl: string | null;
  primaryColor: string;
  active: boolean;
  /** Default UI locale for this client (matrix language). */
  defaultLocale: AppLanguage;
  /** Legacy master flag; kept in sync when any integration is enabled. */
  apiEnabled: boolean;
  apis: ClientApisConfig;
  apiCredentials: ClientApiCredentials;
  crmIntegration: ClientCrmIntegration;
  whatsappConfig: ClientWhatsAppConfig;
  /** When set, client admins may assign only these modules to users in this account. */
  enabledModules: ModuleKey[] | null;
  createdAt: string;
}

export interface AppUser {
  id: string;
  name: string;
  email?: string | null;
  role: Role;
  modules: ModuleKey[];
  company: UserCompany;
  clientSlug: string | null;
  /** When set, overrides client matrix locale until session toggle. */
  localePreference: AppLanguage | null;
  avatarUrl: string | null;
}

export interface IdeaItem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  status: "new" | "validated" | "converted";
  assignee: string;
  tags: string[];
}

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  status: "planned" | "in_progress" | "done";
  assignee: string;
  tags: string[];
}

export interface EmbedConfig {
  title: string;
  url: string;
}
