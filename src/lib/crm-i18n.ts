import { t as translateLine } from "@/lib/i18n";
import type { AppLanguage } from "@/lib/locale-types";

export function crmT(key: string, lang: AppLanguage): string {
  return translateLine(key, lang);
}

export function crmLeadStatusLabel(status: string, lang: AppLanguage): string {
  return crmT(status, lang);
}

export function crmResumeStatusLabel(status: string, lang: AppLanguage): string {
  return crmT(status, lang);
}

export function crmSourceLabel(source: string, lang: AppLanguage): string {
  return crmT(source, lang);
}
