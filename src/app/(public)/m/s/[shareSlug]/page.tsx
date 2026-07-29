"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MoodboardSite } from "@/components/moodboard/moodboard-site";
import { loadPublicMoodboardByShareSlug, type MoodboardSiteData } from "@/lib/moodboard";

export default function PublicMoodboardSharePage({
  params,
}: {
  params: Promise<{ shareSlug: string }>;
}) {
  const [slug, setSlug] = useState("");
  const [site, setSite] = useState<MoodboardSiteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    void params.then(async ({ shareSlug }) => {
      if (!mounted) return;
      setSlug(shareSlug);
      try {
        const data = await loadPublicMoodboardByShareSlug(shareSlug);
        if (!mounted) return;
        if (!data) {
          setError("Moodboard not found.");
          setSite(null);
        } else {
          setSite(data);
        }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load moodboard.");
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
      <main
        className="flex min-h-screen items-center justify-center text-sm"
        style={{ background: "oklch(97.5% 0 0)", color: "oklch(52% 0 0)" }}
      >
        Loading…
      </main>
    );
  }

  if (error || !site) {
    return (
      <main
        className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center"
        style={{ background: "oklch(97.5% 0 0)", color: "oklch(52% 0 0)" }}
      >
        <p className="text-sm">{error || "Moodboard not found."}</p>
        <Link href="/login" className="mt-6 text-sm text-[#ff4500] hover:underline">
          Sign in
        </Link>
      </main>
    );
  }

  if (!site.publishedAt) {
    return (
      <main
        className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center"
        style={{ background: "oklch(97.5% 0 0)", color: "oklch(52% 0 0)" }}
      >
        <p className="text-xs uppercase tracking-[0.2em] text-black/35">/{slug}</p>
        <p className="mt-3 text-sm">This moodboard has not been published yet.</p>
      </main>
    );
  }

  return <MoodboardSite mode="view" data={site} />;
}
