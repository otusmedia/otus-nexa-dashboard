export type GhlContact = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  source?: string;
  tags?: string[];
  assignedTo?: string;
  dateAdded?: string;
  type?: string;
  city?: string;
  state?: string;
  country?: string;
};

export type GhlOpportunity = {
  id: string;
  name: string;
  monetaryValue?: number;
  status?: string;
  pipelineId?: string;
  pipelineStageId?: string;
  contactId?: string;
  contact?: GhlContact;
  assignedTo?: string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
  customFields?: unknown[];
  attributions?: unknown[];
};

export type GhlPipelineStage = {
  id: string;
  name: string;
};

export type GhlPipeline = {
  id: string;
  name: string;
  stages: GhlPipelineStage[];
};

export type GhlImportConfig = {
  token: string;
  locationId: string;
  clientSlug: string;
  pipelineId?: string;
  /** GHL stage id → Nexa CRM lead status */
  stageMap?: Record<string, string>;
  dryRun?: boolean;
  /** Import standalone contacts (can be slow for large lists). Default true. */
  importContacts?: boolean;
};

export type GhlImportResult = {
  ok: boolean;
  clientSlug: string;
  dryRun: boolean;
  pipelines: number;
  contactsFetched: number;
  contactsInserted: number;
  contactsUpdated: number;
  contactsSkipped: number;
  opportunitiesFetched: number;
  leadsInserted: number;
  leadsUpdated: number;
  leadsSkipped: number;
  errors: string[];
};
