import Link from "next/link";

/**
 * Phase 0 placeholder — real portfolio loads only for kind=filmmaker + public_slug.
 */
export default async function PublicPortfolioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-[rgba(255,255,255,0.35)]">Portfolio</p>
      <h1 className="mt-3 text-2xl font-normal text-white">/{slug}</h1>
      <p className="mt-3 max-w-md text-sm text-[rgba(255,255,255,0.55)]">
        Public portfolio pages will load here for filmmaker accounts only. Agency client accounts never get a
        public slug.
      </p>
      <Link href="/login" className="mt-8 text-sm text-[rgba(255,69,0,0.9)] hover:underline">
        Sign in
      </Link>
    </main>
  );
}
