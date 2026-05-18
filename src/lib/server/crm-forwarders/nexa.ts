import { mirrorLeadToInternalCrm } from "@/lib/server/crm-mirror-lead";
import type { CrmForwarder } from "@/lib/server/crm-forwarders/types";

/** Saves lead directly to Nexa CRM (crm_leads) for the client — no external middleware. */
export const forwardToNexa: CrmForwarder = async (payload, ctx) => {
  const result = await mirrorLeadToInternalCrm({
    clientSlug: ctx.clientSlug,
    payload,
  });

  if (!result.ok) {
    return { ok: false, error: result.error ?? "Could not save lead to Nexa CRM." };
  }

  return { ok: true, externalId: result.leadId };
};
