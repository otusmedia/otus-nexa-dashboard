import { NextResponse } from "next/server";

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID_RAW = process.env.META_AD_ACCOUNT_ID;

function normalizeAdAccountId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^act_/i, "");
}

export async function GET() {
  try {
    if (!ACCESS_TOKEN || !AD_ACCOUNT_ID_RAW?.trim()) {
      return NextResponse.json({ error: "Meta Ads API is not configured (META_ACCESS_TOKEN, META_AD_ACCOUNT_ID)." }, { status: 503 });
    }
    const AD_ACCOUNT_ID = normalizeAdAccountId(AD_ACCOUNT_ID_RAW);
    if (!AD_ACCOUNT_ID) {
      return NextResponse.json({ error: "META_AD_ACCOUNT_ID is empty." }, { status: 503 });
    }

    const url = `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}/campaigns?fields=id,name,status,objective,start_time,stop_time,daily_budget,lifetime_budget&limit=50&access_token=${ACCESS_TOKEN}`;
    const response = await fetch(url, { next: { revalidate: 300 } });
    const data = (await response.json()) as {
      data?: unknown[];
      error?: { message?: string };
    };
    if (data.error) {
      return NextResponse.json({ error: data.error.message ?? "Meta API error" }, { status: 400 });
    }
    return NextResponse.json({ campaigns: data.data ?? [] });
  } catch {
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 });
  }
}
