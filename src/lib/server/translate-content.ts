import { createHash } from "crypto";
import type { AppLanguage } from "@/lib/locale-types";
import { detectContentLocale } from "@/lib/detect-content-locale";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 64);
}

async function translateWithOpenAI(text: string, targetLocale: AppLanguage): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const targetLabel = targetLocale === "pt-BR" ? "Brazilian Portuguese" : "English";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TRANSLATE_MODEL?.trim() || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `You translate workplace messages for a client operations platform. Output ONLY the translation in ${targetLabel}. Preserve line breaks, mentions, URLs, and numbers. Do not add explanations.`,
        },
        { role: "user", content: text },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI translate failed: ${res.status} ${errBody.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const out = json.choices?.[0]?.message?.content?.trim();
  if (!out) throw new Error("Empty translation response");
  return out;
}

export async function translateContent(opts: {
  text: string;
  targetLocale: AppLanguage;
  sourceLocale?: AppLanguage | null;
}): Promise<{ translated: string; sourceLocale: AppLanguage; cached: boolean }> {
  const trimmed = opts.text.trim();
  if (!trimmed) {
    return { translated: "", sourceLocale: opts.sourceLocale ?? "en", cached: false };
  }

  const sourceLocale = opts.sourceLocale ?? detectContentLocale(trimmed);
  if (sourceLocale === opts.targetLocale) {
    return { translated: trimmed, sourceLocale, cached: true };
  }

  const hash = contentHash(trimmed);
  const supabase = getSupabaseAdmin();

  const { data: cached } = await supabase
    .from("content_translations")
    .select("translated_text")
    .eq("content_hash", hash)
    .eq("source_locale", sourceLocale)
    .eq("target_locale", opts.targetLocale)
    .maybeSingle();

  if (cached?.translated_text) {
    return { translated: String(cached.translated_text), sourceLocale, cached: true };
  }

  const translated = await translateWithOpenAI(trimmed, opts.targetLocale);

  const { error } = await supabase.from("content_translations").upsert(
    {
      content_hash: hash,
      source_locale: sourceLocale,
      target_locale: opts.targetLocale,
      translated_text: translated,
    },
    { onConflict: "content_hash,source_locale,target_locale" },
  );
  if (error) console.error("[translate] cache upsert failed:", error.message);

  return { translated, sourceLocale, cached: false };
}
