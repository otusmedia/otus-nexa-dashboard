import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { NormalizedLeadPayload } from "@/lib/server/crm-forwarders/types";

function buildDescription(payload: NormalizedLeadPayload): string {
  return [payload.message, Object.keys(payload.custom).length ? JSON.stringify(payload.custom) : ""]
    .filter(Boolean)
    .join("\n\n");
}

async function ensureContactFromWebsiteLead(opts: {
  clientSlug: string;
  payload: NormalizedLeadPayload;
  description: string;
  leadId?: string;
}): Promise<void> {
  const { clientSlug, payload, description, leadId } = opts;
  const supabase = getSupabaseAdmin();
  const email = payload.email.trim();
  const notes = [
    "Auto-created from website form.",
    leadId ? `Lead ID: ${leadId}` : "",
    description,
  ]
    .filter(Boolean)
    .join("\n\n");

  const contactRow = {
    name: payload.name,
    company: payload.company || null,
    email: email || null,
    phone: payload.phone || null,
    role: null,
    source: payload.source || "Website",
    notes,
    client_slug: clientSlug,
  };

  if (email) {
    const { data: existing } = await supabase
      .from("crm_contacts")
      .select("id")
      .eq("client_slug", clientSlug)
      .ilike("email", email)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase.from("crm_contacts").update(contactRow).eq("id", existing.id);
      if (error) console.error("[crm-submit] update crm_contacts failed:", error.message);
      return;
    }
  }

  const { error } = await supabase.from("crm_contacts").insert(contactRow);
  if (error) console.error("[crm-submit] insert crm_contacts failed:", error.message);
}

export async function mirrorLeadToInternalCrm(opts: {
  clientSlug: string;
  payload: NormalizedLeadPayload;
  externalId?: string;
}): Promise<{ ok: boolean; leadId?: string; error?: string }> {
  const { clientSlug, payload, externalId } = opts;
  const supabase = getSupabaseAdmin();
  const description = buildDescription(payload);

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
  await ensureContactFromWebsiteLead({ clientSlug, payload, description, leadId });
  return { ok: true, leadId };
}

/** Backfill contact for an existing website lead (e.g. Matheus Canci before this fix). */
export async function ensureContactForExistingLead(leadId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabaseAdmin();
  const { data: lead, error } = await supabase.from("crm_leads").select("*").eq("id", leadId).maybeSingle();
  if (error || !lead) return { ok: false, error: error?.message ?? "Lead not found" };

  const row = lead as Record<string, unknown>;
  const clientSlug = String(row.client_slug ?? "").trim();
  if (!clientSlug) return { ok: false, error: "Lead has no client_slug" };

  const formPayload = row.form_payload as NormalizedLeadPayload | null;
  const payload: NormalizedLeadPayload = formPayload ?? {
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    company: String(row.company ?? ""),
    message: String(row.description ?? ""),
    source: String(row.source ?? "Website"),
    custom: {},
  };

  await ensureContactFromWebsiteLead({
    clientSlug,
    payload,
    description: String(row.description ?? ""),
    leadId,
  });
  return { ok: true };
}
