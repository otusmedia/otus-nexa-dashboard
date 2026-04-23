import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID_RAW = process.env.META_AD_ACCOUNT_ID;

function normalizeAdAccountId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^act_/i, "");
}

/** Local calendar YYYY-MM-DD (matches Node/Vercel default; Strategy client uses local month keys). */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type MetaMonthlySpendRow = { date_start: string; spend: number };

/**
 * Account-level spend by calendar month (Marketing API insights, time_increment=monthly).
 * Used by Strategy "Monthly budget spend" so bars match Meta, not manual marketing_projects.budget_used.
 */
export async function GET() {
  if (!ACCESS_TOKEN || !AD_ACCOUNT_ID_RAW?.trim()) {
    return NextResponse.json({ source: "unconfigured" as const, rows: [] as MetaMonthlySpendRow[] }, { status: 200 });
  }

  const AD_ACCOUNT_ID = normalizeAdAccountId(AD_ACCOUNT_ID_RAW);
  if (!AD_ACCOUNT_ID) {
    return NextResponse.json({ source: "unconfigured" as const, rows: [] as MetaMonthlySpendRow[] }, { status: 200 });
  }

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const since = ymd(start);
  const until = ymd(now);
  const timeRange = encodeURIComponent(JSON.stringify({ since, until }));

  const baseUrl = `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}/insights?fields=spend,date_start,date_stop&level=account&time_range=${timeRange}&time_increment=monthly&access_token=${ACCESS_TOKEN}`;

  const rows: MetaMonthlySpendRow[] = [];
  let nextUrl: string | null = baseUrl;

  try {
    while (nextUrl) {
      const res = await fetch(nextUrl, { cache: "no-store" });
      const json = (await res.json()) as {
        data?: Array<{ spend?: string; date_start?: string; date_stop?: string }>;
        paging?: { next?: string };
        error?: { message?: string };
      };

      if (json.error?.message) {
        console.error("[meta-monthly-spend] Meta API:", json.error.message);
        return NextResponse.json(
          { source: "error" as const, error: json.error.message, rows: [] as MetaMonthlySpendRow[] },
          { status: 400 },
        );
      }

      for (const r of json.data ?? []) {
        const spend = parseFloat(String(r.spend ?? "0"));
        const ds = String(r.date_start ?? "").trim().slice(0, 10);
        if (ds) rows.push({ date_start: ds, spend: Number.isFinite(spend) ? spend : 0 });
      }

      nextUrl = json.paging?.next ?? null;
    }

    return NextResponse.json({ source: "api" as const, rows });
  } catch (e) {
    console.error("[meta-monthly-spend] fetch failed:", e);
    return NextResponse.json(
      { source: "error" as const, error: "Failed to fetch Meta monthly spend", rows: [] as MetaMonthlySpendRow[] },
      { status: 500 },
    );
  }
}
