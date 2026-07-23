import Link from "next/link";

/**
 * Phase 0 placeholder — private delivery via signed URLs (documented before Deliveries build).
 */
export default async function PublicDeliveryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-[rgba(255,255,255,0.35)]">Delivery</p>
      <h1 className="mt-3 text-2xl font-normal text-white">Secure link</h1>
      <p className="mt-3 max-w-md text-sm text-[rgba(255,255,255,0.55)]">
        Client delivery pages will load here. Media will be served via short-lived signed URLs — never a public
        bucket. Token: {token.slice(0, 8)}…
      </p>
      <Link href="/login" className="mt-8 text-sm text-[rgba(255,69,0,0.9)] hover:underline">
        Sign in
      </Link>
    </main>
  );
}
