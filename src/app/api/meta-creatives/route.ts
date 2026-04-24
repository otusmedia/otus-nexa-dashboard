import { NextResponse } from "next/server";

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID_RAW = process.env.META_AD_ACCOUNT_ID;

function normalizeAdAccountId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^act_/i, "");
}

type GraphCreative = {
  title?: string;
  body?: string;
  image_url?: string;
  thumbnail_url?: string;
  picture?: string;
  object_story_spec?: Record<string, unknown>;
};

function extractImageFromObjectStorySpec(spec: Record<string, unknown> | undefined): string | null {
  if (!spec || typeof spec !== "object") return null;
  const linkData = spec.link_data as Record<string, unknown> | undefined;
  if (linkData && typeof linkData === "object") {
    for (const k of ["picture", "image_url", "url"] as const) {
      const v = linkData[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    const childAtt = linkData.child_attachments as { data?: Array<Record<string, unknown>> } | undefined;
    if (Array.isArray(childAtt?.data)) {
      for (const child of childAtt.data) {
        if (!child || typeof child !== "object") continue;
        for (const k of ["picture", "image_url"] as const) {
          const v = child[k];
          if (typeof v === "string" && v.trim()) return v.trim();
        }
      }
    }
  }
  const videoData = spec.video_data as Record<string, unknown> | undefined;
  if (videoData && typeof videoData === "object") {
    for (const k of ["image_url", "imageUrl", "picture"] as const) {
      const v = videoData[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  const photoData = spec.photo_data as Record<string, unknown> | undefined;
  if (photoData && typeof photoData === "object") {
    for (const k of ["url", "image_url", "picture"] as const) {
      const v = photoData[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return null;
}

type GraphInsights = {
  impressions?: string | number;
  clicks?: string | number;
  ctr?: string | number;
  spend?: string | number;
};

type GraphAd = {
  id?: string;
  name?: string;
  creative?: GraphCreative;
  insights?: { data?: GraphInsights[] };
};

type InsightApiRow = Record<string, unknown>;

function parseCreativeImageUrl(cr: GraphCreative | undefined): string | null {
  if (!cr) return null;
  const thumb = (cr.thumbnail_url ?? "").trim();
  const full = (cr.image_url ?? "").trim();
  const picture = (cr.picture ?? "").trim();
  const fromSpec = extractImageFromObjectStorySpec(cr.object_story_spec);
  return thumb || full || picture || fromSpec || null;
}

function parseMetricsFromInsightObject(ins: GraphInsights | undefined) {
  const impressions = Math.max(0, Math.round(parseInt(String(ins?.impressions ?? "0"), 10) || 0));
  const clicks = parseInt(String(ins?.clicks ?? "0"), 10) || 0;
  let ctr = parseFloat(String(ins?.ctr ?? "0")) || 0;
  if (ctr > 0 && ctr <= 1) ctr *= 100;
  ctr = Math.round(ctr * 100) / 100;
  if (ctr <= 0 && impressions > 0 && clicks > 0) {
    ctr = Math.round(((clicks / impressions) * 100) * 100) / 100;
  }
  const spend = parseFloat(String(ins?.spend ?? "0")) || 0;
  return { impressions, clicks, ctr, spend };
}

function pickCreativeFromInsightRow(row: InsightApiRow): GraphCreative | undefined {
  const ac = row.adcreatives as { data?: GraphCreative[] } | undefined;
  if (Array.isArray(ac?.data) && ac.data.length > 0) return ac.data[0];
  const single = row.adcreatives as GraphCreative | undefined;
  if (
    single &&
    typeof single === "object" &&
    ("thumbnail_url" in single ||
      "image_url" in single ||
      "picture" in single ||
      "object_story_spec" in single)
  ) {
    return single;
  }
  const acArr = row.adcreatives as GraphCreative[] | undefined;
  if (Array.isArray(acArr) && acArr.length > 0) return acArr[0];
  return undefined;
}

function mapInsightRowsToCreatives(rows: InsightApiRow[]) {
  return rows.map((row) => {
    const id = String(row.ad_id ?? "");
    const name = String(row.ad_name ?? "Ad");
    const metrics = parseMetricsFromInsightObject(row as unknown as GraphInsights);
    const cr = pickCreativeFromInsightRow(row);
    const imageUrl = parseCreativeImageUrl(cr) ?? "";
    return {
      id,
      name,
      imageUrl,
      ctr: metrics.ctr,
      impressions: metrics.impressions,
      spend: metrics.spend,
      platform: "Meta" as const,
    };
  });
}

type MetaCreativeRow = {
  id: string;
  name: string;
  imageUrl: string;
  ctr: number;
  impressions: number;
  spend: number;
  platform: "Meta";
};

const AD_CREATIVE_FIELDS = encodeURIComponent(
  "creative{thumbnail_url,image_url,picture,object_story_spec}",
);

/** Insights rows often omit usable images; fetch each ad's creative node for thumbnails. */
async function enrichCreativesImageUrls(rows: MetaCreativeRow[], accessToken: string): Promise<MetaCreativeRow[]> {
  const missing = rows.filter((r) => !r.imageUrl?.trim() && r.id.length > 0);
  if (missing.length === 0) return rows;

  const fetched = await Promise.all(
    missing.map(async (row) => {
      const url = `https://graph.facebook.com/v19.0/${row.id}?fields=${AD_CREATIVE_FIELDS}&access_token=${accessToken}`;
      try {
        const res = await fetch(url, { next: { revalidate: 300 } });
        const j = (await res.json()) as { creative?: GraphCreative; error?: { message?: string } };
        if (j.error?.message) {
          console.warn(`[meta-creatives] ad ${row.id} creative:`, j.error.message);
          return { id: row.id, imageUrl: "" };
        }
        const imageUrl = parseCreativeImageUrl(j.creative) ?? "";
        return { id: row.id, imageUrl };
      } catch {
        return { id: row.id, imageUrl: "" };
      }
    }),
  );
  const byId = new Map(fetched.map((f) => [f.id, f.imageUrl]));
  return rows.map((r) => {
    const next = byId.get(r.id);
    if (next === undefined) return r;
    if (!next?.trim()) return r;
    return { ...r, imageUrl: next.trim() };
  });
}

function mapAdsToCreatives(ads: GraphAd[]) {
  return ads.map((ad) => {
    const ins = ad.insights?.data?.[0];
    const impressions = parseInt(String(ins?.impressions ?? "0"), 10) || 0;
    const clicks = parseInt(String(ins?.clicks ?? "0"), 10) || 0;
    let ctr = parseFloat(String(ins?.ctr ?? "0")) || 0;
    if (ctr > 0 && ctr <= 1) ctr *= 100;
    if (ctr <= 0 && impressions > 0 && clicks > 0) {
      ctr = (clicks / impressions) * 100;
    }
    const spend = parseFloat(String(ins?.spend ?? "0")) || 0;
    const cr = ad.creative;
    const imageUrl = parseCreativeImageUrl(cr) ?? "";
    return {
      id: String(ad.id ?? ""),
      name: String(ad.name ?? cr?.title ?? "Ad"),
      imageUrl,
      ctr,
      impressions,
      spend,
      platform: "Meta" as const,
    };
  });
}

export async function GET() {
  if (!ACCESS_TOKEN || !AD_ACCOUNT_ID_RAW?.trim()) {
    return NextResponse.json(
      { error: "Meta Ads API is not configured (META_ACCESS_TOKEN, META_AD_ACCOUNT_ID)." },
      { status: 503 },
    );
  }

  const AD_ACCOUNT_ID = normalizeAdAccountId(AD_ACCOUNT_ID_RAW);
  if (!AD_ACCOUNT_ID) {
    return NextResponse.json({ error: "META_AD_ACCOUNT_ID is empty." }, { status: 503 });
  }

  try {
    // 1) Insights-first (account insights, level=ad)
    const insightFields = encodeURIComponent(
      "ad_id,ad_name,impressions,clicks,ctr,spend,adcreatives{thumbnail_url,image_url,body,title,picture,object_story_spec}",
    );
    const insightsUrl = `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}/insights?fields=${insightFields}&date_preset=maximum&level=ad&sort=impressions_descending&limit=3&access_token=${ACCESS_TOKEN}`;

    let insightPayload = (await (await fetch(insightsUrl, { next: { revalidate: 300 } })).json()) as {
      data?: InsightApiRow[];
      error?: { message?: string };
    };

    if (insightPayload.error) {
      console.warn("[meta-creatives] insights-first error:", insightPayload.error.message);
    }

    let insightRows = Array.isArray(insightPayload.data) ? insightPayload.data : [];

    // Retry insights without nested adcreatives if the first call failed on field errors
    if (insightPayload.error?.message && insightRows.length === 0) {
      const simpleFields = encodeURIComponent("ad_id,ad_name,impressions,clicks,ctr,spend");
      const simpleUrl = `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}/insights?fields=${simpleFields}&date_preset=maximum&level=ad&sort=impressions_descending&limit=3&access_token=${ACCESS_TOKEN}`;
      insightPayload = (await (await fetch(simpleUrl, { next: { revalidate: 300 } })).json()) as {
        data?: InsightApiRow[];
        error?: { message?: string };
      };
      if (insightPayload.error) {
        console.warn("[meta-creatives] insights (simple fields) error:", insightPayload.error.message);
      }
      insightRows = Array.isArray(insightPayload.data) ? insightPayload.data : [];
    }

    // Some accounts return no rows / errors for date_preset=maximum; try bounded windows.
    if (insightRows.length === 0) {
      const simpleFields = encodeURIComponent("ad_id,ad_name,impressions,clicks,ctr,spend");
      for (const preset of ["last_90d", "last_30d"] as const) {
        const fbUrl = `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}/insights?fields=${simpleFields}&date_preset=${preset}&level=ad&sort=impressions_descending&limit=3&access_token=${ACCESS_TOKEN}`;
        const fbPayload = (await (await fetch(fbUrl, { next: { revalidate: 300 } })).json()) as {
          data?: InsightApiRow[];
          error?: { message?: string };
        };
        const rows = Array.isArray(fbPayload.data) ? fbPayload.data : [];
        if (fbPayload.error?.message) {
          console.warn(`[meta-creatives] insights (${preset}) error:`, fbPayload.error.message);
        }
        if (rows.length > 0) {
          insightRows = rows;
          break;
        }
      }
    }

    if (insightRows.length > 0) {
      const first = insightRows[0];
      console.log("[meta-creatives] first raw insights row (full):", JSON.stringify(first));
      console.log(
        "[meta-creatives] first ad parsed metrics:",
        JSON.stringify(parseMetricsFromInsightObject(first as unknown as GraphInsights)),
      );
      const creatives = mapInsightRowsToCreatives(insightRows)
        .filter((c) => c.id.length > 0)
        .slice(0, 3);
      // Return insights as soon as we have ad rows — images are often missing on insights; the UI
      // uses a placeholder. Previously we required a preview URL, which forced the /ads fallback
      // and produced empty results + "Live data unavailable" when that call failed or returned no rows.
      if (creatives.length > 0) {
        const withImages = await enrichCreativesImageUrls(creatives, ACCESS_TOKEN);
        return NextResponse.json({
          creatives: withImages,
          source: "api",
          metaAdAccountId: AD_ACCOUNT_ID,
        });
      }
    }

    // 2) Ads + nested insights, sort client-side, top 3
    const adsFields = encodeURIComponent(
      "id,name,creative{thumbnail_url,image_url,picture,effective_object_story_id,object_story_spec},insights.date_preset(maximum){impressions,clicks,ctr,spend}",
    );
    const adsUrl = `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}/ads?fields=${adsFields}&limit=20&access_token=${ACCESS_TOKEN}`;
    const adsRes = await fetch(adsUrl, { next: { revalidate: 300 } });
    const adsPayload = (await adsRes.json()) as { data?: GraphAd[]; error?: { message?: string } };

    if (adsPayload.error) {
      return NextResponse.json(
        { error: adsPayload.error.message ?? "Meta creatives API error" },
        { status: 400 },
      );
    }

    const adsRows = Array.isArray(adsPayload.data) ? adsPayload.data : [];
    if (adsRows.length > 0) {
      console.log("[meta-creatives] first raw ad (ads+insights fallback):", JSON.stringify(adsRows[0]));
    }

    const scored = mapAdsToCreatives(adsRows)
      .filter((c) => c.id.length > 0)
      .sort((a, b) => b.impressions - a.impressions);

    const creatives = scored.slice(0, 3);
    const withImages = await enrichCreativesImageUrls(creatives, ACCESS_TOKEN);

    return NextResponse.json({
      creatives: withImages,
      source: "api",
      metaAdAccountId: AD_ACCOUNT_ID,
    });
  } catch (error) {
    console.error("Meta creatives API error:", error);
    return NextResponse.json({ error: "Failed to fetch Meta creatives" }, { status: 500 });
  }
}
