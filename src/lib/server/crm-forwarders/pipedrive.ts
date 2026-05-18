import type { CrmForwarder } from "@/lib/server/crm-forwarders/types";

export const forwardToPipedrive: CrmForwarder = async (payload, ctx) => {
  const token = ctx.integration.pipedriveApiToken.trim();
  if (!token) {
    return { ok: false, error: "Pipedrive API token is not configured." };
  }

  const base = "https://api.pipedrive.com/v1";
  const personBody = new URLSearchParams();
  personBody.set("name", payload.name);
  if (payload.email) personBody.append("email", payload.email);
  if (payload.phone) personBody.append("phone", payload.phone);

  const personRes = await fetch(`${base}/persons?api_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: personBody.toString(),
    cache: "no-store",
  });

  const personJson = (await personRes.json().catch(() => ({}))) as {
    success?: boolean;
    data?: { id?: number };
    error?: string;
  };

  if (!personRes.ok || !personJson.success || !personJson.data?.id) {
    return {
      ok: false,
      error: personJson.error ?? `Pipedrive person error (${personRes.status})`,
    };
  }

  const personId = personJson.data.id;
  const pipelineId = ctx.integration.pipedrivePipelineId.trim();
  const stageId = ctx.integration.pipedriveStageId.trim();

  if (!pipelineId) {
    return { ok: true, externalId: String(personId) };
  }

  const dealBody = new URLSearchParams();
  dealBody.set("title", payload.company || payload.name || "Website lead");
  dealBody.set("person_id", String(personId));
  dealBody.set("pipeline_id", pipelineId);
  if (stageId) dealBody.set("stage_id", stageId);
  if (payload.message) dealBody.set("note", payload.message);

  const dealRes = await fetch(`${base}/deals?api_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: dealBody.toString(),
    cache: "no-store",
  });

  const dealJson = (await dealRes.json().catch(() => ({}))) as {
    success?: boolean;
    data?: { id?: number };
    error?: string;
  };

  if (!dealRes.ok || !dealJson.success) {
    return {
      ok: false,
      error: dealJson.error ?? `Pipedrive deal error (${dealRes.status})`,
    };
  }

  return { ok: true, externalId: dealJson.data?.id != null ? String(dealJson.data.id) : String(personId) };
};
