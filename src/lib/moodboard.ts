import { supabase } from "@/lib/supabase";

export const DEFAULT_MOODBOARD_SUBTITLE = "MoodBoard & Direção Visual";

export type MoodboardLocal = {
  id: string;
  time: string;
  name: string;
  address: string;
  meta: string;
};

export type MoodboardPageContent = {
  logoUrl: string | null;
  title: string;
  subtitle: string;
  dateLabel: string;
  locais: MoodboardLocal[];
};

export type MoodboardItemContent = {
  id: string;
  mediaUrl: string;
  width: number | null;
  height: number | null;
  sortOrder: number;
};

export type MoodboardSummary = {
  id: string;
  accountId: string;
  name: string;
  shareSlug: string;
  title: string;
  subtitle: string;
  publishedAt: string | null;
  updatedAt: string;
  itemCount: number;
};

export type MoodboardSiteData = {
  id: string;
  accountId: string;
  name: string;
  shareSlug: string;
  publicSlug: string | null;
  kind: string;
  publishedAt: string | null;
  page: MoodboardPageContent;
  items: MoodboardItemContent[];
};

export function formatMoodboardDateLabel(date = new Date(), locale = "pt-BR"): string {
  const weekday = date.toLocaleDateString(locale, { weekday: "long" });
  const day = date.getDate();
  const month = date.toLocaleDateString(locale, { month: "long" });
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${cap} · ${day} de ${month}`;
}

export function defaultMoodboardLocais(): MoodboardLocal[] {
  return [
    {
      id: crypto.randomUUID(),
      time: "08:00 – 11:00",
      name: "Casa Matheus Foletto",
      address: "",
      meta: "Manhã",
    },
    {
      id: crypto.randomUUID(),
      time: "13:00 – 15:00",
      name: "Casa Victor Hugo",
      address: "",
      meta: "Tarde",
    },
  ];
}

function slugify(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "moodboard";
}

async function uniqueShareSlug(seed: string): Promise<string> {
  const base = slugify(seed);
  for (let i = 0; i < 12; i++) {
    const candidate = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase
      .from("moodboards")
      .select("id")
      .ilike("share_slug", candidate)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return candidate;
  }
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

function parseLocais(raw: unknown): MoodboardLocal[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id ?? crypto.randomUUID()),
        time: String(r.time ?? "").trim(),
        name: String(r.name ?? "").trim(),
        address: String(r.address ?? "").trim(),
        meta: String(r.meta ?? "").trim(),
      };
    })
    .filter((x): x is MoodboardLocal => Boolean(x && (x.name || x.time)));
}

function pageFromRow(row: Record<string, unknown>, version: "draft" | "live"): MoodboardPageContent {
  const p = version === "draft" ? "draft" : "live";
  return {
    logoUrl:
      row[`${p}_logo_url`] != null && String(row[`${p}_logo_url`]).trim()
        ? String(row[`${p}_logo_url`]).trim()
        : null,
    title: String(row[`${p}_title`] ?? "").trim(),
    subtitle: String(row[`${p}_subtitle`] ?? "").trim(),
    dateLabel: String(row[`${p}_date_label`] ?? "").trim(),
    locais: parseLocais(row[`${p}_locais`]),
  };
}

function itemFromRow(
  row: Record<string, unknown>,
  version: "draft" | "live",
): MoodboardItemContent | null {
  if (version === "live" && row.in_live !== true) return null;
  const p = version === "draft" ? "draft" : "live";
  const mediaUrl = String(row[`${p}_media_url`] ?? "").trim();
  if (!mediaUrl && version === "live") return null;
  const widthRaw = row[`${p}_width`];
  const heightRaw = row[`${p}_height`];
  return {
    id: String(row.id),
    mediaUrl,
    width: widthRaw != null && Number(widthRaw) > 0 ? Number(widthRaw) : null,
    height: heightRaw != null && Number(heightRaw) > 0 ? Number(heightRaw) : null,
    sortOrder: Number(row[`${p}_sort_order`] ?? 0) || 0,
  };
}

function summaryFromRow(
  row: Record<string, unknown>,
  itemCount: number,
): MoodboardSummary {
  return {
    id: String(row.id),
    accountId: String(row.account_id),
    name: String(row.name ?? "Moodboard").trim() || "Moodboard",
    shareSlug: String(row.share_slug ?? "").trim(),
    title: String(row.draft_title ?? "").trim(),
    subtitle: String(row.draft_subtitle ?? "").trim(),
    publishedAt: row.published_at != null ? String(row.published_at) : null,
    updatedAt: String(row.updated_at ?? row.created_at ?? ""),
    itemCount,
  };
}

export async function listMoodboards(accountId: string): Promise<MoodboardSummary[]> {
  const { data, error } = await supabase
    .from("moodboards")
    .select("*")
    .eq("account_id", accountId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  if (!rows.length) return [];

  const ids = rows.map((r) => String(r.id));
  const { data: itemRows, error: itemsErr } = await supabase
    .from("moodboard_items")
    .select("moodboard_id")
    .in("moodboard_id", ids);
  if (itemsErr) throw new Error(itemsErr.message);

  const counts = new Map<string, number>();
  for (const row of (itemRows as Array<Record<string, unknown>> | null) ?? []) {
    const id = String(row.moodboard_id ?? "");
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return rows.map((row) => summaryFromRow(row, counts.get(String(row.id)) ?? 0));
}

export async function createMoodboardFromTemplate(
  accountId: string,
  input?: { name?: string; title?: string },
): Promise<MoodboardSummary> {
  const title = (input?.title ?? input?.name ?? "Novo Moodboard").trim() || "Novo Moodboard";
  const name = (input?.name ?? title).trim() || title;
  const shareSlug = await uniqueShareSlug(name);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("moodboards")
    .insert({
      account_id: accountId,
      name,
      share_slug: shareSlug,
      draft_title: title,
      draft_subtitle: DEFAULT_MOODBOARD_SUBTITLE,
      draft_date_label: formatMoodboardDateLabel(),
      draft_locais: defaultMoodboardLocais(),
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return summaryFromRow(data as Record<string, unknown>, 0);
}

export async function loadMoodboardSite(
  moodboardId: string,
  version: "draft" | "live",
): Promise<MoodboardSiteData> {
  const { data: board, error: boardErr } = await supabase
    .from("moodboards")
    .select("*")
    .eq("id", moodboardId)
    .maybeSingle();
  if (boardErr) throw new Error(boardErr.message);
  if (!board) throw new Error("Moodboard not found");

  const accountId = String((board as Record<string, unknown>).account_id);

  const { data: account, error: accErr } = await supabase
    .from("accounts")
    .select("id, kind, public_slug")
    .eq("id", accountId)
    .maybeSingle();
  if (accErr) throw new Error(accErr.message);
  if (!account) throw new Error("Account not found");

  const { data: itemRows, error: itemsErr } = await supabase
    .from("moodboard_items")
    .select("*")
    .eq("moodboard_id", moodboardId)
    .order(version === "draft" ? "draft_sort_order" : "live_sort_order", { ascending: true });
  if (itemsErr) throw new Error(itemsErr.message);

  const items = ((itemRows as Array<Record<string, unknown>> | null) ?? [])
    .map((row) => itemFromRow(row, version))
    .filter((x): x is MoodboardItemContent => Boolean(x && x.id && (version === "draft" || x.mediaUrl)))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const row = board as Record<string, unknown>;
  return {
    id: String(row.id),
    accountId,
    name: String(row.name ?? "Moodboard").trim() || "Moodboard",
    shareSlug: String(row.share_slug ?? "").trim(),
    publicSlug:
      account.public_slug != null && String(account.public_slug).trim()
        ? String(account.public_slug).trim()
        : null,
    kind: String(account.kind ?? ""),
    publishedAt: row.published_at != null ? String(row.published_at) : null,
    page: pageFromRow(row, version),
    items,
  };
}

export async function loadPublicMoodboardByShareSlug(
  shareSlug: string,
): Promise<MoodboardSiteData | null> {
  const normalized = shareSlug.trim().toLowerCase();
  if (!normalized) return null;

  const { data, error } = await supabase
    .from("moodboards")
    .select("id")
    .ilike("share_slug", normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) return null;

  const site = await loadMoodboardSite(String(data.id), "live");
  if (!site.publishedAt) return site;
  return site;
}

export async function updateMoodboardPageDraft(
  moodboardId: string,
  patch: Partial<MoodboardPageContent> & { name?: string },
): Promise<void> {
  const db: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) db.name = patch.name;
  if (patch.logoUrl !== undefined) db.draft_logo_url = patch.logoUrl;
  if (patch.title !== undefined) db.draft_title = patch.title;
  if (patch.subtitle !== undefined) db.draft_subtitle = patch.subtitle;
  if (patch.dateLabel !== undefined) db.draft_date_label = patch.dateLabel;
  if (patch.locais !== undefined) db.draft_locais = patch.locais;

  const { error } = await supabase.from("moodboards").update(db).eq("id", moodboardId);
  if (error) throw new Error(error.message);
}

export async function upsertMoodboardItemDraft(
  accountId: string,
  moodboardId: string,
  input: {
    id?: string;
    mediaUrl: string;
    width?: number | null;
    height?: number | null;
    sortOrder?: number;
  },
): Promise<MoodboardItemContent> {
  const mediaUrl = input.mediaUrl.trim();
  if (!mediaUrl) throw new Error("Image URL is required.");

  if (input.id) {
    const patch: Record<string, unknown> = {
      draft_media_url: mediaUrl,
      updated_at: new Date().toISOString(),
    };
    if (input.width !== undefined) patch.draft_width = input.width;
    if (input.height !== undefined) patch.draft_height = input.height;
    if (input.sortOrder !== undefined) patch.draft_sort_order = input.sortOrder;

    const { data, error } = await supabase
      .from("moodboard_items")
      .update(patch)
      .eq("id", input.id)
      .eq("moodboard_id", moodboardId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const item = itemFromRow(data as Record<string, unknown>, "draft");
    if (!item) throw new Error("Failed to map item");
    return item;
  }

  const { data: existing } = await supabase
    .from("moodboard_items")
    .select("draft_sort_order")
    .eq("moodboard_id", moodboardId)
    .order("draft_sort_order", { ascending: false })
    .limit(1);
  const nextOrder = existing?.[0] ? Number(existing[0].draft_sort_order ?? 0) + 1 : 0;

  const { data, error } = await supabase
    .from("moodboard_items")
    .insert({
      account_id: accountId,
      moodboard_id: moodboardId,
      draft_media_url: mediaUrl,
      draft_width: input.width ?? null,
      draft_height: input.height ?? null,
      draft_sort_order: input.sortOrder ?? nextOrder,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await supabase
    .from("moodboards")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", moodboardId);

  const item = itemFromRow(data as Record<string, unknown>, "draft");
  if (!item) throw new Error("Failed to map item");
  return item;
}

export async function deleteMoodboardItemDraft(moodboardId: string, itemId: string): Promise<void> {
  const { error } = await supabase
    .from("moodboard_items")
    .delete()
    .eq("id", itemId)
    .eq("moodboard_id", moodboardId);
  if (error) throw new Error(error.message);
}

export async function deleteMoodboard(moodboardId: string): Promise<void> {
  const { error } = await supabase.from("moodboards").delete().eq("id", moodboardId);
  if (error) throw new Error(error.message);
}

/** Copy draft → live. Visitors only ever see live. */
export async function publishMoodboard(moodboardId: string): Promise<void> {
  const { data: pageRow, error: readErr } = await supabase
    .from("moodboards")
    .select("*")
    .eq("id", moodboardId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!pageRow) throw new Error("Moodboard not found");

  const now = new Date().toISOString();
  const r = pageRow as Record<string, unknown>;

  const { error: pageErr } = await supabase
    .from("moodboards")
    .update({
      live_logo_url: r.draft_logo_url ?? null,
      live_title: r.draft_title ?? "",
      live_subtitle: r.draft_subtitle ?? DEFAULT_MOODBOARD_SUBTITLE,
      live_date_label: r.draft_date_label ?? "",
      live_locais: r.draft_locais ?? [],
      published_at: now,
      updated_at: now,
    })
    .eq("id", moodboardId);
  if (pageErr) throw new Error(pageErr.message);

  const { data: items, error: itemsErr } = await supabase
    .from("moodboard_items")
    .select("*")
    .eq("moodboard_id", moodboardId);
  if (itemsErr) throw new Error(itemsErr.message);

  for (const row of items ?? []) {
    const item = row as Record<string, unknown>;
    const { error } = await supabase
      .from("moodboard_items")
      .update({
        live_media_url: item.draft_media_url,
        live_width: item.draft_width,
        live_height: item.draft_height,
        live_sort_order: item.draft_sort_order,
        in_live: true,
        updated_at: now,
      })
      .eq("id", item.id)
      .eq("moodboard_id", moodboardId);
    if (error) throw new Error(error.message);
  }
}

export function moodboardPublicPath(shareSlug: string): string {
  return `/m/s/${encodeURIComponent(shareSlug)}`;
}
