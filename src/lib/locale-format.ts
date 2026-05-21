import type { AppLanguage } from "@/lib/locale-types";

export function localeTag(lang: AppLanguage): string {
  return lang === "pt-BR" ? "pt-BR" : "en-US";
}

export function formatLongDate(date: Date, lang: AppLanguage): string {
  return new Intl.DateTimeFormat(localeTag(lang), {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function timeOfDayGreeting(lang: AppLanguage): string {
  const h = new Date().getHours();
  if (lang === "pt-BR") {
    if (h >= 5 && h < 12) return "Bom dia,";
    if (h >= 12 && h < 18) return "Boa tarde,";
    return "Boa noite,";
  }
  if (h >= 5 && h < 12) return "Good morning,";
  if (h >= 12 && h < 18) return "Good afternoon,";
  return "Good evening,";
}
