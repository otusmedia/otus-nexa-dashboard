import type { MetaAdsCampaign, MetaAdsSummary } from "@/types/meta-ads";
import type { InstagramInsightMetricRow } from "@/lib/parse-instagram-csv";

const LEGACY_META_KEY = "meta-ads-import";
const LEGACY_INSTAGRAM_KEY = "instagram-insights-import";

export type PersistedMetaAdsCsv = {
  campaigns: MetaAdsCampaign[];
  summary: MetaAdsSummary;
  lastImported: string;
  source: "csv";
};

export type PersistedInstagramCsv = {
  metrics: InstagramInsightMetricRow[];
  lastImported: string;
};

function metaAdsKey(clientSlug: string): string {
  return `meta-ads-import:${clientSlug}`;
}

function instagramKey(clientSlug: string): string {
  return `instagram-insights-import:${clientSlug}`;
}

function readJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** One-time: move global legacy keys into the RocketRide scoped slot. */
function migrateLegacyMetaAds(clientSlug: string): PersistedMetaAdsCsv | null {
  if (typeof window === "undefined") return null;
  const scopedKey = metaAdsKey(clientSlug);
  if (localStorage.getItem(scopedKey)) return null;
  const legacy = readJson<PersistedMetaAdsCsv & { source?: string }>(localStorage.getItem(LEGACY_META_KEY));
  if (!legacy || !Array.isArray(legacy.campaigns) || !legacy.summary) return null;
  const payload: PersistedMetaAdsCsv = {
    campaigns: legacy.campaigns,
    summary: legacy.summary,
    lastImported: legacy.lastImported,
    source: "csv",
  };
  localStorage.setItem(scopedKey, JSON.stringify(payload));
  localStorage.removeItem(LEGACY_META_KEY);
  return payload;
}

function migrateLegacyInstagram(clientSlug: string): PersistedInstagramCsv | null {
  if (typeof window === "undefined") return null;
  const scopedKey = instagramKey(clientSlug);
  if (localStorage.getItem(scopedKey)) return null;
  const legacy = readJson<PersistedInstagramCsv>(localStorage.getItem(LEGACY_INSTAGRAM_KEY));
  if (!legacy || !Array.isArray(legacy.metrics) || legacy.metrics.length === 0 || !legacy.lastImported) {
    return null;
  }
  localStorage.setItem(scopedKey, JSON.stringify(legacy));
  localStorage.removeItem(LEGACY_INSTAGRAM_KEY);
  return legacy;
}

export function readMetaAdsCsvForClient(clientSlug: string): PersistedMetaAdsCsv | null {
  if (typeof window === "undefined") return null;
  const scoped = readJson<PersistedMetaAdsCsv>(localStorage.getItem(metaAdsKey(clientSlug)));
  if (scoped && Array.isArray(scoped.campaigns) && scoped.summary && scoped.source === "csv") {
    return scoped;
  }
  if (clientSlug === "rocketride") {
    return migrateLegacyMetaAds(clientSlug);
  }
  return null;
}

export function writeMetaAdsCsvForClient(clientSlug: string, payload: Omit<PersistedMetaAdsCsv, "source">): void {
  if (typeof window === "undefined") return;
  const data: PersistedMetaAdsCsv = { ...payload, source: "csv" };
  localStorage.setItem(metaAdsKey(clientSlug), JSON.stringify(data));
}

export function clearMetaAdsCsvForClient(clientSlug: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(metaAdsKey(clientSlug));
  if (clientSlug === "rocketride") {
    localStorage.removeItem(LEGACY_META_KEY);
  }
}

export function readInstagramCsvForClient(clientSlug: string): PersistedInstagramCsv | null {
  if (typeof window === "undefined") return null;
  const scoped = readJson<PersistedInstagramCsv>(localStorage.getItem(instagramKey(clientSlug)));
  if (scoped && Array.isArray(scoped.metrics) && scoped.metrics.length > 0 && scoped.lastImported) {
    return scoped;
  }
  if (clientSlug === "rocketride") {
    return migrateLegacyInstagram(clientSlug);
  }
  return null;
}

export function writeInstagramCsvForClient(clientSlug: string, payload: PersistedInstagramCsv): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(instagramKey(clientSlug), JSON.stringify(payload));
}

export function clearInstagramCsvForClient(clientSlug: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(instagramKey(clientSlug));
  if (clientSlug === "rocketride") {
    localStorage.removeItem(LEGACY_INSTAGRAM_KEY);
  }
}
