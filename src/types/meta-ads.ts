export type MetaAdsSource = "csv" | "api" | null;

export interface MetaAdsCampaign {
  campaignName: string;
  startDate: string;
  endDate: string;
  status: string;
  results: number;
  reach: number;
  frequency: number;
  costPerResult: number;
  amountSpent: number;
  impressions: number;
  cpm: number;
  linkClicks: number;
  cpc: number;
  ctr: number;
  landingPageViews: number;
}

export interface MetaAdsSummary {
  totalSpent: number;
  totalImpressions: number;
  totalClicks: number;
  averageCTR: number;
  averageCPL: number;
  totalReach: number;
  totalResults: number;
}
