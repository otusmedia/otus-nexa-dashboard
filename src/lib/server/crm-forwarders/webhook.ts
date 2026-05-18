import type { CrmForwarder } from "@/lib/server/crm-forwarders/types";

export const forwardToWebhook: CrmForwarder = async (payload, ctx) => {
  const url = ctx.integration.webhookUrl.trim();
  if (!url) {
    return { ok: false, error: "Webhook URL is not configured for this client." };
  }

  const body = {
    clientSlug: ctx.clientSlug,
    receivedAt: ctx.receivedAt,
    origin: ctx.origin,
    lead: payload,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `Webhook returned ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}` };
  }

  let externalId: string | undefined;
  try {
    const json = (await res.json()) as { id?: string; externalId?: string };
    externalId = json.externalId ?? json.id;
  } catch {
    /* webhook may return empty body */
  }

  return { ok: true, externalId };
};
