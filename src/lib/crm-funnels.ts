import { slugFromClientName } from "@/lib/client-utils";
import { matchLeadStatusToFunnelStage } from "@/lib/crm-funnel-stage-match";
import { canViewAllCrmLeads } from "@/lib/crm-lead-visibility";
import {
  CRM_KANBAN_COLUMNS,
  CRM_RESUME_KANBAN_COLUMNS,
  CRM_RESUME_INITIAL_STATUS,
  type CrmLeadStatus,
} from "@/lib/crm-data";
import { crmLeadStatusLabel, crmResumeStatusLabel, crmT } from "@/lib/crm-i18n";
import type { AppLanguage } from "@/lib/locale-types";
import { supabase } from "@/lib/supabase";
import type { AppUser } from "@/types";

export const BUILTIN_SALES_SLUG = "sales";
export const BUILTIN_RESUME_SLUG = "resume";
export const RESERVED_FUNNEL_SLUGS = new Set([BUILTIN_SALES_SLUG, BUILTIN_RESUME_SLUG, "resumes"]);

export type CrmFunnelStageDef = {
  id: string;
  name: string;
  dotClass: string;
  sortOrder: number;
};

export type CrmFunnelDef = {
  id: string | null;
  slug: string;
  name: string;
  clientSlug: string;
  isBuiltin: boolean;
  sortOrder: number;
  stages: CrmFunnelStageDef[];
  accessUserIds: string[];
};

export const DEFAULT_CUSTOM_FUNNEL_STAGES: Array<{ name: string; dotClass: string }> = [
  { name: "Novo Lead", dotClass: "bg-blue-500" },
  { name: "Em Contato", dotClass: "bg-yellow-400" },
  { name: "Proposta Enviada", dotClass: "bg-purple-500" },
  { name: "Ganho", dotClass: "bg-emerald-500" },
];

export const STAGE_DOT_CLASSES = [
  "bg-blue-500",
  "bg-yellow-400",
  "bg-purple-500",
  "bg-green-500",
  "bg-orange-400",
  "bg-emerald-500",
  "bg-red-500",
  "bg-gray-500",
] as const;

export function funnelPipelinePath(slug: string): string {
  if (slug === BUILTIN_SALES_SLUG) return "/crm/pipeline";
  if (slug === BUILTIN_RESUME_SLUG) return "/crm/pipeline/resumes";
  return `/crm/pipeline/${slug}`;
}

export function isSalesFunnelSlug(slug: string): boolean {
  return slug.trim().toLowerCase() === BUILTIN_SALES_SLUG;
}

export function isResumeFunnelSlug(slug: string): boolean {
  return slug.trim().toLowerCase() === BUILTIN_RESUME_SLUG;
}

export function isBuiltinFunnelSlug(slug: string): boolean {
  const normalized = slug.trim().toLowerCase();
  return normalized === BUILTIN_SALES_SLUG || normalized === BUILTIN_RESUME_SLUG;
}

function builtinSalesFunnel(clientSlug: string): CrmFunnelDef {
  return {
    id: null,
    slug: BUILTIN_SALES_SLUG,
    name: "Sales",
    clientSlug,
    isBuiltin: true,
    sortOrder: 0,
    accessUserIds: [],
    stages: CRM_KANBAN_COLUMNS.map((col, index) => ({
      id: col.id,
      name: col.id,
      dotClass: col.dotClass,
      sortOrder: index,
    })),
  };
}

function builtinResumeFunnel(clientSlug: string): CrmFunnelDef {
  return {
    id: null,
    slug: BUILTIN_RESUME_SLUG,
    name: "Resumes",
    clientSlug,
    isBuiltin: true,
    sortOrder: 1,
    accessUserIds: [],
    stages: CRM_RESUME_KANBAN_COLUMNS.map((col, index) => ({
      id: col.id,
      name: col.id,
      dotClass: col.dotClass,
      sortOrder: index,
    })),
  };
}

export function funnelAccessibleToUser(funnel: CrmFunnelDef, user: AppUser): boolean {
  if (canViewAllCrmLeads(user)) return true;
  // No ACL → open to the client team (same as builtin Sales). Restricted funnels list users explicitly.
  if (!funnel.accessUserIds.length) return true;
  return funnel.accessUserIds.includes(user.id);
}

/** Custom funnel leads move to Sales when assigned to someone without funnel access. */
export function shouldTransferLeadToSalesFunnel(
  funnel: CrmFunnelDef | undefined,
  ownerUser: AppUser | null | undefined,
): boolean {
  if (!funnel || funnel.isBuiltin) return false;
  if (!ownerUser) return false;
  return !funnelAccessibleToUser(funnel, ownerUser);
}

export const SALES_FUNNEL_TRANSFER_STATUS = "New Lead" as const;

/** Localized funnel name for edit forms (built-in defaults are stored in English). */
export function funnelEditDisplayName(funnel: CrmFunnelDef, language: AppLanguage): string {
  if (funnel.name === "Sales") return crmT("Sales", language);
  if (funnel.name === "Resumes") return crmT("Resumes", language);
  return funnel.name;
}

/** Localized stage name for edit forms on built-in funnels. */
export function funnelStageEditDisplayName(
  funnel: CrmFunnelDef,
  stageName: string,
  language: AppLanguage,
): string {
  if (isSalesFunnelSlug(funnel.slug)) return crmLeadStatusLabel(stageName, language);
  if (isResumeFunnelSlug(funnel.slug)) return crmResumeStatusLabel(stageName, language);
  return stageName;
}

export function funnelEditFormState(
  funnel: CrmFunnelDef,
  language: AppLanguage,
): { name: string; stages: Array<{ name: string; dotClass: string }> } {
  return {
    name: funnelEditDisplayName(funnel, language),
    stages: funnel.stages.map((stage) => ({
      name: funnelStageEditDisplayName(funnel, stage.name, language),
      dotClass: stage.dotClass,
    })),
  };
}

function mapStageRow(row: Record<string, unknown>): CrmFunnelStageDef {
  return {
    id: String(row.id ?? row.name ?? ""),
    name: String(row.name ?? ""),
    dotClass: String(row.dot_class ?? "bg-blue-500"),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapFunnelRow(
  row: Record<string, unknown>,
  stages: CrmFunnelStageDef[],
  accessUserIds: string[],
): CrmFunnelDef {
  const slug = String(row.slug ?? "").trim().toLowerCase();
  return {
    id: String(row.id ?? ""),
    slug,
    name: String(row.name ?? ""),
    clientSlug: String(row.client_slug ?? ""),
    isBuiltin: isBuiltinFunnelSlug(slug),
    sortOrder: Number(row.sort_order ?? 100),
    stages,
    accessUserIds,
  };
}

function mergeBuiltinFunnel(defaultFunnel: CrmFunnelDef, dbFunnel: CrmFunnelDef | undefined): CrmFunnelDef {
  if (!dbFunnel) return defaultFunnel;
  return {
    ...dbFunnel,
    isBuiltin: true,
    sortOrder: defaultFunnel.sortOrder,
    stages: dbFunnel.stages.length ? dbFunnel.stages : defaultFunnel.stages,
  };
}

export async function fetchCrmFunnelsForClient(
  clientSlug: string | null | undefined,
  user: AppUser,
  options?: { resumesEnabled?: boolean },
): Promise<CrmFunnelDef[]> {
  const slug = (clientSlug ?? "").trim().toLowerCase();
  if (!slug) return [];

  const resumesEnabled = options?.resumesEnabled !== false;

  const salesDefault = builtinSalesFunnel(slug);
  const resumeDefault = builtinResumeFunnel(slug);

  const { data: funnelRows, error: funnelErr } = await supabase
    .from("crm_funnels")
    .select("*")
    .eq("client_slug", slug)
    .order("sort_order", { ascending: true });

  if (funnelErr) {
    console.error("[crm] fetch funnels", funnelErr.message);
    const builtIns = resumesEnabled ? [salesDefault, resumeDefault] : [salesDefault];
    return builtIns.filter((f) => funnelAccessibleToUser(f, user));
  }

  if (!funnelRows?.length) {
    const builtIns = resumesEnabled ? [salesDefault, resumeDefault] : [salesDefault];
    return builtIns.filter((f) => funnelAccessibleToUser(f, user));
  }

  const funnelIds = funnelRows.map((r) => String(r.id));

  const [{ data: stageRows }, { data: accessRows }] = await Promise.all([
    supabase
      .from("crm_funnel_stages")
      .select("*")
      .in("funnel_id", funnelIds)
      .order("sort_order", { ascending: true }),
    supabase.from("crm_funnel_access").select("funnel_id, user_id").in("funnel_id", funnelIds),
  ]);

  const stagesByFunnel = new Map<string, CrmFunnelStageDef[]>();
  for (const row of stageRows ?? []) {
    const fid = String(row.funnel_id ?? "");
    const list = stagesByFunnel.get(fid) ?? [];
    list.push(mapStageRow(row as Record<string, unknown>));
    stagesByFunnel.set(fid, list);
  }

  const accessByFunnel = new Map<string, string[]>();
  for (const row of accessRows ?? []) {
    const fid = String(row.funnel_id ?? "");
    const list = accessByFunnel.get(fid) ?? [];
    list.push(String(row.user_id ?? ""));
    accessByFunnel.set(fid, list);
  }

  const dbFunnels = funnelRows.map((row) => {
    const id = String(row.id ?? "");
    return mapFunnelRow(
      row as Record<string, unknown>,
      stagesByFunnel.get(id) ?? [],
      accessByFunnel.get(id) ?? [],
    );
  });

  const dbBySlug = new Map(dbFunnels.map((f) => [f.slug, f]));
  const sales = mergeBuiltinFunnel(salesDefault, dbBySlug.get(BUILTIN_SALES_SLUG));
  const resume = mergeBuiltinFunnel(resumeDefault, dbBySlug.get(BUILTIN_RESUME_SLUG));
  const custom = dbFunnels.filter((f) => !isBuiltinFunnelSlug(f.slug));

  const result = resumesEnabled ? [sales, resume, ...custom] : [sales, ...custom];
  return result.filter((f) => funnelAccessibleToUser(f, user));
}

export async function fetchCrmFunnelBySlug(
  clientSlug: string | null | undefined,
  funnelSlug: string,
  user: AppUser,
  options?: { resumesEnabled?: boolean },
): Promise<CrmFunnelDef | null> {
  const funnels = await fetchCrmFunnelsForClient(clientSlug, user, options);
  const normalized = funnelSlug.trim().toLowerCase();
  return funnels.find((f) => f.slug === normalized) ?? null;
}

export function normalizeFunnelStageStatus(
  status: string | null | undefined,
  stages: CrmFunnelStageDef[],
): string {
  if (!stages.length) return (status ?? "").trim() || "New Lead";
  return matchLeadStatusToFunnelStage(status, stages);
}

export function groupLeadsByFunnelStages(
  leads: Array<{ status: string }>,
  stages: CrmFunnelStageDef[],
): Record<string, typeof leads> {
  const fallback = stages[0]?.name ?? "New Lead";
  const buckets = Object.fromEntries(stages.map((s) => [s.name, [] as typeof leads])) as Record<
    string,
    typeof leads
  >;
  for (const lead of leads) {
    const st = normalizeFunnelStageStatus(lead.status, stages);
    if (!buckets[st]) buckets[st] = [];
    buckets[st].push(lead);
  }
  if (!buckets[fallback]) buckets[fallback] = [];
  return buckets;
}

export function funnelInitialStage(funnel: CrmFunnelDef): string {
  if (funnel.stages[0]?.name) return funnel.stages[0].name;
  if (isResumeFunnelSlug(funnel.slug)) return CRM_RESUME_INITIAL_STATUS;
  return "New Lead" as CrmLeadStatus;
}

export function nextStageDotClass(index: number): string {
  return STAGE_DOT_CLASSES[index % STAGE_DOT_CLASSES.length] ?? "bg-blue-500";
}

export type CreateCrmFunnelInput = {
  clientSlug: string;
  name: string;
  stages: Array<{ name: string; dotClass: string }>;
  accessUserIds: string[];
};

export async function createCrmFunnel(input: CreateCrmFunnelInput): Promise<CrmFunnelDef | null> {
  const clientSlug = input.clientSlug.trim().toLowerCase();
  const name = input.name.trim();
  if (!clientSlug || !name) return null;

  let slug = slugFromClientName(name);
  if (!slug || RESERVED_FUNNEL_SLUGS.has(slug)) slug = `${slug || "funnel"}-${Date.now()}`;

  const stages = input.stages
    .map((s) => ({ name: s.name.trim(), dotClass: s.dotClass.trim() || "bg-blue-500" }))
    .filter((s) => s.name);

  if (!stages.length) return null;

  const { data: maxRow } = await supabase
    .from("crm_funnels")
    .select("sort_order")
    .eq("client_slug", clientSlug)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = Number(maxRow?.sort_order ?? 1) + 1;

  const { data: funnelRow, error: funnelErr } = await supabase
    .from("crm_funnels")
    .insert({ client_slug: clientSlug, slug, name, sort_order: sortOrder })
    .select("*")
    .maybeSingle();

  if (funnelErr || !funnelRow) {
    console.error("[crm] create funnel", funnelErr?.message);
    return null;
  }

  const funnelId = String(funnelRow.id);

  const { error: stageErr } = await supabase.from("crm_funnel_stages").insert(
    stages.map((stage, index) => ({
      funnel_id: funnelId,
      name: stage.name,
      sort_order: index,
      dot_class: stage.dotClass,
    })),
  );

  if (stageErr) {
    console.error("[crm] create funnel stages", stageErr.message);
  }

  const accessIds = [...new Set(input.accessUserIds.map((id) => id.trim()).filter(Boolean))];
  if (accessIds.length) {
    const { error: accessErr } = await supabase.from("crm_funnel_access").insert(
      accessIds.map((userId) => ({ funnel_id: funnelId, user_id: userId })),
    );
    if (accessErr) console.error("[crm] create funnel access", accessErr.message);
  }

  return mapFunnelRow(
    funnelRow as Record<string, unknown>,
    stages.map((stage, index) => ({
      id: stage.name,
      name: stage.name,
      dotClass: stage.dotClass,
      sortOrder: index,
    })),
    accessIds,
  );
}

export function funnelStageDotClass(funnel: CrmFunnelDef, status: string): string {
  const match = funnel.stages.find((s) => s.name.toLowerCase() === status.trim().toLowerCase());
  return match?.dotClass ?? "bg-gray-500";
}

export type UpdateCrmFunnelInput = {
  name: string;
  stages: Array<{ name: string; dotClass: string }>;
  accessUserIds: string[];
};

async function ensureFunnelRecord(clientSlug: string, funnel: CrmFunnelDef): Promise<string | null> {
  if (funnel.id) return funnel.id;

  const slug = clientSlug.trim().toLowerCase();
  const funnelSlug = funnel.slug.trim().toLowerCase();
  if (!slug || !funnelSlug) return null;

  const { data: existing } = await supabase
    .from("crm_funnels")
    .select("id")
    .eq("client_slug", slug)
    .eq("slug", funnelSlug)
    .maybeSingle();

  if (existing?.id) return String(existing.id);

  const { data: funnelRow, error: funnelErr } = await supabase
    .from("crm_funnels")
    .insert({
      client_slug: slug,
      slug: funnelSlug,
      name: funnel.name,
      sort_order: funnel.sortOrder,
    })
    .select("*")
    .maybeSingle();

  if (funnelErr || !funnelRow) {
    console.error("[crm] ensure funnel record", funnelErr?.message);
    return null;
  }

  const funnelId = String(funnelRow.id);
  const stages =
    funnel.stages.length > 0
      ? funnel.stages
      : isResumeFunnelSlug(funnelSlug)
        ? builtinResumeFunnel(slug).stages
        : builtinSalesFunnel(slug).stages;

  const { error: stageErr } = await supabase.from("crm_funnel_stages").insert(
    stages.map((stage, index) => ({
      funnel_id: funnelId,
      name: stage.name,
      sort_order: index,
      dot_class: stage.dotClass,
    })),
  );
  if (stageErr) console.error("[crm] ensure funnel stages", stageErr.message);

  if (funnel.accessUserIds.length) {
    const { error: accessErr } = await supabase.from("crm_funnel_access").insert(
      funnel.accessUserIds.map((userId) => ({ funnel_id: funnelId, user_id: userId })),
    );
    if (accessErr) console.error("[crm] ensure funnel access", accessErr.message);
  }

  return funnelId;
}

export async function updateCrmFunnelDef(
  funnel: CrmFunnelDef,
  clientSlug: string,
  input: UpdateCrmFunnelInput,
): Promise<CrmFunnelDef | null> {
  const funnelId = await ensureFunnelRecord(clientSlug, funnel);
  if (!funnelId) return null;
  const updated = await updateCrmFunnel(funnelId, clientSlug, input);
  if (!updated) return null;
  return { ...updated, isBuiltin: funnel.isBuiltin };
}

export async function updateCrmFunnel(
  funnelId: string,
  clientSlug: string,
  input: UpdateCrmFunnelInput,
): Promise<CrmFunnelDef | null> {
  const slug = clientSlug.trim().toLowerCase();
  const name = input.name.trim();
  if (!funnelId || !slug || !name) return null;

  const { data: funnelRow, error: readErr } = await supabase
    .from("crm_funnels")
    .select("*")
    .eq("id", funnelId)
    .eq("client_slug", slug)
    .maybeSingle();

  if (readErr || !funnelRow) {
    console.error("[crm] update funnel read", readErr?.message);
    return null;
  }

  const funnelSlug = String(funnelRow.slug ?? "");

  const stages = input.stages
    .map((s) => ({ name: s.name.trim(), dotClass: s.dotClass.trim() || "bg-blue-500" }))
    .filter((s) => s.name);

  if (!stages.length) return null;

  const { data: oldStageRows } = await supabase
    .from("crm_funnel_stages")
    .select("name, sort_order")
    .eq("funnel_id", funnelId)
    .order("sort_order");

  const oldOrdered = (oldStageRows ?? [])
    .slice()
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
    .map((s) => String(s.name ?? ""));

  const newNamesLower = new Set(stages.map((s) => s.name.toLowerCase()));
  const fallbackStatus = stages[0]!.name;

  const renameByIndex = new Map<string, string>();
  for (let i = 0; i < oldOrdered.length; i++) {
    const oldName = oldOrdered[i];
    const newName = stages[i]?.name;
    if (!oldName || !newName) continue;
    if (oldName.toLowerCase() !== newName.toLowerCase()) {
      renameByIndex.set(oldName.toLowerCase(), newName);
    }
  }

  const { data: leads } = await supabase
    .from("crm_leads")
    .select("id, status")
    .eq("client_slug", slug)
    .eq("funnel", funnelSlug);

  for (const lead of leads ?? []) {
    let nextStatus = String(lead.status ?? "");
    const renamed = renameByIndex.get(nextStatus.toLowerCase());
    if (renamed) nextStatus = renamed;
    if (!newNamesLower.has(nextStatus.toLowerCase())) nextStatus = fallbackStatus;
    if (nextStatus === String(lead.status ?? "")) continue;
    await supabase
      .from("crm_leads")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", lead.id);
  }

  const { error: funnelErr } = await supabase.from("crm_funnels").update({ name }).eq("id", funnelId);
  if (funnelErr) {
    console.error("[crm] update funnel", funnelErr.message);
    return null;
  }

  await supabase.from("crm_funnel_stages").delete().eq("funnel_id", funnelId);

  const { error: stageErr } = await supabase.from("crm_funnel_stages").insert(
    stages.map((stage, index) => ({
      funnel_id: funnelId,
      name: stage.name,
      sort_order: index,
      dot_class: stage.dotClass,
    })),
  );

  if (stageErr) {
    console.error("[crm] update funnel stages", stageErr.message);
    return null;
  }

  await supabase.from("crm_funnel_access").delete().eq("funnel_id", funnelId);

  const accessIds = [...new Set(input.accessUserIds.map((id) => id.trim()).filter(Boolean))];
  if (accessIds.length) {
    const { error: accessErr } = await supabase.from("crm_funnel_access").insert(
      accessIds.map((userId) => ({ funnel_id: funnelId, user_id: userId })),
    );
    if (accessErr) console.error("[crm] update funnel access", accessErr.message);
  }

  return mapFunnelRow(
    { ...(funnelRow as Record<string, unknown>), name } as Record<string, unknown>,
    stages.map((stage, index) => ({
      id: stage.name,
      name: stage.name,
      dotClass: stage.dotClass,
      sortOrder: index,
    })),
    accessIds,
  );
}

export async function deleteCrmFunnel(
  funnelId: string,
  clientSlug: string,
): Promise<{ ok: boolean; error?: string }> {
  const slug = clientSlug.trim().toLowerCase();
  if (!funnelId || !slug) return { ok: false, error: "Invalid funnel." };

  const { data: funnelRow, error: readErr } = await supabase
    .from("crm_funnels")
    .select("slug")
    .eq("id", funnelId)
    .eq("client_slug", slug)
    .maybeSingle();

  if (readErr || !funnelRow) return { ok: false, error: readErr?.message ?? "Funnel not found." };

  const funnelSlug = String(funnelRow.slug ?? "");
  if (RESERVED_FUNNEL_SLUGS.has(funnelSlug)) {
    return { ok: false, error: "Built-in funnels cannot be deleted." };
  }

  const { error: moveErr } = await supabase
    .from("crm_leads")
    .update({ funnel: BUILTIN_SALES_SLUG, status: "New Lead", updated_at: new Date().toISOString() })
    .eq("client_slug", slug)
    .eq("funnel", funnelSlug);

  if (moveErr) {
    console.error("[crm] delete funnel move leads", moveErr.message);
    return { ok: false, error: moveErr.message };
  }

  const { error: delErr } = await supabase.from("crm_funnels").delete().eq("id", funnelId);
  if (delErr) {
    console.error("[crm] delete funnel", delErr.message);
    return { ok: false, error: delErr.message };
  }

  return { ok: true };
}
