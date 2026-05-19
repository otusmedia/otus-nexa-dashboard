"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/context/language-context";
import type { AppLanguage } from "@/lib/locale-types";
import { needsContentTranslation } from "@/lib/detect-content-locale";
import { cn } from "@/lib/utils";

type LocalizedContentProps = {
  text: string;
  contentLocale?: AppLanguage | null;
  className?: string;
};

export function LocalizedContent({ text, contentLocale, className }: LocalizedContentProps) {
  const { language: readerLocale, t } = useLanguage();
  const [translated, setTranslated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);

  const shouldTranslate = needsContentTranslation(text, readerLocale, contentLocale);

  const fetchTranslation = useCallback(async () => {
    if (!shouldTranslate) {
      setTranslated(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          targetLocale: readerLocale,
          sourceLocale: contentLocale ?? undefined,
        }),
      });
      const json = (await res.json()) as { translated?: string; error?: string };
      if (!res.ok) {
        setError(json.error ?? t("Translation unavailable"));
        setTranslated(null);
        return;
      }
      setTranslated(json.translated ?? null);
    } catch {
      setError(t("Translation unavailable"));
      setTranslated(null);
    } finally {
      setLoading(false);
    }
  }, [text, readerLocale, contentLocale, shouldTranslate, t]);

  useEffect(() => {
    setShowOriginal(false);
    void fetchTranslation();
  }, [fetchTranslation]);

  if (!text.trim()) return null;

  if (!shouldTranslate) {
    return <p className={cn("whitespace-pre-wrap", className)}>{text}</p>;
  }

  const originalLabel =
    (contentLocale ?? "en") === "pt-BR" ? t("Original (Portuguese)") : t("Original (English)");

  return (
    <div className={className}>
      {loading ? (
        <p className="text-sm font-light text-[rgba(255,255,255,0.45)]">{t("Translating…")}</p>
      ) : error ? (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap text-sm font-light text-[rgba(255,255,255,0.92)]">{text}</p>
          <p className="text-xs text-[rgba(255,255,255,0.4)]">{error}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap text-sm font-light leading-relaxed text-[rgba(255,255,255,0.92)]">
            {translated ?? text}
          </p>
          <button
            type="button"
            onClick={() => setShowOriginal((o) => !o)}
            className="text-[0.7rem] text-[rgba(255,255,255,0.45)] underline-offset-2 hover:text-[rgba(255,255,255,0.7)] hover:underline"
          >
            {showOriginal ? t("Hide original") : originalLabel}
          </button>
          {showOriginal ? (
            <p className="whitespace-pre-wrap border-l-2 border-[rgba(255,255,255,0.12)] pl-3 text-sm font-light text-[rgba(255,255,255,0.55)]">
              {text}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
