import { forwardToHubSpot } from "@/lib/server/crm-forwarders/hubspot";
import { forwardToNexa } from "@/lib/server/crm-forwarders/nexa";
import { forwardToPipedrive } from "@/lib/server/crm-forwarders/pipedrive";
import { forwardToRdStation } from "@/lib/server/crm-forwarders/rdstation";
import type { CrmForwarder } from "@/lib/server/crm-forwarders/types";
import { forwardToWebhook } from "@/lib/server/crm-forwarders/webhook";
import type { CrmIntegrationProvider } from "@/types";

const forwarders: Record<CrmIntegrationProvider, CrmForwarder> = {
  nexa: forwardToNexa,
  webhook: forwardToWebhook,
  hubspot: forwardToHubSpot,
  pipedrive: forwardToPipedrive,
  rdstation: forwardToRdStation,
};

export function getCrmForwarder(provider: CrmIntegrationProvider): CrmForwarder {
  return forwarders[provider] ?? forwardToNexa;
}

export type { ForwardContext, ForwardResult, NormalizedLeadPayload } from "@/lib/server/crm-forwarders/types";
