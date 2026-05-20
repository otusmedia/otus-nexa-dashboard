"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  clearMetaAdsCsvForClient,
  readMetaAdsCsvForClient,
  writeMetaAdsCsvForClient,
  type PersistedMetaAdsCsv,
} from "@/lib/dashboard-csv-storage";
import type { MetaAdsCampaign, MetaAdsSource, MetaAdsSummary } from "@/types/meta-ads";

type MetaAdsContextValue = {
  campaigns: MetaAdsCampaign[];
  summary: MetaAdsSummary | null;
  lastImported: string | null;
  source: MetaAdsSource;
  activeClientSlug: string | null;
  loadCsvForClient: (clientSlug: string | null) => void;
  setImportedCsv: (
    clientSlug: string,
    payload: { campaigns: MetaAdsCampaign[]; summary: MetaAdsSummary },
  ) => void;
  clearImportedForClient: (clientSlug: string) => void;
};

const MetaAdsContext = createContext<MetaAdsContextValue | null>(null);

function applyPersisted(
  data: PersistedMetaAdsCsv,
  setters: {
    setCampaigns: (c: MetaAdsCampaign[]) => void;
    setSummary: (s: MetaAdsSummary) => void;
    setLastImported: (iso: string) => void;
    setSource: (s: MetaAdsSource) => void;
  },
) {
  setters.setCampaigns(data.campaigns);
  setters.setSummary(data.summary);
  setters.setLastImported(data.lastImported);
  setters.setSource("csv");
}

function clearInMemory(setters: {
  setCampaigns: (c: MetaAdsCampaign[]) => void;
  setSummary: (s: MetaAdsSummary | null) => void;
  setLastImported: (iso: string | null) => void;
  setSource: (s: MetaAdsSource) => void;
}) {
  setters.setCampaigns([]);
  setters.setSummary(null);
  setters.setLastImported(null);
  setters.setSource(null);
}

export function MetaAdsProvider({ children }: { children: React.ReactNode }) {
  const [campaigns, setCampaigns] = useState<MetaAdsCampaign[]>([]);
  const [summary, setSummary] = useState<MetaAdsSummary | null>(null);
  const [lastImported, setLastImported] = useState<string | null>(null);
  const [source, setSource] = useState<MetaAdsSource>(null);
  const [activeClientSlug, setActiveClientSlug] = useState<string | null>(null);

  const setters = useMemo(
    () => ({
      setCampaigns,
      setSummary,
      setLastImported,
      setSource,
    }),
    [],
  );

  const loadCsvForClient = useCallback(
    (clientSlug: string | null) => {
      setActiveClientSlug(clientSlug);
      if (!clientSlug) {
        clearInMemory(setters);
        return;
      }
      const stored = readMetaAdsCsvForClient(clientSlug);
      if (stored) {
        applyPersisted(stored, setters);
        return;
      }
      clearInMemory(setters);
    },
    [setters],
  );

  const setImportedCsv = useCallback(
    (clientSlug: string, payload: { campaigns: MetaAdsCampaign[]; summary: MetaAdsSummary }) => {
      const iso = new Date().toISOString();
      setActiveClientSlug(clientSlug);
      setCampaigns(payload.campaigns);
      setSummary(payload.summary);
      setLastImported(iso);
      setSource("csv");
      writeMetaAdsCsvForClient(clientSlug, {
        campaigns: payload.campaigns,
        summary: payload.summary,
        lastImported: iso,
      });
    },
    [],
  );

  const clearImportedForClient = useCallback(
    (clientSlug: string) => {
      clearMetaAdsCsvForClient(clientSlug);
      if (activeClientSlug === clientSlug) {
        clearInMemory(setters);
      }
    },
    [activeClientSlug, setters],
  );

  const value = useMemo<MetaAdsContextValue>(
    () => ({
      campaigns,
      summary,
      lastImported,
      source,
      activeClientSlug,
      loadCsvForClient,
      setImportedCsv,
      clearImportedForClient,
    }),
    [
      campaigns,
      summary,
      lastImported,
      source,
      activeClientSlug,
      loadCsvForClient,
      setImportedCsv,
      clearImportedForClient,
    ],
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
