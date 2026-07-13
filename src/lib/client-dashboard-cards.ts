export const DASHBOARD_CARD_KEYS = [
  "overviewKpis",
  "highlights",
  "instagramPerformance",
  "metaAds",
  "googleAds",
  "topCreatives",
  "websiteAnalytics",
  "instagramFeed",
  "activitySummary",
] as const;

export type DashboardCardKey = (typeof DASHBOARD_CARD_KEYS)[number];

export type ClientDashboardCards = Record<DashboardCardKey, boolean>;

export const DEFAULT_CLIENT_DASHBOARD_CARDS: ClientDashboardCards = {
  overviewKpis: true,
  highlights: true,
  instagramPerformance: true,
  metaAds: true,
  googleAds: true,
  topCreatives: true,
  websiteAnalytics: true,
  instagramFeed: true,
  activitySummary: true,
};

export const DASHBOARD_CARD_LABELS: Record<DashboardCardKey, string> = {
  overviewKpis: "Overview KPIs",
  highlights: "Highlights",
  instagramPerformance: "Instagram Performance",
  metaAds: "Meta Ads",
  googleAds: "Google Ads",
  topCreatives: "Top Performing Creatives",
  websiteAnalytics: "Website Analytics",
  instagramFeed: "Instagram Feed",
  activitySummary: "Activity Summary",
};

export function parseClientDashboardCards(raw: unknown): ClientDashboardCards {
  const base: ClientDashboardCards = { ...DEFAULT_CLIENT_DASHBOARD_CARDS };
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  for (const key of DASHBOARD_CARD_KEYS) {
    if (key in o) base[key] = o[key] === true;
  }
  return base;
}

export function clientDashboardCardsToDb(config: ClientDashboardCards): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const key of DASHBOARD_CARD_KEYS) {
    out[key] = config[key] !== false;
  }
  return out;
}

export function isDashboardCardVisible(
  config: ClientDashboardCards | null | undefined,
  key: DashboardCardKey,
): boolean {
  if (!config) return true;
  return config[key] !== false;
}
