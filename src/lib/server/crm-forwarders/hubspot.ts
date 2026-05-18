import type { CrmForwarder } from "@/lib/server/crm-forwarders/types";

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: parts[0] || "Lead", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export const forwardToHubSpot: CrmForwarder = async (payload, ctx) => {
  const token = ctx.integration.hubspotAccessToken.trim();
  if (!token) {
    return { ok: false, error: "HubSpot access token is not configured." };
  }

  const { firstName, lastName } = splitName(payload.name);
  const contactProps: Record<string, string> = {
    firstname: firstName,
    lastname: lastName || "—",
    email: payload.email,
  };
  if (payload.phone) contactProps.phone = payload.phone;
  if (payload.company) contactProps.company = payload.company;

  const contactRes = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties: contactProps }),
    cache: "no-store",
  });

  const contactJson = (await contactRes.json().catch(() => ({}))) as {
    id?: string;
    message?: string;
    status?: string;
  };

  if (!contactRes.ok) {
    return {
      ok: false,
      error: contactJson.message ?? `HubSpot contact error (${contactRes.status})`,
    };
  }

  const contactId = contactJson.id;
  let dealId: string | undefined;

  const pipelineId = ctx.integration.hubspotPipelineId.trim();
  const stageId = ctx.integration.hubspotDealStageId.trim();
  if (pipelineId && stageId && contactId) {
    const dealProps: Record<string, string> = {
      dealname: payload.company || payload.name || "Website lead",
      pipeline: pipelineId,
      dealstage: stageId,
    };
    if (payload.message) dealProps.description = payload.message;

    const dealRes = await fetch("https://api.hubapi.com/crm/v3/objects/deals", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties: dealProps }),
      cache: "no-store",
    });

    const dealJson = (await dealRes.json().catch(() => ({}))) as { id?: string };
    if (dealRes.ok && dealJson.id) {
      dealId = dealJson.id;
      await fetch("https://api.hubapi.com/crm/v3/associations/deals/contacts/batch/create", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: [{ from: { id: dealId }, to: { id: contactId }, type: "deal_to_contact" }],
        }),
        cache: "no-store",
      }).catch(() => undefined);
    }
  }

  return { ok: true, externalId: dealId ?? contactId };
};
