"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PortfolioSite } from "@/components/portfolio/portfolio-site";
import { fetchAccountByClientSlug } from "@/lib/accounts";
import { loadPortfolioSite, type PortfolioSiteData } from "@/lib/portfolio";

/** Live portfolio for agency-linked clients (visitor-only, no editor chrome). */
export default function PublicClientPortfolioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState("");
  const [site, setSite] = useState<PortfolioSiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    void params.then(async ({ slug: s }) => {
      if (!mounted) return;
      setSlug(s);
      try {
        const account = await fetchAccountByClientSlug(s);
        if (!mounted) return;
        if (!account) {
          setError("Portfolio not found.");
          setSite(null);
          return;
        }
        const data = await loadPortfolioSite(account.id, "live");
        if (!mounted) return;
        setSite(data);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load portfolio.");
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

  if (error || !site) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center">
        <p className="text-sm text-white/55">{error || "Portfolio not found."}</p>
        <Link href="/login" className="mt-6 text-sm text-[#ff4500] hover:underline">
          Sign in
        </Link>
      </main>
    );
  }

  const hasLive =
    Boolean(site.publishedAt) ||
    Boolean(site.page.heroHeadline.trim()) ||
    site.items.length > 0 ||
    Boolean(site.page.aboutText.trim());

  if (!hasLive && !site.publishedAt) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-white/35">/{slug}</p>
        <p className="mt-3 text-sm text-white/55">This portfolio has not been published yet.</p>
      </main>
    );
  }

  return (
    <PortfolioSite
      mode="view"
      data={site}
      projectHrefForItem={(item) => `/p/c/${slug}/w/${item.id}`}
    />
  );
}
