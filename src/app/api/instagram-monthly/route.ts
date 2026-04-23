import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const INSTAGRAM_ID = process.env.META_INSTAGRAM_ID;

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Honest chart: only current profile `followers_count` is reliable for many accounts.
 * Returns 12 calendar months (oldest → newest); all months 0 except the current month.
 */
export async function GET() {
  const nowEmpty = new Date();
  const emptyMonths: { label: string; value: number }[] = [];
  for (let back = 11; back >= 0; back--) {
    const ref = new Date(Date.UTC(nowEmpty.getUTCFullYear(), nowEmpty.getUTCMonth() - back, 1));
    emptyMonths.push({ label: MONTH_SHORT[ref.getUTCMonth()] ?? "—", value: 0 });
  }

  if (!ACCESS_TOKEN || !INSTAGRAM_ID?.trim()) {
    console.error("[instagram-monthly] META_ACCESS_TOKEN or META_INSTAGRAM_ID not configured.");
    return NextResponse.json({ months: emptyMonths, source: "api", liveFollowersCount: 0 }, { status: 200 });
  }

  const id = INSTAGRAM_ID.trim();
  const token = ACCESS_TOKEN;
  const profileUrl = `https://graph.facebook.com/v19.0/${id}?fields=followers_count&access_token=${token}`;

  let currentFollowers = 0;
  try {
    const res = await fetch(profileUrl, { cache: "no-store" });
    const profileData = (await res.json()) as {
      error?: { message?: string };
      followers_count?: unknown;
    };
    if (profileData.error?.message) {
      console.error("[instagram-monthly] profile error:", profileData.error.message);
    } else {
      const raw = profileData.followers_count;
      if (typeof raw === "number" && Number.isFinite(raw)) currentFollowers = Math.max(0, raw);
      else {
        const n = Number(raw);
        currentFollowers = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
      }
    }
  } catch (e) {
    console.error("[instagram-monthly] profile fetch failed:", e);
  }

  const now = new Date();
  const months: { label: string; value: number }[] = [];
  for (let back = 11; back >= 0; back--) {
    const ref = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const label = MONTH_SHORT[ref.getUTCMonth()] ?? "—";
    const isCurrentMonth = back === 0;
    months.push({ label, value: isCurrentMonth ? currentFollowers : 0 });
  }

  return NextResponse.json(
    { months, source: "api", liveFollowersCount: currentFollowers },
    { status: 200 },
  );
}
