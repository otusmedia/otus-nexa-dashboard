import { NextResponse } from "next/server";
import { normalizeAppLanguage, type AppLanguage } from "@/lib/locale-types";
import { translateContent } from "@/lib/server/translate-content";

export const runtime = "nodejs";

type Body = {
  text?: string;
  targetLocale?: string;
  sourceLocale?: string | null;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = String(body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  if (text.length > 12_000) {
    return NextResponse.json({ error: "text too long" }, { status: 400 });
  }

  const targetLocale = normalizeAppLanguage(body.targetLocale) as AppLanguage;
  const sourceLocaleRaw = body.sourceLocale;
  const sourceLocale =
    sourceLocaleRaw === "en" || sourceLocaleRaw === "pt-BR" ? sourceLocaleRaw : null;

  try {
    const result = await translateContent({ text, targetLocale, sourceLocale });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Translation failed";
    console.error("[api/translate]", message);
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
