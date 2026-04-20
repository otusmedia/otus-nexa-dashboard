import { NextResponse } from "next/server";

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const INSTAGRAM_ID = process.env.META_INSTAGRAM_ID;

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function utcMonthBounds(year: number, monthIndex: number): { since: number; until: number } {
  const firstMs = Date.UTC(year, monthIndex, 1, 0, 0, 0);
  const lastDate = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const lastMs = Date.UTC(year, monthIndex, lastDate, 23, 59, 59);
  let since = Math.floor(firstMs / 1000);
  let until = Math.floor(lastMs / 1000);
  const maxSpan = 28 * 24 * 60 * 60;
  if (until - since > maxSpan) {
    until = since + maxSpan;
  }
  return { since, until };
}

function parseRowValue(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function sumReachForWindow(
  igId: string,
  token: string,
  since: number,
  until: number,
): Promise<number> {
  const url = `https://graph.facebook.com/v19.0/${igId}/insights?metric=reach&period=day&since=${since}&until=${until}&access_token=${token}`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const json = (await res.json()) as {
      error?: { message?: string };
      data?: Array<{ values?: Array<{ value?: unknown }> }>;
    };
    console.log("[instagram-monthly] RAW reach window:", JSON.stringify(json), { since, until });
    if (json.error?.message) {
      console.error("[instagram-monthly] API error:", json.error.message, { since, until });
      return 0;
    }
    const values = json.data?.[0]?.values;
    if (!Array.isArray(values)) return 0;
    return values.reduce((sum, row) => sum + parseRowValue(row?.value), 0);
  } catch (e) {
    console.error("[instagram-monthly] request failed:", e, { since, until });
    return 0;
  }
}

/** Latest follower_count snapshot in the window (day period; window capped to ≤28 days). */
async function lastFollowerCountForWindow(
  igId: string,
  token: string,
  since: number,
  until: number,
): Promise<number> {
  const url = `https://graph.facebook.com/v19.0/${igId}/insights?metric=follower_count&period=day&since=${since}&until=${until}&access_token=${token}`;
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    const json = (await res.json()) as {
      error?: { message?: string };
      data?: Array<{ values?: Array<{ value?: unknown; end_time?: string }> }>;
    };
    console.log("[instagram-monthly] RAW follower_count window:", JSON.stringify(json), { since, until });
    if (json.error?.message) {
      console.error("[instagram-monthly] follower_count API error:", json.error.message, { since, until });
      return 0;
    }
    const values = json.data?.[0]?.values;
    if (!Array.isArray(values) || values.length === 0) return 0;
    let bestTs = -1;
    let bestVal = 0;
    for (const row of values) {
      const end = row?.end_time;
      const ts = typeof end === "string" ? Date.parse(end) : NaN;
      const t = Number.isFinite(ts) ? ts : -1;
      const v = parseRowValue(row?.value);
      if (t >= bestTs) {
        bestTs = t;
        bestVal = v;
      }
    }
    return bestVal;
  } catch (e) {
    console.error("[instagram-monthly] follower_count request failed:", e, { since, until });
    return 0;
  }
}

function parseSinceUntilFromRequest(request: Request): { since: number; until: number } | null {
  const { searchParams } = new URL(request.url);
  const rawS = searchParams.get("since");
  const rawU = searchParams.get("until");
  if (rawS == null || rawU == null || rawS === "" || rawU === "") return null;
  const since = Math.floor(Number(rawS));
  const until = Math.floor(Number(rawU));
  if (!Number.isFinite(since) || !Number.isFinite(until) || since >= until) return null;
  const maxSpan = 732 * 24 * 60 * 60;
  if (until - since > maxSpan) return null;
  return { since, until };
}

function utcMonthsBetween(sinceSec: number, untilSec: number): { y: number; m: number }[] {
  const start = new Date(sinceSec * 1000);
  const end = new Date(untilSec * 1000);
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth();
  const ey = end.getUTCFullYear();
  const em = end.getUTCMonth();
  const out: { y: number; m: number }[] = [];
  while (y < ey || (y === ey && m <= em)) {
    out.push({ y, m });
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return out;
}

export async function GET(request: Request) {
  if (!ACCESS_TOKEN || !INSTAGRAM_ID?.trim()) {
    const nowEmpty = new Date();
    const emptyMonths: { label: string; value: number }[] = [];
    for (let back = 11; back >= 0; back--) {
      const ref = new Date(Date.UTC(nowEmpty.getUTCFullYear(), nowEmpty.getUTCMonth() - back, 1));
      emptyMonths.push({ label: MONTH_SHORT[ref.getUTCMonth()] ?? "—", value: 0 });
    }
    console.error("[instagram-monthly] META_ACCESS_TOKEN or META_INSTAGRAM_ID not configured.");
    return NextResponse.json({ months: emptyMonths, source: "api" }, { status: 200 });
  }

  const id = INSTAGRAM_ID.trim();
  const token = ACCESS_TOKEN;
  const custom = parseSinceUntilFromRequest(request);
  const now = new Date();

  const targets: { label: string; since: number; until: number }[] = [];
  if (custom) {
    const { since: globSince, until: globUntil } = custom;
    const months = utcMonthsBetween(globSince, globUntil);
    for (const { y, m } of months) {
      const base = utcMonthBounds(y, m);
      const since = Math.max(base.since, globSince);
      const until = Math.min(base.until, globUntil);
      if (since > until) continue;
      targets.push({
        label: MONTH_SHORT[m] ?? "—",
        since,
        until,
      });
    }
  } else {
    for (let back = 11; back >= 0; back--) {
      const ref = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
      const y = ref.getUTCFullYear();
      const m = ref.getUTCMonth();
      const { since, until } = utcMonthBounds(y, m);
      targets.push({
        label: MONTH_SHORT[m] ?? "—",
        since,
        until,
      });
    }
  }

  const settled = await Promise.allSettled(
    targets.map(({ label, since, until }) =>
      sumReachForWindow(id, token, since, until).then((value) => ({ label, value })),
    ),
  );

  let months = settled.map((result, idx) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    console.error("[instagram-monthly] month window failed:", targets[idx], result.reason);
    return { label: targets[idx].label, value: 0 };
  });

  const reachAllZero = months.every((m) => m.value === 0);
  if (reachAllZero) {
    console.log("[instagram-monthly] reach all zero; fetching follower_count per month as fallback");
    const fcSettled = await Promise.allSettled(
      targets.map(({ label, since, until }) =>
        lastFollowerCountForWindow(id, token, since, until).then((value) => ({ label, value })),
      ),
    );
    months = fcSettled.map((result, idx) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      console.error("[instagram-monthly] follower_count month failed:", targets[idx], result.reason);
      return { label: targets[idx].label, value: 0 };
    });
  }

  return NextResponse.json({ months, source: "api" }, { status: 200 });
}
