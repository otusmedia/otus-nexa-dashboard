import { supabase } from "@/lib/supabase";
import { getPlanFeatures, type AccountPlan } from "@/lib/plans";
import type { AppUser } from "@/types";
import { effectiveUserClientSlug, isAgencyCompany } from "@/lib/client-utils";

export type AccountKind = "agency_client" | "filmmaker";

export type Account = {
  id: string;
  kind: AccountKind;
  name: string;
  publicSlug: string | null;
  plan: AccountPlan;
  storageUsedBytes: number;
  storageLimitBytes: number | null;
  videoMinutesUsed: number;
  videoMinutesLimit: number | null;
  brandPrimaryColor: string | null;
  brandLogoUrl: string | null;
  createdAt: string;
};

export function accountFromRow(row: Record<string, unknown>): Account {
  const kindRaw = String(row.kind ?? "agency_client");
  const kind: AccountKind = kindRaw === "filmmaker" ? "filmmaker" : "agency_client";
  const planRaw = String(row.plan ?? "free");
  const plan = (["free", "base", "pro", "complete", "agency"].includes(planRaw)
    ? planRaw
    : "free") as AccountPlan;

  return {
    id: String(row.id ?? ""),
    kind,
    name: String(row.name ?? ""),
    publicSlug:
      row.public_slug != null && String(row.public_slug).trim() !== ""
        ? String(row.public_slug).trim()
        : null,
    plan,
    storageUsedBytes: Number(row.storage_used_bytes ?? 0) || 0,
    storageLimitBytes:
      row.storage_limit_bytes == null || row.storage_limit_bytes === ""
        ? null
        : Number(row.storage_limit_bytes),
    videoMinutesUsed: Number(row.video_minutes_used ?? 0) || 0,
    videoMinutesLimit:
      row.video_minutes_limit == null || row.video_minutes_limit === ""
        ? null
        : Number(row.video_minutes_limit),
    brandPrimaryColor:
      row.brand_primary_color != null && String(row.brand_primary_color).trim() !== ""
        ? String(row.brand_primary_color)
        : null,
    brandLogoUrl:
      row.brand_logo_url != null && String(row.brand_logo_url).trim() !== ""
        ? String(row.brand_logo_url)
        : null,
    createdAt: String(row.created_at ?? ""),
  };
}

/** Public portfolio pages exist only for filmmaker accounts with a slug. */
export function canHavePublicPortfolio(account: Pick<Account, "kind" | "publicSlug">): boolean {
  return account.kind === "filmmaker" && Boolean(account.publicSlug?.trim());
}

export async function fetchAccountById(accountId: string): Promise<Account | null> {
  const { data, error } = await supabase.from("accounts").select("*").eq("id", accountId).maybeSingle();
  if (error) {
    console.error("[accounts] fetchById failed:", error.message);
    return null;
  }
  if (!data) return null;
  return accountFromRow(data as Record<string, unknown>);
}

export async function fetchAccountByClientSlug(clientSlug: string): Promise<Account | null> {
  const slug = clientSlug.trim();
  if (!slug) return null;
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("account_id")
    .eq("slug", slug)
    .maybeSingle();
  if (clientError) {
    console.error("[accounts] client lookup failed:", clientError.message);
    return null;
  }
  const accountId = client?.account_id != null ? String(client.account_id) : "";
  if (!accountId) return null;
  return fetchAccountById(accountId);
}

/**
 * Resolve the account for the current session.
 * Agency users: prefer `preferredClientSlug` (active filter); otherwise null (multi-client).
 * Client users: account linked to their client slug.
 * Filmmaker users: first membership in a filmmaker account.
 */
export async function resolveAccountForSession(
  user: AppUser,
  preferredClientSlug?: string | null,
): Promise<Account | null> {
  if (isAgencyCompany(user.company)) {
    const slug = preferredClientSlug?.trim() || null;
    if (!slug || slug === "all") return null;
    return fetchAccountByClientSlug(slug);
  }

  const clientSlug = effectiveUserClientSlug(user);
  if (clientSlug) {
    const fromClient = await fetchAccountByClientSlug(clientSlug);
    if (fromClient) return fromClient;
  }

  const { data: memberships, error } = await supabase
    .from("account_members")
    .select("account_id")
    .eq("user_id", user.id)
    .limit(20);
  if (error) {
    console.error("[accounts] membership lookup failed:", error.message);
    return null;
  }
  const ids = (memberships ?? [])
    .map((m) => (m.account_id != null ? String(m.account_id) : ""))
    .filter(Boolean);
  if (ids.length === 0) return null;

  const { data: accounts, error: accError } = await supabase
    .from("accounts")
    .select("*")
    .in("id", ids);
  if (accError) {
    console.error("[accounts] accounts by membership failed:", accError.message);
    return null;
  }
  const rows = (accounts as Array<Record<string, unknown>> | null) ?? [];
  const filmmaker = rows.find((r) => String(r.kind) === "filmmaker");
  const chosen = filmmaker ?? rows[0];
  return chosen ? accountFromRow(chosen) : null;
}

/** Load public portfolio account by slug — filmmaker only (DB CHECK + app filter). */
export async function fetchPublicFilmmakerAccountBySlug(slug: string): Promise<Account | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("kind", "filmmaker")
    .ilike("public_slug", normalized)
    .maybeSingle();
  if (error) {
    console.error("[accounts] public slug lookup failed:", error.message);
    return null;
  }
  if (!data) return null;
  const account = accountFromRow(data as Record<string, unknown>);
  if (!canHavePublicPortfolio(account)) return null;
  return account;
}

export function accountPlanFeatures(account: Pick<Account, "plan">) {
  return getPlanFeatures(account.plan);
}
