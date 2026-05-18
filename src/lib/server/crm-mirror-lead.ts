import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { NormalizedLeadPayload } from "@/lib/server/crm-forwarders/types";

export async function mirrorLeadToInternalCrm(opts: {
  clientSlug: string;
  payload: NormalizedLeadPayload;
  externalId?: string;
}): Promise<{ ok: boolean; leadId?: string; error?: string }> {
  const { clientSlug, payload, externalId } = opts;
  const supabase = getSupabaseAdmin();
  const description = [payload.message, Object.keys(payload.custom).length ? JSON.stringify(payload.custom) : ""]
    .filter(Boolean)
    .join("\n\n");

  const { data, error } = await supabase
    .from("crm_leads")
    .insert({
      name: payload.name,
      company: payload.company || null,
      email: payload.email,
      phone: payload.phone || null,
      source: payload.source || "Website",
      status: "New Lead",
      value: 0,
      description: description || null,
      client_slug: clientSlug,
      external_id: externalId ?? null,
      form_payload: { ...payload },
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[crm-submit] mirror to crm_leads failed:", error.message);
    return { ok: false, error: error.message };
  }

  const leadId = data?.id != null ? String(data.id) : undefined;
  return { ok: true, leadId };
}
