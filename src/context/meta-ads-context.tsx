"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { MetaAdsCampaign, MetaAdsSource, MetaAdsSummary } from "@/types/meta-ads";

const STORAGE_KEY = "meta-ads-import";

type PersistedMetaAds = {
  campaigns: MetaAdsCampaign[];
  summary: MetaAdsSummary;
  lastImported: string;
  source: "csv" | "api";
};

type MetaAdsContextValue = {
  campaigns: MetaAdsCampaign[];
  summary: MetaAdsSummary | null;
  lastImported: string | null;
  source: MetaAdsSource;
  setImportedCsv: (payload: { campaigns: MetaAdsCampaign[]; summary: MetaAdsSummary }) => void;
  clearImported: () => void;
};

const MetaAdsContext = createContext<MetaAdsContextValue | null>(null);

function readStorage(): PersistedMetaAds | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedMetaAds;
    if (!data || !Array.isArray(data.campaigns) || !data.summary) return null;
    if (data.source !== "csv" && data.source !== "api") return null;
    return data;
  } catch {
    return null;
  }
}

function writeStorage(data: PersistedMetaAds) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function MetaAdsProvider({ children }: { children: React.ReactNode }) {
  const [campaigns, setCampaigns] = useState<MetaAdsCampaign[]>([]);
  const [summary, setSummary] = useState<MetaAdsSummary | null>(null);
  const [lastImported, setLastImported] = useState<string | null>(null);
  const [source, setSource] = useState<MetaAdsSource>(null);

  useEffect(() => {
    const stored = readStorage();
    if (stored) {
      setCampaigns(stored.campaigns);
      setSummary(stored.summary);
      setLastImported(stored.lastImported);
      setSource(stored.source);
    }
  }, []);

  const setImportedCsv = useCallback((payload: { campaigns: MetaAdsCampaign[]; summary: MetaAdsSummary }) => {
    const iso = new Date().toISOString();
    setCampaigns(payload.campaigns);
    setSummary(payload.summary);
    setLastImported(iso);
    setSource("csv");
    writeStorage({
      campaigns: payload.campaigns,
      summary: payload.summary,
      lastImported: iso,
      source: "csv",
    });
  }, []);

  const clearImported = useCallback(() => {
    setCampaigns([]);
    setSummary(null);
    setLastImported(null);
    setSource(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const value = useMemo<MetaAdsContextValue>(
    () => ({
      campaigns,
      summary,
      lastImported,
      source,
      setImportedCsv,
      clearImported,
    }),
    [campaigns, summary, lastImported, source, setImportedCsv, clearImported],
  );

  return <MetaAdsContext.Provider value={value}>{children}</MetaAdsContext.Provider>;
}

export function useMetaAds() {
  const ctx = useContext(MetaAdsContext);
  if (!ctx) {
    throw new Error("useMetaAds must be used within MetaAdsProvider");
  }
  return ctx;
}
