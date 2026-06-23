import { getCrmSourceOptions, mergeCrmSourceOptions } from "@/lib/crm-data";
import { supabase } from "@/lib/supabase";

export { mergeCrmSourceOptions };

export async function fetchCustomCrmSources(clientSlug: string | null | undefined): Promise<string[]> {
  const slug = (clientSlug ?? "").trim().toLowerCase();
  if (!slug) return [];

  const fromTable: string[] = [];
  const { data, error } = await supabase
    .from("crm_custom_sources")
    .select("source")
    .eq("client_slug", slug)
    .order("source", { ascending: true });

  if (!error && data) {
    for (const row of data) {
      const s = String(row.source ?? "").trim();
      if (s) fromTable.push(s);
    }
  }

  const { data: leadRows, error: leadErr } = await supabase
    .from("crm_leads")
    .select("source")
    .eq("client_slug", slug)
    .not("source", "is", null);

  const fromLeads: string[] = [];
  if (!leadErr && leadRows) {
    for (const row of leadRows) {
      const s = String(row.source ?? "").trim();
      if (s) fromLeads.push(s);
    }
  }

  return mergeCrmSourceOptions([], [...fromTable, ...fromLeads]);
}

export async function rememberCustomCrmSource(
  clientSlug: string | null | undefined,
  source: string,
): Promise<string[]> {
  const slug = (clientSlug ?? "").trim().toLowerCase();
  const trimmed = source.trim();
  if (!slug || !trimmed) return fetchCustomCrmSources(slug);

  const base = getCrmSourceOptions(slug);
  const existing = await fetchCustomCrmSources(slug);
  const merged = mergeCrmSourceOptions(base, existing);
  const alreadyKnown = merged.some((opt) => opt.toLowerCase() === trimmed.toLowerCase());
  if (alreadyKnown) return merged;

  const { error } = await supabase.from("crm_custom_sources").insert({
    client_slug: slug,
    source: trimmed,
  });

  if (error && !error.message.toLowerCase().includes("duplicate")) {
    console.error("[crm] remember custom source", error.message);
  }

  return mergeCrmSourceOptions(base, [...existing, trimmed]);
}
