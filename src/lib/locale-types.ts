export type AppLanguage = "en" | "pt-BR";

export const APP_LANGUAGES: AppLanguage[] = ["en", "pt-BR"];

export function normalizeAppLanguage(raw: unknown): AppLanguage {
  const s = String(raw ?? "").trim();
  return s === "pt-BR" ? "pt-BR" : "en";
}
