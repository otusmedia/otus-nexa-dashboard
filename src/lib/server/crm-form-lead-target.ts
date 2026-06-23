import { CRM_RESUME_INITIAL_STATUS } from "@/lib/crm-data";
import { BUILTIN_RESUME_SLUG, BUILTIN_SALES_SLUG } from "@/lib/crm-funnels";
import type { NormalizedLeadPayload } from "@/lib/server/crm-forwarders/types";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { ClientCrmIntegration } from "@/types";

export type FormLeadTarget = {
  funnel: string;
  status: string;
  source: string;
};

export async function resolveFormLeadTarget(
  clientSlug: string,
  integration: ClientCrmIntegration,
  payload: NormalizedLeadPayload,
): Promise<FormLeadTarget> {
  const slug = clientSlug.trim().toLowerCase();
  const funnelSlug = (
    payload.funnel?.trim() ||
    integration.defaultFunnelSlug?.trim() ||
    BUILTIN_SALES_SLUG
  ).toLowerCase();
  const source = payload.source?.trim() || integration.defaultSource?.trim() || "Website";

  if (funnelSlug === BUILTIN_RESUME_SLUG) {
    return { funnel: BUILTIN_RESUME_SLUG, status: CRM_RESUME_INITIAL_STATUS, source };
  }

  if (funnelSlug === BUILTIN_SALES_SLUG) {
    return { funnel: BUILTIN_SALES_SLUG, status: "New Lead", source };
  }

  const supabase = getSupabaseAdmin();
  const { data: funnelRow } = await supabase
    .from("crm_funnels")
    .select("id")
    .eq("client_slug", slug)
    .eq("slug", funnelSlug)
    .maybeSingle();

  if (funnelRow?.id) {
    const { data: stages } = await supabase
      .from("crm_funnel_stages")
      .select("name")
      .eq("funnel_id", funnelRow.id)
      .order("sort_order", { ascending: true })
      .limit(1);

    const status = stages?.[0]?.name ? String(stages[0].name) : "New Lead";
    return { funnel: funnelSlug, status, source };
  }

  return { funnel: BUILTIN_SALES_SLUG, status: "New Lead", source };
}
