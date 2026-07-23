"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ModuleGuard } from "@/components/layout/module-guard";
import { PortfolioSite } from "@/components/portfolio/portfolio-site";
import { useAppContext } from "@/components/providers/app-providers";
import { useLanguage } from "@/context/language-context";
import { resolveAccountForSession } from "@/lib/accounts";
import {
  loadPortfolioSite,
  publishPortfolio,
  updatePortfolioPageDraft,
  upsertPortfolioItemDraft,
  type PortfolioSiteData,
} from "@/lib/portfolio";
import { uploadPortfolioMedia } from "@/lib/portfolio-upload";
import { effectiveUserClientSlug, isAgencyCompany } from "@/lib/client-utils";

export default function PortfolioPage() {
  const { currentUser, projectsClientFilter, dataClientSlug } = useAppContext();
  const { t: lt } = useLanguage();
  const [site, setSite] = useState<PortfolioSiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [preview, setPreview] = useState(false);

  const preferredSlug = useMemo(() => {
    if (isAgencyCompany(currentUser.company)) {
      return projectsClientFilter !== "all" ? projectsClientFilter : dataClientSlug;
    }
    return effectiveUserClientSlug(currentUser) || dataClientSlug;
  }, [currentUser, projectsClientFilter, dataClientSlug]);

  const reload = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError("");
      try {
        const account = await resolveAccountForSession(currentUser, preferredSlug);
        if (!account) {
          setSite(null);
          setError(
            isAgencyCompany(currentUser.company) && (!preferredSlug || preferredSlug === "all")
              ? lt("Select a client in the sidebar to edit their portfolio.")
              : lt("No account found for this session."),
          );
          return;
        }
        const data = await loadPortfolioSite(account.id, "draft");
        setSite(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : lt("Could not load portfolio."));
        if (!opts?.silent) setSite(null);
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [currentUser, preferredSlug, lt],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  const publicUrl = useMemo(() => {
    if (typeof window === "undefined") return null;
    if (site?.publicSlug) {
      return `${window.location.origin}/p/${site.publicSlug}`;
    }
    if (preferredSlug && preferredSlug !== "all") {
      return `${window.location.origin}/p/c/${preferredSlug}`;
    }
    return null;
  }, [site?.publicSlug, preferredSlug]);

  const projectHrefForItem = useMemo(() => {
    if (site?.publicSlug) {
      return (item: { id: string }) => `/p/${site.publicSlug}/w/${item.id}`;
    }
    if (preferredSlug && preferredSlug !== "all") {
      return (item: { id: string }) => `/p/c/${preferredSlug}/w/${item.id}`;
    }
    return undefined;
  }, [site?.publicSlug, preferredSlug]);

  return (
    <ModuleGuard module="portfolio">
      {loading ? (
        <div className="flex min-h-[50vh] items-center justify-center text-sm text-white/45">{lt("Loading…")}</div>
      ) : error && !site ? (
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <p className="text-sm text-white/60">{error}</p>
        </div>
      ) : site ? (
        <div className="min-h-full">
          {error ? <p className="bg-[#2b1111] px-4 py-2 text-center text-xs text-[#fca5a5]">{error}</p> : null}
          <div className="flex items-center justify-end gap-2 border-b border-white/[0.06] bg-[#0a0a0a] px-4 py-2">
            <button
              type="button"
              onClick={() => setPreview((v) => !v)}
              className="rounded-md border border-white/10 px-2.5 py-1 text-[0.7rem] text-white/55 hover:text-white"
            >
              {preview ? lt("Back to edit") : lt("Preview as visitor")}
            </button>
          </div>
          <PortfolioSite
            mode={preview ? "view" : "edit"}
            data={site}
            publicUrl={publicUrl}
            publishing={publishing}
            showSamples
            projectHrefForItem={preview ? projectHrefForItem : undefined}
            publishSuccessLabel={lt("Published successfully")}
            viewLiveLabel={lt("Open live page")}
            onChangePage={async (patch) => {
              try {
                await updatePortfolioPageDraft(site.accountId, patch);
                setSite((prev) => (prev ? { ...prev, page: { ...prev.page, ...patch } } : prev));
              } catch (err) {
                setError(err instanceof Error ? err.message : lt("Could not save."));
              }
            }}
            onUpload={async (folder, file) => uploadPortfolioMedia(site.accountId, file, folder)}
            onAddItem={async (input) => {
              const item = await upsertPortfolioItemDraft(site.accountId, input);
              setSite((prev) => (prev ? { ...prev, items: [...prev.items, item] } : prev));
            }}
            onPublish={async () => {
              setPublishing(true);
              setError("");
              try {
                await publishPortfolio(site.accountId);
                await reload({ silent: true });
              } catch (err) {
                setError(err instanceof Error ? err.message : lt("Could not publish."));
                throw err;
              } finally {
                setPublishing(false);
              }
            }}
          />
        </div>
      ) : null}
    </ModuleGuard>
  );
}
