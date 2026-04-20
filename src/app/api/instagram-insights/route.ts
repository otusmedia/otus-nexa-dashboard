import { NextResponse } from "next/server";

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const INSTAGRAM_ID = process.env.META_INSTAGRAM_ID;

const fetchOpts = { next: { revalidate: 300 } as const };

function parseNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getGraphErrorMessage(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const msg = (json as { error?: { message?: string } }).error?.message;
  return typeof msg === "string" && msg.length > 0 ? msg : null;
}

function sumFromInsightValues(json: unknown): number {
  if (!json || typeof json !== "object") return 0;
  const j = json as { data?: Array<{ values?: Array<{ value?: unknown }> }> };
  const values = j.data?.[0]?.values;
  if (!Array.isArray(values)) return 0;
  return values.reduce((sum, row) => sum + parseNumber(row?.value), 0);
}

/** Sums day `values` or `total_value` blocks (Instagram often returns one or the other). */
function metricSumFromInsightJson(json: unknown): number {
  const fromValues = sumFromInsightValues(json);
  if (fromValues > 0) return fromValues;
  if (!json || typeof json !== "object") return 0;
  const j = json as { data?: Array<{ total_value?: { value?: unknown } }> };
  const rows = j.data;
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((sum, row) => sum + parseNumber(row?.total_value?.value), 0);
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, fetchOpts);
  return res.json();
}

function logRaw(tag: string, data: unknown) {
  console.log(`[instagram-insights] RAW ${tag}:`, JSON.stringify(data));
}

function extractProfileCounts(json: unknown): { followersCount: number; mediaCount: number } {
  if (!json || typeof json !== "object") return { followersCount: 0, mediaCount: 0 };
  const j = json as {
    error?: { message?: string };
    followers_count?: number;
    media_count?: number;
  };
  if (j.error?.message) {
    console.error("[instagram-insights] profile:", j.error.message);
    return { followersCount: 0, mediaCount: 0 };
  }
  return {
    followersCount: typeof j.followers_count === "number" ? j.followers_count : Number(j.followers_count) || 0,
    mediaCount: typeof j.media_count === "number" ? j.media_count : Number(j.media_count) || 0,
  };
}

async function firstNonZeroMetricSum(
  id: string,
  token: string,
  since: number,
  until: number,
  attempts: { tag: string; url: string }[],
): Promise<number> {
  for (const { tag, url } of attempts) {
    const json = await fetchJson(url);
    logRaw(tag, json);
    const err = getGraphErrorMessage(json);
    if (err) {
      console.error(`[instagram-insights] ${tag} error:`, err);
      continue;
    }
    const sum = metricSumFromInsightJson(json);
    if (sum > 0) return sum;
  }
  return 0;
}

async function tryImpressionsSum(
  id: string,
  token: string,
  since: number,
  until: number,
  reachFallback: number,
): Promise<number> {
  const q = (metric: string, extra: string) =>
    `https://graph.facebook.com/v19.0/${id}/insights?metric=${metric}&period=day${extra}&since=${since}&until=${until}&access_token=${token}`;
  const sum = await firstNonZeroMetricSum(id, token, since, until, [
    { tag: "impressions (metric_type=total_value)", url: q("impressions", "&metric_type=total_value") },
    { tag: "impressions (no metric_type)", url: q("impressions", "") },
    { tag: "views (metric_type=total_value)", url: q("views", "&metric_type=total_value") },
    { tag: "views (no metric_type)", url: q("views", "") },
    { tag: "website_clicks (metric_type=total_value)", url: q("website_clicks", "&metric_type=total_value") },
    { tag: "website_clicks (no metric_type)", url: q("website_clicks", "") },
  ]);
  if (sum > 0) return sum;

  if (reachFallback > 0) {
    console.log("[instagram-insights] impressions using 30d reach sum as proxy:", reachFallback);
    return reachFallback;
  }

  const mediaSum = await sumMediaImpressionsFromRecentPosts(id, token);
  if (mediaSum > 0) return mediaSum;

  console.error(
    "[instagram-insights] impressions: all account-insight attempts and media proxy returned 0 or errors (see RAW logs above).",
  );
  return 0;
}

async function tryProfileVisitsSum(
  id: string,
  token: string,
  since: number,
  until: number,
  reachSumFallback: number,
): Promise<number> {
  const q = (metric: string, extra: string) =>
    `https://graph.facebook.com/v19.0/${id}/insights?metric=${metric}&period=day${extra}&since=${since}&until=${until}&access_token=${token}`;
  const sum = await firstNonZeroMetricSum(id, token, since, until, [
    { tag: "profile_views (no metric_type)", url: q("profile_views", "") },
    { tag: "profile_views (metric_type=total_value)", url: q("profile_views", "&metric_type=total_value") },
    { tag: "website_clicks (no metric_type)", url: q("website_clicks", "") },
    { tag: "website_clicks (metric_type=total_value)", url: q("website_clicks", "&metric_type=total_value") },
    { tag: "reach (no metric_type, profile proxy)", url: q("reach", "") },
    { tag: "reach (metric_type=total_value, profile proxy)", url: q("reach", "&metric_type=total_value") },
  ]);
  if (sum > 0) return sum;
  if (reachSumFallback > 0) {
    console.log("[instagram-insights] profile_visits using reach sum as last-resort proxy:", reachSumFallback);
    return reachSumFallback;
  }
  console.error("[instagram-insights] profile_visits: all attempts returned 0 or errors (see RAW logs above).");
  return 0;
}

async function sumMediaImpressionsFromRecentPosts(igId: string, token: string): Promise<number> {
  const mediaUrl = `https://graph.facebook.com/v19.0/${igId}/media?fields=id,like_count,comments_count,impressions,reach&limit=10&access_token=${token}`;
  try {
    const json = await fetchJson(mediaUrl);
    logRaw("media list (impressions proxy)", json);
    const err = getGraphErrorMessage(json);
    if (err) {
      console.error("[instagram-insights] media list (impressions proxy) error:", err);
      return 0;
    }
    const data = (json as { data?: Array<{ impressions?: unknown }> }).data;
    if (!Array.isArray(data)) return 0;
    const sum = data.reduce((s, row) => s + parseNumber(row?.impressions), 0);
    if (sum > 0) {
      console.log("[instagram-insights] media impressions proxy sum (last 10 posts):", sum);
    }
    return sum;
  } catch (e) {
    console.error("[instagram-insights] media list fetch failed:", e);
    return 0;
  }
}

function parseSinceUntilFromRequest(request: Request): { since: number; until: number } {
  const { searchParams } = new URL(request.url);
  const rawS = searchParams.get("since");
  const rawU = searchParams.get("until");
  if (rawS != null && rawU != null && rawS !== "" && rawU !== "") {
    const since = Math.floor(Number(rawS));
    const until = Math.floor(Number(rawU));
    if (Number.isFinite(since) && Number.isFinite(until) && since < until) {
      const maxSpan = 366 * 24 * 60 * 60;
      if (until - since <= maxSpan) return { since, until };
    }
  }
  const range = searchParams.get("range") ?? "30d";
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const until = Math.floor(Date.now() / 1000);
  const since = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
  return { since, until };
}

export async function GET(request: Request) {
  if (!ACCESS_TOKEN || !INSTAGRAM_ID?.trim()) {
    return NextResponse.json(
      { error: "Instagram Insights API is not configured (META_ACCESS_TOKEN, META_INSTAGRAM_ID)." },
      { status: 503 },
    );
  }

  const id = INSTAGRAM_ID.trim();
  const token = ACCESS_TOKEN;
  const { since, until } = parseSinceUntilFromRequest(request);

  const profileUrl = `https://graph.facebook.com/v19.0/${id}?fields=followers_count,media_count,website,name,biography&access_token=${token}`;
  const reachUrl = `https://graph.facebook.com/v19.0/${id}/insights?metric=reach&period=day&since=${since}&until=${until}&access_token=${token}`;
  const engagedUrl = `https://graph.facebook.com/v19.0/${id}/insights?metric=accounts_engaged&period=day&metric_type=total_value&since=${since}&until=${until}&access_token=${token}`;
  const totalInteractionsUrl = `https://graph.facebook.com/v19.0/${id}/insights?metric=total_interactions&period=day&metric_type=total_value&since=${since}&until=${until}&access_token=${token}`;

  const profileJson = await fetchJson(profileUrl);
  logRaw("profile", profileJson);
  const { followersCount, mediaCount } = extractProfileCounts(profileJson);

  const reachJson = await fetchJson(reachUrl);
  logRaw("reach", reachJson);
  const reachErr = getGraphErrorMessage(reachJson);
  const reach = reachErr ? 0 : metricSumFromInsightJson(reachJson);
  if (reachErr) console.error("[instagram-insights] reach error:", reachErr);

  const impressions = await tryImpressionsSum(id, token, since, until, reach);
  const profileVisits = await tryProfileVisitsSum(id, token, since, until, reach);

  const engagedJson = await fetchJson(engagedUrl);
  logRaw("accounts_engaged", engagedJson);
  const engagedErr = getGraphErrorMessage(engagedJson);
  const accountsEngaged = engagedErr ? 0 : metricSumFromInsightJson(engagedJson);
  if (engagedErr) console.error("[instagram-insights] accounts_engaged error:", engagedErr);

  const tiJson = await fetchJson(totalInteractionsUrl);
  logRaw("total_interactions", tiJson);
  const tiErr = getGraphErrorMessage(tiJson);
  const totalInteractions = tiErr ? 0 : metricSumFromInsightJson(tiJson);
  if (tiErr) console.error("[instagram-insights] total_interactions error:", tiErr);

  const engagementBase = totalInteractions > 0 ? totalInteractions : accountsEngaged;
  const engagementRate =
    reach > 0 ? parseFloat(((engagementBase / reach) * 100).toFixed(1)) : 0;

  return NextResponse.json({
    reach,
    impressions,
    profileVisits,
    engagementRate,
    followersCount,
    mediaCount,
    totalInteractions,
    source: "api",
  });
}
