import { supabase } from "@/lib/supabase";

export type PortfolioMediaType = "image" | "video";
export type PortfolioAspect = "portrait" | "landscape" | "square";

export type PortfolioNavItem = {
  id: string;
  label: string;
  anchor: string;
};

export type PortfolioHeroCta = {
  label: string;
  anchor: string;
};

export type PortfolioHeroStat = {
  id: string;
  value: string;
  label: string;
};

export type PortfolioHighlight = {
  id: string;
  title: string;
  description: string;
  coverMediaType: PortfolioMediaType | null;
  coverMediaUrl: string | null;
  /** Optional link to a portfolio project page */
  linkedItemId: string | null;
};

export type PortfolioPageContent = {
  logoUrl: string | null;
  navItems: PortfolioNavItem[];
  ctaLabel: string;
  /** @deprecated fullscreen cover — kept for publish compatibility */
  heroMediaType: PortfolioMediaType | null;
  heroMediaUrl: string | null;
  heroHeadline: string;
  heroPrimaryCta: PortfolioHeroCta;
  heroSecondaryCta: PortfolioHeroCta;
  heroStats: PortfolioHeroStat[];
  highlights: PortfolioHighlight[];
  aboutText: string;
  aboutImageUrl: string | null;
};

export type PortfolioGalleryBlock = {
  id: string;
  mediaType: PortfolioMediaType | null;
  mediaUrl: string | null;
};

export type PortfolioItemContent = {
  id: string;
  title: string;
  subtitle: string;
  role: string;
  client: string;
  year: string;
  coverMediaType: PortfolioMediaType | null;
  coverMediaUrl: string | null;
  description: string;
  aboutText: string;
  gallery: PortfolioGalleryBlock[];
  sortOrder: number;
  aspect: PortfolioAspect;
};

export type PortfolioSiteData = {
  accountId: string;
  publicSlug: string | null;
  kind: string;
  publishedAt: string | null;
  page: PortfolioPageContent;
  items: PortfolioItemContent[];
};

const DEFAULT_NAV: PortfolioNavItem[] = [
  { id: "work", label: "Work", anchor: "work" },
  { id: "about", label: "About", anchor: "about" },
];

const DEFAULT_HEADLINE =
  "Films and visual stories for brands that want work that looks good and feels effortless.";

const DEFAULT_PRIMARY_CTA: PortfolioHeroCta = { label: "View work", anchor: "work" };
const DEFAULT_SECONDARY_CTA: PortfolioHeroCta = { label: "Get in touch", anchor: "about" };

const DEFAULT_STATS: PortfolioHeroStat[] = [
  { id: "s1", value: "50+", label: "Projects" },
  { id: "s2", value: "10+", label: "Years" },
  { id: "s3", value: "Worldwide", label: "Clients" },
  { id: "s4", value: "Cinema", label: "Craft" },
];

function parseNav(raw: unknown): PortfolioNavItem[] {
  if (!Array.isArray(raw)) return [...DEFAULT_NAV];
  const items = raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const id = String(r.id ?? "").trim();
      const label = String(r.label ?? "").trim();
      const anchor = String(r.anchor ?? "").trim();
      if (!id || !label || !anchor) return null;
      return { id, label, anchor };
    })
    .filter((x): x is PortfolioNavItem => Boolean(x));
  return items.length ? items : [...DEFAULT_NAV];
}

function parseCta(raw: unknown, fallback: PortfolioHeroCta): PortfolioHeroCta {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const r = raw as Record<string, unknown>;
  const label = String(r.label ?? "").trim();
  const anchor = String(r.anchor ?? "").trim();
  if (!label) return { ...fallback };
  return { label, anchor: anchor || fallback.anchor };
}

function parseStats(raw: unknown): PortfolioHeroStat[] {
  if (!Array.isArray(raw)) return DEFAULT_STATS.map((s) => ({ ...s }));
  const stats = raw
    .map((row, i) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const value = String(r.value ?? "").trim();
      const label = String(r.label ?? "").trim();
      if (!value && !label) return null;
      return {
        id: String(r.id ?? `s${i}`).trim() || `s${i}`,
        value: value || "—",
        label: label || "—",
      };
    })
    .filter((x): x is PortfolioHeroStat => Boolean(x));
  return stats.length ? stats : DEFAULT_STATS.map((s) => ({ ...s }));
}

function parseHighlights(raw: unknown): PortfolioHighlight[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row, i) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const id = String(r.id ?? `h${i}`).trim() || `h${i}`;
      const title = String(r.title ?? "").trim();
      const coverMediaUrl =
        r.coverMediaUrl != null && String(r.coverMediaUrl).trim()
          ? String(r.coverMediaUrl).trim()
          : null;
      const mediaTypeRaw = String(r.coverMediaType ?? "");
      const coverMediaType: PortfolioMediaType | null =
        mediaTypeRaw === "image" || mediaTypeRaw === "video" ? mediaTypeRaw : coverMediaUrl ? "image" : null;
      const linked =
        r.linkedItemId != null && String(r.linkedItemId).trim() ? String(r.linkedItemId).trim() : null;
      if (!title && !coverMediaUrl) return null;
      return {
        id,
        title: title || "Untitled",
        description: String(r.description ?? ""),
        coverMediaType,
        coverMediaUrl,
        linkedItemId: linked,
      };
    })
    .filter((x): x is PortfolioHighlight => Boolean(x));
}

function parseAspect(raw: unknown): PortfolioAspect {
  const v = String(raw ?? "");
  if (v === "portrait" || v === "square" || v === "landscape") return v;
  return "landscape";
}

function parseMediaType(raw: unknown): PortfolioMediaType | null {
  const v = String(raw ?? "");
  if (v === "image" || v === "video") return v;
  return null;
}

function pageFromRow(row: Record<string, unknown>, version: "draft" | "live"): PortfolioPageContent {
  const p = version === "draft" ? "draft" : "live";
  const headlineRaw = row[`${p}_hero_headline`];
  const headline =
    headlineRaw != null && String(headlineRaw).trim()
      ? String(headlineRaw).trim()
      : version === "draft"
        ? DEFAULT_HEADLINE
        : "";

  return {
    logoUrl: row[`${p}_logo_url`] != null && String(row[`${p}_logo_url`]).trim() ? String(row[`${p}_logo_url`]) : null,
    navItems: parseNav(row[`${p}_nav_items`]),
    ctaLabel: String(row[`${p}_cta_label`] ?? "Get in touch").trim() || "Get in touch",
    heroMediaType: parseMediaType(row[`${p}_hero_media_type`]),
    heroMediaUrl:
      row[`${p}_hero_media_url`] != null && String(row[`${p}_hero_media_url`]).trim()
        ? String(row[`${p}_hero_media_url`])
        : null,
    heroHeadline: headline,
    heroPrimaryCta: parseCta(row[`${p}_hero_primary_cta`], DEFAULT_PRIMARY_CTA),
    heroSecondaryCta: parseCta(row[`${p}_hero_secondary_cta`], DEFAULT_SECONDARY_CTA),
    heroStats: parseStats(row[`${p}_hero_stats`]),
    highlights: parseHighlights(row[`${p}_highlights`]),
    aboutText: String(row[`${p}_about_text`] ?? ""),
    aboutImageUrl:
      row[`${p}_about_image_url`] != null && String(row[`${p}_about_image_url`]).trim()
        ? String(row[`${p}_about_image_url`])
        : null,
  };
}

function parseGallery(raw: unknown): PortfolioGalleryBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row, i) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const mediaUrl =
        r.mediaUrl != null && String(r.mediaUrl).trim()
          ? String(r.mediaUrl).trim()
          : r.coverMediaUrl != null && String(r.coverMediaUrl).trim()
            ? String(r.coverMediaUrl).trim()
            : null;
      if (!mediaUrl) return null;
      const mediaTypeRaw = String(r.mediaType ?? r.coverMediaType ?? "");
      const mediaType: PortfolioMediaType | null =
        mediaTypeRaw === "image" || mediaTypeRaw === "video" ? mediaTypeRaw : "image";
      return {
        id: String(r.id ?? `g${i}`).trim() || `g${i}`,
        mediaType,
        mediaUrl,
      };
    })
    .filter((x): x is PortfolioGalleryBlock => Boolean(x));
}

function itemFromRow(row: Record<string, unknown>, version: "draft" | "live"): PortfolioItemContent | null {
  if (version === "live" && row.in_live !== true) return null;
  const p = version === "draft" ? "draft" : "live";
  const title = String(row[`${p}_title`] ?? "").trim();
  const coverUrl =
    row[`${p}_cover_media_url`] != null && String(row[`${p}_cover_media_url`]).trim()
      ? String(row[`${p}_cover_media_url`])
      : null;
  const description = String(row[`${p}_description`] ?? "");
  const aboutRaw = row[`${p}_about_text`];
  const aboutText =
    aboutRaw != null && String(aboutRaw).trim() ? String(aboutRaw) : description;
  return {
    id: String(row.id ?? ""),
    title: title || (version === "draft" ? "Untitled" : ""),
    subtitle: String(row[`${p}_subtitle`] ?? "").trim(),
    role: String(row[`${p}_role`] ?? "").trim(),
    client: String(row[`${p}_client`] ?? "").trim(),
    year: String(row[`${p}_year`] ?? "").trim(),
    coverMediaType: parseMediaType(row[`${p}_cover_media_type`]),
    coverMediaUrl: coverUrl,
    description,
    aboutText,
    gallery: parseGallery(row[`${p}_gallery`]),
    sortOrder: Number(row[`${p}_sort_order`] ?? 0) || 0,
    aspect: parseAspect(row[`${p}_aspect`]),
  };
}

async function ensurePortfolioPage(accountId: string): Promise<Record<string, unknown>> {
  const { data: existing, error: readErr } = await supabase
    .from("portfolio_pages")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (existing) return existing as Record<string, unknown>;

  const { error: insErr } = await supabase
    .from("portfolio_pages")
    .upsert({ account_id: accountId }, { onConflict: "account_id", ignoreDuplicates: true });

  if (insErr) throw new Error(insErr.message);

  const { data: again, error: againErr } = await supabase
    .from("portfolio_pages")
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();
  if (againErr) throw new Error(againErr.message);
  if (!again) throw new Error("Could not create portfolio page.");
  return again as Record<string, unknown>;
}

export async function loadPortfolioSite(
  accountId: string,
  version: "draft" | "live",
): Promise<PortfolioSiteData> {
  const { data: account, error: accErr } = await supabase
    .from("accounts")
    .select("id, kind, public_slug")
    .eq("id", accountId)
    .maybeSingle();
  if (accErr) throw new Error(accErr.message);
  if (!account) throw new Error("Account not found");

  const pageRow = await ensurePortfolioPage(accountId);

  const { data: itemRows, error: itemsErr } = await supabase
    .from("portfolio_items")
    .select("*")
    .eq("account_id", accountId)
    .order(version === "draft" ? "draft_sort_order" : "live_sort_order", { ascending: true });
  if (itemsErr) throw new Error(itemsErr.message);

  const items = ((itemRows as Array<Record<string, unknown>> | null) ?? [])
    .map((row) => itemFromRow(row, version))
    .filter((x): x is PortfolioItemContent => Boolean(x && x.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    accountId,
    publicSlug:
      account.public_slug != null && String(account.public_slug).trim()
        ? String(account.public_slug).trim()
        : null,
    kind: String(account.kind ?? ""),
    publishedAt: pageRow.published_at != null ? String(pageRow.published_at) : null,
    page: pageFromRow(pageRow, version),
    items,
  };
}

export async function loadPublicPortfolioBySlug(slug: string): Promise<PortfolioSiteData | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  const { data: account, error } = await supabase
    .from("accounts")
    .select("id, kind, public_slug")
    .eq("kind", "filmmaker")
    .ilike("public_slug", normalized)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!account?.id) return null;

  return loadPortfolioSite(String(account.id), "live");
}

export async function loadPortfolioItem(
  accountId: string,
  itemId: string,
  version: "draft" | "live",
): Promise<PortfolioItemContent | null> {
  const { data, error } = await supabase
    .from("portfolio_items")
    .select("*")
    .eq("account_id", accountId)
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return itemFromRow(data as Record<string, unknown>, version);
}

export async function updatePortfolioPageDraft(
  accountId: string,
  patch: Partial<PortfolioPageContent>,
): Promise<void> {
  await ensurePortfolioPage(accountId);
  const db: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.logoUrl !== undefined) db.draft_logo_url = patch.logoUrl;
  if (patch.navItems !== undefined) db.draft_nav_items = patch.navItems;
  if (patch.ctaLabel !== undefined) db.draft_cta_label = patch.ctaLabel;
  if (patch.heroMediaType !== undefined) db.draft_hero_media_type = patch.heroMediaType;
  if (patch.heroMediaUrl !== undefined) db.draft_hero_media_url = patch.heroMediaUrl;
  if (patch.heroHeadline !== undefined) db.draft_hero_headline = patch.heroHeadline;
  if (patch.heroPrimaryCta !== undefined) db.draft_hero_primary_cta = patch.heroPrimaryCta;
  if (patch.heroSecondaryCta !== undefined) db.draft_hero_secondary_cta = patch.heroSecondaryCta;
  if (patch.heroStats !== undefined) db.draft_hero_stats = patch.heroStats;
  if (patch.highlights !== undefined) db.draft_highlights = patch.highlights;
  if (patch.aboutText !== undefined) db.draft_about_text = patch.aboutText;
  if (patch.aboutImageUrl !== undefined) db.draft_about_image_url = patch.aboutImageUrl;

  const { error } = await supabase.from("portfolio_pages").update(db).eq("account_id", accountId);
  if (error) throw new Error(error.message);
}

export async function upsertPortfolioItemDraft(
  accountId: string,
  input: {
    id?: string;
    title: string;
    coverMediaType: PortfolioMediaType | null;
    coverMediaUrl: string | null;
    description?: string;
    subtitle?: string;
    role?: string;
    client?: string;
    year?: string;
    aboutText?: string;
    gallery?: PortfolioGalleryBlock[];
    aspect?: PortfolioAspect;
  },
): Promise<PortfolioItemContent> {
  if (input.id) {
    const patch: Record<string, unknown> = {
      draft_title: input.title.trim() || "Untitled",
      draft_cover_media_type: input.coverMediaType,
      draft_cover_media_url: input.coverMediaUrl,
      draft_description: input.description ?? "",
      draft_aspect: input.aspect ?? "landscape",
      updated_at: new Date().toISOString(),
    };
    if (input.subtitle !== undefined) patch.draft_subtitle = input.subtitle;
    if (input.role !== undefined) patch.draft_role = input.role;
    if (input.client !== undefined) patch.draft_client = input.client;
    if (input.year !== undefined) patch.draft_year = input.year;
    if (input.aboutText !== undefined) patch.draft_about_text = input.aboutText;
    if (input.gallery !== undefined) patch.draft_gallery = input.gallery;

    const { data, error } = await supabase
      .from("portfolio_items")
      .update(patch)
      .eq("id", input.id)
      .eq("account_id", accountId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    const item = itemFromRow(data as Record<string, unknown>, "draft");
    if (!item) throw new Error("Failed to map item");
    return item;
  }

  const { data: existing } = await supabase
    .from("portfolio_items")
    .select("draft_sort_order")
    .eq("account_id", accountId)
    .order("draft_sort_order", { ascending: false })
    .limit(1);
  const nextOrder = existing?.[0] ? Number(existing[0].draft_sort_order ?? 0) + 1 : 0;

  const aspects: PortfolioAspect[] = ["landscape", "portrait", "square"];
  const aspect = input.aspect ?? aspects[nextOrder % aspects.length]!;

  const { data, error } = await supabase
    .from("portfolio_items")
    .insert({
      account_id: accountId,
      draft_title: input.title.trim() || "Untitled",
      draft_cover_media_type: input.coverMediaType,
      draft_cover_media_url: input.coverMediaUrl,
      draft_description: input.description ?? "",
      draft_subtitle: input.subtitle ?? "",
      draft_role: input.role ?? "",
      draft_client: input.client ?? "",
      draft_year: input.year ?? "",
      draft_about_text: input.aboutText ?? input.description ?? "",
      draft_gallery: input.gallery ?? [],
      draft_sort_order: nextOrder,
      draft_aspect: aspect,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const item = itemFromRow(data as Record<string, unknown>, "draft");
  if (!item) throw new Error("Failed to map item");
  return item;
}

export async function deletePortfolioItemDraft(accountId: string, itemId: string): Promise<void> {
  const { error } = await supabase.from("portfolio_items").delete().eq("id", itemId).eq("account_id", accountId);
  if (error) throw new Error(error.message);
}

/** Copy draft → live for page + items. Visitor only ever sees live. */
export async function publishPortfolio(accountId: string): Promise<void> {
  const pageRow = await ensurePortfolioPage(accountId);
  const now = new Date().toISOString();

  const { error: pageErr } = await supabase
    .from("portfolio_pages")
    .update({
      live_logo_url: pageRow.draft_logo_url ?? null,
      live_nav_items: pageRow.draft_nav_items ?? DEFAULT_NAV,
      live_cta_label: pageRow.draft_cta_label ?? "Get in touch",
      live_hero_media_type: pageRow.draft_hero_media_type ?? null,
      live_hero_media_url: pageRow.draft_hero_media_url ?? null,
      live_hero_headline: pageRow.draft_hero_headline ?? DEFAULT_HEADLINE,
      live_hero_primary_cta: pageRow.draft_hero_primary_cta ?? DEFAULT_PRIMARY_CTA,
      live_hero_secondary_cta: pageRow.draft_hero_secondary_cta ?? DEFAULT_SECONDARY_CTA,
      live_hero_stats: pageRow.draft_hero_stats ?? DEFAULT_STATS,
      live_highlights: pageRow.draft_highlights ?? [],
      live_about_text: pageRow.draft_about_text ?? "",
      live_about_image_url: pageRow.draft_about_image_url ?? null,
      published_at: now,
      updated_at: now,
    })
    .eq("account_id", accountId);
  if (pageErr) throw new Error(pageErr.message);

  const { data: items, error: itemsErr } = await supabase
    .from("portfolio_items")
    .select("*")
    .eq("account_id", accountId);
  if (itemsErr) throw new Error(itemsErr.message);

  for (const row of items ?? []) {
    const r = row as Record<string, unknown>;
    const { error } = await supabase
      .from("portfolio_items")
      .update({
        live_title: r.draft_title,
        live_cover_media_type: r.draft_cover_media_type,
        live_cover_media_url: r.draft_cover_media_url,
        live_description: r.draft_description,
        live_subtitle: r.draft_subtitle ?? "",
        live_role: r.draft_role ?? "",
        live_client: r.draft_client ?? "",
        live_year: r.draft_year ?? "",
        live_about_text: r.draft_about_text ?? r.draft_description ?? "",
        live_gallery: r.draft_gallery ?? [],
        live_sort_order: r.draft_sort_order,
        live_aspect: r.draft_aspect,
        in_live: true,
        updated_at: now,
      })
      .eq("id", r.id)
      .eq("account_id", accountId);
    if (error) throw new Error(error.message);
  }
}
