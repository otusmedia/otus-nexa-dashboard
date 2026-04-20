"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ModuleGuard } from "@/components/layout/module-guard";
import { Modal } from "@/components/ui/modal";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { useMetaAds } from "@/context/meta-ads-context";
import { canImportData } from "@/lib/can-import-data";
import { parseInstagramInsightsCsv, type InstagramInsightMetricRow } from "@/lib/parse-instagram-csv";
import { parseMetaAdsCsv } from "@/lib/parse-meta-csv";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { MetaAdsCampaign, MetaAdsSummary } from "@/types/meta-ads";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Heart,
  ImageIcon,
  Info,
  MessageCircle,
  MoreHorizontal,
  Play,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { mergeProjectsByColumn } from "@/app/(platform)/projects/data";

const INSTAGRAM_INSIGHTS_STORAGE_KEY = "instagram-insights-import";

const META_ADS_METRIC_CARD_LABELS = ["Impressions", "Clicks", "CTR", "CPL", "ROAS"] as const;

type IgMonthlyBar = { label: string; heightPct: number; reachValue: number };

const INSTAGRAM_MONTHLY_EMPTY_CHART: IgMonthlyBar[] = Array.from({ length: 12 }, () => ({
  label: "—",
  heightPct: 3,
  reachValue: 0,
}));

type MetaApiCampaignRow = {
  campaignName: string;
  status: string;
  amountSpent: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  reach: number;
  frequency: number;
  results: number;
  costPerResult: number;
};

type InstagramApiPayload = {
  reach: number;
  impressions: number;
  profileVisits: number;
  engagementRate: number;
  followersCount: number;
  mediaCount: number;
  source: string;
  reachGrowthPct?: number;
  totalInteractions?: number;
};

type MetaCreativeApiRow = {
  id: string;
  name: string;
  imageUrl: string;
  ctr: number;
  impressions: number;
  spend: number;
  platform: "Meta";
};

/** Coerce Meta creatives API numbers that may arrive as strings from Graph. */
function coerceCreativeMetricNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v ?? "").trim().replace(/,/g, "");
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function normalizeMetaCreativeApiRow(raw: unknown): MetaCreativeApiRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : String(o.id ?? "");
  if (!id) return null;
  const name = typeof o.name === "string" ? o.name : String(o.name ?? "Ad");
  const imageUrl = typeof o.imageUrl === "string" ? o.imageUrl : String(o.imageUrl ?? "");
  let impressions = Math.max(0, Math.round(coerceCreativeMetricNumber(o.impressions)));
  let ctr = coerceCreativeMetricNumber(o.ctr);
  if (ctr > 0 && ctr <= 1) ctr *= 100;
  const spend = coerceCreativeMetricNumber(o.spend);
  if (impressions === 0 && ctr === 0) {
    const ins = o.insights as { data?: Array<Record<string, unknown>> } | undefined;
    const row0 = Array.isArray(ins?.data) ? ins.data[0] : undefined;
    if (row0) {
      impressions = Math.max(0, Math.round(coerceCreativeMetricNumber(row0.impressions)));
      let c2 = coerceCreativeMetricNumber(row0.ctr);
      if (c2 > 0 && c2 <= 1) c2 *= 100;
      if (c2 > 0) ctr = c2;
    }
  }
  return {
    id,
    name,
    imageUrl,
    ctr: Number.isFinite(ctr) ? ctr : 0,
    impressions,
    spend,
    platform: "Meta",
  };
}

const META_ADS_MANAGER_URL = "https://www.facebook.com/adsmanager";

function mapMetaApiRowToCampaign(c: MetaApiCampaignRow): MetaAdsCampaign {
  return {
    campaignName: c.campaignName,
    startDate: "—",
    endDate: "—",
    status: c.status,
    results: c.results,
    reach: c.reach,
    frequency: c.frequency,
    costPerResult: c.costPerResult,
    amountSpent: c.amountSpent,
    impressions: c.impressions,
    cpm: c.cpm,
    linkClicks: c.clicks,
    cpc: c.cpc,
    ctr: Number.isFinite(c.ctr) ? c.ctr : 0,
    landingPageViews: 0,
  };
}

function formatSummaryCtrPct(avg: number): string {
  if (!Number.isFinite(avg) || avg <= 0) return "0.00%";
  const pct = avg <= 1 ? avg * 100 : avg;
  return `${pct.toFixed(2)}%`;
}

function buildInstagramMetricsFromApi(p: InstagramApiPayload): InstagramInsightMetricRow[] {
  const f = (n: number) => Math.round(n).toLocaleString("en-US");
  const max = Math.max(p.reach, p.impressions, p.profileVisits, p.followersCount, 1);
  const bar = (v: number) => Math.min(100, Math.round((v / max) * 100));
  return [
    { label: "Reach", value: f(p.reach), change: "", progress: bar(p.reach) },
    { label: "Impressions", value: f(p.impressions), change: "", progress: bar(p.impressions) },
    {
      label: "Engagement Rate",
      value: `${Number.isFinite(p.engagementRate) ? p.engagementRate.toFixed(1) : "0.0"}%`,
      change: "",
      progress: Math.min(100, Math.round((Number.isFinite(p.engagementRate) ? p.engagementRate : 0) * 8)),
    },
    { label: "Profile Visits", value: f(p.profileVisits), change: "", progress: bar(p.profileVisits) },
    { label: "Followers", value: f(p.followersCount), change: "", progress: bar(p.followersCount) },
  ];
}

function buildInstagramZeroMetrics(): InstagramInsightMetricRow[] {
  return [
    { label: "Reach", value: "0", change: "", progress: 0 },
    { label: "Impressions", value: "0", change: "", progress: 0 },
    { label: "Engagement Rate", value: "0.0%", change: "", progress: 0 },
    { label: "Profile Visits", value: "0", change: "", progress: 0 },
    { label: "Followers", value: "0", change: "", progress: 0 },
  ];
}

const metaAdsMetricsEmpty: { label: string; value: string }[] = [
  { label: "Impressions", value: "0" },
  { label: "Clicks", value: "0" },
  { label: "CTR", value: "0.00%" },
  { label: "CPL", value: "$0.00" },
  { label: "ROAS", value: "—" },
];

function metaDatePresetFromRange(dateRange: string): string {
  if (dateRange === "7d") return "last_7d";
  if (dateRange === "90d") return "last_90d";
  return "last_30d";
}

function addDaysUtcYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d, 12, 0, 0);
  return new Date(t + deltaDays * 86400000).toISOString().slice(0, 10);
}

/** Interpret YYYY-MM-DD as UTC calendar days (matches API unix handling). */
function ymdUtcToUnixRange(startYmd: string, endYmd: string): { since: number; until: number } | null {
  const [ys, ms, ds] = startYmd.split("-").map(Number);
  const [ye, me, de] = endYmd.split("-").map(Number);
  if (![ys, ms, ds, ye, me, de].every((n) => Number.isFinite(n))) return null;
  const since = Math.floor(Date.UTC(ys, ms - 1, ds, 0, 0, 0) / 1000);
  const until = Math.floor(Date.UTC(ye, me - 1, de, 23, 59, 59) / 1000);
  if (since > until) return null;
  return { since, until };
}

function formatCustomRangeButtonLabel(startYmd: string, endYmd: string): string {
  const a = new Date(`${startYmd}T12:00:00.000Z`);
  const b = new Date(`${endYmd}T12:00:00.000Z`);
  const fmt = (dt: Date) =>
    dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(a)} — ${fmt(b)}`;
}

type DashboardCustomRange = { since: number; until: number; startYmd: string; endYmd: string };

function formatUsdSpend(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function formatRowCtr(ctr: number): string {
  if (ctr <= 0) return "0.00%";
  if (ctr <= 1) return `${(ctr * 100).toFixed(2)}%`;
  return `${ctr.toFixed(2)}%`;
}

function formatRowCpl(c: MetaAdsCampaign): string {
  const v = c.results > 0 ? c.amountSpent / c.results : c.costPerResult;
  return `$${v.toFixed(2)}`;
}

type DashboardDateRangeId = "7d" | "30d" | "90d" | "custom";

const DASHBOARD_VS_PERIOD_TEXT_CLASS = "text-[0.7rem] font-light text-[rgba(255,255,255,0.4)]";
const DASHBOARD_VS_SUBTEXT_CLASS = `mt-0.5 ${DASHBOARD_VS_PERIOD_TEXT_CLASS}`;

function dashboardVsPeriodLabel(dateRange: DashboardDateRangeId, lt: (k: string) => string): string {
  if (dateRange === "7d") return lt("vs last 7 days");
  if (dateRange === "90d") return lt("vs last 90 days");
  if (dateRange === "custom") return lt("vs previous period");
  return lt("vs last 30 days");
}

type DashboardDeltaTone = "positive" | "negative" | "zero" | "na";

function dashboardDeltaToneFromString(raw: string, invert: boolean): DashboardDeltaTone {
  const t = raw.trim();
  if (t === "" || t === "—" || t === "–") return "na";
  const timeM = t.match(/^([+-]?)(\d+:\d{2})$/);
  if (timeM) {
    const sign = timeM[1] === "-" ? "-" : "+";
    const [mmRaw, ssRaw] = timeM[2].split(":");
    const mm = Number(mmRaw);
    const ss = Number(ssRaw);
    if (mm === 0 && ss === 0) return "zero";
    const neg = sign === "-";
    if (invert) return neg ? "positive" : "negative";
    return neg ? "negative" : "positive";
  }
  const pctM = t.match(/^([+-]?)(\d+(?:\.\d+)?)\s*%$/);
  if (pctM) {
    const neg = pctM[1] === "-";
    const n = Number(pctM[2]);
    if (!Number.isFinite(n) || n === 0) return "zero";
    if (invert) return neg ? "positive" : "negative";
    return neg ? "negative" : "positive";
  }
  if (t.startsWith("-")) {
    if (invert) return "positive";
    return "negative";
  }
  if (t.startsWith("+")) {
    if (invert) return "negative";
    return "positive";
  }
  const n = Number.parseFloat(t.replace(/[^\d.-]/g, ""));
  if (Number.isFinite(n) && n === 0) return "zero";
  return "na";
}

function dashboardDeltaPrimaryClass(tone: DashboardDeltaTone): string {
  switch (tone) {
    case "positive":
      return "text-[#379136]";
    case "negative":
      return "text-[#ef4444]";
    default:
      return "text-[rgba(255,255,255,0.3)]";
  }
}

function dashboardFormatComparisonPrimary(raw: string): string {
  const t = raw.trim();
  if (t === "" || t === "—" || t === "–") return "—";
  if (/^([+-]?)(\d+:\d{2})$/.test(t)) {
    if (t.startsWith("-") || t.startsWith("+")) return t;
    return `+${t}`;
  }
  const pctM = t.match(/^([+-]?)(\d+(?:\.\d+)?)\s*%$/);
  if (pctM) {
    const sign = pctM[1];
    const body = pctM[2];
    const n = Number(body);
    if (!Number.isFinite(n)) return t;
    if (sign === "-") return `-${body}%`;
    if (n === 0) return "+0.0%";
    return `+${body}%`;
  }
  return t;
}

function isActiveMetaStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s.includes("ativ") || s.includes("active") || s.includes("em veiculação") || s === "on";
}

function DashboardVsComparisonBlock({
  primaryRaw,
  invert,
  dateRange,
  lt,
}: {
  primaryRaw: string;
  invert: boolean;
  dateRange: DashboardDateRangeId;
  lt: (k: string) => string;
}) {
  const display = dashboardFormatComparisonPrimary(primaryRaw);
  const tone = dashboardDeltaToneFromString(primaryRaw, invert);
  return (
    <div className="mt-1">
      <p className={cn("mono-num text-xs font-light", dashboardDeltaPrimaryClass(tone))}>{display}</p>
      <p className={DASHBOARD_VS_SUBTEXT_CLASS}>{dashboardVsPeriodLabel(dateRange, lt)}</p>
    </div>
  );
}

const googleAdsPlaceholderMetrics = [
  { label: "Impressions", value: "—" },
  { label: "Clicks", value: "—" },
  { label: "CTR", value: "—" },
  { label: "CPC", value: "—" },
  { label: "Conversions", value: "—" },
] as const;

const GA4_ANALYTICS_HOME = "https://analytics.google.com/analytics/web/";

type Ga4WebsiteState = {
  loading: boolean;
  source: "live" | "mock";
  error?: string;
  totals: {
    sessions: string;
    bounceRate: string;
    avgSessionDuration: string;
    changes: { sessions: string; bounceRate: string; avgSessionDuration: string };
  };
  topPages: Array<{ page: string; sessions: string; screenPageViews: string; engagementRate: string }>;
};

const ga4WebsiteInitial: Ga4WebsiteState = {
  loading: true,
  source: "mock",
  totals: {
    sessions: "0",
    bounceRate: "0%",
    avgSessionDuration: "00:00",
    changes: { sessions: "—", bounceRate: "—", avgSessionDuration: "—" },
  },
  topPages: [],
};


type TopCreativePlatform = "Meta" | "Google";

type TopCreativeStored = {
  id: string;
  name: string;
  platform: TopCreativePlatform;
  adUrl: string;
  ctr: number;
  impressions: number;
  imageUrl?: string;
  spend?: number;
  isFromApi?: boolean;
};

type TopCreativeDraftSlot = {
  id: string;
  name: string;
  platform: TopCreativePlatform;
  adUrl: string;
  ctr: string;
  impressions: string;
};

function newCreativeDraftSlot(): TopCreativeDraftSlot {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `slot-${Date.now()}-${Math.random()}`,
    name: "",
    platform: "Meta",
    adUrl: "",
    ctr: "",
    impressions: "",
  };
}

function parseTopCreativesFromStorage(raw: string): TopCreativeStored[] | null {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return null;
    const out: TopCreativeStored[] = [];
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : "";
      const name = typeof o.name === "string" ? o.name : "";
      const platform = o.platform === "Google" ? "Google" : o.platform === "Meta" ? "Meta" : null;
      const adUrl = typeof o.adUrl === "string" ? o.adUrl : "";
      const ctr = typeof o.ctr === "number" && Number.isFinite(o.ctr) ? o.ctr : Number(o.ctr) || 0;
      const impressions =
        typeof o.impressions === "number" && Number.isFinite(o.impressions) ? o.impressions : Number(o.impressions) || 0;
      const imageUrl = typeof o.imageUrl === "string" ? o.imageUrl : "";
      const spend =
        typeof o.spend === "number" && Number.isFinite(o.spend) ? o.spend : Number(o.spend) || 0;
      if (!platform) continue;
      out.push({
        id: id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `id-${out.length}`),
        name,
        platform,
        adUrl,
        ctr,
        impressions,
        ...(imageUrl ? { imageUrl } : {}),
        ...(spend > 0 ? { spend } : {}),
      });
    }
    return out.slice(0, 6);
  } catch {
    return null;
  }
}

function storedToDraftSlots(items: TopCreativeStored[]): TopCreativeDraftSlot[] {
  return items.map((c) => ({
    id: c.id,
    name: c.name,
    platform: c.platform,
    adUrl: c.adUrl,
    ctr: c.ctr === 0 ? "" : String(c.ctr),
    impressions: c.impressions === 0 ? "" : String(c.impressions),
  }));
}


type InstagramFeedPostStored = {
  id: string;
  imageUrl: string;
  likes: number;
  comments: number;
  caption: string;
  permalink?: string;
  isVideo?: boolean;
};

type InstagramFeedDraftSlot = {
  id: string;
  imageUrl: string;
  likes: string;
  comments: string;
  caption: string;
};

function newInstagramFeedDraftSlot(): InstagramFeedDraftSlot {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ig-slot-${Date.now()}-${Math.random()}`,
    imageUrl: "",
    likes: "",
    comments: "",
    caption: "",
  };
}

function parseInstagramFeedFromStorage(raw: string): InstagramFeedPostStored[] | null {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return null;
    const out: InstagramFeedPostStored[] = [];
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const imageUrl = typeof o.imageUrl === "string" ? o.imageUrl : "";
      const likesRaw = o.likes;
      const likes =
        typeof likesRaw === "number" && Number.isFinite(likesRaw)
          ? Math.max(0, Math.round(likesRaw))
          : Math.max(0, Math.round(Number(String(likesRaw ?? "").replace(/,/g, ""))) || 0);
      const commentsRaw = o.comments;
      const comments =
        typeof commentsRaw === "number" && Number.isFinite(commentsRaw)
          ? Math.max(0, Math.round(commentsRaw))
          : Math.max(0, Math.round(Number(String(commentsRaw ?? "").replace(/,/g, ""))) || 0);
      const caption = typeof o.caption === "string" ? o.caption.slice(0, 200) : "";
      const idRaw = o.id;
      const id =
        typeof idRaw === "string" && idRaw.length > 0
          ? idRaw
          : typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `ig-${out.length}-${Math.random()}`;
      const permalink = typeof o.permalink === "string" ? o.permalink : "";
      const isVideo = o.isVideo === true;
      out.push({
        id,
        imageUrl,
        likes,
        comments,
        caption,
        ...(permalink ? { permalink } : {}),
        ...(isVideo ? { isVideo: true } : {}),
      });
    }
    return out.slice(0, 9);
  } catch {
    return null;
  }
}

function storedPostsToDraftSlots(posts: InstagramFeedPostStored[]): InstagramFeedDraftSlot[] {
  return posts.map((p) => ({
    id: p.id,
    imageUrl: p.imageUrl,
    likes: p.likes === 0 ? "" : String(p.likes),
    comments: p.comments === 0 ? "" : String(p.comments),
    caption: p.caption,
  }));
}

type HighlightSlide = {
  key: string;
  projectId: string;
  taskId: string;
  title: string;
  description: string;
  coverImage: string | null;
};

export function DashboardModule() {
  const { activity, t, td, projectsByColumn, currentUser } = useAppContext();
  const { t: lt } = useLanguage();
  const metaAds = useMetaAds();
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "custom">("30d");
  const [customApplied, setCustomApplied] = useState<DashboardCustomRange | null>(null);
  const [customPopoverOpen, setCustomPopoverOpen] = useState(false);
  const [customDraftStart, setCustomDraftStart] = useState("");
  const [customDraftEnd, setCustomDraftEnd] = useState("");
  const [metaLive, setMetaLive] = useState<{
    campaigns: MetaApiCampaignRow[];
    summary: MetaAdsSummary;
    spendGrowthPct: number | null;
  } | null>(null);
  const [metaApiLoading, setMetaApiLoading] = useState(true);
  const [igLive, setIgLive] = useState<InstagramApiPayload | null>(null);
  const [igApiLoading, setIgApiLoading] = useState(true);
  const [igInsightsError, setIgInsightsError] = useState<string | null>(null);
  const [metaInsightsError, setMetaInsightsError] = useState<string | null>(null);
  const [igMonthlyLoading, setIgMonthlyLoading] = useState(true);
  const [igMonthlyBars, setIgMonthlyBars] = useState<IgMonthlyBar[] | null>(null);
  const [igMonthlyError, setIgMonthlyError] = useState<string | null>(null);
  const [creativesApiLoading, setCreativesApiLoading] = useState(true);
  const [creativesLive, setCreativesLive] = useState<MetaCreativeApiRow[] | null>(null);
  const [creativesApiError, setCreativesApiError] = useState<string | null>(null);
  const [instagramFeedLoading, setInstagramFeedLoading] = useState(true);
  const [instagramFeedSource, setInstagramFeedSource] = useState<"live" | "manual" | null>(null);
  const [instagramFeedError, setInstagramFeedError] = useState<string | null>(null);
  const instagramFeedManualBackup = useRef<InstagramFeedPostStored[] | null>(null);
  const highlightsRef = useRef<HTMLDivElement | null>(null);
  const [activeHighlightIndex, setActiveHighlightIndex] = useState(0);
  const [ga4Website, setGa4Website] = useState<Ga4WebsiteState>(ga4WebsiteInitial);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    campaigns: MetaAdsCampaign[];
    summary: MetaAdsSummary;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importSuccessMessage, setImportSuccessMessage] = useState("");
  const [campaignsTableOpen, setCampaignsTableOpen] = useState(false);
  const [showAllCampaigns, setShowAllCampaigns] = useState(false);
  const [googleCampaignsHint, setGoogleCampaignsHint] = useState(false);
  const googleCampaignsHintTimeoutRef = useRef<number | null>(null);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const [instagramImported, setInstagramImported] = useState<{
    metrics: InstagramInsightMetricRow[];
    lastImported: string;
  } | null>(null);
  const [igImportModalOpen, setIgImportModalOpen] = useState(false);
  const [igImportPreview, setIgImportPreview] = useState<{ metrics: InstagramInsightMetricRow[] } | null>(null);
  const [igImportError, setIgImportError] = useState<string | null>(null);
  const [igImportSuccess, setIgImportSuccess] = useState(false);
  const [igImportSuccessMessage, setIgImportSuccessMessage] = useState("");
  const igImportFileInputRef = useRef<HTMLInputElement | null>(null);

  const [topCreativesCustom, setTopCreativesCustom] = useState<TopCreativeStored[] | null>(null);
  const [creativesModalOpen, setCreativesModalOpen] = useState(false);
  const [creativesDraft, setCreativesDraft] = useState<TopCreativeDraftSlot[]>([]);

  const [instagramFeedPosts, setInstagramFeedPosts] = useState<InstagramFeedPostStored[] | null>(null);
  const [instagramFeedExpanded, setInstagramFeedExpanded] = useState(false);
  const [instagramFeedModalOpen, setInstagramFeedModalOpen] = useState(false);
  const [instagramFeedDraft, setInstagramFeedDraft] = useState<InstagramFeedDraftSlot[]>([]);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiActiveTasks, setKpiActiveTasks] = useState(0);
  const [kpiTotalTasks, setKpiTotalTasks] = useState(0);
  const [kpiCompletedProjects, setKpiCompletedProjects] = useState(0);
  const [kpiTotalProjects, setKpiTotalProjects] = useState(0);

  const topCreativesDisplay = useMemo(() => {
    if (creativesLive !== null && creativesLive.length > 0) {
      return creativesLive.map((c) => ({
        id: c.id,
        name: c.name,
        platform: c.platform as TopCreativePlatform,
        adUrl: "",
        ctr: c.ctr,
        impressions: c.impressions,
        imageUrl: c.imageUrl,
        spend: c.spend,
        isFromApi: true,
      }));
    }
    if (topCreativesCustom !== null && topCreativesCustom.length > 0) return topCreativesCustom;
    return [];
  }, [creativesLive, topCreativesCustom]);

  const creativesDataIsLive = creativesLive !== null && creativesLive.length > 0;

  const metaDataMode = useMemo(() => {
    if (metaApiLoading) return "loading" as const;
    if (metaLive) return "live" as const;
    if (metaAds.source === "csv" && metaAds.summary) return "csv" as const;
    return "mock" as const;
  }, [metaApiLoading, metaLive, metaAds.source, metaAds.summary]);

  const metaDisplayCampaigns = useMemo((): MetaAdsCampaign[] => {
    if (metaLive) return metaLive.campaigns.map(mapMetaApiRowToCampaign);
    if (metaAds.source === "csv" && metaAds.campaigns.length) return metaAds.campaigns;
    return [];
  }, [metaLive, metaAds.source, metaAds.campaigns]);

  const metaSpendDisplay = useMemo(() => {
    if (metaLive) return formatUsdSpend(metaLive.summary.totalSpent);
    if (metaAds.source === "csv" && metaAds.summary) return formatUsdSpend(metaAds.summary.totalSpent);
    return formatUsdSpend(0);
  }, [metaLive, metaAds.source, metaAds.summary]);

  const metaMetricsRows = useMemo(() => {
    if (metaLive) {
      const s = metaLive.summary;
      return [
        { label: "Impressions", value: s.totalImpressions.toLocaleString("en-US") },
        { label: "Clicks", value: s.totalClicks.toLocaleString("en-US") },
        { label: "CTR", value: formatSummaryCtrPct(s.averageCTR) },
        { label: "CPL", value: `$${s.averageCPL.toFixed(2)}` },
        { label: "ROAS", value: "—" },
      ];
    }
    if (metaAds.source === "csv" && metaAds.summary) {
      return [
        { label: "Impressions", value: metaAds.summary.totalImpressions.toLocaleString("en-US") },
        { label: "Clicks", value: metaAds.summary.totalClicks.toLocaleString("en-US") },
        { label: "CTR", value: `${metaAds.summary.averageCTR.toFixed(2)}%` },
        { label: "CPL", value: `$${metaAds.summary.averageCPL.toFixed(2)}` },
        { label: "ROAS", value: "—" },
      ];
    }
    return [...metaAdsMetricsEmpty];
  }, [metaLive, metaAds.source, metaAds.summary]);

  const igDataMode = useMemo(() => {
    if (igApiLoading) return "loading" as const;
    if (igLive) return "live" as const;
    if (instagramImported?.metrics && instagramImported.metrics.length > 0) return "csv" as const;
    return "mock" as const;
  }, [igApiLoading, igLive, instagramImported]);

  const igDisplayMetrics = useMemo((): InstagramInsightMetricRow[] => {
    if (igLive) return buildInstagramMetricsFromApi(igLive);
    if (instagramImported?.metrics && instagramImported.metrics.length > 0) return instagramImported.metrics;
    return buildInstagramZeroMetrics();
  }, [igLive, instagramImported]);

  const csvBadgeDate =
    metaAds.source === "csv" && metaAds.lastImported
      ? new Date(metaAds.lastImported).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null;

  const igCsvBadgeDate =
    instagramImported?.lastImported != null
      ? new Date(instagramImported.lastImported).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : null;

  const resetImportModal = () => {
    setImportPreview(null);
    setImportError(null);
    setImportSuccess(false);
    setImportSuccessMessage("");
    if (importFileInputRef.current) importFileInputRef.current.value = "";
  };

  const closeImportModal = () => {
    setImportModalOpen(false);
    resetImportModal();
  };

  const handleImportFile = (file: File | null) => {
    setImportError(null);
    setImportPreview(null);
    if (!file) return;
    void file.text().then(
      (text) => {
        try {
          setImportPreview(parseMetaAdsCsv(text));
        } catch {
          setImportError("Could not parse CSV.");
        }
      },
      () => setImportError("Could not read file."),
    );
  };

  const confirmImportCsv = () => {
    if (!importPreview) return;
    metaAds.setImportedCsv(importPreview);
    setImportSuccessMessage(`Data imported successfully — ${new Date().toLocaleString()}`);
    setImportSuccess(true);
    setImportPreview(null);
    if (importFileInputRef.current) importFileInputRef.current.value = "";
    window.setTimeout(() => {
      setImportSuccess(false);
      setImportSuccessMessage("");
      setImportModalOpen(false);
    }, 2200);
  };

  const resetIgImportModal = () => {
    setIgImportPreview(null);
    setIgImportError(null);
    setIgImportSuccess(false);
    setIgImportSuccessMessage("");
    if (igImportFileInputRef.current) igImportFileInputRef.current.value = "";
  };

  const closeIgImportModal = () => {
    setIgImportModalOpen(false);
    resetIgImportModal();
  };

  const handleIgImportFile = (file: File | null) => {
    setIgImportError(null);
    setIgImportPreview(null);
    if (!file) return;
    void file.text().then(
      (text) => {
        try {
          setIgImportPreview(parseInstagramInsightsCsv(text));
        } catch (e) {
          setIgImportError(e instanceof Error ? e.message : "Could not parse CSV.");
        }
      },
      () => setIgImportError("Could not read file."),
    );
  };

  const confirmIgImportCsv = () => {
    if (!igImportPreview) return;
    const iso = new Date().toISOString();
    const payload = { metrics: igImportPreview.metrics, lastImported: iso };
    setInstagramImported(payload);
    try {
      localStorage.setItem(INSTAGRAM_INSIGHTS_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* ignore quota */
    }
    setIgImportSuccessMessage(`Data imported successfully — ${new Date().toLocaleString()}`);
    setIgImportSuccess(true);
    setIgImportPreview(null);
    if (igImportFileInputRef.current) igImportFileInputRef.current.value = "";
    window.setTimeout(() => {
      setIgImportSuccess(false);
      setIgImportSuccessMessage("");
      setIgImportModalOpen(false);
    }, 2200);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(INSTAGRAM_INSIGHTS_STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { metrics: InstagramInsightMetricRow[]; lastImported: string };
      if (Array.isArray(data.metrics) && data.metrics.length > 0 && data.lastImported) {
        setInstagramImported({ metrics: data.metrics, lastImported: data.lastImported });
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    void supabase
      .from("creatives")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          console.error("[supabase] creatives fetch failed:", error.message);
          setTopCreativesCustom(null);
          return;
        }
        const rows: TopCreativeStored[] = ((data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
          id: String(row.id ?? ""),
          name: String(row.name ?? ""),
          platform: row.platform === "Google" ? "Google" : "Meta",
          adUrl: String(row.ad_url ?? ""),
          ctr: Number(row.ctr ?? 0) || 0,
          impressions: Number(row.impressions ?? 0) || 0,
          imageUrl: String(row.image_url ?? ""),
        }));
        setTopCreativesCustom(rows.length > 0 ? rows : null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    setInstagramFeedSource(null);
    setInstagramFeedError(null);
    setInstagramFeedLoading(true);
    setInstagramFeedPosts(null);

    void Promise.all([
      supabase.from("instagram_posts").select("*").order("created_at", { ascending: false }),
      fetch("/api/instagram-feed").then((r) => r.json()),
    ])
      .then(([postsRes, json]) => {
        if (cancelled) return;
        if (postsRes.error) {
          console.error("[supabase] instagram_posts fetch failed:", postsRes.error.message);
          instagramFeedManualBackup.current = null;
        } else {
          const backup: InstagramFeedPostStored[] = ((postsRes.data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
            id: String(row.id ?? ""),
            imageUrl: String(row.image_url ?? ""),
            likes: Number(row.likes ?? 0) || 0,
            comments: Number(row.comments ?? 0) || 0,
            caption: String(row.caption ?? ""),
          }));
          instagramFeedManualBackup.current = backup.length > 0 ? backup : null;
        }
        const err = typeof json.error === "string" ? json.error : null;
        const posts = json.posts;
        if (!err && Array.isArray(posts)) {
          const normalized: InstagramFeedPostStored[] = posts.map((p: Record<string, unknown>, idx: number) => ({
            id: String(p.id ?? `ig-${idx}`),
            imageUrl: String(p.imageUrl ?? ""),
            likes: typeof p.likes === "number" ? p.likes : Number(p.likes) || 0,
            comments: typeof p.comments === "number" ? p.comments : Number(p.comments) || 0,
            caption: typeof p.caption === "string" ? p.caption : "",
            permalink: typeof p.permalink === "string" && p.permalink.length > 0 ? p.permalink : undefined,
            isVideo: p.isVideo === true,
          }));
          setInstagramFeedPosts(normalized.length > 0 ? normalized : []);
          setInstagramFeedSource("live");
          return;
        }
        const restore = instagramFeedManualBackup.current;
        if (restore && restore.length > 0) {
          setInstagramFeedPosts(restore);
          setInstagramFeedSource("manual");
        } else {
          setInstagramFeedPosts(null);
          setInstagramFeedSource("manual");
        }
        setInstagramFeedError(err ?? "Feed unavailable");
        if (err) console.error("[dashboard] Instagram feed API:", err);
      })
      .catch((e) => {
        console.error("[dashboard] Instagram feed fetch:", e);
        if (cancelled) return;
        const restore = instagramFeedManualBackup.current;
        if (restore && restore.length > 0) {
          setInstagramFeedPosts(restore);
          setInstagramFeedSource("manual");
        } else {
          setInstagramFeedPosts(null);
          setInstagramFeedSource(null);
        }
        setInstagramFeedError("Network error");
      })
      .finally(() => {
        if (!cancelled) setInstagramFeedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const openCreativesModal = () => {
    const base = topCreativesDisplay.slice(0, 6);
    setCreativesDraft(base.length > 0 ? storedToDraftSlots(base) : [newCreativeDraftSlot()]);
    setCreativesModalOpen(true);
  };

  const closeCreativesModal = () => {
    setCreativesModalOpen(false);
  };

  const saveCreativesFromModal = () => {
    const saved: TopCreativeStored[] = creativesDraft
      .slice(0, 6)
      .map((slot) => {
        const ctrNum = slot.ctr.trim() === "" ? 0 : Number(slot.ctr.replace(",", "."));
        const impNum = slot.impressions.trim() === "" ? 0 : Number(slot.impressions.replace(/,/g, ""));
        return {
          id: slot.id,
          name: slot.name.trim(),
          platform: slot.platform,
          adUrl: slot.adUrl.trim(),
          ctr: Number.isFinite(ctrNum) ? ctrNum : 0,
          impressions: Number.isFinite(impNum) ? Math.round(impNum) : 0,
        };
      })
      .filter((c) => c.name.length > 0);
    if (saved.length === 0) {
      setTopCreativesCustom(null);
      void supabase.from("creatives").delete().not("id", "is", null).then(({ error }) => {
        if (error) console.error("[supabase] creatives clear failed:", error.message);
      });
    } else {
      setTopCreativesCustom(saved);
      void supabase.from("creatives").delete().not("id", "is", null).then(({ error }) => {
        if (error) console.error("[supabase] creatives reset failed:", error.message);
      });
      void supabase
        .from("creatives")
        .insert(
          saved.map((creative) => ({
            id: creative.id,
            name: creative.name,
            platform: creative.platform,
            ad_url: creative.adUrl,
            ctr: creative.ctr,
            impressions: creative.impressions,
            image_url: creative.imageUrl ?? "",
          })),
        )
        .then(({ error }) => {
          if (error) console.error("[supabase] creatives insert failed:", error.message);
        });
    }
    setCreativesModalOpen(false);
  };

  const addCreativeDraftSlot = () => {
    setCreativesDraft((d) => (d.length >= 6 ? d : [...d, newCreativeDraftSlot()]));
  };

  const removeCreativeDraftSlot = (id: string) => {
    setCreativesDraft((d) => {
      const next = d.filter((s) => s.id !== id);
      return next.length > 0 ? next : [newCreativeDraftSlot()];
    });
  };

  const openInstagramFeedModal = () => {
    const base =
      instagramFeedPosts !== null && instagramFeedPosts.length > 0
        ? storedPostsToDraftSlots(instagramFeedPosts)
        : [newInstagramFeedDraftSlot()];
    setInstagramFeedDraft(base);
    setInstagramFeedModalOpen(true);
  };

  const closeInstagramFeedModal = () => {
    setInstagramFeedModalOpen(false);
  };

  const parseIgFeedIntInput = (s: string) => {
    const n = Math.round(Number(String(s).replace(/,/g, "")));
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  };

  const saveInstagramFeedFromModal = () => {
    const saved: InstagramFeedPostStored[] = instagramFeedDraft
      .slice(0, 9)
      .map((slot) => ({
        id: slot.id,
        imageUrl: slot.imageUrl.trim(),
        likes: parseIgFeedIntInput(slot.likes),
        comments: parseIgFeedIntInput(slot.comments),
        caption: slot.caption.slice(0, 200),
      }))
      .filter(
        (p) => p.imageUrl.length > 0 || p.caption.trim().length > 0 || p.likes > 0 || p.comments > 0,
      );
    if (saved.length === 0) {
      setInstagramFeedPosts(null);
      void supabase.from("instagram_posts").delete().not("id", "is", null).then(({ error }) => {
        if (error) console.error("[supabase] instagram_posts clear failed:", error.message);
      });
    } else {
      setInstagramFeedPosts(saved);
      void supabase.from("instagram_posts").delete().not("id", "is", null).then(({ error }) => {
        if (error) console.error("[supabase] instagram_posts reset failed:", error.message);
      });
      void supabase
        .from("instagram_posts")
        .insert(
          saved.map((post) => ({
            id: post.id,
            image_url: post.imageUrl,
            likes: post.likes,
            comments: post.comments,
            caption: post.caption,
          })),
        )
        .then(({ error }) => {
          if (error) console.error("[supabase] instagram_posts insert failed:", error.message);
        });
    }
    setInstagramFeedModalOpen(false);
  };

  const addInstagramFeedDraftSlot = () => {
    setInstagramFeedDraft((d) => (d.length >= 9 ? d : [newInstagramFeedDraftSlot(), ...d]));
  };

  const deleteInstagramFeedPostFromGrid = (postId: string) => {
    if (!canImportData(currentUser)) return;
    setInstagramFeedPosts((prev) => {
      if (!prev) return null;
      const next = prev.filter((p) => p.id !== postId);
      if (next.length === 0) {
        void supabase.from("instagram_posts").delete().not("id", "is", null).then(({ error }) => {
          if (error) console.error("[supabase] instagram_posts clear failed:", error.message);
        });
        return null;
      }
      void supabase.from("instagram_posts").delete().eq("id", postId).then(({ error }) => {
        if (error) console.error("[supabase] instagram_posts delete failed:", error.message);
      });
      return next;
    });
  };

  const removeInstagramFeedDraftSlot = (id: string) => {
    setInstagramFeedDraft((d) => {
      const next = d.filter((s) => s.id !== id);
      return next.length > 0 ? next : [newInstagramFeedDraftSlot()];
    });
  };

  const handleInstagramFeedImage = (slotId: string, file: File | null) => {
    if (!file) return;
    const mimeOk = /image\/(jpeg|png|webp)/i.test(file.type);
    const extOk = /\.(jpe?g|png|webp)$/i.test(file.name);
    if (!mimeOk && !extOk) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setInstagramFeedDraft((d) => d.map((s) => (s.id === slotId ? { ...s, imageUrl: result } : s)));
      }
    };
    reader.readAsDataURL(file);
  };

  const mergedProjects = useMemo(() => mergeProjectsByColumn(projectsByColumn), [projectsByColumn]);

  useEffect(() => {
    let cancelled = false;
    setKpiLoading(true);
    void Promise.all([
      supabase.from("tasks").select("id", { count: "exact", head: true }),
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .not("status", "in", '("Done","Published")'),
      supabase.from("projects").select("id", { count: "exact", head: true }),
      supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "Done"),
    ])
      .then(([allTasksRes, activeTasksRes, allProjectsRes, completedProjectsRes]) => {
        if (cancelled) return;
        if (allTasksRes.error) console.error("[dashboard] total tasks KPI fetch failed:", allTasksRes.error.message);
        if (activeTasksRes.error) console.error("[dashboard] active tasks KPI fetch failed:", activeTasksRes.error.message);
        if (allProjectsRes.error) console.error("[dashboard] total projects KPI fetch failed:", allProjectsRes.error.message);
        if (completedProjectsRes.error) {
          console.error("[dashboard] completed projects KPI fetch failed:", completedProjectsRes.error.message);
        }
        setKpiTotalTasks(allTasksRes.count ?? 0);
        setKpiActiveTasks(activeTasksRes.count ?? 0);
        setKpiTotalProjects(allProjectsRes.count ?? 0);
        setKpiCompletedProjects(completedProjectsRes.count ?? 0);
      })
      .finally(() => {
        if (!cancelled) setKpiLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateRange, customApplied]);

  const featuredSlides = useMemo(() => {
    const out: HighlightSlide[] = [];
    for (const p of mergedProjects) {
      for (const task of p.tasks) {
        if (task.isFeatured && task.coverImage) {
          out.push({
            key: `${p.id}-${task.id}`,
            projectId: p.id,
            taskId: task.id,
            title: task.name,
            description: task.shortDescription,
            coverImage: task.coverImage,
          });
        }
      }
    }
    return out;
  }, [mergedProjects]);

  const slides = featuredSlides;

  useEffect(() => {
    setActiveHighlightIndex((i) => Math.min(i, Math.max(0, slides.length - 1)));
  }, [slides.length]);

  useEffect(() => {
    setInstagramFeedExpanded(false);
  }, [instagramFeedPosts?.length]);

  useEffect(() => {
    let cancelled = false;
    setGa4Website((prev) => ({ ...prev, loading: true }));
    fetch(
      dateRange === "custom" && customApplied
        ? `/api/ga4/dashboard?since=${customApplied.since}&until=${customApplied.until}`
        : `/api/ga4/dashboard?range=${encodeURIComponent(dateRange)}`,
    )
      .then((res) => res.json())
      .then((json: Ga4WebsiteState) => {
        if (cancelled) return;
        setGa4Website({
          loading: false,
          source: json.source,
          error: json.error,
          totals: json.totals,
          topPages: json.topPages,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setGa4Website((prev) => ({ ...prev, loading: false, source: "mock" }));
      });
    return () => {
      cancelled = true;
    };
  }, [dateRange, customApplied]);

  useEffect(() => {
    let cancelled = false;
    setMetaApiLoading(true);
    setIgApiLoading(true);
    setIgMonthlyLoading(true);
    setCreativesApiLoading(true);
    setMetaLive(null);
    setIgLive(null);
    setIgMonthlyBars(null);
    setCreativesLive(null);
    setIgInsightsError(null);
    setMetaInsightsError(null);
    setIgMonthlyError(null);
    setCreativesApiError(null);
    const metaUrl =
      dateRange === "custom" && customApplied
        ? `/api/meta-ads?since=${customApplied.since}&until=${customApplied.until}`
        : `/api/meta-ads?date_preset=${encodeURIComponent(metaDatePresetFromRange(dateRange))}`;
    const igUrl =
      dateRange === "custom" && customApplied
        ? `/api/instagram-insights?since=${customApplied.since}&until=${customApplied.until}`
        : `/api/instagram-insights?range=${encodeURIComponent(dateRange)}`;
    const monthUrl =
      dateRange === "custom" && customApplied
        ? `/api/instagram-monthly?since=${customApplied.since}&until=${customApplied.until}`
        : "/api/instagram-monthly";
    void Promise.all([
      fetch(metaUrl).then((r) => r.json()),
      fetch(igUrl).then((r) => r.json()),
      fetch(monthUrl).then((r) => r.json()),
      fetch("/api/meta-creatives").then((r) => r.json()),
    ])
      .then(([metaJson, igJson, monthJson, crJson]: Record<string, unknown>[]) => {
        if (cancelled) return;
        const metaErr = typeof metaJson.error === "string" ? metaJson.error : null;
        const metaCampaigns = metaJson.campaigns;
        const metaSummary = metaJson.summary;
        if (!metaErr && metaSummary && typeof metaSummary === "object") {
          const spendGrowthPct =
            typeof metaJson.spendGrowthPct === "number" && Number.isFinite(metaJson.spendGrowthPct)
              ? metaJson.spendGrowthPct
              : null;
          setMetaLive({
            campaigns: Array.isArray(metaCampaigns) ? (metaCampaigns as MetaApiCampaignRow[]) : [],
            summary: metaSummary as MetaAdsSummary,
            spendGrowthPct,
          });
          setMetaInsightsError(null);
        } else {
          setMetaLive(null);
          setMetaInsightsError(metaErr ?? "Meta Ads data unavailable");
          if (metaErr) console.error("[dashboard] Meta Ads API:", metaErr);
        }

        const igErr = typeof igJson.error === "string" ? igJson.error : null;
        if (!igErr && typeof igJson.reach === "number") {
          setIgLive(igJson as unknown as InstagramApiPayload);
          setIgInsightsError(null);
        } else {
          setIgLive(null);
          setIgInsightsError(igErr ?? "Instagram data unavailable");
          if (igErr) console.error("[dashboard] Instagram insights API:", igErr);
          else if (typeof igJson.reach !== "number") console.error("[dashboard] Instagram insights: invalid payload");
        }

        const mErr = typeof monthJson.error === "string" ? monthJson.error : null;
        const months = monthJson.months;
        if (!mErr && Array.isArray(months) && months.length > 0) {
          const slice = (months as { label?: string; value?: unknown }[]).slice(-12);
          const values = slice.map((m) => {
            const v = m.value;
            if (typeof v === "number" && Number.isFinite(v)) return v;
            const n = Number(String(v ?? "").replace(/,/g, ""));
            return Number.isFinite(n) ? n : 0;
          });
          const max = Math.max(...values, 0);
          const scaleMax = max > 0 ? max : 1;
          const bars = slice.map((m, i) => {
            const v = values[i] ?? 0;
            const heightPct = max > 0 ? Math.min(100, Math.round((v / scaleMax) * 100)) : 0;
            return {
              label: String(m.label ?? ""),
              heightPct,
              reachValue: v,
            };
          });
          console.log("[dashboard] Instagram monthly chart input:", {
            monthCount: slice.length,
            labels: slice.map((m) => m.label),
            values,
            max,
            bars: bars.map((b) => ({ label: b.label, heightPct: b.heightPct, reachValue: b.reachValue })),
          });
          setIgMonthlyBars(bars);
          setIgMonthlyError(null);
        } else {
          setIgMonthlyBars(null);
          setIgMonthlyError(mErr ?? "Monthly data unavailable");
          if (mErr) console.error("[dashboard] Instagram monthly API:", mErr);
        }

        const cErr = typeof crJson.error === "string" ? crJson.error : null;
        const creatives = crJson.creatives;
        if (!cErr && Array.isArray(creatives) && creatives.length > 0) {
          const normalized = creatives
            .map((row) => normalizeMetaCreativeApiRow(row))
            .filter((row): row is MetaCreativeApiRow => row !== null);
          console.log("[dashboard] Meta creatives normalized sample:", normalized.slice(0, 3));
          setCreativesLive(normalized.length > 0 ? normalized : null);
          setCreativesApiError(null);
        } else {
          setCreativesLive(null);
          setCreativesApiError(cErr ?? "Creatives unavailable");
          if (cErr) console.error("[dashboard] Meta creatives API:", cErr);
        }
      })
      .catch((e) => {
        console.error("Dashboard Meta/Instagram fetch:", e);
        if (!cancelled) {
          setMetaLive(null);
          setIgLive(null);
          setIgMonthlyBars(null);
          setCreativesLive(null);
          setMetaInsightsError("Network error");
          setIgInsightsError("Network error");
          setIgMonthlyError("Network error");
          setCreativesApiError("Network error");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMetaApiLoading(false);
          setIgApiLoading(false);
          setIgMonthlyLoading(false);
          setCreativesApiLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dateRange, customApplied]);

  const ga4TableRows = ga4Website.source === "live" ? ga4Website.topPages : [];

  const scrollHighlights = (direction: "left" | "right") => {
    const container = highlightsRef.current;
    if (!container) return;

    const nextIndex =
      direction === "right"
        ? Math.min(activeHighlightIndex + 1, slides.length - 1)
        : Math.max(activeHighlightIndex - 1, 0);

    container.scrollTo({
      left: nextIndex * container.clientWidth,
      behavior: "smooth",
    });
    setActiveHighlightIndex(nextIndex);
  };

  const jumpToHighlight = (index: number) => {
    const container = highlightsRef.current;
    if (!container) return;
    container.scrollTo({
      left: index * container.clientWidth,
      behavior: "smooth",
    });
    setActiveHighlightIndex(index);
  };

  const openCustomRangePopover = () => {
    const end = customApplied?.endYmd ?? new Date().toISOString().slice(0, 10);
    const start = customApplied?.startYmd ?? addDaysUtcYmd(end, -29);
    setCustomDraftStart(start);
    setCustomDraftEnd(end);
    setCustomPopoverOpen(true);
  };

  const applyCustomRange = () => {
    const r = ymdUtcToUnixRange(customDraftStart, customDraftEnd);
    if (!r) return;
    setCustomApplied({ ...r, startYmd: customDraftStart, endYmd: customDraftEnd });
    setDateRange("custom");
    setCustomPopoverOpen(false);
  };

  const cancelCustomRangePopover = () => {
    setCustomPopoverOpen(false);
  };

  const selectPresetDateRange = (id: "7d" | "30d" | "90d") => {
    setDateRange(id);
    setCustomApplied(null);
    setCustomPopoverOpen(false);
  };

  const customRangeApplyDisabled =
    !customDraftStart ||
    !customDraftEnd ||
    customDraftEnd < customDraftStart ||
    ymdUtcToUnixRange(customDraftStart, customDraftEnd) === null;

  return (
    <ModuleGuard module="dashboard">
      <PageHeader
        title={t("dashboard")}
        subtitle={lt("KPI overview and multi-channel activity summary")}
        action={
          <div
            className="relative inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-1"
            title="Meta Ads date range maps to Graph API date_preset (last_7d, last_30d, last_90d). Instagram Insights use the same range (7 / 30 / 90 days) from daily account metrics."
          >
            <span className="hidden sm:inline-flex" aria-hidden>
              <Info className="h-3.5 w-3.5 text-[var(--muted)]" strokeWidth={1.5} />
            </span>
            <div className="inline-flex items-center p-0">
              {(
                [
                  { id: "7d" as const, label: lt("Last 7 days") },
                  { id: "30d" as const, label: lt("Last 30 days") },
                  { id: "90d" as const, label: lt("Last 90 days") },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectPresetDateRange(item.id)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs",
                    dateRange === item.id ? "bg-[var(--primary)] text-white" : "text-[var(--muted)]",
                  )}
                >
                  {item.label}
                </button>
              ))}
              <div className="relative">
                <button
                  type="button"
                  onClick={openCustomRangePopover}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs",
                    dateRange === "custom" ? "bg-[var(--primary)] text-white" : "text-[var(--muted)]",
                  )}
                >
                  {dateRange === "custom" && customApplied ? (
                    <span className="mono-num">
                      {formatCustomRangeButtonLabel(customApplied.startYmd, customApplied.endYmd)}
                    </span>
                  ) : (
                    lt("Custom Range")
                  )}
                </button>
                {customPopoverOpen ? (
                  <div
                    className="absolute right-0 top-[calc(100%+8px)] z-[60] w-[min(calc(100vw-2rem),300px)] rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1a1a1a] p-4 shadow-none"
                    role="dialog"
                    aria-label={lt("Custom Range")}
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="block text-[0.65rem] font-normal uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                        {lt("Start Date")}
                        <input
                          type="date"
                          value={customDraftStart}
                          onChange={(e) => setCustomDraftStart(e.target.value)}
                          className="mt-1.5 w-full rounded-md border border-[rgba(255,255,255,0.12)] bg-[#0d0d0d] px-2.5 py-2 text-xs font-light text-white [color-scheme:dark]"
                        />
                      </label>
                      <label className="block text-[0.65rem] font-normal uppercase tracking-[0.08em] text-[rgba(255,255,255,0.45)]">
                        {lt("End Date")}
                        <input
                          type="date"
                          value={customDraftEnd}
                          onChange={(e) => setCustomDraftEnd(e.target.value)}
                          className="mt-1.5 w-full rounded-md border border-[rgba(255,255,255,0.12)] bg-[#0d0d0d] px-2.5 py-2 text-xs font-light text-white [color-scheme:dark]"
                        />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button type="button" onClick={cancelCustomRangePopover} className="btn-ghost rounded-md px-3 py-1.5 text-xs">
                        {lt("Cancel")}
                      </button>
                      <button
                        type="button"
                        onClick={applyCustomRange}
                        disabled={customRangeApplyDisabled}
                        className="btn-primary rounded-md px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {lt("Apply")}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        }
      />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="kpi-label">{lt("Active Tasks")}</p>
            <MoreHorizontal className="h-4 w-4 text-[var(--muted)]" />
          </div>
          {kpiLoading ? (
            <>
              <div className="mt-2 h-9 w-20 animate-pulse rounded-md bg-[rgba(255,255,255,0.08)]" />
              <div className="mt-2 h-[2px] w-full animate-pulse rounded-[2px] bg-[rgba(255,255,255,0.12)]" />
              <div className="mt-2 h-3 w-20 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
            </>
          ) : (
            <>
              <p className="metric-value mt-2 text-3xl text-white">{kpiActiveTasks}</p>
              <div className="mt-2 h-[2px] rounded-[2px] bg-[rgba(255,255,255,0.08)]">
                <div
                  className="h-[2px] rounded-[2px] bg-[rgba(255,255,255,0.35)]"
                  style={{ width: `${kpiTotalTasks === 0 ? 0 : (kpiActiveTasks / kpiTotalTasks) * 100}%` }}
                />
              </div>
              <p className="kpi-fraction mt-1 text-xs">
                {kpiActiveTasks} / {kpiTotalTasks}
              </p>
            </>
          )}
          <DashboardVsComparisonBlock primaryRaw="+0.0%" invert={false} dateRange={dateRange} lt={lt} />
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="kpi-label">{lt("Completed Projects")}</p>
            <MoreHorizontal className="h-4 w-4 text-[var(--muted)]" />
          </div>
          {kpiLoading ? (
            <>
              <div className="mt-2 h-9 w-20 animate-pulse rounded-md bg-[rgba(255,255,255,0.08)]" />
              <div className="mt-2 h-[2px] w-full animate-pulse rounded-[2px] bg-[rgba(255,255,255,0.12)]" />
              <div className="mt-2 h-3 w-20 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
            </>
          ) : (
            <>
              <p className="metric-value mt-2 text-3xl text-white">{kpiCompletedProjects}</p>
              <div className="mt-2 h-[2px] rounded-[2px] bg-[rgba(255,255,255,0.08)]">
                <div
                  className="h-[2px] rounded-[2px] bg-[rgba(255,255,255,0.35)]"
                  style={{ width: `${kpiTotalProjects === 0 ? 0 : (kpiCompletedProjects / kpiTotalProjects) * 100}%` }}
                />
              </div>
              <p className="kpi-fraction mt-1 text-xs">
                {kpiCompletedProjects} / {kpiTotalProjects}
              </p>
            </>
          )}
          <DashboardVsComparisonBlock primaryRaw="+0.0%" invert={false} dateRange={dateRange} lt={lt} />
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="kpi-label">{lt("Digital Growth")}</p>
              {igApiLoading ? (
                <>
                  <div className="mt-2 h-9 w-32 max-w-full animate-pulse rounded-md bg-[rgba(255,255,255,0.08)]" />
                  <div className="mt-3 h-4 w-full max-w-[220px] animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
                  <div className="mt-2 h-3 w-40 animate-pulse rounded bg-[rgba(255,255,255,0.05)]" />
                </>
              ) : igLive != null && typeof igLive.reachGrowthPct === "number" && Number.isFinite(igLive.reachGrowthPct) ? (
                <>
                  <p
                    className={cn(
                      "metric-value mt-2 text-3xl",
                      igLive.reachGrowthPct >= 0 ? "text-[#379136]" : "text-[#ef4444]",
                    )}
                  >
                    {igLive.reachGrowthPct >= 0 ? "+" : ""}
                    {igLive.reachGrowthPct.toFixed(1)}%
                  </p>
                  <p className="mt-2 text-sm text-white">{lt("Avg growth across Instagram, LinkedIn, X")}</p>
                  <p className={cn("mt-1", DASHBOARD_VS_PERIOD_TEXT_CLASS)}>{dashboardVsPeriodLabel(dateRange, lt)}</p>
                </>
              ) : (
                <>
                  <p className="metric-value mt-2 text-3xl text-[rgba(255,255,255,0.35)]">—</p>
                  <p className="mt-2 text-sm text-white">{lt("Instagram, LinkedIn, X — connecting...")}</p>
                  <p className={cn("mt-1", DASHBOARD_VS_PERIOD_TEXT_CLASS)}>{dashboardVsPeriodLabel(dateRange, lt)}</p>
                </>
              )}
              {!igApiLoading && igLive == null && igInsightsError != null && igDataMode !== "csv" ? (
                <p className="mt-2 text-[0.65rem] text-[rgba(255,255,255,0.35)]">{lt("Live data unavailable")}</p>
              ) : null}
            </div>
            {!igApiLoading && igLive != null && typeof igLive.reachGrowthPct === "number" && Number.isFinite(igLive.reachGrowthPct) ? (
              igLive.reachGrowthPct >= 0 ? (
                <ArrowUpRight className="h-5 w-5 shrink-0 text-[#379136]" />
              ) : (
                <ArrowDownRight className="h-5 w-5 shrink-0 text-[#ef4444]" />
              )
            ) : null}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="kpi-label">{lt("Paid Media Growth")}</p>
              {metaApiLoading ? (
                <>
                  <div className="mt-2 h-9 w-32 max-w-full animate-pulse rounded-md bg-[rgba(255,255,255,0.08)]" />
                  <div className="mt-3 h-4 w-full max-w-[220px] animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
                  <div className="mt-2 h-3 w-36 animate-pulse rounded bg-[rgba(255,255,255,0.05)]" />
                </>
              ) : metaLive != null && metaLive.spendGrowthPct != null && Number.isFinite(metaLive.spendGrowthPct) ? (
                <>
                  <p
                    className={cn(
                      "metric-value mt-2 text-3xl",
                      metaLive.spendGrowthPct >= 0 ? "text-[#379136]" : "text-[#ef4444]",
                    )}
                  >
                    {metaLive.spendGrowthPct >= 0 ? "+" : ""}
                    {metaLive.spendGrowthPct.toFixed(1)}%
                  </p>
                  <p className="mt-2 text-sm text-white">{lt("Meta Ads + Google Ads combined growth")}</p>
                  <p className={cn("mt-1", DASHBOARD_VS_PERIOD_TEXT_CLASS)}>{dashboardVsPeriodLabel(dateRange, lt)}</p>
                </>
              ) : (
                <>
                  <p className="metric-value mt-2 text-3xl text-[rgba(255,255,255,0.35)]">—</p>
                  <p className="mt-2 text-sm text-white">{lt("Meta Ads + Google Ads — connecting...")}</p>
                  <p className={cn("mt-1", DASHBOARD_VS_PERIOD_TEXT_CLASS)}>{dashboardVsPeriodLabel(dateRange, lt)}</p>
                </>
              )}
              {!metaApiLoading && metaLive == null && metaInsightsError != null && metaDataMode !== "csv" ? (
                <p className="mt-2 text-[0.65rem] text-[rgba(255,255,255,0.35)]">{lt("Live data unavailable")}</p>
              ) : null}
            </div>
            {!metaApiLoading &&
            metaLive != null &&
            metaLive.spendGrowthPct != null &&
            Number.isFinite(metaLive.spendGrowthPct) ? (
              metaLive.spendGrowthPct >= 0 ? (
                <ArrowUpRight className="h-5 w-5 shrink-0 text-[#379136]" />
              ) : (
                <ArrowDownRight className="h-5 w-5 shrink-0 text-[#ef4444]" />
              )
            ) : null}
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <div className="mb-3">
          <h2 className="text-[0.7rem] uppercase tracking-[0.1em] text-[rgba(255,255,255,0.4)]">{lt("Highlights")}</h2>
        </div>

        {slides.length > 0 ? (
          <>
            <div className="relative">
              <div
                ref={highlightsRef}
                className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {slides.map((slide) => (
                  <div key={slide.key} className="w-full min-w-full snap-start">
                    <div className="relative min-h-[50vh] w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[#1a1a1a]">
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `url(${slide.coverImage})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          backgroundRepeat: "no-repeat",
                        }}
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.85)_0%,rgba(0,0,0,0.4)_50%,transparent_100%)]" />
                      <div className="absolute inset-x-0 bottom-0 z-10 p-6">
                        <div className="max-w-[24%] text-left">
                          <p className="text-[1.4rem] font-normal text-white">{slide.title}</p>
                          <p className="mt-2 text-[0.85rem] text-[rgba(255,255,255,0.6)]">{slide.description}</p>
                          <Link
                            href={`/projects/${slide.projectId}?taskId=${slide.taskId}`}
                            className="mt-4 inline-flex rounded-md border border-white/35 px-2.5 py-1 text-xs text-white transition hover:bg-white/10"
                          >
                            {lt("View Task")}
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pointer-events-none absolute inset-y-0 left-0 right-0 flex items-center justify-between px-3">
                <button
                  type="button"
                  onClick={() => scrollHighlights("left")}
                  className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(255,255,255,0.1)] text-white transition hover:bg-[rgba(255,255,255,0.16)]"
                  aria-label={lt("Previous highlights")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollHighlights("right")}
                  className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(255,255,255,0.1)] text-white transition hover:bg-[rgba(255,255,255,0.16)]"
                  aria-label={lt("Next highlights")}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-3 flex justify-center gap-2">
              {slides.map((slide, index) => (
                <button
                  key={slide.key}
                  type="button"
                  onClick={() => jumpToHighlight(index)}
                  aria-label={`Go to highlight ${index + 1}`}
                  className={cn(
                    "h-2 rounded-full transition",
                    activeHighlightIndex === index ? "w-6 bg-white" : "w-2 bg-[rgba(255,255,255,0.25)]",
                  )}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-[var(--border)] bg-[#1a1a1a] px-6 text-center">
            <p className="text-sm text-[rgba(255,255,255,0.6)]">{lt("No highlights yet — mark a task as featured in Projects")}</p>
          </div>
        )}
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="section-title">{lt("Instagram Performance")}</h2>
            {igDataMode === "live" ? (
              <span className="rounded border border-[#379136]/40 bg-[#379136]/15 px-2 py-0.5 text-[0.65rem] font-medium text-[#379136]">
                Live
              </span>
            ) : igDataMode === "csv" && igCsvBadgeDate ? (
              <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[0.65rem] font-medium text-amber-400">
                CSV — <span className="mono-num">{igCsvBadgeDate}</span>
              </span>
            ) : igDataMode === "mock" && !igApiLoading ? (
              <span className="rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-0.5 text-[0.65rem] font-medium text-[var(--muted)]">
                {lt("No data")}
              </span>
            ) : null}
            {!igApiLoading && igLive == null && igDataMode !== "csv" && igInsightsError ? (
              <span className="rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-0.5 text-[0.65rem] text-[rgba(255,255,255,0.35)]">
                {lt("Live data unavailable")}
              </span>
            ) : null}
          </div>
          {canImportData(currentUser) && igDataMode !== "live" ? (
            <button
              type="button"
              onClick={() => {
                resetIgImportModal();
                setIgImportModalOpen(true);
              }}
              className="btn-ghost inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/35 px-2.5 py-1.5 text-xs text-white"
            >
              <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
              {lt("Import CSV")}
            </button>
          ) : null}
        </div>
        <div className="mt-3 grid gap-3 xl:grid-cols-3">
          <Card className="xl:col-span-2 h-full">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">{lt("Monthly follower growth")}</p>
              <div className="inline-flex gap-1 text-[10px] text-[var(--muted)]">
                <span className="mono-num rounded border border-[var(--border)] px-1.5 py-0.5">1M</span>
                <span className="mono-num rounded border border-[var(--border)] px-1.5 py-0.5">12M</span>
                <span className="rounded border border-[var(--border)] px-1.5 py-0.5">ALL</span>
              </div>
            </div>
            <div className="h-[calc(100%-32px)] min-h-[360px] rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4">
              <div className="flex h-full min-h-0 items-stretch gap-2 border-b border-[var(--border)] pb-5">
                {igMonthlyLoading
                  ? Array.from({ length: 12 }).map((_, index) => (
                      <div
                        key={`ig-m-sk-${index}`}
                        className="flex h-full min-h-0 flex-1 flex-col justify-end"
                      >
                        <div
                          className="w-full animate-pulse rounded-sm bg-[rgba(24,119,242,0.25)]"
                          style={{ height: `${35 + ((index * 7) % 40)}%` }}
                        />
                      </div>
                    ))
                  : (igMonthlyBars && igMonthlyBars.length > 0 ? igMonthlyBars : INSTAGRAM_MONTHLY_EMPTY_CHART).map(
                      (bar, index) => (
                        <div
                          key={`${bar.label}-${index}`}
                          className="group relative flex h-full min-h-0 flex-1 flex-col justify-end"
                        >
                          <div
                            className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-[4px] bg-[#222222] px-[10px] py-[6px] text-[0.75rem] text-white opacity-0 shadow-none transition-opacity duration-200 ease-out group-hover:opacity-100"
                            style={{ boxShadow: "none" }}
                          >
                            <div className="whitespace-nowrap text-center font-normal">{bar.label}</div>
                            <div className="mono-num whitespace-nowrap text-center">
                              {Math.round(bar.reachValue).toLocaleString("en-US")}
                            </div>
                          </div>
                          <div
                            className="w-full rounded-sm bg-[#1877F2]"
                            style={{ height: `${bar.heightPct}%` }}
                          />
                        </div>
                      ))}
              </div>
              <div
                className="mt-2 grid text-[10px] text-[var(--muted)]"
                style={{
                  gridTemplateColumns: `repeat(${
                    igMonthlyLoading
                      ? 12
                      : igMonthlyBars && igMonthlyBars.length > 0
                        ? igMonthlyBars.length
                        : 12
                  }, minmax(0, 1fr))`,
                }}
              >
                {igMonthlyLoading
                  ? Array.from({ length: 12 }).map((_, i) => <span key={`lbl-sk-${i}`}>—</span>)
                  : (igMonthlyBars && igMonthlyBars.length > 0 ? igMonthlyBars : INSTAGRAM_MONTHLY_EMPTY_CHART).map(
                      (bar, li) => (
                        <span key={`${bar.label}-${li}`} className="truncate text-center">
                          {bar.label}
                        </span>
                      ))}
              </div>
              {!igMonthlyLoading && igMonthlyBars == null && igMonthlyError ? (
                <p className="mt-2 text-center text-[0.65rem] text-[rgba(255,255,255,0.35)]">{lt("Live data unavailable")}</p>
              ) : null}
            </div>
          </Card>
          <Card>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">{lt("Social metrics")}</p>
                {igDataMode === "live" && !igApiLoading ? (
                  <span className="rounded border border-[#379136]/40 bg-[#379136]/15 px-1.5 py-0.5 text-[0.6rem] font-medium text-[#379136]">
                    Live
                  </span>
                ) : null}
              </div>
              <MoreHorizontal className="h-4 w-4 shrink-0 text-[var(--muted)]" />
            </div>
            <div className="space-y-3">
              {igApiLoading
                ? [0, 1, 2, 3, 4].map((i) => (
                    <div key={`ig-sk-${i}`} className="rounded-lg border border-[var(--border)] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="h-4 w-24 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
                        <div className="h-5 w-20 animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
                      </div>
                      <div className="mt-2 h-3 w-32 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
                      <div className="mt-2 h-[2px] rounded-[2px] bg-[rgba(255,255,255,0.08)]">
                        <div className="h-[2px] w-1/2 animate-pulse rounded-[2px] bg-[rgba(255,255,255,0.12)]" />
                      </div>
                    </div>
                  ))
                : igDisplayMetrics.map((metric) => (
                    <div key={metric.label} className="rounded-lg border border-[var(--border)] p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--muted)]">{lt(metric.label)}</span>
                        <span className="metric-value text-white">{metric.value}</span>
                      </div>
                      <DashboardVsComparisonBlock
                        primaryRaw={
                          metric.change.trim() !== "" && metric.change.trim() !== "—" ? metric.change : "—"
                        }
                        invert={false}
                        dateRange={dateRange}
                        lt={lt}
                      />
                      <div className="mt-2 h-[2px] rounded-[2px] bg-[rgba(255,255,255,0.08)]">
                        <div
                          className="h-[2px] rounded-[2px] bg-[rgba(255,255,255,0.35)]"
                          style={{ width: `${metric.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
            </div>
            <p className="source-label mt-3 text-right">{lt("Source: Instagram Insights")}</p>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="section-title">{lt("Paid Traffic Performance")}</h2>
            {metaDataMode === "live" && !metaApiLoading ? (
              <span className="rounded border border-[#379136]/40 bg-[#379136]/15 px-2 py-0.5 text-[0.65rem] font-medium text-[#379136]">
                Live
              </span>
            ) : null}
            {metaDataMode === "csv" && csvBadgeDate ? (
              <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[0.65rem] font-medium text-amber-400">
                CSV — {csvBadgeDate}
              </span>
            ) : metaDataMode === "mock" && !metaApiLoading ? (
              <span className="rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-0.5 text-[0.65rem] font-medium text-[var(--muted)]">
                {lt("No data")}
              </span>
            ) : null}
            {!metaApiLoading && metaLive == null && metaDataMode !== "csv" && metaInsightsError ? (
              <span className="rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-0.5 text-[0.65rem] text-[rgba(255,255,255,0.35)]">
                {lt("Live data unavailable")}
              </span>
            ) : null}
          </div>
          {canImportData(currentUser) && metaDataMode !== "live" ? (
            <button
              type="button"
              onClick={() => {
                resetImportModal();
                setImportModalOpen(true);
              }}
              className="btn-ghost inline-flex shrink-0 items-center gap-2 rounded-lg border border-white/35 px-2.5 py-1.5 text-xs text-white"
            >
              <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
              {lt("Import CSV")}
            </button>
          ) : null}
        </div>
        <div className="mt-3 grid items-stretch gap-3 xl:grid-cols-2">
          <div className="flex h-full min-h-0 min-w-0 flex-col gap-3">
            <Card className="flex h-full min-h-0 flex-1 flex-col">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">{lt("Meta Ads")}</p>
                  {metaDataMode === "live" && !metaApiLoading ? (
                    <span className="rounded border border-[#379136]/40 bg-[#379136]/15 px-1.5 py-0.5 text-[0.6rem] font-medium text-[#379136]">
                      Live
                    </span>
                  ) : null}
                </div>
                <MoreHorizontal className="h-4 w-4 shrink-0 text-[var(--muted)]" />
              </div>
              {metaApiLoading ? (
                <>
                  <div className="mt-2 h-10 w-44 max-w-full animate-pulse rounded-md bg-[rgba(255,255,255,0.08)]" />
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    {META_ADS_METRIC_CARD_LABELS.map((label) => (
                      <div key={label} className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-2">
                        <p className="text-xs text-[var(--muted)]">{lt(label)}</p>
                        <div className="mt-2 h-6 w-full animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="metric-value mt-2 text-3xl">{metaSpendDisplay}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    {metaMetricsRows.map((metric) => (
                      <div key={metric.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-2">
                        <p className="text-xs text-[var(--muted)]">{lt(metric.label)}</p>
                        <p className="metric-value">{metric.value}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="min-h-2 flex-1" aria-hidden />
              <p className="source-label mt-3 text-right">{lt("Source: Meta Ads")}</p>
              {!metaApiLoading && metaDisplayCampaigns.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setCampaignsTableOpen((o) => !o);
                    setShowAllCampaigns(false);
                  }}
                  className="btn-ghost mt-3 w-full rounded-lg border border-white/20 px-3 py-1.5 text-xs text-[var(--muted)]"
                >
                  {lt("View Campaigns")} (<span className="mono-num">{metaDisplayCampaigns.length}</span>)
                </button>
              ) : null}
            </Card>
            {!metaApiLoading && metaDisplayCampaigns.length > 0 && campaignsTableOpen ? (
              <div className="overflow-hidden rounded-lg border border-[var(--border)]">
                <table>
                  <thead>
                    <tr>
                      <th>{lt("Campaign Name")}</th>
                      <th>{lt("Status")}</th>
                      <th>{lt("Spent")}</th>
                      <th>{lt("Impressions")}</th>
                      <th>{lt("Clicks")}</th>
                      <th>{lt("CTR")}</th>
                      <th>{lt("CPL")}</th>
                      <th>{lt("Results")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(showAllCampaigns ? metaDisplayCampaigns : metaDisplayCampaigns.slice(0, 10)).map((c, idx) => (
                      <tr key={`${c.campaignName}-${c.startDate}-${idx}`}>
                        <td className="max-w-[140px] truncate">{c.campaignName}</td>
                        <td>
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-normal capitalize",
                              isActiveMetaStatus(c.status)
                                ? "border-[#22c55e]/40 bg-[rgba(34,197,94,0.12)] text-[#22c55e]"
                                : "border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--muted)]",
                            )}
                          >
                            {c.status || "—"}
                          </span>
                        </td>
                        <td className="mono-num">{formatUsdSpend(c.amountSpent)}</td>
                        <td className="mono-num">{Math.round(c.impressions).toLocaleString("en-US")}</td>
                        <td className="mono-num">{Math.round(c.linkClicks).toLocaleString("en-US")}</td>
                        <td className="mono-num">{formatRowCtr(c.ctr)}</td>
                        <td className="mono-num">{formatRowCpl(c)}</td>
                        <td className="mono-num">{Math.round(c.results).toLocaleString("en-US")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {metaDisplayCampaigns.length > 10 ? (
                  <div className="border-t border-[var(--border)] bg-[var(--surface-elevated)] px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => setShowAllCampaigns((s) => !s)}
                      className="text-xs text-[var(--muted)] underline-offset-2 hover:text-white hover:underline"
                    >
                      {showAllCampaigns ? lt("Show less") : lt("Show all")}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex h-full min-h-0 min-w-0 flex-col">
            <Card className="flex h-full min-h-0 flex-col">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">{lt("Google Ads")}</p>
                  <span className="text-[0.7rem] font-normal normal-case tracking-normal text-[rgba(255,255,255,0.35)]">
                    {lt("Coming soon")}
                  </span>
                </div>
                <MoreHorizontal className="h-4 w-4 shrink-0 text-[var(--muted)]" />
              </div>
              <p className="metric-value mt-2 text-3xl">$0</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                {googleAdsPlaceholderMetrics.map((metric) => (
                  <div key={metric.label} className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-2">
                    <p className="text-xs text-[var(--muted)]">{lt(metric.label)}</p>
                    <p className="metric-value">{metric.value}</p>
                  </div>
                ))}
              </div>
              <div className="min-h-2 flex-1" aria-hidden />
              <p className="source-label mt-3 text-right">{lt("Google Ads — not connected")}</p>
              {googleCampaignsHint ? (
                <p className="mt-2 text-center text-[0.7rem] leading-snug text-[var(--muted)]">
                  {lt("No campaign data available yet.")}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (googleCampaignsHintTimeoutRef.current !== null) {
                    window.clearTimeout(googleCampaignsHintTimeoutRef.current);
                  }
                  setGoogleCampaignsHint(true);
                  googleCampaignsHintTimeoutRef.current = window.setTimeout(() => {
                    setGoogleCampaignsHint(false);
                    googleCampaignsHintTimeoutRef.current = null;
                  }, 3200);
                }}
                className="btn-ghost mt-3 w-full rounded-lg border border-white/20 px-3 py-1.5 text-xs text-[var(--muted)]"
              >
                {lt("View Campaigns")}
              </button>
            </Card>
          </div>
        </div>

        <Modal
          open={importModalOpen}
          title={lt("IMPORT META ADS DATA")}
          closeLabel="×"
          onClose={closeImportModal}
        >
          {importSuccess ? (
            <p className="text-center text-sm text-[#379136]">{importSuccessMessage}</p>
          ) : (
            <>
              <p className="text-sm text-[var(--muted)]">{lt("Upload a CSV export from Meta Ads Manager")}</p>
              <input
                ref={importFileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="mt-4 block w-full text-xs text-[var(--muted)] file:mr-3 file:rounded-md file:border file:border-[var(--border)] file:bg-[var(--surface-elevated)] file:px-3 file:py-1.5 file:text-xs file:text-white"
                onChange={(e) => handleImportFile(e.target.files?.[0] ?? null)}
              />
              {importError ? <p className="mt-2 text-xs text-[#ef4444]">{importError}</p> : null}
              {importPreview ? (
                <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3 text-sm">
                  <p className="text-xs text-[var(--muted)]">{lt("Preview")}</p>
                  <p className="mt-1 text-[var(--text)]">
                    <span className="text-[var(--muted)]">{lt("Campaigns:")}</span>{" "}
                    <span className="mono-num">{importPreview.campaigns.length}</span>
                  </p>
                  <p className="mt-1 text-[var(--text)]">
                    <span className="text-[var(--muted)]">{lt("Total spent:")}</span>{" "}
                    <span className="mono-num">{formatUsdSpend(importPreview.summary.totalSpent)}</span>
                  </p>
                  <p className="mt-1 text-[var(--text)]">
                    <span className="text-[var(--muted)]">{lt("Total impressions:")}</span>{" "}
                    <span className="mono-num">{importPreview.summary.totalImpressions.toLocaleString("en-US")}</span>
                  </p>
                </div>
              ) : null}
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" className="btn-ghost rounded-lg px-3 py-2 text-xs" onClick={closeImportModal}>
                  {lt("Cancel")}
                </button>
                <button
                  type="button"
                  className="btn-primary rounded-lg px-3 py-2 text-xs"
                  disabled={!importPreview}
                  onClick={confirmImportCsv}
                >
                  {lt("Import Data")}
                </button>
              </div>
            </>
          )}
        </Modal>

        <Modal
          open={igImportModalOpen}
          title={lt("IMPORT INSTAGRAM DATA")}
          closeLabel="×"
          onClose={closeIgImportModal}
        >
          {igImportSuccess ? (
            <p className="text-center text-sm text-[#1877F2]">{igImportSuccessMessage}</p>
          ) : (
            <>
              <p className="text-sm text-[var(--muted)]">
                {lt("Upload a CSV export from Meta Business Suite Insights.")}
              </p>
              <p className="mt-2 text-xs text-[rgba(255,255,255,0.35)]">
                {lt(
                  "Required columns: Metric, Value, Change, Progress (or Métrica, Valor, Variação, Progresso). One row per metric; Progress is 0–100 for the bar width.",
                )}
              </p>
              <input
                ref={igImportFileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="mt-4 block w-full text-xs text-[var(--muted)] file:mr-3 file:rounded-md file:border file:border-[var(--border)] file:bg-[var(--surface-elevated)] file:px-3 file:py-1.5 file:text-xs file:text-white"
                onChange={(e) => handleIgImportFile(e.target.files?.[0] ?? null)}
              />
              {igImportError ? <p className="mt-2 text-xs text-[#ef4444]">{igImportError}</p> : null}
              {igImportPreview ? (
                <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3 text-sm">
                  <p className="text-xs text-[var(--muted)]">{lt("Preview")}</p>
                  <p className="mt-1 text-[var(--text)]">
                    <span className="text-[var(--muted)]">{lt("Metrics:")}</span>{" "}
                    <span className="mono-num">{igImportPreview.metrics.length}</span>
                  </p>
                  <p className="mt-1 text-[var(--text)]">
                    <span className="text-[var(--muted)]">{lt("First metric:")}</span> {igImportPreview.metrics[0]?.label}{" "}
                    — <span className="mono-num">{igImportPreview.metrics[0]?.value}</span>
                  </p>
                </div>
              ) : null}
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" className="btn-ghost rounded-lg px-3 py-2 text-xs" onClick={closeIgImportModal}>
                  {lt("Cancel")}
                </button>
                <button
                  type="button"
                  className="btn-primary rounded-lg px-3 py-2 text-xs"
                  disabled={!igImportPreview}
                  onClick={confirmIgImportCsv}
                >
                  {lt("Import Data")}
                </button>
              </div>
            </>
          )}
        </Modal>

        <div className="mt-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-[0.7rem] uppercase tracking-[0.1em] text-[rgba(255,255,255,0.4)]">
                {lt("Top Performing Creatives")}
              </h3>
              {creativesDataIsLive && !creativesApiLoading ? (
                <span className="rounded border border-[#379136]/40 bg-[#379136]/15 px-2 py-0.5 text-[0.65rem] font-medium text-[#379136]">
                  Live
                </span>
              ) : null}
              {!creativesApiLoading && !creativesDataIsLive && creativesApiError ? (
                <span className="rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-0.5 text-[0.65rem] text-[rgba(255,255,255,0.35)]">
                  {lt("Live data unavailable")}
                </span>
              ) : null}
            </div>
            {canImportData(currentUser) ? (
              <button
                type="button"
                onClick={openCreativesModal}
                className="btn-ghost inline-flex shrink-0 items-center rounded-lg border border-white/35 px-2.5 py-1.5 text-xs text-white"
              >
                {lt("Manage Creatives")}
              </button>
            ) : null}
          </div>
          <div className="mt-3 grid gap-3 xl:grid-cols-3">
            {creativesApiLoading
              ? [0, 1, 2].map((i) => (
                  <div
                    key={`cr-sk-${i}`}
                    className="flex min-w-0 flex-col overflow-hidden rounded-b-[8px] rounded-t-none border border-[rgba(255,255,255,0.06)] bg-[#161616]"
                  >
                    <div className="relative aspect-[4/3] w-full animate-pulse bg-[rgba(255,255,255,0.06)]" />
                    <div className="space-y-2 p-[14px]">
                      <div className="h-4 w-[70%] animate-pulse rounded bg-[rgba(255,255,255,0.08)]" />
                      <div className="h-6 w-16 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
                      <div className="h-5 w-24 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
                      <div className="h-8 w-full animate-pulse rounded-md bg-[rgba(255,255,255,0.06)]" />
                    </div>
                  </div>
                ))
              : topCreativesDisplay.length === 0
                ? (
                    <div className="xl:col-span-3 flex min-h-[180px] items-center justify-center rounded-b-[8px] rounded-t-none border border-[rgba(255,255,255,0.06)] bg-[#161616] p-[14px] text-center">
                      <p className="text-[0.8rem] text-[rgba(255,255,255,0.45)]">{lt("No creatives data available")}</p>
                    </div>
                  )
                : topCreativesDisplay.map((creative) => {
                  const hasUrl = creative.adUrl.trim().length > 0;
                  const useAdsmanager = creative.isFromApi === true;
                  return (
                    <div
                      key={creative.id}
                      className="flex min-w-0 flex-col overflow-hidden rounded-b-[8px] rounded-t-none border border-[rgba(255,255,255,0.06)] bg-[#161616]"
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#0d0d0d]">
                        {creative.imageUrl && creative.imageUrl.length > 0 ? (
                          <img
                            src={creative.imageUrl}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover object-top"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d0d]">
                            <ImageIcon className="h-8 w-8 text-[rgba(255,255,255,0.12)]" strokeWidth={1.5} />
                          </div>
                        )}
                      </div>
                      <div className="p-[14px]">
                        <p className="truncate text-[0.9rem] font-normal text-white">{creative.name}</p>
                        <span
                          className={cn(
                            "mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-normal uppercase tracking-[0.08em] text-white",
                            creative.platform === "Meta" ? "bg-[#1877F2]" : "bg-[#EA4335]",
                          )}
                        >
                          {creative.platform}
                        </span>
                        <p className="mt-3 text-[1.1rem] font-light text-white">
                          <span className="mono-num">{creative.ctr.toFixed(1)}%</span> {lt("CTR")}
                        </p>
                        <p className="mt-1 text-[0.75rem] text-[rgba(255,255,255,0.4)]">
                          <span className="mono-num">{creative.impressions.toLocaleString("en-US")}</span> {lt("impressions")}
                        </p>
                        {typeof creative.spend === "number" && creative.spend > 0 ? (
                          <p className="mt-1 text-[0.75rem] text-[rgba(255,255,255,0.45)]">
                            <span className="mono-num">${creative.spend.toFixed(2)}</span> {lt("spend")}
                          </p>
                        ) : null}
                        {useAdsmanager || hasUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              window.open(
                                useAdsmanager ? META_ADS_MANAGER_URL : creative.adUrl,
                                "_blank",
                                "noopener,noreferrer",
                              )
                            }
                            className="btn-ghost mt-[10px] w-full rounded-md border border-white/35 px-2.5 py-1.5 text-xs text-white"
                          >
                            {lt("View Ad")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="btn-ghost mt-[10px] w-full cursor-not-allowed rounded-md border border-white/20 px-2.5 py-1.5 text-xs text-[rgba(255,255,255,0.35)] opacity-80"
                          >
                            {lt("No link")}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>

        <Modal open={creativesModalOpen} title={lt("MANAGE CREATIVES")} closeLabel="×" onClose={closeCreativesModal}>
          <p className="text-sm text-[var(--muted)]">{lt("Add Meta ad links to showcase top performing creatives")}</p>
          <div className="mt-4 max-h-[min(60vh,420px)] space-y-3 overflow-y-auto pr-1">
            {creativesDraft.map((slot) => (
              <div
                key={slot.id}
                className="relative rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3 pt-8"
              >
                <button
                  type="button"
                  onClick={() => removeCreativeDraftSlot(slot.id)}
                  className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-white/10 hover:text-white"
                  aria-label={lt("Remove creative")}
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder={lt("Creative name")}
                    value={slot.name}
                    onChange={(e) =>
                      setCreativesDraft((d) => d.map((s) => (s.id === slot.id ? { ...s, name: e.target.value } : s)))
                    }
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-white placeholder:text-[rgba(255,255,255,0.3)]"
                  />
                  <select
                    value={slot.platform}
                    onChange={(e) =>
                      setCreativesDraft((d) =>
                        d.map((s) =>
                          s.id === slot.id
                            ? { ...s, platform: e.target.value === "Google" ? "Google" : "Meta" }
                            : s,
                        ),
                      )
                    }
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-white"
                  >
                    <option value="Meta">Meta</option>
                    <option value="Google">Google</option>
                  </select>
                  <input
                    type="text"
                    placeholder={lt("https://www.facebook.com/ads/...")}
                    value={slot.adUrl}
                    onChange={(e) =>
                      setCreativesDraft((d) => d.map((s) => (s.id === slot.id ? { ...s, adUrl: e.target.value } : s)))
                    }
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-white placeholder:text-[rgba(255,255,255,0.3)]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      step="any"
                      placeholder="—"
                      value={slot.ctr}
                      onChange={(e) =>
                        setCreativesDraft((d) => d.map((s) => (s.id === slot.id ? { ...s, ctr: e.target.value } : s)))
                      }
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-white placeholder:text-[rgba(255,255,255,0.3)]"
                    />
                    <input
                      type="number"
                      step="1"
                      min={0}
                      placeholder="—"
                      value={slot.impressions}
                      onChange={(e) =>
                        setCreativesDraft((d) =>
                          d.map((s) => (s.id === slot.id ? { ...s, impressions: e.target.value } : s)),
                        )
                      }
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-white placeholder:text-[rgba(255,255,255,0.3)]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addCreativeDraftSlot}
            disabled={creativesDraft.length >= 6}
            className="btn-ghost mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/25 py-2 text-xs text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            {lt("Add Creative")}
          </button>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn-ghost rounded-lg px-3 py-2 text-xs" onClick={closeCreativesModal}>
              {lt("Cancel")}
            </button>
            <button type="button" className="btn-primary rounded-lg px-3 py-2 text-xs" onClick={saveCreativesFromModal}>
              {lt("Save")}
            </button>
          </div>
        </Modal>
      </div>

      <div className="mt-6">
        <h2 className="section-title">{lt("Website Analytics")}</h2>
        <div className="mt-3 grid gap-3 xl:grid-cols-3">
          {(
            [
              { label: "Total Sessions", valueKey: "sessions" as const, changeKey: "sessions" as const },
              { label: "Bounce Rate", valueKey: "bounceRate" as const, changeKey: "bounceRate" as const },
              {
                label: "Avg Session Duration",
                valueKey: "avgSessionDuration" as const,
                changeKey: "avgSessionDuration" as const,
              },
            ] as const
          ).map((item) => {
            const change = ga4Website.totals.changes[item.changeKey];
            return (
              <Card key={item.label}>
                <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">{lt(item.label)}</p>
                <p className="metric-value mt-2 text-3xl">
                  {ga4Website.loading ? "—" : ga4Website.totals[item.valueKey]}
                </p>
                {!ga4Website.loading ? (
                  <DashboardVsComparisonBlock
                    primaryRaw={change}
                    invert={item.changeKey === "bounceRate"}
                    dateRange={dateRange}
                    lt={lt}
                  />
                ) : null}
              </Card>
            );
          })}
        </div>
        <Card className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">
              {lt("Website metrics from Google Analytics 4")}
              {ga4Website.source === "mock" && ga4Website.error ? (
                <span className="mt-1 block text-xs text-[rgba(255,255,255,0.35)]">{ga4Website.error}</span>
              ) : null}
            </p>
            <button
              type="button"
              className="btn-primary rounded-lg px-3 py-2 text-xs"
              onClick={() => window.open(GA4_ANALYTICS_HOME, "_blank", "noopener,noreferrer")}
            >
              {lt("Open in GA4")}
            </button>
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-[var(--border)]">
            <table>
              <thead>
                <tr>
                  <th>{lt("Page")}</th>
                  <th>{lt("Sessions")}</th>
                  <th>{lt("Page views")}</th>
                  <th>{lt("Engagement rate")}</th>
                </tr>
              </thead>
              <tbody>
                {!ga4Website.loading && ga4TableRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-10 text-center align-middle text-[0.75rem] text-[rgba(255,255,255,0.3)]"
                    >
                      {lt("No page data yet — visit your site to start collecting data")}
                    </td>
                  </tr>
                ) : (
                  ga4TableRows.map((row, idx) => (
                    <tr key={`${row.page}-${idx}`}>
                      <td>{row.page}</td>
                      <td className="mono-num">{row.sessions}</td>
                      <td className="mono-num">{row.screenPageViews}</td>
                      <td className="mono-num">{row.engagementRate}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="source-label mt-3 text-right">
            {ga4Website.source === "live" ? lt("Source: Google Analytics 4 (live)") : lt("Source: Google Analytics 4")}
          </p>
        </Card>
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-[0.7rem] uppercase tracking-[0.1em] text-[rgba(255,255,255,0.4)]">{lt("INSTAGRAM FEED")}</h2>
              {!instagramFeedLoading && instagramFeedSource === "live" ? (
                <span className="rounded border border-[#379136]/40 bg-[#379136]/15 px-2 py-0.5 text-[0.65rem] font-medium text-[#379136]">
                  Live
                </span>
              ) : !instagramFeedLoading && instagramFeedSource === "manual" ? (
                <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[0.65rem] font-medium text-amber-400">
                  Manual
                </span>
              ) : null}
              {!instagramFeedLoading && instagramFeedError && instagramFeedSource !== "live" ? (
                <span className="rounded border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-0.5 text-[0.65rem] text-[rgba(255,255,255,0.35)]">
                  {lt("Live data unavailable")}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm font-light text-[var(--muted)]">{lt("Connect Instagram API to display live feed")}</p>
            {instagramFeedSource === "live" ? (
              <p className="mt-1 text-[0.72rem] text-[rgba(255,255,255,0.35)]">
                {lt("Manual posts are overridden by live API data")}
              </p>
            ) : null}
          </div>
          {canImportData(currentUser) ? (
            <button
              type="button"
              onClick={openInstagramFeedModal}
              className="btn-ghost inline-flex shrink-0 items-center rounded-lg border border-white/35 px-2.5 py-1.5 text-xs text-white"
            >
              {lt("Manage Posts")}
            </button>
          ) : null}
        </div>

        {instagramFeedLoading ? (
          <div className="mt-3 grid grid-cols-3 gap-[3px]">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={`ig-feed-sk-${i}`} className="aspect-[4/5] w-full animate-pulse bg-[rgba(255,255,255,0.06)]" />
            ))}
          </div>
        ) : !instagramFeedPosts || instagramFeedPosts.length === 0 ? (
          <div className="mt-3 flex min-h-[280px] w-full items-center justify-center px-4">
            <p className="max-w-md text-center text-[0.75rem] text-[rgba(255,255,255,0.3)]">
              {instagramFeedSource === "live"
                ? lt("No posts in this period.")
                : lt("No posts yet — click Manage Posts to add your first post")}
            </p>
          </div>
        ) : (
          <>
            <div className="relative mt-3" style={{ containerType: "inline-size" }}>
              <div
                className={cn(
                  "overflow-hidden",
                  instagramFeedPosts.length > 6 && !instagramFeedExpanded ? "opacity-[0.98]" : "opacity-100",
                )}
                style={{
                  maxHeight: instagramFeedExpanded
                    ? "5000px"
                    : instagramFeedPosts.length > 6
                      ? "calc((100cqw - 6px) * 5 / 6 + 3px)"
                      : "none",
                  transition: "max-height 0.4s ease, opacity 0.3s ease",
                }}
              >
                <div className="grid grid-cols-3 gap-[3px]">
                  {instagramFeedPosts.map((post) => (
                    <div
                      key={post.id}
                      role={post.permalink ? "link" : undefined}
                      tabIndex={post.permalink ? 0 : undefined}
                      onClick={() => {
                        if (post.permalink) window.open(post.permalink, "_blank", "noopener,noreferrer");
                      }}
                      onKeyDown={(e) => {
                        if (!post.permalink) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          window.open(post.permalink, "_blank", "noopener,noreferrer");
                        }
                      }}
                      className={cn(
                        "group relative aspect-[4/5] w-full overflow-hidden rounded-none bg-[#1a1a1a]",
                        post.permalink ? "cursor-pointer" : "",
                      )}
                    >
                      {post.imageUrl ? (
                        <img src={post.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-[rgba(255,255,255,0.15)]" strokeWidth={1.5} />
                        </div>
                      )}
                      {post.isVideo ? (
                        <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
                          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(0,0,0,0.55)] text-white">
                            <Play className="ml-0.5 h-6 w-6" fill="currentColor" strokeWidth={0} />
                          </span>
                        </div>
                      ) : null}
                      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[rgba(0,0,0,0.6)] px-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <div className="flex items-center gap-4 text-[0.85rem] font-light text-white">
                          <div className="flex items-center gap-1.5">
                            <Heart className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                            <span className="mono-num">{post.likes.toLocaleString("en-US")}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MessageCircle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                            <span className="mono-num">{post.comments.toLocaleString("en-US")}</span>
                          </div>
                        </div>
                        {post.caption.trim() ? (
                          <p className="line-clamp-2 max-w-full text-center text-[0.72rem] font-light leading-snug text-[rgba(255,255,255,0.8)]">
                            {post.caption}
                          </p>
                        ) : null}
                      </div>
                      {canImportData(currentUser) && instagramFeedSource !== "live" ? (
                        <button
                          type="button"
                          aria-label={lt("Delete post")}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            deleteInstagramFeedPostFromGrid(post.id);
                          }}
                          className="absolute right-2 top-2 z-20 inline-flex h-7 w-7 items-center justify-center rounded-md text-white opacity-0 transition-opacity duration-200 pointer-events-none hover:bg-white/10 group-hover:pointer-events-auto group-hover:opacity-100"
                        >
                          <X className="h-4 w-4" strokeWidth={1.75} />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
              {instagramFeedPosts.length > 6 ? (
                <div
                  className={cn(
                    "pointer-events-none absolute bottom-0 left-0 right-0 z-[12] h-[80px] transition-opacity duration-300 ease-[ease]",
                    instagramFeedExpanded ? "opacity-0" : "opacity-100",
                  )}
                  style={{
                    background: "linear-gradient(to bottom, transparent 0%, #111111 100%)",
                  }}
                  aria-hidden
                />
              ) : null}
            </div>
            {instagramFeedPosts.length > 6 ? (
              <div className="mt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => setInstagramFeedExpanded((e) => !e)}
                  className="rounded-[6px] border border-[rgba(255,255,255,0.15)] px-6 py-2 text-[0.8rem] font-light text-white transition-colors hover:bg-white/[0.04]"
                >
                  {instagramFeedExpanded ? lt("Show Less") : lt("View More")}
                </button>
              </div>
            ) : null}
          </>
        )}

        {!instagramFeedLoading && instagramFeedSource !== "live" ? (
          <div className="mt-4 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-3">
            <p className="text-center text-[0.72rem] text-[rgba(255,255,255,0.3)]">
              {lt("Showing mock data — connect Instagram Basic Display API to load real posts")}
            </p>
            <button type="button" className="btn-ghost rounded-lg px-3 py-1.5 text-xs">
              {lt("Connect Instagram")}
            </button>
          </div>
        ) : null}

        <Modal
          open={instagramFeedModalOpen}
          title={lt("MANAGE INSTAGRAM POSTS")}
          closeLabel="×"
          onClose={closeInstagramFeedModal}
        >
          <p className="text-sm text-[var(--muted)]">{lt("Add posts manually until Instagram API is connected")}</p>
          <div
            className={cn(
              "mt-4 space-y-3 pr-1",
              instagramFeedDraft.length > 4 && "max-h-[400px] overflow-y-auto",
            )}
          >
            {instagramFeedDraft.map((slot) => (
              <div
                key={slot.id}
                className="relative rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3 pt-9"
              >
                <button
                  type="button"
                  onClick={() => removeInstagramFeedDraftSlot(slot.id)}
                  className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-white/10 hover:text-white"
                  aria-label={lt("Remove post")}
                >
                  <X className="h-4 w-4" strokeWidth={1.75} />
                </button>
                <div className="flex gap-3">
                  <label
                    aria-label={lt("Upload cover image")}
                    className="relative flex h-[60px] w-[60px] shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[4px] border border-dashed border-[rgba(255,255,255,0.15)] bg-[var(--surface)]"
                  >
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      className="sr-only"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        handleInstagramFeedImage(slot.id, f);
                        e.target.value = "";
                      }}
                    />
                    {slot.imageUrl ? (
                      <img src={slot.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="px-1 text-center text-[9px] leading-tight text-[var(--muted)]">{lt("Upload")}</span>
                    )}
                  </label>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min={0}
                        step={1}
                        placeholder="0"
                        value={slot.likes}
                        onChange={(e) =>
                          setInstagramFeedDraft((d) =>
                            d.map((s) => (s.id === slot.id ? { ...s, likes: e.target.value } : s)),
                          )
                        }
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-white placeholder:text-[rgba(255,255,255,0.3)]"
                      />
                      <input
                        type="number"
                        min={0}
                        step={1}
                        placeholder="0"
                        value={slot.comments}
                        onChange={(e) =>
                          setInstagramFeedDraft((d) =>
                            d.map((s) => (s.id === slot.id ? { ...s, comments: e.target.value } : s)),
                          )
                        }
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-white placeholder:text-[rgba(255,255,255,0.3)]"
                      />
                    </div>
                    <textarea
                      rows={2}
                      maxLength={200}
                      placeholder={lt("Post caption or description...")}
                      value={slot.caption}
                      onChange={(e) =>
                        setInstagramFeedDraft((d) =>
                          d.map((s) => (s.id === slot.id ? { ...s, caption: e.target.value.slice(0, 200) } : s)),
                        )
                      }
                      className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-xs text-white placeholder:text-[rgba(255,255,255,0.3)]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addInstagramFeedDraftSlot}
            disabled={instagramFeedDraft.length >= 9}
            className="btn-ghost mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/25 py-2 text-xs text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            {lt("Add Post")}
          </button>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" className="btn-ghost rounded-lg px-3 py-2 text-xs" onClick={closeInstagramFeedModal}>
              {lt("Cancel")}
            </button>
            <button type="button" className="btn-primary rounded-lg px-3 py-2 text-xs" onClick={saveInstagramFeedFromModal}>
              {lt("Save")}
            </button>
          </div>
        </Modal>
      </div>

      <Card className="mt-6">
        <h2 className="section-title">{lt("Activity Summary")}</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {activity.length > 0 ? (
            activity.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-3">
                <p className="text-sm">{td(item.action)}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)]/20 text-[10px] font-normal text-[var(--primary)]">
                    {td(item.actor).slice(0, 1).toUpperCase()}
                  </span>
                  <p className="text-xs text-[var(--muted)]">{td(item.actor)}</p>
                  <span className="text-xs text-[var(--muted)]">
                    - <span className="mono-num">{td(item.timestamp)}</span>
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="md:col-span-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] p-4 text-center">
              <p className="text-sm text-[rgba(255,255,255,0.6)]">{lt("No recent activity yet")}</p>
            </div>
          )}
        </div>
      </Card>
    </ModuleGuard>
  );
}
