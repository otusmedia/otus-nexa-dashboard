"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** Legacy filmmaker route — moodboards now use /m/s/[shareSlug]. */
export default function LegacyPublicMoodboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState("");

  useEffect(() => {
    let mounted = true;
    void params.then(({ slug: s }) => {
      if (mounted) setSlug(s);
    });
    return () => {
      mounted = false;
    };
  }, [params]);

  return (
    <main
      className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-6 text-center"
      style={{ background: "oklch(97.5% 0 0)", color: "oklch(52% 0 0)" }}
    >
      <p className="text-xs uppercase tracking-[0.2em] text-black/35">/{slug}</p>
      <p className="mt-3 text-sm">
        Este link antigo não é mais usado. Peça o link público do moodboard (/m/s/…).
      </p>
      <Link href="/login" className="mt-6 text-sm text-[#ff4500] hover:underline">
        Sign in
      </Link>
    </main>
  );
}
