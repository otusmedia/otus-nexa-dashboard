import type { AppLanguage } from "@/lib/locale-types";

export function localeToIntl(locale: AppLanguage): string {
  return locale === "pt-BR" ? "pt-BR" : "en-US";
}

export function formatDate(
  value: Date | string | number,
  locale: AppLanguage,
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleDateString(localeToIntl(locale), options);
}

export function formatDateTime(value: Date | string | number, locale: AppLanguage): string {
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleString(localeToIntl(locale));
}

export function formatNumber(value: number, locale: AppLanguage, options?: Intl.NumberFormatOptions): string {
  return value.toLocaleString(localeToIntl(locale), options);
}

export function formatCurrency(value: number, locale: AppLanguage, currency = "USD"): string {
  return value.toLocaleString(localeToIntl(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}
