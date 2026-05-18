import type { ClientCrmIntegration } from "@/types";

export type NormalizedLeadPayload = {
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  source: string;
  custom: Record<string, unknown>;
};

export type ForwardContext = {
  clientSlug: string;
  origin: string | null;
  receivedAt: string;
  integration: ClientCrmIntegration;
};

export type ForwardResult = {
  ok: boolean;
  externalId?: string;
  error?: string;
};

export type CrmForwarder = (
  payload: NormalizedLeadPayload,
  ctx: ForwardContext,
) => Promise<ForwardResult>;
