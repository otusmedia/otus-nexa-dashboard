import { google } from "googleapis";

/**
 * GA4 server credentials — never commit real keys. Set in `.env.local`:
 * - GOOGLE_CLIENT_EMAIL
 * - GOOGLE_PRIVATE_KEY (use \\n for newlines in .env)
 * - GA4_PROPERTY_ID (numeric ID or full `properties/123`)
 *
 * Grant this service account at least Viewer on the GA4 property.
 */
export type Ga4DateRangeParam = "7d" | "30d" | "90d";

export type Ga4DashboardResponse = {
  source: "live" | "mock" | "unavailable";
  error?: string;
  totals: {
    sessions: string;
    bounceRate: string;
    avgSessionDuration: string;
    changes: {
      sessions: string;
      bounceRate: string;
      avgSessionDuration: string;
    };
  };
  topPages: Array<{
    page: string;
    sessions: string;
    screenPageViews: string;
    engagementRate: string;
  }>;
};

export function isGa4Configured(): boolean {
  const email = process.env.GOOGLE_CLIENT_EMAIL?.trim();
  const raw = process.env.GOOGLE_PRIVATE_KEY;
  const property = process.env.GA4_PROPERTY_ID?.trim();
  return Boolean(email && raw && String(raw).trim() && property);
}

function parseGooglePrivateKeyFromEnv(): string {
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY ?? "")
    .replace(/\\n/g, "\n")
    .replace(/\\\\n/g, "\n")
    .trim();
  console.log("GA4 key starts with:", privateKey.slice(0, 40));
  return privateKey;
}

function logGa4Diagnostics(): void {
  console.log('GA4 configured:', isGa4Configured());
  console.log('GA4 email prefix:', process.env.GOOGLE_CLIENT_EMAIL?.slice(0, 20));
}

function dateRangeLiterals(key: Ga4DateRangeParam) {
  switch (key) {
    case "7d":
      return {
        current: { startDate: "7daysAgo", endDate: "today", name: "current" },
        previous: { startDate: "14daysAgo", endDate: "8daysAgo", name: "previous" },
      };
    case "90d":
      return {
        current: { startDate: "90daysAgo", endDate: "today", name: "current" },
        previous: { startDate: "180daysAgo", endDate: "91daysAgo", name: "previous" },
      };
    default:
      return {
        current: { startDate: "30daysAgo", endDate: "today", name: "current" },
        previous: { startDate: "60daysAgo", endDate: "31daysAgo", name: "previous" },
      };
  }
}

function formatInt(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(n));
}

function formatPctFromRatio(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

function formatSignedPctPointDelta(currentRatio: number, previousRatio: number): string {
  const delta = (currentRatio - previousRatio) * 100;
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}%`;
}

function formatSignedDurationDelta(deltaSeconds: number): string {
  const sign = deltaSeconds >= 0 ? "+" : "-";
  const abs = Math.abs(Math.round(deltaSeconds));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatSessionsDelta(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "+100%" : "0%";
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

/** Zeros / empty when GA4 is not configured or the request fails — never fake metrics. */
export function getGa4DashboardUnavailable(error?: string): Ga4DashboardResponse {
  return {
    source: "unavailable",
    ...(error ? { error } : {}),
    totals: {
      sessions: "0",
      bounceRate: "0.0%",
      avgSessionDuration: "00:00",
      changes: { sessions: "0%", bounceRate: "0.0%", avgSessionDuration: "00:00" },
    },
    topPages: [],
  };
}

function addDaysYmdUtc(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d, 12, 0, 0);
  const nd = new Date(t + deltaDays * 86400000);
  return nd.toISOString().slice(0, 10);
}

function daysInclusiveYmd(startYmd: string, endYmd: string): number {
  const a = new Date(`${startYmd}T12:00:00.000Z`).getTime();
  const b = new Date(`${endYmd}T12:00:00.000Z`).getTime();
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

export async function fetchGa4DashboardSnapshotCustom(startYmd: string, endYmd: string): Promise<Ga4DashboardResponse> {
  logGa4Diagnostics();
  if (!isGa4Configured()) {
    return getGa4DashboardUnavailable("GA4 credentials not configured");
  }

  try {
    const credentials = {
      client_email: process.env.GOOGLE_CLIENT_EMAIL!,
      private_key: parseGooglePrivateKeyFromEnv(),
    };

    const propertyId = process.env.GA4_PROPERTY_ID!;

    const auth = new google.auth.JWT({
      email: credentials.client_email.trim(),
      key: credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });

    const analyticsdata = google.analyticsdata({ version: "v1beta", auth });
    const propertyIdTrim = propertyId.trim();
    const property = propertyIdTrim.startsWith("properties/")
      ? propertyIdTrim
      : `properties/${propertyIdTrim}`;

    const d = daysInclusiveYmd(startYmd, endYmd);
    const previousEnd = addDaysYmdUtc(startYmd, -1);
    const previousStart = addDaysYmdUtc(previousEnd, -(d - 1));
    const current = { startDate: startYmd, endDate: endYmd, name: "current" };
    const previous = { startDate: previousStart, endDate: previousEnd, name: "previous" };

    const { data: totalsBody } = await analyticsdata.properties.runReport({
      property,
      requestBody: {
        dateRanges: [current, previous],
        metrics: [{ name: "sessions" }, { name: "bounceRate" }, { name: "averageSessionDuration" }],
      },
    });

    const mv = totalsBody.rows?.[0]?.metricValues ?? [];
    const sessionsCur = Number(mv[0]?.value ?? 0);
    const sessionsPrev = Number(mv[1]?.value ?? 0);
    const bounceCur = Number(mv[2]?.value ?? 0);
    const bouncePrev = Number(mv[3]?.value ?? 0);
    const durationCur = Number(mv[4]?.value ?? 0);
    const durationPrev = Number(mv[5]?.value ?? 0);

    const { data: pagesBody } = await analyticsdata.properties.runReport({
      property,
      requestBody: {
        dateRanges: [{ startDate: startYmd, endDate: endYmd }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "sessions" }, { name: "screenPageViews" }, { name: "engagementRate" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: "10",
      },
    });

    const topPages =
      pagesBody.rows?.map((row) => {
        const page = row.dimensionValues?.[0]?.value ?? "(not set)";
        const s = Number(row.metricValues?.[0]?.value ?? 0);
        const v = Number(row.metricValues?.[1]?.value ?? 0);
        const er = Number(row.metricValues?.[2]?.value ?? 0);
        return {
          page,
          sessions: formatInt(s),
          screenPageViews: formatInt(v),
          engagementRate: formatPctFromRatio(Number.isFinite(er) ? er : 0),
        };
      }) ?? [];

    return {
      source: "live",
      totals: {
        sessions: formatInt(sessionsCur),
        bounceRate: formatPctFromRatio(Number.isFinite(bounceCur) ? bounceCur : 0),
        avgSessionDuration: formatDuration(Number.isFinite(durationCur) ? durationCur : 0),
        changes: {
          sessions: formatSessionsDelta(sessionsCur, sessionsPrev),
          bounceRate: formatSignedPctPointDelta(
            Number.isFinite(bounceCur) ? bounceCur : 0,
            Number.isFinite(bouncePrev) ? bouncePrev : 0,
          ),
          avgSessionDuration: formatSignedDurationDelta(
            (Number.isFinite(durationCur) ? durationCur : 0) - (Number.isFinite(durationPrev) ? durationPrev : 0),
          ),
        },
      },
      topPages: topPages.slice(0, 10),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "GA4 request failed";
    console.error("[ga4] fetchGa4DashboardSnapshotCustom:", message);
    return getGa4DashboardUnavailable(message);
  }
}

export async function fetchGa4DashboardSnapshot(range: Ga4DateRangeParam): Promise<Ga4DashboardResponse> {
  logGa4Diagnostics();
  if (!isGa4Configured()) {
    return getGa4DashboardUnavailable("GA4 credentials not configured");
  }

  try {
    const credentials = {
      client_email: process.env.GOOGLE_CLIENT_EMAIL!,
      private_key: parseGooglePrivateKeyFromEnv(),
    };

    const propertyId = process.env.GA4_PROPERTY_ID!;

    const auth = new google.auth.JWT({
      email: credentials.client_email.trim(),
      key: credentials.private_key,
      scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
    });

    const analyticsdata = google.analyticsdata({ version: "v1beta", auth });
    const propertyIdTrim = propertyId.trim();
    const property = propertyIdTrim.startsWith("properties/")
      ? propertyIdTrim
      : `properties/${propertyIdTrim}`;
    const { current, previous } = dateRangeLiterals(range);

    const { data: totalsBody } = await analyticsdata.properties.runReport({
      property,
      requestBody: {
        dateRanges: [current, previous],
        metrics: [{ name: "sessions" }, { name: "bounceRate" }, { name: "averageSessionDuration" }],
      },
    });

    const mv = totalsBody.rows?.[0]?.metricValues ?? [];
    const sessionsCur = Number(mv[0]?.value ?? 0);
    const sessionsPrev = Number(mv[1]?.value ?? 0);
    const bounceCur = Number(mv[2]?.value ?? 0);
    const bouncePrev = Number(mv[3]?.value ?? 0);
    const durationCur = Number(mv[4]?.value ?? 0);
    const durationPrev = Number(mv[5]?.value ?? 0);

    const { data: pagesBody } = await analyticsdata.properties.runReport({
      property,
      requestBody: {
        dateRanges: [{ startDate: current.startDate, endDate: current.endDate }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "sessions" }, { name: "screenPageViews" }, { name: "engagementRate" }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
        limit: "10",
      },
    });

    const topPages =
      pagesBody.rows?.map((row) => {
        const page = row.dimensionValues?.[0]?.value ?? "(not set)";
        const s = Number(row.metricValues?.[0]?.value ?? 0);
        const v = Number(row.metricValues?.[1]?.value ?? 0);
        const er = Number(row.metricValues?.[2]?.value ?? 0);
        return {
          page,
          sessions: formatInt(s),
          screenPageViews: formatInt(v),
          engagementRate: formatPctFromRatio(Number.isFinite(er) ? er : 0),
        };
      }) ?? [];

    return {
      source: "live",
      totals: {
        sessions: formatInt(sessionsCur),
        bounceRate: formatPctFromRatio(Number.isFinite(bounceCur) ? bounceCur : 0),
        avgSessionDuration: formatDuration(Number.isFinite(durationCur) ? durationCur : 0),
        changes: {
          sessions: formatSessionsDelta(sessionsCur, sessionsPrev),
          bounceRate: formatSignedPctPointDelta(
            Number.isFinite(bounceCur) ? bounceCur : 0,
            Number.isFinite(bouncePrev) ? bouncePrev : 0,
          ),
          avgSessionDuration: formatSignedDurationDelta(
            (Number.isFinite(durationCur) ? durationCur : 0) - (Number.isFinite(durationPrev) ? durationPrev : 0),
          ),
        },
      },
      topPages: topPages.slice(0, 10),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "GA4 request failed";
    console.error("[ga4] fetchGa4DashboardSnapshot:", message);
    return getGa4DashboardUnavailable(message);
  }
}
