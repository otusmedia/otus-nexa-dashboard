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
};

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

  const fields = encodeURIComponent(
    "name,creative{title,body,image_url,thumbnail_url},insights.date_preset(last_30d){impressions,clicks,ctr,spend}",
  );
  const base = `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}/ads?fields=${fields}&limit=50&access_token=${ACCESS_TOKEN}`;

  try {
    let res = await fetch(`${base}&sort=impressions_descending`, { next: { revalidate: 300 } });
    let payload = (await res.json()) as { data?: GraphAd[]; error?: { message?: string } };

    if (payload.error?.message?.toLowerCase().includes("sort")) {
      res = await fetch(base, { next: { revalidate: 300 } });
      payload = (await res.json()) as { data?: GraphAd[]; error?: { message?: string } };
    }

    if (payload.error) {
      return NextResponse.json({ error: payload.error.message ?? "Meta creatives API error" }, { status: 400 });
    }

    const rows = Array.isArray(payload.data) ? payload.data : [];

    const num = (v: unknown): number => {
      if (typeof v === "number" && Number.isFinite(v)) return v;
      const s = String(v ?? "").trim().replace(/,/g, "");
      if (!s) return 0;
      const n = Number(s);
      return Number.isFinite(n) ? n : 0;
    };

    const pickInsightRow = (ad: GraphAd): GraphInsights | undefined => {
      const arr = ad.insights?.data;
      if (Array.isArray(arr) && arr.length > 0) return arr[0];
      return undefined;
    };

    const scored = rows
      .map((ad, adIndex) => {
        const ins = pickInsightRow(ad);
        if (adIndex < 2) {
          console.log("[meta-creatives] RAW ad insights sample:", JSON.stringify({ adId: ad.id, insights: ad.insights }));
        }
        const impressions = Math.max(0, Math.round(num(ins?.impressions)));
        let ctr = num(ins?.ctr);
        if (ctr > 0 && ctr <= 1) ctr *= 100;
        const clicks = num(ins?.clicks);
        if (ctr <= 0 && impressions > 0 && clicks > 0) {
          ctr = (clicks / impressions) * 100;
        }
        const spend = num(ins?.spend);
        const cr = ad.creative;
        const imageUrl = (cr?.image_url || cr?.thumbnail_url || "").trim();
        return {
          id: String(ad.id ?? ""),
          name: String(ad.name ?? cr?.title ?? "Ad"),
          imageUrl,
          ctr,
          impressions,
          spend,
          platform: "Meta" as const,
        };
      })
      .sort((a, b) => b.impressions - a.impressions);

    const creatives = scored.slice(0, 3);

    return NextResponse.json({ creatives, source: "api" });
  } catch (error) {
    console.error("Meta creatives API error:", error);
    return NextResponse.json({ error: "Failed to fetch Meta creatives" }, { status: 500 });
  }
}
