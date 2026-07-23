"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PortfolioProjectView } from "@/components/portfolio/portfolio-project-view";
import { fetchAccountByClientSlug } from "@/lib/accounts";
import {
  loadPortfolioItem,
  loadPortfolioSite,
  type PortfolioItemContent,
  type PortfolioSiteData,
} from "@/lib/portfolio";

export default function PublicClientPortfolioProjectPage({
  params,
}: {
  params: Promise<{ slug: string; itemId: string }>;
}) {
  const [slug, setSlug] = useState("");
  const [site, setSite] = useState<PortfolioSiteData | null>(null);
  const [item, setItem] = useState<PortfolioItemContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    void params.then(async ({ slug: s, itemId }) => {
      if (!mounted) return;
      setSlug(s);
      try {
        const account = await fetchAccountByClientSlug(s);
        if (!mounted) return;
        if (!account) {
          setError("Portfolio not found.");
          return;
        }
        const data = await loadPortfolioSite(account.id, "live");
        if (!mounted) return;
        setSite(data);
        const found = await loadPortfolioItem(account.id, itemId, "live");
        if (!mounted) return;
        if (!found || !found.title) {
          setError("Project not found.");
          return;
        }
        setItem(found);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load project.");
      } finally {
        if (mounted) setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [params]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-sm text-white/45">
        Loading…
      </main>
    );
  }

  if (error || !item) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center">
        <p className="text-sm text-white/55">{error || "Project not found."}</p>
        <Link href={slug ? `/p/c/${slug}` : "/"} className="mt-6 text-sm text-[#ff4500] hover:underline">
          Back to portfolio
        </Link>
      </main>
    );
  }

  return (
    <PortfolioProjectView
      item={item}
      backHref={`/p/c/${slug}`}
      relatedItems={site?.items ?? []}
      projectHrefForItem={(rel) => `/p/c/${slug}/w/${rel.id}`}
      contactHref={`/p/c/${slug}#about`}
      contactLabel={site?.page.ctaLabel || "Get in touch"}
    />
  );
}
