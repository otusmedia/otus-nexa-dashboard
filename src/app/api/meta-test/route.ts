import { NextResponse } from "next/server";

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID_RAW = process.env.META_AD_ACCOUNT_ID;

function normalizeAdAccountId(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.replace(/^act_/i, "");
}

/** Lightweight check that Marketing API reads work for the configured ad account. */
export async function GET() {
  if (!ACCESS_TOKEN || !AD_ACCOUNT_ID_RAW?.trim()) {
    return NextResponse.json(
      { ok: false, error: "META_ACCESS_TOKEN or META_AD_ACCOUNT_ID is not configured." },
      { status: 503 },
    );
  }

  const AD_ACCOUNT_ID = normalizeAdAccountId(AD_ACCOUNT_ID_RAW);
  if (!AD_ACCOUNT_ID) {
    return NextResponse.json({ ok: false, error: "META_AD_ACCOUNT_ID is empty." }, { status: 503 });
  }

  const url = `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}/insights?fields=spend&date_preset=last_7d&level=account&access_token=${ACCESS_TOKEN}`;

  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = (await res.json()) as { data?: unknown[]; error?: { message?: string } };

    if (data.error) {
      return NextResponse.json(
        { ok: false, actId: AD_ACCOUNT_ID, error: data.error.message ?? "Meta API error" },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, actId: AD_ACCOUNT_ID, data });
  } catch (e) {
    console.error("meta-test route:", e);
    return NextResponse.json({ ok: false, actId: AD_ACCOUNT_ID, error: "Request failed" }, { status: 500 });
  }
}
