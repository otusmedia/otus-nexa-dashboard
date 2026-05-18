import type { CrmForwarder } from "@/lib/server/crm-forwarders/types";

export const forwardToRdStation: CrmForwarder = async (payload, ctx) => {
  const token = ctx.integration.rdStationToken.trim();
  const conversionId = ctx.integration.rdStationConversionIdentifier.trim();
  if (!token) {
    return { ok: false, error: "RD Station token is not configured." };
  }
  if (!conversionId) {
    return { ok: false, error: "RD Station conversion identifier is not configured." };
  }

  const body = {
    event_type: "CONVERSION",
    event_family: "CDP",
    payload: {
      conversion_identifier: conversionId,
      name: payload.name,
      email: payload.email,
      personal_phone: payload.phone || undefined,
      company_name: payload.company || undefined,
      cf_message: payload.message || undefined,
      traffic_source: payload.source || "Website",
      ...Object.fromEntries(
        Object.entries(payload.custom).map(([k, v]) => [`cf_${k}`, v != null ? String(v) : ""]),
      ),
    },
  };

  const res = await fetch("https://api.rd.services/platform/conversions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `RD Station error (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}` };
  }

  let externalId: string | undefined;
  try {
    const json = (await res.json()) as { event_uuid?: string; uuid?: string };
    externalId = json.event_uuid ?? json.uuid;
  } catch {
    /* empty */
  }

  return { ok: true, externalId };
};
