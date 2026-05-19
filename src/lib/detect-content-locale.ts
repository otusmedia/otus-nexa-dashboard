import type { AppLanguage } from "@/lib/locale-types";

/** Lightweight heuristic for EN vs pt-BR (not for legal/medical precision). */
export function detectContentLocale(text: string): AppLanguage {
  const sample = text.slice(0, 2000);
  if (!sample.trim()) return "en";

  const ptHints =
    /\b(não|nao|você|voce|para|com|uma|por|está|esta|são|sao|também|tambem|obrigad|atualiza|publicação|publicacao|solicita|favor|equipe|cliente|conteúdo|conteudo)\b/i;
  const accented = /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/;

  if (accented.test(sample) || ptHints.test(sample)) return "pt-BR";
  return "en";
}

export function needsContentTranslation(text: string, readerLocale: AppLanguage, contentLocale?: AppLanguage | null): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const source = contentLocale ?? detectContentLocale(trimmed);
  return source !== readerLocale;
}
