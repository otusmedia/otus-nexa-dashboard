/**
 * Plan feature matrix for the filmmaker SaaS evolution.
 * storageLimitBytes / videoMinutesLimit: `null` means unlimited (agency convention).
 * Enforcement of usage caps comes in a later phase; fields exist from Phase 0.
 */

export type AccountPlan = "free" | "base" | "pro" | "complete" | "agency";

export type PlanFeatures = {
  plan: AccountPlan;
  /** Max public portfolio items; null = unlimited. */
  portfolioItemLimit: number | null;
  deliveriesEnabled: boolean;
  watermarkOnPublicPortfolio: boolean;
  /** null = unlimited */
  storageLimitBytes: number | null;
  /** null = unlimited */
  videoMinutesLimit: number | null;
};

const GB = 1024 * 1024 * 1024;

export const PLAN_FEATURES: Record<AccountPlan, PlanFeatures> = {
  free: {
    plan: "free",
    portfolioItemLimit: 3,
    deliveriesEnabled: false,
    watermarkOnPublicPortfolio: true,
    storageLimitBytes: 5 * GB,
    videoMinutesLimit: 60,
  },
  base: {
    plan: "base",
    portfolioItemLimit: 20,
    deliveriesEnabled: true,
    watermarkOnPublicPortfolio: false,
    storageLimitBytes: 50 * GB,
    videoMinutesLimit: 300,
  },
  pro: {
    plan: "pro",
    portfolioItemLimit: 100,
    deliveriesEnabled: true,
    watermarkOnPublicPortfolio: false,
    storageLimitBytes: 200 * GB,
    videoMinutesLimit: 1200,
  },
  complete: {
    plan: "complete",
    portfolioItemLimit: null,
    deliveriesEnabled: true,
    watermarkOnPublicPortfolio: false,
    storageLimitBytes: 1024 * GB,
    videoMinutesLimit: 5000,
  },
  agency: {
    plan: "agency",
    portfolioItemLimit: null,
    deliveriesEnabled: true,
    watermarkOnPublicPortfolio: false,
    storageLimitBytes: null,
    videoMinutesLimit: null,
  },
};

export function getPlanFeatures(plan: AccountPlan | string | null | undefined): PlanFeatures {
  if (plan && plan in PLAN_FEATURES) {
    return PLAN_FEATURES[plan as AccountPlan];
  }
  return PLAN_FEATURES.free;
}

/** Returns true when usage is under the limit. `null` limit = unlimited. */
export function isUnderLimit(used: number, limit: number | null | undefined): boolean {
  if (limit == null) return true;
  return used < limit;
}

export function canAddPortfolioItem(currentCount: number, plan: AccountPlan | string | null | undefined): boolean {
  const { portfolioItemLimit } = getPlanFeatures(plan);
  if (portfolioItemLimit == null) return true;
  return currentCount < portfolioItemLimit;
}

export function canUseDeliveries(plan: AccountPlan | string | null | undefined): boolean {
  return getPlanFeatures(plan).deliveriesEnabled;
}

export function defaultsForPlan(plan: AccountPlan): {
  storage_limit_bytes: number | null;
  video_minutes_limit: number | null;
} {
  const f = getPlanFeatures(plan);
  return {
    storage_limit_bytes: f.storageLimitBytes,
    video_minutes_limit: f.videoMinutesLimit,
  };
}
