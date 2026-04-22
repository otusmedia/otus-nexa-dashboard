import { NextResponse } from "next/server";

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID_RAW = process.env.META_AD_ACCOUNT_ID;

function normalizeAdAccountId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^act_/i, "");
}

function presetDays(datePreset: string): number {
  if (datePreset === "last_7d") return 7;
  if (datePreset === "last_90d") return 90;
  return 30;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDaysYmd(ymdStr: string, delta: number): string {
  const d = new Date(`${ymdStr}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function parseCustomSinceUntil(searchParams: URLSearchParams): { sinceYmd: string; untilYmd: string } | null {
  const rawS = searchParams.get("since");
  const rawU = searchParams.get("until");
  if (rawS == null || rawU == null || rawS === "" || rawU === "") return null;
  const sinceSec = Math.floor(Number(rawS));
  const untilSec = Math.floor(Number(rawU));
  if (!Number.isFinite(sinceSec) || !Number.isFinite(untilSec) || sinceSec >= untilSec) return null;
  const maxSpan = 366 * 24 * 60 * 60;
  if (untilSec - sinceSec > maxSpan) return null;
  const sinceYmd = new Date(sinceSec * 1000).toISOString().slice(0, 10);
  const untilYmd = new Date(untilSec * 1000).toISOString().slice(0, 10);
  return { sinceYmd, untilYmd };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const datePreset = searchParams.get("date_preset") ?? "last_30d";
  const customRange = parseCustomSinceUntil(searchParams);
  const campaignIdRaw = searchParams.get("campaign_id")?.trim() ?? "";
  const campaignIdFilter = campaignIdRaw && /^[\d]+$/.test(campaignIdRaw) ? campaignIdRaw : "";

  if (!ACCESS_TOKEN || !AD_ACCOUNT_ID_RAW?.trim()) {
    return NextResponse.json({ error: "Meta Ads API is not configured (META_ACCESS_TOKEN, META_AD_ACCOUNT_ID)." }, { status: 503 });
  }

  const AD_ACCOUNT_ID = normalizeAdAccountId(AD_ACCOUNT_ID_RAW);
  if (!AD_ACCOUNT_ID) {
    return NextResponse.json({ error: "META_AD_ACCOUNT_ID is empty." }, { status: 503 });
  }

  try {
    // `status` / delivery fields are not valid on the Insights `fields` param; use metrics + campaign_name only.
    const accountFields =
      "campaign_name,spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,cost_per_action_type";
    const campaignInsightFields =
      "spend,impressions,clicks,ctr,cpc,cpm,reach,actions,cost_per_action_type";

    let rows: unknown[];
    if (campaignIdFilter) {
      const timeRangeParam = customRange
        ? `time_range=${encodeURIComponent(JSON.stringify({ since: customRange.sinceYmd, until: customRange.untilYmd }))}`
        : `date_preset=${encodeURIComponent(datePreset)}`;
      const primaryUrl = `https://graph.facebook.com/v19.0/${campaignIdFilter}/insights?fields=${campaignInsightFields}&${timeRangeParam}&access_token=${ACCESS_TOKEN}`;

      let response = await fetch(primaryUrl, { next: { revalidate: 300 } });
      let data = (await response.json()) as {
        data?: unknown[];
        error?: { message?: string };
      };
      console.log("[meta-ads] campaign insights raw (primary):", JSON.stringify(data));

      if (data.error) {
        return NextResponse.json({ error: data.error.message ?? "Meta API error" }, { status: 400 });
      }

      rows = Array.isArray(data.data) ? data.data : [];
      if (rows.length === 0) {
        const fallbackUrl = `https://graph.facebook.com/v19.0/${campaignIdFilter}/insights?fields=${campaignInsightFields}&date_preset=maximum&access_token=${ACCESS_TOKEN}`;
        response = await fetch(fallbackUrl, { next: { revalidate: 300 } });
        data = (await response.json()) as {
          data?: unknown[];
          error?: { message?: string };
        };
        console.log("[meta-ads] campaign insights raw (fallback date_preset=maximum):", JSON.stringify(data));
        if (data.error) {
          return NextResponse.json({ error: data.error.message ?? "Meta API error" }, { status: 400 });
        }
        rows = Array.isArray(data.data) ? data.data : [];
      }
    } else {
      const timeRangeParam = customRange
        ? `time_range=${encodeURIComponent(JSON.stringify({ since: customRange.sinceYmd, until: customRange.untilYmd }))}`
        : `date_preset=${encodeURIComponent(datePreset)}`;
      const url = `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}/insights?fields=${accountFields}&${timeRangeParam}&level=campaign&access_token=${ACCESS_TOKEN}`;

      const response = await fetch(url, { next: { revalidate: 300 } });
      const data = (await response.json()) as {
        data?: unknown[];
        error?: { message?: string };
      };
      console.log("[meta-ads] account insights raw:", JSON.stringify(data));

      if (data.error) {
        return NextResponse.json({ error: data.error.message ?? "Meta API error" }, { status: 400 });
      }

      rows = Array.isArray(data.data) ? data.data : [];
    }
    const campaigns = rows.map((c) => {
      const row = c as Record<string, unknown>;
      const actions = Array.isArray(row.actions) ? row.actions : [];
      const costPerAction = Array.isArray(row.cost_per_action_type) ? row.cost_per_action_type : [];
      const leadsEntry = actions.find((a: { action_type?: string }) => a.action_type === "lead") as
        | { value?: string }
        | undefined;
      const cplEntry = costPerAction.find((a: { action_type?: string }) => a.action_type === "lead") as
        | { value?: string }
        | undefined;
      const leads = leadsEntry?.value ?? "0";
      const costPerLead = cplEntry?.value ?? "0";
      return {
        campaignName: String(row.campaign_name ?? ""),
        status: String((row as Record<string, unknown>).effective_status ?? "unknown"),
        amountSpent: parseFloat(String(row.spend ?? "0")),
        impressions: parseInt(String(row.impressions ?? "0"), 10),
        clicks: parseInt(String(row.clicks ?? "0"), 10),
        ctr: parseFloat(String(row.ctr ?? "0")),
        cpc: parseFloat(String(row.cpc ?? "0")),
        cpm: parseFloat(String(row.cpm ?? "0")),
        reach: parseInt(String(row.reach ?? "0"), 10),
        frequency: parseFloat(String(row.frequency ?? "0")),
        results: parseInt(String(leads), 10),
        costPerResult: parseFloat(String(costPerLead)),
      };
    });

    const summary = {
      totalSpent: campaigns.reduce((s: number, c: { amountSpent: number }) => s + c.amountSpent, 0),
      totalImpressions: campaigns.reduce((s: number, c: { impressions: number }) => s + c.impressions, 0),
      totalClicks: campaigns.reduce((s: number, c: { clicks: number }) => s + c.clicks, 0),
      averageCTR: campaigns.length
        ? campaigns.reduce((s: number, c: { ctr: number }) => s + c.ctr, 0) / campaigns.length
        : 0,
      averageCPL: campaigns.length
        ? campaigns.reduce((s: number, c: { costPerResult: number }) => s + c.costPerResult, 0) / campaigns.length
        : 0,
      totalReach: campaigns.reduce((s: number, c: { reach: number }) => s + c.reach, 0),
      totalResults: campaigns.reduce((s: number, c: { results: number }) => s + c.results, 0),
    };

    let days: number;
    let previousUntil: string;
    let previousSince: string;
    if (customRange) {
      const a = new Date(`${customRange.sinceYmd}T12:00:00.000Z`).getTime();
      const b = new Date(`${customRange.untilYmd}T12:00:00.000Z`).getTime();
      days = Math.max(1, Math.round((b - a) / 86400000) + 1);
      previousUntil = addDaysYmd(customRange.sinceYmd, -1);
      previousSince = addDaysYmd(previousUntil, -(days - 1));
    } else {
      days = presetDays(datePreset);
      const today = ymd(new Date());
      const currentSince = addDaysYmd(today, -(days - 1));
      previousUntil = addDaysYmd(currentSince, -1);
      previousSince = addDaysYmd(previousUntil, -(days - 1));
    }
    const timeRange = encodeURIComponent(JSON.stringify({ since: previousSince, until: previousUntil }));
    const prevUrl = `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}/insights?fields=spend&level=account&time_range=${timeRange}&access_token=${ACCESS_TOKEN}`;

    let previousPeriodSpend = 0;
    try {
      const prevRes = await fetch(prevUrl, { next: { revalidate: 300 } });
      const prevJson = (await prevRes.json()) as {
        data?: Array<{ spend?: string }>;
        error?: { message?: string };
      };
      if (!prevJson.error && Array.isArray(prevJson.data) && prevJson.data[0]) {
        previousPeriodSpend = parseFloat(String(prevJson.data[0].spend ?? "0"));
      }
    } catch (e) {
      console.error("Meta Ads previous-period spend fetch:", e);
    }

    const currentSpend = summary.totalSpent;
    const spendGrowthPct =
      previousPeriodSpend > 0
        ? ((currentSpend - previousPeriodSpend) / previousPeriodSpend) * 100
        : currentSpend > 0
          ? 100
          : 0;

    return NextResponse.json({
      campaigns,
      summary,
      previousPeriodSpend,
      spendGrowthPct,
      source: "api",
    });
  } catch (error) {
    console.error("Meta Ads API error:", error);
    return NextResponse.json({ error: "Failed to fetch Meta Ads data" }, { status: 500 });
  }
}
